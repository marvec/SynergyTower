// Floor visuals + actors: bakes static layers once per floor and draws a depth-sorted 2.5D scene.
import { TILE, WALL_H, CHAR_W, CHAR_H, bakeCharacter, bakeFurniture, furnitureDef, drawFloorTile, drawWallTile, floorStyleForRoom, shade } from '../engine/art.js';
import { makeCanvas } from '../engine/screen.js';
import { T_WALL } from '../core/floorgen.js';
import { findPath } from '../core/pathfind.js';
import { createRng } from '../core/rng.js';
import { DEPARTMENTS } from '../data/departments.js';
import { SKIN_TONES, HAIR_COLORS } from '../data/corpColors.js';
import { drawText, wrapText } from '../engine/font.js';
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
  }
  setLook(look) {
    this.look = look;
    this.sheet = characterSheet(look);
  }
  faceTowards(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else if (dy) this.dir = dy > 0 ? 'down' : 'up';
  }
  say(text, t = 3.5) {
    this.bubble = { text, t };
  }
  update(dt) {
    if (this.moving) this.anim += dt * 8;
    else this.anim = 0;
    if (this.bubble) {
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
    g.drawImage(this.sheet, this.frame * CHAR_W, DIR_ROW[this.dir] * CHAR_H, CHAR_W, CHAR_H, px - CHAR_W / 2, py - CHAR_H + 1, CHAR_W, CHAR_H);
  }
  drawBubble(g) {
    if (!this.bubble) return;
    const lines = wrapText(this.bubble.text, 120);
    const w = Math.max(...lines.map((l) => l.length * 5)) + 10;
    const bw = Math.min(130, w);
    const bh = lines.length * 10 + 6;
    const bx = Math.round(this.x * TILE - bw / 2);
    const by = Math.round(this.y * TILE - CHAR_H - bh - 6);
    rect(g, bx, by, bw, bh, C.border);
    rect(g, bx + 1, by + 1, bw - 2, bh - 2, '#fbf8ef');
    rect(g, bx + bw / 2 - 2, by + bh - 1, 5, 2, '#fbf8ef');
    rect(g, bx + bw / 2 - 1, by + bh + 1, 3, 2, C.border);
    lines.forEach((l, i) => drawText(g, l, bx + 5, by + 4 + i * 10, { color: C.ink }));
  }
}

export function npcLook(seed, deptId) {
  const r = createRng(seed * 977 + 3);
  const shirts = ['#d8dfe8', '#e8d8d8', '#d8e8dc', '#3b6fb6', '#b6973b', '#7a3bb6', '#555a66', '#b63b5a', '#2f8f7f'];
  const exec = deptId === 'exec';
  const it = deptId === 'it';
  return {
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
    this.dept = DEPARTMENTS.find((d) => d.id === fl.dept);
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
        const style = room ? floorStyleForRoom(room.type, fl.dept) : 'corridor';
        drawFloorTile(g, style, x * TILE, y * TILE, x, y, dept.carpet);
        if (this.isWall(x, y - 1)) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x * TILE, y * TILE, TILE, 3);
        }
      }
    // Entrance mat on the ground floor.
    if (fl.entrance) {
      g.fillStyle = '#3a2b2b';
      g.fillRect(fl.entrance.x * TILE - 4, (fl.entrance.y - 1) * TILE + 4, fl.entrance.w * TILE + 8, 12);
      g.fillStyle = this.kit.accent;
      g.fillRect(fl.entrance.x * TILE - 2, (fl.entrance.y - 1) * TILE + 6, fl.entrance.w * TILE + 4, 2);
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
        drawWallTile(rg, x * TILE, WALL_H, {
          top,
          front,
          openBelow: !this.isWall(x, y + 1) && y + 1 < fl.h,
          openAbove: !this.isWall(x, y - 1),
          openLeft: !this.isWall(x - 1, y),
          openRight: !this.isWall(x + 1, y),
          window: y === 0 && x > 0 && x < fl.w - 1,
          tx: x,
        });
      }
      this.wallRows.push(any ? rc : null);
    }

    this.sprites = fl.items.map((it) => {
      const baked = bakeFurniture(it.type, it.w, it.h, this.kit);
      return { it, baked, solid: it.solid, lift: furnitureDef(it.type)?.lift || 0 };
    });
  }

  /** Top of an item's drawn sprite in world px (for markers). */
  itemTop(it) {
    const def = furnitureDef(it.type);
    return it.y * TILE - (def ? def.lift : 0);
  }

  render(g, cam, actors) {
    const { fl } = this;
    this.time += 1 / 60;
    g.save();
    g.translate(-Math.round(cam.x), -Math.round(cam.y));
    g.drawImage(this.floorCanvas, 0, 0);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2);
    const y1 = Math.min(fl.h - 1, Math.ceil((cam.y + 270) / TILE) + 2);
    const list = [];
    for (let y = y0; y <= y1; y++) if (this.wallRows[y]) list.push({ base: (y + 1) * TILE - 0.5, kind: 'wall', y });
    for (const s of this.sprites) {
      const it = s.it;
      if (it.y + it.h < y0 - 1 || it.y > y1 + 2) continue;
      // Non-solid decor (chairs) sorts slightly behind characters on the same row.
      list.push({ base: (it.y + it.h) * TILE - (s.solid ? 0.25 : 8), kind: 'item', s });
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
    const { it, baked } = s;
    if (!baked) return;
    const x = it.x * TILE + baked.ox;
    const y = it.y * TILE + baked.oy;
    g.drawImage(baked.canvas, x, y);
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

/** Wandering NPC brain. */
export class NpcBrain {
  constructor(actor, fl, seed) {
    this.a = actor;
    this.fl = fl;
    this.rng = createRng(seed);
    this.wait = this.rng.float(0.5, 4);
    this.speed = this.rng.float(1.6, 2.4);
    this.talkPause = 0;
  }
  update(dt, blocked) {
    const a = this.a;
    if (this.talkPause > 0) {
      this.talkPause -= dt;
      a.moving = false;
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
    if (blocked?.(a.x + (dx / (d || 1)) * 0.4, a.y + (dy / (d || 1)) * 0.4)) {
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
    const sx = Math.floor(this.a.x);
    const sy = Math.floor(this.a.y);
    for (let tries = 0; tries < 8; tries++) {
      const tx = this.rng.int(1, fl.w - 2);
      const ty = this.rng.int(1, fl.h - 2);
      if (!fl.walk[ty * fl.w + tx] || fl.dist[ty * fl.w + tx] < 0) continue;
      if (Math.abs(tx - sx) + Math.abs(ty - sy) > 18) continue;
      const p = findPath(fl.walk, fl.w, fl.h, sx, sy, tx, ty, 1500);
      if (p && p.length) {
        this.a.path = p;
        return;
      }
    }
  }
}
