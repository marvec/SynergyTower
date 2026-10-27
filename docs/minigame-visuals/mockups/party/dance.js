// Dance-Off, in-between style: the party hall's dance floor (lit tiles pulsing on the beat), the disco ball with its
// coloured spots, the DJ booth, you and a rival as pitch figures in Santa hats mid-move, chunky 2 px arrows.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { cblob } from '../kit.js';
import { figure, playerLook, GUESTS, discoBall, arrow2, stringLights } from './common.js';

const LANE_X = [180, 220, 260, 300];
const COLORS = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e'];
const LINE_Y = 52;
const PAD = { y: 226, w: 36, h: 30 };

function floor(g, pulse) {
  // Lit tiles in perspective-free rows; one colour lights up per beat.
  const tiles = ['#5a2a6a', '#2a3a7a', '#2a6a5a', '#7a5a2a'];
  for (let y = 196, row = 0; y < H; y += 18, row++)
    for (let x = 0, i = row; x < W; x += 40, i++) {
      const lit = i % 4 === pulse;
      rect(g, x, y, 40, 18, '#120c1e');
      rect(g, x + 2, y + 2, 36, 14, lit ? tiles[i % 4] : '#1e1630');
      if (lit) rect(g, x + 2, y + 2, 36, 2, '#ffffff33');
    }
}

function djBooth(g, t) {
  // At the back right: a booth with a turntable, a laptop glow and speakers.
  // The DJ behind the decks, headphones on.
  figure(g, 434, 100, 2, { ...GUESTS[4], hat: null }, 'stand', 'smile');
  rect(g, 436, 104, 24, 2, '#1a1a22');
  rect(g, 434, 108, 4, 8, '#1a1a22');
  rect(g, 458, 108, 4, 8, '#1a1a22');
  rect(g, 352, 118, 112, 54, '#1a1426');
  rect(g, 352, 118, 112, 4, '#3a2a5a');
  for (let x = 360; x < 456; x += 16) rect(g, x, 128, 8, 40, ['#e2504a', '#5b8def', '#5fd068'][((x - 360) / 16 + Math.floor(t * 4)) % 3]);
  for (const sx of [334, 466]) {
    rect(g, sx, 120, 14, 52, '#141020');
    cblob(g, sx + 7, 134, 4, 4, '#3a3a4a');
    cblob(g, sx + 7, 156, 6, 6, '#3a3a4a');
  }
}

function spots(g, t) {
  // Coloured spots on the back wall from the ball.
  const cols = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e', '#f29cd0', '#7ee0c3'];
  for (let i = 0; i < 6; i++) {
    const a = t * 0.8 + i;
    const x = 240 + Math.cos(a) * 200;
    const y = 120 + Math.sin(a * 1.3) * 50;
    g.save();
    g.globalAlpha = 0.5;
    cblob(g, Math.round(x / 2) * 2, Math.round(y / 2) * 2, 8, 6, cols[i]);
    g.restore();
  }
}

export function dance(g, t, skirt) {
  rect(g, 0, 0, W, H, '#140f22');
  rect(g, 0, 18, W, 178, '#1e1630');
  for (let x = 0; x < W; x += 24) rect(g, x, 18, 12, 178, '#21183a');
  spots(g, t);
  stringLights(g, 24, t);
  djBooth(g, t);
  floor(g, Math.floor(t * 2) % 4);
  discoBall(g, 92, 52, t, 12);
  // The lanes: dark glass panels with a lit line; the target arrows at the top.
  for (let i = 0; i < 4; i++) {
    rect(g, LANE_X[i] - 18, 30, 36, 190, '#0e0a18');
    rect(g, LANE_X[i] - 16, 32, 32, 186, '#1d1630');
    rect(g, LANE_X[i] - 16, 32, 2, 186, '#2a2244');
    arrow2(g, LANE_X[i], LINE_Y, i, i === 2 ? '#ffffff' : '#5a5070');
  }
  rect(g, 162, LINE_Y - 1, 156, 2, '#f29cd044');
  for (const [lane, y] of [[1, 96], [3, 132], [0, 170], [2, 200], [1, 210]]) arrow2(g, LANE_X[lane], y, lane, COLORS[lane]);
  for (let i = 0; i < 4; i++) {
    const on = i === 2;
    rect(g, LANE_X[i] - PAD.w / 2, PAD.y, PAD.w, PAD.h, '#0e0a18');
    rect(g, LANE_X[i] - PAD.w / 2 + 1, PAD.y + 1, PAD.w - 2, PAD.h - 2, on ? COLORS[i] : '#2a2240');
    rect(g, LANE_X[i] - PAD.w / 2 + 1, PAD.y + 1, PAD.w - 2, 2, on ? '#ffffff66' : '#3a3258');
    arrow2(g, LANE_X[i], PAD.y + PAD.h / 2, i, '#f4f1e8');
  }
  // You and the rival, mid-move on the beat (feet at 182 as today).
  const hop = Math.floor(t * 4) % 2 ? 2 : 0;
  cblob(g, 70, 184, 16, 4, '#00000066');
  figure(g, 70 - 12, 182 - 60 - hop, 2, playerLook(skirt), 'danceA');
  cblob(g, 410, 184, 16, 4, '#00000066');
  figure(g, 410 - 12, 182 - 60 - (2 - hop), 2, GUESTS[0], 'danceB');
  drawText(g, 'YOU', 70, 196, { align: 'center', color: '#f4f1e8', shadow: '#120c1e' });
  drawText(g, 'Combo 7  Best 12', W / 2, 20, { align: 'center', color: '#f29cd0' });
  drawText(g, 'Arrow keys', W / 2, 260, { align: 'center', color: '#c8b8e8', shadow: '#120c1e' });
  header(g, 'Dance-Off', '24 s');
  timerBar(g, 24, 44);
}
