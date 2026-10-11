// Bakes one floor of the real game (src/core/floorgen.js + tasks.js) into the C64 floor file.
// Unpacked layout at FLOOR_BASE ($8000):
//   MAP   40×28 char codes     MAPCOL 40×28 colour RAM values     INFO 40×28 (0 blocked, 1 walkable, 2+n interactable n)
//   HDR   spawn, NPC table, interactable table, floor name/title, string pool  (offsets in gen/floor.inc)
import { T_WALL } from '../../src/core/floorgen.js';
import { buildFloor } from '../../src/core/tasks.js';
import { MINIGAMES } from '../../src/minigames/index.js';
import { taskCoffeeCost } from '../../src/core/economy.js';
import { departmentForFloor, titleForFloor, floorName } from '../../src/data/departments.js';
import { POSTER_TEXT, FAKE_ADS } from '../../src/data/sponsors.js';
import { FLOOR_ART, WALL_CAP, WALL_FACE, capBelow, drawItem, composite, COL, UI } from './art.js';

export const FLOOR_BASE = 0x8000;
const W = 40;
const H = 28;
const N = W * H;
export const OFF = { MAP: 0, MAPCOL: N, INFO: 2 * N, HDR: 3 * N };
export const HDR = { SPAWN: 0, NPCS: 3, NPC: 4, NPC_MAX: 7, NPC_SIZE: 5, IACTS: 40, IA: 41, IA_MAX: 16, IA_SIZE: 10, NAME: 201, TITLE: 225, STR: 249 };
export const KIND = { station: 0, elevator: 1, hr: 2 };

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

/** C64 overlays that exist so far: game id -> disk file name. */
export const OVERLAYS = { memory: 'mg.memory', jargon: 'mg.jargon', bingo: 'mg.bingo', stealth: 'mg.stealth' };

/** `files`: disk file name -> { track, sector } of the overlays already placed on the disk. */
export function bakeFloor(floor, cs, files = {}) {
  const fl = buildFloor(floor);
  const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || fl.tiles[y * W + x] === T_WALL;
  const cells = []; // { rows, color, hires? }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isWall(x, y)) {
        cells.push({ rows: isWall(x, y + 1) ? WALL_CAP : WALL_FACE, color: 0 });
        continue;
      }
      const room = fl.rooms[fl.roomOf[y * W + x]];
      const [style, color] = room ? ROOM_FLOOR[room.type] || ['carpet', COL.green] : ['hall', COL.white];
      const art = FLOOR_ART[style];
      cells.push({ rows: y + 1 < H && isWall(x, y + 1) ? capBelow(art) : art, color });
    }

  // Furniture, top to bottom so lower items' tops overlap what stands behind them.
  for (const it of [...fl.items].sort((a, b) => a.y + a.h - (b.y + b.h))) {
    const { grid, color } = drawItem(it.type, it.w, it.h);
    for (let cy = -1; cy < it.h; cy++)
      for (let cx = 0; cx < it.w; cx++) {
        const x = it.x + cx;
        const y = it.y + cy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const part = grid.slice((cy + 1) * 8, (cy + 2) * 8).map((row) => row.slice(cx * 4, cx * 4 + 4));
        if (part.every((row) => row.every((s) => s === '_'))) continue;
        const usesC = part.some((row) => row.includes('c'));
        const cell = cells[y * W + x];
        cell.rows = composite(cell.rows, part, usesC);
        if (usesC) cell.color = color;
      }
  }

  // Hallway posters: hires text on the corridor wall.
  for (const p of fl.posters || []) {
    const len = p.x1 - p.x0 + 1;
    const text = p.kind === 'ad' ? FAKE_ADS[(floor - 1) % FAKE_ADS.length].name.split(' ')[0].toUpperCase() : len >= 9 ? 'YOUR LOGO' : 'LOGO';
    const x0 = p.x0 + Math.floor((len - text.length) / 2);
    [...text].forEach((ch, i) => (cells[p.y * W + x0 + i] = { code: ch.charCodeAt(0), color: p.kind === 'ad' ? COL.yellow : COL.white }));
  }
  void POSTER_TEXT;

  // Interactables: stations with tasks, the elevator, the HR desk.
  const iacts = [];
  for (const t of fl.tasks) iacts.push({ kind: KIND.station, item: t, game: t.task.game });
  iacts.push({ kind: KIND.elevator, item: fl.elevator, name: 'Elevator (needs a promotion)' });
  iacts.push({ kind: KIND.hr, item: fl.hrDesk, name: 'HR office (later)' });
  if (iacts.length > HDR.IA_MAX) throw new Error('too many interactables');
  const info = new Uint8Array(N);
  for (let i = 0; i < N; i++) info[i] = fl.walk[i] ? 1 : 0;
  iacts.forEach((ia, n) => {
    const it = ia.item;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) info[y * W + x] = 2 + n;
    if (ia.kind === KIND.station) {
      const mx = it.x + (it.w >> 1);
      const my = it.y - 1;
      ia.marker = my * W + mx;
      ia.under = cells[ia.marker];
      cells[ia.marker] = { code: UI.marker, color: COL.yellow };
    }
  });

  // Resolve cells to char codes + colour RAM values (bit 3 = multicolour).
  const map = new Uint8Array(N);
  const col = new Uint8Array(N);
  const resolve = (c) => (c.code != null ? [c.code, c.color] : [cs.mc(c.rows), c.color | 8]);
  cells.forEach((c, i) => ([map[i], col[i]] = resolve(c)));

  // Header + string pool.
  const hdr = new Uint8Array(1024);
  let strAt = HDR.STR;
  const str = (s) => {
    const at = FLOOR_BASE + OFF.HDR + strAt;
    for (const ch of s) hdr[strAt++] = ch.charCodeAt(0);
    hdr[strAt++] = 0;
    return at;
  };
  const putStr = (off, s, max) => [...s.slice(0, max - 1)].forEach((ch, i) => (hdr[off + i] = ch.charCodeAt(0)));
  const px = Math.round(fl.spawn.x * 8);
  hdr.set([px & 0xff, px >> 8, Math.round(fl.spawn.y * 8)], HDR.SPAWN);
  const npcs = fl.npcs.map((n, i) => ({ x: Math.round(n.x * 8), y: Math.round(n.y * 8) + 2, color: SHIRTS[(n.seed + i) % SHIRTS.length], still: 0 }));
  if (fl.hrRep) npcs.push({ x: fl.hrRep.x * 8 + 4, y: fl.hrRep.y * 8 + 7, color: COL.purple, still: 1 });
  const shown = npcs.slice(0, HDR.NPC_MAX);
  hdr[HDR.NPCS] = shown.length;
  shown.forEach((n, i) => hdr.set([n.x & 0xff, n.x >> 8, n.y, n.color, n.still], HDR.NPC + i * HDR.NPC_SIZE));
  hdr[HDR.IACTS] = iacts.length;
  iacts.forEach((ia, n) => {
    const name = ia.name || MINIGAMES[ia.game].name;
    const namePtr = str(name);
    const file = ia.game && files[OVERLAYS[ia.game]];
    const [uc, ucol] = ia.under ? resolve(ia.under) : [0, 0];
    const marker = ia.marker ?? 0xffff;
    hdr.set([ia.kind, ia.game ? taskCoffeeCost(ia.game) : 0, marker & 0xff, marker >> 8, uc, ucol, namePtr & 0xff, namePtr >> 8, file ? file.track : 0, file ? file.sector : 0], HDR.IA + n * HDR.IA_SIZE);
  });
  putStr(HDR.NAME, `F${floor} ${floorName(floor)}`, 24);
  putStr(HDR.TITLE, titleForFloor(floor), 24);
  if (strAt > hdr.length) throw new Error('floor header overflow');

  const bin = new Uint8Array(OFF.HDR + strAt);
  bin.set(map, OFF.MAP);
  bin.set(col, OFF.MAPCOL);
  bin.set(info, OFF.INFO);
  bin.set(hdr.subarray(0, strAt), OFF.HDR);
  return { bin, fl, info, iacts, dept: departmentForFloor(floor) };
}

/** Joystick script for the AUTOPLAY test build: walk from the spawn to `game`'s station and press fire.
 * `tour`: first walk to the bottom of the floor (the demo shows the camera scrolling). */
export function autoplayScript(fl, info, iacts, game, { tour = false } = {}) {
  const target = iacts.findIndex((ia) => ia.game === game);
  const it = iacts[target].item;
  const sx = Math.floor(fl.spawn.x);
  const sy = Math.floor((Math.round(fl.spawn.y * 8) - 1) / 8);
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
  // A cell next to the station (not diagonal), from which the player faces it.
  const nextToStation = (x, y) =>
    x >= it.x - 1 && x <= it.x + it.w && y >= it.y - 1 && y <= it.y + it.h &&
    (x < it.x || x >= it.x + it.w || y < it.y || y >= it.y + it.h) &&
    ((x >= it.x && x < it.x + it.w) || (y >= it.y && y < it.y + it.h));
  let path = [sy * W + sx];
  if (tour) {
    let low = 0;
    for (let i = 0; i < W * H; i++) if (info[i] === 1 && bfs(path[0], (x, y) => y * W + x === i)) low = Math.max(low, (i / W) | 0);
    const leg = bfs(path[0], (x, y) => y === low);
    path = leg;
  }
  const last = bfs(path[path.length - 1], nextToStation);
  if (!last) throw new Error('autoplay: station unreachable');
  path = [...path, ...last.slice(1)];
  const goal = path[path.length - 1];
  const JOY = { up: 1, down: 2, left: 4, right: 8, fire: 16 };
  const steps = [];
  const spawnPy = Math.round(fl.spawn.y * 8);
  const align = spawnPy - (sy * 8 + 6);
  if (align > 0) steps.push([align, JOY.up]);
  for (let i = 1; i < path.length; i++) {
    const d = path[i] - path[i - 1];
    steps.push([8, d === 1 ? JOY.right : d === -1 ? JOY.left : d > 0 ? JOY.down : JOY.up]);
  }
  const gx = goal % W;
  const gy = (goal / W) | 0;
  const face = gy < it.y ? JOY.down : gy >= it.y + it.h ? JOY.up : gx < it.x ? JOY.right : JOY.left;
  steps.push([2, face], [10, 0], [2, JOY.fire], [10, 0]);
  // Merge consecutive identical entries (frame counts fit a byte).
  const merged = [];
  for (const [n, j] of steps) {
    const last = merged[merged.length - 1];
    if (last && last[1] === j && last[0] + n < 256) last[0] += n;
    else merged.push([n, j]);
  }
  return merged;
}
