// Swim to the Buoy, in-between style: the hotel beach behind, the jetty in planks, a striped buoy on its float line,
// and you doing the crawl (2 px cells: head, a stroking arm, your back in trunks or a swimsuit, a kick splash).
import { W, H, C, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { bands, cblob, cells } from '../kit.js';
import { palm } from '../poolball.js';

const SEA_Y = 120;
const FAR = W - 70;
const CORP = '#2f8f7f';

function scenery(g, t) {
  bands(g, 0, 18, W, SEA_Y - 40 - 18, ['#6ab8ea', '#8fd0f0', '#b4e2f6']);
  cblob(g, 300, 46, 12, 12, '#fff2b0');
  rect(g, 60, 34, 34, 6, '#ffffff');
  rect(g, 66, 30, 18, 4, '#ffffff');
  // The beach and the hotel far behind.
  // The hotel beach far behind, then open sea up to the swimming line.
  rect(g, 0, SEA_Y - 40, W, 40, '#bfe6f8');
  rect(g, 140, SEA_Y - 58, 100, 22, '#e8d6b4');
  for (let x = 146; x < 234; x += 12) for (const y of [SEA_Y - 54, SEA_Y - 46]) rect(g, x, y, 6, 4, '#5a8aaa');
  rect(g, 136, SEA_Y - 60, 108, 4, '#c8b088');
  rect(g, 0, SEA_Y - 38, W, 6, '#ecd9a0');
  palm(g, 262, SEA_Y - 36, 36, 0.3, t);
  palm(g, 112, SEA_Y - 36, 30, -0.3, t + 1);
  bands(g, 0, SEA_Y - 32, W, H - SEA_Y + 32, ['#5ab0e0', '#3a9ad4', '#2f8cc8', '#2a80bc', '#257ab8', '#206ea8']);
  for (let i = 0; i < 24; i++) {
    const x = ((i * 47 + t * 18) % (W + 30)) - 15;
    rect(g, x, SEA_Y - 24 + (i % 8) * 18, 10, 2, '#8fd4f4');
  }
}

function jetty(g) {
  rect(g, 0, SEA_Y - 16, 56, 8, '#b98a5a');
  for (let x = 0; x < 56; x += 8) rect(g, x, SEA_Y - 16, 2, 8, '#8f6640');
  rect(g, 0, SEA_Y - 16, 56, 2, '#d8a870');
  for (const x of [6, 44]) rect(g, x, SEA_Y - 8, 6, 54, '#8f6640'), rect(g, x, SEA_Y - 8, 2, 54, '#a87850');
  // A ladder into the water.
  for (const x of [26, 36]) rect(g, x, SEA_Y - 8, 2, 20, '#c8ccd2');
  for (let k = 0; k < 3; k++) rect(g, 26, SEA_Y - 4 + k * 6, 12, 2, '#c8ccd2');
}

function buoy(g, t) {
  const bob = Math.round(Math.sin(t * 2.4) * 2);
  const x = FAR + 24;
  const y = SEA_Y - 4 + bob;
  // Float line.
  for (let k = 0; k < 6; k++) rect(g, x + 12 + k * 8, SEA_Y + 2, 4, 2, k % 2 ? '#f2c14e' : '#e2504a');
  cblob(g, x, y, 12, 10, '#a8302a');
  cblob(g, x - 2, y - 2, 10, 8, '#e2504a');
  rect(g, x - 10, y - 2, 20, 4, '#ffffff');
  rect(g, x - 1, y - 22, 2, 14, '#3a3d48');
  rect(g, x + 1, y - 22, 8, 6, '#f2c14e');
  rect(g, x - 14, SEA_Y + 2, 28, 2, '#e8f8ff');
}

function swimmer(g, x, t, skirt) {
  const y = SEA_Y - 4;
  const r = cells(g, x - 24, y - 9, 3);
  const stroke = Math.floor(t * 3) % 2;
  // Your back and legs just under the surface (tinted), then the head and an arm out of the water.
  g.save();
  g.globalAlpha = 0.6;
  r(0, 4, 3, 2, '#f2c9a0');
  r(-2, 4, 2, 2, '#e8f8ff'); // the kick
  r(3, 3, 6, 4, skirt ? CORP : '#f2c9a0');
  r(5, 3, 3, 4, skirt ? CORP : '#1f6a5e');
  r(9, 3, 6, 4, skirt ? CORP : '#f2c9a0');
  g.restore();
  // Head (facing right), a swim cap colour of hair, one goggle.
  r(14, 0, 6, 6, '#f2c9a0');
  r(14, 0, 6, 2, '#5a3620');
  r(14, 2, 2, 2, '#5a3620');
  if (skirt) r(12, 1, 2, 3, '#5a3620');
  r(18, 2, 2, 1, '#1a1a22');
  r(19, 4, 1, 1, '#7a3b3b');
  // The stroking arm: up and over, or reaching ahead.
  if (stroke) {
    r(11, -5, 2, 6, '#f2c9a0');
    r(12, -7, 4, 2, '#f2c9a0');
  } else r(20, 3, 7, 2, '#f2c9a0');
  // Splashes.
  for (const [dx, dy] of [[-30, 2], [38, -2], [44, -6]]) rect(g, x + dx, y + dy, 2, 2, '#e8f8ff');
  rect(g, x - 30, y + 10, 76, 2, '#e8f8ff');
}

export function swim(g, t, skirt) {
  scenery(g, t);
  jetty(g);
  buoy(g, t);
  swimmer(g, 230, t, skirt);
  const bw = 200;
  rect(g, W / 2 - bw / 2 - 2, 234, bw + 4, 12, '#0f2a44');
  rect(g, W / 2 - bw / 2, 236, bw, 8, '#1a3a5a');
  rect(g, W / 2 - bw / 2, 236, Math.round(bw * 0.35), 8, C.good);
  rect(g, W / 2 - bw / 2, 236, Math.round(bw * 0.35), 2, '#9af0a0');
  rect(g, W / 2, 232, 2, 16, '#ffffff');
  drawText(g, 'Out to the buoy!', W / 2, 250, { align: 'center', color: '#ffffff', shadow: '#0f2a44' });
  header(g, 'Swim to the Buoy', '35%');
  timerBar(g, 18, 30);
}
