// Drawing helpers for the mini-game visual mockups (not game code). Each would fit in src/engine/mgkit.js later.
import { rect } from '../../../src/engine/mgkit.js';
import { shade } from '../../../src/engine/art.js';

export { shade };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Vertical gradient through `stops` (colours), quantized to them with a 4x4 Bayer dither (the night lighting's look). */
let STYLE = 'fine';
/** 'fine' (the first mockups) or 'mid': gradients become flat bands, speckle becomes sparse 2x2 cells. */
export function setStyle(s) {
  STYLE = s;
}
export const styleIs = (s) => STYLE === s;

export function gradient(g, x, y, w, h, stops) {
  if (STYLE === 'mid') {
    // Flat bands, two per stop, each colour stepped halfway to the next (no dither).
    const cols = [];
    for (let i = 0; i < stops.length; i++) cols.push(stops[i]), i < stops.length - 1 && cols.push(mix(stops[i], stops[i + 1]));
    return bands(g, x, y, w, h, cols);
  }
  for (let yy = 0; yy < h; yy++) {
    const f = (yy / Math.max(1, h - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(f));
    const k = f - i;
    for (let xx = 0; xx < w; xx++) {
      const th = (BAYER[((y + yy) & 3) * 4 + ((x + xx) & 3)] + 0.5) / 16;
      rect(g, x + xx, y + yy, 1, 1, k > th ? stops[i + 1] : stops[i]);
    }
  }
}

/** Filled ellipse, row by row (crisp pixel edges). */
export function blob(g, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, 1, c);
  }
}

/** A lit ball/blob: dark rim, base, a lighter offset core (light from the top left), a highlight pixel. */
export function shaded(g, cx, cy, rx, ry, c, opts = {}) {
  const { rim = shade(c, -0.35), light = shade(c, 0.22), outline = null } = opts;
  if (STYLE === 'mid') {
    // 2 px cells: rim, base nudged up-left, one light patch.
    if (outline) cblob(g, cx, cy, rx + 2, ry + 2, outline);
    cblob(g, cx, cy, rx, ry, rim);
    cblob(g, cx - 2, cy - 2, Math.max(2, rx - 2), Math.max(2, ry - 2), c);
    cblob(g, cx - Math.round(rx * 0.3), cy - Math.round(ry * 0.3), Math.max(2, Math.round(rx * 0.4)), Math.max(2, Math.round(ry * 0.4)), light);
    return;
  }
  if (outline) blob(g, cx, cy, rx + 1, ry + 1, outline);
  blob(g, cx, cy, rx, ry, rim);
  blob(g, cx - 1, cy - 1, rx - 1, ry - 1, c);
  blob(g, cx - Math.round(rx * 0.3), cy - Math.round(ry * 0.3), Math.max(1, Math.round(rx * 0.45)), Math.max(1, Math.round(ry * 0.45)), light);
}

/** Bresenham line, `w` px thick. */
export function line(g, x1, y1, x2, y2, c, w = 1) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let k = 0; k <= n; k++) rect(g, Math.round(x1 + ((x2 - x1) * k) / n), Math.round(y1 + ((y2 - y1) * k) / n), w, w, c);
}

/** Sprite from a string map ('|' between rows, '.' transparent), each char a palette key, at scale s. */
export function sprite(g, map, pal, x, y, s = 1, flip = false) {
  const rows = map.split('|');
  rows.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const ch = row[xx];
      if (ch === '.' || !pal[ch]) continue;
      const px = flip ? row.length - 1 - xx : xx;
      rect(g, x + px * s, y + yy * s, s, s, pal[ch]);
    }
  });
}

/** Soft round glow: concentric dithered rings fading out (additive-looking without blending modes). */
export function glow(g, cx, cy, r, c, alpha = 0.35) {
  g.save();
  for (let k = r; k > 0; k -= 2) {
    g.globalAlpha = alpha * (1 - k / r) * 0.5;
    blob(g, cx, cy, k, k, c);
  }
  g.restore();
}

/** Darken the frame's edges (a candle-lit vignette) with a dithered mask. */
export function vignette(g, w, h, cx, cy, r, c = '#1a0f08', alpha = 0.55) {
  g.save();
  g.fillStyle = c;
  for (let y = 18; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.75));
      const k = Math.min(1, Math.max(0, d - 0.55) * 1.4);
      const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      if (k * 1.6 > th) {
        g.globalAlpha = alpha * Math.min(1, k);
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  g.restore();
}

/** Deterministic pseudo-random for scattered details. */
export function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Wooden planks seen from above (horizontal boards with staggered joints). */
export function planks(g, x, y, w, h, base, opts = {}) {
  const { board = 10, seed = 3 } = opts;
  const r = rnd(seed);
  rect(g, x, y, w, h, base);
  for (let yy = y, i = 0; yy < y + h; yy += board, i++) {
    const tone = shade(base, (r() - 0.5) * 0.12);
    rect(g, x, yy, w, board - 1, tone);
    rect(g, x, yy, w, 1, shade(tone, 0.12));
    rect(g, x, yy + board - 1, w, 1, shade(base, -0.3));
    for (let xx = x + ((i * 37) % 60); xx < x + w; xx += 60 + ((i * 13) % 30)) rect(g, xx, yy, 1, board - 1, shade(base, -0.3));
    for (let k = 0; k < w / 18; k++) rect(g, x + Math.floor(r() * w), yy + 2 + Math.floor(r() * (board - 4)), 3 + Math.floor(r() * 5), 1, shade(tone, -0.1));
  }
}

/** Speckle texture (sand, stone, carpet): `n` random pixels of the given colours over a rect. */
export function speckle(g, x, y, w, h, colors, n, seed = 7) {
  const r = rnd(seed);
  if (STYLE === 'mid') {
    for (let i = 0; i < n / 6; i++) rect(g, x + Math.floor((r() * w) / 2) * 2, y + Math.floor((r() * h) / 2) * 2, 2, 2, colors[i % colors.length]);
    return;
  }
  for (let i = 0; i < n; i++) rect(g, x + Math.floor(r() * w), y + Math.floor(r() * h), 1, 1, colors[i % colors.length]);
}

/** One pixel shaded from `tones` (dark → light) by a light value 0..1, Bayer-dithered between neighbouring tones. */
export function tonePx(g, x, y, tones, l) {
  const f = Math.max(0, Math.min(0.999, l)) * (tones.length - 1);
  const i = Math.floor(f);
  const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  rect(g, x, y, 1, 1, tones[f - i > th ? Math.min(tones.length - 1, i + 1) : i]);
}

/** Flat horizontal bands through `colors` (no dither): the A-tier games' way of drawing a sky or a sea. */
export function bands(g, x, y, w, h, colors) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const y0 = y + Math.round((h * i) / n);
    const y1 = y + Math.round((h * (i + 1)) / n);
    rect(g, x, y0, w, y1 - y0, colors[i]);
  }
}

/** Ellipse on an s-pixel grid (chunky, like the 2x figures). */
export function cblob(g, cx, cy, rx, ry, c, s = 2) {
  for (let y = -ry; y < ry; y += s) {
    const yy = (y + s / 2) / ry;
    const hw = Math.round((rx * Math.sqrt(Math.max(0, 1 - yy * yy))) / s) * s;
    if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, s, c);
  }
}

/** A cell painter: r(cx, cy, w, h, colour) in s-pixel cells from (ox, oy), like pitch.js person(). */
export const cells = (g, ox, oy, s) => (cx, cy, w, h, col) => rect(g, ox + cx * s, oy + cy * s, w * s, h * s, col);

function mix(a, b) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join('');
}
