// Just Right, in-between style: a tiled bathroom, a clawfoot tub seen a little from above (rim, enamel side, gold
// feet), foam and a rubber duck on water tinted by its temperature, chrome cross-handle taps with coloured caps and a
// running stream, the thermometer with a bulb.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob, shade } from '../kit.js';
import { squares, plant } from './common.js';

function tap(g, x, col, on, label, t) {
  // A chrome spout from the wall, a cross handle with a coloured cap, the stream when open.
  rect(g, x - 4, 74, 8, 16, '#9aa1ad');
  rect(g, x - 4, 74, 2, 16, '#e8eef4');
  rect(g, x - 12, 70, 24, 4, '#9aa1ad');
  rect(g, x - 12, 70, 24, 2, '#e8eef4');
  rect(g, x - 2, 64, 4, 6, '#9aa1ad');
  cblob(g, x, 64, 4, 4, col);
  rect(g, x - 6, 90, 12, 6, '#9aa1ad');
  rect(g, x - 6, 90, 12, 2, '#e8eef4');
  rect(g, x - 4, 96, 8, 4, '#6a707c');
  if (on)
    for (let k = 0; k < 6; k++) {
      rect(g, x - 2, 100 + k * 4, 4, 4, '#bfe4f2');
      rect(g, x - 2 + ((k + Math.round(t * 8)) % 2) * 2, 100 + k * 4, 2, 2, '#ffffff');
    }
  drawText(g, label, x, 52, { align: 'center', color: col, shadow: '#ffffff' });
}

function tub(g, temp, t) {
  const k = Math.max(0, Math.min(1, (temp - 20) / 25));
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  // Blue water warming towards a soft pink as it heats (today's formula turns grey-brown in the middle).
  const water = `#${hex(90 + 150 * k * 0.7)}${hex(180 - 40 * k)}${hex(228 - 60 * k)}`;
  // Feet first, then the enamel side (rounded ends), then the rim and the water inside it.
  for (const fx of [146, 322]) {
    rect(g, fx, 196, 12, 16, '#c8a040');
    rect(g, fx - 2, 208, 16, 6, '#a88020');
    rect(g, fx, 196, 4, 10, '#f2d870');
  }
  // The enamel side, rounded at the bottom.
  cblob(g, 240, 176, 126, 30, '#9aa4b0');
  rect(g, 114, 130, 252, 46, '#9aa4b0');
  cblob(g, 240, 176, 122, 26, '#f4f6f8');
  rect(g, 118, 130, 244, 46, '#f4f6f8');
  rect(g, 118, 184, 244, 4, '#e2e6ec');
  // The rim seen from a little above: an oval lip around the water.
  cblob(g, 240, 128, 130, 34, '#9aa4b0');
  cblob(g, 240, 128, 126, 30, '#ffffff');
  cblob(g, 240, 130, 114, 22, shade(water, -0.2));
  cblob(g, 240, 132, 112, 20, water);
  rect(g, 160, 120, 60, 2, 'rgba(255,255,255,0.45)');
  rect(g, 250, 126, 40, 2, 'rgba(255,255,255,0.35)');
  // Foam at the ends, bubbles rising.
  for (const [x, y, rx] of [[146, 128, 10], [160, 136, 8], [140, 140, 6], [330, 126, 10], [318, 138, 8], [214, 140, 6]]) {
    cblob(g, x, y, rx, Math.round(rx * 0.6), '#ffffff');
    cblob(g, x - 2, y - 2, Math.max(2, rx - 4), 2, '#eef4fa');
  }
  for (const [x, y] of [[190, 140], [236, 130], [268, 142], [204, 124]]) {
    rect(g, x, y, 4, 4, '#ffffff');
    rect(g, x, y, 2, 2, water);
  }
  // Rubber duck bobbing.
  const dy = Math.round(Math.sin(t * 2)) * 2;
  cblob(g, 280, 130 + dy, 9, 5, '#d8b018');
  cblob(g, 280, 128 + dy, 8, 5, '#f2d22e');
  cblob(g, 288, 120 + dy, 5, 5, '#f2d22e');
  rect(g, 292, 120 + dy, 6, 2, '#f29c38');
  rect(g, 288, 118 + dy, 2, 2, '#1a1a22');
  rect(g, 274, 124 + dy, 6, 2, '#f8e870');
}

function thermometer(g, temp, band) {
  const tx = 420;
  const ty = 60;
  const th = 140;
  const yOf = (v) => ty + th - ((v - 15) / 35) * th;
  rect(g, tx - 2, ty - 2, 20, th + 4, '#3a3d48');
  rect(g, tx, ty, 16, th, '#f4f6f8');
  rect(g, tx, yOf(band[1]), 16, yOf(band[0]) - yOf(band[1]), '#9ae0a0');
  rect(g, tx + 6, yOf(temp), 4, ty + th - yOf(temp) + 6, '#e2504a');
  cblob(g, tx + 8, ty + th + 10, 10, 10, '#3a3d48');
  cblob(g, tx + 8, ty + th + 10, 8, 8, '#e2504a');
  for (let v = 20; v <= 45; v += 5) rect(g, tx, yOf(v), 4, 2, '#9aa1ad');
  drawText(g, `${Math.round(temp)}C`, tx + 8, ty + th + 24, { align: 'center', color: '#1a1a22' });
}

export function bathMock(g, t) {
  squares(g, 0, 18, W, 172, '#d8eef0', '#b0ccd4');
  rect(g, 0, 132, W, 4, '#4a9aa8');
  rect(g, 0, 190, W, H - 190, '#8aa0aa');
  for (let x = 0; x < W; x += 24) rect(g, x, 190, 2, H - 190, '#7a909a');
  // A towel on a rail and a plant on the floor.
  rect(g, 20, 60, 50, 4, '#9aa1ad');
  rect(g, 26, 64, 38, 50, '#e2504a');
  rect(g, 26, 104, 38, 4, '#f4f1e8');
  plant(g, 60, 238, 1.4);
  tub(g, 34, t);
  tap(g, 150, '#2a6ad1', false, 'COLD', t);
  tap(g, 330, '#e2504a', true, 'HOT', t);
  thermometer(g, 34, [33, 38]);
  drawText(g, 'Just right...', 240, 230, { align: 'center', color: '#1f6a2a' });
  header(g, 'Just Right', 'Relaxed 42%');
  timerBar(g, 22, 40);
}
