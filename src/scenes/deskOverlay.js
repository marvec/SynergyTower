// Your desk: a close-up of the decorated desk and the decoration catalogue (rules in src/core/desk.js).
import { C, rect, frame, formatNum } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { makeCanvas } from '../engine/screen.js';
import { bakeFurniture, drawDeskDecor } from '../engine/art.js';
import { track } from '../engine/analytics.js';
import * as E from '../core/economy.js';
import * as K from '../core/desk.js';
import { titleForFloor } from '../data/departments.js';
import { Modal } from './overlays.js';

const ROW = 17;

export class DeskOverlay extends Modal {
  /** view: the floor's FloorView (for its furniture palette). */
  constructor(game, floor, view) {
    super(game, { w: 360, h: 216, title: `Your desk · floor ${floor}` });
    this.floor = floor;
    this.kit = view.kit;
    this.desk = bakeFurniture('mydesk', 2, 1, this.kit);
    [this.preview, this.pg] = makeCanvas(48, 44);
  }
  build() {
    const s = this.game.state;
    const f = this.floor;
    const desk = K.deskOf(s, f);
    const b = this.buttons;
    const keep = b.focus;
    b.clear();
    E.DESK_DECOR.forEach((d, i) => {
      const owned = desk.owned.includes(d.id);
      const shown = desk.show[d.slot] === d.id;
      const cost = E.decorCost(d, f);
      const unlocked = K.decorUnlocked(s, f, d);
      const btn = { x: this.x + this.w - 82, y: this.y + 20 + i * ROW, w: 72, h: 15 };
      if (owned) b.add({ ...btn, label: shown ? 'On show' : 'Show', color: shown ? C.goodBtn : C.panelLight, onClick: () => this.toggle(d) });
      else if (!unlocked) b.add({ ...btn, label: 'Quota first', disabled: true });
      else b.add({ ...btn, label: formatNum(cost), icon: 'sp', color: C.accent, disabled: s.sp < cost, onClick: () => this.buy(d) });
    });
    b.add({ x: this.x + 34, y: this.y + this.h - 24, w: 70, h: 18, label: 'Close', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(keep, b.items.length - 1);
  }
  buy(d) {
    const r = K.buyDecor(this.game.state, this.floor, d.id);
    if (!r.ok) return this.game.sfx('bad');
    track('desk_decor', { item: d.id, floor: this.game.state.maxFloor });
    this.game.sfx('cash');
    this.game.toast(`${d.name} is on your desk!`, C.gold);
    this.game.markDirty();
  }
  toggle(d) {
    const r = K.toggleDecor(this.game.state, this.floor, d.id);
    if (!r.ok) return;
    this.game.sfx('click');
    this.game.markDirty();
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const f = this.floor;
    const desk = K.deskOf(s, f);
    // Close-up: the desk baked at 1x, decorated, then scaled up 2x.
    const pg = this.pg;
    pg.clearRect(0, 0, 48, 44);
    pg.drawImage(this.desk.canvas, 8, 44 - this.desk.canvas.height - 6);
    const dy = 44 - 22;
    for (const id of Object.values(desk.show)) if (id) drawDeskDecor(pg, id, 8, dy, 2);
    rect(g, x + 10, y + 8, 116, 104, '#2b2e3c');
    frame(g, x + 10, y + 8, 116, 104, C.border);
    rect(g, x + 11, y + 82, 114, 29, '#3a3f55');
    g.imageSmoothingEnabled = false;
    g.drawImage(this.preview, x + 20, y + 20, 96, 88);
    drawText(g, s.player.name.slice(0, 22), x + 68, y + 118, { align: 'center', color: C.gold });
    drawText(g, titleForFloor(f), x + 68, y + 128, { align: 'center', color: C.dim });
    drawText(g, `${desk.owned.length}/${E.DESK_DECOR.length} collected`, x + 68, y + 142, { align: 'center', color: C.text });
    // Catalogue.
    E.DESK_DECOR.forEach((d, i) => {
      const yy = y + 9 + i * ROW;
      const owned = desk.owned.includes(d.id);
      drawText(g, d.name, x + 140, yy, { color: owned ? C.text : C.dim });
    });
  }
}
