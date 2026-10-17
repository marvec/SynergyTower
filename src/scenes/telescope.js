// The roof's pay telescope (scenes/roof.js): a coin's worth (ROOF.telescopeS) of the city through binoculars. A wide,
// deterministic skyline in parallax layers at the roof's time of day, panned with the arrows or a drag, zoomed with
// up/down or the wheel. Five sights to spot (core/roof.js EGGS): click one, or line the crosshair up with it (the view
// only turns sideways, so anywhere above or below it counts) and press Space.
import { W, H, makeCanvas } from '../engine/screen.js';
import { C, rect } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { createRng } from '../core/rng.js';
import * as RF from '../core/roof.js';
import { CLIENTS } from '../data/trip.js';
import { TELESCOPE_HELP, EGG_NAMES, EGG_LINES, SPOTTED_ALL, TELESCOPE_SHUTTER } from '../data/roof.js';
import { drawSky } from './cityscape.js';

const PAN_MAX = 1200; // how far the view turns (near-layer px)
const HORIZON = 150; // the horizon's y at zoom 1, in panorama px
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const MIN_SPOT_PX = 9; // a sight must look at least this big on screen to be made out
const RIVAL = 'BIGGERCORP';

/** One layer of buildings: { f (parallax), base (y), list: [{ x, w, h, win: [[x, y], ...] }] }. Deterministic. */
function layer(seed, f, base, minH, maxH, from, to) {
  const r = createRng(seed);
  const list = [];
  for (let x = from; x < to; ) {
    const w = r.int(16, 40);
    const h = r.int(minH, maxH);
    const win = [];
    for (let y = 4; y < h - 4; y += 5) for (let xx = 3; xx < w - 3; xx += 4) if (r.chance(0.35)) win.push([xx, y]);
    list.push({ x, w, h, win });
    x += w + r.int(0, 6);
  }
  return { f, base, list };
}

const LAYERS = {
  far: layer(71, 0.25, HORIZON + 6, 10, 40, -400, 900),
  mid: layer(72, 0.55, HORIZON + 70, 20, 70, -400, 1400),
};

/** The sights, each on a layer (parallax f), in that layer's px: where to look for them. */
export const SIGHTS = {
  hotel: { f: 0.12, x: 60, y: HORIZON - 4, w: 14, h: 6 },
  client: { f: 0.55, x: 180, y: HORIZON + 44, w: 34, h: 18 },
  balloon: { f: 0.4, x: 260, y: 62, w: 10, h: 14, moves: true },
  waver: { f: 1, x: 838, y: 186, w: 10, h: 12 }, // in the glass of one of drawNear's top-row windows (836, 185)
  rival: { f: 0.55, x: 640, y: HORIZON - 56, w: 30, h: 126 },
};

export class TelescopeView {
  constructor(game, { mode = 'day', onClose = null } = {}) {
    this.game = game;
    this.mode = mode;
    this.onClose = onClose;
    this.left = RF.ROOF.telescopeS;
    this.cx = 300;
    this.zoom = 1;
    this.t = 0;
    this.shutter = 0; // 0..1 closing at the end
    this.dragX = null;
    this.flash = null; // { egg, t } just spotted
    this.note = null; // { text, t } a line at the bottom
    this.mask = null;
  }

  get night() {
    return this.mode === 'night';
  }

  enter() {
    this.game.sfx('click');
  }

  /** Screen position of a point on a layer with parallax f. */
  toScreen(f, x, y) {
    return { x: (x - this.cx * f) * this.zoom + W / 2, y: (y - HORIZON) * this.zoom + H / 2 + 10 };
  }

  /** A sight's rectangle on screen right now. */
  sightRect(id) {
    const s = SIGHTS[id];
    const x = s.moves ? s.x + ((this.t * 5) % 300) : s.x;
    const y = s.moves ? s.y + Math.sin(this.t * 0.7) * 6 : s.y;
    const p = this.toScreen(s.f, x, y);
    return { x: p.x, y: p.y, w: s.w * this.zoom, h: s.h * this.zoom };
  }

  /** The sight under a screen point (expanded a little), or null. */
  sightAt(px, py) {
    for (const id of RF.EGGS) {
      const r = this.sightRect(id);
      if (px >= r.x - 4 && px <= r.x + r.w + 4 && py >= r.y - 4 && py <= r.y + r.h + 4) return id;
    }
    return null;
  }

  /**
   * The sight lined up with the crosshair for the keyboard: the view turns only sideways, so any sight on screen whose
   * span (give or take a few px) takes in the crosshair's x, one not spotted yet first, then the nearest to it.
   */
  sightInLine() {
    const cx = W / 2;
    const cy = H / 2 + 10;
    const spotted = this.game.state.roof?.spotted || {};
    let best = null;
    let bestD = Infinity;
    for (const id of RF.EGGS) {
      const r = this.sightRect(id);
      if (cx < r.x - 4 || cx > r.x + r.w + 4 || r.y + r.h < 14 || r.y > H) continue;
      const d = Math.abs(Math.max(r.y, Math.min(cy, r.y + r.h)) - cy) + (spotted[id] ? 1e4 : 0);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /** Spots the sight at a screen point (a click), or `id` (the keyboard's, from sightInLine). */
  trySpot(px, py, id = this.sightAt(px, py)) {
    const game = this.game;
    if (!id) return false;
    const r = this.sightRect(id);
    if (Math.max(r.w, r.h) < MIN_SPOT_PX) {
      this.note = { text: 'Something there... zoom in to make it out.', t: 2 };
      return true;
    }
    const s = game.state;
    if (!RF.spot(s, id)) {
      this.note = { text: `Seen it: ${EGG_NAMES[id]}.`, t: 1.5 };
      return true;
    }
    track('roof_spotted', { what: id });
    game.sfx('coin');
    game.saveNow();
    this.flash = { id, t: 1.2 };
    this.note = { text: EGG_LINES[id], t: 4 };
    if (RF.allSpotted(s)) game.toast(SPOTTED_ALL, C.gold);
    return true;
  }

  close() {
    if (this.game.top === this) this.game.pop();
    this.onClose?.();
  }

  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.flash) this.flash.t -= dt;
    if (this.note && (this.note.t -= dt) <= 0) this.note = null;
    if (this.shutter > 0) {
      this.shutter += dt * 2;
      if (this.shutter >= 1.4) this.close();
      return;
    }
    if (input.back()) return this.close();
    this.left -= dt;
    if (this.left <= 0) {
      this.shutter = 0.01;
      this.note = { text: TELESCOPE_SHUTTER, t: 2 };
      this.game.sfx('door');
      return;
    }
    const pan = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
    this.cx += (pan * 220 * dt) / this.zoom;
    const z = (input.down('ArrowUp') ? 1 : 0) - (input.down('ArrowDown') ? 1 : 0);
    this.zoom += z * 1.5 * dt;
    const wheel = input.wheel?.() || 0;
    if (wheel) this.zoom -= Math.sign(wheel) * 0.25;
    const p = input.pointer;
    if (p.clicked) {
      if (!this.trySpot(p.x, p.y)) this.dragX = p.x;
    }
    if (p.down && this.dragX != null) {
      this.cx -= (p.x - this.dragX) / this.zoom;
      this.dragX = p.x;
    } else this.dragX = null;
    if (input.confirm()) {
      const id = this.sightInLine();
      if (!id || !this.trySpot(0, 0, id)) this.note = { text: 'Nothing special in line with the crosshair.', t: 1.2 };
    }
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom));
    this.cx = Math.max(0, Math.min(PAN_MAX, this.cx));
  }

  // ------------------------------------------------------------ drawing
  box(f, x, y, w, h, color) {
    const p = this.toScreen(f, x, y);
    const x0 = Math.round(p.x);
    const y0 = Math.round(p.y);
    const x1 = Math.round(p.x + w * this.zoom);
    const y1 = Math.round(p.y + h * this.zoom);
    if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) return;
    rect(this.g, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), color);
  }

  drawLayer(L, body, lit) {
    for (const b of L.list) {
      const p = this.toScreen(L.f, b.x, 0);
      if (p.x > W || p.x + b.w * this.zoom < 0) continue;
      this.box(L.f, b.x, L.base - b.h, b.w, b.h + 200, body);
      if (this.zoom > 1.4 || this.night) for (const [wx, wy] of b.win) this.box(L.f, b.x + wx, L.base - b.h + wy, 2, 3, lit);
    }
  }

  render(g) {
    this.g = g;
    const night = this.night;
    const dusk = this.mode === 'dusk';
    drawSky(g, W, H, this.mode, this.t);
    // The far city; in front of it on the horizon, the sea far off on the left with the holiday hotel's beach.
    this.drawLayer(LAYERS.far, night ? '#1c2240' : dusk ? '#4a3a6a' : '#9ab4d0', night ? '#d8c068' : '#c8daea');
    const sea = night ? '#18204a' : dusk ? '#6a5a8a' : '#4a8ac8';
    this.box(0.12, -260, HORIZON - 2, 520, 8, sea);
    const h = SIGHTS.hotel;
    this.box(0.12, h.x - 6, h.y + 4, h.w + 12, 2, night ? '#5a5040' : '#ecd9a0');
    this.box(0.12, h.x + 3, h.y, 8, 4, night ? '#f2d878' : '#f4f1e8');
    this.box(0.12, h.x, h.y - 1, 1, 5, '#3a6a2a');
    this.box(0.12, h.x - 1, h.y - 1, 3, 1, '#4caf50');
    this.box(0.12, h.x + 12, h.y + 1, 1, 4, '#3a6a2a');
    this.box(0.12, h.x + 11, h.y + 1, 3, 1, '#4caf50');
    // The balloon, the mid city with the rival tower behind it and the client's office in front.
    this.drawBalloon();
    this.drawRival();
    this.drawLayer(LAYERS.mid, night ? '#141932' : dusk ? '#3a2a4a' : '#6b86a6', night ? '#f2d878' : '#a8c4dc');
    this.drawClient();
    this.drawNear();
    this.drawMask(g);
    this.drawHud(g);
  }

  drawBalloon() {
    const r = this.sightRect('balloon');
    const z = this.zoom;
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    const c = ['#e2504a', '#f2c230', '#2a6ad1'];
    for (let i = 0; i < 3; i++) rect(this.g, x + Math.round(i * 3 * z), y, Math.max(1, Math.round(4 * z)), Math.round(9 * z), c[i]);
    rect(this.g, x + Math.round(2 * z), y + Math.round(9 * z), Math.max(1, Math.round(6 * z)), Math.max(1, Math.round(2 * z)), c[0]);
    rect(this.g, x + Math.round(3 * z), y + Math.round(11 * z), Math.max(1, Math.round(4 * z)), Math.max(1, Math.round(3 * z)), '#8a5a3a');
    if (this.night && Math.floor(this.t * 3) % 2) rect(this.g, x + Math.round(4 * z), y + Math.round(10 * z), Math.max(1, Math.round(2 * z)), Math.max(1, z), '#ffd06a');
  }

  drawRival() {
    const s = SIGHTS.rival;
    const body = this.night ? '#20284a' : this.mode === 'dusk' ? '#4a3a5a' : '#5a6a8a';
    this.box(s.f, s.x, s.y, s.w, s.h + 200, body);
    this.box(s.f, s.x + s.w / 2 - 1, s.y - 16, 2, 16, body);
    for (let y = 8; y < s.h; y += 6) for (let x = 3; x < s.w - 3; x += 5) this.box(s.f, s.x + x, s.y + y, 2, 3, this.night ? '#f2d878' : '#b8cce0');
    // Its logo, bigger than ours.
    this.box(s.f, s.x - 3, s.y + 1, s.w + 6, 6, '#c94a3b');
    if (this.zoom >= 2) {
      const p = this.toScreen(s.f, s.x + s.w / 2, s.y + 1.5);
      drawText(this.g, RIVAL, Math.round(p.x), Math.round(p.y), { align: 'center', color: '#ffffff' });
    }
  }

  drawClient() {
    const s = SIGHTS.client;
    const body = this.night ? '#2a3048' : '#8a94a8';
    this.box(s.f, s.x, s.y, s.w, s.h + 200, body);
    for (let x = 3; x < s.w - 3; x += 5) this.box(s.f, s.x + x, s.y + 8, 3, 4, this.night ? '#f2d878' : '#d8eefa');
    this.box(s.f, s.x + 2, s.y + 1, s.w - 4, 5, '#2f8f7f');
    if (this.zoom >= 2) {
      const p = this.toScreen(s.f, s.x + s.w / 2, s.y + 1.5);
      drawText(this.g, CLIENTS[10].short.toUpperCase(), Math.round(p.x), Math.round(p.y), { align: 'center', color: '#ffffff' });
    }
  }

  /** The office block across the street: a wall of windows, someone waving from one of them. */
  drawNear() {
    const f = 1;
    const wall = this.night ? '#1a1e30' : '#56607a';
    this.box(f, 560, 175, 520, 300, wall);
    this.box(f, 560, 175, 520, 3, this.night ? '#2a3048' : '#6a7490');
    for (let y = 185; y < 290; y += 22)
      for (let x = 572; x < 1070; x += 24) {
        const lit = this.night ? (x * 7 + y) % 5 !== 0 : false;
        this.box(f, x, y, 16, 14, '#1a1a22');
        this.box(f, x + 1, y + 1, 14, 12, this.night ? (lit ? '#e8d890' : '#20284a') : '#8ec5f0');
      }
    // The waver: a figure in the window, one arm going.
    const s = SIGHTS.waver;
    this.box(f, s.x - 1, s.y, 14, 12, this.night ? '#f2e8b0' : '#cfe6f6'); // that window's glass, lit
    this.box(f, s.x + 3, s.y + 1, 4, 4, '#e0b48a');
    this.box(f, s.x + 2, s.y + 5, 6, 7, '#b63b5a');
    const up = Math.floor(this.t * 4) % 2;
    this.box(f, s.x + (up ? 8 : 7), s.y + (up ? 0 : 3), 2, up ? 5 : 3, '#e0b48a');
  }

  /** Two overlapping circles of view, black round them; a small crosshair in the middle. */
  drawMask(g) {
    if (!this.mask) {
      const [c, m] = makeCanvas(W, H);
      m.fillStyle = '#05060a';
      m.fillRect(0, 0, W, H);
      m.globalCompositeOperation = 'destination-out';
      m.beginPath?.();
      for (const x of [W / 2 - 62, W / 2 + 62]) {
        m.moveTo?.(x + 118, H / 2);
        m.arc?.(x, H / 2, 118, 0, Math.PI * 2);
      }
      m.fill?.();
      this.mask = c;
    }
    g.drawImage(this.mask, 0, 0);
    const cy = H / 2 + 10;
    rect(g, W / 2 - 6, cy, 4, 1, 'rgba(255,255,255,0.5)');
    rect(g, W / 2 + 3, cy, 4, 1, 'rgba(255,255,255,0.5)');
    rect(g, W / 2, cy - 6, 1, 4, 'rgba(255,255,255,0.5)');
    rect(g, W / 2, cy + 3, 1, 4, 'rgba(255,255,255,0.5)');
    if (this.flash?.t > 0) {
      const r = this.sightRect(this.flash.id);
      const c = Math.floor(this.flash.t * 8) % 2 ? C.gold : '#fff6c8';
      rect(g, r.x - 3, r.y - 3, r.w + 6, 1, c);
      rect(g, r.x - 3, r.y + r.h + 2, r.w + 6, 1, c);
      rect(g, r.x - 3, r.y - 3, 1, r.h + 6, c);
      rect(g, r.x + r.w + 2, r.y - 3, 1, r.h + 6, c);
    }
    // The shutter at the end of the coin's time.
    if (this.shutter > 0) {
      const k = Math.min(1, this.shutter);
      rect(g, 0, 0, W, Math.round((H / 2) * k), '#05060a');
      rect(g, 0, H - Math.round((H / 2) * k), W, Math.round((H / 2) * k), '#05060a');
    }
  }

  drawHud(g) {
    const s = this.game.state;
    const found = RF.EGGS.filter((e) => s.roof?.spotted?.[e]).length;
    rect(g, 0, 0, W, 14, 'rgba(5,6,10,0.9)');
    drawText(g, 'PAY TELESCOPE', 6, 3, { color: '#9fd3f0' });
    drawText(g, `Spotted ${found}/${RF.EGGS.length}`, W / 2, 3, { align: 'center', color: found === RF.EGGS.length ? C.gold : C.text });
    drawText(g, `${Math.max(0, Math.ceil(this.left))} s`, W - 6, 3, { align: 'right', color: this.left < 10 ? C.bad : C.text });
    rect(g, 0, 13, Math.round(W * Math.max(0, this.left / RF.ROOF.telescopeS)), 1, '#9fd3f0');
    drawText(g, this.note?.text || TELESCOPE_HELP, W / 2, H - 12, { align: 'center', color: this.note ? C.gold : C.dim });
    drawText(g, `x${this.zoom.toFixed(1)}`, W - 6, H - 24, { align: 'right', color: C.dim });
  }

  exit() {}
}
