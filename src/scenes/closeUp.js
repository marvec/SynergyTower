// Close-ups of office curiosities (spec 2026-10-12-office-curiosities): the fridge, a plant, the HR filing cabinet.
// Pure flavour: nothing here touches the economy or the save. Content comes from core/curios.js.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, stars, inRect } from '../engine/ui.js';
import { drawText, drawWrapped, measureText, wrapText } from '../engine/font.js';
import * as Q from '../core/curios.js';
import { PLANT_LOOKS, PLASTIC_LINE } from '../data/curios.js';

/** Gold corner brackets around a rect (the selection inside a close-up). */
function brackets(g, x, y, w, h, t) {
  const c = Math.floor(t * 4) % 2 ? C.gold : '#fff6c8';
  const x1 = x + w;
  const y1 = y + h;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x1, y, -1, 1], [x, y1, 1, -1], [x1, y1, -1, -1]]) {
    rect(g, sx > 0 ? cx : cx - 3, cy, 4, 1, c);
    rect(g, cx, sy > 0 ? cy : cy - 3, 1, 4, c);
  }
}

/**
 * Base: a big panel with hotspots. Arrows/Tab move between spots, Space/Enter/click pokes one, Esc or a click outside
 * closes. Subclasses implement spots() (screen rects, may change per frame), poke(i), renderBody(g).
 */
class CloseUp {
  constructor(game, { title, w = 440, h = 240, onClose = null }) {
    this.game = game;
    this.opaque = false;
    this.title = title;
    this.w = w;
    this.h = h;
    this.onClose = onClose;
    this.t = 0;
    this.sel = 0;
    this.hint = 'Arrows: look around   Space: poke   Esc: close';
  }
  get x() {
    return Math.round((W - this.w) / 2);
  }
  get y() {
    return Math.round((H - this.h) / 2);
  }
  spots() {
    return [];
  }
  poke() {}
  back() {
    this.close();
  }
  close() {
    if (this.game.top !== this) return;
    this.game.pop();
    this.onClose?.();
  }
  update(dt) {
    this.t += dt;
    const input = this.game.input;
    if (input.back()) {
      this.game.sfx('click');
      return this.back();
    }
    const spots = this.spots();
    const n = spots.length;
    if (this.sel >= n) this.sel = Math.max(0, n - 1);
    const p = input.pointer;
    const hover = spots.findIndex((s) => inRect(p, s.x, s.y, s.w, s.h));
    if (hover >= 0 && p.moved) this.sel = hover;
    if (p.clicked) {
      input.consumeClick();
      if (hover >= 0) {
        this.sel = hover;
        return this.poke(hover);
      }
      if (!inRect(p, this.x, this.y, this.w, this.h)) return this.close();
      return;
    }
    if (n) {
      const step = (d) => {
        this.sel = (this.sel + d + n) % n;
        this.game.sfx('blip');
      };
      if (input.pressed('ArrowRight') || input.pressed('ArrowDown') || input.pressedExact('Tab')) step(1);
      else if (input.pressed('ArrowLeft') || input.pressed('ArrowUp')) step(-1);
    }
    if (input.confirm() && n) {
      input.consumeKeys();
      this.poke(this.sel);
    }
  }
  render(g) {
    dim(g, 0.6);
    panel(g, this.x, this.y, this.w, this.h, { title: this.title });
    this.renderBody(g);
    drawText(g, this.hint, this.x + this.w / 2, this.y + this.h - 11, { align: 'center', color: C.dim });
  }
  renderBody() {}
}

// ---------------------------------------------------------------- fridge
const SHAPES = {
  box: [40, 20],
  jar: [22, 27],
  bottle: [13, 38],
  carton: [22, 34],
  cake: [40, 19],
  bag: [30, 17],
};

export class FridgeCloseUp extends CloseUp {
  constructor(game, { seed, onClose }) {
    super(game, { title: 'Office fridge', onClose });
    this.f = Q.fridgeContents(seed);
    this.caption = null; // { label, detail } of the last poked item
    this.blink = 0; // the ancient container's "look at you" animation
    this.layout();
  }
  get fx() {
    return this.x + 12;
  }
  get fy() {
    return this.y + 20;
  }
  /** Item rects relative to the fridge interior, ancient one last on the bottom shelf. */
  layout() {
    const byShelf = [[], [], []];
    for (const it of this.f.items) byShelf[it.shelf].push(it);
    const innerW = 196;
    this.boxes = [];
    byShelf.forEach((row, s) => {
      const slot = innerW / row.length;
      row.forEach((it, i) => {
        const [w, h] = it.ancient ? [44, 24] : SHAPES[it.shape];
        const base = 12 + (s + 1) * 62 - 4;
        this.boxes.push({ it, x: 12 + Math.round(slot * i + (slot - w) / 2), y: base - h, w, h });
      });
    });
  }
  spots() {
    return this.boxes.map((b) => ({ x: this.fx + b.x, y: this.fy + b.y - (b.it.ancient ? 6 : 0), w: b.w, h: b.h + (b.it.ancient ? 6 : 0) }));
  }
  poke(i) {
    const it = this.boxes[i].it;
    this.caption = it;
    if (it.ancient) {
      this.blink = 1.6;
      this.game.sfx('bad');
    } else this.game.sfx('blip');
  }
  update(dt) {
    super.update(dt);
    this.blink = Math.max(0, this.blink - dt);
  }
  renderBody(g) {
    const x = this.fx;
    const y = this.fy;
    const w = 220;
    const h = 200;
    // Cabinet, cold white interior, the light in the corner.
    rect(g, x - 2, y - 2, w + 4, h + 4, '#151821');
    rect(g, x, y, w, h, '#c9d3d9');
    rect(g, x + 4, y + 4, w - 8, h - 8, '#e8f0f4');
    rect(g, x + 4, y + 4, w - 8, 10, '#f6fbfd');
    const flicker = Math.sin(this.t * 37) > 0.97 ? '#c9c08a' : '#fff2a8';
    rect(g, x + w - 26, y + 6, 14, 4, flicker);
    // Glass shelves.
    for (let s = 1; s <= 3; s++) {
      const sy = y + 12 + s * 62 - 4;
      rect(g, x + 4, sy, w - 8, 2, '#a8cfe0');
      rect(g, x + 4, sy + 2, w - 8, 1, '#8fb0c0');
    }
    // A forgotten ketchup sachet on the top shelf edge, because there always is one.
    rect(g, x + 8, y + 69, 6, 3, '#c94a3b');
    const sel = this.spots()[this.sel];
    this.boxes.forEach((b) => this.drawItem(g, x + b.x, y + b.y, b));
    if (sel) brackets(g, sel.x - 2, sel.y - 2, sel.w + 3, sel.h + 3, this.t);

    // Right column: the door notes, then whatever was poked.
    const cx = x + w + 14;
    const cw = this.x + this.w - 12 - cx;
    drawText(g, 'ON THE DOOR', cx, y, { color: C.gold });
    let ty = y + 12;
    this.f.door.forEach((note, i) => {
      rect(g, cx, ty + 1, 5, 5, ['#e2504a', '#5fd068', '#8ab4ff'][i]);
      ty += drawWrapped(g, note, cx + 9, ty, cw - 9, { color: C.text }) + 4;
    });
    rect(g, cx, ty + 2, cw, 1, C.panelLight);
    ty += 8;
    const cap = this.caption || this.boxes[this.sel]?.it;
    if (cap) {
      const lw = Math.min(cw, measureText(cap.label) + 8);
      rect(g, cx, ty, lw, 12, cap.labelColor);
      drawText(g, cap.label, cx + 4, ty + 2, { color: C.ink });
      ty += 16;
      if (this.caption === cap) drawWrapped(g, cap.detail, cx, ty, cw, { color: C.text });
      else drawText(g, 'Space: take a closer look', cx, ty, { color: C.dim });
    }
  }
  drawItem(g, x, y, b) {
    const it = b.it;
    const { w, h } = b;
    if (it.ancient) return this.drawAncient(g, x, y, w, h);
    const dark = '#00000040';
    switch (it.shape) {
      case 'jar':
        rect(g, x, y + 3, w, h - 3, it.color);
        rect(g, x - 1, y, w + 2, 4, '#7a7a7a');
        rect(g, x + 2, y + 5, 2, h - 8, '#ffffff55');
        break;
      case 'bottle':
        rect(g, x + 4, y, 5, 8, it.color);
        rect(g, x + 4, y - 2, 5, 2, '#ddd');
        rect(g, x, y + 8, w, h - 8, it.color);
        rect(g, x + 1, y + 8, 2, h - 10, '#ffffff55');
        break;
      case 'carton':
        rect(g, x + 2, y, w - 4, 3, '#dcdcdc');
        rect(g, x, y + 3, w, h - 3, it.color);
        rect(g, x, y + 3, w, 2, '#3b7bc9');
        break;
      case 'cake':
        rect(g, x - 2, y + h - 2, w + 4, 2, '#d0d0d0');
        rect(g, x, y + 3, w, h - 5, it.color);
        rect(g, x, y + 3, w, 3, '#fff');
        rect(g, x + w / 2 - 1, y - 3, 2, 6, '#8ab4ff');
        rect(g, x + w / 2 - 1, y - 5, 2, 2, Math.floor(this.t * 6) % 2 ? '#f2c14e' : '#f29c38');
        break;
      case 'bag':
        rect(g, x, y + 2, w, h - 2, it.color);
        for (let i = 0; i < 4; i++) rect(g, x + 2 + i * 5, y, 3, 3, '#e06a5a');
        break;
      default:
        rect(g, x, y, w, h, it.color);
        rect(g, x, y, w, 3, '#ffffff66');
        rect(g, x, y + 3, w, 1, dark);
    }
    // The name sticker.
    const lw = Math.min(w - 2, 26);
    const lx = x + Math.round((w - lw) / 2);
    const ly = y + Math.round(h / 2) - 1;
    rect(g, lx, ly, lw, 7, it.labelColor);
    rect(g, lx + 2, ly + 2, lw - 6, 1, '#55555588');
    rect(g, lx + 2, ly + 4, lw - 9, 1, '#55555588');
  }
  /** The container at the back: fuzzy, wobbling, lifting its lid to have a look around. */
  drawAncient(g, x, y, w, h) {
    const cyc = this.t % 3.2;
    const wob = this.blink > 0 || cyc < 0.45 ? Math.round(Math.sin(this.t * 40)) : 0;
    const peek = this.blink > 0 ? 6 : cyc > 1.4 && cyc < 2.4 ? 5 : 0;
    x += wob;
    // Stink lines.
    for (let i = 0; i < 3; i++) {
      const sx = x + 6 + i * 10;
      for (let k = 0; k < 4; k++) {
        const yy = y - 6 - k * 4 - ((this.t * 8) % 4);
        rect(g, sx + Math.round(Math.sin(this.t * 3 + k + i) * 2), Math.round(yy), 1, 2, '#9bbf5a');
      }
    }
    rect(g, x, y + 3, w, h - 3, '#6f8a3a');
    for (let i = 0; i < 9; i++) rect(g, x + ((i * 7) % (w - 2)) + 1, y + 4 + ((i * 5) % (h - 6)), 2, 2, '#9bbf5a');
    // Eyes in the gap under the lid.
    if (peek) {
      rect(g, x + 1, y + 3 - peek, w - 2, peek, '#1a1f10');
      const blinkNow = this.blink > 0 ? Math.floor(this.blink * 5) % 3 === 0 : Math.floor(this.t * 3) % 5 === 0;
      const ey = y + 3 - peek;
      for (const ex of [x + 13, x + 25]) {
        if (blinkNow) rect(g, ex, ey + Math.floor(peek / 2), 6, 1, '#e8e8c8');
        else {
          rect(g, ex, ey, 6, peek, '#e8e8c8');
          rect(g, ex + 2 + wob, ey + 1, 2, Math.max(1, peek - 2), '#1a1f10');
        }
      }
    }
    rect(g, x - 1, y - peek, w + 2, 3, '#55702a'); // the lid
    rect(g, x + 9, y + 11, 26, 7, '#d8d0a8');
    rect(g, x + 11, y + 13, 20, 1, '#8a8060');
    rect(g, x + 11, y + 15, 9, 1, '#8a8060');
  }
}

// ---------------------------------------------------------------- plant
export class PlantCloseUp extends CloseUp {
  constructor(game, { seed, onClose }) {
    super(game, { title: 'Office plant', onClose });
    this.seed = seed;
    this.p = Q.plantInfo(seed);
    this.caption = null;
    this.wave = 0;
    this.wormT = 0.8; // the worm's own clock: up for a while, then down
    const r = (k) => ((seed * 9301 + k * 49297) % 233280) / 233280;
    this.leaves = Array.from({ length: this.p.leaves }, (_, i) => ({ a: -1.2 + (2.4 * i) / (this.p.leaves - 1) + (r(i) - 0.5) * 0.3, len: 50 + r(i + 9) * 50 }));
  }
  get cx() {
    return this.x + 12 + 110;
  }
  get soilY() {
    return this.y + 20 + 128;
  }
  spots() {
    const s = [
      { x: this.cx - 70, y: this.y + 22, w: 140, h: 100, what: 'leaves' },
      { x: this.cx - 52, y: this.soilY - 34, w: 24, h: 30, what: 'tag' },
    ];
    if (this.p.worm) s.push({ x: this.cx + 12, y: this.soilY - 20, w: 16, h: 22, what: 'worm' });
    if (this.p.find) s.push({ x: this.cx - 14, y: this.soilY - 4, w: 14, h: 10, what: 'find' });
    return s;
  }
  poke(i) {
    const what = this.spots()[i].what;
    this.game.sfx('blip');
    if (what === 'leaves') this.caption = this.p.plastic ? PLASTIC_LINE : PLANT_LOOKS[this.seed % PLANT_LOOKS.length];
    else if (what === 'tag') this.caption = 'The tag is laminated. Someone cares about this plant very much. Possibly too much.';
    else if (what === 'worm') {
      this.caption = this.p.wormLine;
      this.wave = 2.5;
      this.wormT = 0.8;
    } else this.caption = `Half buried in the soil: ${this.p.find} You leave it there. It lives here now.`;
  }
  update(dt) {
    super.update(dt);
    this.wave = Math.max(0, this.wave - dt);
    this.wormT = (this.wormT + dt) % 6;
  }
  /** How far the worm is out of the soil, 0..1. */
  wormUp() {
    if (this.wave > 0) return 1;
    const t = this.wormT;
    if (t < 0.6) return t / 0.6;
    if (t < 3) return 1;
    if (t < 3.6) return 1 - (t - 3) / 0.6;
    return 0;
  }
  renderBody(g) {
    const x0 = this.x + 12;
    const y0 = this.y + 20;
    const { cx, soilY } = this;
    // Wall, skirting, floor.
    rect(g, x0, y0, 220, 200, '#c9c2b0');
    rect(g, x0, y0 + 150, 220, 4, '#8a8270');
    rect(g, x0, y0 + 154, 220, 46, '#7a6a55');
    // Leaves on stems (plastic ones are suspiciously shiny): a stem to the tip, then a leaf tapering along it.
    for (const [i, l] of this.leaves.entries()) {
      const a = l.a + Math.sin(this.t * 1.3 + i) * 0.03;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      const sx = cx + dx * 4;
      const len = l.len * 0.75;
      for (let k = 0; k < len; k += 1.5) rect(g, Math.round(sx + dx * k), Math.round(soilY - 2 + dy * k), 2, 2, '#3f7a2a');
      const tx = sx + dx * len;
      const ty = soilY - 2 + dy * len;
      const lc = i % 2 ? '#4caf50' : '#3f9a44';
      const dark = i % 2 ? '#3b8f40' : '#2f7a34';
      for (let j = 0; j <= 16; j++) {
        const hw = Math.round(Math.sin((Math.PI * j) / 16) * 6);
        const px = Math.round(tx + dx * j * 1.6);
        const py = Math.round(ty + dy * j * 1.6);
        rect(g, px - hw, py - hw, hw * 2 + 1, hw * 2 + 1, j % 4 === 0 ? dark : lc);
      }
      for (let j = 1; j < 16; j++) rect(g, Math.round(tx + dx * j * 1.6), Math.round(ty + dy * j * 1.6), 1, 1, '#2a6020');
      if (this.p.plastic) rect(g, Math.round(tx + dx * 8) - 3, Math.round(ty + dy * 8) - 3, 3, 2, '#e8ffe8');
    }
    if (this.p.plastic) {
      rect(g, cx + 30, soilY - 70, 14, 7, '#f2f2f2');
      drawText(g, '4.99', cx + 31, soilY - 70, { color: C.bad });
    }
    // Pot: terracotta, a rim, a chip out of it.
    const pw = 84;
    for (let r = 0; r < 46; r++) {
      const ww = Math.round(pw - r * 0.5);
      rect(g, cx - ww / 2, soilY + r, ww, 1, r < 7 ? '#c8643a' : '#b4552f');
    }
    rect(g, cx - pw / 2 - 2, soilY - 2, pw + 4, 7, '#d0703f');
    rect(g, cx - pw / 2 - 2, soilY - 2, pw + 4, 1, '#e8905a');
    rect(g, cx + 24, soilY - 2, 5, 3, '#8a3a1f');
    rect(g, cx - pw / 2 + 2, soilY - 1, pw - 4, 4, '#3a2618');
    for (let i = 0; i < 12; i++) rect(g, cx - pw / 2 + 4 + ((i * 13) % (pw - 8)), soilY + (i % 2), 2, 1, '#5a3a24');
    // Care tag on a stick.
    rect(g, cx - 41, soilY - 18, 2, 18, '#a88a5a');
    rect(g, cx - 52, soilY - 32, 24, 15, '#f4f1e8');
    rect(g, cx - 49, soilY - 28, 18, 1, '#6a6a7a');
    rect(g, cx - 49, soilY - 24, 13, 1, '#6a6a7a');
    // The lost object, glinting.
    if (this.p.find) {
      rect(g, cx - 12, soilY + 1, 9, 3, '#7a7a8a');
      if (Math.floor(this.t * 2) % 3 === 0) rect(g, cx - 9, soilY, 2, 2, '#fffbe0');
    }
    // The worm.
    if (this.p.worm) {
      const up = this.wormUp();
      const segs = Math.round(up * 6);
      for (let k = 0; k < segs; k++) {
        const wx = cx + 18 + Math.round(Math.sin(this.t * 5 - k * 0.9) * (this.wave > 0 ? 3 : 1.5));
        rect(g, wx, soilY - 4 - k * 3, 5, 5, k === segs - 1 ? '#f0a0a8' : k % 2 ? '#e08890' : '#d87a84');
      }
      if (segs >= 4) {
        const hx = cx + 18 + Math.round(Math.sin(this.t * 5 - (segs - 1) * 0.9) * (this.wave > 0 ? 3 : 1.5));
        const hy = soilY - 4 - (segs - 1) * 3;
        rect(g, hx + 1, hy + 1, 1, 1, C.ink);
        rect(g, hx + 3, hy + 1, 1, 1, C.ink);
        if (this.wave > 0) rect(g, hx + 1, hy + 3, 3, 1, C.ink); // a little smile
        rect(g, cx + 14, soilY - 1, 12, 2, '#3a2618'); // the hole
      }
    }
    const sel = this.spots()[this.sel];
    if (sel) brackets(g, sel.x, sel.y, sel.w, sel.h, this.t);

    // Right column: name, tag, watering log, then the last poke.
    const cxR = x0 + 234;
    const cw = this.x + this.w - 12 - cxR;
    drawText(g, this.p.name, cxR, y0, { color: C.gold });
    let ty = y0 + 14;
    ty += drawWrapped(g, `Tag: "${this.p.tag}"`, cxR, ty, cw, { color: C.dim }) + 4;
    drawText(g, 'Watering log:', cxR, ty, { color: C.dim });
    ty += 11;
    for (const l of this.p.log) {
      drawText(g, `- ${l}`, cxR + 4, ty, { color: C.text });
      ty += 10;
    }
    rect(g, cxR, ty + 3, cw, 1, C.panelLight);
    ty += 9;
    if (this.caption) drawWrapped(g, this.caption, cxR, ty, cw, { color: C.text });
    else drawText(g, 'Look closer...', cxR, ty, { color: C.dim });
  }
}

// ---------------------------------------------------------------- HR filing cabinet
const ROW_H = 15;
const FOLDER_SMELLS = ['The folder smells faintly of coffee.', 'There is a sticky note on it: "ask about the goat".', 'The folder is suspiciously thick.', 'The folder is suspiciously thin.', 'Someone has doodled a rocket on the tab.', 'It has a coffee ring on the front. Two, actually.'];
const MAX_ROWS = 12;

/**
 * The HR filing cabinet: pick a drawer, then a folder, then read the personnel file (arrows/wheel scroll a long one).
 * people: [{ name, role, seed, years?, note?, fired?, file? }] (file = a prepared one, e.g. the player's own).
 */
export class FilesCloseUp extends CloseUp {
  constructor(game, { people, floor, onClose }) {
    super(game, { title: 'HR filing cabinet', w: 456, h: 252, onClose });
    this.floor = floor;
    this.drawers = Q.fileDrawers(people);
    this.mode = 'cabinet';
    this.drawer = 0;
    this.file = null;
    this.scroll = 0;
  }
  spots() {
    const x = this.x + 14;
    const y = this.y + 22;
    if (this.mode === 'cabinet') return this.drawers.map((_, i) => ({ x, y: y + i * 50, w: 150, h: 46 }));
    if (this.mode === 'drawer') {
      // A long drawer scrolls with the selection; rows outside the window get no area.
      const off = this.rowOffset();
      return this.drawers[this.drawer].files.map((_, i) => {
        const r = i - off;
        return r >= 0 && r < MAX_ROWS ? { x: x + 4, y: y + 14 + r * ROW_H, w: 250, h: ROW_H - 1 } : { x: 0, y: 0, w: 0, h: 0 };
      });
    }
    return [];
  }
  rowOffset() {
    const n = this.drawers[this.drawer].files.length;
    return Math.max(0, Math.min(n - MAX_ROWS, this.sel - MAX_ROWS + 2));
  }
  poke(i) {
    this.game.sfx('click');
    if (this.mode === 'cabinet') {
      this.drawer = i;
      this.mode = 'drawer';
      this.sel = 0;
      if (!this.drawers[i].files.length) this.game.sfx('bad');
    } else if (this.mode === 'drawer') {
      const p = this.drawers[this.drawer].files[i];
      this.file = Q.personnelFile(p, { floor: this.floor });
      this.mode = 'file';
      this.scroll = 0;
    }
  }
  back() {
    if (this.mode === 'file') {
      this.mode = 'drawer';
      this.sel = Math.max(0, this.drawers[this.drawer].files.findIndex((p) => p.name === this.file.name));
    } else if (this.mode === 'drawer') {
      this.mode = 'cabinet';
      this.sel = this.drawer;
    } else this.close();
  }
  update(dt) {
    const input = this.game.input;
    if (this.mode === 'file') {
      this.t += dt;
      if (input.back() || input.confirm() || (input.pointer.clicked && inRect(input.pointer, this.x, this.y, this.w, this.h))) {
        input.consumeClick();
        input.consumeKeys();
        this.game.sfx('click');
        return this.back();
      }
      if (input.pointer.clicked) {
        input.consumeClick();
        return this.close();
      }
      const d = (input.pressed('ArrowDown') ? 1 : 0) - (input.pressed('ArrowUp') ? 1 : 0) + Math.sign(input.wheel?.() || 0);
      this.scroll = Math.max(0, Math.min(this.maxScroll || 0, this.scroll + d * 20));
      return;
    }
    super.update(dt);
  }
  render(g) {
    this.hint = this.mode === 'file' ? 'Arrows: scroll   Space/Esc: put it back' : this.mode === 'drawer' ? 'Arrows: browse   Space: open folder   Esc: close drawer' : 'Arrows: pick a drawer   Space: open   Esc: close';
    super.render(g);
  }
  renderBody(g) {
    if (this.mode === 'cabinet') this.drawCabinet(g);
    else if (this.mode === 'drawer') this.drawDrawer(g);
    else this.drawFile(g);
  }
  drawCabinet(g) {
    const x = this.x + 14;
    const y = this.y + 22;
    rect(g, x - 4, y - 4, 158, 206, '#4a5060');
    this.drawers.forEach((d, i) => {
      const dy = y + i * 50;
      const open = i === this.sel ? 3 : 0;
      rect(g, x - open, dy, 150 + open * 2, 46, '#8a92a4');
      rect(g, x - open + 1, dy + 1, 148 + open * 2, 1, '#aab2c4');
      rect(g, x + 55, dy + 8, 40, 12, '#f4f1e8');
      drawText(g, d.label, x + 75, dy + 10, { align: 'center', color: C.ink });
      rect(g, x + 60, dy + 28, 30, 5, '#5a6070');
      rect(g, x + 62, dy + 29, 26, 2, '#c8ccd8');
      if (d.label === 'MISC') rect(g, x + 100, dy + 6, 30, 8, '#e8d36a');
    });
    const sel = this.spots()[this.sel];
    if (sel) brackets(g, sel.x - 4, sel.y - 1, sel.w + 7, sel.h + 1, this.t);
    const cx = x + 172;
    const cw = this.x + this.w - 12 - cx;
    drawText(g, `PERSONNEL FILES - FLOOR ${this.floor}`, cx, y, { color: C.gold });
    let ty = y + 14;
    ty += drawWrapped(g, 'Property of Human Resources. Strictly confidential. Do not open. (You opened it.)', cx, ty, cw, { color: C.text }) + 6;
    for (const d of this.drawers) {
      drawText(g, `${d.label}:`, cx, ty, { color: C.dim });
      drawText(g, d.files.length ? `${d.files.length} folder${d.files.length > 1 ? 's' : ''}` : 'empty (suspicious)', cx + 40, ty, { color: C.text });
      ty += 11;
    }
    ty += 6;
    drawWrapped(g, 'A sticky note on the side: "Key is under the plant." The key is in the lock.', cx, ty, cw, { color: C.dim });
  }
  drawDrawer(g) {
    const x = this.x + 14;
    const y = this.y + 22;
    const d = this.drawers[this.drawer];
    rect(g, x - 4, y - 4, 268, 206, '#5a6070');
    rect(g, x, y, 260, 198, '#3a3f4c');
    drawText(g, `Drawer ${d.label}`, x + 4, y + 2, { color: C.gold });
    if (!d.files.length) drawText(g, 'Empty. Just a single paperclip and a mint.', x + 8, y + 30, { color: C.dim });
    const off = this.rowOffset();
    if (off > 0) drawText(g, 'more above', x + 254, y + 2, { align: 'right', color: C.dim });
    if (d.files.length - off > MAX_ROWS) drawText(g, 'more below', x + 254, y + 196 - 8, { align: 'right', color: C.dim });
    d.files.slice(off, off + MAX_ROWS).forEach((p, r) => {
      const i = r + off;
      const fy = y + 14 + r * ROW_H;
      const tab = 8 + ((i * 37) % 120);
      rect(g, x + 4, fy + 3, 250, ROW_H - 3, i === this.sel ? '#e8cf98' : '#d9bd84');
      rect(g, x + 4 + tab, fy, 80, 5, i === this.sel ? '#e8cf98' : '#d9bd84');
      rect(g, x + 4, fy + 3, 250, 1, '#f0dcae');
      drawText(g, p.you ? `${p.name} (YOU)` : p.name, x + 10, fy + 4, { color: C.ink });
      drawText(g, p.role, x + 250, fy + 4, { align: 'right', color: '#6a5a3a' });
      if (p.fired) rect(g, x + 220 - measureText(p.role), fy + 6, 18, 3, C.bad);
    });
    const sel = this.spots()[this.sel];
    if (sel) brackets(g, sel.x - 1, sel.y, sel.w + 1, sel.h, this.t);
    const cx = x + 276;
    const cw = this.x + this.w - 12 - cx;
    const p = d.files[this.sel];
    if (p) {
      drawText(g, p.name, cx, y, { color: C.gold });
      drawWrapped(g, p.misc ? 'A file that is not quite about a person.' : p.you ? 'Your own file. HR keeps one on everyone. Especially you.' : p.fired ? 'Stamped LET GO. The plant went with them.' : `${p.role}${p.floor ? `, floor ${p.floor}` : ''}. ${FOLDER_SMELLS[(p.seed ?? 0) % FOLDER_SMELLS.length]}`, cx, y + 14, cw, { color: C.text });
    }
  }
  drawFile(g) {
    const f = this.file;
    const px = this.x + 10;
    const py = this.y + 18;
    const pw = this.w - 20;
    const ph = this.h - 34;
    rect(g, px + 3, py + 3, pw, ph, '#00000055');
    rect(g, px, py, pw, ph, '#f4ecd8');
    for (let ly = py + 30; ly < py + ph; ly += 10) rect(g, px + 4, ly + 8, pw - 8, 1, '#e4dac0');
    rect(g, px + 18, py, 1, ph, '#e8a8a8'); // the margin
    g.save();
    g.beginPath();
    g.rect(px, py, pw, ph);
    g.clip();
    const top = py + 6 - this.scroll;
    drawText(g, 'PERSONNEL FILE', px + 26, top, { color: C.accentDark });
    drawText(g, `No. ${f.no}`, px + pw - 40, top, { align: 'right', color: '#6a5a3a' });
    drawText(g, f.name, px + 26, top + 12, { scale: 2, color: C.ink });
    drawText(g, f.role, px + 26, top + 31, { color: '#6a5a3a' });
    if (f.stars) stars(g, f.stars, px + 30 + measureText(f.role), top + 31, 1, 5);
    let ty = top + 46;
    for (const l of f.lines) {
      const [k, ...rest] = l.split(': ');
      if (rest.length && k.length < 20) {
        drawText(g, `${k}:`, px + 26, ty, { color: C.accentDark });
        const kw = measureText(`${k}: `);
        const lines = wrapText(rest.join(': '), pw - 40 - kw);
        lines.forEach((ln, i) => drawText(g, ln, px + 26 + kw, ty + i * 10, { color: C.ink }));
        ty += lines.length * 10 + 2;
      } else ty += drawWrapped(g, l, px + 26, ty, pw - 40, { color: C.ink }) + 2;
    }
    this.maxScroll = Math.max(0, ty + this.scroll - (py + ph - 6));
    // Coffee ring, stamp and a doodle in the margin: the unnecessary details.
    g.strokeStyle = 'rgba(120,80,40,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px + pw - 60 - f.ring.x / 2, top + 40 + f.ring.y, 14, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.translate(px + pw - 80, top + 34);
    g.rotate(-0.18);
    const sw = measureText(f.stamp) * 2 + 10;
    g.globalAlpha = 0.75;
    rect(g, -sw / 2, -9, sw, 2, C.bad);
    rect(g, -sw / 2, 9, sw, 2, C.bad);
    drawText(g, f.stamp, 0, -6, { align: 'center', scale: 2, color: C.bad });
    g.globalAlpha = 1;
    g.restore();
    this.drawDoodle(g, f.doodle, px + 4, top + 60);
    g.restore();
    // A paperclip holding the photo that is not there any more.
    rect(g, px + pw - 30, py - 5, 6, 18, '#5a6070');
    rect(g, px + pw - 29, py - 4, 4, 16, '#c8ccd8');
    rect(g, px + pw - 28, py - 3, 2, 12, '#5a6070');
    rect(g, px + pw - 27, py - 2, 1, 10, '#c8ccd8');
    if (this.maxScroll > 0) {
      const frac = this.scroll / this.maxScroll;
      rect(g, px + pw - 4, py + 2 + Math.round(frac * (ph - 20)), 2, 16, '#a89878');
    }
  }
  /** A tiny blue-pen doodle in the margin. */
  drawDoodle(g, kind, x, y) {
    const c = '#3b5bb6';
    const px = (dx, dy) => rect(g, x + dx, y + dy, 1, 1, c);
    if (kind === 'cat') {
      for (const [dx, dy] of [[1, 0], [6, 0], [1, 1], [2, 1], [5, 1], [6, 1], [1, 2], [6, 2], [1, 3], [6, 3], [1, 4], [6, 4], [2, 5], [3, 5], [4, 5], [5, 5], [3, 3], [4, 3], [7, 4], [8, 3], [9, 2]]) px(dx, dy);
    } else if (kind === 'stapler') {
      rect(g, x + 1, y + 2, 9, 1, c);
      rect(g, x, y + 5, 11, 1, c);
      rect(g, x, y + 3, 1, 2, c);
      rect(g, x + 10, y + 3, 1, 2, c);
    } else if (kind === 'sun') {
      rect(g, x + 3, y + 3, 4, 4, c);
      for (const [dx, dy] of [[5, 0], [5, 9], [0, 5], [9, 5], [1, 1], [8, 1], [1, 8], [8, 8]]) px(dx, dy);
    } else {
      for (let i = 0; i < 9; i++) px(i, 8 - Math.round(i * 0.8 + (i % 2)));
      rect(g, x, y + 9, 10, 1, c);
      rect(g, x, y, 1, 9, c);
    }
  }
}
