// The Christmas party's lights (engine/lighting.js): the hall dim and warm, string lights along the walls blinking in
// colours, the tree twinkling, a warm glow at the bar and six coloured disco spots (dynamic lights) circling the dance
// floor, moved each frame by moveDisco. Walls and tall furniture block light, as at night (darkLighting).
import { TILE, WALL_H, furnitureDef } from '../engine/art.js';
import { T_WALL } from '../core/floorgen.js';
import { Lighting, LIGHTING } from '../engine/lighting.js';

const TALL_LIFT = 24;
export const DISCO_COLORS = [[1, 0.3, 0.3], [0.3, 1, 0.4], [0.4, 0.5, 1], [1, 0.4, 1], [1, 0.9, 0.3], [0.3, 1, 1]];
const STRING = [[1, 0.35, 0.35], [0.35, 1, 0.45], [1, 0.85, 0.3], [0.45, 0.6, 1]];
/** A string light's level at t: two groups blink in turn. */
const blink = (i) => (t) => ((Math.floor(t * 1.5) + i) % 2 ? 1 : 0.35);

export function partyLighting(fl) {
  const n = fl.w * fl.h;
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = fl.tiles[i] === T_WALL ? 1 : 0;
  const opaque = wall.slice();
  for (const it of fl.items) {
    const def = furnitureDef(it.type);
    if (!def || def.solid === false || (def.lift || 0) < TALL_LIFT) continue;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) opaque[y * fl.w + x] = 1;
  }
  const lighting = new Lighting({ cols: fl.w, rows: fl.h, tile: TILE, opaque, wall, wallH: WALL_H, config: LIGHTING });
  lighting.setAmbient(0.38, [1, 0.85, 0.75]);
  let i = 0;
  const string = (x, y) => lighting.addLight({ x: x * TILE, y: y * TILE, r: 22, intensity: 1.3, tint: STRING[i % STRING.length], level: blink(i++) });
  for (let x = 2.5; x < fl.w - 2; x += 3) string(x, 1.3);
  for (let y = 4.5; y < fl.h - 2; y += 4) (string(1.3, y), string(fl.w - 1.3, y));
  const t = fl.tree;
  if (t) lighting.addLight({ x: (t.x + t.w / 2) * TILE, y: (t.y + 0.5) * TILE, r: 44, intensity: 1.5, tint: [1, 0.9, 0.6], flicker: { seed: 77, depth: 0.3, speed: 2 } });
  if (fl.bar) lighting.addLight({ x: (fl.bar.x - 0.5) * TILE, y: (fl.bar.y + fl.bar.h / 2) * TILE, r: 56, intensity: 1.2, tint: [1, 0.8, 0.55] });
  lighting.disco = DISCO_COLORS.map((tint) => lighting.addLight({ x: 0, y: 0, r: 30, intensity: 1.7, tint, dynamic: true }));
  lighting.player = lighting.addLight({ x: 0, y: 0, r: 26, intensity: 1.2, dynamic: true });
  return lighting;
}

/** Where the disco spots are at t seconds (tiles): two rings around the dance floor's centre, turning opposite ways. */
export function discoSpots(centre, t, n = DISCO_COLORS.length) {
  return Array.from({ length: n }, (_, i) => {
    const ring = i % 2 ? 2.2 : 3.6;
    const a = t * (i % 2 ? -0.9 : 0.6) + (i * Math.PI * 2) / n;
    return { x: centre.x + Math.cos(a) * ring * 1.3, y: centre.y + Math.sin(a) * ring * 0.8 };
  });
}

/**
 * The disco ball in world px: x, the ball's centre ballY, and the drawn span top (the string's top) .. bottom. It hangs a
 * short string over the dance floor, low enough to stay clear of the DJ booth and whoever stands at it (it is drawn over
 * the world, after the lights) and high enough that nobody in front of its spot reaches up to it.
 */
export function discoBall(fl) {
  const d = fl.disco;
  const ballY = Math.round((d.y - 3) * TILE);
  return { x: Math.round(d.x * TILE), ballY, top: ballY - 22, bottom: ballY + 8 };
}

export function moveDisco(lighting, centre, t) {
  discoSpots(centre, t).forEach((p, i) => {
    lighting.disco[i].x = p.x * TILE;
    lighting.disco[i].y = p.y * TILE;
  });
}
