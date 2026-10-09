// Heads-up display: currencies + progress (top bar) and action buttons (bottom right).
import { W, H } from '../engine/screen.js';
import { C, rect, icon, bar, formatNum, formatTime, ButtonSet } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { titleForFloor } from '../data/departments.js';

export const HUD_H = 22;

export class Hud {
  constructor(game, actions) {
    this.game = game;
    this.buttons = new ButtonSet({ keyboard: false });
    const defs = [
      { icon: 'cart', label: 'Shop', key: 'shop', hotkey: 'b' },
      { icon: 'up', label: 'Perks', key: 'perks', hotkey: 'p' },
      { icon: 'book', label: 'Train', key: 'train', hotkey: 't' },
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
  }

  /** Returns true if the HUD consumed the input this frame. */
  update(dt, input) {
    this.pulse += dt;
    const music = this.buttons.items.find((b) => b.icon === 'note' || b.icon === 'mute');
    if (music) music.icon = this.game.state.settings.music ? 'note' : 'mute';
    return this.buttons.update(input, (n) => this.game.sfx(n));
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
    drawText(g, `F${s.floor} · ${titleForFloor(s.maxFloor)}`, 22, 12, { color: C.dim });

    // Right, row 1: paperclips, coffee, SO.
    let x = W - 4;
    const item = (ic, text, color = C.text, y = 3) => {
      const w = measureText(text);
      x -= w;
      drawText(g, text, x, y, { color });
      x -= 9;
      icon(g, ic, x, y);
      x -= 8;
    };
    item('so', formatNum(s.so), C.so);
    const cmax = S.coffeeMax(s);
    item('coffee', `${s.coffee.value}/${cmax}`, s.coffee.value < E.coffeeCost(s.floor) ? C.bad : C.text);
    item('sp', formatNum(s.sp), C.gold);

    // Row 2: stars on this floor, level + xp, coffee timer.
    x = W - 4;
    const next = S.msToNextCoffee(s, now);
    if (next > 0) {
      const t = `+1 ${formatTime(next)}`;
      x -= measureText(t);
      drawText(g, t, x, 12, { color: C.dim });
      x -= 8;
    }
    const need = E.xpToNext(s.level);
    x -= 34;
    bar(g, x, 13, 34, 6, s.xp / need, C.xp);
    x -= 3;
    const lv = `Lv${s.level}`;
    x -= measureText(lv);
    drawText(g, lv, x, 12, { color: C.xp });
    x -= 10;
    const st = s.floor === s.maxFloor ? S.promotionStatus(s) : null;
    const stars = s.starsByFloor[s.floor] || 0;
    const quota = E.starQuota(s.floor);
    const sText = `${stars}/${quota}`;
    const done = stars >= quota;
    x -= measureText(sText);
    drawText(g, sText, x, 12, { color: done ? C.good : C.text });
    x -= 9;
    icon(g, 'star', x, 12);
    const promo = st?.can ? ['PROMOTION READY', C.good] : st?.ready ? ['SEE HR FOR REVIEW', C.so] : null;
    if (promo && Math.floor(this.pulse * 2) % 2 === 0) {
      x -= 6;
      x -= measureText(promo[0]);
      drawText(g, promo[0], x, 12, { color: promo[1] });
    }

    this.buttons.render(g);
  }
}
