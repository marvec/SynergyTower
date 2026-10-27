// Squeaky Clean mockup: a kitchen counter (tiles, window, sink full of suds, a real drying rack), a round plate with a
// patterned rim and food on it, a two-layer sponge with bubbles.
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { gradient, blob, shaded, speckle, shade, rnd } from './kit.js';

const PLATE = { x: 150, y: 116, r: 46 };
const RACK = { x: 352, y: 168 };

function wall(g) {
  // Subway tiles.
  rect(g, 0, 18, W, 140, '#c8d0cc');
  for (let y = 18, row = 0; y < 158; y += 9, row++)
    for (let x = row % 2 ? -10 : 0; x < W; x += 20) {
      rect(g, x + 1, y + 1, 18, 7, '#eef2ee');
      rect(g, x + 1, y + 1, 18, 1, '#ffffff');
      rect(g, x + 1, y + 7, 18, 1, '#dce2de');
    }
  // Window above the sink: sky, a tree, curtains, a herb pot on the sill.
  rect(g, 66, 22, 172, 66, '#e8e4dc');
  gradient(g, 72, 26, 160, 56, ['#8fc8f0', '#c8e8f8']);
  shaded(g, 110, 70, 26, 18, '#4f9a4a', { rim: '#2f6a2e', light: '#7aca6a' });
  shaded(g, 196, 74, 30, 14, '#5aa44f', { rim: '#2f6a2e', light: '#8ad06a' });
  rect(g, 150, 26, 4, 56, '#e8e4dc');
  rect(g, 72, 52, 160, 3, '#e8e4dc');
  for (const [x, d] of [[66, 1], [222, -1]]) {
    for (let y = 20; y < 92; y++) {
      const w = 14 + Math.round(Math.sin(y * 0.3) * 1) + (y > 70 ? Math.round((y - 70) * 0.2) : 0);
      rect(g, d > 0 ? x - 4 : x + 20 - w, y, w, 1, y % 6 < 3 ? '#e2504a' : '#f4f1e8');
    }
  }
  rect(g, 60, 88, 184, 5, '#d8d0c0');
  rect(g, 60, 88, 184, 1, '#f4f0e8');
  // Herb pot on the sill.
  rect(g, 196, 76, 14, 12, '#b0603a');
  rect(g, 195, 76, 16, 2, '#c8784a');
  for (const [dx, dy] of [[-3, -6], [2, -9], [6, -5], [0, -3]]) shaded(g, 203 + dx, 76 + dy, 3, 3, '#3fae4f', { rim: '#24662e' });
  // A shelf with mugs on the right.
  rect(g, 300, 54, 150, 4, '#8a6038');
  rect(g, 300, 58, 150, 1, '#5a3a20');
  for (const [x, c] of [[312, '#e2504a'], [336, '#f2c14e'], [360, '#3b6fb6'], [384, '#f4f1e8']]) {
    rect(g, x, 40, 14, 14, shade(c, -0.25));
    rect(g, x + 1, 40, 12, 13, c);
    rect(g, x + 1, 40, 3, 13, shade(c, 0.25));
    rect(g, x + 14, 44, 3, 6, shade(c, -0.25));
  }
}

function counter(g) {
  rect(g, 0, 158, W, 34, '#5a5a62');
  gradient(g, 0, 158, W, 30, ['#9aa0a8', '#80868e']);
  speckle(g, 0, 158, W, 30, ['#6a7078', '#b4bac2', '#e8ecf0'], 600, 3);
  rect(g, 0, 158, W, 1, '#c8ccd2');
  rect(g, 0, 188, W, 4, '#3a3d44');
  // Cabinet doors.
  rect(g, 0, 192, W, H - 192, '#c8a070');
  for (let x = 4; x < W; x += 78) {
    rect(g, x, 196, 72, H - 196, '#b48a5a');
    rect(g, x + 4, 200, 64, H - 200, '#d4ae7c');
    rect(g, x + 4, 200, 64, 1, '#e8c898');
    rect(g, x + 32, 204, 8, 2, '#5a5a62');
  }
  // A tea towel over a door handle.
  for (let y = 204; y < 240; y++) rect(g, 262, y, 18, 1, Math.floor(y / 4) % 2 ? '#e2504a' : '#f4f1e8');
  for (let x = 262; x < 280; x += 4) rect(g, x, 204, 2, 36, 'rgba(255,255,255,0.25)');
}

function sink(g, t) {
  // Steel basin set into the counter, foam heaped over the water.
  rect(g, 56, 148, 190, 44, '#8a9098');
  rect(g, 58, 150, 186, 40, '#c8ced6');
  rect(g, 64, 154, 174, 32, '#5a6068');
  gradient(g, 64, 154, 174, 32, ['#4a5058', '#7a8088']);
  const r = rnd(8);
  for (let i = 0; i < 46; i++) {
    const x = 70 + r() * 160;
    const y = 158 + r() * 22 + Math.sin(t * 2 + i) * 1;
    const rr = 3 + Math.floor(r() * 6);
    shaded(g, Math.round(x), Math.round(y), rr, rr - 1, '#f4f8fc', { rim: '#c8d4e0', light: '#ffffff' });
  }
  for (let i = 0; i < 8; i++) rect(g, 74 + i * 20 + (i % 3) * 3, 156 + (i % 2) * 6, 2, 2, ['#f2c0e0', '#c0e8f8', '#e8f8c0'][i % 3]);
  // Faucet: a chrome gooseneck at the back right.
  rect(g, 226, 118, 6, 32, '#8a96a6');
  rect(g, 227, 118, 3, 32, '#e8eef4');
  for (let a = 0; a <= Math.PI; a += 0.05) rect(g, Math.round(216 + Math.cos(a) * 12), Math.round(118 - Math.sin(a) * 12), 4, 4, '#b8c4d0');
  rect(g, 202, 118, 6, 6, '#8a96a6');
  shaded(g, 238, 144, 4, 3, '#d8e0e8', { rim: '#8a96a6' });
}

function plate(g, x, y, r, dirt) {
  // Round plate tilted towards you: rim with a blue pattern band, the well, shadow on the right.
  const ry = Math.round(r * 0.92);
  blob(g, x + 3, y + 4, r, ry, 'rgba(0,0,0,0.25)');
  blob(g, x, y, r + 1, ry + 1, '#5a6070');
  blob(g, x, y, r, ry, '#f4f2ec');
  blob(g, x - 2, y - 2, r - 3, ry - 3, '#fbfaf6');
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    const px = x + Math.cos(a) * (r - 6);
    const py = y + Math.sin(a) * (ry - 6);
    rect(g, Math.round(px) - 1, Math.round(py) - 1, 3, 3, '#3b6fb6');
    rect(g, Math.round(x + Math.cos(a + 0.06) * (r - 10)), Math.round(y + Math.sin(a + 0.06) * (ry - 10)), 1, 1, '#7fb4ea');
  }
  blob(g, x, y, Math.round(r * 0.62), Math.round(ry * 0.62), '#e8e4da');
  blob(g, x - 1, y - 1, Math.round(r * 0.58), Math.round(ry * 0.58), '#f2efe6');
  if (dirt <= 0) return;
  // Leftovers: a ketchup smear, egg yolk, crumbs, a greasy ring.
  const k = dirt;
  blob(g, x - 12, y - 4, Math.round(10 * k), Math.round(6 * k), '#b8302a');
  blob(g, x - 14, y - 6, Math.round(6 * k), Math.round(3 * k), '#d84a3a');
  blob(g, x + 10, y - 14, Math.round(8 * k), Math.round(7 * k), '#e8b830');
  blob(g, x + 10, y - 14, Math.round(4 * k), Math.round(3 * k), '#f8d860');
  const r2 = rnd(5);
  for (let i = 0; i < 18 * k; i++) rect(g, x - 20 + r2() * 40, y - 18 + r2() * 36, 2, 1, '#8a6a3a');
  for (let a = 0; a < Math.PI * 1.4; a += 0.1) rect(g, Math.round(x + Math.cos(a) * 20), Math.round(y + Math.sin(a) * 17), 2, 1, 'rgba(160,120,40,0.5)');
}

function sponge(g, x, y, t) {
  rect(g, x - 15, y - 9, 30, 20, '#3a3020');
  rect(g, x - 14, y - 8, 28, 10, '#f2d22e');
  rect(g, x - 14, y - 8, 28, 2, '#fff07a');
  speckle(g, x - 13, y - 6, 26, 7, ['#d4b020'], 22, 3);
  rect(g, x - 14, y + 2, 28, 8, '#2f8a3a');
  speckle(g, x - 14, y + 2, 28, 8, ['#4aaa4a', '#1f6a2a'], 40, 4);
  // Bubbles from the scrubbing.
  for (const [dx, dy, rr] of [[-20, -10, 4], [18, -14, 3], [24, -2, 5], [-24, 6, 3], [6, -18, 2]]) {
    const b = Math.round(Math.sin(t * 3 + dx) * 1);
    blob(g, x + dx, y + dy + b, rr + 1, rr + 1, '#9ab8d0');
    blob(g, x + dx, y + dy + b, rr, rr, '#eaf6ff');
    rect(g, x + dx - 1, y + dy + b - Math.ceil(rr / 2), 1, 1, '#ffffff');
  }
}

function rack(g) {
  // Drip tray, wire rack, plates standing in their slots seen almost edge-on, a cutlery cup; the free slot is marked.
  rect(g, RACK.x - 80, RACK.y + 6, 160, 8, '#5aa0c8');
  rect(g, RACK.x - 80, RACK.y + 6, 160, 2, '#8ac8e8');
  rect(g, RACK.x - 80, RACK.y + 13, 160, 1, '#3a7a9a');
  rect(g, RACK.x - 76, RACK.y, 152, 3, '#9aa1ad');
  rect(g, RACK.x - 76, RACK.y - 22, 152, 2, '#c8ccd2');
  for (let x = RACK.x - 74; x <= RACK.x + 74; x += 12) {
    rect(g, x, RACK.y - 38, 2, 40, '#c8ccd2');
    rect(g, x + 2, RACK.y - 38, 1, 40, '#7a808a');
  }
  const free = RACK.x - 8;
  for (let x = RACK.x - 68; x <= RACK.x + 64; x += 12) {
    if (Math.abs(x - free) < 6) continue;
    // A plate seen at a slant: a narrow ellipse, its face lit, a blue rim showing on the near edge.
    blob(g, x + 5, RACK.y - 20, 6, 21, '#5a6070');
    blob(g, x + 5, RACK.y - 20, 5, 20, '#f4f2ec');
    blob(g, x + 4, RACK.y - 21, 3, 15, '#fbfaf6');
    for (let yy = -18; yy <= 18; yy += 3) rect(g, x + 9, RACK.y - 20 + yy, 1, 2, '#3b6fb6');
  }
  // Cutlery cup.
  rect(g, RACK.x + 82, RACK.y - 18, 16, 24, '#5aa0c8');
  rect(g, RACK.x + 82, RACK.y - 18, 16, 2, '#8ac8e8');
  for (const [dx, h] of [[3, 16], [7, 20], [11, 14]]) rect(g, RACK.x + 82 + dx, RACK.y - 18 - h, 2, h, '#c8ccd2');
  // The free slot: a green arrow over it.
  for (let k = 0; k < 6; k++) rect(g, free + 3 - (5 - k), RACK.y - 58 + k, (5 - k) * 2 + 1, 1, '#5fd068');
  rect(g, free + 1, RACK.y - 66, 5, 8, '#5fd068');
  blob(g, free + 3, RACK.y - 20, 4, 20, 'rgba(95,208,104,0.25)');
}

function soap(g) {
  rect(g, 262, 120, 16, 38, '#2a7a4a');
  rect(g, 263, 121, 14, 36, '#4ac87a');
  rect(g, 264, 121, 3, 36, '#9af0b8');
  rect(g, 264, 134, 12, 12, '#f4f1e8');
  drawText(g, 'Z', 270, 136, { align: 'center', color: '#2a7a4a' });
  rect(g, 266, 112, 8, 8, '#f4f1e8');
  rect(g, 268, 108, 10, 4, '#f4f1e8');
}

export function dishes(g, t) {
  wall(g);
  counter(g);
  sink(g, t);
  soap(g);
  rack(g);
  plate(g, PLATE.x, PLATE.y, PLATE.r, 0.8);
  sponge(g, PLATE.x + 24, PLATE.y + 24, t);
  header(g, 'Squeaky Clean', 'Plate 3/6 · 2 racked');
  timerBar(g, 40, 60);
  drawText(g, 'Scrub! 3/8', W / 2, H - 24, { align: 'center', color: '#3a2a1a' });
}
