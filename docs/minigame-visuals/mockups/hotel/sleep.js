// Counting Sheep, in-between style: a moonlit meadow in flat bands, a proper wooden fence, woolly 2 px sheep, and you
// asleep in bed in the corner (your hair: short with trousers, long with a skirt).
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { bands, cblob, cells } from '../kit.js';

const FENCE_X = W / 2;
const GROUND = 214;
const JUMP = 70;

function sky(g, t) {
  bands(g, 0, 18, W, GROUND - 18, ['#0e1430', '#141a3a', '#1a2248', '#222c56']);
  const stars = [[30, 40], [80, 70], [120, 44], [170, 96], [210, 50], [300, 84], [350, 110], [440, 40], [460, 90], [20, 120], [150, 130], [420, 130], [330, 52]];
  stars.forEach(([x, y], i) => rect(g, x, y, 2, 2, Math.sin(t * 2 + i) > -0.4 ? '#e8eaff' : '#8a96c0'));
  cblob(g, 392, 50, 14, 14, '#f6e8b8');
  cblob(g, 400, 46, 12, 12, '#141a3a');
  // Hills, then the meadow.
  cblob(g, 90, GROUND, 120, 30, '#1e3a32');
  cblob(g, 380, GROUND, 150, 40, '#1a3430');
  rect(g, 0, GROUND, W, H - GROUND, '#2f6b3a');
  rect(g, 0, GROUND, W, 2, '#3f8a4a');
  for (let x = 4; x < W; x += 22) rect(g, x, GROUND + 6 + (x % 3) * 8, 2, 4, '#3f8a4a'), rect(g, x + 2, GROUND + 4 + (x % 3) * 8, 2, 2, '#3f8a4a');
}

function fence(g) {
  for (const dx of [-24, 0, 24]) {
    rect(g, FENCE_X + dx - 3, GROUND - 30, 6, 30, '#8a6a3a');
    rect(g, FENCE_X + dx - 1, GROUND - 32, 2, 2, '#8a6a3a');
    rect(g, FENCE_X + dx - 3, GROUND - 30, 2, 30, '#a8864c');
  }
  for (const y of [GROUND - 24, GROUND - 12]) {
    rect(g, FENCE_X - 34, y, 68, 4, '#a8864c');
    rect(g, FENCE_X - 34, y + 2, 68, 2, '#7a5a30');
  }
}

function sheep(g, x, y, t, counted) {
  const wool = counted ? '#fff3b8' : '#f4f1e8';
  const shadow = counted ? '#e8d890' : '#c8c4bc';
  const leg = Math.floor(t * 8 + x) % 2 ? 2 : 0;
  for (const lx of [-8, -2, 4, 8]) rect(g, x + lx, y + 8, 2, 6 - (lx % 4 ? leg : 2 - leg), '#1a1a22');
  cblob(g, x, y + 4, 14, 8, shadow);
  for (const [dx, dy] of [[-8, 0], [-2, -2], [4, 0], [-4, 4], [4, 4]]) cblob(g, x + dx, y + dy, 6, 6, wool);
  // Black face, ear, eye.
  rect(g, x + 10, y - 2, 8, 8, '#1a1a22');
  rect(g, x + 8, y - 4, 4, 2, '#1a1a22');
  rect(g, x + 14, y, 2, 2, '#ffffff');
}

function bed(g, t, skirt, zz) {
  const r = cells(g, 10, 214, 2);
  r(0, 0, 4, 22, '#6a4226'); // headboard
  r(0, 0, 4, 1, '#8a5a3a');
  r(4, 12, 44, 8, '#8a5a3a'); // frame
  r(4, 8, 12, 5, '#f4f1e8'); // pillow
  r(14, 7, 34, 6, '#2fa39a'); // blanket
  for (let k = 16; k < 48; k += 6) r(k, 7, 2, 6, '#5fd0c8');
  // Your head on the pillow, eyes shut.
  r(6, 2, 8, 7, '#f2c9a0');
  r(6, 1, 8, 2, '#5a3620');
  if (skirt) r(4, 3, 2, 8, '#5a3620'), r(14, 3, 2, 6, '#5a3620');
  r(8, 5, 2, 1, '#3a2a1a');
  r(11, 5, 2, 1, '#3a2a1a');
  for (let i = 0; i < zz; i++) drawText(g, 'z', 46 + i * 9, 206 - i * 9 - Math.round(Math.sin(t * 2 + i) * 2), { color: '#c8d0ff', scale: i === 2 ? 2 : 1 });
}

export function sleep(g, t, skirt) {
  sky(g, t);
  fence(g);
  for (const [x, counted] of [[120, true], [FENCE_X - 6, false], [360, false]]) {
    const k = Math.max(0, Math.min(1, 1 - Math.abs(x - FENCE_X) / JUMP));
    sheep(g, x, GROUND - 14 - Math.round(Math.sin((k * Math.PI) / 2) * 42), t, counted);
  }
  bed(g, t, skirt, 3);
  header(g, 'Counting Sheep', 'Sheep 6/10');
  timerBar(g, 12, 29);
  drawText(g, 'Count each sheep while it is in the air', W / 2, 24, { align: 'center', color: '#c8d0ff' });
}
