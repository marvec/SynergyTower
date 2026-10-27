// Pool Ball, the in-between style: the same hotel pool, flat bands instead of dithered gradients, 2 px detail, and the
// swimmer as the Elevator Pitch figure in the player's swimwear (trunks with trousers, a swimsuit with a skirt).
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { bands, cblob } from './kit.js';
import { palm } from './poolball.js';
import { person } from './person.js';

const WATER = 214;
const CORP = '#2f8f7f'; // the career's corporate colour

function hotel(g) {
  rect(g, 70, 34, 340, 120, '#e8d6b4');
  rect(g, 66, 30, 348, 6, '#c8b088');
  rect(g, 66, 30, 348, 2, '#d8c49c');
  drawText(g, 'HOTEL PARADISO', 240, 40, { align: 'center', color: '#b0603a' });
  for (let row = 0; row < 3; row++) {
    const y = 56 + row * 30;
    for (let col = 0; col < 8; col++) {
      const x = 84 + col * 40;
      rect(g, x, y, 22, 18, '#5a8aaa');
      rect(g, x, y, 22, 6, '#8ac0dc');
      rect(g, x + 10, y, 2, 18, '#e8d6b4');
      rect(g, x - 4, y, 4, 18, '#2f8f7f');
      rect(g, x + 22, y, 4, 18, '#2f8f7f');
      rect(g, x - 6, y + 18, 34, 2, '#ffffff');
      for (let k = 0; k < 34; k += 6) rect(g, x - 6 + k, y + 20, 2, 4, '#ffffff');
    }
  }
}

function lounger(g, x, y, flip) {
  rect(g, x, y, 44, 4, '#f4f4f0');
  for (let k = 0; k < 44; k += 8) rect(g, x + k, y - 4, 8, 4, k % 16 ? '#2fa39a' : '#ffffff');
  for (let k = 0; k < 14; k += 2) rect(g, flip ? x - k : x + 40 + k, y - 4 - k, 4, 2, k % 4 < 2 ? '#2fa39a' : '#ffffff');
  for (const lx of [x + 2, x + 40]) rect(g, lx, y + 4, 2, 6, '#9aa1ad');
}

function umbrella(g, x, y) {
  rect(g, x, y - 46, 2, 46, '#f4f4f0');
  for (let k = 0; k < 18; k += 2) {
    const hw = 4 + k * 2;
    for (let s = -hw; s < hw; s += 8) rect(g, x + s, y - 50 + k, Math.min(8, hw - s), 2, Math.floor((s + 64) / 8) % 2 ? '#e2504a' : '#ffffff');
  }
}

function deck(g) {
  bands(g, 0, 150, W, WATER - 158, ['#efe4cc', '#eadcc0']);
  for (let y = 156; y < WATER - 8; y += 12) rect(g, 0, y, W, 1, '#d4c4a4');
  umbrella(g, 64, 188);
  lounger(g, 20, 190, false);
  lounger(g, 84, 192, false);
  umbrella(g, 408, 186);
  lounger(g, 360, 190, true);
  lounger(g, 424, 192, true);
  rect(g, 150, 182, 30, 10, '#f2c14e');
  for (let k = 0; k < 30; k += 8) rect(g, 150 + k, 182, 4, 10, '#e2504a');
  rect(g, 0, WATER - 8, W, 4, '#f8f6f0');
  for (let x = 0; x < W; x += 8) rect(g, x, WATER - 4, 8, 4, (x / 8) % 2 ? '#2a86c7' : '#e8f6fb');
}

function water(g, t) {
  bands(g, 0, WATER, W, H - WATER, ['#4ccde8', '#3ab8dc', '#2ea4d0', '#2490c2']);
  // Ripples: short 2 px dashes drifting, like today's, a few more.
  for (let i = 0; i < 22; i++) rect(g, ((i * 61 + t * 30) % (W + 40)) - 20, WATER + 8 + (i % 5) * 11, 10 + (i % 3) * 4, 2, '#8fe6f5');
  for (let x = 0; x < W; x += 16) rect(g, x, 256, 10, 4, '#1f74a8');
  for (const lx of [442, 456]) rect(g, lx, WATER - 22, 2, 40, '#d8dee6');
  for (let k = 0; k < 3; k++) rect(g, 442, WATER + 2 + k * 8, 16, 2, '#b8c4d0');
}

function ball(g, x, y, t) {
  // A chunky ball: 2 px cells, six panels turning, a white cap and one highlight.
  const cols = ['#e2504a', '#ffffff', '#3b6fb6', '#f2c14e', '#ffffff', '#3bb66a'];
  const r = 12;
  cblob(g, x, y, r + 2, r + 2, '#1a1a22');
  for (let dy = -r; dy < r; dy += 2)
    for (let dx = -r; dx < r; dx += 2) {
      const cx = dx + 1;
      const cy = dy + 1;
      if (cx * cx + cy * cy > r * r) continue;
      const ring = Math.sqrt(r * r - cy * cy) || 1;
      const lon = Math.asin(Math.max(-1, Math.min(1, cx / ring)));
      let c = cols[(((Math.floor(((lon + t * 1.5) / Math.PI) * 6) % 6) + 6) % 6)];
      if (cy < -r * 0.65 && Math.abs(cx) < 6) c = '#ffffff';
      rect(g, x + dx, y + dy, 2, 2, c);
    }
  rect(g, x - 6, y - 8, 4, 2, '#ffffff');
}

export function poolball2(g, t, skirt) {
  bands(g, 0, 18, W, 132, ['#6ab8ea', '#8fd0f0', '#b4e2f6']);
  for (const [x, y] of [[40, 34], [330, 26]]) {
    rect(g, x, y, 40, 8, '#ffffff');
    rect(g, x + 8, y - 4, 22, 4, '#ffffff');
    rect(g, x, y + 8, 40, 2, '#d8eef8');
  }
  hotel(g);
  palm(g, 34, 186, 120, 0.35, t);
  palm(g, 452, 184, 110, -0.4, t + 1);
  deck(g);
  const bx = 282;
  // The swimmer: the pitch figure at 2x, waist-deep, arms up; the part under water is tinted.
  const look = skirt
    ? { skin: '#f2c9a0', hair: '#5a3620', top: CORP, pants: '#3a3f55', suit: CORP, long: true }
    : { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', trunks: CORP };
  const px = 240;
  const py = WATER - 19 * 2;
  person(g, px, py, 2, look, { pose: 'armsUp', swim: skirt ? 'suit' : 'shorts' });
  water(g, t);
  // The legs show faintly through the water.
  g.save();
  g.globalAlpha = 0.35;
  rect(g, px + 6, WATER, 4, 18, look.skin);
  rect(g, px + 14, WATER, 4, 18, look.skin);
  g.restore();
  // The ball's shadow on the water: where it comes down.
  g.save();
  g.globalAlpha = 0.35;
  rect(g, bx - 8, WATER + 2, 16, 2, '#0a3a5a');
  g.restore();
  for (let k = -14; k < 38; k += 4) rect(g, px + k, WATER + ((k / 4) % 2 ? 0 : 2), 4, 2, '#e8fcff');
  ball(g, bx, 92, t);
  header(g, 'Pool Ball', 'Bounces 4/10');
  timerBar(g, 20, 32);
  drawText(g, 'Stay under the ball and keep it up', W / 2, 22, { align: 'center', color: '#1a3a5a' });
}
