// Smoke Break mockup: the roof's skyline (dusk or night, like RoofScene's skyMode), a real hand in a suit sleeve holding
// a shaded cigarette between two fingers, curling smoke, the ember lighting the fingers at night.
import { W, H, C, rect, drawText, header, timerBar } from '../../../src/engine/mgkit.js';
import { gradient, blob, line, glow, speckle, shade, rnd, styleIs, cells } from './kit.js';

const CIG = { x: 150, y: 132, len: 250, h: 8 };
const FILTER = 0.12;

/** Capsule from (x1,y1) to (x2,y2) of radius r, shaded across its width (lit from above), with an outline. */
function limb(g, x1, y1, x2, y2, r, tones, outline) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L2 = dx * dx + dy * dy || 1;
  const nx = -dy / Math.sqrt(L2);
  const ny = dx / Math.sqrt(L2);
  const minX = Math.floor(Math.min(x1, x2) - r - 2);
  const maxX = Math.ceil(Math.max(x1, x2) + r + 2);
  const minY = Math.floor(Math.min(y1, y2) - r - 2);
  const maxY = Math.ceil(Math.max(y1, y2) + r + 2);
  const c = styleIs('mid') ? 2 : 1; // the mid style paints 2 px cells
  for (let y = minY - (minY % c); y <= maxY; y += c)
    for (let x = minX - (minX % c); x <= maxX; x += c) {
      const k = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
      const px = x1 + dx * k;
      const py = y1 + dy * k;
      const d = Math.hypot(x - px, y - py);
      if (d <= r + c && d > r) rect(g, x, y, c, c, outline);
      else if (d <= r) {
        const across = ((x - px) * nx + (y - py) * ny) / r; // -1 .. 1 across the limb
        const up = ny < 0 ? -across : across; // positive towards the top of the screen
        const tt = c > 1 ? [tones[1], tones[2], tones[2], tones[3]] : tones; // mid: three flat tones
        const i = Math.max(0, Math.min(tt.length - 1, Math.round(((up + 1) / 2) * (tt.length - 1))));
        rect(g, x, y, c, c, tt[i]);
      }
    }
}

const PAL = {
  dusk: {
    sky: ['#2e2350', '#4a2f6a', '#7a3f78', '#c0587a', '#f08a6a', '#ffc884'],
    far: '#6a5080',
    near: '#2b2a4a',
    lit: 0.25,
    skin: ['#9a5a3a', '#c8865c', '#e0a878', '#f0c498'],
    sleeve: ['#141a2c', '#1f2a44', '#2b3a5c', '#3a4c74'],
    parapet: ['#8a8c90', '#a8a8a6', '#c8c4b8'],
  },
  night: {
    sky: ['#05060f', '#0a1024', '#121c3c', '#1e2a52', '#2a3a66'],
    far: '#1e2440',
    near: '#0e1020',
    lit: 0.45,
    skin: ['#4a3040', '#6a4450', '#8a5a5a', '#a87068'],
    sleeve: ['#080a14', '#0e1220', '#161c30', '#202a44'],
    parapet: ['#3a3c48', '#4a4c58', '#5a5c68'],
  },
};

function sky(g, p, mood, t) {
  gradient(g, 0, 18, W, 182, p.sky);
  if (mood === 'dusk') {
    glow(g, 372, 182, 70, '#ffd890', 0.7);
    blob(g, 372, 182, 22, 22, '#ffe8b0');
    blob(g, 372, 182, 18, 18, '#fff4d0');
    for (const [x, y, w] of [[40, 96, 120], [250, 84, 160], [330, 120, 110], [90, 140, 90]]) {
      rect(g, x, y, w, 2, '#e07a8a');
      rect(g, x + 8, y + 2, w - 20, 1, '#ffb090');
    }
  } else {
    const r = rnd(33);
    for (let i = 0; i < 90; i++) rect(g, Math.floor(r() * W), 18 + Math.floor(r() * 120), 1, 1, r() > 0.8 ? '#ffffff' : '#8a96c0');
    blob(g, 404, 52, 13, 13, '#e8ecf4');
    blob(g, 409, 48, 12, 12, p.sky[1]);
    glow(g, 400, 52, 30, '#c8d4ff', 0.5);
  }
}

function skyline(g, p, t) {
  const r = rnd(17);
  // Far layer.
  for (let x = -10; x < W; ) {
    const bw = 20 + Math.floor(r() * 30);
    const bh = 40 + Math.floor(r() * 50);
    rect(g, x, 200 - bh - 26, bw, bh + 26, p.far);
    x += bw + 2;
  }
  // Near layer with lit windows, a water tower, an antenna with its red light.
  const r2 = rnd(29);
  for (let x = -6; x < W; ) {
    const bw = 26 + Math.floor(r2() * 40);
    const bh = 30 + Math.floor(r2() * 70);
    const top = 200 - bh;
    rect(g, x, top, bw, bh, p.near);
    rect(g, x, top, bw, 1, shade(p.near, 0.15));
    for (let wy = top + 5; wy < 196; wy += 6)
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r2() < p.lit) rect(g, wx, wy, 2, 3, r2() > 0.3 ? '#ffd27a' : '#bfe0ff');
    x += bw + 3;
  }
  rect(g, 300, 104, 20, 14, p.near);
  blob(g, 310, 104, 10, 3, p.near);
  for (const lx of [302, 316]) rect(g, lx, 118, 2, 14, p.near);
  rect(g, 182, 70, 2, 40, p.near);
  if (Math.floor(t * 2) % 2 === 0) {
    glow(g, 183, 70, 8, '#ff4040', 0.9);
    rect(g, 182, 69, 3, 3, '#ff5050');
  }
}

function parapet(g, p) {
  rect(g, 0, 200, W, 6, p.parapet[2]);
  rect(g, 0, 200, W, 1, shade(p.parapet[2], 0.2));
  rect(g, 0, 206, W, 2, shade(p.parapet[0], -0.3));
  rect(g, 0, 208, W, H - 208, p.parapet[0]);
  for (let y = 208, i = 0; y < H; y += 14, i++) {
    rect(g, 0, y, W, 1, shade(p.parapet[0], -0.18));
    for (let x = (i % 2) * 24; x < W; x += 48) rect(g, x, y, 1, 14, shade(p.parapet[0], -0.18));
  }
  speckle(g, 0, 208, W, H - 208, [shade(p.parapet[0], -0.1), shade(p.parapet[0], 0.08)], 500, 6);
  for (const x of [60, 230, 330]) for (let k = 0; k < 14; k++) rect(g, x + (k % 3), 208 + k * 3, 2, 3, 'rgba(40,30,30,0.18)');
  // A tin ashtray and a coffee cup on the ledge.
  rect(g, 418, 190, 18, 12, '#6a707c');
  rect(g, 418, 190, 18, 2, '#9aa1ad');
  rect(g, 422, 186, 8, 3, '#f4f1e8');
  rect(g, 428, 184, 2, 4, '#d98a3a');
  rect(g, 446, 186, 12, 15, '#f4f1e8');
  rect(g, 446, 186, 12, 3, '#3a2a1a');
  rect(g, 446, 192, 12, 4, '#e2504a');
}

// The hand is drawn about 1.7x the size of today's, around the grip point, so the fingers match the cigarette.
const S = 1.7;
const GX = 150;
const GY = 136;
const T = (x, y) => [GX + (x - GX) * S, GY + (y - GY) * S];
function limbS(g, x1, y1, x2, y2, r, tones, outline) {
  const [a, b] = T(x1, y1);
  const [c, d] = T(x2, y2);
  limb(g, a, b, c, d, r * S, tones, outline);
}

/**
 * The mid style's hand: a cell sprite like the masseur's hands (3 px cells, a dark outline, flat skin in two tones),
 * seen from the side. Drawn in two layers: behind the cigarette (sleeve, cuff, the back of the hand, the middle finger
 * under the filter, the thumb, the curled fingers), then the index finger in front, over the filter's top edge.
 */
const HC = 3;
const HX = CIG.x - 13 * HC;
const HY = CIG.y - 4 * HC;
function drawParts(g, parts) {
  for (const [cx, cy, w, h] of parts) rect(g, HX + cx * HC - 2, HY + cy * HC - 2, w * HC + 4, h * HC + 4, '#2a1a14');
  const r = cells(g, HX, HY, HC);
  for (const [cx, cy, w, h, col] of parts) r(cx, cy, w, h, col);
}
function handBack(g, p) {
  const [SD, SK] = [p.skin[1], p.skin[2]];
  // The sleeve comes straight in from the left edge to the cuff, a fold line or two.
  const left = -Math.ceil(HX / HC) - 1;
  drawParts(g, [[left, 1, -1 - left, 12, p.sleeve[2]]]);
  rect(g, 0, HY + HC, HX - HC, 2 * HC, p.sleeve[3]);
  rect(g, 0, HY + 10 * HC, HX - HC, 3 * HC, p.sleeve[1]);
  for (const fx of [40, 78, 104]) rect(g, fx, HY + 4 * HC, 2, 5 * HC, p.sleeve[1]);
  drawParts(g, [
    [-1, 0, 4, 14, '#f4f6f8'],
    [5, 0, 7, 1, SK], // back of the hand: knuckles high, rounded at the wrist
    [3, 1, 9, 11, SK],
    [4, 12, 7, 1, SK],
    [12, 8, 9, 2, SK], // middle finger, under the filter
    [11, 11, 7, 2, SK], // thumb, pointing along below
    [8, 12, 4, 2, SD], // curled ring and little fingers
  ]);
  rect(g, HX - HC, HY + 11 * HC, 4 * HC, 3 * HC, '#c8ccd2');
  rect(g, HX, HY + 6 * HC, HC, HC, '#c8a040');
  rect(g, HX + 3 * HC, HY + 10 * HC, 9 * HC, 2 * HC, SD); // the hand's underside in shadow
  rect(g, HX + 4 * HC, HY + 12 * HC, 7 * HC, HC, SD);
  rect(g, HX + 20 * HC, HY + 8 * HC, HC, 2 * HC, p.skin[3]); // nail
  rect(g, HX + 17 * HC, HY + 11 * HC, HC, 2 * HC, p.skin[3]);
  rect(g, HX + 16 * HC, HY + 8 * HC, 1, 2 * HC, SD); // knuckle crease
}
function handFront(g, p) {
  drawParts(g, [[12, 1, 11, 3, p.skin[2]]]); // index finger, its lower edge over the filter
  rect(g, HX + 10 * HC, HY + HC, 3 * HC, 3 * HC, p.skin[2]); // joined to the hand: no outline at the knuckle
  rect(g, HX + 22 * HC, HY + HC, HC, 2 * HC, p.skin[3]);
  rect(g, HX + 17 * HC, HY + HC, 1, 3 * HC, p.skin[1]);
  rect(g, HX + 12 * HC, HY + 3 * HC, 11 * HC, 1, p.skin[1]);
}

function hand(g, p) {
  if (styleIs('mid')) return handBack(g, p);
  const OUT = shade(p.skin[0], -0.4);
  // Suit sleeve from the bottom-left, the shirt cuff, then the back of the hand.
  limbS(g, 60, 240, 98, 162, 17, p.sleeve, '#05060a');
  limbS(g, 96, 164, 104, 152, 10, ['#b8bcc4', '#d8dce0', '#f4f6f8', '#ffffff'], '#3a3d44');
  const [cx, cy] = T(101, 161);
  rect(g, cx, cy, 4, 4, '#c8a040');
  limbS(g, 108, 150, 132, 139, 10, p.skin, OUT); // back of the hand
  // Curled ring and little fingers, the thumb tucked under.
  limbS(g, 126, 150, 136, 153, 4.5, p.skin, OUT);
  limbS(g, 120, 155, 129, 158, 4, p.skin, OUT);
  limbS(g, 112, 152, 127, 149, 4, p.skin, OUT);
  // Middle finger under the filter, index finger over it.
  limbS(g, 132, 143, 163, 144, 3.6, p.skin, OUT);
  limbS(g, 130, 129, 166, 127, 3.6, p.skin, OUT);
  // Knuckle creases and nails.
  for (const [x, y] of [[147, 127], [149, 144]]) {
    const [kx, ky] = T(x, y);
    rect(g, kx, ky - 2, 1, 5, OUT);
  }
  for (const [x, y] of [[166, 126], [163, 143]]) {
    const [nx, ny] = T(x, y);
    rect(g, nx - 3, ny - 2, 3, 4, shade(p.skin[3], 0.3));
  }
}

function cigarette(g, len, heat, ash, t, mood) {
  const fw = Math.round(CIG.len * FILTER);
  const pw = Math.round(CIG.len * (len - FILTER));
  const x = CIG.x;
  const y = CIG.y;
  const FIL = ['#f2b060', '#e4a050', '#d98a3a', '#c87a30', '#b06428', '#9a5420'];
  const PAP = ['#ffffff', '#fbf9f4', '#f4f1e8', '#ebe7de', '#dedad0', '#cfcac0'];
  rect(g, x - 1, y - 1, fw + pw + 2, CIG.h + 2, '#2a2228');
  for (let k = 0; k < CIG.h; k++) {
    const i = styleIs('mid') ? [0, 0, 2, 2, 2, 2, 4, 4][k] : Math.min(5, Math.floor((k / CIG.h) * 6));
    rect(g, x, y + k, fw, 1, FIL[i]);
    rect(g, x + fw, y + k, pw, 1, PAP[i]);
  }
  speckle(g, x, y + 1, fw, CIG.h - 2, ['#a85a20', '#f8c070'], 40, 2);
  rect(g, x + fw, y, 2, CIG.h, '#e8c860');
  rect(g, x + fw + 2, y, 1, CIG.h, '#c8a040');
  // The ash: grey with cracks, then the ember.
  const tip = x + fw + pw;
  const aw = Math.round(CIG.len * ash);
  for (let k = 0; k < CIG.h; k++) rect(g, tip - aw, y + k, aw, 1, ['#b4b8c0', '#a0a4ac', '#8a8e98', '#7a7e88', '#6a6e78', '#5a5e68', '#5a5e68', '#4a4e58'][k]);
  for (let i = 0; i < aw; i += 4) rect(g, tip - aw + i, y + 1 + (i % 3) * 2, 2, 1, '#4a4e58');
  const hot = heat > 0.5;
  glow(g, tip, y + 4, mood === 'night' ? 30 : 20, '#ff8030', mood === 'night' ? 0.8 : 0.6);
  rect(g, tip - 3, y, 4, CIG.h, '#6a2a1a');
  rect(g, tip - 3, y + 1, 4, CIG.h - 2, hot ? '#ff8a3a' : '#c84a2a');
  rect(g, tip - 2, y + 2, 2, CIG.h - 4, '#ffd06a');
  rect(g, tip, y + 3, 1, 2, '#fff4b0');
  // Smoke: a ribbon curling up from the tip, widening and fading.
  for (let i = 0; i < 60; i++) {
    const f = i / 60;
    const sx = tip + 2 + Math.sin(i * 0.25 + t * 2) * (2 + f * 14) + f * 20;
    const sy = y - 2 - i * 1.8;
    g.save();
    g.globalAlpha = 0.55 * (1 - f);
    blob(g, Math.round(sx), Math.round(sy), 1 + Math.floor(f * 4), 1 + Math.floor(f * 3), mood === 'night' ? '#a8b0c8' : '#f4f0f4');
    g.restore();
  }
}

function meters(g, heat, sweet) {
  // The same two gauges as today, framed as one panel.
  const mx = 420;
  const my = 36;
  const mh = 130;
  rect(g, mx - 6, my - 6, 60, mh + 26, 'rgba(10,8,20,0.55)');
  rect(g, mx - 1, my - 1, 16, mh + 2, '#1a1a22');
  gradient(g, mx, my, 14, mh, ['#c84a3a', '#e8a040', '#3a8a4a', '#3a8a4a', '#2a4a6a', '#1a2a3a']);
  rect(g, mx, my + Math.round(mh * (1 - sweet[1])), 14, 1, '#9af0b0');
  rect(g, mx, my + Math.round(mh * (1 - sweet[0])), 14, 1, '#9af0b0');
  const hy = my + Math.round(mh * (1 - heat));
  rect(g, mx - 4, hy - 1, 22, 3, '#ffd06a');
  rect(g, mx - 4, hy - 2, 22, 1, '#1a1a22');
  drawText(g, 'HEAT', mx + 7, my + mh + 4, { align: 'center', color: C.text });
  drawText(g, 'ASH', mx + 34, my + mh + 4, { align: 'center', color: C.text });
  rect(g, mx + 27, my + mh - 40, 14, 41, '#1a1a22');
  rect(g, mx + 28, my + mh - 39 + 22, 12, 17, '#9aa1ad');
}

export function smoke(g, t, mood = 'dusk') {
  const p = PAL[mood];
  sky(g, p, mood, t);
  skyline(g, p, t);
  parapet(g, p);
  hand(g, p);
  if (mood === 'night') {
    // The ember's warm light on the fingers and the cuff.
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 24; k > 0; k -= 4) {
      g.globalAlpha = 0.035;
      blob(g, 186, 136, k * 2, k, '#ff7a30');
    }
    g.restore();
  }
  cigarette(g, 0.62, 0.6, 0.05, t, mood);
  if (styleIs('mid')) handFront(g, p);
  meters(g, 0.6, [0.45, 0.75]);
  const b = { x: W - 96, y: H - 44, w: 84, h: 26 };
  rect(g, b.x, b.y, b.w, b.h, C.border);
  rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, '#3a4058');
  rect(g, b.x + 1, b.y + 1, b.w - 2, 1, '#5a6078');
  drawText(g, 'FLICK ASH', b.x + b.w / 2, b.y + 5, { align: 'center', color: C.text });
  drawText(g, 'F', b.x + b.w / 2, b.y + 15, { align: 'center', color: C.dim });
  drawText(g, 'Hold to draw', W / 2, H - 40, { align: 'center', color: '#e8e4f0', shadow: '#1a1a22' });
  header(g, 'Smoke Break', 'Sweet spot 64%');
  timerBar(g, 0.5, 0.88);
}
