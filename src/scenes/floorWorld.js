// Floor visuals + actors: bakes static layers once per floor and draws a depth-sorted 2.5D scene.
import { TILE, WALL_H, CHAR_W, CHAR_H, bakeCharacter, bakeFurniture, furnitureDef, drawFloorTile, drawWallTile, floorStyleForRoom, shade, drawDeskDecor } from '../engine/art.js';
import { makeCanvas } from '../engine/screen.js';
import { T_WALL } from '../core/floorgen.js';
import { findPath } from '../core/pathfind.js';
import { createRng } from '../core/rng.js';
import { DEPARTMENTS } from '../data/departments.js';
import { SKIN_TONES, HAIR_COLORS } from '../data/corpColors.js';
import { FIRST_NAMES, LAST_NAMES, ROLES, FILE_NOTES, WOMEN_NAMES, MEN_NAMES } from '../data/people.js';
import { POSTER_TEXT, FAKE_ADS } from '../data/sponsors.js';
import { drawText, wrapText, measureText } from '../engine/font.js';
import { C, rect } from '../engine/ui.js';

const charCache = new Map();
export function characterSheet(look) {
  const key = JSON.stringify(look);
  let c = charCache.get(key);
  if (!c) {
    c = bakeCharacter(look);
    charCache.set(key, c);
  }
  return c;
}

const DIR_ROW = { down: 0, up: 1, left: 2, right: 3 };

export class Actor {
  constructor(look, x, y) {
    this.setLook(look);
    this.x = x;
    this.y = y;
    this.dir = 'down';
    this.moving = false;
    this.anim = 0;
    this.path = null;
    this.bubble = null; // { text, t }
    this.who = null; // { name, role } shown on top of speech bubbles
    this.carry = null; // 'box' while a fired colleague clears their desk
  }
  setLook(look) {
    this.look = look;
    this.sheet = characterSheet(look);
  }
  faceTowards(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else if (dy) this.dir = dy > 0 ? 'down' : 'up';
  }
  /** wait: seconds before the bubble shows (an answer after the question). */
  say(text, t = 3.5, wait = 0) {
    this.bubble = { text, t, wait };
  }
  update(dt) {
    if (this.moving) this.anim += dt * 8;
    else this.anim = 0;
    if (this.bubble?.wait > 0) this.bubble.wait -= dt;
    else if (this.bubble) {
      this.bubble.t -= dt;
      if (this.bubble.t <= 0) this.bubble = null;
    }
  }
  get frame() {
    if (!this.moving) return 0;
    return [1, 0, 2, 0][Math.floor(this.anim) % 4];
  }
  draw(g) {
    const px = Math.round(this.x * TILE);
    const py = Math.round(this.y * TILE);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(px - 5, py - 1, 10, 3);
    g.fillRect(px - 4, py - 2, 8, 5);
    const box = () => {
      const bx = px - 6;
      const by = py - 12;
      rect(g, bx, by, 12, 8, '#5a3d22');
      rect(g, bx + 1, by + 1, 10, 6, '#b0814f');
      rect(g, bx + 1, by + 1, 10, 1, '#cfa06a');
      rect(g, bx + 4, by + 3, 4, 1, '#5a3d22');
      rect(g, bx + 2, by - 2, 2, 2, '#4caf50'); // the plant comes along
      rect(g, bx + 7, by - 3, 1, 3, '#d8dfe8'); // and the stapler
    };
    if (this.carry && this.dir === 'up') box();
    g.drawImage(this.sheet, this.frame * CHAR_W, DIR_ROW[this.dir] * CHAR_H, CHAR_W, CHAR_H, px - CHAR_W / 2, py - CHAR_H + 1, CHAR_W, CHAR_H);
    if (this.carry && this.dir !== 'up') box();
  }
  /** view: the visible world rect { x, y, w, h, top } (top = HUD bar height); the bubble stays inside it. */
  drawBubble(g, view) {
    if (!this.bubble || this.bubble.wait > 0) return;
    const lines = wrapText(this.bubble.text, 120);
    const who = this.who;
    const head = who ? 20 : 0;
    const textW = Math.max(...lines.map((l) => measureText(l)), who ? measureText(who.name) : 0, who ? measureText(who.role) : 0);
    const bw = Math.min(150, textW + 10);
    const bh = lines.length * 10 + 6 + head;
    const ax = Math.round(this.x * TILE);
    const { x: bx, y: by, below, tail } = view ? placeBubble(ax, Math.round(this.y * TILE), bw, bh, view) : { x: ax - bw / 2, y: this.y * TILE - CHAR_H - bh - 6, below: false, tail: ax };
    rect(g, bx, by, bw, bh, C.border);
    rect(g, bx + 1, by + 1, bw - 2, bh - 2, '#fbf8ef');
    if (below) {
      rect(g, tail - 2, by - 1, 5, 2, '#fbf8ef');
      rect(g, tail - 1, by - 3, 3, 2, C.border);
    } else {
      rect(g, tail - 2, by + bh - 1, 5, 2, '#fbf8ef');
      rect(g, tail - 1, by + bh + 1, 3, 2, C.border);
    }
    if (who) {
      rect(g, bx + 1, by + 1, bw - 2, head - 1, '#e9e3d2');
      drawText(g, who.name, bx + 5, by + 3, { color: C.accentDark });
      drawText(g, who.role, bx + 5, by + 11, { color: '#7a7466' });
      rect(g, bx + 1, by + head, bw - 2, 1, '#cfc7b2');
    }
    lines.forEach((l, i) => drawText(g, l, bx + 5, by + 4 + head + i * 10, { color: C.ink }));
  }
}

/**
 * Where a speech bubble goes: above the speaker (ax = their x, ay = their feet, world px), slid sideways into the view
 * and flipped below them when it would run under the HUD bar. The tail points at the speaker. Returns { x, y, below, tail }.
 */
export function placeBubble(ax, ay, bw, bh, view) {
  const x = Math.round(Math.max(view.x + 2, Math.min(ax - bw / 2, view.x + view.w - bw - 2)));
  let y = ay - CHAR_H - bh - 6;
  const below = y < view.y + view.top + 2;
  if (below) y = ay + 6;
  const tail = Math.max(x + 3, Math.min(ax, x + bw - 4));
  return { x, y: Math.round(y), below, tail };
}

/**
 * What a hallway poster shows and where: centred in its wall section. Fake ads rotate by floor among the brands whose name
 * fits the section (ACME Systems Inc. on floor 1). Returns { x, w } in world px, plus `ad` for a fake ad.
 */
export function posterContent(p, floor) {
  const room = (p.x1 - p.x0 + 1) * TILE - 4;
  let ad = null;
  let w = measureText(POSTER_TEXT) + 10;
  if (p.kind === 'ad') {
    const fits = FAKE_ADS.filter((a) => measureText(a.name) + 16 <= room);
    ad = fits[(floor - 1) % fits.length];
    w = measureText(ad.name) + 16;
  }
  const cx = ((p.x0 + p.x1 + 1) / 2) * TILE;
  return { x: Math.round(cx - w / 2), w, ad };
}

/** The person at an NPC seed in a career's cast (S.castOf): the seed stays the key (fired, conduct), the person changes. */
const person = (seed, cast) => (cast ? (Math.imul(seed, 0x9e3779b1) ^ cast) >>> 0 : seed);

/** A colleague's name, role and personnel-file trivia, deterministic per NPC seed and cast. */
export function npcIdentity(seed, deptId, cast = 0) {
  const r = createRng(person(seed, cast) * 7121 + 11);
  return {
    name: `${r.pick(FIRST_NAMES)} ${r.pick(LAST_NAMES)}`,
    role: r.pick(ROLES[deptId] || ROLES.lobby),
    years: r.int(1, 24),
    note: r.pick(FILE_NOTES),
  };
}

export function npcLook(seed, deptId, cast = 0) {
  const r = createRng(person(seed, cast) * 977 + 3);
  const shirts = ['#d8dfe8', '#e8d8d8', '#d8e8dc', '#3b6fb6', '#b6973b', '#7a3bb6', '#555a66', '#b63b5a', '#2f8f7f'];
  const exec = deptId === 'exec';
  const it = deptId === 'it';
  const look = {
    skin: r.pick(SKIN_TONES),
    hair: r.pick(HAIR_COLORS),
    hairStyle: r.int(0, 3),
    shirt: it ? r.pick(['#3a3f55', '#5a3b3b', '#2f5f4f', '#444']) : r.pick(shirts),
    jacket: exec || r.chance(0.2) ? r.pick(['#22242e', '#2b3550', '#3a2b2b']) : null,
    pants: r.pick(['#2b2e38', '#3a3f55', '#5a4a3a', '#22242e']),
    tie: !it && r.chance(0.5) ? r.pick(['#a33b3b', '#2a6ad1', '#c9a227', '#2a9d4a']) : null,
    shoes: '#1a1410',
    glasses: r.chance(0.3),
  };
  // The figure follows the first name: a woman wears a skirt (a suit skirt with a jacket), mostly longer hair, no tie.
  // Its own RNG, so everything above (and every man) looks as before.
  const w = createRng(person(seed, cast) * 389 + 5);
  const first = npcIdentity(seed, deptId, cast).name.split(' ')[0];
  const woman = WOMEN_NAMES.includes(first) || (!MEN_NAMES.includes(first) && w.chance(0.5));
  if (woman) {
    look.skirt = look.jacket || w.pick(['#7a3b4a', '#2f6f5f', '#8a8f9a', '#3a4f8a', '#b6973b', '#6a4a8a', '#a8483a']);
    look.tights = w.chance(0.25) ? '#3a3040' : null; // mostly bare legs, so the skirt reads as one
    look.tie = null;
    if (w.chance(0.6)) look.hairStyle = 2;
  }
  return look;
}

/** A uniform or suit over a colleague's look: the jacket colour, a matching skirt for a woman, a tie only on a man. */
export function suit(look, jacket, extra = {}) {
  const out = { ...look, jacket, tie: null, ...extra };
  if (look.skirt) Object.assign(out, { skirt: jacket, tie: null });
  return out;
}

/** Visual kit: palette for furniture on this floor. */
function makeKit(fl, corp) {
  const exec = fl.dept === 'exec';
  return {
    wood: exec ? '#6e3326' : '#a77b52',
    woodD: exec ? '#4a1f17' : '#7a5536',
    table: exec ? '#5a2a20' : '#8a6a4a',
    chair: shade(corp.dark, 0.1),
    sofa: corp.color,
    mug: corp.light,
    accent: corp.color,
    accentDark: corp.dark,
    accentLight: corp.light,
  };
}

export class FloorView {
  constructor(fl, corp) {
    this.fl = fl;
    // A client's office (business trip) brings its own carpet and wall colours.
    this.dept = { ...DEPARTMENTS.find((d) => d.id === fl.dept), ...(fl.look || {}) };
    this.kit = makeKit(fl, corp);
    this.time = 0;
    this.bake();
  }

  isWall(x, y) {
    const { fl } = this;
    if (x < 0 || y < 0 || x >= fl.w || y >= fl.h) return true;
    return fl.tiles[y * fl.w + x] === T_WALL;
  }

  bake() {
    const { fl, dept } = this;
    const W = fl.w * TILE;
    const H = fl.h * TILE;
    const [floorC, g] = makeCanvas(W, H);
    for (let y = 0; y < fl.h; y++)
      for (let x = 0; x < fl.w; x++) {
        const i = y * fl.w + x;
        if (fl.tiles[i] === T_WALL) continue;
        const room = fl.roomOf[i] >= 0 ? fl.rooms[fl.roomOf[i]] : null;
        // The vacation hotel paints its outdoors (grass, sand, decks, pool, sea) per tile.
        const style = fl.ground?.[i] || (room ? floorStyleForRoom(room.type, fl.dept) : 'corridor');
        drawFloorTile(g, style, x * TILE, y * TILE, x, y, dept.carpet);
        if (this.isWall(x, y - 1)) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x * TILE, y * TILE, TILE, 3);
        }
      }
    // Entrance mat on the ground floor (inside the door: above a door in the bottom wall, below one in the top wall).
    if (fl.entrance) {
      const my = fl.entrance.y === 0 ? TILE + 1 : (fl.entrance.y - 1) * TILE + 4;
      g.fillStyle = '#3a2b2b';
      g.fillRect(fl.entrance.x * TILE - 4, my, fl.entrance.w * TILE + 8, 12);
      g.fillStyle = this.kit.accent;
      g.fillRect(fl.entrance.x * TILE - 2, my + 2, fl.entrance.w * TILE + 4, 2);
    }
    this.floorCanvas = floorC;

    const top = dept.wall;
    const front = shade(dept.wall, 0.62);
    this.wallRows = [];
    for (let y = 0; y < fl.h; y++) {
      let any = false;
      const [rc, rg] = makeCanvas(W, TILE + WALL_H);
      for (let x = 0; x < fl.w; x++) {
        if (!this.isWall(x, y)) continue;
        any = true;
        const isEntrance = fl.entrance && y === fl.entrance.y && x >= fl.entrance.x && x < fl.entrance.x + fl.entrance.w;
        if (isEntrance) continue;
        // Outside the hotel building the boundary is a hedge.
        const hedge = fl.hedgeFrom != null && y >= fl.hedgeFrom;
        drawWallTile(rg, x * TILE, WALL_H, {
          top: hedge ? '#3f8f3f' : top,
          front: hedge ? '#2f6f2f' : front,
          openBelow: !this.isWall(x, y + 1) && y + 1 < fl.h,
          openAbove: !this.isWall(x, y - 1),
          openLeft: !this.isWall(x - 1, y),
          openRight: !this.isWall(x + 1, y),
          window: !fl.noWindows && y === 0 && x > 0 && x < fl.w - 1, // no windows in the basement archive
          tx: x,
        });
      }
      for (const p of fl.posters || []) if (p.y === y) this.drawPoster(rg, p);
      this.wallRows.push(any ? rc : null);
    }

    this.sprites = fl.items.map((it) => {
      const baked = bakeFurniture(it.type, it.w, it.h, this.kit);
      // Lobby turnstiles also bake their open state; `gateOpen` (set by the floor scene) picks one.
      const open = it.type === 'turnstile' ? bakeFurniture('turnstileopen', it.w, it.h, this.kit) : null;
      // Your desk also bakes its tidy look; `desk` (set by the floor scene once it is yours) picks it.
      const mine = it === fl.myDesk ? bakeFurniture('mydesk', it.w, it.h, this.kit) : null;
      // Archive cabinets also bake their searched look; `it.opened` (set by the archive scene) picks it.
      const opened = it.type === 'archivecab' ? bakeFurniture('archivecabopen', it.w, it.h, this.kit) : null;
      return { it, baked, open, mine, opened, solid: it.solid, lift: furnitureDef(it.type)?.lift || 0 };
    });
    this.gateOpen = false;
    this.desk = null; // { owned, show } of your desk on this floor, or null while it is not yours
  }

  /** A hallway poster on the upper part of the wall (row-canvas coordinates: the wall top spans y 0..16). */
  drawPoster(g, p) {
    const c = posterContent(p, this.fl.floor);
    const x = c.x;
    const y = 1;
    rect(g, x + 1, y + 1, c.w, 14, 'rgba(0,0,0,0.3)');
    rect(g, x, y, c.w, 14, '#1a1c24');
    if (!c.ad) {
      rect(g, x + 1, y + 1, c.w - 2, 12, '#fbf8ef');
      rect(g, x + 1, y + 1, 2, 12, this.kit.accent);
      rect(g, x + c.w - 3, y + 1, 2, 12, this.kit.accent);
      drawText(g, POSTER_TEXT, x + c.w / 2, y + 3, { align: 'center', color: '#5a5f70' });
      return;
    }
    const { bg, fg, mark } = c.ad;
    rect(g, x + 1, y + 1, c.w - 2, 12, bg);
    rect(g, x + 1, y + 1, c.w - 2, 1, 'rgba(255,255,255,0.25)');
    const mx = x + 4;
    const my = y + 4;
    if (mark === 'diamond') for (let k = 0; k < 3; k++) rect(g, mx + 2 - k, my + k, 1 + k * 2, 1, fg), rect(g, mx + 2 - k, my + 5 - k, 1 + k * 2, 1, fg);
    else if (mark === 'circle') rect(g, mx + 1, my, 4, 6, fg), rect(g, mx, my + 1, 6, 4, fg);
    else if (mark === 'square') rect(g, mx, my, 6, 6, fg), rect(g, mx + 2, my + 2, 2, 2, bg);
    else for (const [dx, dy, w] of [[3, 0, 2], [2, 1, 2], [1, 2, 4], [2, 3, 2], [1, 4, 2], [0, 5, 2]]) rect(g, mx + dx, my + dy, w, 1, fg);
    drawText(g, c.ad.name, x + 13, y + 3, { color: fg });
  }

  /** Top of an item's drawn sprite in world px (for markers). */
  itemTop(it) {
    if (it.top != null) return it.top; // temporary props (quest whiteboards)
    const def = furnitureDef(it.type);
    return it.y * TILE - (def ? def.lift : 0);
  }

  render(g, cam, actors) {
    const { fl } = this;
    this.time += 1 / 60;
    g.save();
    g.translate(-Math.round(cam.x), -Math.round(cam.y));
    g.drawImage(this.floorCanvas, 0, 0);
    this.afterFloor?.(g); // world-space overlay on the floor, under walls, furniture and people (the hotel's waves)
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2);
    const y1 = Math.min(fl.h - 1, Math.ceil((cam.y + 270) / TILE) + 2);
    const list = [];
    for (let y = y0; y <= y1; y++) if (this.wallRows[y]) list.push({ base: (y + 1) * TILE - 0.5, kind: 'wall', y });
    for (const s of this.sprites) {
      const it = s.it;
      if (it.y + it.h < y0 - 1 || it.y > y1 + 2) continue;
      list.push({ base: itemDepth(s), kind: 'item', s });
    }
    for (const a of actors) list.push({ base: a.y * TILE, kind: 'actor', a });
    list.sort((p, q) => p.base - q.base);
    for (const e of list) {
      if (e.kind === 'wall') g.drawImage(this.wallRows[e.y], 0, e.y * TILE - WALL_H);
      else if (e.kind === 'item') this.drawItem(g, e.s);
      else e.a.draw(g);
    }
    g.restore();
  }

  drawItem(g, s) {
    const { it } = s;
    const mine = s.mine && this.desk;
    const baked = mine ? s.mine : this.gateOpen && s.open ? s.open : it.opened && s.opened ? s.opened : s.baked;
    if (!baked) return;
    const x = it.x * TILE + baked.ox;
    const y = it.y * TILE + baked.oy;
    g.drawImage(baked.canvas, x, y);
    if (mine) for (const id of Object.values(this.desk.show || {})) if (id) drawDeskDecor(g, id, it.x * TILE, it.y * TILE, it.w);
    if (it.type === 'serverrack') {
      const t = Math.floor(this.time * 6 + it.id * 3);
      for (let i = 0; i < 6; i++) {
        const on = (t + i * 7) % 5 < 3;
        g.fillStyle = on ? (i % 3 ? '#5fd068' : '#f29c38') : '#16181e';
        g.fillRect(it.x * TILE + 12, it.y * TILE - 11 + Math.round(i * 3.5) + 2, 1, 1);
      }
    }
  }
}

/**
 * Depth-sort key of a baked item (world px; actors sort by their feet, a.y * TILE). Flat decor with no height (a rug)
 * lies on the floor under everyone; non-solid decor (chairs) sorts slightly behind characters on the same row.
 */
export function itemDepth(s) {
  const it = s.it;
  if (!s.solid && !s.lift) return it.y * TILE - TILE;
  return (it.y + it.h) * TILE - (s.solid ? 0.25 : 8);
}

/** Wandering NPC brain. */
export class NpcBrain {
  constructor(actor, fl, seed) {
    this.a = actor;
    this.fl = fl;
    this.rng = createRng(seed);
    this.wait = this.rng.float(0.5, 4);
    this.speed = this.rng.float(1.6, 2.4);
    this.talkPause = 0;
    this.exit = null; // { x, y } tile when fired: walk there, then `gone`
    this.gone = false;
  }
  /** Fired: say goodbye, then walk to the elevator tile (x, y) and disappear. */
  leave(x, y) {
    this.exit = { x, y, routed: false };
    this.talkPause = 1.6;
    this.speed = 2.8;
    this.a.path = null;
  }
  update(dt, blocked) {
    const a = this.a;
    if (this.talkPause > 0) {
      this.talkPause -= dt;
      a.moving = false;
      return;
    }
    if (this.exit && (!a.path || !a.path.length)) {
      if (this.exit.routed) {
        this.gone = true;
        return;
      }
      this.exit.routed = true;
      a.path = findPath(this.fl.npcWalk || this.fl.walk, this.fl.w, this.fl.h, Math.floor(a.x), Math.floor(a.y), this.exit.x, this.exit.y, 4000) || [];
      if (!a.path.length) this.gone = true;
      return;
    }
    if (!a.path || !a.path.length) {
      a.moving = false;
      this.wait -= dt;
      if (this.wait <= 0) {
        this.pickTarget();
        this.wait = this.rng.float(2, 7);
      }
      return;
    }
    const n = a.path[0];
    const tx = n.x + 0.5;
    const ty = n.y + 0.5;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (!this.exit && blocked?.(a.x + (dx / (d || 1)) * 0.4, a.y + (dy / (d || 1)) * 0.4)) {
      a.moving = false;
      return;
    }
    a.faceTowards(dx, dy);
    a.moving = true;
    if (d <= step) {
      a.x = tx;
      a.y = ty;
      a.path.shift();
    } else {
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
    }
  }
  pickTarget() {
    const { fl } = this;
    const walk = fl.npcWalk || fl.walk; // fl.npcWalk: places NPCs keep out of (the hotel suite)
    const sx = Math.floor(this.a.x);
    const sy = Math.floor(this.a.y);
    for (let tries = 0; tries < 8; tries++) {
      const tx = this.rng.int(1, fl.w - 2);
      const ty = this.rng.int(1, fl.h - 2);
      if (!walk[ty * fl.w + tx] || fl.dist[ty * fl.w + tx] < 0) continue;
      if (Math.abs(tx - sx) + Math.abs(ty - sy) > 18) continue;
      const p = findPath(walk, fl.w, fl.h, sx, sy, tx, ty, 1500);
      if (p && p.length) {
        this.a.path = p;
        return;
      }
    }
  }
}
