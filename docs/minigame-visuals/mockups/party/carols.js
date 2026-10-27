// Carol Karaoke, in-between style: the party stage (velvet drapes, a choir of colleagues in Santa hats on a riser, the
// tree), the three lanes as music staves with rounded note bars, your singing head on the current lane, the lyrics on
// a karaoke screen. Same lanes, NOW line and timing as today.
import { W, H, rect, drawText, measureText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { figure, playerLook, GUESTS, tree, stringLights } from './common.js';

const LANE_Y = [180, 140, 100];
const LANE_NAMES = ['LOW', 'MID', 'HIGH'];
const NOW_X = 110;

function drapes(g) {
  rect(g, 0, 18, W, 196, '#1a1226');
  for (const [x0, w] of [[0, 34], [446, 34]]) for (let k = 0; k < w; k += 8) {
    rect(g, x0 + k, 18, 8, 196, '#7a1a2a');
    rect(g, x0 + k, 18, 4, 196, '#982838');
  }
  rect(g, 0, 18, W, 10, '#982838');
  for (let x = 0; x < W; x += 12) rect(g, x, 28, 8, 4, '#c8a040');
}

function choir(g, t) {
  // A riser across the back; six colleagues singing, one mouth open per beat.
  rect(g, 120, 94, 312, 6, '#5a3a22');
  rect(g, 120, 94, 312, 2, '#7a5232');
  for (let i = 0; i < 6; i++) {
    const sing = (i + Math.floor(t * 3)) % 2 === 0;
    figure(g, 132 + i * 48, 98 - 60, 2, GUESTS[i % GUESTS.length].hat ? GUESTS[i % GUESTS.length] : { ...GUESTS[i % GUESTS.length], hat: 'santa' }, 'stand', sing ? 'sing' : 'smile');
  }
}

function note(g, x0, x1, y, col, dark) {
  rect(g, x0 + 2, y + 3, x1 - x0 - 4, 10, col);
  rect(g, x0, y + 5, x1 - x0, 6, col);
  rect(g, x0 + 2, y + 11, x1 - x0 - 4, 2, dark);
  rect(g, x0 + 2, y + 3, x1 - x0 - 4, 2, '#ffffff44');
}

export function carols(g, t, skirt) {
  rect(g, 0, 0, W, H, '#1a1226');
  drapes(g);
  stringLights(g, 34, t, 40, 440);
  tree(g, 438, 96, 54, t);
  choir(g, t);
  // The staves.
  for (let i = 0; i < 3; i++) {
    rect(g, 40, LANE_Y[i], W - 60, 16, '#241a34');
    rect(g, 40, LANE_Y[i] + 4, W - 60, 2, '#30244a');
    rect(g, 40, LANE_Y[i] + 10, W - 60, 2, '#30244a');
    drawText(g, LANE_NAMES[i], 6, LANE_Y[i] + 5, { color: '#c8b8e8', shadow: '#1a1226' });
  }
  // Notes: the live one gold, the rest red.
  note(g, 110, 150, LANE_Y[1], '#f2e14e', '#b8a020');
  note(g, 40, 104, LANE_Y[1], '#c8343a', '#8a2028');
  note(g, 154, 214, LANE_Y[1], '#c8343a', '#8a2028');
  note(g, 218, 250, LANE_Y[1], '#c8343a', '#8a2028');
  note(g, 254, 290, LANE_Y[2], '#c8343a', '#8a2028');
  note(g, 294, 340, LANE_Y[0], '#c8343a', '#8a2028');
  note(g, 344, 372, LANE_Y[0], '#c8343a', '#8a2028');
  note(g, 376, 460, LANE_Y[1], '#c8343a', '#8a2028');
  rect(g, NOW_X, 92, 2, 112, '#f4f1e8');
  // You: your head in a Santa hat on the current lane, singing.
  g.save();
  g.beginPath();
  g.rect(NOW_X - 14, LANE_Y[1] - 10, 30, 28);
  g.clip();
  figure(g, NOW_X - 11, LANE_Y[1] - 4, 2, playerLook(skirt), 'stand', 'sing');
  g.restore();
  // The karaoke screen with the lyrics.
  rect(g, 0, 204, W, 10, '#5a3a22');
  rect(g, 0, 204, W, 2, '#7a5232');
  rect(g, 0, 214, W, H - 214, '#120c1c');
  rect(g, 30, 222, 420, 22, '#0a0612');
  rect(g, 30, 222, 420, 2, '#2a1e3a');
  const words = ['gle', 'bells,', 'jin-', 'gle', 'all', 'the', 'way!', 'Oh'];
  let x = 40;
  words.forEach((w, i) => {
    drawText(g, w, x, 229, { color: i === 0 ? '#f2e14e' : '#c8b8a8' });
    x += measureText(w) + (w.endsWith('-') ? 1 : 6);
  });
  drawText(g, 'Up/Down to change your note', W / 2, 252, { align: 'center', color: '#8a80a0' });
  header(g, 'Carol Karaoke', 'Jingle Bells');
  timerBar(g, 30, 50);
}
