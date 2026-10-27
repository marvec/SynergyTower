// Deep Tissue, the in-between style: the guest (you, in your skirt/trousers hairstyle) seen from above in flat colours
// on a 4 px grid with the pitch figure's proportions (a big head, a short body), the masseur's hands and the spa props.
import { W, H, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { cblob, cells, sprite, shade } from './kit.js';

const S = 6; // zoomed in: the back fills the screen down to the towel
const CX = 240;
const SKIN = '#f2c9a0';
const SKIN_D = '#d9a273';
const HAIR = '#5a3620';

function floor(g) {
  rect(g, 0, 18, W, H - 18, '#9a6a44');
  for (let y = 18, i = 0; y < H; y += 12, i++) {
    rect(g, 0, y, W, 11, i % 2 ? '#a87650' : '#a2704a');
    rect(g, 0, y + 11, W, 1, '#7a5236');
    for (let x = (i * 37) % 70; x < W; x += 70 + ((i * 13) % 30)) rect(g, x, y, 1, 11, '#7a5236');
  }
}

function table(g) {
  rect(g, 156, 20, 168, H - 20, '#8a7a64');
  rect(g, 158, 22, 164, H - 22, '#efe4cc');
  rect(g, 158, 22, 164, 2, '#fbf4e4');
  rect(g, 162, 26, 2, H - 26, '#e0d4ba');
  rect(g, 316, 26, 2, H - 26, '#e0d4ba');
}

// The guest from above, S px cells: head 12 cells wide, torso 16, arms 2 with a gap (the table shows) below the
// shoulder. The view is cropped at the waist by the towel.
const OY = 38;
const Y = (row) => OY + row * S;
function guest(g, skirt) {
  const r = cells(g, CX - 11 * S, OY, S); // cell 0 = 11 cells left of the centre line
  for (const [ax, gap] of [[0, 2], [20, 19]]) {
    r(ax, 14, 2, 22, SKIN);
    r(ax, 24, 2, 1, SKIN_D); // elbow
    r(gap, 14, 1, 2, SKIN); // the shoulder joins the arm
  }
  r(4, 13, 14, 1, SKIN);
  r(3, 14, 16, 12, SKIN);
  r(4, 26, 14, 10, SKIN);
  r(18, 15, 1, 11, SKIN_D); // the far side in shadow
  // Spine and shoulder blades: thin lines in the darker skin.
  rect(g, CX - 1, Y(15), 2, 20 * S, SKIN_D);
  for (const s of [-1, 1]) {
    rect(g, CX + s * Math.round(4.5 * S) - (s < 0 ? 2 : 0), Y(16), 2, 4 * S, SKIN_D);
    rect(g, CX + s * Math.round(3.5 * S) - (s < 0 ? S : 0), Y(20), S, 2, SKIN_D);
  }
  // Neck and the back of the head; short hair, or long hair in a bun.
  r(9, 12, 4, 1, SKIN_D);
  r(5, 0, 12, 11, HAIR);
  r(4, 4, 1, 3, SKIN);
  r(17, 4, 1, 3, SKIN);
  r(7, 11, 8, 1, SKIN);
  rect(g, CX - Math.round(3.5 * S), OY + S, 7 * S, 2, shade(HAIR, 0.2));
  if (skirt) {
    r(8, -3, 6, 3, HAIR);
    r(9, 0, 4, 1, '#c84a6a');
    r(5, 11, 2, 3, HAIR);
    r(15, 11, 2, 3, HAIR);
  }
}

function towel(g) {
  const y = Y(33);
  rect(g, CX - 10 * S, y, 20 * S, H - y, '#d8d0c0');
  rect(g, CX - 10 * S + 2, y, 20 * S - 4, H - y, '#f6f3ea');
  rect(g, CX - 10 * S + 2, y, 20 * S - 4, 4, '#ffffff');
  rect(g, CX - 10 * S + 2, y + 10, 20 * S - 4, 4, '#2fa39a');
}

function knot(g, x, y, t) {
  const p = Math.floor(t * 4) % 2;
  cblob(g, x, y, 8 + p * 2, 6 + p * 2, '#f0a090', 2);
  cblob(g, x, y, 6, 4, '#e2504a', 2);
  rect(g, x - 2, y - 2, 2, 2, '#ff9a8a');
}

// The masseur's hands (the mockups' first version, liked): 2 px cells, an outline, tunic cuffs.
const HAND = ['....nn.....', '..nnSsnn...', '..SsSsSsnn.', '..SsSsSsSs.', '..SsSsSsSs.', '..SSSSSSSs.', 'nSSSSSSSSs.', 'SSsSSSSSSs.', '.SSSSSSSSs.', '..SSSSSSss.', '..cccccccc.', '..CCCCCCCC.'].join('|');
function hands(g, x, y) {
  const pal = { S: '#c98a5e', s: '#a86e46', n: '#e8b494', c: '#f6f6f2', C: '#c8ccd0' };
  const out = Object.fromEntries(Object.keys(pal).map((k) => [k, '#3a2418']));
  const hs = 3; // 3 px cells: the hands keep their size next to the zoomed-in back
  for (const [dx, flip] of [[-36, true], [3, false]]) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sprite(g, HAND, out, x + dx + ox * hs, y - 18 + oy * hs, hs, flip);
    sprite(g, HAND, pal, x + dx, y - 18, hs, flip);
  }
}

// Props from above, flat with 2 px cells.
function candle(g, x, y, t) {
  g.save();
  g.globalAlpha = 0.25;
  cblob(g, x, y, 16, 16, '#ffc060', 2);
  g.restore();
  cblob(g, x, y, 7, 7, '#c8bca0', 2);
  cblob(g, x, y, 5, 5, '#f4ecd8', 2);
  rect(g, x - 2, y - 2 - (Math.floor(t * 6) % 2) * 2, 4, 4, '#ffb030');
}
function stones(g, x, y) {
  cblob(g, x, y, 16, 10, '#5a5a62', 2);
  cblob(g, x + 2, y - 4, 10, 6, '#7a7a82', 2);
  cblob(g, x + 3, y - 7, 6, 4, '#9a9aa2', 2);
}
function towels(g, x, y, col) {
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 14;
    rect(g, x, yy, 54, 12, shade(col, -0.25));
    rect(g, x + 2, yy + 2, 50, 8, col);
    cblob(g, x + 46, yy + 6, 6, 6, shade(col, -0.25), 2);
    cblob(g, x + 46, yy + 6, 2, 2, shade(col, 0.15), 2);
  }
}
function orchid(g, x, y) {
  cblob(g, x, y, 14, 14, '#b0603a', 2);
  cblob(g, x, y, 10, 10, '#5a3a22', 2);
  for (const [dx, dy, rx, ry] of [[-12, 4, 10, 4], [12, -2, 10, 4], [-2, -12, 4, 10]]) cblob(g, x + dx, y + dy, rx, ry, '#3f9a4a', 2);
  for (const [dx, dy] of [[-8, -16], [6, -20], [16, -10]]) {
    cblob(g, x + dx, y + dy, 5, 5, '#e86ab0', 2);
    rect(g, x + dx - 1, y + dy - 1, 2, 2, '#ffe070');
  }
}
function bowl(g, x, y) {
  cblob(g, x, y, 22, 16, '#d8d0c0', 2);
  cblob(g, x, y, 18, 12, '#5ab0c8', 2);
  for (const [dx, dy] of [[-6, -2], [6, 4]]) cblob(g, x + dx, y + dy, 4, 4, '#f2a0c0', 2);
}

export function massage2(g, t, skirt) {
  floor(g);
  table(g);
  guest(g, skirt);
  towel(g);
  knot(g, 214, 136, t);
  knot(g, 266, 220, t + 0.5);
  hands(g, 240, 168);
  towels(g, 28, 36, '#f6f3ea');
  stones(g, 60, 134);
  candle(g, 62, 122, t);
  bowl(g, 64, 214);
  orchid(g, 420, 64);
  cblob(g, 404, 150, 8, 8, '#c8782a', 2);
  cblob(g, 404, 150, 3, 3, '#6a4a30', 2);
  candle(g, 432, 146, t + 1);
  towels(g, 400, 204, '#2fa39a');
  header(g, 'Deep Tissue', 'Knots 3/12');
  timerBar(g, 22, 30);
  drawText(g, 'Find the knots and let them go', W / 2, 256, { align: 'center', color: '#3a2414' });
}
