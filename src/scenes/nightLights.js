// The night shift's darkness (core/nightShift.js): the floor lit by its ceiling lamps and a small light around the player,
// through the DOS-style lighting in engine/lighting.js. A few lamps flicker: most waver softly (engine flickerLevel), one or
// two are failing tubes that blink, changing at most twice a second.
import { TILE, WALL_H, furnitureDef } from '../engine/art.js';
import { T_WALL } from '../core/floorgen.js';
import { Lighting, LIGHTING } from '../engine/lighting.js';
import { hashString } from '../core/rng.js';

const SLOT_S = 0.5; // a blinking lamp keeps its level for at least this long

/**
 * The ceiling lamps of a floor, in tiles: one per room (two in wide rooms) and a row along the corridor. The same on every
 * visit; about a third of them flicker (at least one, never all): `flicker` is 'blink' for one or two of those (always
 * leaving one that wavers, when there are two or more), 'waver' for the rest, false for steady lamps.
 */
export function nightLamps(fl, floor) {
  const spots = [];
  for (const r of fl.rooms || []) {
    const cy = (r.y0 + r.y1 + 1) / 2;
    const w = r.x1 - r.x0 + 1;
    if (w >= 12) for (const k of [1, 2]) spots.push([r.x0 + (w * k) / 3, cy, 38]);
    else spots.push([(r.x0 + r.x1 + 1) / 2, cy, 34]);
  }
  const above = (fl.rooms || []).filter((r) => r.y1 < fl.h / 2);
  const below = (fl.rooms || []).filter((r) => r.y0 > fl.h / 2);
  if (above.length && below.length) {
    const cy = (Math.max(...above.map((r) => r.y1)) + Math.min(...below.map((r) => r.y0)) + 1) / 2;
    // Half a tile up: in this oblique view a ceiling lamp over the corridor sits nearer its far (upper) wall.
    for (let x = 4; x < fl.w - 2; x += 9) spots.push([x + 0.5, cy - 0.5, 28]);
  }
  return lampsAt(spots, floor);
}

/**
 * Lamps at `spots` ([x, y, r] in tiles), seeded by `key`: about a third of them flicker (at least one, never all), one
 * or two of those blink and the rest waver (see nightLamps).
 */
export function lampsAt(spots, key) {
  const lamps = spots.map(([x, y, r], i) => {
    const seed = hashString(`lamp:${key}:${i}`);
    return { x, y, r, seed, flicker: seed % 3 === 0 };
  });
  if (lamps.length && !lamps.some((l) => l.flicker)) lamps[hashString(`lamp:${key}`) % lamps.length].flicker = true;
  if (lamps.length > 1 && lamps.every((l) => l.flicker)) lamps[0].flicker = false;
  const flickering = lamps.filter((l) => l.flicker);
  const blinking = flickering.length >= 3 ? 1 + (hashString(`blink:${key}`) % 2) : flickering.length - 1;
  flickering.forEach((l, i) => (l.flicker = i < blinking ? 'blink' : 'waver'));
  return lamps;
}

/** How bright a lamp is at time t (seconds): 1, except a blinking one, which now and then dims or goes out for a slot. */
export function lampLevel(lamp, t) {
  if (lamp.flicker !== 'blink') return 1;
  const h = hashString(`${lamp.seed}:${Math.floor(t / SLOT_S)}`) % 100;
  return h < 14 ? 0 : h < 26 ? 0.45 : 1;
}

/** Furniture at least this tall (its lift in px) blocks light like a wall: shelves, fridges, vending machines, whiteboards. */
const TALL_LIFT = 24;
const LAMP = { intensity: 1.6, tint: [1, 0.94, 0.8] }; // warm ceiling lamps, saturated in the middle third
const NIGHT_TINT = [0.8, 0.9, 1.25]; // the dark is a little blue

/**
 * The night's lighting for a floor (engine/lighting.js): the ceiling lamps baked in (the flickering ones on their own), the
 * walls and tall furniture as occluders, and a small light that follows the player (`lighting.player`, moved each frame).
 */
export function nightLighting(fl, floor) {
  return darkLighting(fl, nightLamps(fl, floor));
}

/**
 * Lighting for any dark floor (the night shift, the basement archive in scenes/archive.js): `lamps` as nightLamps gives
 * them, `ambient` the base light, `config` a lighting config (LIGHTING or one derived from it).
 */
export function darkLighting(fl, lamps, { ambient = LIGHTING.ambient, config = LIGHTING } = {}) {
  const n = fl.w * fl.h;
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = fl.tiles[i] === T_WALL ? 1 : 0;
  const opaque = wall.slice();
  for (const it of fl.items) {
    const def = furnitureDef(it.type);
    if (!def || def.solid === false || (def.lift || 0) < TALL_LIFT) continue;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) opaque[y * fl.w + x] = 1;
  }
  const lighting = new Lighting({ cols: fl.w, rows: fl.h, tile: TILE, opaque, wall, wallH: WALL_H, config });
  lighting.setAmbient(ambient, NIGHT_TINT);
  for (const l of lamps) {
    const light = { x: l.x * TILE, y: l.y * TILE, r: l.r, ...LAMP };
    if (l.flicker === 'blink') light.level = (t) => lampLevel(l, t);
    if (l.flicker === 'waver') light.flicker = { seed: l.seed };
    lighting.addLight(light);
  }
  lighting.player = lighting.addLight({ x: 0, y: 0, r: 26, intensity: 1.8, dynamic: true });
  return lighting;
}

/**
 * Lights the night floor already drawn on g (screen space, after the floor and actors, before markers and the HUD).
 * fade 0..1: how far the lights have gone out (the walk-out); cam: the camera in px; player: in tiles; t: seconds.
 */
export function drawNight(g, lighting, { fade, cam, player, t }) {
  if (fade <= 0) return;
  if (player) {
    lighting.player.x = player.x * TILE;
    lighting.player.y = player.y * TILE - 6;
    lighting.setViewer(lighting.player.x, lighting.player.y);
  }
  lighting.applyLighting(g, cam, { fade, t });
}
