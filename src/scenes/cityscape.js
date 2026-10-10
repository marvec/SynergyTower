// Shared exterior art: sky, skyline and the 40-floor tower (used by title, exterior and ending scenes).
import { rect } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { createRng } from '../core/rng.js';
import { shade } from '../engine/art.js';

export const FLOOR_PX = 8;
export const LOBBY_PX = 40;
export const TOWER_W = 150;
export const towerHeight = () => 40 * FLOOR_PX + LOBBY_PX + 34;

export function drawSky(g, w, h, mode = 'day', t = 0) {
  const bands = mode === 'night' ? ['#0b0e24', '#121735', '#1b2147', '#262c5a'] : mode === 'dusk' ? ['#2b2a5a', '#5a3f7a', '#b0587a', '#f29c6a'] : ['#5fa8e8', '#7ab8ee', '#94c8f2', '#b4daf6'];
  const bh = Math.ceil(h / bands.length);
  bands.forEach((c, i) => rect(g, 0, i * bh, w, bh, c));
  if (mode !== 'day') {
    const r = createRng(7);
    for (let i = 0; i < 70; i++) {
      const tw = (Math.sin(t * 2 + i) + 1) / 2;
      rect(g, r.int(0, w), r.int(0, h * 0.6), 1, 1, tw > 0.3 ? '#ffffff' : '#8890b0');
    }
  } else {
    const r = createRng(3);
    for (let i = 0; i < 6; i++) {
      const x = ((r.int(0, w) + t * (6 + i)) % (w + 80)) - 40;
      const y = r.int(10, 80);
      rect(g, x, y, 34, 6, '#eef6fc');
      rect(g, x + 6, y - 4, 18, 5, '#eef6fc');
    }
  }
}

// One repeating strip of buildings per (mode, seed, layer): { period, buildings: [{ x, bw, bh, windows }] }.
const skylineCache = new Map();
function skylineStrip(mode, seed, li, maxH) {
  const key = `${mode}:${seed}:${li}`;
  let strip = skylineCache.get(key);
  if (strip) return strip;
  const r = createRng(seed + li * 11);
  const buildings = [];
  let x = 0;
  while (x < 400) {
    const bw = r.int(18, 46);
    const bh = r.int(30, maxH);
    const windows = [];
    for (let yy = 4; yy < bh - 6; yy += 6)
      for (let xx = 3; xx < bw - 3; xx += 5) if (r.chance(mode === 'day' ? 0.35 : 0.3)) windows.push(xx, yy);
    buildings.push({ x, bw, bh, windows });
    x += bw + r.int(0, 8);
  }
  strip = { period: x, buildings };
  skylineCache.set(key, strip);
  return strip;
}

/** Parallax skyline; offset scrolls it. The strip repeats seamlessly, so any offset is valid. */
export function drawSkyline(g, w, groundY, mode = 'day', offset = 0, seed = 5) {
  const layers = mode === 'day' ? [['#8aa8c8', 0.3, 110], ['#6b86a6', 0.6, 70]] : [['#1c2240', 0.3, 110], ['#141932', 0.6, 70]];
  layers.forEach(([color, par, maxH], li) => {
    const { period, buildings } = skylineStrip(mode, seed, li, maxH);
    const lit = mode === 'day' ? shade(color, 0.25) : '#f2d878';
    const shift = Math.floor(((offset * par) % period + period) % period);
    for (let base = -shift - period; base < w + 40; base += period) {
      for (const b of buildings) {
        const bx = base + b.x;
        if (bx + b.bw < -40 || bx > w + 40) continue;
        const top = groundY - b.bh;
        rect(g, bx, top, b.bw, b.bh, color);
        for (let i = 0; i < b.windows.length; i += 2) rect(g, bx + b.windows[i], top + b.windows[i + 1], 2, 3, lit);
      }
    }
  });
}

/**
 * The tower. (x, groundY) = bottom-left corner. highlightFloor shows a marker on a floor.
 * Returns { doorX, doorW } in screen space.
 */
export function drawTower(g, x, groundY, corp, opts = {}) {
  const { corpName = '', mode = 'day', t = 0, highlightFloor = 0, lit = false } = opts;
  const top = groundY - towerHeight();
  const body = mode === 'night' ? '#2a3048' : '#56607a';
  const edge = mode === 'night' ? '#1a1e30' : '#3a4256';
  // Spire + sign.
  rect(g, x + TOWER_W / 2 - 1, top - 26, 2, 26, edge);
  rect(g, x + TOWER_W / 2 - 2, top - 30, 4, 4, Math.floor(t * 2) % 2 ? '#e2504a' : '#7a2020');
  rect(g, x + 8, top, TOWER_W - 16, 34, edge);
  rect(g, x + 10, top + 2, TOWER_W - 20, 30, corp.dark);
  rect(g, x + 10, top + 2, TOWER_W - 20, 2, corp.color);
  const name = corpName.toUpperCase().slice(0, 22);
  drawText(g, name, x + TOWER_W / 2, top + 13, { align: 'center', color: '#ffffff', shadow: '#000' });
  // Floors.
  const fTop = top + 34;
  rect(g, x, fTop, TOWER_W, 40 * FLOOR_PX + LOBBY_PX, edge);
  rect(g, x + 2, fTop, TOWER_W - 4, 40 * FLOOR_PX, body);
  const r = createRng(42);
  for (let f = 40; f >= 1; f--) {
    const y = fTop + (40 - f) * FLOOR_PX;
    rect(g, x + 2, y + FLOOR_PX - 1, TOWER_W - 4, 1, edge);
    for (let wx = x + 6; wx < x + TOWER_W - 8; wx += 9) {
      const on = lit ? r.chance(0.85) : mode === 'night' ? r.chance(0.55) : r.chance(0.15);
      const glass = mode === 'night' ? (on ? (lit ? corp.light : '#f2d878') : '#1a2038') : on ? '#d8eefa' : '#8ec5f0';
      rect(g, wx, y + 1, 6, FLOOR_PX - 3, glass);
    }
    if (f === highlightFloor) {
      const blink = Math.floor(t * 3) % 2;
      rect(g, x - 6, y, 4, FLOOR_PX - 1, blink ? '#f2c14e' : '#c9a227');
      rect(g, x + TOWER_W + 2, y, 4, FLOOR_PX - 1, blink ? '#f2c14e' : '#c9a227');
    }
  }
  // Lobby.
  const ly = fTop + 40 * FLOOR_PX;
  rect(g, x + 2, ly, TOWER_W - 4, LOBBY_PX, mode === 'night' ? '#3a4058' : '#8a94a8');
  rect(g, x + 6, ly + 6, TOWER_W - 12, LOBBY_PX - 6, '#1a1e2a');
  rect(g, x + 7, ly + 7, TOWER_W - 14, LOBBY_PX - 8, mode === 'night' ? '#e8d890' : '#a8d4ee');
  for (let gx = x + 7; gx < x + TOWER_W - 8; gx += 14) rect(g, gx, ly + 7, 1, LOBBY_PX - 8, '#1a1e2a');
  rect(g, x, ly, TOWER_W, 3, corp.color);
  const doorW = 26;
  const doorX = x + TOWER_W / 2 - doorW / 2;
  rect(g, doorX - 2, ly + 10, doorW + 4, LOBBY_PX - 10, '#1a1e2a');
  rect(g, doorX, ly + 12, doorW, LOBBY_PX - 12, '#7fb4d8');
  const rot = Math.floor(t * 3) % 3;
  rect(g, doorX + 4 + rot * 7, ly + 12, 2, LOBBY_PX - 12, '#1a1e2a');
  rect(g, doorX - 8, ly + 4, doorW + 16, 5, corp.color);
  drawText(g, 'ENTRANCE', doorX + doorW / 2, ly - 6 + 9, { align: 'center', color: '#fff' });
  return { doorX, doorW, top };
}
