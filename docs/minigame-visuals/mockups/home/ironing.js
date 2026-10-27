// Pressing Matters, in-between style: the ironing board seen from above (tapered nose, patterned cover), a shirt laid
// flat with collar, sleeves, placket, buttons and a pocket; creases as wrinkle lines; an iron with a pointed soleplate
// and steam. The floor is the flat's wooden floor.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob } from '../kit.js';

const SHIRT = { x: 120, y: 50, w: 240, h: 170 };

function floor(g) {
  for (let y = 18, i = 0; y < H; y += 12, i++) {
    rect(g, 0, y, W, 12, i % 2 ? '#c09060' : '#b88858');
    rect(g, 0, y + 10, W, 2, '#a07448');
    for (let x = (i * 46) % 90; x < W; x += 90) rect(g, x, y, 2, 10, '#a07448');
  }
}

function board(g) {
  // From above: straight long edges, a pointed nose at the left, a square end with rounded corners at the right.
  const cy = 135;
  const half = 96;
  for (let x = 60; x < 420; x += 2) {
    const nose = x < 160 ? Math.sqrt((x - 60) / 100) : 1;
    const end = x > 410 ? 0.9 : 1;
    const hh = Math.round((half * nose * end) / 2) * 2;
    if (hh <= 0) continue;
    rect(g, x, cy - hh - 2, 2, hh * 2 + 4, '#5a8ab0');
    rect(g, x, cy - hh, 2, hh * 2, '#9fd3f0');
  }
  for (let y = cy - half + 8; y < cy + half - 6; y += 12) for (let x = 160 + ((y / 12) % 2) * 6; x < 404; x += 12) rect(g, x, y, 2, 2, '#c8e8f8');
}

function shirt(g) {
  // Sleeves out at the shoulders, the body below; the collar and placket down the middle.
  const W0 = '#f4f6f8';
  const SH = '#d8dce4';
  const cx = SHIRT.x + SHIRT.w / 2;
  rect(g, SHIRT.x, SHIRT.y + 8, 52, 60, W0);
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 8, 52, 60, W0);
  rect(g, SHIRT.x, SHIRT.y + 60, 52, 8, SH); // cuffs
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 60, 52, 8, SH);
  rect(g, SHIRT.x + 46, SHIRT.y + 4, SHIRT.w - 92, SHIRT.h - 4, W0);
  rect(g, SHIRT.x + 46, SHIRT.y + SHIRT.h - 4, SHIRT.w - 92, 4, SH);
  rect(g, SHIRT.x + 50, SHIRT.y + 8, 2, 60, SH); // the sleeve seams
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 8, 2, 60, SH);
  // Collar wings and the placket with its buttons, a breast pocket.
  for (let k = 0; k < 12; k += 2) {
    rect(g, cx - 22 + k, SHIRT.y + k, 20 - k, 2, '#ffffff');
    rect(g, cx + 2, SHIRT.y + k, 20 - k, 2, '#ffffff');
  }
  rect(g, cx - 22, SHIRT.y + 12, 44, 2, SH);
  rect(g, cx - 4, SHIRT.y + 14, 8, SHIRT.h - 14, '#eceef2');
  rect(g, cx - 4, SHIRT.y + 14, 2, SHIRT.h - 14, SH);
  for (let y = SHIRT.y + 24; y < SHIRT.y + SHIRT.h - 6; y += 24) rect(g, cx - 2, y, 4, 4, '#b8bcc8');
  rect(g, cx + 30, SHIRT.y + 34, 24, 26, SH);
  rect(g, cx + 32, SHIRT.y + 34, 20, 24, W0);
  rect(g, cx + 32, SHIRT.y + 38, 20, 2, SH);
}

function crease(g, x, y, len, a) {
  g.save();
  g.globalAlpha = a;
  for (let i = 0; i < len; i += 2) {
    const dy = [0, 2, 2, 0, -2, -2][(i / 2) % 6];
    rect(g, x - len / 2 + i, y + dy, 2, 2, '#9aa0ac');
    rect(g, x - len / 2 + i, y + dy + 2, 2, 2, '#ffffff');
  }
  g.restore();
}

function iron(g, x, y, t) {
  // From above: a pointed nose (left), a rounded heel, the blue body, a black handle, the soleplate's warm rim.
  for (let k = 0; k < 16; k += 2) {
    const w = 18 + Math.round(Math.min(k, 16 - k) * 0.4) + k;
    rect(g, x - 18 + (16 - k) * 0.6, y - 12 + k, w + 12, 2, '#1a1a22');
  }
  for (let k = 2; k < 14; k += 2) {
    const w = 14 + k;
    rect(g, x - 14 + (14 - k) * 0.6, y - 12 + k, w + 12, 2, '#f29c38');
    rect(g, x - 12 + (14 - k) * 0.6, y - 12 + k, w + 6, 2, '#2a6ad1');
  }
  rect(g, x - 6, y - 8, 22, 4, '#3a7ad1');
  rect(g, x - 2, y - 4, 18, 4, '#1a1a22');
  rect(g, x, y - 2, 14, 2, '#3a3d48');
  // Steam puffs drifting off the nose.
  for (let k = 0; k < 3; k++) {
    const p = (t * 1.2 + k / 3) % 1;
    g.save();
    g.globalAlpha = 0.7 * (1 - p);
    cblob(g, x - 22 - p * 14, y - 10 - p * 20 + k * 4, 4 + Math.round(p * 4), 4 + Math.round(p * 3), '#ffffff');
    g.restore();
  }
  // The cord leaves the top of the handle at the heel and loops up and away.
  rect(g, x + 14, y - 8, 4, 2, '#1a1a22');
  for (let k = 0; k < 44; k += 2) rect(g, x + 18 + k, y - 10 - Math.round(k * 0.5 + Math.sin(k * 0.18) * 3), 2, 2, '#1a1a22');
}

export function ironingMock(g, t) {
  rect(g, 0, 18, W, H - 18, '#e8dcc8');
  floor(g);
  board(g);
  shirt(g);
  for (const [x, y, len, a] of [[180, 120, 26, 1], [290, 92, 22, 1], [222, 168, 30, 0.6], [150, 70, 20, 1], [312, 196, 24, 1], [262, 140, 22, 0.3]]) crease(g, x, y, len, a);
  iron(g, 214, 196, t);
  rect(g, 0, H - 26, W, 12, 'rgba(60,40,24,0.55)');
  drawText(g, '4/10 creases', W / 2, H - 24, { align: 'center', color: '#f4f1e8' });
  header(g, 'Pressing Matters', 'No scorch marks');
  timerBar(g, 24, 40);
}
