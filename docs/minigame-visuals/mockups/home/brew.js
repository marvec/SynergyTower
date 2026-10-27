// Home Brew, in-between style: Squeaky Clean's kitchen (subway tiles, worktop, cabinets) with a shelf, a hand grinder
// (wooden box, crank, a glass drawer filling with grounds), a gooseneck kettle on its base letting off steam, three
// mugs with the fill line, and the step's gauge as before.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob } from '../kit.js';
import { subway, counter, plant } from './common.js';

const POUR_OK = [0.78, 0.92];

function shelf(g) {
  rect(g, 300, 104, 160, 4, '#8a6038');
  rect(g, 300, 108, 160, 2, '#5a3a20');
  // A coffee bag, a canister, a jar of sugar, a plant.
  rect(g, 310, 78, 24, 26, '#6a4a2a');
  rect(g, 310, 78, 24, 4, '#8a6a3a');
  rect(g, 314, 88, 16, 8, '#f2c14e');
  rect(g, 346, 84, 20, 20, '#c8ccd2');
  rect(g, 344, 82, 24, 4, '#9aa1ad');
  rect(g, 378, 86, 18, 18, '#ffffff');
  rect(g, 376, 82, 22, 4, '#e2504a');
  plant(g, 432, 104, 1);
}

function grinder(g, grind) {
  // Wooden box with a dark top plate, a crank handle, a little glass drawer showing the grounds.
  rect(g, 58, 110, 54, 72, '#3a2414');
  rect(g, 60, 112, 50, 68, '#8a5a32');
  rect(g, 60, 112, 50, 4, '#a87448');
  rect(g, 104, 112, 6, 68, '#6e4529');
  rect(g, 56, 104, 58, 8, '#3a3d48');
  rect(g, 56, 104, 58, 2, '#5a5e6a');
  rect(g, 82, 92, 6, 12, '#9aa1ad');
  rect(g, 84, 88, 26, 4, '#9aa1ad');
  cblob(g, 110, 84, 5, 5, '#3a2414');
  // Beans waiting in the hopper top.
  for (const [x, y] of [[66, 100], [72, 98], [96, 100], [102, 98]]) rect(g, x, y, 4, 4, '#4a2a14');
  rect(g, 66, 150, 38, 24, '#c8dce8');
  rect(g, 68, 152, 34, 20, '#e8f4f8');
  const lvl = Math.round((grind / 14) * 18);
  rect(g, 68, 172 - lvl, 34, lvl, '#5a3a22');
  rect(g, 82, 160, 8, 2, '#c8a040');
  drawText(g, 'GRIND', 85, 202, { align: 'center', color: '#3a2a1a' });
}

function kettle(g, steam, t) {
  // A gooseneck kettle on its base: a round body, a lid knob, a handle, the thin spout curving out.
  rect(g, 146, 172, 68, 8, '#2a2d38');
  rect(g, 146, 172, 68, 2, '#4a4e5a');
  rect(g, 196, 174, 6, 2, '#e2504a');
  cblob(g, 180, 148, 28, 24, '#6a707c');
  cblob(g, 180, 148, 26, 22, '#d8dee6');
  cblob(g, 172, 142, 10, 12, '#f4f8fc');
  rect(g, 160, 124, 40, 4, '#9aa1ad');
  rect(g, 176, 118, 8, 6, '#1a1a22');
  rect(g, 148, 132, 6, 30, '#1a1a22');
  rect(g, 148, 132, 14, 4, '#1a1a22');
  rect(g, 148, 158, 14, 4, '#1a1a22');
  for (let k = 0; k < 14; k++) {
    const x = 206 + k * 2;
    const y = 160 - Math.round(Math.sin((k / 14) * 2.2) * 28);
    rect(g, x, y, 4, 4, '#9aa1ad');
    rect(g, x, y, 4, 2, '#d8dee6');
  }
  if (steam)
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.9 + k / 3) % 1;
      g.save();
      g.globalAlpha = 0.8 * (1 - p);
      cblob(g, 234 + Math.round(Math.sin(p * 6 + k) * 4), 126 - p * 30, 4 + Math.round(p * 4), 4, '#ffffff');
      g.restore();
    }
  drawText(g, 'KETTLE', 180, 202, { align: 'center', color: '#3a2a1a' });
}

function mug(g, x, fill, col) {
  // A mug with a rim, a handle, the coffee level, the red fill line.
  rect(g, x - 2, 140, 38, 42, '#3a3d48');
  rect(g, x, 142, 34, 38, col);
  rect(g, x, 142, 4, 38, '#ffffff');
  rect(g, x + 34, 150, 10, 18, '#3a3d48');
  rect(g, x + 36, 154, 4, 10, '#dcdbd2');
  rect(g, x + 4, 142, 28, 6, '#3a2414');
  const h = Math.round(fill * 30);
  if (h) rect(g, x + 4, 178 - h, 28, h, '#6b4a32');
  if (h) rect(g, x + 4, 178 - h, 28, 2, '#a07448');
  rect(g, x + 4, 178 - Math.round(((POUR_OK[0] + POUR_OK[1]) / 2) * 30), 28, 2, '#e2504a');
}

export function brewMock(g, t) {
  subway(g, 0, 18, W, 164);
  shelf(g);
  counter(g, 180);
  grinder(g, 14);
  kettle(g, true, t);
  mug(g, 266, 0.85, '#f4f1e8');
  mug(g, 318, 0.55, '#7fb4ea');
  mug(g, 370, 0, '#f2c14e');
  // The gauge for the step at hand, on a little panel over the cabinets.
  const gx = 120;
  const gy = 222;
  const gw = 240;
  rect(g, gx - 6, gy - 6, gw + 12, 22, 'rgba(40,24,12,0.55)');
  rect(g, gx - 2, gy - 2, gw + 4, 14, '#1a1a22');
  rect(g, gx, gy, gw, 10, '#f4f6f8');
  rect(g, gx + gw * POUR_OK[0], gy, gw * (POUR_OK[1] - POUR_OK[0]), 10, '#5fd068');
  rect(g, gx + gw * 0.62 - 2, gy - 4, 4, 18, '#e2504a');
  rect(g, 150, 36, 180, 18, '#c8b880');
  rect(g, 150, 36, 180, 16, '#fff4c0');
  drawText(g, 'Pour cup 2: stop at the line', W / 2, 41, { align: 'center', color: '#3a2a1a' });
  header(g, 'Home Brew', '3/5 steps right');
  timerBar(g, 26, 40);
}
