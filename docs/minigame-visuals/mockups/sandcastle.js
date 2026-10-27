// Sandcastle mockup: a beach with a rolling surf, wet and dry sand, a real pail on a kid's arm, a castle with towers.
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { gradient, blob, shaded, line, speckle, shade, rnd, sprite } from './kit.js';

const BASE_Y = 226;
const LAYER_H = 16;
const CX = 240;
const width = (i) => 96 - i * 10;
const SAND = ['#b89a5a', '#d4b46e', '#e6c784', '#f2dc9e'];

function sea(g, t) {
  gradient(g, 0, 18, W, 56, ['#5aa8e0', '#8fd0f0', '#cdeefa']);
  for (const [x, y] of [[60, 34], [120, 28], [380, 40]]) {
    line(g, x, y, x + 4, y - 3, '#3a4a5a');
    line(g, x + 4, y - 3, x + 8, y, '#3a4a5a');
  }
  // Island and a sail on the horizon.
  blob(g, 390, 74, 40, 6, '#5a9a6a');
  blob(g, 380, 72, 18, 6, '#4a8a5a');
  rect(g, 0, 74, W, 1, '#e8f8ff');
  rect(g, 120, 66, 1, 8, '#6a5a4a');
  for (let k = 0; k < 7; k++) rect(g, 121, 66 + k, k, 1, '#ffffff');
  gradient(g, 0, 75, W, 32, ['#1f6fb0', '#2a86c7', '#3ec1d8']);
  const r = rnd(12);
  for (let i = 0; i < 40; i++) rect(g, (r() * W + t * 6) % W, 78 + r() * 28, 3 + r() * 5, 1, '#8fe6f5');
  // Surf: a scalloped foam line, then the wash over wet sand.
  for (let x = 0; x < W; x += 1) {
    const y = 106 + Math.round(Math.sin(x * 0.07 + t * 1.5) * 2 + Math.sin(x * 0.19) * 1);
    rect(g, x, y, 1, 4, '#ffffff');
    rect(g, x, y + 4, 1, 2, '#bff2fa');
  }
}

function beach(g) {
  gradient(g, 0, 112, W, 20, ['#8fc8d0', '#c8b07a', '#d8bc80']);
  gradient(g, 0, 128, W, H - 128, ['#e2c486', '#ecd49a', '#f2dea6']);
  speckle(g, 0, 112, W, H - 112, ['#c8a868', '#fff0c0', '#d4b474'], 900, 21);
  // Footprints, shells, a starfish.
  for (let i = 0; i < 6; i++) {
    blob(g, 40 + i * 14, 236 - i * 12 + (i % 2) * 5, 2, 3, '#d4b474');
  }
  for (const [x, y] of [[96, 150], [404, 240], [330, 160]]) {
    blob(g, x, y, 4, 3, '#f4e8e0');
    for (let k = -3; k <= 3; k += 2) rect(g, x + k, y - 2, 1, 4, '#d8b8b0');
  }
  sprite(g, '..s..|..s..|sssss|.s.s.|s...s', { s: '#e8704a' }, 150, 236, 2);
}

function umbrella(g) {
  rect(g, 66, 136, 2, 100, '#f4f4f0');
  for (let k = 0; k < 22; k++) {
    const hw = Math.round(6 + k * 2.2);
    for (let s = -hw; s < hw; s++) rect(g, 67 + s, 116 + k, 1, 1, Math.floor((s + 60) / 9) % 2 ? '#f2c14e' : '#2a86c7');
  }
  rect(g, 66, 112, 2, 4, '#b8a07c');
  // Towel in its shade.
  for (let y = 0; y < 16; y++) rect(g, 30 - y, 230 + y, 80, 1, y % 6 < 3 ? '#e2504a' : '#ffffff');
}

function spade(g) {
  rect(g, 352, 180, 3, 40, '#8a5a3a');
  rect(g, 350, 178, 7, 4, '#e2504a');
  for (let k = 0; k < 10; k++) rect(g, 349 + Math.floor(k / 3), 218 + k, 9 - Math.floor(k / 3) * 2, 1, '#e2504a');
}

function tier(g, i, cx, y, w) {
  // A packed tier: tapering sides, light from the left, crenellations, wet darker foot, windows.
  for (let k = 0; k < LAYER_H; k++) {
    const inset = Math.floor((LAYER_H - k) / 5);
    const x0 = cx - w / 2 + inset;
    const ww = w - inset * 2;
    rect(g, x0, y + k, ww, 1, SAND[2]);
    rect(g, x0, y + k, 3, 1, SAND[3]);
    rect(g, x0 + ww - 4, y + k, 4, 1, SAND[1]);
  }
  rect(g, cx - w / 2, y + LAYER_H - 2, w, 2, SAND[0]);
  speckle(g, cx - w / 2 + 2, y + 1, w - 4, LAYER_H - 3, [SAND[1], SAND[3]], Math.round(w / 2), i * 31 + 5);
  for (let x = cx - w / 2 + 2; x < cx + w / 2 - 5; x += 9) {
    rect(g, x, y - 4, 5, 4, SAND[2]);
    rect(g, x, y - 4, 2, 4, SAND[3]);
    rect(g, x + 4, y - 4, 1, 4, SAND[1]);
  }
  // Windows (and a door at the base).
  if (i === 0) {
    blob(g, cx, y + 9, 6, 6, SAND[0]);
    rect(g, cx - 6, y + 9, 12, 7, SAND[0]);
    blob(g, cx, y + 9, 5, 5, '#5a4022');
    rect(g, cx - 5, y + 9, 10, 7, '#5a4022');
  } else
    for (const dx of [-w / 4, w / 4]) {
      rect(g, cx + dx - 2, y + 5, 4, 6, '#5a4022');
      blob(g, cx + dx, y + 5, 2, 2, '#5a4022');
    }
}

// The pail: a tapered bucket with a rim, a highlight stripe, sand showing at the top, a wire handle.
function pail(g, x, y, tip) {
  g.save();
  g.translate(x, y);
  g.rotate(tip);
  for (let k = 0; k < 22; k++) {
    const hw = 14 - Math.floor(k / 4);
    rect(g, -hw, k, hw * 2, 1, '#1a3a7a');
    rect(g, -hw + 1, k, hw * 2 - 2, 1, '#3b6fb6');
    rect(g, -hw + 3, k, 3, 1, '#7fb4ea');
    rect(g, hw - 4, k, 3, 1, '#2a5498');
  }
  rect(g, -16, -2, 32, 4, '#1a3a7a');
  rect(g, -15, -2, 30, 3, '#5a8ad6');
  rect(g, -13, -1, 26, 1, SAND[2]);
  rect(g, -6, 8, 12, 6, '#f2c14e');
  sprite(g, '.y.|yyy|.y.', { y: '#ffffff' }, -1, 9, 1);
  // Handle.
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.06) rect(g, Math.round(Math.cos(a) * 15), Math.round(Math.sin(a) * 14), 1, 1, '#9aa1ad');
  g.restore();
}

function arm(g, x, y) {
  // A kid's arm from above the screen: sleeve, forearm, a fist round the handle.
  rect(g, x - 6, 18, 12, 10, '#2a2a3a');
  rect(g, x - 5, 18, 10, 10, '#f2c14e');
  rect(g, x - 5, 26, 10, 2, '#d4a030');
  rect(g, x - 4, 28, 8, y - 34, '#c98a62');
  rect(g, x - 3, 28, 6, y - 34, '#e9b48c');
  rect(g, x - 2, 28, 2, y - 34, '#f6caa2');
  shaded(g, x, y - 4, 5, 5, '#e9b48c', { rim: '#b4744c', light: '#f6caa2' });
  rect(g, x - 4, y - 3, 8, 1, '#c98a62');
}

export function sandcastle(g, t, built = 3) {
  sea(g, t);
  beach(g);
  umbrella(g);
  spade(g);
  // The mound, then the tiers built so far.
  blob(g, CX, BASE_Y + 4, 78, 7, SAND[1]);
  blob(g, CX, BASE_Y + 2, 72, 5, SAND[2]);
  for (let i = 0; i < built; i++) tier(g, i, CX, BASE_Y - (i + 1) * LAYER_H, width(i));
  const top = BASE_Y - built * LAYER_H;
  if (built >= 6) {
    // Finished: a flag and shell decorations on the keep.
    rect(g, CX, top - 30, 1, 26, '#6b4a22');
    for (let k = 0; k < 8; k++) rect(g, CX + 1, top - 30 + k, 14 - Math.abs(4 - k) * 2, 1, k < 4 ? '#e2504a' : '#c03a34');
    for (let i = 0; i < 6; i++) blob(g, CX - 30 + i * 12, BASE_Y - 8, 2, 2, '#f4e8e0');
  }
  // Target pennants either side of the top.
  if (built < 6) for (const s of [-1, 1]) {
    const fx = CX + s * (width(built) / 2 + 8);
    rect(g, fx, top - 22, 1, 20, '#6b4a22');
    for (let k = 0; k < 5; k++) rect(g, fx + (s > 0 ? 1 : -k - 1), top - 22 + k, s > 0 ? 7 - k : 7 - k, 1, k % 2 ? '#e2504a' : '#f2c14e');
  }
  const swing = Math.sin(t * 2) * 50;
  arm(g, CX + swing, 44);
  pail(g, CX + swing, 50, -swing / 400);
  header(g, 'Sandcastle', `Layers ${built}/6`);
  timerBar(g, 26, 40);
  drawText(g, 'Tip the bucket over the castle', W / 2, 256, { align: 'center', color: '#6a4a22' });
}

export function sandcastleDone(g, t) {
  sandcastle(g, t, 6);
}
