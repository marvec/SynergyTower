// Procedural pixel art: characters, furniture and floor tiles, baked into offscreen canvases once.
// 2.5D convention (C-Dogs style): an object with ground footprint (x, y, w, d) and height h draws its top face
// at (x, y - h) and its front face at (x, y + d - h, w, h). Everything is drawn in 1px units at 16px/tile.
import { makeCanvas } from './screen.js';

export const TILE = 16;
export const WALL_H = 12;
export const CHAR_W = 16;
export const CHAR_H = 22;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v))));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
export { shade };

function P(g) {
  const r = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const px = (x, y, c) => r(x, y, 1, 1, c);
  /** Box with top face colour `top`, front face `front`, 1px dark outline. */
  const box = (x, y, w, d, h, top, front, outline = '#1a1a22') => {
    r(x, y - h, w, d + h, outline);
    r(x + 1, y - h + 1, w - 2, d - 1, top);
    r(x + 1, y - h + d, w - 2, h - 1, front);
    r(x + 1, y - h + 1, w - 2, 1, shade(top, 0.25));
  };
  return { r, px, box };
}

// ---------------------------------------------------------------- characters
/**
 * Character sheet: 4 directions (down, up, left, right) × 3 frames (stand, stepA, stepB).
 * look: { skin, hair, hairStyle 0-3, shirt, pants, tie|null, jacket|null, shoes }
 */
export function bakeCharacter(look) {
  const [c, g] = makeCanvas(CHAR_W * 3, CHAR_H * 4);
  const dirs = ['down', 'up', 'left', 'right'];
  dirs.forEach((dir, row) => {
    for (let f = 0; f < 3; f++) {
      g.save();
      g.translate(f * CHAR_W, row * CHAR_H);
      if (dir === 'right') {
        g.translate(CHAR_W, 0);
        g.scale(-1, 1);
      }
      drawCharFrame(g, look, dir === 'right' ? 'left' : dir, f);
      g.restore();
    }
  });
  return c;
}

function drawCharFrame(g, L, dir, f) {
  const { r, px } = P(g);
  const O = '#1a1a22';
  const legA = f === 1 ? -1 : 0;
  const legB = f === 2 ? -1 : 0;
  const bob = f === 0 ? 0 : 1;
  const body = L.jacket || L.shirt;
  const y0 = 1 + bob * 0; // head top
  if (dir === 'down' || dir === 'up') {
    // legs
    r(5, 15 + legA, 3, 6 - legA, O);
    r(8, 15 + legB, 3, 6 - legB, O);
    r(6, 15 + legA, 1, 4, L.pants);
    r(9, 15 + legB, 1, 4, L.pants);
    r(5, 15, 6, 2, L.pants);
    r(5, 19 + legA, 3, 2, L.shoes);
    r(8, 19 + legB, 3, 2, L.shoes);
    // torso
    r(3, 8, 10, 9, O);
    r(4, 9, 8, 7, body);
    r(4, 9, 8, 1, shade(body, 0.2));
    // arms swing
    const aL = f === 1 ? 1 : f === 2 ? -1 : 0;
    r(2, 9 + aL, 2, 6, O);
    r(12, 9 - aL, 2, 6, O);
    r(3, 10 + aL, 1, 4, body);
    r(12, 10 - aL, 1, 4, body);
    r(3, 14 + aL, 1, 1, L.skin);
    r(12, 14 - aL, 1, 1, L.skin);
    if (dir === 'down') {
      if (L.jacket) {
        r(6, 9, 4, 5, L.shirt);
        r(7, 9, 2, 1, L.shirt);
      }
      if (L.tie) {
        r(7, 9, 2, 1, L.tie);
        r(7, 10, 2, 4, L.tie);
        px(7, 14, L.tie);
      }
      if (L.badge) r(10, 11, 1, 2, '#f4f1e8');
    }
    // head
    r(4, y0, 8, 9, O);
    r(5, y0 + 1, 6, 7, L.skin);
    if (dir === 'down') {
      r(5, y0 + 1, 6, 2, L.hair);
      if (L.hairStyle === 1) r(5, y0 + 1, 2, 4, L.hair), r(9, y0 + 1, 2, 4, L.hair);
      if (L.hairStyle === 2) r(4, y0 + 1, 1, 6, L.hair), r(11, y0 + 1, 1, 6, L.hair), r(5, y0 + 1, 6, 1, L.hair);
      if (L.hairStyle === 3) r(5, y0, 6, 1, L.hair);
      px(6, y0 + 4, O);
      px(9, y0 + 4, O);
      px(7, y0 + 6, shade(L.skin, -0.25));
      px(8, y0 + 6, shade(L.skin, -0.25));
      if (L.glasses) r(5, y0 + 4, 6, 1, '#1a1a22'), px(6, y0 + 4, '#8fd3ff'), px(9, y0 + 4, '#8fd3ff');
    } else {
      r(5, y0 + 1, 6, 6, L.hair);
      if (L.hairStyle === 2) r(4, y0 + 1, 8, 8, L.hair), r(5, y0 + 8, 6, 1, L.hair);
    }
  } else {
    // left profile
    r(6, 15 + legA, 3, 6 - legA, O);
    r(8, 15 + legB, 3, 6 - legB, O);
    r(7, 15 + legA, 1, 4, shade(L.pants, -0.15));
    r(9, 15 + legB, 1, 4, L.pants);
    r(6, 15, 4, 2, L.pants);
    r(5, 19 + legA, 4, 2, L.shoes);
    r(7, 19 + legB, 4, 2, L.shoes);
    r(5, 8, 7, 9, O);
    r(6, 9, 5, 7, body);
    r(6, 9, 5, 1, shade(body, 0.2));
    if (L.tie) r(6, 10, 1, 3, L.tie);
    const sw = f === 1 ? -2 : f === 2 ? 2 : 0;
    r(7 + sw, 9, 3, 7, O);
    r(8 + sw, 10, 1, 4, shade(body, -0.15));
    px(8 + sw, 14, L.skin);
    r(4, y0, 8, 9, O);
    r(5, y0 + 1, 6, 7, L.skin);
    r(7, y0 + 1, 4, 3, L.hair);
    r(9, y0 + 1, 2, 6, L.hair);
    if (L.hairStyle === 2) r(9, y0 + 1, 3, 8, L.hair);
    if (L.hairStyle === 1) r(5, y0 + 1, 3, 2, L.hair);
    px(6, y0 + 4, O);
    px(4, y0 + 5, L.skin);
    if (L.glasses) r(5, y0 + 4, 3, 1, '#1a1a22'), px(6, y0 + 4, '#8fd3ff');
  }
}

// ---------------------------------------------------------------- furniture
const WOOD = '#a77b52';
const WOOD_D = '#7a5536';
const MAHOG = '#6e3326';
const MAHOG_D = '#4a1f17';
const METAL = '#9aa1ad';
const METAL_D = '#6a707c';
const DARK = '#2b2e38';

function deskBase(p, w, wood, woodD) {
  p.box(0, 2, w, 13, 8, wood, woodD);
  p.r(2, 9, 6, 3, shade(woodD, -0.2));
  p.r(w - 8, 9, 6, 3, shade(woodD, -0.2));
}
function monitorOn(p, x, y, screen = '#7fc4ff') {
  p.r(x, y, 12, 9, '#1a1a22');
  p.r(x + 1, y + 1, 10, 6, screen);
  p.r(x + 1, y + 1, 10, 1, '#ffffff');
  p.r(x + 5, y + 9, 2, 2, '#1a1a22');
}

/** Each entry: (p, w, h, ctx) draws with origin = top-left of the footprint; `lift` = extra pixels above. */
const FURNITURE = {
  desk: { lift: 18, draw(p, w, h, k) {
    deskBase(p, w * 16, k.wood, k.woodD);
    monitorOn(p, 10, -14);
    p.r(8, -2, 16, 3, '#d8dce4');
    p.r(8, -2, 16, 1, '#ffffff');
    p.r(26, -5, 3, 4, k.mug);
    p.r(3, -4, 4, 3, '#efe9d9');
  } },
  headsetdesk: { lift: 18, draw(p, w, h, k) {
    deskBase(p, w * 16, k.wood, k.woodD);
    monitorOn(p, 6, -14, '#9fe8b0');
    p.r(20, -6, 6, 1, '#1a1a22');
    p.r(19, -6, 2, 4, '#1a1a22');
    p.r(25, -6, 2, 4, '#1a1a22');
    p.r(8, -2, 14, 3, '#d8dce4');
  } },
  tradingdesk: { lift: 18, draw(p, w, h, k) {
    deskBase(p, w * 16, k.wood, k.woodD);
    [1, 11, 21].forEach((x, i) => {
      p.r(x, -13, 10, 9, '#1a1a22');
      p.r(x + 1, -12, 8, 6, '#0d1a12');
      for (let j = 0; j < 7; j++) p.px(x + 1 + j, -8 - ((j * (i + 2)) % 4), i === 1 ? '#e2504a' : '#5fd068');
    });
    p.r(8, -2, 16, 3, '#d8dce4');
  } },
  chair: { lift: 6, solid: false, draw(p, w, h, k) {
    p.r(3, 2, 10, 9, '#1a1a22');
    p.r(4, 3, 8, 7, k.chair);
    p.r(4, 3, 8, 1, shade(k.chair, 0.25));
    p.r(7, 11, 2, 3, '#1a1a22');
    p.r(4, 13, 8, 1, '#1a1a22');
  } },
  chairup: { lift: 2, solid: false, draw(p, w, h, k) {
    p.r(3, 5, 10, 8, '#1a1a22');
    p.r(4, 6, 8, 6, k.chair);
    p.r(4, 6, 8, 1, shade(k.chair, 0.25));
  } },
  bigchair: { lift: 8, solid: false, draw(p) {
    p.r(2, -2, 12, 14, '#1a1a22');
    p.r(3, -1, 10, 12, '#5a2a22');
    p.r(3, -1, 10, 1, '#7a4a3a');
    p.r(4, 6, 8, 4, '#4a2018');
  } },
  meetingtable: { lift: 8, draw(p, w, h, k) {
    const W = w * 16;
    const D = h * 16;
    p.box(1, 4, W - 2, D - 8, 8, k.table, shade(k.table, -0.3));
    for (let i = 0; i < w; i++) {
      p.r(i * 16 + 5, 0, 7, 5, '#efe9d9');
      if (i % 2) p.r(i * 16 + 4, D - 14, 8, 5, '#3a3d48'), p.r(i * 16 + 5, D - 13, 6, 3, '#7fc4ff');
    }
  } },
  boardtable: { lift: 8, draw(p, w, h) {
    const W = w * 16;
    const D = h * 16;
    p.box(1, 4, W - 2, D - 8, 8, MAHOG, MAHOG_D);
    p.r(4, 1, W - 8, 1, 'rgba(255,255,255,0.25)');
    for (let i = 0; i < w; i += 2) p.r(i * 16 + 6, 2, 6, 4, '#efe9d9');
    p.r(W / 2 - 3, D - 14, 6, 6, '#c9a227');
  } },
  whiteboard: { lift: 24, draw(p, w) {
    const W = w * 16;
    p.r(1, -22, W - 2, 20, '#1a1a22');
    p.r(2, -21, W - 4, 18, '#f4f6f8');
    p.r(4, -18, 10, 1, '#2a6ad1');
    p.r(4, -15, 16, 1, '#2a6ad1');
    p.r(16, -18, 8, 6, '#e2504a');
    p.r(17, -17, 6, 4, '#f4f6f8');
    p.r(6, -10, 12, 1, '#2a9d4a');
    p.r(3, -3, W - 6, 2, METAL_D);
    p.px(8, -4, '#e2504a');
    p.px(11, -4, '#2a6ad1');
  } },
  counter: { lift: 10, draw(p) {
    p.box(0, 2, 16, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(3, 6, 4, 1, METAL_D);
    p.r(9, 6, 4, 1, METAL_D);
  } },
  coffeemachine: { lift: 22, draw(p) {
    p.box(0, 2, 16, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(3, -18, 10, 15, '#1a1a22');
    p.r(4, -17, 8, 13, '#3a3d48');
    p.r(5, -16, 6, 3, METAL);
    p.r(10, -12, 1, 1, '#e2504a');
    p.r(6, -8, 4, 4, '#f4f1e8');
    p.r(7, -7, 2, 1, '#6b4a32');
  } },
  espressobar: { lift: 22, draw(p) {
    p.box(0, 2, 16, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(2, -14, 12, 11, '#1a1a22');
    p.r(3, -13, 10, 9, '#c8ccd4');
    p.r(3, -13, 10, 2, '#ffffff');
    p.r(5, -9, 2, 3, DARK);
    p.r(9, -9, 2, 3, DARK);
    p.r(6, -19, 1, 4, 'rgba(255,255,255,0.5)');
    p.r(8, -20, 1, 5, 'rgba(255,255,255,0.4)');
  } },
  microwave: { lift: 18, draw(p) {
    p.box(0, 2, 16, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(1, -14, 14, 11, '#1a1a22');
    p.r(2, -13, 12, 9, '#e8e6e0');
    p.r(3, -12, 7, 7, '#2b2e38');
    p.r(11, -12, 2, 1, '#5fd068');
  } },
  fridge: { lift: 26, draw(p) {
    p.box(1, 2, 14, 12, 26, '#e8eaee', '#d4d8de');
    p.r(2, -11, 12, 1, '#a4a8b0');
    p.r(12, -20, 1, 6, METAL_D);
    p.r(12, -8, 1, 8, METAL_D);
    p.r(4, -18, 3, 3, '#f2c14e');
  } },
  vending: { lift: 26, draw(p) {
    p.box(1, 2, 14, 12, 26, '#a33b3b', '#c94a4a');
    p.r(3, -12, 8, 18, '#1a1a22');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) p.r(4 + x * 2 + (y % 2), -11 + y * 4, 1, 2, ['#f2c14e', '#5fd068', '#7fc4ff', '#f29c38'][(x + y) % 4]);
    p.r(12, -8, 1, 4, '#f2c14e');
  } },
  watercooler: { lift: 22, draw(p) {
    p.box(3, 4, 10, 8, 12, '#e8eaee', '#d4d8de');
    p.r(4, -20, 8, 12, '#1a1a22');
    p.r(5, -19, 6, 10, '#7fc4ff');
    p.r(5, -19, 2, 10, '#b8e0ff');
    p.r(6, -2, 1, 2, '#2a6ad1');
    p.r(9, -2, 1, 2, '#e2504a');
  } },
  kitchentable: { lift: 8, draw(p) {
    p.box(1, 3, 30, 10, 8, '#e8e6e0', '#b8b4aa');
    p.r(8, -2, 4, 3, '#f4f1e8');
    p.r(20, -3, 5, 3, '#e2504a');
  } },
  stool: { lift: 4, solid: false, draw(p, w, h, k) {
    p.r(4, 4, 8, 6, '#1a1a22');
    p.r(5, 5, 6, 4, k.chair);
    p.r(7, 10, 2, 3, '#1a1a22');
  } },
  plant: { lift: 16, draw(p) {
    p.box(4, 6, 8, 6, 6, '#b5653a', '#8a4a2a');
    p.r(2, -12, 12, 12, '#1a1a22');
    p.r(3, -11, 10, 10, '#3f8f3f');
    p.r(5, -14, 6, 4, '#1a1a22');
    p.r(6, -13, 4, 3, '#4fa94f');
    p.r(4, -9, 3, 2, '#6fcf6f');
    p.r(9, -6, 3, 2, '#6fcf6f');
    p.r(7, -12, 2, 1, '#8fe08f');
  } },
  sofa: { lift: 8, draw(p, w, h, k) {
    const W = w * 16;
    const D = h * 16;
    p.box(1, 3, W - 2, D - 5, 8, k.sofa, shade(k.sofa, -0.3));
    p.r(3, -3, W - 6, 2, shade(k.sofa, 0.2));
    if (h > 1) p.r(2, D / 2 - 4, W - 4, 1, shade(k.sofa, -0.35));
    else p.r(W / 2, -4, 1, D - 4, shade(k.sofa, -0.35));
  } },
  directory: { lift: 22, draw(p, w, h, k) {
    p.r(7, 2, 2, 10, DARK);
    p.r(1, -20, 14, 18, '#1a1a22');
    p.r(2, -19, 12, 16, k.accentDark);
    for (let i = 0; i < 6; i++) p.r(4, -17 + i * 2.5, 8, 1, '#f4f1e8');
  } },
  elevator: { lift: 26, draw(p, w, h, k) {
    const W = w * 16;
    p.r(0, -24, W, 36, '#1a1a22');
    p.r(1, -23, W - 2, 34, METAL_D);
    p.r(3, -18, W - 6, 29, '#1a1a22');
    p.r(4, -17, W / 2 - 4, 27, METAL);
    p.r(W / 2 + 1, -17, W / 2 - 5, 27, METAL);
    p.r(4, -17, W / 2 - 4, 1, '#d0d6e0');
    p.r(W / 2 + 1, -17, W / 2 - 5, 1, '#d0d6e0');
    p.r(W / 2 - 4, -23, 8, 5, '#1a1a22');
    p.r(W / 2 - 3, -22, 6, 3, k.accent);
    p.r(W + 0, -6, 0, 0, DARK);
  } },
  bookshelf: { lift: 24, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 10, 24, WOOD_D, WOOD);
    const cols = ['#a33b3b', '#2a6ad1', '#2a9d4a', '#c9a227', '#7a3bb6', '#e8e6e0'];
    for (let row = 0; row < 3; row++) {
      p.r(1, -19 + row * 8, W - 2, 1, WOOD_D);
      for (let x = 2; x < W - 3; x += 3) p.r(x, -18 + row * 8, 2, 6, cols[(x + row * 3) % cols.length]);
    }
  } },
  trophy: { lift: 18, draw(p) {
    p.box(2, 4, 12, 9, 10, WOOD, WOOD_D);
    p.r(5, -14, 6, 5, '#f2c14e');
    p.r(7, -9, 2, 3, '#c9a227');
    p.r(5, -6, 6, 1, '#c9a227');
  } },
  bossdesk: { lift: 18, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 13, 9, MAHOG, MAHOG_D);
    p.r(2, 8, W - 4, 1, '#c9a227');
    p.r(W / 2 - 8, -12, 16, 10, '#1a1a22');
    p.r(W / 2 - 7, -11, 14, 7, '#9fd0ff');
    p.r(4, -4, 6, 3, '#1a1a22');
    p.r(W - 12, -4, 8, 3, '#c9a227');
    p.r(W - 11, -3, 6, 1, '#1a1a22');
  } },
  printer: { lift: 16, draw(p) {
    p.box(0, 3, 16, 11, 14, '#d8dce4', '#b8bcc4');
    p.r(3, -9, 10, 2, '#1a1a22');
    p.r(4, -14, 8, 5, '#f4f6f8');
    p.r(12, -3, 2, 1, '#5fd068');
    p.r(3, 1, 10, 2, '#f4f6f8');
  } },
  copier: { lift: 18, draw(p) {
    p.box(0, 3, 32, 11, 16, '#d8dce4', '#b8bcc4');
    p.r(3, -11, 18, 4, '#3a3d48');
    p.r(24, -10, 5, 3, '#1a1a22');
    p.r(25, -9, 3, 1, '#5fd068');
    p.r(4, 2, 24, 1, METAL_D);
    p.r(4, 6, 24, 1, METAL_D);
  } },
  shredder: { lift: 12, draw(p) {
    p.box(3, 4, 10, 9, 12, '#3a3d48', '#2b2e38');
    p.r(5, -7, 6, 1, '#1a1a22');
    p.r(5, -10, 1, 3, '#f4f6f8');
    p.r(7, -11, 1, 4, '#f4f6f8');
    p.r(9, -9, 1, 2, '#f4f6f8');
  } },
  boxes: { lift: 14, draw(p) {
    p.box(1, 5, 14, 9, 7, '#c9a26b', '#a8824e');
    p.box(3, -1, 10, 7, 7, '#d4b07a', '#b08a56');
    p.r(7, -8, 2, 6, '#e8d4a8');
  } },
  filing: { lift: 20, draw(p) {
    p.box(2, 3, 12, 10, 20, '#8a919d', '#a4abb7');
    for (let i = 0; i < 3; i++) {
      p.r(3, -9 + i * 7, 10, 1, '#5a606c');
      p.r(7, -6 + i * 7, 2, 1, '#1a1a22');
    }
  } },
  toilet: { lift: 14, draw(p) {
    p.r(0, -12, 2, 24, '#8a919d');
    p.r(14, -12, 2, 24, '#8a919d');
    p.box(4, 0, 8, 6, 8, '#f4f6f8', '#d8dce4');
    p.r(4, 5, 8, 7, '#1a1a22');
    p.r(5, 6, 6, 5, '#f4f6f8');
    p.r(6, 7, 4, 3, '#c8d4dc');
  } },
  sink: { lift: 18, draw(p) {
    p.r(2, -18, 12, 8, '#1a1a22');
    p.r(3, -17, 10, 6, '#c8e4f4');
    p.r(3, -17, 3, 6, '#e8f4fc');
    p.box(1, 2, 14, 10, 8, '#f4f6f8', '#d8dce4');
    p.r(4, -2, 8, 3, '#a8c8dc');
    p.r(7, -6, 2, 3, METAL);
  } },
  fountain: { lift: 14, draw(p) {
    p.box(1, 4, 30, 24, 8, '#b8b0a0', '#968e7e');
    p.r(4, -1, 24, 18, '#3a7ab8');
    p.r(6, 1, 8, 2, '#7fc4ff');
    p.r(18, 9, 6, 2, '#7fc4ff');
    p.r(14, -10, 4, 16, '#968e7e');
    p.r(13, -12, 6, 3, '#b8b0a0');
    p.r(15, -16, 2, 4, '#b8e0ff');
  } },
  reception: { lift: 18, draw(p, w, h, k) {
    const W = w * 16;
    p.box(0, 2, W, 13, 12, '#e8e6e0', k.accent);
    p.r(1, 6, W - 2, 2, k.accentLight);
    p.r(W / 2 - 6, 9, 12, 4, '#f4f1e8');
    p.r(W / 2 - 4, 10, 8, 2, k.accent);
    monitorOn(p, 8, -16);
    p.r(W - 16, -4, 8, 3, '#1a1a22');
    p.r(W - 30, -5, 4, 4, '#f2c14e');
  } },
  serverrack: { lift: 26, draw(p) {
    p.box(1, 2, 14, 12, 26, '#1f2229', '#2b2e38');
    for (let i = 0; i < 6; i++) {
      p.r(3, -11 + i * 3.5, 10, 2, '#16181e');
      p.r(10, -11 + i * 3.5, 1, 1, i % 2 ? '#5fd068' : '#f2c14e');
    }
  } },
  mailshelf: { lift: 22, draw(p) {
    p.box(0, 2, 16, 10, 22, WOOD_D, WOOD);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      p.r(2 + x * 4, -17 + y * 5, 3, 4, '#5a3a22');
      if ((x + y) % 2) p.r(2 + x * 4, -15 + y * 5, 3, 2, '#f4f1e8');
    }
  } },
  gong: { lift: 22, draw(p) {
    p.r(1, -20, 2, 32, WOOD_D);
    p.r(13, -20, 2, 32, WOOD_D);
    p.r(1, -21, 14, 2, WOOD_D);
    p.r(3, -17, 10, 10, '#1a1a22');
    p.r(4, -16, 8, 8, '#e0b030');
    p.r(6, -14, 3, 3, '#f8d860');
  } },
  easel: { lift: 24, draw(p) {
    p.r(3, -6, 1, 18, WOOD_D);
    p.r(12, -6, 1, 18, WOOD_D);
    p.r(7, -4, 2, 14, WOOD_D);
    p.r(1, -22, 14, 17, '#1a1a22');
    p.r(2, -21, 12, 15, '#f4f6f8');
    p.r(4, -18, 4, 4, '#e2504a');
    p.r(8, -14, 4, 5, '#2a6ad1');
    p.r(4, -9, 8, 1, '#2a9d4a');
  } },
  camera: { lift: 18, draw(p) {
    p.r(7, -4, 2, 14, DARK);
    p.r(3, 9, 10, 1, DARK);
    p.r(3, -12, 10, 8, '#1a1a22');
    p.r(4, -11, 8, 6, '#3a3d48');
    p.r(1, -10, 3, 4, '#1a1a22');
    p.r(11, -11, 1, 1, '#e2504a');
  } },
  beanbag: { lift: 4, solid: false, draw(p, w, h, k) {
    p.r(2, 3, 12, 10, '#1a1a22');
    p.r(3, 4, 10, 8, k.sofa);
    p.r(4, 4, 5, 2, shade(k.sofa, 0.3));
  } },
  tvscreen: { lift: 24, draw(p, w) {
    const W = w * 16;
    p.r(1, -22, W - 2, 18, '#1a1a22');
    p.r(2, -21, W - 4, 15, '#0d1a2a');
    for (let i = 0; i < W - 8; i++) p.px(4 + i, -10 - Math.round(Math.sin(i / 3) * 2 + i / 5), '#5fd068');
    p.r(4, -19, 10, 1, '#f4f1e8');
  } },
};

export function furnitureDef(type) {
  return FURNITURE[type];
}

/** Bakes a furniture item into a canvas. Returns { canvas, ox, oy } — draw at (tileX*16 + ox, tileY*16 + oy). */
export function bakeFurniture(type, w, h, kit) {
  const def = FURNITURE[type];
  if (!def) return null;
  const lift = def.lift + 2;
  const [c, g] = makeCanvas(w * TILE, h * TILE + lift);
  g.translate(0, lift);
  def.draw(P(g), w, h, kit);
  return { canvas: c, ox: 0, oy: -lift };
}

// ---------------------------------------------------------------- floors & walls
function noiseAt(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Draws one 16×16 floor tile of a given style at (x, y) px. */
export function drawFloorTile(g, style, x, y, tx, ty, carpet) {
  const { r } = P(g);
  switch (style) {
    case 'corridor': {
      r(x, y, 16, 16, '#a3a6ae');
      r(x, y, 16, 1, '#8f929a');
      r(x, y, 1, 16, '#8f929a');
      if (noiseAt(tx, ty) < 0.25) r(x + 5, y + 7, 2, 1, '#9a9da5');
      break;
    }
    case 'tile': {
      const alt = (tx + ty) % 2 === 0;
      r(x, y, 16, 16, alt ? '#dcdbd2' : '#c9c8bf');
      r(x, y, 16, 1, '#b8b7ae');
      r(x, y, 1, 16, '#b8b7ae');
      break;
    }
    case 'bathroom': {
      const alt = (tx + ty) % 2 === 0;
      r(x, y, 16, 16, alt ? '#cfdde6' : '#bccbd6');
      r(x, y, 16, 1, '#aab9c4');
      r(x, y, 1, 16, '#aab9c4');
      break;
    }
    case 'marble': {
      r(x, y, 16, 16, (tx + ty) % 2 ? '#d8d2c4' : '#cfc8b8');
      if (noiseAt(tx, ty, 2) < 0.5) r(x + 2, y + Math.floor(noiseAt(tx, ty, 3) * 14), 9, 1, '#bdb5a3');
      r(x, y, 16, 1, '#c2baa8');
      r(x, y, 1, 16, '#c2baa8');
      break;
    }
    case 'server': {
      r(x, y, 16, 16, '#3a3f48');
      r(x, y, 16, 1, '#2b2f36');
      r(x, y, 1, 16, '#2b2f36');
      r(x + 3, y + 3, 1, 1, '#4f5560');
      r(x + 12, y + 12, 1, 1, '#4f5560');
      break;
    }
    case 'parquet': {
      const vert = (Math.floor(tx / 1) + Math.floor(ty / 1)) % 2 === 0;
      r(x, y, 16, 16, '#9a6b42');
      for (let i = 0; i < 4; i++) {
        if (vert) r(x + i * 4, y, 1, 16, '#7f5533');
        else r(x, y + i * 4, 16, 1, '#7f5533');
      }
      break;
    }
    default: {
      // carpet
      r(x, y, 16, 16, carpet[(tx + ty) % 2]);
      for (let i = 0; i < 6; i++) {
        const n = noiseAt(tx * 7 + i, ty * 13 + i);
        r(x + Math.floor(n * 16), y + Math.floor(noiseAt(tx + i, ty * 3) * 16), 1, 1, shade(carpet[0], n < 0.5 ? -0.08 : 0.08));
      }
    }
  }
}

export function floorStyleForRoom(roomType, deptId) {
  switch (roomType) {
    case 'kitchen': return 'tile';
    case 'restroom': return 'bathroom';
    case 'elevator':
    case 'reception': return 'marble';
    case 'copy': return 'tile';
    case 'manager': return deptId === 'exec' ? 'parquet' : 'carpet';
    case 'special': return deptId === 'it' ? 'server' : deptId === 'exec' ? 'parquet' : 'carpet';
    default: return 'carpet';
  }
}

/** Wall tile: top face shifted up by WALL_H, front face shown when the tile below is open. */
export function drawWallTile(g, x, y, opts) {
  const { r } = P(g);
  const { top, front, openBelow, openAbove, openLeft, openRight, window: win, tx } = opts;
  const ty = y - WALL_H;
  r(x, ty, 16, 16, top);
  if (openAbove) r(x, ty, 16, 1, shade(top, 0.3));
  if (openLeft) r(x, ty, 1, 16, shade(top, -0.3));
  if (openRight) r(x + 15, ty, 1, 16, shade(top, -0.3));
  if (openBelow) {
    const fy = y + 16 - WALL_H;
    r(x, fy, 16, WALL_H, front);
    r(x, fy, 16, 1, shade(front, 0.2));
    r(x, fy + WALL_H - 2, 16, 2, shade(front, -0.35));
    if (openLeft) r(x, fy, 1, WALL_H, shade(front, -0.2));
    if (openRight) r(x + 15, fy, 1, WALL_H, shade(front, -0.2));
    if (win) {
      r(x + 1, fy + 1, 14, WALL_H - 4, '#1a1a22');
      r(x + 2, fy + 2, 12, WALL_H - 6, '#8ec5f0');
      r(x + 2, fy + 2, 12, 1, '#c8e6fa');
      const hgt = 2 + Math.floor(noiseAt(tx, 1) * 4);
      r(x + 2 + (tx % 3) * 3, fy + WALL_H - 4 - hgt, 3, hgt, '#5a7a9a');
    }
  }
}
