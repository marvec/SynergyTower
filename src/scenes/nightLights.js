// The night shift's darkness (core/nightShift.js): a dark layer over the floor with pools of light cut out of it, one per
// ceiling lamp and one around the player. A few lamps flicker, slowly: a lamp changes at most twice a second (no strobe).
import { W, H, makeCanvas } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { hashString } from '../core/rng.js';

const SLOT_S = 0.5; // a flickering lamp keeps its level for at least this long
const NIGHT = 'rgba(6,9,26,0.86)';

/**
 * The ceiling lamps of a floor, in tiles: one per room (two in wide rooms) and a row along the corridor. The same on every
 * visit; about a third of them flicker (at least one, never all).
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
    for (let x = 4; x < fl.w - 2; x += 9) spots.push([x + 0.5, cy, 28]);
  }
  const lamps = spots.map(([x, y, r], i) => {
    const seed = hashString(`lamp:${floor}:${i}`);
    return { x, y, r, seed, flicker: seed % 3 === 0 };
  });
  if (lamps.length && !lamps.some((l) => l.flicker)) lamps[hashString(`lamp:${floor}`) % lamps.length].flicker = true;
  if (lamps.length > 1 && lamps.every((l) => l.flicker)) lamps[0].flicker = false;
  return lamps;
}

/** How bright a lamp is at time t (seconds): 1 steady; a flickering one now and then dims or goes out for a slot. */
export function lampLevel(lamp, t) {
  if (!lamp.flicker) return 1;
  const h = hashString(`${lamp.seed}:${Math.floor(t / SLOT_S)}`) % 100;
  return h < 14 ? 0 : h < 26 ? 0.45 : 1;
}

let layer = null;

/** Light pool: a few hard-edged rings (pixel art, not a smooth blur), brightest in the middle. */
function pool(g, x, y, r, level) {
  for (const [k, a] of [[1, 0.22], [0.7, 0.42], [0.42, 0.62]]) {
    g.globalAlpha = a * level;
    g.beginPath();
    g.arc(x, y, r * k, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/**
 * Draws the night over the world (screen space, after the floor and actors, before markers and the HUD).
 * fade 0..1: how far the lights have gone out (the walk-out); cam: the camera in px; player: in tiles; t: seconds.
 */
export function drawNight(g, { lamps, fade, cam, player, t }) {
  if (fade <= 0) return;
  if (!layer) layer = makeCanvas(W, H);
  const [c, d] = layer;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, W, H);
  d.fillStyle = NIGHT;
  d.fillRect(0, 0, W, H);
  // The lamps on screen, with their level this frame (a flickering one hashes its slot once, not per pass).
  const lit = [];
  for (const l of lamps) {
    const x = l.x * TILE - cam.x;
    const y = l.y * TILE - cam.y;
    if (x + l.r < 0 || x - l.r > W || y + l.r < 0 || y - l.r > H) continue;
    const level = lampLevel(l, t);
    if (level > 0) lit.push({ x, y, r: l.r, level });
  }
  d.globalCompositeOperation = 'destination-out';
  d.fillStyle = '#000';
  for (const l of lit) pool(d, l.x, l.y, l.r, l.level);
  if (player) pool(d, player.x * TILE - cam.x, player.y * TILE - 6 - cam.y, 26, 1.2);
  d.globalCompositeOperation = 'source-over';
  g.globalAlpha = fade;
  g.drawImage(c, 0, 0);
  // A faint warm glow under the lamps that are on.
  g.globalAlpha = 0.06 * fade;
  g.fillStyle = '#ffd88a';
  for (const l of lit) {
    if (l.level < 1) continue;
    g.beginPath();
    g.arc(Math.round(l.x), Math.round(l.y), l.r * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
