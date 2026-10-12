// Bakes one floor of the real game (src/core/floorgen.js + tasks.js) into the C64 floor file.
// Unpacked layout at FLOOR_BASE ($8000):
//   MAP   40×28 char codes     MAPCOL 40×28 colour RAM values     INFO 40×28 (0 blocked, 1 walkable, 2+n interactable n)
//   HDR   spawn, NPC table, interactable table, floor name/title, string pool  (offsets in gen/floor.inc)
import { T_WALL } from '../../src/core/floorgen.js';
import { buildFloor } from '../../src/core/tasks.js';
import { departmentForFloor, titleForFloor, floorName } from '../../src/data/departments.js';
import { npcIdentity, posterContent } from '../../src/scenes/floorWorld.js';
import { FLOOR_ART, WALL_CAP, WALL_FACE, capBelow, drawItem, composite, COL, UI } from './art.js';

export const FLOOR_BASE = 0x8000;
export const FLOOR_MAX = 0x1400; // $8000-$93ff
const W = 40;
const H = 28;
const N = W * H;
export const OFF = { MAP: 0, MAPCOL: N, INFO: 2 * N, HDR: 3 * N };
// Header: spawns, actors (colleagues, receptionist, HR rep), interactables, names, string pool.
//   NPC entry: x lo, x hi, y, colour, still, kind (0 colleague, 1 receptionist, 2 HR rep), who lo, who hi
//              (who = "Name\0Role\0")
//   IA entry:  kind, arg, marker lo, marker hi, under char, under colour, str lo, str hi, x, y, w, arg2
//              station: arg = game index, str = task title, arg2 = difficulty 0-255 | flags in w (bit 7 check-in)
//              poster: arg = 0 sponsor / 1 ad, str = "brand\0tagline\0"
//              turnstile: str = the open turnstile's chars for its cells (w × 2 rows: top, then the cells)
export const HDR = {
  SPAWN: 0, ENTRY: 3, NPCS: 6, NPC: 7, NPC_MAX: 15, NPC_SIZE: 8,
  IACTS: 127, IA: 128, IA_MAX: 20, IA_SIZE: 12,
  FLOORNO: 368, NAME: 369, TITLE: 393, DEPT: 417, TERMID: 441, STATIONS: 442, STR: 443,
};
export const KIND = { station: 0, elevator: 1, hr: 2, terminal: 3, coffee: 4, turnstile: 5, poster: 6 };
export const ACTOR = { colleague: 0, receptionist: 1, hr: 2 };

const ROOM_FLOOR = {
  kitchen: ['tile', COL.white],
  restroom: ['bathroom', COL.cyan],
  elevator: ['marble', COL.white],
  reception: ['marble', COL.white],
  hr: ['parquet', COL.black],
  openplan: ['carpet', COL.blue],
  meeting: ['carpet', COL.purple],
  special: ['carpet', COL.red],
};
const SHIRTS = [2, 5, 8, 14, 13, 7, 3, 10];
const RECEPTIONIST_SEED = 4242;

/** Bakes floor `floor`. `games`: game id -> index in the resident game table. */
export function bakeFloor(floor, cs, games, { crowd = false } = {}) {
  const fl = buildFloor(floor);
  const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || fl.tiles[y * W + x] === T_WALL;
  const floorCell = (x, y) => {
    if (isWall(x, y)) return { rows: isWall(x, y + 1) ? WALL_CAP : WALL_FACE, color: 0 };
    const room = fl.rooms[fl.roomOf[y * W + x]];
    const [style, color] = room ? ROOM_FLOOR[room.type] || ['carpet', COL.green] : ['hall', COL.white];
    const art = FLOOR_ART[style];
    return { rows: y + 1 < H && isWall(x, y + 1) ? capBelow(art) : art, color };
  };
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push(floorCell(x, y));

  // Furniture, top to bottom so lower items' tops overlap what stands behind them.
  const paint = (target, it, type) => {
    const { grid, color } = drawItem(type, it.w, it.h);
    for (let cy = -1; cy < it.h; cy++)
      for (let cx = 0; cx < it.w; cx++) {
        const x = it.x + cx;
        const y = it.y + cy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const part = grid.slice((cy + 1) * 8, (cy + 2) * 8).map((row) => row.slice(cx * 4, cx * 4 + 4));
        if (part.every((row) => row.every((s) => s === '_'))) continue;
        const usesC = part.some((row) => row.includes('c'));
        const cell = target[y * W + x];
        cell.rows = composite(cell.rows, part, usesC);
        if (usesC) cell.color = color;
      }
  };
  const items = [...fl.items].sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const it of items) paint(cells, it, it.type);

  // The open turnstile: the same cells repainted with the gate open (the C64 swaps them in after check-in).
  let gateOpen = null;
  if (fl.turnstile) {
    const t = fl.turnstile;
    const alt = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) alt.push(floorCell(x, y));
    for (const it of items) paint(alt, it, it === t ? 'turnstileopen' : it.type);
    gateOpen = { t, alt };
  }

  // Hallway posters: hires text on the corridor wall.
  const posters = (fl.posters || []).map((p) => {
    const c = posterContent(p, floor);
    const len = p.x1 - p.x0 + 1;
    const text = c.ad ? c.ad.name.split(' ')[0].toUpperCase().slice(0, len) : len >= 9 ? 'YOUR LOGO' : 'LOGO';
    const x0 = p.x0 + Math.floor((len - text.length) / 2);
    [...text].forEach((ch, i) => (cells[p.y * W + x0 + i] = { code: ch.charCodeAt(0), color: c.ad ? COL.yellow : COL.white }));
    return { p, ad: c.ad, x0, len: text.length };
  });

  // Interactables.
  const iacts = [];
  const add = (kind, it, extra = {}) => iacts.push({ kind, item: it, ...extra });
  for (const it of fl.items) if (it.task) add(KIND.station, it, { game: it.task.game, task: it.task }); // stations first
  for (const it of fl.items) {
    if (it.task) continue;
    else if (it.interact === 'elevator') add(KIND.elevator, it);
    else if (it.interact === 'coffee') add(KIND.coffee, it);
    else if (it.interact === 'hr') add(KIND.hr, it);
    else if (it.interact === 'turnstile') add(KIND.turnstile, it);
    else if (it.terminal) add(KIND.terminal, it);
  }
  for (const ps of posters) add(KIND.poster, { x: ps.x0, y: ps.p.y, w: ps.len, h: 1 }, { ad: ps.ad });
  if (iacts.length > HDR.IA_MAX) throw new Error('too many interactables');

  // Walk/interact grid: 0 blocked, 1 walkable, 2+n interactable n. Posters sit on the wall (blocked anyway).
  const info = new Uint8Array(N);
  for (let i = 0; i < N; i++) info[i] = fl.walk[i] ? 1 : 0;
  iacts.forEach((ia, n) => {
    const it = ia.item;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) info[y * W + x] = 2 + n;
    // Marker cell above the item (stations "!", HR, elevator, coffee, terminal).
    if (ia.kind !== KIND.turnstile && ia.kind !== KIND.poster) {
      const mx = it.x + (it.w >> 1);
      const my = Math.max(0, it.y - 1);
      ia.marker = my * W + mx;
    }
  });

  // Resolve cells to char codes + colour RAM values (bit 3 = multicolour).
  const resolve = (c) => (c.code != null ? [c.code, c.color] : [cs.mc(c.rows), c.color | 8]);
  const map = new Uint8Array(N);
  const col = new Uint8Array(N);
  cells.forEach((c, i) => ([map[i], col[i]] = resolve(c)));

  // Header + string pool.
  const hdr = new Uint8Array(FLOOR_MAX - OFF.HDR);
  let strAt = HDR.STR;
  const bytes = (arr) => {
    const at = FLOOR_BASE + OFF.HDR + strAt;
    hdr.set(arr, strAt);
    strAt += arr.length;
    return at;
  };
  const str = (...parts) => bytes(parts.flatMap((s) => [...asc(s), 0]));
  const putStr = (off, s, max) => hdr.set([...asc(s.slice(0, max - 1)), 0], off);
  const pos = (x, y) => {
    const px = Math.round(x * 8);
    return [px & 0xff, px >> 8, Math.round(y * 8)];
  };
  hdr.set(pos(19.9, 2.6), HDR.SPAWN);
  hdr.set(fl.entrance ? pos(19.9, H - 2.2) : pos(19.9, 2.6), HDR.ENTRY);

  const npcs = fl.npcs.map((n, i) => {
    const id = npcIdentity(n.seed, fl.dept);
    return { x: Math.round(n.x * 8), y: Math.round(n.y * 8) + 2, color: SHIRTS[(n.seed + i) % SHIRTS.length], still: 0, kind: ACTOR.colleague, who: [id.name, id.role] };
  });
  if (fl.hrRep) {
    const r = fl.hrRep;
    npcs.push({ x: r.x * 8 + 4, y: r.y * 8 + 7, color: COL.purple, still: 1, kind: ACTOR.hr, who: [npcIdentity(floor * 91 + 7, 'legalhr').name, 'HR Business Partner'] });
  }
  if (fl.receptionist) {
    const r = fl.receptionist;
    npcs.push({ x: Math.round((r.x + r.w / 2) * 8), y: r.y * 8 + 7, color: 0xff, still: 1, kind: ACTOR.receptionist, who: [npcIdentity(RECEPTIONIST_SEED, 'lobby').name, 'Reception'] });
  }
  // Test builds (--crowd): fill the floor up to the multiplexer's limit with extra wandering colleagues.
  for (let i = 0; crowd && npcs.length < HDR.NPC_MAX; i++) {
    const c = (i * 379 + 101) % N;
    const x = c % W;
    const y = (c / W) | 0;
    if (fl.walk[c] && fl.walk[c + 1] && y > 1) npcs.push({ x: x * 8 + 4, y: y * 8 + 6, color: SHIRTS[i % SHIRTS.length], still: 0, kind: 0, who: ['Extra', 'Crowd'] });
  }
  if (npcs.length > HDR.NPC_MAX) throw new Error('too many actors');
  hdr[HDR.NPCS] = npcs.length;
  npcs.forEach((n, i) => {
    const who = str(...n.who);
    hdr.set([n.x & 0xff, n.x >> 8, n.y, n.color, n.still, n.kind, who & 0xff, who >> 8], HDR.NPC + i * HDR.NPC_SIZE);
  });

  hdr[HDR.IACTS] = iacts.length;
  iacts.forEach((ia, n) => {
    const it = ia.item;
    let arg = 0;
    let arg2 = 0;
    let w = it.w;
    let s = 0;
    if (ia.kind === KIND.station) {
      if (!(ia.game in games)) throw new Error(`no C64 game entry for ${ia.game}`);
      arg = games[ia.game];
      arg2 = Math.min(255, Math.round(ia.task.difficulty * 255));
      if (ia.task.checkin) w |= 0x80;
      s = str(ia.task.title);
    } else if (ia.kind === KIND.poster) {
      arg = ia.ad ? 1 : 0;
      s = ia.ad ? str(ia.ad.name, ia.ad.tagline) : 0;
    } else if (ia.kind === KIND.turnstile && gateOpen) {
      if (it.w > 8) throw new Error('turnstile wider than 8 tiles');
      for (let k = 0; k < it.w; k++) if (fl.walk[it.y * W + it.x + k]) arg2 |= 1 << k; // its lanes (posts stay solid)
      const codes = [];
      for (const y of [it.y - 1, it.y]) for (let x = it.x; x < it.x + it.w; x++) codes.push(resolve(gateOpen.alt[y * W + x])[0]);
      s = bytes(codes);
    }
    const marker = ia.marker ?? 0xffff;
    const [uc, ucol] = ia.marker != null ? [map[ia.marker], col[ia.marker]] : [0, 0];
    hdr.set([ia.kind, arg, marker & 0xff, marker >> 8, uc, ucol, s & 0xff, s >> 8, it.x, it.y, w, arg2], HDR.IA + n * HDR.IA_SIZE);
  });
  hdr[HDR.FLOORNO] = floor;
  putStr(HDR.NAME, floorName(floor), 24);
  putStr(HDR.TITLE, titleForFloor(floor), 24);
  putStr(HDR.DEPT, departmentForFloor(floor).name, 24);
  hdr[HDR.TERMID] = fl.items.find((it) => it.terminal)?.id ?? 0;
  hdr[HDR.STATIONS] = iacts.filter((ia) => ia.kind === KIND.station).length;
  if (OFF.HDR + strAt > FLOOR_MAX) throw new Error(`floor ${floor} file too big: ${OFF.HDR + strAt} B`);

  const bin = new Uint8Array(OFF.HDR + strAt);
  bin.set(map, OFF.MAP);
  bin.set(col, OFF.MAPCOL);
  bin.set(info, OFF.INFO);
  bin.set(hdr.subarray(0, strAt), OFF.HDR);
  return { bin, fl, info, iacts, dept: departmentForFloor(floor) };
}

/** ASCII bytes (the charset's font is at its ASCII codes); fails on characters the C64 font lacks. */
export function asc(s) {
  const out = [...s].map((ch) => ch.charCodeAt(0));
  if (out.some((c) => c < 32 || c > 126)) throw new Error(`no C64 glyph in "${s}"`);
  return out;
}

/** Joystick script for the AUTOPLAY test build: walk from the spawn to each target in turn (a station's game id,
 * or an interactable kind: 'hr', 'elevator', 'terminal', ...), face it, press fire, then idle `wait` frames.
 * `tour`: first walk to the bottom of the floor (the demo shows the camera scrolling). */
export function autoplayScript(fl, info, iacts, plan, { tour = false, fromEntrance = false } = {}) {
  const targets = (Array.isArray(plan) ? plan : [{ game: plan }]).map((t) => (typeof t === 'string' ? { game: t } : t));
  const spawn = fromEntrance && fl.entrance ? { x: 19.9, y: H - 2.2 } : { x: 19.9, y: 2.6 };
  const sx = Math.floor(spawn.x);
  const sy = Math.floor((Math.round(spawn.y * 8) - 1) / 8);
  const bfs = (start, isGoal) => {
    const prev = new Map([[start, -1]]);
    const queue = [start];
    while (queue.length) {
      const c = queue.shift();
      if (isGoal(c % W, (c / W) | 0)) {
        const path = [];
        for (let p = c; p !== -1; p = prev.get(p)) path.unshift(p);
        return path;
      }
      const x = c % W;
      const y = (c / W) | 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const n = (y + dy) * W + x + dx;
        if (x + dx < 0 || x + dx >= W || y + dy < 0 || y + dy >= H || prev.has(n) || info[n] !== 1) continue;
        prev.set(n, c);
        queue.push(n);
      }
    }
    return null;
  };
  const JOY = { up: 1, down: 2, left: 4, right: 8, fire: 16 };
  const steps = [];
  const spawnPy = Math.round(spawn.y * 8);
  const align = spawnPy - (sy * 8 + 6);
  if (align > 0) steps.push([align, JOY.up]);
  const alignX = Math.round(spawn.x * 8) - (sx * 8 + 4); // to the middle of the tile, for narrow doors
  if (alignX > 0) steps.push([alignX, JOY.left]);
  let at = sy * W + sx;
  if (tour) {
    let low = 0;
    for (let i = 0; i < W * H; i++) if (info[i] === 1 && bfs(at, (x, y) => y * W + x === i)) low = Math.max(low, (i / W) | 0);
    const leg = bfs(at, (x, y) => y === low);
    for (let i = 1; i < leg.length; i++) steps.push([8, dirOf(leg[i] - leg[i - 1])]);
    at = leg[leg.length - 1];
  }
  for (const t of targets) {
    const ia = iacts.find((i) => (t.game ? i.game === t.game : i.kind === KIND[t.kind]));
    if (!ia) throw new Error(`autoplay: no target ${t.game || t.kind}`);
    const it = ia.item;
    // A cell next to the item (not diagonal), from which the player faces it.
    const next = (x, y) =>
      x >= it.x - 1 && x <= it.x + it.w && y >= it.y - 1 && y <= it.y + it.h &&
      (x < it.x || x >= it.x + it.w || y < it.y || y >= it.y + it.h) &&
      ((x >= it.x && x < it.x + it.w) || (y >= it.y && y < it.y + it.h));
    const path = bfs(at, next);
    if (!path) throw new Error(`autoplay: ${t.game || t.kind} unreachable`);
    for (let i = 1; i < path.length; i++) steps.push([8, dirOf(path[i] - path[i - 1])]);
    at = path[path.length - 1];
    const gx = at % W;
    const gy = (at / W) | 0;
    const face = gy < it.y ? JOY.down : gy >= it.y + it.h ? JOY.up : gx < it.x ? JOY.right : JOY.left;
    steps.push([2, face], [10, 0], [2, JOY.fire], [10, 0]);
    for (let w = t.wait || 0; w > 0; w -= 250) steps.push([Math.min(250, w), 0]);
    for (const [n, j] of t.then || []) steps.push([n, j]); // extra presses (dialog buttons)
  }
  // Merge consecutive identical entries (frame counts fit a byte).
  const merged = [];
  for (const [n, j] of steps) {
    const last = merged[merged.length - 1];
    if (last && last[1] === j && last[0] + n < 256) last[0] += n;
    else merged.push([n, j]);
  }
  return merged;
  function dirOf(d) {
    return d === 1 ? JOY.right : d === -1 ? JOY.left : d > 0 ? JOY.down : JOY.up;
  }
}
