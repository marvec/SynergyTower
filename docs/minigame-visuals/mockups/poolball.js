// Pool Ball mockup: the hotel pool with its deck, a swimmer with real proportions, a round beach ball and its shadow.
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { gradient, blob, shaded, line, shade, rnd } from './kit.js';

const WATER = 214; // proposed: lower than today's 200, so the swimmer can stand taller
const HANDS = 160; // proposed: the ball meets raised hands, not the swimmer's head

function cloud(g, x, y, s) {
  for (const [dx, dy, rx, ry] of [[0, 0, 14, 6], [12, -4, 12, 7], [24, 0, 12, 5], [8, 3, 16, 4]]) blob(g, x + dx * s, y + dy * s, rx * s, ry * s, '#ffffff');
  for (const [dx, rx] of [[0, 14], [24, 12]]) rect(g, x + (dx - rx) * s, y + 4 * s, rx * 2 * s, 1, '#d8eef8');
}

export function palm(g, x, y, h, lean, t = 0) {
  // Trunk: stacked segments curving with `lean`, then fronds drooping from the crown.
  let tx = x;
  for (let k = 0; k < h; k += 4) {
    const f = k / h;
    tx = x + lean * f * f * h * 0.5;
    rect(g, Math.round(tx) - 3, y - k - 4, 7, 4, '#8a6038');
    rect(g, Math.round(tx) - 3, y - k - 4, 7, 1, '#5a3a20');
    rect(g, Math.round(tx) + 2, y - k - 3, 2, 3, '#a87848');
  }
  const cx = Math.round(tx);
  const cy = y - h - 2;
  const sway = Math.sin(t * 1.2) * 2;
  for (const [ang, len] of [[-2.8, 34], [-2.2, 30], [-1.6, 22], [-1.0, 30], [-0.35, 34], [0.2, 26], [-3.4, 26]]) {
    for (let k = 0; k < len; k++) {
      const f = k / len;
      const px = cx + Math.cos(ang) * k + sway * f;
      const py = cy + Math.sin(ang) * k + f * f * 14;
      rect(g, Math.round(px), Math.round(py), 2, 2, f < 0.5 ? '#2f8a3a' : '#3fae4f');
      if (k % 3 === 0 && k > 4) rect(g, Math.round(px), Math.round(py) + 2, 1, 3, '#24662e');
    }
  }
  for (const [dx, dy] of [[-2, 2], [3, 3], [0, 5]]) shaded(g, cx + dx, cy + dy, 3, 3, '#6a4a22', { rim: '#3a2a12' });
}

function hotel(g) {
  rect(g, 70, 34, 340, 120, '#e8d6b4');
  rect(g, 70, 34, 340, 4, '#c8b088');
  rect(g, 66, 30, 348, 5, '#d8c49c');
  drawText(g, 'HOTEL PARADISO', 240, 40, { align: 'center', color: '#b0603a' });
  for (let row = 0; row < 3; row++) {
    const y = 56 + row * 30;
    for (let col = 0; col < 8; col++) {
      const x = 84 + col * 40;
      rect(g, x, y, 22, 18, '#3a6a8a');
      rect(g, x + 1, y + 1, 20, 6, '#7ab8d8');
      rect(g, x + 10, y, 2, 18, '#e8d6b4');
      // Shutters and a balcony rail.
      rect(g, x - 4, y, 4, 18, '#2f8f7f');
      rect(g, x + 22, y, 4, 18, '#2f8f7f');
      rect(g, x - 5, y + 17, 32, 2, '#ffffff');
      for (let k = 0; k < 32; k += 4) rect(g, x - 5 + k, y + 19, 1, 5, '#ffffff');
      rect(g, x - 5, y + 24, 32, 1, '#b8a07c');
    }
  }
}

function lounger(g, x, y, flip) {
  const d = flip ? -1 : 1;
  rect(g, x, y, 44, 3, '#f4f4f0');
  for (let k = 0; k < 44; k += 6) rect(g, x + k, y - 3, 6, 3, k % 12 ? '#2fa39a' : '#ffffff');
  // The raised back.
  for (let k = 0; k < 14; k++) rect(g, flip ? x - k + 2 : x + 42 + k - 2, y - 3 - k, 3, 1, k % 4 < 2 ? '#2fa39a' : '#ffffff');
  for (const lx of [x + 2, x + 40]) rect(g, lx, y + 3, 2, 6, '#9aa1ad');
  rect(g, x + d * 0, y + 9, 44, 1, 'rgba(0,0,0,0.15)');
}

function umbrella(g, x, y) {
  rect(g, x, y - 46, 2, 46, '#f4f4f0');
  for (let k = 0; k < 18; k++) {
    const hw = Math.round(4 + k * 1.6);
    for (let s = -hw; s < hw; s += 1) rect(g, x + s, y - 50 + k, 1, 1, Math.floor((s + 40) / 7) % 2 ? '#e2504a' : '#ffffff');
  }
  for (let s = -32; s < 32; s += 7) blob(g, x + s + 3, y - 32, 3, 2, Math.floor((s + 40) / 7) % 2 ? '#e2504a' : '#ffffff');
  rect(g, x, y - 54, 2, 4, '#b8a07c');
}

function deck(g) {
  gradient(g, 0, 150, W, WATER - 156, ['#efe4cc', '#e6d8bc']);
  for (let y = 154; y < WATER - 6; y += 10) rect(g, 0, y, W, 1, '#d4c4a4');
  for (let y = 154, i = 0; y < WATER - 6; y += 10, i++) for (let x = (i % 2) * 12; x < W; x += 24) rect(g, x, y, 1, 10, '#d4c4a4');
  umbrella(g, 64, 188);
  lounger(g, 20, 190, false);
  lounger(g, 84, 192, false);
  umbrella(g, 408, 186);
  lounger(g, 360, 190, true);
  lounger(g, 424, 192, true);
  // A towel and flip-flops.
  rect(g, 150, 182, 30, 10, '#f2c14e');
  for (let k = 0; k < 30; k += 6) rect(g, 150 + k, 182, 3, 10, '#e2504a');
  blob(g, 194, 188, 3, 2, '#3b6fb6');
  blob(g, 200, 190, 3, 2, '#3b6fb6');
  // Pool coping and the tile band.
  rect(g, 0, WATER - 8, W, 4, '#f8f6f0');
  rect(g, 0, WATER - 4, W, 1, '#c8c0b0');
  for (let x = 0; x < W; x += 6) rect(g, x, WATER - 3, 5, 3, (x / 6) % 2 ? '#2a86c7' : '#e8f6fb');
}

function water(g, t) {
  gradient(g, 0, WATER, W, H - WATER, ['#5ad4ec', '#3ab8dc', '#2a96c8', '#1f7fb4']);
  // Caustics: a net of light lines that drifts.
  for (let y = WATER + 2; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const v = Math.sin(x * 0.11 + Math.sin(y * 0.19 + t) * 2.2) + Math.sin(y * 0.23 - x * 0.04 + t * 0.8);
      if (v > 1.78) rect(g, x, y, 1, 1, y < WATER + 24 ? '#a8f0fa' : '#7fdcf0');
    }
  // A lane line on the bottom, wobbling with the refraction.
  for (let x = 0; x < W; x += 2) rect(g, x, 254 + Math.round(Math.sin(x * 0.08 + t * 2) * 1.5), 2, 3, '#1a5f94');
  // Surface glints.
  const r = rnd(4);
  for (let i = 0; i < 26; i++) rect(g, (r() * W + t * 20) % W, WATER + 2 + r() * 50, 4 + r() * 8, 1, '#e8fcff');
  // The pool ladder.
  for (const lx of [442, 456]) {
    rect(g, lx, WATER - 22, 2, 40, '#d8dee6');
    rect(g, lx + 2, WATER - 22, 1, 40, '#8a96a6');
  }
  rect(g, lx0(), WATER - 24, 18, 2, '#d8dee6');
  for (let k = 0; k < 3; k++) rect(g, 442, WATER + 2 + k * 8, 16, 2, '#b8c4d0');
}
const lx0 = () => 440;

function swimmer(g, x, t) {
  const SK = ['#9a6040', '#c98a62', '#e9b48c', '#f6caa2'];
  const ripple = Math.floor(t * 4) % 2;
  // Under water: hips and legs, tinted and wobbling.
  g.save();
  g.globalAlpha = 0.45;
  rect(g, x - 9, WATER, 18, 12, '#e85d75');
  for (let y = WATER + 12; y < WATER + 40; y++) {
    const w = Math.round(Math.sin(y * 0.4 + t * 3));
    rect(g, x - 8 + w, y, 6, 1, SK[1]);
    rect(g, x + 2 + w, y, 6, 1, SK[1]);
  }
  g.restore();
  // Torso above the water: shoulders, swimsuit, arms raised in a V.
  for (let y = 186; y < WATER; y++) {
    const hw = y < 190 ? 8 + (y - 186) * 2 : y < 200 ? 15 : 13;
    rect(g, x - hw, y, hw * 2, 1, SK[1]);
    rect(g, x - hw + 1, y, hw * 2 - 3, 1, SK[2]);
    rect(g, x - hw + 2, y, Math.round(hw * 0.6), 1, y < 196 ? SK[3] : SK[2]);
  }
  // A one-piece swimsuit, narrower at the waist.
  for (let y = 198; y < WATER; y++) {
    const hw = y < 204 ? 12 : 11;
    rect(g, x - hw, y, hw * 2, 1, '#c8405a');
    rect(g, x - hw + 1, y, hw * 2 - 3, 1, '#e85d75');
  }
  rect(g, x - 10, 198, 8, 1, '#ff8a9a');
  rect(g, x - 9, 194, 2, 4, '#e85d75');
  rect(g, x + 7, 194, 2, 4, '#e85d75');
  for (const s of [-1, 1]) {
    // Upper arm and forearm, then an open hand.
    line(g, x + s * 13, 190, x + s * 17, 176, SK[1], 4);
    line(g, x + s * 12, 190, x + s * 16, 176, SK[2], 3);
    line(g, x + s * 17, 176, x + s * 14, HANDS + 4, SK[1], 4);
    line(g, x + s * 16, 176, x + s * 13, HANDS + 4, SK[2], 3);
    shaded(g, x + s * 14, HANDS + 2, 4, 4, SK[2], { rim: SK[0], light: SK[3] });
    for (let f = -1; f <= 1; f++) rect(g, x + s * 14 + f * 2, HANDS - 3, 1, 3, SK[2]);
  }
  // Head: face, sunglasses, hair in a bun.
  rect(g, x - 3, 183, 6, 4, SK[1]);
  shaded(g, x, 176, 7, 8, SK[2], { rim: SK[0], light: SK[3] });
  blob(g, x, 170, 8, 4, '#3a2214');
  rect(g, x - 8, 170, 2, 7, '#3a2214');
  rect(g, x + 6, 170, 2, 7, '#3a2214');
  shaded(g, x + 1, 165, 4, 3, '#3a2214', { rim: '#24140a', light: '#5a3620' });
  rect(g, x - 6, 175, 5, 3, '#14141c');
  rect(g, x + 1, 175, 5, 3, '#14141c');
  rect(g, x - 1, 176, 2, 1, '#14141c');
  rect(g, x - 5, 175, 2, 1, '#6a7a9a');
  rect(g, x - 2, 181, 4, 1, '#a04a3a');
  // The ring of ripples around the waist.
  for (let a = 0; a < Math.PI * 2; a += 0.08) {
    const rx = 20 + ripple * 3;
    rect(g, Math.round(x + Math.cos(a) * rx), Math.round(WATER + 1 + Math.sin(a) * 3), 2, 1, a < Math.PI ? '#e8fcff' : '#bff2fa');
  }
}

function beachBall(g, x, y, r, t) {
  // A sphere with six coloured panels turning about its vertical axis, a white cap, shading from the top left.
  const cols = ['#e2504a', '#ffffff', '#3b6fb6', '#f2c14e', '#ffffff', '#3bb66a'];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const ring = Math.sqrt(r * r - dy * dy) || 1;
      const lon = Math.asin(Math.max(-1, Math.min(1, dx / ring)));
      let c = cols[(((Math.floor(((lon + t * 1.5) / Math.PI) * 6) % 6) + 6) % 6)];
      if (dx * dx + (dy + r) * (dy + r) < (r * 0.3) ** 2) c = '#ffffff';
      const light = (-dx - dy) / (r * 1.6) + 0.15;
      const edge = Math.sqrt(d2) / r;
      if (edge > 0.86 || light < -0.35) c = shade(c, -0.28);
      else if (light > 0.45 && edge < 0.6) c = shade(c, 0.25);
      rect(g, x + dx, y + dy, 1, 1, c);
    }
  for (let a = 0; a < Math.PI * 2; a += 0.05) rect(g, Math.round(x + Math.cos(a) * (r + 1)), Math.round(y + Math.sin(a) * (r + 1)), 1, 1, '#1a1a22');
  rect(g, x - 5, y - 6, 3, 2, '#ffffff');
}

export function poolball(g, t) {
  gradient(g, 0, 18, W, 140, ['#5ab0e8', '#8fd0f0', '#c4e8f8']);
  cloud(g, 40, 36, 1);
  cloud(g, 330, 26, 1);
  hotel(g);
  // Haze: the background steps back so the ball reads against it.
  g.save();
  g.globalAlpha = 0.3;
  g.fillStyle = '#e8f6ff';
  g.fillRect(0, 18, W, 132);
  g.restore();
  palm(g, 34, 186, 120, 0.35, t);
  palm(g, 452, 184, 110, -0.4, t + 1);
  deck(g);
  water(g, t);
  const bx = 282;
  const by = 92;
  // The ball's shadow on the water: where it will come down (a readability aid).
  g.save();
  g.globalAlpha = 0.35;
  blob(g, bx, WATER + 2, 9, 2, '#0a3a5a');
  g.restore();
  swimmer(g, 252, t);
  beachBall(g, bx, by, 12, t);
  header(g, 'Pool Ball', 'Bounces 4/10');
  timerBar(g, 20, 32);
  drawText(g, 'Stay under the ball and keep it up', W / 2, 22, { align: 'center', color: '#1a3a5a' });
}
