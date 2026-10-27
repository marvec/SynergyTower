// Art kit for the mini-games' in-between style (docs/minigame-visuals): flat bands, chunky shapes on a 2 px grid,
// string-map sprites, and baked backgrounds so render() only draws what moves.
import { rect } from './ui.js';
import { shade } from './art.js';

export { shade };

/** Flat horizontal bands through `colors`, top to bottom: a sky, a sea, a wall. No dither. */
export function bands(g, x, y, w, h, colors) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const y0 = y + Math.round((h * i) / n);
    const y1 = y + Math.round((h * (i + 1)) / n);
    rect(g, x, y0, w, y1 - y0, colors[i]);
  }
}

/** The colour halfway between two '#rrggbb' colours. */
export function mix(a, b) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [u, v] = [p(a), p(b)];
  return '#' + u.map((n, i) => Math.round((n + v[i]) / 2).toString(16).padStart(2, '0')).join('');
}

/** Flat bands through `stops` and the colour halfway to each next one (two bands per stop, no dither). */
export function grad(g, x, y, w, h, stops) {
  const cols = [];
  stops.forEach((c, i) => {
    cols.push(c);
    if (i < stops.length - 1) cols.push(mix(c, stops[i + 1]));
  });
  bands(g, x, y, w, h, cols);
}

/** A seeded random generator (a 32-bit LCG): rnd(seed)() gives 0..1, the same run for the same seed. */
export function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A soft round glow: concentric discs of colour `c`, fainter outwards (alpha at the rim 0, about alpha / 2 at the core). */
export function glow(g, cx, cy, r, c, alpha) {
  g.save();
  for (let k = r; k > 0; k -= 2) {
    g.globalAlpha = alpha * (1 - k / r) * 0.5;
    for (let y = -k; y <= k; y++) {
      const hw = Math.round(k * Math.sqrt(Math.max(0, 1 - (y / k) ** 2)));
      if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, 1, c);
    }
  }
  g.restore();
}

/** Ellipse on an s-pixel grid (chunky edges, like the 2x figures). */
export function cblob(g, cx, cy, rx, ry, c, s = 2) {
  for (let y = -ry; y < ry; y += s) {
    const yy = (y + s / 2) / ry;
    const hw = Math.round((rx * Math.sqrt(Math.max(0, 1 - yy * yy))) / s) * s;
    if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, s, c);
  }
}

/** A cell painter: r(cx, cy, w, h, colour) in s-pixel cells from (ox, oy). */
export const cells = (g, ox, oy, s) => (cx, cy, w, h, col) => rect(g, ox + cx * s, oy + cy * s, w * s, h * s, col);

/** Sprite from a string map ('|' between rows, '.' transparent), each char a palette key, at scale s. */
export function sprite(g, map, pal, x, y, s = 1, flip = false) {
  map.split('|').forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const col = pal[row[xx]];
      if (row[xx] === '.' || !col) continue;
      rect(g, x + (flip ? row.length - 1 - xx : xx) * s, y + yy * s, s, s, col);
    }
  });
}

/** Draws `draw(g)` once into an offscreen w x h canvas (a mini-game's static scenery); drawImage it every frame. */
export function bake(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}

/** A filled ellipse, row by row (1 px rows, crisp edges): plates, bubbles, hills. */
export function blob(g, cx, cy, rx, ry, c) {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, 1, c);
  }
}

/** A line of `w` px dots from (x1, y1) to (x2, y2). */
export function line(g, x1, y1, x2, y2, c, w = 1) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let k = 0; k <= n; k++) rect(g, Math.round(x1 + ((x2 - x1) * k) / n), Math.round(y1 + ((y2 - y1) * k) / n), w, w, c);
}

/** A lit ball on the 2 px grid: dark rim, the base nudged up-left, one light patch (light from the top left). */
export function shaded(g, cx, cy, rx, ry, c, opts = {}) {
  const { rim = shade(c, -0.35), light = shade(c, 0.22), outline = null } = opts;
  if (outline) cblob(g, cx, cy, rx + 2, ry + 2, outline);
  cblob(g, cx, cy, rx, ry, rim);
  cblob(g, cx - 2, cy - 2, Math.max(2, rx - 2), Math.max(2, ry - 2), c);
  cblob(g, cx - Math.round(rx * 0.3), cy - Math.round(ry * 0.3), Math.max(2, Math.round(rx * 0.4)), Math.max(2, Math.round(ry * 0.4)), light);
}

/** Sparse 2x2 grains over a rect (sand, worktop, sponge): about n / 6 of them, on the 2 px grid, the same for the same seed. */
export function grains(g, x, y, w, h, colors, n, seed = 7) {
  const r = rnd(seed);
  for (let i = 0; i < n / 6; i++) rect(g, x + Math.floor((r() * w) / 2) * 2, y + Math.floor((r() * h) / 2) * 2, 2, 2, colors[i % colors.length]);
}
