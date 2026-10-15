// Heads-up display: currencies + progress (top bar) and action buttons (bottom right).
import { W, H } from '../engine/screen.js';
import { C, rect, icon, bar, formatNum, formatTime, ButtonSet, coffeeColor } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { titleForFloor } from '../data/departments.js';
import { StatsDialog } from './statsDialog.js';
import { features } from '../engine/platform.js';

export const HUD_H = 22;

export class Hud {
  constructor(game, actions) {
    this.game = game;
    this.actions = actions; // also used by the portrait dock (portraitDock.js)
    this.buttons = new ButtonSet({ keyboard: false });
    const defs = [
      { icon: 'cart', label: 'Shop', key: 'shop', hotkey: 'o' },
      { icon: 'up', label: 'Perks', key: 'perks', hotkey: 'p' },
      { icon: 'book', label: 'Train', key: 'train', hotkey: 't' },
      ...(features.tips ? [{ icon: 'coffee', label: 'Tip', key: 'coffee' }] : []),
      { icon: 'medal', label: '', key: 'badges', hotkey: 'b' },
      { icon: 'note', label: '', key: 'music' },
      { icon: 'menu', label: '', key: 'menu' },
    ];
    let x = W - 4;
    for (const d of defs.reverse()) {
      const w = d.label ? measureText(d.label) + 18 : 17;
      x -= w;
      this.buttons.add({ x, y: H - 19, w, h: 16, label: d.label, icon: d.icon, hotkey: d.hotkey, color: C.panelLight, onClick: () => actions[d.key]?.() });
      x -= 3;
    }
    this.pulse = 0;
    this.hits = []; // clickable stats from the last render: { x, y, w, h, key }
  }

  /** Returns true if the HUD consumed the input this frame. */
  update(dt, input) {
    this.pulse += dt;
    const music = this.buttons.items.find((b) => b.icon === 'note' || b.icon === 'mute');
    if (music) music.icon = this.game.state.settings.music ? 'note' : 'mute';
    if (this.buttons.update(input, (n) => this.game.sfx(n))) return true;
    // Clicking a stat explains it.
    const p = input.pointer;
    const hit = p.clicked && this.hitAt(p);
    if (hit) {
      input.consumeClick();
      this.game.sfx('click');
      this.game.push(new StatsDialog(this.game, hit.key));
      return true;
    }
    return false;
  }

  hitAt(p) {
    return this.hits.find((h) => p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h);
  }

  render(g) {
    const s = this.game.state;
    const now = this.game.now();
    const corp = this.game.corpColor();
    g.fillStyle = 'rgba(16,18,28,0.92)';
    g.fillRect(0, 0, W, HUD_H);
    rect(g, 0, HUD_H, W, 1, C.border);
    rect(g, 0, HUD_H - 1, W, 1, corp.color);

    // Left: corp + title.
    rect(g, 3, 3, 15, 15, C.border);
    rect(g, 4, 4, 13, 13, corp.color);
    rect(g, 7, 7, 7, 7, corp.light);
    rect(g, 9, 9, 3, 3, corp.dark);
    drawText(g, s.corp.name.slice(0, 18), 22, 3, { color: C.gold });
    drawText(g, `${this.floorLabel || `F${s.floor}`} · ${titleForFloor(s.maxFloor)}`, 22, 12, { color: C.dim }); // floorLabel: the archive

    // Right, laid out right to left. Row 1: paperclips, KPI stars, level, Stock Options.
    // Row 2: games played, coffee, coffee timer. Every stat is clickable (see StatsDialog).
    this.hits = [];
    const hit = (key, x0, x1, y) => this.hits.push({ key, x: x0 - 2, y: y - 2, w: x1 - x0 + 4, h: 11 });
    let x = W - 4;
    let y = 3;
    const item = (key, ic, text, color = C.text, iw = 9) => {
      const end = x;
      x -= measureText(text);
      drawText(g, text, x, y, { color });
      if (ic) {
        x -= iw;
        icon(g, ic, x, y);
      }
      hit(key, x, end, y);
      x -= 8;
    };

    item('so', 'so', formatNum(s.so), C.so);
    const need = E.xpToNext(s.level);
    const lvEnd = x;
    x -= 34;
    bar(g, x, y + 1, 34, 6, s.xp / need, C.xp);
    x -= 3;
    const lv = `Lv${s.level}`;
    x -= measureText(lv);
    drawText(g, lv, x, y, { color: C.xp });
    hit('level', x, lvEnd, y);
    x -= 8;
    const stars = s.starsByFloor[s.floor] || 0;
    const quota = E.starQuota(s.floor);
    item('stars', 'star', `${stars}/${quota}`, stars >= quota ? C.good : C.text);
    item('sp', 'sp', formatNum(s.sp), C.gold);

    x = W - 4;
    y = 12;
    const next = S.msToNextCoffee(s, now);
    if (next > 0) item('coffee', null, `+1 ${formatTime(next)}`, C.dim);
    const cmax = S.coffeeMax(s);
    item('coffee', 'coffee', `${s.coffee.value}/${cmax}`, coffeeColor(S.coffeeLevel(s)));
    const gp = S.gamesPlayed(s);
    item('games', 'pad', `${gp.played}/${gp.total}`, gp.played === gp.total ? C.good : C.text, 11);

    // Blinking promotion hint at the left end of row 2 (explains the KPI stars when clicked).
    const st = s.floor === s.maxFloor ? S.promotionStatus(s) : null;
    const promo = st?.can ? ['PROMOTION READY', C.good] : st?.ready ? ['SEE HR FOR REVIEW', C.so] : null;
    if (promo) {
      const end = x;
      x -= measureText(promo[0]);
      if (Math.floor(this.pulse * 2) % 2 === 0) drawText(g, promo[0], x, y, { color: promo[1] });
      hit('stars', x, end, y);
    }
    const hov = this.game.input.pointer.inside ? this.hitAt(this.game.input.pointer) : null;
    if (hov) for (const h of this.hits.filter((q) => q.key === hov.key)) rect(g, h.x + 2, h.y + 10, h.w - 4, 1, C.gold);

    this.buttons.render(g);
  }
}
