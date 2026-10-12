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
const PAGE = 8;

export class DeskOverlay extends Modal {
  /** view: the floor's FloorView (for its furniture palette). */
  constructor(game, floor, view) {
    super(game, { w: 360, h: 216, title: `Your desk · floor ${floor}` });
    this.floor = floor;
    this.kit = view.kit;
    this.desk = bakeFurniture('mydesk', 2, 1, this.kit);
    [this.preview, this.pg] = makeCanvas(48, 44);
    this.tab = 'shop'; // 'shop' = this floor's offer, 'mine' = your collection (it moves with you)
    this.page = 0;
  }
  get rows() {
    const s = this.game.state;
    if (this.tab === 'shop') return K.deskOffer(this.floor);
    const owned = K.myDesk(s).owned.map(K.decorItem).filter(Boolean);
    return owned.slice(this.page * PAGE, this.page * PAGE + PAGE);
  }
  build() {
    const s = this.game.state;
    const f = this.floor;
    const desk = K.myDesk(s);
    const b = this.buttons;
    const keep = b.focus;
    b.clear();
    const tx = this.x + 132;
    const tab = (id, label, x, w) =>
      b.add({ x, y: this.y + 17, w, h: 15, label, color: this.tab === id ? C.accent : C.panelLight, onClick: () => this.setTab(id) });
    tab('shop', `Floor ${f} shop`, tx, 104);
    tab('mine', `Collection ${desk.owned.length}`, tx + 108, 110);
    this.rows.forEach((d, i) => {
      const owned = desk.owned.includes(d.id);
      const shown = desk.show[d.slot] === d.id;
      const cost = E.decorCost(d, f);
      const btn = { x: this.x + this.w - 82, y: this.y + 36 + i * ROW, w: 72, h: 15 };
      if (owned) b.add({ ...btn, label: shown ? 'On show' : 'Show', color: shown ? C.goodBtn : C.panelLight, onClick: () => this.toggle(d) });
      else if (!K.decorUnlocked(s, d)) b.add({ ...btn, label: 'Quota first', disabled: true });
      else b.add({ ...btn, label: formatNum(cost), icon: 'sp', color: C.accent, disabled: s.sp < cost, onClick: () => this.buy(d) });
    });
    b.add({ x: this.x + 34, y: this.y + this.h - 24, w: 70, h: 18, label: 'Close', color: C.panelLight, onClick: () => this.close() });
    const pages = Math.ceil(desk.owned.length / PAGE);
    if (this.tab === 'mine' && pages > 1) {
      const py = this.y + this.h - 24;
      b.add({ x: tx, y: py, w: 20, h: 15, label: '<', color: C.panelLight, disabled: this.page === 0, onClick: () => this.page-- });
      b.add({ x: this.x + this.w - 30, y: py, w: 20, h: 15, label: '>', color: C.panelLight, disabled: this.page >= pages - 1, onClick: () => this.page++ });
    }
    b.focus = Math.min(keep, b.items.length - 1);
  }
  setTab(id) {
    if (this.tab === id) return;
    this.tab = id;
    this.page = 0;
    this.game.sfx('click');
  }
  buy(d) {
    const r = K.buyDecor(this.game.state, this.floor, d.id);
    if (!r.ok) return this.game.sfx('bad');
    track('desk_decor', { item: d.needs ? 'trophy' : d.id, floor: this.game.state.maxFloor });
    this.game.sfx('cash');
    this.game.toast(`${d.name} is on your desk!`, C.gold);
    this.game.markDirty();
  }
  toggle(d) {
    const r = K.toggleDecor(this.game.state, d.id);
    if (!r.ok) return;
    this.game.sfx('click');
    this.game.markDirty();
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const f = this.floor;
    const desk = K.myDesk(s);
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
    drawText(g, 'Your things move with you.', x + 68, y + 142, { align: 'center', color: C.dim });
    // The list: this floor's shop or your collection.
    const rows = this.rows;
    rows.forEach((d, i) => {
      const owned = desk.owned.includes(d.id);
      drawText(g, d.name, x + 132, y + 25 + i * ROW, { color: owned || this.tab === 'mine' ? C.text : d.needs ? C.gold : C.dim });
    });
    if (this.tab === 'mine' && !rows.length) drawText(g, 'Nothing yet: try the shop.', x + 132, y + 25, { color: C.dim });
  }
}
