// Procedural pixel art: characters, furniture and floor tiles, baked into offscreen canvases once.
// 2.5D convention (C-Dogs style): an object with ground footprint (x, y, w, d) and height h draws its top face
// at (x, y - h) and its front face at (x, y + d - h, w, h). Everything is drawn in 1px units at 16px/tile.
import { makeCanvas } from './screen.js';
import { turnstilePosts } from '../core/floorgen.js';
import { drawText, measureText } from './font.js';

export const TILE = 16;
export const WALL_H = 12;
export const OUTER_RISE = 12; // the outer wall (the map's top row) stands this much taller, for its windows
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
 * look: { skin, hair, hairStyle 0-3, shirt, pants, tie|null, jacket|null, shoes, skirt?, tights? }
 * With `skirt` (a colour) the figure is a woman's: a narrower waist, a knee-length flared skirt, then tights (or bare
 * legs) and shoes.
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
  const S = L.skirt;
  const legs = L.tights || L.skin;
  // A Santa hat (the Christmas party): a red cap over the hair, a white trim on the brow, the pompom on one side.
  const hat = (look) => {
    if (look.hat === 'cap') {
      // A security cap (the roof's facilities guard): navy crown, a badge, the peak towards the facing side.
      r(4, y0 - 1, 8, 3, O);
      r(5, y0, 6, 1, '#2b3550');
      r(4, y0 + 1, 8, 1, '#1a2238');
      px(8, y0, '#f2c230');
      if (dir === 'down') r(4, y0 + 2, 8, 1, '#1a2238');
      else if (dir === 'left') r(2, y0 + 1, 3, 1, '#1a2238');
      else if (dir === 'right') r(11, y0 + 1, 3, 1, '#1a2238');
      return;
    }
    if (look.hat !== 'santa') return;
    r(4, y0 - 1, 8, 3, O);
    r(5, y0, 6, 1, '#d8343a');
    r(4, y0 + 1, 8, 1, '#f4f1e8');
    r(12, y0 - 1, 2, 2, '#f4f1e8');
  };
  if (dir === 'down' || dir === 'up') {
    if (S) {
      // legs below the skirt
      r(5, 17 + legA, 3, 4 - legA, O);
      r(8, 17 + legB, 3, 4 - legB, O);
      r(6, 17 + legA, 1, 2, legs);
      r(9, 17 + legB, 1, 2, legs);
      r(5, 19 + legA, 3, 2, L.shoes);
      r(8, 19 + legB, 3, 2, L.shoes);
      // torso, narrowing to the waist
      r(3, 8, 10, 5, O);
      r(4, 13, 8, 1, O);
      r(4, 9, 8, 4, body);
      r(5, 13, 6, 1, body);
      r(4, 9, 8, 1, shade(body, 0.2));
      // the skirt flares from the waistband to just above the knee, so a strip of leg shows above the shoes
      r(4, 14, 8, 1, O);
      r(3, 15, 10, 1, O);
      r(2, 16, 12, 2, O);
      r(5, 14, 6, 1, shade(S, -0.2));
      r(4, 15, 8, 1, S);
      r(3, 16, 10, 1, S);
    } else {
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
    }
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
      if (L.hairStyle === 1) r(5, y0 + 3, 3, 1, L.hair); // side-swept fringe, ending above the eyes
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
    hat(L);
  } else {
    // left profile
    if (S) {
      r(6, 17 + legA, 3, 4 - legA, O);
      r(8, 17 + legB, 3, 4 - legB, O);
      r(7, 17 + legA, 1, 2, shade(legs, -0.15));
      r(9, 17 + legB, 1, 2, legs);
      r(5, 19 + legA, 4, 2, L.shoes);
      r(7, 19 + legB, 4, 2, L.shoes);
      r(5, 8, 7, 6, O);
      r(6, 9, 5, 5, body);
      r(6, 9, 5, 1, shade(body, 0.2));
      r(5, 14, 7, 1, O);
      r(4, 15, 9, 1, O);
      r(3, 16, 11, 2, O);
      r(6, 14, 5, 1, shade(S, -0.2));
      r(5, 15, 7, 1, S);
      r(4, 16, 9, 1, S);
    } else {
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
    }
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
    hat(L);
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

/** Lobby security gates: a steel post in its own tile (see turnstilePosts) between lanes of glass flaps (open = flaps folded away, green lights). */
function turnstile(p, w, open) {
  const W = w * 16;
  const posts = turnstilePosts(w).map((k) => k * 16 + 5);
  const edges = [0, ...posts.flatMap((x) => [x, x + 6]), W];
  const glass = 'rgba(170,215,255,0.55)';
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i];
    const gap = edges[i + 1] - a;
    if (open) {
      p.r(a, -5, 3, 7, glass);
      p.r(a + gap - 3, -5, 3, 7, glass);
    } else {
      p.r(a, -5, gap, 7, glass);
      p.r(a, -5, gap, 1, '#e8f4ff');
      p.r(a + gap / 2 - 1, -5, 2, 7, 'rgba(226,80,74,0.6)');
    }
  }
  for (const x of posts) {
    p.box(x, 2, 6, 10, 12, METAL, METAL_D);
    p.r(x + 2, -7, 2, 2, open ? '#5fd068' : '#e2504a');
  }
}

/** Each entry: (p, w, h, ctx) draws with origin = top-left of the footprint; `lift` = extra pixels above. */
/** An archive cabinet filling its tile: four drawers with label cards; `open` pulls the second one out. */
function archiveCabinet(p, open) {
  p.box(0, 2, 16, 10, 28, '#7a808c', '#949aa6');
  for (let i = 0; i < 4; i++) {
    const y = -16 + i * 7;
    p.r(1, y + 6, 14, 1, '#5a606c');
    p.r(5, y + 2, 6, 3, '#e8e2c8');
    p.r(7, y + 5, 2, 1, '#1a1a22');
  }
  if (!open) return;
  // Drawer 2 pulled out (its front a little lower and lighter), folders showing in the gap above it.
  p.r(1, -9, 14, 3, '#1a1a22');
  p.r(2, -10, 2, 3, '#f4f6f8');
  p.r(5, -11, 3, 4, '#e8c46a');
  p.r(9, -10, 2, 3, '#f4f6f8');
  p.r(12, -11, 2, 4, '#c8d4dc');
  p.box(1, -1, 14, 2, 7, '#a4abb7', '#b4bbc7');
  p.r(5, -4, 6, 3, '#e8e2c8');
  p.r(7, -1, 2, 1, '#1a1a22');
}

const FURNITURE = {
  desk: { lift: 18, draw(p, w, h, k) {
    deskBase(p, w * 16, k.wood, k.woodD);
    monitorOn(p, 10, -14);
    p.r(8, -2, 16, 3, '#d8dce4');
    p.r(8, -2, 16, 1, '#ffffff');
    p.r(26, -5, 3, 4, k.mug);
    p.r(3, -4, 4, 3, '#efe9d9');
  } },
  // Your own desk (core/desk.js): tidy, with a nameplate; decorations are drawn on top by drawDeskDecor.
  mydesk: { lift: 18, draw(p, w, h, k) {
    const W = w * 16;
    deskBase(p, W, k.wood, k.woodD);
    monitorOn(p, W / 2 - 6, -14);
    p.r(W / 2 - 7, -1, 14, 3, '#d8dce4');
    p.r(W / 2 - 7, -1, 14, 1, '#ffffff');
    p.r(W / 2 - 7, 9, 14, 4, '#1a1a22');
    p.r(W / 2 - 6, 10, 12, 2, '#d9b45a');
    p.r(W / 2 - 4, 10, 8, 1, '#7a5a1e');
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
  chair: { lift: 8, solid: false, draw(p, w, h, k) {
    // Office chair seen from behind: backrest, seat, gas lift, star base.
    p.r(4, -3, 8, 8, '#1a1a22');
    p.r(5, -2, 6, 6, k.chair);
    p.r(5, -2, 6, 1, shade(k.chair, 0.3));
    p.r(3, 5, 10, 4, '#1a1a22');
    p.r(4, 6, 8, 2, '#3a3f4e');
    p.r(7, 9, 2, 3, '#1a1a22');
    p.r(4, 12, 8, 1, '#1a1a22');
    p.px(3, 13, '#1a1a22');
    p.px(12, 13, '#1a1a22');
  } },
  chairup: { lift: 2, solid: false, draw(p, w, h, k) {
    // Chair facing up (we see the seat and the backrest at the bottom).
    p.r(3, 3, 10, 6, '#1a1a22');
    p.r(4, 4, 8, 4, '#3a3f4e');
    p.r(4, 8, 8, 6, '#1a1a22');
    p.r(5, 9, 6, 4, k.chair);
    p.r(5, 9, 6, 1, shade(k.chair, 0.3));
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
  turnstile: { lift: 12, solid: false, draw: (p, w) => turnstile(p, w, false) },
  turnstileopen: { lift: 12, solid: false, draw: (p, w) => turnstile(p, w, true) },
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
  hrdesk: { lift: 18, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 13, 9, '#c9a77a', '#9a7a52');
    p.r(W / 2 - 9, 8, 18, 5, '#f4f1e8');
    p.r(W / 2 - 7, 9, 3, 3, '#7a3bb6');
    p.r(W / 2 - 3, 9, 3, 3, '#7a3bb6');
    p.r(W / 2 + 1, 9, 5, 1, '#7a3bb6');
    p.r(W / 2 + 1, 11, 5, 1, '#7a3bb6');
    p.r(6, -12, 14, 10, '#1a1a22');
    p.r(7, -11, 12, 7, '#c8b8f0');
    p.r(24, -5, 8, 4, '#efe9d9');
    p.r(24, -7, 8, 2, '#f4f6f8');
    p.r(W - 14, -6, 8, 5, '#7fc4ff');
    p.r(W - 12, -9, 4, 3, '#ffffff');
  } },
  poster: { lift: 24, draw(p, w) {
    const W = w * 16;
    p.r(3, -22, W - 6, 19, '#1a1a22');
    p.r(4, -21, W - 8, 17, '#2a6a9a');
    p.r(6, -19, W - 12, 8, '#f2c14e');
    p.r(W / 2 - 3, -17, 6, 4, '#e2504a');
    p.r(7, -9, W - 14, 1, '#f4f1e8');
    p.r(9, -7, W - 18, 1, '#f4f1e8');
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
  // The archive's tall HR cabinets (core/archive.js), one per tile so they stand in long rows; tall enough to block light.
  archivecab: { lift: 26, draw(p) {
    archiveCabinet(p, false);
  } },
  // A cabinet already gone through: its second drawer left pulled out, papers sticking up.
  archivecabopen: { lift: 26, draw(p) {
    archiveCabinet(p, true);
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
  // ------------------------------------------------ the vacation hotel (core/hotel.js)
  hotelbed: { lift: 16, draw(p, w, h) {
    const W = w * 16;
    const D = h * 16;
    p.box(0, -2, W, 6, 14, '#8a5a3a', '#6e4529');
    p.r(3, -12, W - 6, 2, '#a8744c');
    p.box(1, 4, W - 2, D - 6, 7, '#f4f1e8', '#d8d2c4');
    p.r(5, -2, 14, 6, '#1a1a22');
    p.r(6, -1, 12, 4, '#ffffff');
    p.r(W - 19, -2, 14, 6, '#1a1a22');
    p.r(W - 18, -1, 12, 4, '#ffffff');
    p.r(2, 7, W - 4, D - 16, '#2fa39a');
    p.r(2, 7, W - 4, 2, '#5fd0c8');
    p.r(2, D - 11, W - 4, 2, '#24857e');
    // A towel swan on the duvet.
    p.r(W / 2 - 5, 13, 10, 4, '#ffffff');
    p.r(W / 2 + 2, 9, 2, 5, '#ffffff');
    p.r(W / 2 + 3, 9, 2, 1, '#f29c38');
  } },
  nightstand: { lift: 14, draw(p) {
    p.box(2, 5, 12, 9, 9, '#8a5a3a', '#6e4529');
    p.r(4, 6, 8, 1, '#4a2f1c');
    p.r(7, -9, 2, 5, '#4a2f1c');
    p.r(4, -13, 8, 5, '#1a1a22');
    p.r(5, -12, 6, 3, '#f6dc8a');
  } },
  wardrobe: { lift: 26, draw(p, w) {
    const W = w * 16;
    p.box(1, 3, W - 2, 10, 26, '#8a5a3a', '#6e4529');
    p.r(W / 2, -13, 1, 22, '#4a2f1c');
    p.r(W / 2 - 3, -3, 1, 4, '#d9b25c');
    p.r(W / 2 + 3, -3, 1, 4, '#d9b25c');
  } },
  suitcase: { lift: 12, draw(p) {
    p.box(3, 6, 10, 6, 11, '#c74634', '#9a3326');
    p.r(6, -6, 4, 2, '#1a1a22');
    p.r(4, 2, 8, 1, '#f2c14e');
    p.r(9, 4, 3, 3, '#f4f1e8');
  } },
  rug: { lift: 0, solid: false, draw(p, w, h) {
    const W = w * 16;
    const D = h * 16;
    p.r(2, 2, W - 4, D - 4, '#c9a14a');
    p.r(4, 4, W - 8, D - 8, '#b5653a');
    p.r(8, 8, W - 16, D - 16, '#e6c46a');
    for (let x = 4; x < W - 4; x += 4) p.px(x, 2, '#f4f1e8'), p.px(x, D - 3, '#f4f1e8');
  } },
  pottedpalm: { lift: 22, draw(p) {
    p.box(4, 6, 8, 6, 7, '#e6d3ad', '#c9b48a');
    p.r(7, -10, 2, 10, '#8a6a3a');
    for (const [x, y, w] of [[1, -16, 6], [9, -16, 6], [3, -19, 10], [0, -13, 4], [12, -13, 4]]) p.r(x, y, w, 3, '#2f8a3a');
    p.r(4, -18, 8, 1, '#5fbf5a');
  } },
  palm: { lift: 42, draw(p) {
    p.r(4, 10, 9, 3, 'rgba(0,0,0,0.18)');
    for (let i = 0; i < 9; i++) p.r(6 + Math.round(Math.sin(i / 3) * 1.5), 10 - i * 4, 4, 4, i % 2 ? '#9a7442' : '#8a6a3a');
    const cx = 8;
    const cy = -26;
    for (const [dx, dy, w, h] of [[-9, -4, 9, 3], [1, -4, 9, 3], [-8, -8, 7, 3], [2, -8, 7, 3], [-3, -11, 6, 4], [-11, 0, 5, 3], [7, 0, 5, 3]])
      p.r(cx + dx, cy + dy, w, h, '#2f8a3a');
    for (const [dx, dy, w] of [[-9, -4, 8], [2, -4, 8], [-3, -11, 6]]) p.r(cx + dx, cy + dy, w, 1, '#5fbf5a');
    p.r(cx - 3, cy - 1, 3, 3, '#6b4a22');
    p.r(cx + 1, cy, 3, 3, '#6b4a22');
  } },
  bellcart: { lift: 20, draw(p) {
    p.box(1, 10, 14, 4, 2, '#d9b25c', '#a8862f');
    p.r(2, -16, 1, 26, '#d9b25c');
    p.r(13, -16, 1, 26, '#d9b25c');
    p.r(2, -17, 12, 2, '#d9b25c');
    p.r(4, -2, 8, 10, '#3b6fb6');
    p.r(4, -9, 7, 7, '#c74634');
    p.r(5, 9, 2, 2, '#1a1a22');
    p.r(10, 9, 2, 2, '#1a1a22');
  } },
  buffet: { lift: 16, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 12, 10, '#f4f1e8', '#d8d2c4');
    p.r(1, 6, W - 2, 2, '#2fa39a');
    // Sneeze guard, then the dishes along the counter.
    p.r(2, -14, W - 4, 1, 'rgba(200,235,255,0.7)');
    const dishes = [['#e2504a', '#ffd0c8'], ['#5fd068', '#f2e14e'], ['#f2c14e', '#ffffff'], ['#f29c38', '#ffffff'], ['#8a4a2a', '#f29cd0'], ['#7fc4ff', '#ffffff']];
    for (let i = 0; i < w; i++) {
      const x = i * 16 + 2;
      const [a, b] = dishes[i % dishes.length];
      p.r(x, -6, 12, 6, '#c8ccd4');
      p.r(x + 1, -7, 10, 4, a);
      p.r(x + 3, -8, 3, 2, b);
      p.r(x + 7, -6, 3, 2, b);
    }
    // The chef's tall hat on a stand in the middle.
    p.r(W / 2 - 1, -15, 2, 6, '#c8ccd4');
  } },
  diningtable: { lift: 10, draw(p, w) {
    const W = w * 16;
    p.box(1, 3, W - 2, 11, 9, '#ffffff', '#e2ddd0');
    p.r(5, -3, 6, 4, '#d8d2c4');
    p.r(W - 11, -3, 6, 4, '#d8d2c4');
    p.r(W / 2 - 1, -9, 2, 5, '#f4f1e8');
    p.r(W / 2 - 1, -11, 2, 2, '#f2c14e');
  } },
  beachball: { lift: 10, draw(p) {
    p.r(3, 9, 10, 3, 'rgba(0,0,0,0.2)');
    p.r(4, -2, 8, 12, '#1a1a22');
    p.r(2, 0, 12, 8, '#1a1a22');
    p.r(5, -1, 3, 10, '#e2504a');
    p.r(8, -1, 3, 10, '#3b6fb6');
    p.r(3, 1, 2, 6, '#f2c14e');
    p.r(11, 1, 2, 6, '#ffffff');
    p.r(6, 0, 2, 2, '#ffffff');
  } },
  // ------------------------------------------------ the Christmas party hall (core/partyHall.js)
  stage: { lift: 14, draw(p, w, h) {
    const W = w * 16;
    const D = (h || 2) * 16;
    p.box(0, 0, W, D, 6, '#7a4a30', '#4a2c1c');
    for (let y = -1; y < D - 6; y += 4) p.r(1, y, W - 2, 1, '#6a3e28'); // planks
    p.r(W / 2 - 22, -4, 44, D - 8, '#a8242a'); // the red carpet
    p.r(W / 2 - 22, -4, 44, 1, '#c8343a');
    p.r(W / 2 - 22, D - 5, 44, 1, '#7a1a20');
    p.r(W / 2 - 22, -4, 1, D - 8, '#f2c14e');
    p.r(W / 2 + 21, -4, 1, D - 8, '#f2c14e');
    for (let x = 6; x < W - 6; x += 10) { // footlights along the front edge
      p.r(x, D - 5, 5, 2, '#f2e14e');
      p.r(x + 1, D - 6, 3, 1, '#fff6c8');
    }
    for (const x of [1, W - 8]) { // drapes at the back corners
      p.r(x, -14, 7, 16, '#8a1a22');
      for (let i = 1; i < 7; i += 2) p.r(x + i, -13, 1, 15, '#a8242a');
      p.r(x, 2, 7, 2, '#f2c14e');
    }
    p.r(0, -14, W, 2, '#f2c14e'); // gold valance
    for (let x = 4; x < W - 4; x += 8) p.r(x, -12, 4, 2, '#d8343a');
  } },
  micstand: { lift: 18, draw(p) {
    p.r(4, 11, 8, 2, 'rgba(0,0,0,0.25)');
    p.r(4, 9, 8, 3, '#1a1a22'); // tripod foot
    p.r(5, 10, 6, 1, '#4a4f5c');
    p.r(7, -12, 2, 21, '#1a1a22'); // the pole
    p.r(7, -12, 1, 21, '#4a4f5c');
    p.r(5, -18, 6, 7, '#1a1a22'); // the microphone
    p.r(6, -17, 4, 5, '#9aa1ad');
    p.r(6, -17, 4, 1, '#d4d8de');
    p.r(7, -16, 1, 3, '#6a707c');
    p.r(6, -11, 4, 1, '#d8343a'); // a bit of tinsel
    p.r(5, -10, 1, 2, '#f2c14e');
    p.r(10, -10, 1, 2, '#2f8a3a');
  } },
  djbooth: { lift: 20, draw(p, w) {
    const W = w * 16;
    for (const x of [0, W - 9]) { // speaker stacks at both ends
      p.r(x, -18, 9, 30, '#1a1a22');
      p.r(x + 1, -17, 7, 28, '#2b2e38');
      p.r(x + 3, -15, 3, 3, '#12121a');
      p.r(x + 2, -9, 5, 5, '#12121a');
      p.r(x + 3, -8, 3, 3, '#4a4f5c');
      p.px(x + 4, -7, '#8a8f9c');
    }
    p.box(9, 2, W - 18, 14, 9, '#2a2238', '#1a1626');
    for (let x = 12; x < W - 12; x += 3) p.r(x, 9, 2, 2, ['#e2504a', '#5fd068', '#5b8def', '#f2e14e'][((x - 12) / 3) % 4]); // LED strip
    for (const x of [13, W - 29]) { // the turntables
      p.r(x, -6, 16, 10, '#3a3a48');
      p.r(x + 1, -5, 14, 8, '#4a4a5a');
      p.r(x + 2, -5, 9, 8, '#12121a');
      p.r(x + 4, -3, 5, 4, '#1a1a22');
      p.r(x + 5, -2, 3, 2, '#e2504a');
      p.r(x + 12, -4, 1, 6, '#c8ccd4'); // tonearm
    }
    p.r(W / 2 - 7, -6, 14, 10, '#2b2e38'); // the mixer
    p.r(W / 2 - 6, -5, 12, 8, '#3a3a48');
    for (let i = 0; i < 4; i++) p.r(W / 2 - 5 + i * 3, -4, 1, 4, '#12121a'), p.px(W / 2 - 5 + i * 3, -3 + (i % 3), '#f2f2f2');
    p.px(W / 2 - 4, 1, '#5fd068');
    p.px(W / 2 + 2, 1, '#e2504a');
    p.r(W / 2 - 10, -9, 3, 3, '#e2504a'); // the headphones
    p.r(W / 2 - 10, -8, 1, 1, '#12121a');
  } },
  partybar: { lift: 14, draw(p, w, h) {
    const D = (h || 8) * 16;
    p.box(0, 0, 16, D, 14, '#7a5236', '#4a301e');
    for (let y = 8; y < D - 14; y += 10) p.r(2, y - 6, 4, 8, '#5a3a24'), p.r(2, y - 6, 4, 1, '#8a6246'); // panelling
    p.r(1, -13, 3, D - 14, '#d9b25c'); // the brass rail
    p.r(1, -13, 1, D - 14, '#f2dc8a');
    p.r(12, -13, 3, D - 14, '#3a2418'); // the back shelf
    for (let y = 2; y < D - 18; y += 16) {
      const c = ['#c8e4f4', '#d8343a', '#2f8a3a', '#f2c14e'][((y - 2) >> 4) % 4];
      p.r(5, y - 4, 3, 4, '#c8e4f4'); // a glass
      p.r(5, y - 4, 3, 1, '#ffffff');
      p.r(6, y, 1, 2, '#c8e4f4');
      p.r(12, y - 9, 3, 9, '#1a1a22'); // a bottle
      p.r(13, y - 8, 1, 7, c);
      p.r(13, y - 12, 1, 3, '#1a1a22');
      p.r(9, y + 4, 2, 4, '#f4f1e8'); // a napkin, folded
    }
    for (let y = 4; y < D - 18; y += 8) p.px(2, y - 9, y % 16 ? '#d8343a' : '#2f8a3a'); // tinsel on the rail
  } },
  punchbowl: { lift: 14, draw(p, w) {
    const W = w * 16;
    p.box(0, 3, W, 13, 8, '#f4f1e8', '#d8d2c4');
    p.r(1, 12, W - 2, 2, '#d8343a'); // the cloth's hem
    p.r(9, -4, 14, 6, '#1a1a22'); // the bowl
    p.r(10, -3, 12, 5, '#c8e4f4');
    p.r(10, -1, 12, 3, '#e2504a');
    p.r(11, -1, 4, 1, '#ff8a80');
    p.r(11, -4, 10, 1, '#ffffff');
    p.r(13, -7, 2, 4, '#c8ccd4'); // the ladle
    p.r(13, -8, 5, 1, '#c8ccd4');
    for (const x of [3, 5]) p.r(x, -2, 2, 3, '#f4f1e8'), p.px(x, -2, '#d8343a'); // cups
    p.r(25, -2, 3, 3, '#2f8a3a'); // holly
    p.px(26, -3, '#d8343a');
    p.px(27, -3, '#d8343a');
  } },
  xmastree: { lift: 46, draw(p, w, h) {
    const W = w * 16;
    const cx = W / 2;
    const D = (h || 2) * 16;
    p.r(cx - 20, D - 6, 40, 4, 'rgba(0,0,0,0.22)');
    p.r(cx - 3, D - 18, 6, 8, '#4a2c1c'); // trunk
    const tiers = [[-42, -25, 2, 11], [-30, -8, 4, 16], [-14, 12, 6, 22]];
    for (const [y0, y1, a, b] of tiers) {
      for (let y = y0; y < y1; y++) {
        const hw = Math.round(a + ((b - a) * (y - y0)) / (y1 - y0));
        p.r(cx - hw, y, hw * 2, 1, '#1f6e2c');
        p.r(cx - hw, y, hw, 1, '#2f8a3a');
        p.r(cx - hw, y, 1, 1, '#14501e');
        p.r(cx + hw - 1, y, 1, 1, '#14501e');
        if ((y + hw) % 5 === 0) p.r(cx - hw + 2, y, hw, 1, '#47a853');
      }
      for (let x = -b; x < b; x += 4) p.r(cx + x, y1, 4, 1, (x / 4) % 2 ? '#14501e' : '#1f6e2c'); // ragged hem
    }
    for (const [x0, y0, x1, y1] of [[-4, -32, 6, -22], [-10, -16, 11, -4], [-17, 0, 12, 10]]) { // gold garlands
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        p.px(Math.round(cx + x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 3), '#f2c14e');
      }
    }
    const balls = [[-3, -34, '#e2504a'], [4, -26, '#5b8def'], [-7, -20, '#f2e14e'], [8, -17, '#e2504a'], [-13, -6, '#5b8def'], [2, -9, '#f29cd0'],
      [14, -2, '#f2e14e'], [-6, 2, '#e2504a'], [-17, 8, '#f29cd0'], [7, 6, '#5b8def'], [17, 10, '#e2504a'], [-1, 9, '#f4f1e8']];
    for (const [x, y, c] of balls) {
      p.r(cx + x, y, 3, 3, c);
      p.px(cx + x, y, shade(c, 0.5)); // the highlight
      p.px(cx + x + 2, y + 2, shade(c, -0.35));
    }
    for (const [x, y] of [[-5, -28], [7, -12], [-10, -1], [10, 8], [-15, 12], [1, -37]]) p.px(cx + x, y, '#fff6c8'); // fairy lights
    // The star on top.
    p.r(cx - 1, -50, 2, 8, '#f2c14e');
    p.r(cx - 4, -47, 8, 2, '#f2c14e');
    p.r(cx - 3, -49, 6, 6, '#f2e14e');
    p.r(cx - 1, -48, 2, 3, '#fff6c8');
    // The pot, and a few presents.
    p.r(cx - 7, D - 12, 14, 9, '#1a1a22');
    p.r(cx - 6, D - 11, 12, 7, '#a8242a');
    p.r(cx - 6, D - 11, 12, 1, '#d8343a');
    p.r(cx - 6, D - 8, 12, 1, '#f2c14e');
    for (const [x, y, c] of [[-20, D - 8, '#5b8def'], [12, D - 7, '#f2c14e'], [17, D - 5, '#d8343a']]) {
      p.r(cx + x, y, 8, 6, '#1a1a22');
      p.r(cx + x + 1, y + 1, 6, 4, c);
      p.r(cx + x + 3, y + 1, 2, 4, '#f4f1e8');
      p.r(cx + x + 1, y + 2, 6, 1, '#f4f1e8');
    }
  } },
  santatable: { lift: 16, draw(p, w) {
    const W = w * 16;
    p.box(0, 3, W, 13, 8, '#d8343a', '#a8242a');
    p.r(1, 12, W - 2, 2, '#f4f1e8'); // white fur trim
    for (let x = 2; x < W - 2; x += 4) p.px(x, 13, '#1a1a22');
    p.r(1, -5, W - 2, 1, '#f4f1e8');
    for (const [x, y, bw, bh, c] of [[4, 3, 11, 9, '#2f8a3a'], [17, 2, 9, 11, '#f2e14e'], [28, 4, 10, 8, '#5b8def'], [8, -4, 7, 6, '#d8343a'], [31, -3, 6, 5, '#f29cd0']]) {
      p.r(x - 1, y - bh - 1, bw + 2, bh + 1, '#1a1a22');
      p.r(x, y - bh, bw, bh, c);
      p.r(x, y - bh, bw, 1, shade(c, 0.35));
      p.r(x + Math.floor(bw / 2) - 1, y - bh, 2, bh, '#f4f1e8');
      p.r(x, y - bh + Math.floor(bh / 2), bw, 1, '#f4f1e8');
      p.r(x + Math.floor(bw / 2) - 2, y - bh - 2, 2, 2, '#f4f1e8'); // the bow
      p.r(x + Math.floor(bw / 2) + 1, y - bh - 2, 2, 2, '#f4f1e8');
    }
    p.r(W - 10, -1, 8, 4, '#d8343a'); // a Santa hat
    p.r(W - 6, -4, 4, 4, '#d8343a');
    p.r(W - 11, 2, 10, 2, '#f4f1e8');
    p.r(W - 3, -5, 3, 3, '#f4f1e8');
  } },
  photobooth: { lift: 20, draw(p, w, h) {
    const W = w * 16;
    const D = (h || 2) * 16;
    p.box(0, D - 12, W, 12, 32, '#4a3a5c', '#2a1d36'); // the booth's body: roof on top, the front below
    for (let x = 3; x < W - 3; x += 4) p.r(x, -3, 2, 2, x % 8 ? '#f2e14e' : '#fff6c8'); // marquee bulbs along the roof's front edge
    p.r(2, D - 30, W - 4, 8, '#d8343a'); // the sign band
    for (let i = 0; i < 5; i++) p.r(W / 2 - 17 + i * 7, D - 28, 5, 4, '#fff6c8'); // PHOTO, in blocks
    p.r(W / 2 - 17, D - 28, 5, 1, '#f2c14e');
    p.r(6, D - 20, W - 24, 20, '#12121a'); // the opening
    p.r(8, D - 20, W - 28, 20, '#d8343a'); // the curtain
    for (let x = 9; x < W - 20; x += 4) p.r(x, D - 20, 1, 20, '#a8242a'), p.r(x + 2, D - 20, 1, 20, '#e2504a');
    p.r(W / 2 - 8, D - 20, 3, 20, '#12121a'); // the gap in the curtain
    p.r(W / 2 - 9, D - 4, 2, 4, '#4a4f5c');
    p.r(W / 2 - 6, D - 4, 2, 4, '#4a4f5c');
    p.r(8, D - 20, W - 28, 2, '#f2c14e'); // the rail
    p.r(W - 14, D - 22, 10, 22, '#1a1a22'); // the camera panel
    p.r(W - 12, D - 20, 6, 6, '#3a3a48');
    p.r(W - 11, D - 19, 4, 4, '#8fd3ff');
    p.px(W - 10, D - 18, '#ffffff');
    p.r(W - 12, D - 11, 6, 3, '#2f8a3a'); // the coin slot and a button
    p.r(W - 10, D - 6, 2, 2, '#e2504a');
    p.r(2, -9, W - 4, 3, '#2f8a3a'); // garland on the roof
    for (let x = 5; x < W - 4; x += 9) p.r(x, -9, 3, 3, '#d8343a');
    p.r(W / 2 - 1, -19, 2, 10, '#f2c14e'); // a star on a stick
    p.r(W / 2 - 4, -16, 8, 2, '#f2c14e');
    p.r(W / 2 - 2, -18, 4, 5, '#f2e14e');
  } },
  partytable: { lift: 12, draw(p, w) {
    const W = w * 16;
    p.box(0, 4, W, 12, 8, '#f4f1e8', '#d8d2c4');
    p.r(1, 13, W - 2, 2, '#d8343a'); // the cloth's red hem
    for (const x of [4, W - 10]) { // plates
      p.r(x, -2, 7, 4, '#c8ccd4');
      p.r(x + 1, -2, 5, 3, '#ffffff');
    }
    p.r(W / 2 - 4, -3, 8, 6, '#2f8a3a'); // the centrepiece: holly with a candle
    p.r(W / 2 - 3, -4, 6, 2, '#47a853');
    p.px(W / 2 - 3, -2, '#d8343a');
    p.px(W / 2 + 2, 0, '#d8343a');
    p.r(W / 2 - 1, -9, 2, 6, '#f4f1e8');
    p.r(W / 2 - 1, -11, 2, 2, '#f2c14e');
    p.px(W / 2, -12, '#fff6c8');
  } },
  poinsettia: { lift: 14, draw(p) {
    p.r(3, 6, 10, 9, '#1a1a22'); // foil-wrapped pot
    p.r(4, 7, 8, 7, '#d9b25c');
    p.r(4, 7, 8, 1, '#f2dc8a');
    p.r(4, 10, 8, 1, '#a8862f');
    p.r(1, -4, 14, 10, '#1f6e2c'); // leaves
    p.r(2, -5, 12, 9, '#2f8a3a');
    for (const [x, y, w, h] of [[1, -9, 5, 5], [10, -9, 5, 5], [6, -11, 4, 5], [0, -3, 5, 5], [11, -3, 5, 5], [4, -6, 8, 6]]) {
      p.r(x, y, w, h, '#a8242a'); // bracts
      p.r(x + 1, y + 1, w - 2, h - 2, '#d8343a');
      p.px(x + 1, y + 1, '#ff6a60');
    }
    for (const [x, y] of [[7, -4], [8, -3], [6, -3]]) p.px(x, y, '#f2e14e');
  } },
  tikibar: { lift: 30, draw(p, w) {
    const W = w * 16;
    p.box(0, 3, W, 10, 12, '#d9b25c', '#a77b52');
    for (let x = 2; x < W; x += 4) p.r(x, 4, 1, 8, '#8a5a3a');
    p.r(1, -26, 2, 20, '#8a5a3a');
    p.r(W - 3, -26, 2, 20, '#8a5a3a');
    p.r(0, -30, W, 6, '#c9a14a');
    for (let x = 0; x < W; x += 2) p.r(x, -24, 1, 2 + ((x / 2) % 2), '#a8862f');
    p.r(0, -30, W, 1, '#e6c46a');
    for (const [x, c] of [[8, '#5fd068'], [14, '#e2504a'], [20, '#7fc4ff'], [30, '#f29c38']]) p.r(x, -16, 3, 7, c), p.r(x + 1, -18, 1, 2, c);
    p.r(36, -7, 5, 5, '#8a5a3a');
    p.r(37, -9, 1, 3, '#e2504a');
  } },
  massage: { lift: 30, draw(p, w) {
    const W = w * 16;
    p.r(1, -28, 2, 38, '#f4f1e8');
    p.r(W - 3, -28, 2, 38, '#f4f1e8');
    p.r(0, -30, W, 4, '#ffffff');
    p.r(0, -26, W, 2, '#d8d2c4');
    p.r(0, -24, 3, 22, 'rgba(255,255,255,0.75)');
    p.r(W - 3, -24, 3, 22, 'rgba(255,255,255,0.75)');
    p.box(4, 3, W - 8, 8, 8, '#ffffff', '#c9b48a');
    p.r(6, -4, 6, 3, '#2fa39a');
    p.r(W - 10, -3, 3, 2, '#f29cd0');
  } },
  torch: { lift: 26, draw(p, w, h, k) {
    p.r(7, -14, 2, 26, '#6b4a22');
    p.r(5, -17, 6, 4, '#8a6a3a');
    p.r(6, -22, 4, 5, '#f29c38');
    p.r(7, -24, 2, 4, '#f2e14e');
  } },
  hammock: { lift: 18, draw(p, w) {
    const W = w * 16;
    p.r(1, -16, 2, 26, '#8a6a3a');
    p.r(W - 3, -16, 2, 26, '#8a6a3a');
    for (let x = 3; x < W - 3; x++) {
      const sag = Math.round(Math.sin(((x - 3) / (W - 6)) * Math.PI) * 6);
      p.r(x, -12 + sag, 1, 4, (x >> 2) % 2 ? '#e2504a' : '#f2c14e');
    }
  } },
  flowers: { lift: 4, solid: false, draw(p) {
    for (const [x, y, c] of [[3, 6, '#e2504a'], [8, 4, '#f29cd0'], [12, 8, '#f2c14e'], [5, 11, '#ffffff'], [10, 12, '#e2504a']]) {
      p.r(x - 1, y + 1, 3, 2, '#2f8a3a');
      p.r(x, y, 2, 2, c);
    }
  } },
  lounger: { lift: 8, draw(p, w, h) {
    const D = h * 16;
    p.box(2, 4, 12, D - 6, 4, '#ffffff', '#c8ccd4');
    for (let y = 6; y < D - 6; y += 4) p.r(3, y, 10, 2, '#3b9fd6');
    p.box(2, 2, 12, 6, 8, '#ffffff', '#c8ccd4');
  } },
  sunbed: { lift: 30, draw(p, w, h) {
    const D = h * 16;
    p.box(2, 4, 12, D - 6, 4, '#f4f1e8', '#c9b48a');
    p.r(3, 2, 10, D - 10, '#e2504a');
    p.r(3, 2, 10, 3, '#ffffff');
    p.r(7, -24, 1, 26, '#6b4a22');
    p.r(0, -28, 16, 3, '#f2c14e');
    p.r(2, -30, 12, 2, '#e2504a');
    p.r(5, -31, 6, 1, '#f2c14e');
  } },
  lifeguard: { lift: 32, draw(p) {
    p.r(2, -10, 2, 22, '#f4f1e8');
    p.r(12, -10, 2, 22, '#f4f1e8');
    for (let y = -6; y < 10; y += 5) p.r(3, y, 10, 1, '#f4f1e8');
    p.box(1, -10, 14, 5, 4, '#e2504a', '#9a3326');
    p.r(13, -30, 1, 18, '#6b4a22');
    p.r(9, -30, 4, 4, '#e2504a');
  } },
  sandcastle: { lift: 14, draw(p) {
    p.box(1, 6, 14, 8, 6, '#e6c47a', '#c9a45a');
    p.r(3, -6, 4, 6, '#d9b56a');
    p.r(9, -8, 4, 8, '#d9b56a');
    p.r(9, -9, 1, 1, '#d9b56a');
    p.r(12, -9, 1, 1, '#d9b56a');
    p.r(11, -13, 1, 4, '#6b4a22');
    p.r(12, -13, 3, 2, '#e2504a');
    p.r(4, 8, 4, 4, '#3b6fb6');
  } },
  // ------------------------------------------------ your flat (core/home.js)
  homedesk: { lift: 18, draw(p, w) {
    const W = w * 16;
    deskBase(p, W, WOOD, WOOD_D);
    monitorOn(p, W / 2 - 6, -14, '#9fe8b0');
    p.r(W / 2 - 7, -1, 14, 3, '#d8dce4');
    p.r(W / 2 - 7, -1, 14, 1, '#ffffff');
    p.r(3, -5, 4, 4, '#f4f1e8');
    p.r(4, -4, 2, 1, '#6a3a1e');
    p.r(W - 7, -3, 5, 2, '#e2504a');
  } },
  hometv: { lift: 22, draw(p, w) {
    const W = w * 16;
    p.box(2, 4, W - 4, 8, 6, WOOD, WOOD_D);
    p.r(4, -20, W - 8, 15, '#1a1a22');
    p.r(5, -19, W - 10, 12, '#22324a');
    p.r(6, -18, 6, 1, '#4a6a8a');
    p.r(W / 2 - 1, -5, 2, 3, '#1a1a22');
  } },
  houseplant: { lift: 18, draw(p) {
    p.box(4, 6, 8, 6, 7, '#e8e2d4', '#c8c0ae');
    p.r(2, -14, 12, 14, '#1a1a22');
    p.r(3, -13, 10, 12, '#2f8a3a');
    p.r(1, -9, 4, 3, '#2f8a3a');
    p.r(11, -10, 4, 3, '#2f8a3a');
    p.r(5, -13, 2, 6, '#5fbf5a');
    p.r(9, -11, 2, 5, '#5fbf5a');
    p.r(7, -16, 2, 4, '#3f9a4a');
  } },
  homebed: { lift: 14, draw(p, w, h) {
    const W = w * 16;
    const D = h * 16;
    p.box(0, -2, W, 6, 12, WOOD, WOOD_D);
    p.box(1, 4, W - 2, D - 6, 6, '#f4f1e8', '#d8d2c4');
    p.r(4, -1, W - 8, 7, '#1a1a22');
    p.r(5, 0, W - 10, 5, '#ffffff');
    p.r(2, 9, W - 4, D - 18, '#7a8ac8');
    p.r(2, 9, W - 4, 2, '#9aaae0');
    p.r(6, 16, 8, 3, '#5a6aa8'); // rumpled: you never make it
  } },
  ironingboard: { lift: 12, draw(p, w) {
    const W = w * 16;
    p.r(6, 4, 1, 10, '#6a707c');
    p.r(W - 8, 4, 1, 10, '#6a707c');
    p.box(1, 2, W - 4, 6, 3, '#e8e2d4', '#b8b0a0');
    p.r(4, -2, W - 10, 3, '#9fd3f0');
    p.r(W - 10, -6, 7, 4, '#1a1a22');
    p.r(W - 9, -5, 5, 2, '#e2504a');
  } },
  vacuum: { lift: 18, draw(p) {
    p.box(3, 8, 10, 4, 6, '#e2504a', '#b63b3b');
    p.r(7, -14, 2, 18, '#6a707c');
    p.r(5, -16, 6, 3, '#1a1a22');
    p.r(9, -4, 4, 7, '#1a1a22');
    p.r(10, -3, 2, 5, '#f2c14e');
  } },
  dishsink: { lift: 16, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(4, -6, W - 8, 6, '#1a1a22');
    p.r(5, -5, W - 10, 4, '#8aa8bc');
    // The pile of dirty plates, cups and a pan.
    for (let i = 0; i < 4; i++) p.r(7 + i * 2, -9 - i * 2, 8, 2, i % 2 ? '#f4f1e8' : '#d8d2c4');
    p.r(W - 12, -10, 5, 6, '#f4f1e8');
    p.r(W - 11, -8, 3, 1, '#8a5a3a');
    p.r(W / 2, -14, 2, 8, METAL);
    p.r(W / 2, -14, 5, 2, METAL);
  } },
  homebrewer: { lift: 20, draw(p) {
    p.box(0, 2, 16, 10, 10, '#b8bcc4', '#e8e6e0');
    p.r(3, -16, 10, 13, '#1a1a22');
    p.r(4, -15, 8, 4, '#3a3d48');
    p.r(5, -10, 6, 6, '#c8e4f4');
    p.r(5, -7, 6, 3, '#6b4a32');
    p.r(11, -14, 1, 1, '#5fd068');
  } },
  bathtub: { lift: 12, draw(p, w) {
    const W = w * 16;
    p.box(0, 2, W, 12, 10, '#f4f6f8', '#d8dce4');
    p.r(3, -6, W - 6, 8, '#1a1a22');
    p.r(4, -5, W - 8, 6, '#9fd3f0');
    for (const [x, y] of [[8, -5], [14, -4], [22, -5], [30, -4]]) if (x < W - 6) p.r(x, y, 4, 2, '#ffffff');
    p.r(W - 8, -14, 2, 8, METAL);
    p.r(W - 10, -14, 4, 2, METAL);
    p.r(W - 11, -11, 2, 2, '#e2504a');
    p.r(W - 6, -11, 2, 2, '#2a6ad1');
  } },
  washer: { lift: 20, draw(p) {
    p.box(1, 2, 14, 10, 20, '#f4f6f8', '#d8dce4');
    p.r(2, -17, 12, 3, '#c8ccd4');
    p.r(10, -16, 2, 1, '#5fd068');
    p.r(3, -11, 10, 10, '#1a1a22');
    p.r(4, -10, 8, 8, '#6a8aa8');
    p.r(5, -8, 6, 4, '#f29cd0');
  } },
  // ---- the roof (core/roof.js)
  ladderhead: { lift: 24, draw(p) {
    // The fire escape's ladder head, its rails curving over the parapet.
    const RUST = '#a5492e';
    const RUST_D = '#6e2f1e';
    p.r(2, -22, 2, 36, RUST_D);
    p.r(12, -22, 2, 36, RUST_D);
    p.r(3, -22, 1, 36, RUST);
    p.r(13, -22, 1, 36, RUST);
    p.r(2, -24, 4, 2, RUST);
    p.r(10, -24, 4, 2, RUST);
    for (let y = -18; y < 14; y += 5) p.r(4, y, 8, 1, RUST);
    p.r(1, 12, 14, 2, '#1a1a22');
  } },
  telescope: { lift: 22, draw(p) {
    // A coin-operated viewer, municipal green, on a post.
    const G = '#3f7f5f';
    const GD = '#2a5a42';
    p.r(5, 11, 7, 3, '#1a1a22');
    p.r(7, -6, 3, 17, METAL_D);
    p.r(8, -6, 1, 17, METAL);
    p.r(2, -17, 13, 11, '#1a1a22');
    p.r(3, -16, 11, 9, G);
    p.r(3, -16, 11, 2, shade(G, 0.3));
    p.r(3, -9, 11, 2, GD);
    p.r(1, -15, 3, 5, '#1a1a22');
    p.r(13, -15, 3, 5, '#1a1a22');
    p.r(4, -13, 2, 2, '#9fd3f0');
    p.r(11, -13, 2, 2, '#9fd3f0');
    p.r(7, -12, 3, 1, '#c9a227');
  } },
  cradle: { lift: 26, draw(p, w) {
    // The window cleaners' cradle on its davit arms, hanging over the parapet: the platform with its yellow rail.
    const W = w * 16;
    const Y = '#f2c230';
    const YD = '#b08a18';
    for (const x of [4, W - 6]) {
      p.r(x, -24, 3, 34, '#1a1a22');
      p.r(x + 1, -24, 1, 34, METAL);
    }
    p.r(4, -25, W - 7, 3, '#1a1a22');
    p.r(5, -24, W - 9, 1, METAL);
    p.r(12, -22, 1, 14, '#2b2e38');
    p.r(W - 13, -22, 1, 14, '#2b2e38');
    p.box(8, 2, W - 16, 10, 8, '#c8ccd4', '#9aa1ad');
    p.r(8, -9, W - 16, 2, '#1a1a22');
    p.r(9, -9, W - 18, 1, Y);
    for (let x = 9; x < W - 8; x += 8) p.r(x, -8, 1, 4, YD);
    p.r(W / 2 - 6, 6, 12, 3, '#3a3f48');
    p.r(W / 2 - 5, 6, 10, 1, '#5a6070');
  } },
  roofshack: { lift: 32, draw(p, w, h) {
    // The stairwell head: concrete, a flat roof with a vent, the steel roof door with its warning sign.
    const W = w * 16;
    const D = h * 16;
    p.box(0, 2, W, D - 4, 30, '#8a8e96', '#a8acb4');
    p.r(6, -24, 10, 6, '#6a707c');
    p.r(7, -25, 8, 2, '#9aa1ad');
    const fy = D - 32; // the front face's top
    const dx = Math.round(W / 2) - 8;
    p.r(dx - 1, fy + 4, 18, 30 - 5, '#1a1a22');
    p.r(dx, fy + 5, 16, 30 - 6, '#5a6a7a');
    p.r(dx, fy + 5, 16, 1, '#7a8a9a');
    p.r(dx + 12, fy + 17, 2, 2, '#c8ccd4');
    p.r(dx + 3, fy + 8, 10, 6, '#f2c230');
    p.r(dx + 4, fy + 9, 8, 4, '#1a1a22');
    p.r(dx + 5, fy + 10, 6, 2, '#f2c230');
    p.r(W - 14, fy + 6, 6, 4, '#f4f1e8');
    p.r(W - 13, fy + 7, 4, 1, '#c94a3b');
  } },
  acunit: { lift: 24, draw(p, w) {
    // An air-conditioning unit: a grey box, the fan on top (spun by FloorView), louvres on the front.
    const W = w * 16;
    p.box(0, 6, W, 16, 22, '#c8ccd2', '#a4aab2');
    p.r(6, -14, W - 12, 12, '#1a1a22');
    p.r(7, -13, W - 14, 10, '#3a3f48');
    for (let y = 10; y < 28; y += 3) p.r(3, y, W - 6, 1, '#868c96');
    p.r(W - 6, 22, 3, 3, '#5fd068');
  } },
  watertank: { lift: 34, draw(p, w) {
    // A water tank on four legs, wooden staves and steel hoops, a cone roof. It stands on a deck on the legs: the back
    // pair's feet sit higher up the footprint than the front pair's.
    const W = w * 16;
    const LEG = ['#3a3028', '#4a4038'];
    for (const x of [13, W - 16]) p.r(x, 16, 3, 16, LEG[1]);
    p.r(13, 26, W - 26, 2, LEG[0]);
    for (const x of [4, W - 7]) p.r(x, 16, 3, 28, LEG[0]);
    p.r(4, 32, W - 8, 2, LEG[0]);
    p.r(5, 30, 1, 2, LEG[1]);
    p.r(2, 12, W - 4, 5, '#1a1a22');
    p.r(3, 13, W - 6, 3, '#5a4a3c');
    p.r(3, -22, W - 6, 34, '#1a1a22');
    p.r(4, -21, W - 8, 32, '#9a6b42');
    for (let x = 7; x < W - 6; x += 5) p.r(x, -21, 1, 32, '#7f5533');
    for (const y of [-16, -4, 7]) p.r(4, y, W - 8, 2, '#5a606c');
    p.r(6, -30, W - 12, 9, '#1a1a22');
    p.r(7, -29, W - 14, 7, '#6a707c');
    p.r(12, -33, W - 24, 4, '#1a1a22');
    p.r(13, -32, W - 26, 2, '#868c96');
    p.r(4, -21, 3, 32, shade('#9a6b42', 0.15));
  } },
  antenna: { lift: 72, draw(p) {
    // The antenna mast with its cross bars and a warning light (blinked by FloorView).
    p.r(5, 10, 6, 4, '#1a1a22');
    p.r(7, -68, 2, 80, '#1a1a22');
    p.r(7, -68, 1, 80, METAL);
    for (const [y, w] of [[-60, 12], [-44, 10], [-28, 8]]) p.r(8 - w / 2, y, w, 1, METAL_D);
    p.r(3, -50, 3, 6, '#d8dfe8');
    p.r(11, -36, 3, 6, '#d8dfe8');
    p.r(6, -72, 4, 4, '#7a2020');
  } },
  roofbench: { lift: 12, draw(p, w) {
    const W = w * 16;
    p.r(2, 4, 2, 10, '#2b2e38');
    p.r(W - 4, 4, 2, 10, '#2b2e38');
    p.box(0, 2, W, 8, 6, '#a77b52', '#7a5536');
    for (let x = 0; x < W; x += 6) p.r(x, -3, 1, 6, '#7a5536');
    p.r(0, -12, W, 6, '#1a1a22');
    p.r(1, -11, W - 2, 2, '#b98a5a');
    p.r(1, -8, W - 2, 1, '#a77b52');
  } },
  sandbucket: { lift: 10, draw(p) {
    p.r(3, -2, 10, 14, '#1a1a22');
    p.r(4, -1, 8, 12, '#c94a3b');
    p.r(4, -1, 8, 2, '#e8d498');
    p.r(4, 3, 8, 1, '#a33b3b');
    p.r(5, -2, 2, 1, '#f4f1e8');
    p.r(8, -1, 2, 1, '#f4f1e8');
    p.r(10, -2, 1, 1, '#e8a04a');
    p.r(5, -6, 1, 4, '#6a707c');
    p.r(10, -6, 1, 4, '#6a707c');
    p.r(5, -7, 6, 1, '#6a707c');
  } },
  pigeons: { lift: 6, solid: false, draw(p) {
    // Two pigeons, minding their own business.
    for (const [x, y, flip] of [[2, 6, 0], [9, 10, 1]]) {
      p.r(x, y, 5, 3, '#8a8f9a');
      p.r(x + 1, y + 3, 1, 1, '#e8a04a');
      p.r(x + 3, y + 3, 1, 1, '#e8a04a');
      const hx = flip ? x - 2 : x + 4;
      p.r(hx, y - 2, 3, 3, '#6a707c');
      p.r(flip ? hx - 1 : hx + 3, y - 1, 1, 1, '#e8a04a');
      p.r(hx + 1, y + 1, 1, 1, '#6aa88a');
      p.r(flip ? x + 4 : x, y + 1, 1, 1, '#5a606c');
    }
  } },
  beehive: { lift: 18, draw(p) {
    // A beehive: stacked white boxes with a sloped lid, the landing board, a company logo sticker.
    p.box(2, 4, 12, 9, 16, '#f2e8c8', '#e8d8a8');
    p.r(3, 1, 10, 1, '#c8b888');
    p.r(3, -5, 10, 1, '#c8b888');
    p.r(1, -14, 14, 3, '#1a1a22');
    p.r(2, -13, 12, 1, '#8a6a4a');
    p.r(5, 10, 6, 2, '#1a1a22');
    p.r(6, 10, 4, 1, '#3a3028');
    p.r(6, -2, 4, 3, '#2a6ad1');
  } },
  rooflamp: { lift: 22, draw(p) {
    // A lamp post: a slim pole, a lamp head (lit at night by the roof's lighting).
    p.r(5, 11, 6, 3, '#1a1a22');
    p.r(7, -18, 2, 30, '#2b2e38');
    p.r(7, -18, 1, 30, METAL_D);
    p.r(3, -22, 10, 4, '#1a1a22');
    p.r(4, -21, 8, 2, '#3a3f48');
    p.r(5, -19, 6, 1, '#f2e8b0');
  } },
  swimladder: { lift: 18, draw(p, w) {
    const W = w * 16;
    p.r(3, -4, 2, 20, '#c8ccd4');
    p.r(9, -4, 2, 20, '#c8ccd4');
    for (let y = 2; y < 16; y += 4) p.r(3, y, 8, 1, '#c8ccd4');
    p.r(W - 6, -16, 2, 26, '#8a6a3a');
    p.r(W - 14, -12, 12, 12, '#1a1a22');
    p.r(W - 13, -11, 10, 10, '#e2504a');
    p.r(W - 10, -8, 4, 4, '#2a86c7');
    p.r(W - 13, -7, 2, 2, '#ffffff');
    p.r(W - 5, -7, 2, 2, '#ffffff');
  } },
};

/**
 * A decoration on your desk (see DESK_DECOR in economy.js). (x, y) = the desk's footprint top-left in px, w = its width
 * in tiles. Slots: left and right of the monitor on the desktop, top = on the monitor.
 */
export function drawDeskDecor(g, id, x, y, w) {
  const { r } = P(g);
  const W = w * 16;
  const L = x + 1;
  const R = x + W - 9;
  const M = x + W / 2 - 6; // the monitor's left edge; its top is at y - 14
  switch (id.startsWith('trophy-') ? 'trophy' : id.startsWith('xmas-') ? 'xmas' : id) {
    case 'xmas': {
      // The Secret Santa gift: a little tree in a pot, its baubles in the year's colours.
      const year = +id.slice(5);
      const [b1, b2] = [['#e2504a', '#f2c14e'], ['#5b8def', '#f4f1e8'], ['#f29cd0', '#5fd068'], ['#f2c14e', '#b15cff']][year % 4];
      r(L + 2, y - 3, 5, 3, '#8a4a2a');
      r(L + 1, y - 7, 7, 4, '#2f8a3a');
      r(L + 2, y - 10, 5, 3, '#2f8a3a');
      r(L + 3, y - 12, 3, 2, '#2f8a3a');
      r(L + 4, y - 14, 1, 2, '#f2e14e');
      r(L + 2, y - 6, 1, 1, b1);
      r(L + 6, y - 5, 1, 1, b2);
      r(L + 3, y - 9, 1, 1, b2);
      r(L + 5, y - 8, 1, 1, b1);
      r(L + 4, y - 11, 1, 1, b1);
      break;
    }
    case 'notes':
      r(M, y - 14, 3, 3, '#f2e14e');
      r(M + 9, y - 13, 3, 3, '#f29cd0');
      r(M + 1, y - 9, 3, 3, '#8ad0f2');
      break;
    case 'duck':
      r(M + 3, y - 17, 6, 3, '#f2d22e');
      r(M + 7, y - 20, 3, 3, '#f2d22e');
      r(M + 10, y - 19, 2, 1, '#f29c38');
      r(M + 8, y - 19, 1, 1, '#1a1a22');
      break;
    case 'bobble':
      r(M + 5, y - 16, 3, 2, '#22242e');
      r(M + 4, y - 22, 5, 5, '#e8b88a');
      r(M + 4, y - 23, 5, 2, '#5a3a22');
      r(M + 5, y - 20, 1, 1, '#1a1a22');
      r(M + 7, y - 20, 1, 1, '#1a1a22');
      break;
    case 'plant':
      r(L + 1, y - 3, 5, 4, '#b5653a');
      r(L + 1, y - 3, 5, 1, '#d07a48');
      r(L, y - 9, 7, 6, '#3f9a4a');
      r(L + 2, y - 11, 3, 2, '#5fc06a');
      break;
    case 'cactus':
      r(L + 2, y - 3, 4, 4, '#c97a4a');
      r(L + 3, y - 11, 2, 8, '#4caf50');
      r(L + 1, y - 9, 2, 1, '#4caf50');
      r(L + 1, y - 10, 1, 2, '#4caf50');
      r(L + 5, y - 7, 2, 1, '#4caf50');
      r(L + 6, y - 9, 1, 2, '#4caf50');
      r(L + 3, y - 12, 2, 1, '#f29cd0');
      break;
    case 'lamp':
      r(L, y, 6, 1, '#1a1a22');
      r(L + 2, y - 10, 1, 10, '#3a3f55');
      r(L + 2, y - 12, 6, 3, '#e2504a');
      r(L + 3, y - 9, 4, 1, '#fff6c8');
      break;
    case 'mug':
      r(R + 2, y - 4, 4, 5, '#f4f1e8');
      r(R + 6, y - 3, 1, 3, '#f4f1e8');
      r(R + 2, y - 4, 4, 1, '#6a3a1e');
      r(R + 3, y - 2, 2, 1, '#e2504a');
      break;
    case 'photo':
      r(R + 1, y - 9, 7, 9, '#5a3d22');
      r(R + 2, y - 8, 5, 6, '#8ad0f2');
      r(R + 3, y - 5, 1, 3, '#e8b88a');
      r(R + 5, y - 6, 1, 4, '#e8b88a');
      break;
    case 'snowglobe':
      r(M + 3, y - 15, 6, 2, '#5a3d22');
      r(M + 3, y - 21, 6, 6, '#bfe4f2');
      r(M + 4, y - 22, 4, 1, '#bfe4f2');
      r(M + 5, y - 18, 2, 3, '#3f9a4a');
      r(M + 4, y - 20, 1, 1, '#ffffff');
      r(M + 7, y - 19, 1, 1, '#ffffff');
      break;
    case 'crane':
      r(M + 3, y - 16, 7, 2, '#e2504a');
      r(M + 5, y - 19, 3, 3, '#e2504a');
      r(M + 9, y - 20, 1, 4, '#c43a34');
      r(M + 10, y - 21, 1, 1, '#c43a34');
      r(M + 2, y - 17, 2, 1, '#c43a34');
      break;
    case 'pencup':
      r(L + 1, y - 5, 5, 6, '#3a3f55');
      r(L + 1, y - 5, 5, 1, '#5d6480');
      r(L + 2, y - 9, 1, 4, '#2a6ad1');
      r(L + 4, y - 10, 1, 5, '#e2504a');
      r(L + 3, y - 8, 1, 3, '#1a1a22');
      break;
    case 'highlighters':
      r(L, y - 1, 7, 2, '#3a3f55');
      r(L + 1, y - 7, 1, 6, '#f2e14e');
      r(L + 3, y - 6, 1, 5, '#f29cd0');
      r(L + 5, y - 7, 1, 6, '#7ee08a');
      r(L + 1, y - 8, 1, 1, '#1a1a22');
      r(L + 3, y - 7, 1, 1, '#1a1a22');
      r(L + 5, y - 8, 1, 1, '#1a1a22');
      break;
    case 'tray':
      r(L, y - 4, 8, 5, '#1a1a22');
      r(L + 1, y - 3, 6, 3, '#3a3f55');
      r(L + 1, y - 5, 6, 2, '#f4f1e8');
      r(L, y - 8, 8, 1, '#1a1a22');
      r(L + 1, y - 9, 6, 1, '#f4f1e8');
      r(L, y - 8, 1, 4, '#1a1a22');
      r(L + 7, y - 8, 1, 4, '#1a1a22');
      break;
    case 'organizer':
      r(L, y - 6, 8, 7, '#5a3d22');
      r(L + 1, y - 5, 2, 5, '#3a2b1a');
      r(L + 4, y - 5, 3, 5, '#3a2b1a');
      r(L + 1, y - 9, 1, 4, '#2a6ad1');
      r(L + 2, y - 8, 1, 3, '#1a1a22');
      r(L + 4, y - 8, 3, 3, '#f4f1e8');
      break;
    case 'bonsai':
      r(L, y - 2, 8, 3, '#3a3f55');
      r(L, y - 2, 8, 1, '#5d6480');
      r(L + 3, y - 6, 1, 4, '#6a4a2a');
      r(L + 4, y - 7, 1, 2, '#6a4a2a');
      r(L, y - 10, 5, 3, '#3f7a3a');
      r(L + 3, y - 12, 5, 4, '#4c9a46');
      r(L + 4, y - 12, 2, 1, '#6fc062');
      break;
    case 'globe':
      r(L + 1, y, 6, 1, '#3a2b1a');
      r(L + 3, y - 2, 2, 2, '#c9a227');
      r(L + 1, y - 10, 6, 8, '#2a6ad1');
      r(L + 2, y - 11, 4, 1, '#2a6ad1');
      r(L + 2, y - 9, 2, 3, '#4caf50');
      r(L + 5, y - 6, 1, 2, '#4caf50');
      r(L, y - 9, 1, 6, '#c9a227');
      break;
    case 'clips':
      r(R + 2, y - 4, 5, 5, '#1a1a22');
      r(R + 3, y - 3, 3, 3, '#3a3f55');
      r(R + 3, y - 6, 1, 2, '#c0c6d4');
      r(R + 5, y - 7, 1, 3, '#c0c6d4');
      r(R + 4, y - 5, 2, 1, '#e2504a');
      break;
    case 'stapler':
      r(R, y - 1, 8, 2, '#1a1a22');
      r(R, y - 4, 8, 3, '#e2504a');
      r(R, y - 4, 8, 1, '#f27a74');
      r(R + 7, y - 3, 1, 2, '#c0c6d4');
      break;
    case 'tape':
      r(R, y - 3, 8, 4, '#1a1a22');
      r(R + 1, y - 2, 6, 2, '#3a3f55');
      r(R + 2, y - 6, 4, 4, '#d8dce4');
      r(R + 3, y - 5, 2, 2, '#1a1a22');
      r(R + 7, y - 4, 1, 1, '#c0c6d4');
      break;
    case 'calculator':
      r(R, y - 8, 7, 9, '#22242e');
      r(R + 1, y - 7, 5, 2, '#9fe8b0');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) r(R + 1 + j * 3, y - 4 + i * 2, 2, 1, j && i === 2 ? '#f29c38' : '#c0c6d4');
      break;
    case 'punch':
      r(R, y - 1, 8, 2, '#1a1a22');
      r(R + 1, y - 3, 6, 2, '#5d6480');
      r(R + 1, y - 6, 6, 2, '#2a6ad1');
      r(R + 3, y - 4, 1, 1, '#c0c6d4');
      r(R + 5, y - 4, 1, 1, '#c0c6d4');
      break;
    case 'espresso':
      r(R, y - 12, 8, 13, '#3a3f55');
      r(R, y - 12, 8, 2, '#c0c6d4');
      r(R + 1, y - 8, 6, 5, '#16181e');
      r(R + 3, y - 8, 2, 1, '#c0c6d4');
      r(R + 3, y - 5, 2, 2, '#f4f1e8');
      r(R + 6, y - 11, 1, 1, '#e2504a');
      break;
    case 'penset':
      r(R, y - 2, 8, 3, '#5a3d22');
      r(R, y - 2, 8, 1, '#7a5a3a');
      r(R + 2, y - 9, 1, 7, '#1a1a22');
      r(R + 2, y - 10, 1, 1, '#f2c14e');
      r(R + 5, y - 8, 1, 6, '#1a1a22');
      r(R + 5, y - 9, 1, 1, '#f2c14e');
      break;
    case 'trophy':
      r(R + 1, y, 7, 1, '#3a2b1a');
      r(R + 2, y - 2, 5, 2, '#7a5a1e');
      r(R + 4, y - 5, 1, 3, '#c9a227');
      r(R + 1, y - 11, 7, 6, '#f2c14e');
      r(R + 2, y - 11, 2, 4, '#fff6c8');
      r(R, y - 10, 1, 3, '#c9a227');
      r(R + 8, y - 10, 1, 3, '#c9a227');
      break;
  }
}

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
    case 'dancefloor': {
      // Glossy panels; the colour comes from the party's disco lights (scenes/partyLights.js).
      r(x, y, 16, 16, '#14111c');
      r(x + 1, y + 1, 14, 14, (tx + ty) % 2 ? '#3a3050' : '#2a2238');
      r(x + 2, y + 2, 6, 1, '#4a4064');
      break;
    }
    // Outdoors at the vacation hotel (core/hotel.js, `fl.ground`).
    case 'grass': {
      r(x, y, 16, 16, (tx + ty) % 2 ? '#5fa04a' : '#5a9a45');
      for (let i = 0; i < 5; i++) {
        const n = noiseAt(tx * 5 + i, ty * 11 + i, 4);
        r(x + Math.floor(n * 15), y + Math.floor(noiseAt(tx + i, ty, 5) * 14), 1, 2, n < 0.5 ? '#76b85c' : '#4d8a3c');
      }
      break;
    }
    case 'sand': {
      r(x, y, 16, 16, (tx + ty) % 2 ? '#ecd9a0' : '#e8d498');
      for (let i = 0; i < 6; i++) {
        const n = noiseAt(tx * 3 + i, ty * 7 + i, 6);
        r(x + Math.floor(n * 16), y + Math.floor(noiseAt(tx + i, ty, 7) * 16), 1, 1, n < 0.5 ? '#d9c283' : '#f6e8b8');
      }
      break;
    }
    case 'deck': {
      r(x, y, 16, 16, '#b98a5a');
      for (let i = 0; i < 4; i++) r(x, y + i * 4 + 3, 16, 1, '#8f6640');
      r(x + ((tx * 5) % 12) + 2, y + 1, 1, 1, '#6e4a2a');
      break;
    }
    case 'path': {
      r(x, y, 16, 16, '#5a9a45');
      r(x + 1, y + 1, 14, 14, '#d4cbb4');
      r(x + 1, y + 8, 14, 1, '#b8ad92');
      r(x + 8, y + 1, 1, 7, '#b8ad92');
      break;
    }
    case 'pool': {
      r(x, y, 16, 16, '#3ec1e0');
      const n = noiseAt(tx, ty, 8);
      r(x + Math.floor(n * 10), y + 4, 5, 1, '#8fe6f5');
      r(x + Math.floor(noiseAt(tx, ty, 9) * 10), y + 11, 4, 1, '#8fe6f5');
      break;
    }
    case 'sea':
    case 'surf': {
      r(x, y, 16, 16, ty % 3 === 0 ? '#2a86c7' : '#2a7fbf');
      const n = noiseAt(tx, ty, 10);
      if (n < 0.6) r(x + Math.floor(n * 20), y + 5 + Math.floor(n * 6), 4, 1, '#6fc0ec');
      if (style === 'surf') {
        r(x, y, 16, 3, '#e8f8ff');
        r(x + Math.floor(noiseAt(tx, 1, 11) * 10), y + 3, 6, 1, '#e8f8ff');
        r(x, y + 4, 16, 1, '#8fd0f0');
      }
      break;
    }
    // The roof (core/roof.js): gravel and paving slabs.
    case 'gravel': {
      r(x, y, 16, 16, (tx + ty) % 2 ? '#8a8c90' : '#86888c');
      for (let i = 0; i < 9; i++) {
        const n = noiseAt(tx * 9 + i, ty * 5 + i, 12);
        r(x + Math.floor(n * 16), y + Math.floor(noiseAt(tx + i, ty * 2, 13) * 16), 1, 1, n < 0.35 ? '#6e7074' : n < 0.7 ? '#a2a4a8' : '#9a948a');
      }
      break;
    }
    case 'roofslab': {
      r(x, y, 16, 16, '#b4b2aa');
      r(x, y, 16, 1, '#9a988f');
      r(x, y, 1, 16, '#9a988f');
      r(x + 8, y + 1, 1, 15, '#a8a69d');
      if (noiseAt(tx, ty, 14) < 0.2) r(x + 3, y + 10, 3, 1, '#9a988f');
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
    case 'atrium':
    case 'reception': return 'marble';
    case 'boardroom': return 'parquet';
    case 'hotellobby': return 'marble';
    case 'restaurant': return 'parquet';
    case 'copy': return 'tile';
    case 'manager': return deptId === 'exec' ? 'parquet' : 'carpet';
    case 'hr': return 'parquet';
    case 'archive': return 'corridor'; // the basement archive's bare concrete
    case 'special': return deptId === 'it' ? 'server' : deptId === 'exec' ? 'parquet' : 'carpet';
    default: return 'carpet';
  }
}

/**
 * Wall tile: top face shifted up by its front's height, front face shown when the tile below is open. The outer wall
 * (`outer`, the map's top row) stands OUTER_RISE px taller: same top, a taller front with the windows above a sill.
 * An inner wall meeting it (tile below not open) gets a longer top, so the two tops line up.
 */
export function drawWallTile(g, x, y, opts) {
  const { r } = P(g);
  const { top, front, openBelow, openAbove, openLeft, openRight, window: win, tx, outer, night, butts } = opts;
  const fh = WALL_H + (outer ? OUTER_RISE : 0);
  const ty = y - fh;
  const th = outer && !openBelow ? 16 + OUTER_RISE : 16;
  r(x, ty, 16, th, top);
  if (openAbove) r(x, ty, 16, 1, shade(top, 0.3));
  if (openLeft) r(x, ty, 1, th, shade(top, -0.3));
  if (openRight) r(x + 15, ty, 1, th, shade(top, -0.3));
  if (openBelow) {
    const fy = y + 16 - fh;
    r(x, fy, 16, fh, front);
    r(x, fy, 16, 1, shade(front, 0.2));
    r(x, fy + fh - 2, 16, 2, shade(front, -0.35));
    if (openLeft) r(x, fy, 1, fh, shade(front, -0.2));
    if (openRight) r(x + 15, fy, 1, fh, shade(front, -0.2));
    if (win && outer) {
      drawWindowGlass(g, x, y, tx, night);
      // The sill.
      r(x, fy + fh - 8, 16, 1, shade(front, 0.35));
      r(x, fy + fh - 7, 16, 1, shade(front, -0.15));
      // The fire-escape window (core/roof.js): cigarette butts on its sill.
      if (butts) {
        r(x + 3, fy + fh - 9, 2, 1, '#f4f1e8');
        r(x + 5, fy + fh - 9, 1, 1, '#e8a04a');
        r(x + 9, fy + fh - 9, 2, 1, '#e8e2c8');
        r(x + 12, fy + fh - 9, 1, 1, '#6a707c');
      }
    }
  }
}

/**
 * The glass of an outer wall window (drawWallTile's coordinates): a skyline by day, the night outside in the title
 * screen's colours (a dark sky, a star, a building with a lit window or two). The night shift draws it again on top
 * of its lighting, so the city stays lit.
 */
export function drawWindowGlass(g, x, y, tx, night) {
  const { r } = P(g);
  const gy = y + 16 - WALL_H - OUTER_RISE + 3;
  const gh = WALL_H + OUTER_RISE - 12;
  r(x + 1, gy - 1, 14, gh + 2, '#1a1a22');
  const hgt = 3 + Math.floor(noiseAt(tx, 1) * 6);
  const bx = x + 2 + (tx % 3) * 3;
  if (night) {
    r(x + 2, gy, 12, gh, '#121735');
    r(x + 2, gy + gh - 4, 12, 4, '#1b2147');
    r(x + 2 + Math.floor(noiseAt(tx, 2) * 12), gy + 1 + Math.floor(noiseAt(tx, 3) * 4), 1, 1, noiseAt(tx, 4) < 0.5 ? '#ffffff' : '#8890b0');
    r(bx, gy + gh - hgt, 3, hgt, '#0b0e24');
    if (noiseAt(tx, 5) < 0.6) r(bx + 1, gy + gh - hgt + 1, 1, 1, '#f2d878');
    if (hgt > 5 && noiseAt(tx, 6) < 0.4) r(bx + 1, gy + gh - 3, 1, 1, '#f2d878');
  } else {
    r(x + 2, gy, 12, gh, '#8ec5f0');
    r(x + 2, gy, 12, 1, '#c8e6fa');
    r(bx, gy + gh - hgt, 3, hgt, '#5a7a9a');
  }
}

/** The floor number plate on the outer wall beside the elevator (row-canvas coordinates of an outer wall tile). */
export function drawFloorPlate(g, x, y, label, accent) {
  const { r } = P(g);
  const fy = y + 16 - WALL_H - OUTER_RISE;
  const w = measureText(label) + 5;
  const px = x + Math.floor((16 - w) / 2);
  const py = fy + 3;
  r(px + 1, py + 1, w, 12, 'rgba(0,0,0,0.3)');
  r(px, py, w, 12, '#1a1c24');
  r(px + 1, py + 1, w - 2, 1, accent);
  drawText(g, label, px + w / 2, py + 3, { align: 'center', color: '#f4f1e8' });
}
