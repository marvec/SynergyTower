// Golden Brown, in-between style: the beach from above (flat sand, a few 2 px grains), the sun with turning rays, a
// striped towel and you lying on it in the pitch figure's flat style (face up with sunglasses, or face down), in trunks
// or a swimsuit; beach things around; the tan meter as a thermometer.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob, cells, rnd } from '../kit.js';

const GOLD = [0.5, 0.92];
const CORP = '#2f8f7f';
const TAN = '#e8b07a'; // a golden tan

function sand(g, t) {
  rect(g, 0, 18, W, H - 18, '#ecd9a0');
  const r = rnd(5);
  for (let i = 0; i < 70; i++) rect(g, Math.floor((r() * W) / 2) * 2, 20 + Math.floor((r() * (H - 22)) / 2) * 2, 2, 2, i % 3 ? '#d9c283' : '#f6e8b8');
  // Footprints, a shell.
  for (let i = 0; i < 5; i++) cblob(g, 120 + i * 18, 220 + (i % 2) * 8, 4, 6, '#d9c283');
  cblob(g, 360, 226, 6, 4, '#f4e8e0');
  const sx = 410;
  const sy = 50;
  for (let k = 0; k < 8; k++) {
    const a = t * 0.6 + (k * Math.PI) / 4;
    rect(g, Math.round((sx + Math.cos(a) * 28) / 2) * 2 - 2, Math.round((sy + Math.sin(a) * 28) / 2) * 2 - 2, 4, 4, '#f29c38');
  }
  cblob(g, sx, sy, 16, 16, '#f29c38');
  cblob(g, sx, sy, 14, 14, '#f2e14e');
}

function towel(g) {
  rect(g, 150, 108, 184, 74, '#24877e');
  for (let x = 152; x < 332; x += 16) rect(g, x, 110, 8, 70, '#5fd0c8');
  for (let x = 152; x < 332; x += 4) rect(g, x, 180, 2, 4, '#5fd0c8'), rect(g, x, 106, 2, 4, '#5fd0c8');
}

// You, from above, head to the left: 3 px cells.
function you(g, back, skirt) {
  const r = cells(g, 160, 112, 3);
  const skin = TAN;
  // Arms along the body, legs to the right.
  r(14, 2, 14, 2, skin);
  r(14, 18, 14, 2, skin);
  r(12, 4, 20, 14, skin); // torso
  r(32, 6, 22, 4, skin); // legs
  r(32, 12, 22, 4, skin);
  r(54, 5, 3, 5, '#d4986a'); // feet
  r(54, 12, 3, 5, '#d4986a');
  if (skirt) {
    r(16, 5, 16, 12, CORP);
    r(14, 4, 2, 2, CORP);
  } else r(26, 4, 6, 14, CORP); // trunks
  // Head (8 cells), hair, face up (sunglasses, a smile) or face down (all hair).
  r(3, 5, 9, 10, skin);
  r(12, 9, 1, 2, skin);
  if (back) r(3, 5, 9, 10, '#5a3620');
  else {
    r(3, 5, 3, 10, '#5a3620');
    r(7, 6, 2, 3, '#1a1a22');
    r(7, 11, 2, 3, '#1a1a22');
    r(7, 9, 1, 2, '#1a1a22');
    r(10, 9, 1, 2, '#a04a3a');
  }
  if (skirt) r(0, 4, 4, 12, '#5a3620');
}

function props(g) {
  // Flip-flops, sunscreen, a book, a drink.
  for (const [x, c] of [[360, '#e2504a'], [372, '#e2504a']]) {
    cblob(g, x, 150, 5, 10, c);
    rect(g, x - 1, 142, 2, 6, '#ffffff');
  }
  rect(g, 352, 112, 12, 22, '#f29c38');
  rect(g, 354, 108, 8, 4, '#ffffff');
  rect(g, 354, 118, 8, 6, '#ffffff');
  rect(g, 112, 124, 26, 20, '#3b6fb6');
  rect(g, 114, 126, 22, 16, '#f4f1e8');
  rect(g, 124, 126, 2, 16, '#c8c4bc');
  cblob(g, 126, 168, 8, 8, '#c8ccd4');
  cblob(g, 126, 168, 6, 6, '#f2c14e');
  rect(g, 128, 156, 2, 12, '#e2504a');
}

function meter(g, tan) {
  const mx = 60;
  const my = 70;
  const mh = 140;
  rect(g, mx - 3, my - 3, 22, mh + 6, '#5a3a22');
  rect(g, mx, my, 16, mh, '#f6e0c8');
  rect(g, mx, my + mh * (1 - GOLD[1]), 16, mh * (GOLD[1] - GOLD[0]), '#f2c14e');
  rect(g, mx, my, 16, mh * (1 - GOLD[1]), '#e2504a');
  rect(g, mx, my, 4, mh, 'rgba(255,255,255,0.35)');
  cblob(g, mx + 8, my + mh + 8, 12, 12, '#5a3a22');
  cblob(g, mx + 8, my + mh + 8, 10, 10, '#f6e0c8');
  const ty = my + mh * (1 - tan);
  rect(g, mx - 6, ty - 2, 28, 4, '#1a1a22');
  drawText(g, 'TAN', mx + 8, my - 14, { align: 'center', color: '#5a3a22' });
}

export function sunbathe(g, t, skirt) {
  sand(g, t);
  towel(g);
  you(g, false, skirt);
  props(g);
  meter(g, 0.72);
  drawText(g, 'Front in the sun', W / 2, 200, { align: 'center', color: '#5a3a22' });
  drawText(g, 'Turn over while the tan is golden', W / 2, 24, { align: 'center', color: '#5a3a22' });
  header(g, 'Golden Brown', 'Golden 2/4');
  timerBar(g, 22, 40);
}
