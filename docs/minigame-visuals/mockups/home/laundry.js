// Separate Cycles, in-between style: a utility room (tiles, a shelf with powder and softener), three front-loading
// washing machines with round glass doors and their cycle on the panel, a wicker basket, a hoodie that reads as one.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob, shade } from '../kit.js';
import { subway } from './common.js';

const BINS = [
  { label: 'WHITES', temp: '60C', key: '1', drum: '#f4f6f8', x: 70 },
  { label: 'COLOURS', temp: '40C', key: '2', drum: '#f29c38', x: 190 },
  { label: 'DELICATES', temp: '30C', key: '3', drum: '#c8a8e8', x: 310 },
];
const BIN_W = 100;
const BIN_Y = 180;

function machine(g, b, sorted, t) {
  const x = b.x;
  const y = BIN_Y;
  rect(g, x, y, BIN_W, 82, '#5a6070');
  rect(g, x + 2, y + 2, BIN_W - 4, 80, '#f4f6f8');
  rect(g, x + 2, y + 2, BIN_W - 4, 2, '#ffffff');
  rect(g, x + BIN_W - 6, y + 4, 4, 78, '#d8dce4');
  // Control panel: the label, a dial, a little display with the temperature.
  rect(g, x + 2, y + 4, BIN_W - 4, 14, '#e2e6ec');
  drawText(g, `${b.key} ${b.label}`, x + 6, y + 6, { color: '#1a1a22' });
  cblob(g, x + 88, y + 11, 4, 4, '#9aa1ad');
  rect(g, x + 87, y + 7, 2, 4, '#3a3d48');
  // The round door: a chrome ring, dark glass, the drum's load tumbling in its colour.
  const cx = x + 48;
  const cy = y + 48;
  cblob(g, cx, cy, 24, 24, '#9aa1ad');
  cblob(g, cx, cy, 20, 20, '#c8ccd2');
  cblob(g, cx, cy, 16, 16, '#3a4a5a');
  cblob(g, cx, cy, 14, 14, '#5a7a98');
  const fill = Math.min(10, 2 + sorted * 2);
  for (let k = 0; k < fill; k += 2) cblob(g, cx - 8 + ((k * 7 + Math.round(t * 8)) % 16), cy + 8 - (k % 4), 4, 3, b.drum);
  rect(g, cx - 8, cy - 10, 6, 2, '#8ab0d0');
  rect(g, cx + 20, cy - 4, 4, 8, '#9aa1ad');
  rect(g, x + 4, y + 76, BIN_W - 8, 4, '#c8ccd2');
  drawText(g, b.temp, x + 6, y + 64, { color: '#3a3d48' });
}

function hoodie(g, x, y, col) {
  // A hoodie: hood, body with a kangaroo pocket, sleeves, cuffs, drawstrings, the care label on the hem.
  const d = shade(col, -0.3);
  const l = shade(col, 0.2);
  rect(g, x - 16, y - 8, 32, 26, col);
  rect(g, x - 28, y - 6, 12, 18, col);
  rect(g, x + 16, y - 6, 12, 18, col);
  rect(g, x - 28, y + 12, 12, 4, d);
  rect(g, x + 16, y + 12, 12, 4, d);
  rect(g, x - 16, y + 16, 32, 4, d);
  cblob(g, x, y - 12, 10, 6, col);
  cblob(g, x, y - 10, 6, 4, d);
  rect(g, x - 14, y - 8, 4, 22, l);
  rect(g, x - 10, y + 4, 20, 8, d);
  rect(g, x - 4, y - 4, 2, 8, '#f4f1e8');
  rect(g, x + 2, y - 4, 2, 8, '#f4f1e8');
  rect(g, x - 6, y + 16, 12, 6, '#ffffff');
}

function basket(g) {
  // A wicker basket with a sock hanging over its rim.
  rect(g, 398, 30, 68, 34, '#6a4a22');
  for (let yy = 32; yy < 62; yy += 4) for (let xx = 400 + ((yy / 4) % 2) * 4; xx < 464; xx += 8) rect(g, xx, yy, 4, 2, '#b98a5a');
  rect(g, 396, 26, 72, 6, '#8a6a3a');
  rect(g, 396, 26, 72, 2, '#c8a070');
  rect(g, 410, 22, 20, 6, '#f4f6f8');
  rect(g, 420, 22, 8, 16, '#e2504a');
  rect(g, 420, 34, 12, 6, '#e2504a');
}

export function laundryMock(g, t) {
  subway(g, 0, 18, W, 160, '#e4ecf0', '#b8c8d2');
  // A shelf: washing powder, softener, a folded towel stack.
  rect(g, 20, 64, 150, 4, '#8a6038');
  rect(g, 20, 68, 150, 2, '#5a3a20');
  rect(g, 30, 40, 22, 24, '#f2c14e');
  rect(g, 30, 46, 22, 8, '#e2504a');
  rect(g, 60, 44, 16, 20, '#7ab0e8');
  rect(g, 64, 38, 8, 6, '#3b6fb6');
  for (let k = 0; k < 3; k++) rect(g, 90, 56 - k * 6, 40, 6, ['#f29cd0', '#ffffff', '#5fd068'][k]);
  // Floor.
  rect(g, 0, 178, W, H - 178, '#9aa8b4');
  for (let x = 0; x < W; x += 40) rect(g, x, 178, 2, H - 178, '#8a98a4');
  rect(g, 0, 178, W, 2, '#c8d4dc');
  for (const [i, b] of BINS.entries()) machine(g, b, [3, 2, 1][i], t);
  basket(g);
  drawText(g, 'Green hoodie', 240, 72, { align: 'center', color: '#1a1a22' });
  hoodie(g, 240, 104, '#2f8a3a');
  header(g, 'Separate Cycles', '5/14 sorted · 6/14');
  timerBar(g, 40, 60);
}
