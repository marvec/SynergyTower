// Deep Tissue (massage) mockups: a guest with real proportions lying face down on a padded table, seen from above.
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { gradient, blob, shaded, line, sprite, glow, vignette, planks, speckle, shade, rnd, tonePx } from './kit.js';

const SKIN = { base: '#e9b48c', rim: '#c98a62', light: '#f6caa2', dark: '#b4744c' };
const TONES = [SKIN.dark, SKIN.rim, SKIN.base, SKIN.light];
const CX = 240;

// Torso half-width by row (neck → trapezius → shoulders → waist → hips).
function torsoHW(y) {
  const seg = [[80, 15], [90, 52], [100, 76], [112, 80], [140, 76], [196, 62], [270, 70]];
  for (let i = 0; i < seg.length - 1; i++) {
    const [y1, w1] = seg[i];
    const [y2, w2] = seg[i + 1];
    if (y >= y1 && y < y2) {
      const k = (y - y1) / (y2 - y1);
      const e = i < 2 ? Math.sin((k * Math.PI) / 2) : k; // the shoulders round off
      return Math.round(w1 + (w2 - w1) * e);
    }
  }
  return 0;
}

function table(g, pal) {
  // Padded table with piping, the face cradle (a padded horseshoe) at its head end.
  rect(g, 112, 20, 256, H - 20, pal.tableEdge);
  rect(g, 114, 22, 252, H - 22, pal.table);
  rect(g, 114, 22, 252, 1, shade(pal.table, 0.3));
  rect(g, 118, 26, 1, H - 26, shade(pal.table, -0.12));
  rect(g, 361, 26, 1, H - 26, shade(pal.table, -0.12));
  speckle(g, 114, 22, 252, H - 22, [shade(pal.table, -0.05)], 380, 11);
  rect(g, CX - 40, 24, 80, 52, shade(pal.table, -0.08));
  rect(g, CX - 39, 24, 78, 50, shade(pal.table, 0.05));
  rect(g, CX - 39, 24, 78, 1, shade(pal.table, 0.3));
  blob(g, CX, 50, 27, 22, shade(pal.table, -0.3)); // the hole the face rests in
}

function arm(g, side) {
  const s = side;
  // Upper arm from the shoulder, tapering to the wrist; the hand rests palm down at the bottom.
  for (let y = 100; y < 212; y++) {
    const k = (y - 100) / 112;
    const cx = CX + s * (98 - k * 6);
    const hw = Math.round(12 - k * 4);
    for (let x = -hw; x < hw; x++) {
      const across = (x + 0.5) / hw; // -1 (left edge) .. 1
      const round = Math.sqrt(Math.max(0, 1 - across * across));
      tonePx(g, Math.round(cx + x), y, TONES, 0.15 + round * 0.55 - across * 0.18 - k * 0.12);
    }
  }
  // Elbow crease.
  line(g, CX + s * 92 - 3, 158, CX + s * 92 + 3, 160, SKIN.rim);
  // The guest's hand, fingers towards the feet.
  const hx = CX + s * 92;
  blob(g, hx, 218, 8, 9, SKIN.rim);
  blob(g, hx, 217, 7, 8, SKIN.base);
  for (let f = -2; f <= 1; f++) rect(g, hx + f * 3 + 1, 222, 2, 6 + (f === -1 || f === 0 ? 2 : 0), SKIN.base), rect(g, hx + f * 3 + 3, 223, 1, 5, SKIN.rim);
  rect(g, hx + s * 8, 214, 3, 6, SKIN.base);
  // Deltoid: the round of the shoulder joins arm and back.
  shaded(g, CX + s * 86, 106, 16, 13, SKIN.base, { rim: SKIN.rim, light: SKIN.light });
}

function body(g) {
  arm(g, -1);
  arm(g, 1);
  // Torso, pixel by pixel: rounder at the edges, lit from the top left, a dithered blend between four skin tones.
  for (let y = 80; y < 206; y++) {
    const hw = torsoHW(y);
    for (let x = -hw; x < hw; x++) {
      const across = (x + 0.5) / hw;
      const round = Math.sqrt(Math.max(0, 1 - across ** 4));
      const down = (y - 90) / 120;
      tonePx(g, CX + x, y, TONES, 0.1 + round * 0.62 - across * 0.12 - down * 0.18);
    }
  }
  // Spine groove and the shoulder blades.
  for (let y = 92; y < 206; y++) {
    rect(g, CX - 1, y, 1, 1, SKIN.rim);
    rect(g, CX, y, 1, 1, SKIN.light);
  }
  for (const s of [-1, 1]) {
    // The shoulder blades' inner edges, bowed away from the spine, and the shadow under their lower tips.
    for (let y = 102; y < 146; y++) {
      const x = CX + s * (22 + Math.round(Math.sin(((y - 102) / 44) * Math.PI) * 7));
      rect(g, x, y, 1, 1, SKIN.rim);
      rect(g, x + s, y, 1, 1, SKIN.light);
    }
    line(g, CX + s * 23, 146, CX + s * 34, 150, SKIN.rim);
  }
  // Lower back dimples above the towel.
  rect(g, CX - 18, 192, 3, 2, SKIN.rim);
  rect(g, CX + 16, 192, 3, 2, SKIN.rim);
  // Neck and head (the back of it, a bun on top): about a third of the shoulders' width.
  rect(g, CX - 13, 66, 26, 18, SKIN.rim);
  rect(g, CX - 11, 66, 22, 18, SKIN.base);
  rect(g, CX - 2, 70, 4, 14, SKIN.rim);
  blob(g, CX - 25, 54, 4, 6, SKIN.rim);
  blob(g, CX + 25, 54, 4, 6, SKIN.rim);
  blob(g, CX - 25, 54, 3, 5, SKIN.base);
  blob(g, CX + 25, 54, 3, 5, SKIN.base);
  shaded(g, CX, 50, 24, 25, '#5a3620', { rim: '#3a2214', light: '#7a4a2c' });
  for (let i = 0; i < 6; i++) line(g, CX - 14 + i * 6, 34, CX - 18 + i * 7, 68, '#4a2c18');
  shaded(g, CX, 28, 10, 9, '#5a3620', { rim: '#3a2214', light: '#8a5a34' });
  rect(g, CX - 9, 34, 18, 2, '#c84a6a');
}

function towel(g, pal) {
  const y0 = 198;
  rect(g, 146, y0, 188, H - y0, shade(pal.towel, -0.3));
  rect(g, 147, y0 + 1, 186, H - y0, pal.towel);
  rect(g, 147, y0 + 1, 186, 3, shade(pal.towel, 0.25)); // the folded-over edge
  rect(g, 147, y0 + 4, 186, 1, shade(pal.towel, -0.2));
  for (const sy of [y0 + 10, y0 + 15]) rect(g, 147, sy, 186, 2, pal.stripe);
  for (let i = 0; i < 5; i++) line(g, 170 + i * 36, y0 + 24, 160 + i * 38, H, shade(pal.towel, -0.1));
  // The towel drapes over the table's edges.
  rect(g, 134, y0 + 6, 14, H - y0, shade(pal.towel, -0.18));
  rect(g, 332, y0 + 6, 14, H - y0, shade(pal.towel, -0.18));
}

function knot(g, x, y, t) {
  const p = Math.round(Math.sin(t * 6) * 1.5);
  glow(g, x, y, 16 + p, '#ff5a40', 0.55);
  blob(g, x, y, 9 + p, 7 + p, '#e48a72');
  blob(g, x, y, 6 + p, 5 + p, '#d65a4c');
  blob(g, x - 1, y - 1, 3, 2, '#f2a08a');
  // Tension marks.
  for (const [dx, dy] of [[-14, -3], [12, -6], [-10, 8], [14, 6]]) rect(g, x + dx - p, y + dy, 3, 1, '#b8403a');
}

// Masseur's right hand from above, palm down, fingers up the screen (11x16 at scale 2), a white tunic cuff.
const HAND = [
  '....nn.....',
  '..nnSsnn...',
  '..SsSsSsnn.',
  '..SsSsSsSs.',
  '..SsSsSsSs.',
  '..SsSsSsSs.',
  '..SSSSSSSs.',
  'nSSSSSSSSs.',
  'SSsSSSSSSs.',
  '.SSSSSSSSs.',
  '..SSSSSSss.',
  '..SSSSSSss.',
  '..cccccccc.',
  '..cccccccC.',
  '..CCCCCCCC.',
].join('|');

function hands(g, x, y, press) {
  const pal = { S: '#c98a5e', s: '#a86e46', n: '#e8b494', c: '#f6f6f2', C: '#c8ccd0' };
  const out = Object.fromEntries(Object.keys(pal).map((k) => [k, '#3a2418']));
  const sq = press ? 1 : 0;
  for (const [dx, flip] of [[-24, true], [2, false]]) {
    const hx = x + dx + (flip ? sq * 2 : -sq * 2);
    const hy = y - 12 + sq * 2;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sprite(g, HAND, out, hx + ox * 2, hy + oy * 2, 2, flip);
    sprite(g, HAND, pal, hx, hy, 2, flip);
  }
  if (press) for (const a of [0, 1.6, 3.2, 4.7]) rect(g, x + Math.cos(a) * 26, y + Math.sin(a) * 18, 2, 2, '#fff6d8');
}

// Room props, from above.
function candle(g, x, y, t, r = 6) {
  glow(g, x, y, r * 4, '#ffb050', 0.6);
  shaded(g, x, y, r, r, '#f4ecd8', { rim: '#c8bca0', light: '#ffffff' });
  blob(g, x, y, 2, 2, '#c8bca0');
  const f = Math.floor(t * 8) % 2;
  rect(g, x - 1, y - 2 - f, 2, 3, '#ffb030');
  rect(g, x, y - 1 - f, 1, 1, '#fff0a0');
}
function stones(g, x, y) {
  shaded(g, x, y, 16, 11, '#6a6a70', { rim: '#4a4a50', light: '#8a8a92' });
  shaded(g, x + 2, y - 3, 11, 8, '#7a7a82', { rim: '#55555c', light: '#9a9aa2' });
  shaded(g, x + 3, y - 6, 7, 5, '#8a8a90', { rim: '#606068', light: '#aeaeb6' });
}
function towels(g, x, y, col) {
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 13;
    rect(g, x, yy, 54, 12, shade(col, -0.3));
    rect(g, x + 1, yy + 1, 52, 10, col);
    rect(g, x + 1, yy + 1, 52, 2, shade(col, 0.2));
    shaded(g, x + 47, yy + 6, 6, 5, col, { rim: shade(col, -0.3) });
    for (let a = 0; a < 9; a += 0.6) rect(g, Math.round(x + 47 + Math.cos(a) * a * 0.55), Math.round(yy + 6 + Math.sin(a) * a * 0.45), 1, 1, shade(col, -0.25));
  }
}
function orchid(g, x, y) {
  shaded(g, x, y, 15, 14, '#b0603a', { rim: '#7a3a20', light: '#d08050' });
  blob(g, x, y, 11, 10, '#4a3020');
  for (const [dx, dy, rx, ry] of [[-12, 4, 10, 4], [12, -2, 10, 4], [-3, -12, 4, 9], [5, 10, 5, 8]]) shaded(g, x + dx, y + dy, rx, ry, '#3f9a4a', { rim: '#24662e', light: '#6fca6a' });
  for (const [dx, dy] of [[-8, -16], [6, -20], [16, -10], [-16, -6]]) {
    for (const [px, py] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) blob(g, x + dx + px, y + dy + py, 3, 3, '#e86ab0');
    rect(g, x + dx - 1, y + dy - 1, 2, 2, '#ffe070');
  }
}
function bowl(g, x, y, t) {
  shaded(g, x, y, 22, 16, '#d8d0c0', { rim: '#a89c88', light: '#f4ece0' });
  gradient(g, x - 17, y - 11, 34, 22, ['#7ec8d8', '#4aa0c0']);
  blob(g, x, y, 18, 12, 'rgba(0,0,0,0)');
  // Clip the water to an ellipse by re-drawing the rim outside it.
  for (let yy = -12; yy <= 12; yy++) {
    const hw = Math.round(18 * Math.sqrt(Math.max(0, 1 - (yy / 12) ** 2)));
    rect(g, x - 18, y + yy, 18 - hw, 1, '#d8d0c0');
    rect(g, x + hw, y + yy, 18 - hw, 1, '#d8d0c0');
  }
  for (const [dx, dy, c] of [[-6, -2, '#f2a0c0'], [5, 3, '#ffffff'], [2, -5, '#f2a0c0']]) {
    for (const [px, py] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) blob(g, x + dx + px, y + dy + py + Math.round(Math.sin(t * 2 + dx) * 1), 2, 2, c);
  }
}
function oil(g, x, y) {
  shaded(g, x, y, 8, 8, '#c8782a', { rim: '#8a4a14', light: '#f0b060' });
  shaded(g, x, y, 3, 3, '#a87850', { rim: '#6a4a30' });
}

const PALETTES = {
  day: { floor: '#a87650', tableEdge: '#8a7a64', table: '#efe4cc', towel: '#f6f3ea', stripe: '#2fa39a', text: '#3a2414' },
  candle: { floor: '#4a4440', tableEdge: '#3a2c24', table: '#d8c4a8', towel: '#8a2a3a', stripe: '#e8c070', text: '#f6e8c8' },
};

export function massage(g, t, mood = 'day') {
  const pal = PALETTES[mood];
  if (mood === 'day') planks(g, 0, 18, W, H - 18, pal.floor, { board: 12, seed: 5 });
  else {
    // Slate tiles.
    rect(g, 0, 18, W, H - 18, '#2a2622');
    const r = rnd(9);
    for (let y = 18; y < H; y += 32)
      for (let x = (y / 32) % 2 ? -24 : 0; x < W; x += 48) {
        const c = shade(pal.floor, (r() - 0.5) * 0.15);
        rect(g, x + 1, y + 1, 46, 30, c);
        rect(g, x + 1, y + 1, 46, 1, shade(c, 0.15));
        speckle(g, x + 2, y + 2, 44, 28, [shade(c, -0.15), shade(c, 0.1)], 30, x * 7 + y);
      }
  }
  table(g, pal);
  body(g);
  towel(g, pal);
  knot(g, 206, 128, t);
  knot(g, 276, 172, t + 0.7);
  hands(g, 214, 158, false);
  // Props.
  if (mood === 'day') {
    towels(g, 28, 36, '#f6f3ea');
    stones(g, 56, 132);
    candle(g, 58, 120, t);
    bowl(g, 58, 214, t);
    orchid(g, 424, 62);
    oil(g, 404, 150);
    candle(g, 432, 146, t + 1);
    candle(g, 448, 160, t + 2, 5);
    towels(g, 400, 204, '#2fa39a');
  } else {
    towels(g, 28, 36, '#8a2a3a');
    stones(g, 56, 132);
    for (const [x, y, k] of [[44, 196, 0], [64, 210, 1], [50, 226, 2], [430, 60, 3], [448, 76, 4], [416, 84, 5], [430, 200, 6], [446, 216, 7]]) candle(g, x, y, t + k, 5 + (k % 2));
    orchid(g, 432, 140);
    oil(g, 70, 168);
  }
  if (mood === 'candle') {
    // Warm candlelight over everything, darker towards the edges.
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#f0b880';
    g.fillRect(0, 18, W, H - 18);
    g.restore();
    vignette(g, W, H, CX, 140, 230, '#140a04', 0.7);
  }
  header(g, 'Deep Tissue', 'Knots 3/12');
  timerBar(g, 22, 30);
  drawText(g, 'Find the knots and let them go', W / 2, 256, { align: 'center', color: pal.text, shadow: mood === 'candle' ? '#1a0f08' : null });
}
