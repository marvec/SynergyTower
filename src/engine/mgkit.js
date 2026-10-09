// Shared helpers for mini-games so they look and feel consistent.
// Mini-game contract (see docs spec §2):
//   export default { id, name, help, create(params) } → instance { update(dt, input), render(g), done, score }
//   params: { difficulty 0..1, rng, theme: { dept, title }, sfx(name) }
import { drawText, drawWrapped, measureText } from './font.js';
import { C, rect, frame, panel, bar } from './ui.js';
import { W, H } from './screen.js';

export { W, H, C, rect, frame, panel, bar, drawText, drawWrapped, measureText };

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Value interpolated by difficulty: easy at d=0, hard at d=1. */
export const byDiff = (d, easy, hard) => lerp(easy, hard, clamp(d, 0, 1));

/** Office-y background for mini-games: wall + desk surface. */
export function backdrop(g, opts = {}) {
  const wall = opts.wall || '#3a4058';
  const desk = opts.desk || '#6b4a32';
  rect(g, 0, 0, W, H, wall);
  for (let x = 0; x < W; x += 24) rect(g, x, 0, 1, H - 60, 'rgba(0,0,0,0.08)');
  rect(g, 0, H - 60, W, 60, desk);
  rect(g, 0, H - 60, W, 2, 'rgba(255,255,255,0.18)');
  for (let y = H - 52; y < H; y += 9) rect(g, 0, y, W, 1, 'rgba(0,0,0,0.12)');
}

/** Title strip at the top: task title (left), extra text (right). */
export function header(g, title, right = '') {
  rect(g, 0, 0, W, 14, C.border);
  rect(g, 0, 0, W, 13, C.accentDark);
  rect(g, 0, 12, W, 1, C.accent);
  drawText(g, title, 6, 3, { color: C.text });
  if (right) drawText(g, right, W - 6, 3, { color: C.gold, align: 'right' });
}

/** Thin countdown bar under the header. */
export function timerBar(g, remaining, total) {
  const f = clamp(remaining / total, 0, 1);
  const col = f > 0.5 ? C.good : f > 0.2 ? C.warn : C.bad;
  bar(g, 0, 13, W, 5, f, col);
}

/** Computer monitor bezel; returns the inner screen rect. */
export function monitor(g, x, y, w, h, screen = '#e9eef5') {
  rect(g, x + w / 2 - 14, y + h, 28, 8, '#2b2e38');
  rect(g, x + w / 2 - 26, y + h + 7, 52, 4, '#2b2e38');
  rect(g, x - 5, y - 5, w + 10, h + 10, C.border);
  rect(g, x - 4, y - 4, w + 8, h + 8, '#3d4150');
  rect(g, x - 4, y - 4, w + 8, 1, '#5a5f70');
  rect(g, x, y, w, h, screen);
  rect(g, x + w + 1, y + h + 1, 2, 1, C.good);
  return { x, y, w, h };
}

/** Sheet of paper. */
export function paper(g, x, y, w, h) {
  rect(g, x + 2, y + 2, w, h, 'rgba(0,0,0,0.3)');
  rect(g, x, y, w, h, C.paper);
  frame(g, x, y, w, h, '#b8b09a');
}

/** Rising, fading feedback texts ("+1", "Oops!"). */
export class Floaters {
  constructor() {
    this.list = [];
  }
  add(text, x, y, color = C.text) {
    this.list.push({ text, x, y, color, t: 0 });
  }
  update(dt) {
    for (const f of this.list) f.t += dt;
    this.list = this.list.filter((f) => f.t < 0.9);
  }
  render(g) {
    for (const f of this.list) {
      g.globalAlpha = 1 - f.t / 0.9;
      drawText(g, f.text, f.x, f.y - f.t * 22, { color: f.color, align: 'center', shadow: C.border });
      g.globalAlpha = 1;
    }
  }
}

/** Screen shake helper for errors. */
export class Shake {
  constructor() {
    this.t = 0;
  }
  hit(t = 0.25) {
    this.t = t;
  }
  update(dt) {
    this.t = Math.max(0, this.t - dt);
  }
  apply(g) {
    if (this.t > 0) g.translate(Math.round((Math.random() - 0.5) * 6 * this.t * 4), 0);
  }
}

/** A countdown that flags expiry once. */
export class Countdown {
  constructor(total) {
    this.total = total;
    this.left = total;
  }
  update(dt) {
    this.left = Math.max(0, this.left - dt);
    return this.left <= 0;
  }
  get frac() {
    return this.left / this.total;
  }
}

/** Card-style choice box with number label; returns true if pointer is inside. */
export function choiceBox(g, x, y, w, h, label, text, state = 'idle') {
  const fill = state === 'right' ? '#2f6b3a' : state === 'wrong' ? '#7a2b2b' : state === 'focus' ? C.panelLight : C.panel;
  panel(g, x, y, w, h, { fill });
  if (state === 'focus') frame(g, x - 1, y - 1, w + 2, h + 2, C.gold);
  if (label) {
    rect(g, x + 3, y + 3, 11, 11, C.accent);
    drawText(g, label, x + 9, y + 5, { align: 'center' });
  }
  drawWrapped(g, text, x + (label ? 18 : 6), y + Math.max(4, Math.floor(h / 2) - 4), w - (label ? 24 : 12), { color: C.text });
}

/** Tiny pixel-person bust used in several games (badge, calendar, coffee orders). */
export function face(g, x, y, seed, scale = 1) {
  const skins = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];
  const hairs = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#c8c8c8', '#1a1a1a'];
  const shirts = ['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#555a66'];
  const s = scale;
  const skin = skins[seed % 4];
  const hair = hairs[(seed >> 2) % 6];
  const shirt = shirts[(seed >> 3) % 6];
  rect(g, x + 1 * s, y + 9 * s, 10 * s, 5 * s, shirt);
  rect(g, x + 3 * s, y + 2 * s, 6 * s, 7 * s, skin);
  rect(g, x + 3 * s, y + 1 * s, 6 * s, 2 * s, hair);
  if ((seed >> 5) % 2) rect(g, x + 2 * s, y + 2 * s, 1 * s, 4 * s, hair), rect(g, x + 9 * s, y + 2 * s, 1 * s, 4 * s, hair);
  rect(g, x + 4 * s, y + 5 * s, 1 * s, 1 * s, '#222');
  rect(g, x + 7 * s, y + 5 * s, 1 * s, 1 * s, '#222');
  rect(g, x + 5 * s, y + 7 * s, 2 * s, 1 * s, '#7a3b3b');
  if ((seed >> 6) % 3 === 0) rect(g, x + 3 * s, y + 4 * s, 6 * s, 1 * s, '#222');
}

/** Standard end: compute score 0..1 and mark done. */
export function finish(inst, score) {
  if (inst.done) return;
  inst.score = clamp(score, 0, 1);
  inst.done = true;
}

const inRectP = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/**
 * Choice selection for 2-column option grids: number keys, pointer hover/click, arrows + Space/Enter.
 * `st.focus` holds the keyboard focus. Returns the picked index or -1.
 */
export function pickChoice(input, rects, st) {
  const n = rects.length;
  for (let k = 0; k < n; k++) if (input.pressedExact(String(k + 1))) return k;
  const p = input.pointer;
  let hit = -1;
  rects.forEach((r, k) => {
    if (inRectP(p, r)) {
      if (p.moved) st.focus = k;
      if (p.clicked) hit = k;
    }
  });
  if (hit >= 0) return hit;
  if (input.pressed('ArrowRight')) st.focus = (st.focus + 1) % n;
  if (input.pressed('ArrowLeft')) st.focus = (st.focus + n - 1) % n;
  if (input.pressed('ArrowDown') && st.focus + 2 < n) st.focus += 2;
  if (input.pressed('ArrowUp') && st.focus - 2 >= 0) st.focus -= 2;
  if (input.confirm()) return st.focus;
  return -1;
}
