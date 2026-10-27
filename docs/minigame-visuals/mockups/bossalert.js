// Boss Alert mockup: a furnished hallway, colleagues drawn with the floors' own character sprites (bakeCharacter, 2x),
// your cubicle seen over your shoulder (a mirror stuck to the monitor), a proper Solitaire window and a mugshot legend.
import { W, H, C, rect, frame, panel, drawText, header, timerBar, monitor } from '../../../src/engine/mgkit.js';
import { bakeCharacter, CHAR_W, CHAR_H } from '../../../src/engine/art.js';
import { gradient, blob, shaded, line, glow, speckle, sprite, styleIs } from './kit.js';
import { person } from './person.js';

const FEET = 112; // proposed (today 104): a little more floor in front of the wall

const BOSS = { skin: '#f2c9a0', hair: '#9a9aa0', hairStyle: 1, shirt: '#ffffff', pants: '#22242e', tie: '#e2304a', jacket: '#22242e', shoes: '#1a1410', glasses: true };
const PEOPLE = [
  { skin: '#d9a273', hair: '#2b1d14', hairStyle: 0, shirt: '#3b6fb6', pants: '#3a3f55', tie: null, jacket: null, shoes: '#1a1410' },
  { skin: '#a86b42', hair: '#1a1a1a', hairStyle: 2, shirt: '#e8d8d8', pants: '#5a4a3a', skirt: '#2f6f5f', tie: null, jacket: null, shoes: '#1a1410' },
  // A decoy: a suit, but a blue tie.
  { skin: '#f2c9a0', hair: '#7a4a22', hairStyle: 3, shirt: '#d8dfe8', pants: '#22242e', tie: '#2a6ad1', jacket: '#2b3550', shoes: '#1a1410' },
];
const sheets = new Map();
// The mid style draws the Elevator Pitch figure instead of the floor sprite (12x30 cells, feet at the bottom).
const PITCH = new Map();
function pitchLook(look) {
  let p = PITCH.get(look);
  if (!p) {
    p = { skin: look.skin, hair: look.hair, top: look.jacket || look.shirt, pants: look.pants, tie: look.tie, lapel: look.jacket ? look.shirt : null, skirt: look.skirt, long: look.hairStyle === 2, glasses: false, collar: look.jacket ? look.shirt : look.shirt };
    PITCH.set(look, p);
  }
  return p;
}
function figure(g, look, x, feet, dir, frameNo, s = 2) {
  if (styleIs('mid')) {
    blob(g, x, feet, 12 * s / 2, 2, 'rgba(0,0,0,0.25)');
    const pose = dir === 'down' ? 'stand' : frameNo === 1 ? 'walkA' : frameNo === 2 ? 'walkB' : 'stand';
    person(g, Math.round(x - 6 * s), Math.round(feet - 30 * s), s, pitchLook(look), { pose });
    return;
  }
  let c = sheets.get(look);
  if (!c) sheets.set(look, (c = bakeCharacter(look)));
  const row = { down: 0, up: 1, left: 2, right: 3 }[dir];
  blob(g, x, feet, 9 * s / 2 + 2, 2, 'rgba(0,0,0,0.25)');
  g.drawImage(c, frameNo * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H, Math.round(x - (CHAR_W * s) / 2), Math.round(feet - CHAR_H * s), CHAR_W * s, CHAR_H * s);
}

function hallway(g, t) {
  // Ceiling with lights, wallpaper with a pinstripe, a chair rail, wainscot, carpet tiles.
  rect(g, 0, 18, W, 8, '#d8dce4');
  for (let x = 30; x < W; x += 110) {
    rect(g, x, 20, 44, 4, '#ffffff');
    rect(g, x, 24, 44, 1, '#b8c0cc');
  }
  rect(g, 0, 26, W, 1, '#8a90a0');
  rect(g, 0, 27, W, 54, '#7a8098');
  for (let x = 0; x < W; x += 6) rect(g, x, 27, 1, 54, '#727890');
  for (let x = 30; x < W; x += 110) gradient(g, x - 6, 27, 56, 24, ['#9aa0b8', '#7a8098']);
  rect(g, 0, 80, W, 3, '#8a6038');
  rect(g, 0, 80, W, 1, '#b8885a');
  rect(g, 0, 83, W, 17, '#5a6078');
  for (let x = 6; x < W; x += 40) frame(g, x, 86, 32, 11, '#4a5068');
  rect(g, 0, 100, W, 2, '#3a3d48');
  rect(g, 0, 102, W, 48, '#5a6050');
  for (let y = 102; y < 150; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) rect(g, x, y, 12, 12, '#545a4a');
  speckle(g, 0, 102, W, 48, ['#646a58', '#4e5444'], 500, 13);
  // Doors with name plates.
  for (const [x, name] of [[18, 'HR'], [344, 'CEO']]) {
    rect(g, x - 3, 36, 40, 64, '#3d3a48');
    rect(g, x, 39, 34, 61, '#7a5232');
    rect(g, x + 3, 42, 28, 24, '#8a6040');
    rect(g, x + 3, 70, 28, 26, '#8a6040');
    rect(g, x + 28, 68, 3, 3, C.gold);
    rect(g, x + 7, 30, 20, 8, '#c8a040');
    drawText(g, name, x + 17, 30, { align: 'center', color: '#3a2a1a' });
  }
  // Motivational poster.
  rect(g, 84, 34, 44, 40, '#1a1a22');
  gradient(g, 86, 36, 40, 28, ['#2a3a6a', '#6a7ab0', '#e8a070']);
  for (let k = 0; k < 14; k++) rect(g, 92 + k, 64 - k, 28 - k * 2, 1, '#3a3a4a');
  rect(g, 104, 50, 4, 2, '#ffffff');
  rect(g, 86, 64, 40, 8, '#1a1a22');
  drawText(g, 'SYNERGY', 106, 64, { align: 'center', color: '#f4f1e8' });
  // A window onto the city.
  rect(g, 150, 32, 76, 46, '#d8dce4');
  gradient(g, 153, 35, 70, 40, ['#5a90c8', '#a8d0ec']);
  for (const [x, h] of [[156, 22], [168, 30], [182, 18], [192, 34], [206, 24], [214, 14]]) {
    rect(g, x, 75 - h, 10, h, '#6a7a90');
    for (let y = 75 - h + 3; y < 74; y += 4) rect(g, x + 2, y, 2, 2, '#c8d8e8'), rect(g, x + 6, y, 2, 2, '#c8d8e8');
  }
  rect(g, 187, 35, 2, 40, '#d8dce4');
  // Water cooler.
  rect(g, 268, 70, 22, 30, '#e8ecf0');
  rect(g, 268, 70, 22, 2, '#ffffff');
  rect(g, 272, 78, 4, 3, '#3a7ad1');
  rect(g, 282, 78, 4, 3, '#e2504a');
  shaded(g, 279, 58, 10, 13, '#8ac8f0', { rim: '#4a90c8', light: '#d0ecff' });
  rect(g, 276, 44, 6, 4, '#3a7ad1');
  // Clock and a tall plant.
  shaded(g, 420, 44, 9, 9, '#f4f1e8', { rim: '#3a3d48' });
  line(g, 420, 44, 420, 38, '#1a1a22');
  line(g, 420, 44, 424, 46, '#1a1a22');
  rect(g, 440, 84, 18, 16, '#b0603a');
  rect(g, 439, 84, 20, 3, '#c8784a');
  for (const [dx, dy, rx, ry] of [[-6, -14, 5, 10], [6, -18, 5, 12], [0, -28, 4, 10], [-8, -30, 4, 8], [8, -32, 4, 8]]) shaded(g, 449 + dx, 84 + dy, rx, ry, '#2f8a3a', { rim: '#1f5a26', light: '#4fba5a' });
}

function cubicle(g, t, fun) {
  // Side partitions (fabric, an aluminium rail), the desk, your monitor (the mirror on it), you from behind.
  for (const [x0, w] of [[150, 46], [286, 46]]) {
    rect(g, x0, 112, w, 38, '#6d7486');
    speckle(g, x0, 114, w, 36, ['#7d8496', '#5d6476'], 200, x0);
    rect(g, x0, 110, w, 3, '#c4c8d0');
    rect(g, x0, 113, w, 1, '#8a8e98');
  }
  // Pinned notes and a photo on the partitions.
  rect(g, 158, 118, 10, 10, '#f2e27a');
  rect(g, 172, 122, 12, 9, '#f4f1e8');
  rect(g, 173, 123, 10, 5, '#7ab0d8');
  rect(g, 312, 118, 12, 10, '#f2a0c0');
  // Desk surface and its clutter.
  rect(g, 196, 120, 90, 30, '#8a6a4a');
  rect(g, 196, 120, 90, 2, '#a88660');
  rect(g, 270, 112, 8, 9, '#f4f1e8');
  rect(g, 270, 112, 8, 2, '#3a2a1a');
  // Monitor (its screen faces you), a little mirror on its corner.
  rect(g, 232, 92, 46, 30, '#1a1a22');
  rect(g, 234, 94, 42, 25, fun ? '#2f7a3a' : '#e9eef5');
  if (fun) for (let i = 0; i < 6; i++) rect(g, 236 + i * 7, 97, 5, 7, '#ffffff');
  else for (let r = 0; r < 4; r++) rect(g, 236, 97 + r * 5, 38, 1, '#c8cfdc');
  glow(g, 255, 106, 26, fun ? '#6aff8a' : '#c8e0ff', 0.25);
  rect(g, 251, 122, 8, 4, '#2b2e38');
  rect(g, 226, 88, 12, 8, '#1a1a22');
  rect(g, 227, 89, 10, 6, '#a8c0d8');
  rect(g, 228, 90, 3, 2, '#e2304a'); // ...and in it, a red tie
  // You: chair back, shoulders, the back of your head with headphones.
  rect(g, 226, 128, 40, 22, '#1a1a22');
  speckle(g, 228, 130, 36, 20, ['#2a2a32'], 60, 4);
  rect(g, 224, 124, 44, 6, '#2a2a32');
  rect(g, 222, 118, 48, 12, '#3b6fb6');
  rect(g, 222, 118, 48, 2, '#5a8ad6');
  shaded(g, 246, 106, 10, 11, '#2b1d14', { rim: '#1a120c', light: '#4a3020' });
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.08) rect(g, Math.round(246 + Math.cos(a) * 12), Math.round(106 + Math.sin(a) * 12), 2, 2, '#3a3d48');
  rect(g, 233, 103, 4, 8, '#e2504a');
  rect(g, 255, 103, 4, 8, '#e2504a');
}

function solitaire(g, s, t) {
  // A window with a title bar, green felt, foundations, seven tableau columns, the win cascade.
  rect(g, s.x, s.y, s.w, s.h, '#1e5a2a');
  speckle(g, s.x, s.y + 10, s.w, s.h - 10, ['#246a32', '#1a4e24'], 300, 2);
  rect(g, s.x, s.y, s.w, 9, '#1f70c1');
  drawText(g, 'Solitaire Pro', s.x + 3, s.y, { color: '#ffffff' });
  for (const [k, c] of [[0, '#e2504a'], [1, '#f2c14e'], [2, '#5fd068']]) rect(g, s.x + s.w - 8 - k * 7, s.y + 2, 5, 5, c);
  const card = (x, y, up, suit, rank) => {
    rect(g, x, y, 16, 21, '#1a1a22');
    rect(g, x + 1, y + 1, 14, 19, up ? '#ffffff' : '#3b6fb6');
    if (!up) {
      for (let k = 0; k < 6; k++) rect(g, x + 2 + ((k * 3) % 11), y + 3 + k * 3, 2, 2, '#7fb4ea');
      return;
    }
    const red = suit === 'h' || suit === 'd';
    drawText(g, rank, x + 2, y + 1, { color: red ? '#e2304a' : '#1a1a22' });
    const SUITS = { h: '.r.r.|rrrrr|.rrr.|..r..', d: '..r..|.rrr.|rrrrr|.rrr.|..r..', s: '..r..|.rrr.|rrrrr|..r..|.rrr.', c: '.rrr.|.rrr.|rrrrr|..r..|.rrr.' };
    sprite(g, SUITS[suit], { r: red ? '#e2304a' : '#1a1a22' }, x + 5, y + 11, 1);
  };
  for (let i = 0; i < 4; i++) card(s.x + 66 + i * 22, s.y + 12, i < 2, ['h', 's'][i % 2], ['A', '2'][i]);
  card(s.x + 4, s.y + 12, false);
  card(s.x + 24, s.y + 12, true, 'd', '7');
  const ranks = ['K', 'Q', 'J', '10', '9', '8', '5'];
  for (let col = 0; col < 7; col++) {
    const x = s.x + 4 + col * 22;
    for (let k = 0; k < Math.min(col, 3); k++) card(x, s.y + 36 + k * 4, false);
    card(x, s.y + 36 + Math.min(col, 3) * 4, true, ['s', 'h', 'c', 'd'][col % 4], ranks[col]);
  }
}

function mugshot(g) {
  panel(g, 14, 164, 120, 82, { title: 'THE BOSS' });
  rect(g, 20, 179, 108, 50, '#c8ccd4');
  for (let y = 181; y < 229; y += 6) rect(g, 20, y, 108, 1, '#a8acb4');
  drawText(g, '6ft', 24, 181, { color: '#6a6e78' });
  g.save();
  g.beginPath();
  g.rect(20, 179, 108, 50);
  g.clip();
  figure(g, BOSS, 74, styleIs('mid') ? 274 : 250, 'down', 0, 3);
  g.restore();
  drawText(g, 'red tie, grey hair', 74, 232, { align: 'center', color: C.gold });
}

export function bossAlert(g, t) {
  hallway(g, t);
  const step = Math.floor(t * 6) % 2 ? 1 : 2;
  figure(g, PEOPLE[1], 70, FEET, 'right', step);
  figure(g, PEOPLE[2], 400, FEET, 'left', 3 - step);
  // The boss passes your desk and glances over: facing you, a "?" bubble.
  figure(g, BOSS, 206, FEET, 'down', 0);
  rect(g, 216, 52, 14, 13, '#1a1a22');
  rect(g, 217, 53, 12, 11, '#ffffff');
  rect(g, 219, 64, 3, 3, '#ffffff');
  drawText(g, '?', 223, 55, { align: 'center', color: '#e2304a' });
  cubicle(g, t, true);
  header(g, 'Boss Alert', 'Dodged 2/5');
  timerBar(g, 30, 45);
  // Your screen inset on the desk.
  rect(g, 0, 150, W, H - 150, '#5a4030');
  for (let y = 154; y < H; y += 9) rect(g, 0, y, W, 1, 'rgba(0,0,0,0.12)');
  rect(g, 0, 150, W, 2, 'rgba(255,255,255,0.15)');
  const s = monitor(g, 160, 162, 160, 84, '#000');
  solitaire(g, s, t);
  mugshot(g);
  panel(g, 346, 164, 120, 82, { title: 'STATUS' });
  drawText(g, 'Caught: 0', 356, 184, { color: C.text });
  drawText(g, 'False alarms: 1', 356, 198, { color: C.warn });
  drawText(g, 'Screen: FUN', 356, 212, { color: C.gold });
  drawText(g, 'SPACE = alt-tab', 356, 228, { color: C.dim });
}
