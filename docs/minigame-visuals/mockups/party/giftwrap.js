// Gift Wrapping, in-between style: the Secret Santa table in the party hall (tablecloth, paper rolls, tape, scissors,
// the tree), a patterned gift with the tape gauge as a strip of tape, the wrapped gifts with bows. Same layout as today.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob } from '../kit.js';
import { hallWall, tree } from './common.js';

function table(g) {
  // Red tablecloth with a white hem over the table top (170), its front falling to the floor.
  rect(g, 0, 196, W, H - 196, '#3a2a22');
  rect(g, 0, 166, W, 8, '#e2504a');
  rect(g, 0, 166, W, 2, '#f06a64');
  rect(g, 0, 174, W, 30, '#c8343a');
  for (let x = 0; x < W; x += 40) rect(g, x + 18, 174, 4, 30, '#b02a30');
  rect(g, 0, 204, W, 4, '#f4f1e8');
  for (let x = 0; x < W; x += 8) rect(g, x, 208, 4, 2, '#f4f1e8');
}

function paperRoll(g, x, y, len, col, alt) {
  rect(g, x, y, len, 12, col);
  for (let k = 4; k < len; k += 10) rect(g, x + k, y + 2, 4, 4, alt);
  rect(g, x, y, len, 2, '#ffffff33');
  rect(g, x, y + 10, len, 2, '#00000033');
  cblob(g, x + len, y + 6, 4, 6, '#c8a878');
  cblob(g, x + len, y + 6, 2, 2, '#8a6a4a');
}

function tools(g) {
  // Paper rolls, a tape dispenser and scissors on the right of the table.
  paperRoll(g, 336, 150, 60, '#2f8a3a', '#f4f1e8');
  paperRoll(g, 348, 138, 52, '#3a5fb6', '#f2e14e');
  rect(g, 404, 152, 26, 14, '#3a3f55');
  rect(g, 404, 152, 26, 2, '#5a607a');
  cblob(g, 414, 152, 8, 8, '#d8dee6');
  cblob(g, 414, 152, 4, 4, '#3a3f55');
  rect(g, 426, 148, 6, 4, '#9aa1ad');
  // Scissors.
  for (let k = 0; k < 14; k += 2) rect(g, 300 + k, 160 - k / 2, 2, 2, '#9aa1ad'), rect(g, 300 + k, 154 + k / 2, 2, 2, '#9aa1ad');
  cblob(g, 296, 152, 4, 4, '#e2504a');
  cblob(g, 296, 162, 4, 4, '#e2504a');
  // A spool of ribbon.
  cblob(g, 318, 160, 8, 6, '#f29cd0');
  cblob(g, 318, 160, 2, 2, '#b06a90');
}

function wrapped(g, x, y, w, h, paper, ribbon, bow) {
  rect(g, x - 2, y - 2, w + 4, h + 2, '#1a1a22');
  rect(g, x, y, w, h, paper);
  for (let yy = y + 4; yy < y + h - 2; yy += 8) for (let xx = x + ((yy / 8) % 2 ? 4 : 0) + 2; xx < x + w - 2; xx += 10) rect(g, xx, yy, 2, 2, '#ffffff66');
  rect(g, x, y, w, 2, '#ffffff44');
  rect(g, x + w / 2 - 2, y, 4, h, ribbon);
  rect(g, x, y + h / 2 - 2, w, 4, ribbon);
  if (bow) {
    cblob(g, x + w / 2 - 6, y - 4, 6, 4, ribbon);
    cblob(g, x + w / 2 + 6, y - 4, 6, 4, ribbon);
    rect(g, x + w / 2 - 2, y - 6, 4, 4, '#1a1a22');
  }
}

function tapeGauge(g, a, b, level) {
  // The gauge as a strip of clear tape on its roll: the green band where the seam sits, the red mark moving along it.
  const gx = 120;
  const gy = 214;
  const gw = 240;
  rect(g, gx - 2, gy - 2, gw + 4, 14, '#1a1a22');
  rect(g, gx, gy, gw, 10, '#e8eef4');
  rect(g, gx, gy, gw, 2, '#ffffff');
  for (let x = gx + 6; x < gx + gw; x += 12) rect(g, x, gy + 4, 4, 2, '#c8d4e0');
  rect(g, gx + gw * a, gy, gw * (b - a), 10, '#5fd068');
  rect(g, gx + gw * a, gy, gw * (b - a), 2, '#9af0a0');
  const mx = Math.round(gx + gw * level);
  rect(g, mx - 2, gy - 4, 4, 18, '#e2504a');
  rect(g, mx - 4, gy - 6, 8, 2, '#e2504a');
  cblob(g, gx - 10, gy + 5, 8, 8, '#9aa1ad');
  cblob(g, gx - 10, gy + 5, 4, 4, '#3a3f55');
}

export function giftwrap(g, t) {
  hallWall(g, t, 18, 170);
  // A window with snow and the tree in the corner.
  rect(g, 28, 46, 70, 60, '#1a1426');
  rect(g, 32, 50, 62, 52, '#2a3a6a');
  for (const [x, y] of [[40, 58], [62, 70], [84, 60], [50, 84], [76, 92], [88, 80]]) rect(g, x, y + (Math.floor(t * 2) % 2) * 2, 2, 2, '#f4f1e8');
  rect(g, 32, 96, 62, 6, '#f4f1e8');
  rect(g, 62, 50, 2, 52, '#1a1426');
  tree(g, 456, 166, 110, t);
  table(g);
  tools(g);
  // Two wrapped gifts on the left; the one on the table in the middle, paper on, about to be taped.
  wrapped(g, 30, 140, 40, 30, '#d8343a', '#f2e14e', true);
  wrapped(g, 76, 144, 36, 26, '#3a5fb6', '#f4f1e8', true);
  const gw = 80;
  const gh = 50;
  const x = W / 2 - gw / 2;
  const y = 168 - gh;
  rect(g, x - 2, y - 2, gw + 4, gh + 2, '#1a1a22');
  rect(g, x, y, gw, gh, '#2f8a3a');
  for (let yy = y + 4; yy < y + gh - 2; yy += 10) for (let xx = x + 4 + ((yy - y) % 20 ? 6 : 0); xx < x + gw - 4; xx += 12) rect(g, xx, yy, 4, 4, '#f4f1e8');
  rect(g, x, y, gw, 2, '#4aa858');
  // The seam where the paper overlaps, waiting for tape.
  rect(g, x + gw / 2 - 1, y, 2, gh, '#1f6a2a');
  rect(g, x + gw / 2 + 1, y, 6, gh, '#3a9a48');
  drawText(g, 'Tape the seam in the green band', W / 2, 44, { align: 'center', color: '#f4f1e8', shadow: '#1a1426' });
  tapeGauge(g, 0.55, 0.68, 0.48 + Math.sin(t) * 0.02);
  drawText(g, 'SPACE at the right moment', W / 2, 256, { align: 'center', color: '#f4e0c8' });
  header(g, 'Gift Wrapping', 'Gift 3/3');
  timerBar(g, 24, 40);
}
