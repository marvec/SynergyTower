// The badge wall: every achievement as a medal (src/core/achievements.js). Arrow keys or the mouse pick one.
import { C, rect, frame, icon, ButtonSet } from '../engine/ui.js';
import { drawText, drawWrapped } from '../engine/font.js';
import { BADGES } from '../core/achievements.js';
import { dayKey } from '../core/daily.js';
import { Modal } from './overlays.js';

// 43 badges: 9 columns make five rows (seven in the last), so the wall still fits the 270 px screen.
export const COLS = 9;
export const CW = 36;
const CH = 28;
const ROWS = Math.ceil(BADGES.length / COLS);
/** The wall's height: header, the grid, the description box and the Close button (must fit the 270 px screen). */
export const WALL_H = 84 + ROWS * CH + 34;
const RIBBONS = ['#e2504a', '#2a6ad1', '#2e8540', '#7a3bb6'];

export class BadgeWall extends Modal {
  constructor(game) {
    super(game, { w: 344, h: WALL_H, title: 'Badge wall' });
    this.buttons = new ButtonSet({ keyboard: false });
    this.sel = 0;
  }
  get gx() {
    return this.x + Math.round((this.w - COLS * CW) / 2);
  }
  get gy() {
    return this.y + 30;
  }
  build() {
    this.buttons.clear();
    this.buttons.add({ x: this.x + this.w / 2 - 40, y: this.y + this.h - 24, w: 80, h: 18, label: 'Close', onClick: () => this.close() });
  }
  update(dt) {
    const input = this.game.input;
    const n = BADGES.length;
    const move = (d) => {
      this.sel = (this.sel + d + n) % n;
      this.game.sfx('blip');
    };
    if (input.pressed('ArrowRight')) move(1);
    else if (input.pressed('ArrowLeft')) move(-1);
    else if (input.pressed('ArrowDown')) move(COLS);
    else if (input.pressed('ArrowUp')) move(-COLS);
    const p = input.pointer;
    const cx = Math.floor((p.x - this.gx) / CW);
    const cy = Math.floor((p.y - this.gy) / CH);
    if (p.inside && cx >= 0 && cx < COLS && cy >= 0 && cy * COLS + cx < n && p.x >= this.gx && p.y >= this.gy) {
      if (p.moved || p.clicked) this.sel = cy * COLS + cx;
      if (p.clicked) input.consumeClick();
    }
    super.update(dt);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const got = s.badges || {};
    const count = BADGES.filter((b) => got[b.id]).length;
    drawText(g, `${count}/${BADGES.length} badges`, x + this.w / 2, y + 3, { align: 'center', color: count === BADGES.length ? C.good : C.gold });
    BADGES.forEach((b, i) => {
      const cx = this.gx + (i % COLS) * CW + CW / 2;
      const cy = this.gy + Math.floor(i / COLS) * CH;
      const on = !!got[b.id];
      if (i === this.sel) frame(g, cx - CW / 2 + 1, cy, CW - 2, CH - 1, C.gold);
      drawMedal(g, cx, cy + 3, on ? b : null, i);
    });
    const b = BADGES[this.sel];
    const at = got[b.id];
    const ty = this.gy + ROWS * CH + 4;
    rect(g, x + 10, ty - 2, this.w - 20, 34, C.panelDark);
    drawText(g, at ? b.name : `${b.name} (locked)`, x + 16, ty + 1, { color: at ? C.gold : C.dim });
    if (at) drawText(g, dayKey(at), x + this.w - 16, ty + 1, { align: 'right', color: C.dim });
    drawWrapped(g, b.desc, x + 16, ty + 12, this.w - 32, { color: C.text });
  }
}

/** A medal on a ribbon, centred on cx; badge = null draws a locked grey one. */
function drawMedal(g, cx, y, badge, i) {
  const ribbon = badge ? RIBBONS[i % RIBBONS.length] : '#3b4262';
  rect(g, cx - 5, y, 4, 7, ribbon);
  rect(g, cx + 1, y, 4, 7, badge ? RIBBONS[(i + 1) % RIBBONS.length] : '#3b4262');
  const my = y + 6;
  const rim = badge ? '#f2c14e' : '#4a5068';
  const face = badge ? '#2a3150' : '#22242e';
  rect(g, cx - 5, my, 10, 13, C.border);
  rect(g, cx - 6, my + 1, 12, 11, C.border);
  rect(g, cx - 5, my + 1, 10, 11, rim);
  rect(g, cx - 4, my + 2, 8, 9, face);
  if (badge) icon(g, badge.icon, cx - 3.5, my + 3);
  else drawText(g, '?', cx + 1, my + 3, { align: 'center', color: '#5d6480' });
}
