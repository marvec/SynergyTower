// Photo Booth, in-between style: inside the booth (velvet curtains, a festive backdrop in the live view), you as the
// pitch figure in a Santa hat striking the pose, the pose card with its figure, the strip of busts printing out.
import { W, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { figure, playerLook } from './common.js';

const POSES = ['Wave left', 'Crouch', 'Hands up', 'Wave right'];
const PAD = { y: 228, w: 96, h: 26, x0: 36, gap: 8 };
const padX = (i) => PAD.x0 + i * (PAD.w + PAD.gap);

function curtain(g, x, w) {
  for (let k = 0; k < w; k += 8) {
    rect(g, x + k, 18, 8, 252, '#8a1a2a');
    rect(g, x + k, 18, 4, 252, '#a8283a');
    rect(g, x + k + 6, 18, 2, 252, '#6a1020');
  }
}

function backdrop(g, t) {
  // The live view: a winter backdrop, snowflakes, a banner; camera corners.
  rect(g, 126, 36, 228, 168, '#c8e0f0');
  rect(g, 126, 150, 228, 54, '#f4f8fc');
  for (const [x, y] of [[146, 80], [180, 60], [310, 66], [336, 104], [160, 124], [300, 130], [210, 100], [276, 92]]) {
    rect(g, x - 4, y, 10, 2, '#ffffff');
    rect(g, x, y - 4, 2, 10, '#ffffff');
    rect(g, x - 2, y - 2, 2, 2, '#e8f4fc');
    rect(g, x + 2, y + 2, 2, 2, '#e8f4fc');
  }
  rect(g, 150, 40, 180, 14, '#2f8a3a');
  rect(g, 150, 52, 180, 2, '#1f6a2a');
  drawText(g, "SEASON'S GREETINGS", W / 2, 43, { align: 'center', color: '#f4f1e8' });
  for (const [x, y, dx, dy] of [[130, 40, 1, 1], [350, 40, -1, 1], [130, 200, 1, -1], [350, 200, -1, -1]]) {
    rect(g, x - (dx < 0 ? 10 : 0), y - (dy < 0 ? 2 : 0), 10, 2, '#ffffff');
    rect(g, x - (dx < 0 ? 2 : 0), y - (dy < 0 ? 10 : 0), 2, 10, '#ffffff');
  }
  if (Math.floor(t * 2) % 2) {
    rect(g, 338, 186, 6, 6, '#e2504a');
  }
}

function photo(g, x, y, look, pose, ok) {
  rect(g, x - 2, y - 2, 44, 44, '#1a1a22');
  rect(g, x, y, 40, 40, ok ? '#c8e0f0' : '#8a8a8a');
  g.save();
  g.beginPath();
  g.rect(x, y, 40, 40);
  g.clip();
  figure(g, x + 8, y + 12, 2, ok ? look : { ...look, top: '#9a9a9a', skin: '#b8b8b8', hair: '#5a5a5a', tie: '#7a7a7a' }, pose);
  g.restore();
}

export function photobooth(g, t, skirt) {
  const look = playerLook(skirt);
  rect(g, 0, 0, W, 270, '#2a1a2e');
  curtain(g, 0, 16);
  curtain(g, 464, 16);
  // The frame (red, a light trim), the live view inside.
  rect(g, 118, 28, 244, 184, '#1a1a22');
  rect(g, 120, 30, 240, 180, '#d8343a');
  rect(g, 120, 30, 240, 2, '#f06a64');
  backdrop(g, t);
  figure(g, W / 2 - 18, 190 - 90, 3, look, 'waveR');
  drawText(g, '2', W / 2, 62, { align: 'center', scale: 2, color: '#d8343a' });
  // The pose card.
  rect(g, 16, 42, 96, 100, '#1a1a22');
  rect(g, 18, 44, 92, 96, '#f2e14e');
  rect(g, 18, 44, 92, 2, '#fff07a');
  figure(g, 64 - 12, 122 - 60, 2, look, 'waveR');
  drawText(g, POSES[3], 64, 126, { align: 'center', color: '#1a1a22' });
  // The strip so far, printing out on the right.
  rect(g, 374, 34, 52, 186, '#f4f1e8');
  rect(g, 374, 34, 52, 2, '#ffffff');
  photo(g, 380, 40, look, 'armsUp', true);
  photo(g, 380, 84, look, 'crouch', false);
  for (let i = 2; i < 4; i++) {
    rect(g, 378, 38 + i * 44, 44, 44, '#1a1a22');
    rect(g, 380, 40 + i * 44, 40, 40, '#3a2a4a');
  }
  // The pads.
  for (let i = 0; i < 4; i++) {
    const on = i === 3;
    rect(g, padX(i), PAD.y, PAD.w, PAD.h, '#1a1a22');
    rect(g, padX(i) + 1, PAD.y + 1, PAD.w - 2, PAD.h - 2, on ? '#f2e14e' : '#3a2a4a');
    rect(g, padX(i) + 1, PAD.y + 1, PAD.w - 2, 2, on ? '#fff07a' : '#5a4a6a');
    drawText(g, POSES[i], padX(i) + PAD.w / 2, PAD.y + 9, { align: 'center', color: on ? '#1a1a22' : '#f4f1e8' });
  }
  drawText(g, 'Press the arrow once the card shows', W / 2, 216, { align: 'center', color: '#c8b8a8' });
  header(g, 'Photo Booth', 'Shot 3/4');
  timerBar(g, 10, 20);
}
