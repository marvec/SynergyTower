// Character picker (title screen): every saved career as an employee ID badge in a horizontal row, last played
// first. Play one, delete one, start a new career (disabled while all MAX_SLOTS are taken) or go back.
import { W, H } from '../engine/screen.js';
import { C, ButtonSet, panel, rect, frame, dim, icon, inRect, formatNum } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { CORP_COLORS } from '../data/corpColors.js';
import { titleForFloor } from '../data/departments.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import { MAX_SLOTS } from '../core/slots.js';
import { characterSheet } from './floorWorld.js';
import { careerLook } from '../game.js';

const CW = 104;
const CH = 148;
const GAP = 8;
const SHOWN = 4;
const X0 = Math.round((W - (SHOWN * CW + (SHOWN - 1) * GAP)) / 2);
const Y0 = 32;
export const FULL_NOTE = 'Delete a character to create a new one';

/** Cuts a string to fit maxW pixels, with '..' when cut. */
function fit(str, maxW) {
  if (measureText(str) <= maxW) return str;
  let s = str;
  while (s.length > 1 && measureText(s + '..') > maxW) s = s.slice(0, -1);
  return s.trimEnd() + '..';
}

function ago(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export class CareerPicker {
  /** onPick(id): play that career; onNew(): start a new one (only offered while a slot is free). */
  constructor(game, { onPick, onNew }) {
    this.game = game;
    this.opaque = false;
    this.onPick = onPick;
    this.onNew = onNew;
    this.sel = 0;
    this.first = 0;
    this.confirmDelete = null;
    this.t = 0;
    this.buttons = new ButtonSet({ keyboard: false });
    this.refresh();
  }
  refresh() {
    this.careers = this.game.careers();
    this.full = !this.game.canCreateCareer();
    this.note = this.full ? FULL_NOTE : '';
    this.sel = Math.max(0, Math.min(this.sel, this.careers.length - 1));
    this.scrollTo(this.sel);
    this.build();
  }
  scrollTo(i) {
    if (i < this.first) this.first = i;
    if (i >= this.first + SHOWN) this.first = i - SHOWN + 1;
    this.first = Math.max(0, Math.min(this.first, this.careers.length - SHOWN));
  }
  select(i) {
    if (!this.careers.length) return;
    const n = Math.max(0, Math.min(this.careers.length - 1, i));
    if (n === this.sel) return;
    this.sel = n;
    this.confirmDelete = null;
    this.scrollTo(n);
    this.game.sfx('blip');
  }
  cardRect(i) {
    const k = i - this.first;
    return { x: X0 + k * (CW + GAP), y: Y0, w: CW, h: CH, visible: k >= 0 && k < SHOWN };
  }
  get current() {
    return this.careers[this.sel] || null;
  }
  play() {
    if (this.current) this.onPick(this.current.id);
  }
  remove() {
    const c = this.current;
    if (!c) return;
    if (this.confirmDelete !== c.id) {
      this.confirmDelete = c.id;
      return;
    }
    this.confirmDelete = null;
    this.game.deleteCareer(c.id);
    this.game.sfx('bad');
    this.refresh();
  }
  build() {
    const b = this.buttons;
    b.clear();
    const none = !this.careers.length;
    const row = [
      { id: 'play', w: 80, label: 'Play', color: C.goodBtn, disabled: none, onClick: () => this.play() },
      { id: 'delete', w: 104, label: this.confirmDelete ? 'Really delete?' : 'Delete', color: C.bad, disabled: none, onClick: () => this.remove() },
      { id: 'new', w: 104, label: 'New career', hotkey: 'n', disabled: this.full, onClick: () => this.onNew() },
      { id: 'back', w: 80, label: 'Back', color: C.panelLight, onClick: () => this.close() },
    ];
    let x = Math.round((W - row.reduce((a, r) => a + r.w, 0) - GAP * (row.length - 1)) / 2);
    for (const r of row) {
      b.add({ ...r, x, y: H - 34, h: 20 });
      x += r.w + GAP;
    }
  }
  close() {
    if (this.game.top === this) this.game.pop();
  }
  update(dt) {
    this.t += dt;
    const input = this.game.input;
    if (input.back()) {
      this.game.sfx('click');
      return this.close();
    }
    if (input.pressed('ArrowRight')) this.select(this.sel + 1);
    else if (input.pressed('ArrowLeft')) this.select(this.sel - 1);
    else if (input.pressedExact('Home')) this.select(0);
    else if (input.pressedExact('End')) this.select(this.careers.length - 1);
    const wheel = input.wheel();
    if (wheel) this.select(this.sel + wheel);
    if (input.pressedExact('Delete') || input.pressedExact('Backspace')) {
      this.game.sfx('click');
      this.remove();
    }
    this.build();
    if (this.buttons.update(input, (n) => this.game.sfx(n))) return;
    const p = input.pointer;
    if (p.clicked) {
      const i = this.careers.findIndex((_, k) => this.cardRect(k).visible && inRect(p, this.cardRect(k).x, this.cardRect(k).y, CW, CH));
      if (i >= 0) {
        input.consumeClick();
        if (i === this.sel) {
          this.game.sfx('click');
          return this.play();
        }
        this.select(i);
      } else if (this.careers.length > SHOWN && inRect(p, 0, Y0, X0, CH)) this.select(this.sel - SHOWN);
      else if (this.careers.length > SHOWN && inRect(p, W - X0, Y0, X0, CH)) this.select(this.sel + SHOWN);
    }
    if (input.confirm() && this.current) {
      this.game.sfx('click');
      this.play();
    }
  }
  render(g) {
    dim(g, 0.75);
    panel(g, 4, 4, W - 8, H - 8, { title: 'Choose your career' });
    if (!this.careers.length) {
      drawText(g, 'No careers saved in this browser yet.', W / 2, Y0 + 60, { align: 'center', color: C.dim });
    }
    for (let i = this.first; i < Math.min(this.careers.length, this.first + SHOWN); i++) this.drawCard(g, this.careers[i], this.cardRect(i), i === this.sel);
    // More cards either side.
    const blink = Math.floor(this.t * 2) % 2 ? C.gold : C.text;
    if (this.first > 0) drawText(g, '<', X0 - 9, Y0 + CH / 2 - 4, { color: blink });
    if (this.first + SHOWN < this.careers.length) drawText(g, '>', W - X0 + 4, Y0 + CH / 2 - 4, { color: blink });
    const y = Y0 + CH + 10;
    const count = `${this.careers.length} of ${MAX_SLOTS} careers`;
    drawText(g, this.careers.length ? `${count} · ${this.sel + 1}/${this.careers.length}` : count, X0, y, { color: C.dim });
    drawText(g, '<- -> pick · Enter play · Del delete · N new · Esc back', W - X0, y, { color: C.dim, align: 'right' });
    if (this.note) drawText(g, this.note, W / 2, H - 48, { align: 'center', color: C.warn });
    else if (this.confirmDelete && this.current)
      drawText(g, `${this.current.name}'s career will be gone for good.`, W / 2, H - 48, { align: 'center', color: C.bad });
    this.buttons.render(g);
  }
  /** One career as an employee ID badge (the same card the new-career screen shows). */
  drawCard(g, c, r, selected) {
    const col = CORP_COLORS.find((k) => k.id === c.colorId) || CORP_COLORS[0];
    const y = r.y - (selected ? 3 : 0);
    const cx = r.x + CW / 2;
    if (selected) frame(g, r.x - 2, y - 2, CW + 4, CH + 4, C.gold);
    panel(g, r.x, y, CW, CH, { fill: '#f4f1e8', light: '#ffffff', dark: '#c8c0aa' });
    rect(g, r.x + 1, y + 1, CW - 2, 16, col.color);
    rect(g, r.x + 1, y + 16, CW - 2, 1, col.dark);
    drawText(g, fit(c.corp.toUpperCase(), CW - 8), cx, y + 5, { align: 'center', color: '#ffffff', shadow: col.dark });
    // Photo.
    rect(g, cx - 18, y + 22, 36, 50, col.light);
    rect(g, cx - 17, y + 23, 34, 48, '#dfe8f0');
    const sheet = characterSheet(careerLook(c));
    const f = selected ? Math.floor(this.t * 4) % 3 : 0;
    g.drawImage(sheet, f * CHAR_W, 0, CHAR_W, CHAR_H, cx - CHAR_W, y + 25, CHAR_W * 2, CHAR_H * 2);
    drawText(g, fit(c.name, CW - 8), cx, y + 76, { align: 'center', color: C.ink });
    drawText(g, fit(titleForFloor(c.maxFloor), CW - 8), cx, y + 86, { align: 'center', color: '#6a6050' });
    drawText(g, `Floor ${c.maxFloor} · Level ${c.level}`, cx, y + 96, { align: 'center', color: '#6a6050' });
    // Stars, paperclips, badges.
    const stats = [['star', String(c.stars)], ['sp', formatNum(c.sp)], ['medal', String(c.badges)]];
    const ws = stats.map(([, v]) => 10 + measureText(v));
    let x = Math.round(cx - (ws.reduce((a, w) => a + w, 0) + 6 * (stats.length - 1)) / 2);
    stats.forEach(([ic, v], i) => {
      icon(g, ic, x, y + 108);
      drawText(g, v, x + 10, y + 108, { color: C.ink });
      x += ws[i] + 6;
    });
    for (let i = 0; i < 16; i++) rect(g, r.x + 12 + i * 5, y + 120, ((i * 7 + c.maxFloor) % 3) + 1, 9, C.ink);
    drawText(g, ago(this.game.now() - c.lastPlayed), cx, y + 134, { align: 'center', color: '#8a8070' });
  }
}
