// Modal overlays drawn above the floor: task card, elevator, shop + fake checkout, perks, training, menu, dialogs.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, icon, stars, bar, formatNum, formatTime, ButtonSet, frame } from '../engine/ui.js';
import { drawText, drawWrapped, measureText, wrapText } from '../engine/font.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { MINIGAMES } from '../minigames/index.js';
import { titleForFloor, floorName, departmentForFloor } from '../data/departments.js';

class Modal {
  constructor(game, { w = 260, h = 160, title = '' } = {}) {
    this.game = game;
    this.opaque = false;
    this.w = w;
    this.h = h;
    this.title = title;
    this.buttons = new ButtonSet();
    this.t = 0;
  }
  get x() {
    return Math.round((W - this.w) / 2);
  }
  get y() {
    return Math.round((H - this.h) / 2);
  }
  close() {
    if (this.game.top === this) this.game.pop();
  }
  build() {}
  update(dt) {
    this.t += dt;
    this.build();
    const input = this.game.input;
    if (input.back()) {
      this.game.sfx('click');
      return this.close();
    }
    this.buttons.update(input, (n) => this.game.sfx(n));
    if (input.pointer.clicked && !inside(input.pointer, this.x, this.y, this.w, this.h)) {
      input.consumeClick();
      this.close();
    }
  }
  render(g) {
    dim(g, 0.55);
    panel(g, this.x, this.y, this.w, this.h, { title: this.title });
    this.renderBody(g, this.x, this.y + 14);
    this.buttons.render(g);
  }
  renderBody() {}
}

const inside = (p, x, y, w, h) => p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;

// ------------------------------------------------------------------ task card
export class TaskCard extends Modal {
  constructor(game, task, onStart) {
    super(game, { w: 280, h: 170, title: task.title });
    this.task = task;
    this.onStart = onStart;
    this.mg = MINIGAMES[task.game];
  }
  build() {
    const s = this.game.state;
    const now = this.game.now();
    const floor = s.floor;
    const check = S.canStartTask(s, this.task, floor, now);
    const b = this.buttons;
    const keepFocus = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    if (check.reason === 'cooldown') {
      const left = S.cooldownLeft(s, this.task.id, now);
      b.add({ x: this.x + 10, y: by, w: 110, h: 18, label: `Busy ${formatTime(left)}`, disabled: true });
      b.add({ x: this.x + 126, y: by, w: 84, h: 18, label: 'Skip', icon: 'so', sub: null, color: '#2f7f6f', disabled: s.so < E.SKIP_COOLDOWN_SO, onClick: () => this.skip() });
    } else if (check.reason === 'coffee') {
      b.add({ x: this.x + 10, y: by, w: 110, h: 18, label: `Need ${check.cost} coffee`, disabled: true });
      b.add({ x: this.x + 126, y: by, w: 84, h: 18, label: `Refill ${E.REFILL_COFFEE_SO}`, icon: 'so', color: '#2f7f6f', disabled: s.so < E.REFILL_COFFEE_SO, onClick: () => this.refill() });
    } else {
      b.add({ x: this.x + 10, y: by, w: 200, h: 18, label: `Start  (-${check.cost} coffee)`, color: C.goodBtn, onClick: () => this.start() });
    }
    b.add({ x: this.x + this.w - 64, y: by, w: 54, h: 18, label: 'Back', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(keepFocus, b.items.length - 1);
  }
  start() {
    const s = this.game.state;
    const r = S.startTask(s, this.task, s.floor, this.game.now());
    if (!r.ok) return this.game.sfx('bad');
    this.game.markDirty();
    this.game.pop();
    this.onStart(this.task);
  }
  skip() {
    const r = S.skipCooldown(this.game.state, this.task.id, this.game.now());
    if (r.ok) {
      this.game.sfx('coin');
      this.game.markDirty();
    }
  }
  refill() {
    const r = S.refillCoffee(this.game.state, this.game.now());
    if (r.ok) {
      this.game.sfx('coin');
      this.game.toast('Coffee refilled! Productivity intensifies.', C.coffee);
      this.game.markDirty();
    }
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const t = this.task;
    drawText(g, this.mg.name, x + 10, y + 6, { color: C.gold });
    const diff = Math.round(t.difficulty * 4) + 1;
    drawText(g, 'Difficulty', x + this.w - 100, y + 6, { color: C.dim });
    for (let i = 0; i < 5; i++) rect(g, x + this.w - 46 + i * 7, y + 7, 5, 6, i < diff ? (diff >= 4 ? C.bad : diff >= 3 ? C.warn : C.good) : C.panelDark);
    drawWrapped(g, this.mg.help, x + 10, y + 20, this.w - 20, { color: C.text });
    const best = s.bestByTask[t.id];
    drawText(g, 'Best:', x + 10, y + 72, { color: C.dim });
    if (best == null) drawText(g, 'not attempted', x + 40, y + 72, { color: C.dim });
    else stars(g, best, x + 40, y + 72);
    const r3 = E.taskReward(s.floor, 3, s.perks);
    const r1 = E.taskReward(s.floor, 1, s.perks);
    drawText(g, 'Rewards:', x + 10, y + 86, { color: C.dim });
    icon(g, 'sp', x + 56, y + 86);
    drawText(g, `${formatNum(r1.sp)}-${formatNum(r3.sp)}`, x + 66, y + 86, { color: C.gold });
    icon(g, 'xp', x + 130, y + 86);
    drawText(g, `${formatNum(r1.xp)}-${formatNum(r3.xp)}`, x + 140, y + 86, { color: C.xp });
    icon(g, 'star', x + 200, y + 86);
    drawText(g, '0-3 KPI', x + 210, y + 86);
    drawText(g, `Cooldown after play: ${formatTime(E.stationCooldownMs(s.floor, s.perks))}`, x + 10, y + 100, { color: C.dim });
  }
}

// ------------------------------------------------------------------ elevator
export class ElevatorPanel extends Modal {
  constructor(game, { onPromote, onTravel }) {
    super(game, { w: 320, h: 196, title: 'Elevator' });
    this.onPromote = onPromote;
    this.onTravel = onTravel;
  }
  build() {
    const s = this.game.state;
    const st = S.promotionStatus(s);
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    if (!st.top) {
      b.add({
        x: this.x + 10, y: this.y + 82, w: this.w - 20, h: 20,
        label: st.can ? `Get promoted to floor ${st.floor + 1}!` : `Promotion to floor ${st.floor + 1} locked`,
        icon: st.can ? 'up' : 'lock', disabled: !st.can, color: C.goodBtn,
        onClick: () => {
          this.game.pop();
          this.onPromote();
        },
      });
    }
    const cols = 10;
    const bw = 28;
    const bh = 13;
    const gx = this.x + (this.w - cols * (bw + 2)) / 2;
    for (let fl = 1; fl <= E.FLOORS; fl++) {
      const i = fl - 1;
      const unlocked = fl <= s.maxFloor;
      const here = fl === s.floor;
      b.add({
        x: gx + (i % cols) * (bw + 2), y: this.y + 124 + Math.floor(i / cols) * (bh + 2), w: bw, h: bh,
        label: String(fl), disabled: !unlocked,
        color: here ? C.gold : departmentColor(fl), textColor: here ? C.ink : null,
        onClick: () => {
          this.game.pop();
          if (here) this.game.toast(`You are already on floor ${fl}.`, C.dim);
          else this.onTravel(fl);
        },
      });
    }
    b.columns = cols;
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const st = S.promotionStatus(s);
    if (st.top) {
      drawText(g, s.flags.ceo ? 'You run this place now. Enjoy the view, CEO.' : 'Top floor. Hit the KPI quota to become CEO!', x + this.w / 2, y + 8, { align: 'center', color: C.gold });
      const stars0 = s.starsByFloor[40] || 0;
      bar(g, x + 40, y + 24, this.w - 80, 8, stars0 / E.starQuota(40), C.gold);
      drawText(g, `${stars0}/${E.starQuota(40)} KPI stars`, x + this.w / 2, y + 36, { align: 'center' });
    } else {
      drawText(g, `Next: F${st.floor + 1} ${floorName(st.floor + 1)} — ${titleForFloor(st.floor + 1)}`, x + 10, y + 4, { color: C.gold });
      const row = (i, ok, label, val) => {
        const yy = y + 18 + i * 12;
        icon(g, ok ? 'check' : 'lock', x + 10, yy);
        drawText(g, label, x + 22, yy, { color: ok ? C.text : C.dim });
        drawText(g, val, x + this.w - 10, yy, { align: 'right', color: ok ? C.good : C.bad });
      };
      row(0, st.checks.stars, `KPI stars earned on floor ${st.floor}`, `${st.stars}/${st.quota}`);
      row(1, st.checks.level, 'Seniority level', `Lv${st.level}/${st.levelReq}`);
      row(2, st.checks.sp, 'Keycard fee (Synergy Points)', `${formatNum(st.sp)}/${formatNum(st.fee)}`);
      if (s.floor !== s.maxFloor) drawText(g, `(Promotions happen from your highest floor, F${s.maxFloor}.)`, x + 10, y + 56, { color: C.dim });
    }
    drawText(g, 'Ride to an unlocked floor (gold = you are here):', x + 10, y + 96, { color: C.dim });
  }
}

function departmentColor(fl) {
  const d = departmentForFloor(fl);
  return d.carpet[0];
}

// ------------------------------------------------------------------ shop + fake checkout
export class ShopOverlay extends Modal {
  constructor(game) {
    super(game, { w: 340, h: 200, title: 'Stock Option Shop' });
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const cw = 76;
    E.SO_PACKS.forEach((p, i) => {
      b.add({
        x: this.x + 10 + i * (cw + 4), y: this.y + 104, w: cw, h: 28, label: p.price, sub: null, color: '#2f7f6f',
        onClick: () => this.game.push(new FakeCheckout(this.game, p)),
      });
    });
    const s = this.game.state;
    b.add({ x: this.x + 10, y: this.y + 160, w: 150, h: 18, label: `Refill coffee (${E.REFILL_COFFEE_SO})`, icon: 'coffee', color: C.coffee, disabled: s.so < E.REFILL_COFFEE_SO || s.coffee.value >= S.coffeeMax(s), onClick: () => {
      if (S.refillCoffee(s, this.game.now()).ok) {
        this.game.sfx('coin');
        this.game.markDirty();
        this.game.toast('Coffee refilled!', C.coffee);
      }
    } });
    b.add({ x: this.x + this.w - 64, y: this.y + 160, w: 54, h: 18, label: 'Close', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    drawWrapped(g, 'Stock Options are the premium currency: skip task cooldowns, refill coffee and buy executive perks.', x + 10, y + 6, this.w - 20, { color: C.text });
    const cw = 76;
    E.SO_PACKS.forEach((p, i) => {
      const px = x + 10 + i * (cw + 4);
      panel(g, px, y + 30, cw, 58, { fill: C.panelDark });
      if (p.tag) {
        rect(g, px + 1, y + 31, cw - 2, 9, C.gold);
        drawText(g, p.tag, px + cw / 2, y + 32, { align: 'center', color: C.ink });
      }
      icon(g, 'so', px + cw / 2 - 12, y + 46, 2);
      drawText(g, `${p.so}`, px + cw / 2 + 4, y + 50, { color: C.so });
      drawText(g, p.label, px + cw / 2, y + 70, { align: 'center', color: C.dim });
    });
    rect(g, x + 10, y + 124, this.w - 20, 12, '#4a2020');
    drawText(g, 'DEMO MODE — payments are simulated, no real money is charged.', x + this.w / 2, y + 126, { align: 'center', color: '#ffb0a0' });
  }
}

export class FakeCheckout extends Modal {
  constructor(game, pack) {
    super(game, { w: 230, h: 170, title: 'Secure Checkout (DEMO)' });
    this.pack = pack;
    this.phase = 'form';
    this.timer = 0;
  }
  build() {
    const b = this.buttons;
    b.clear();
    if (this.phase === 'form') {
      b.add({ x: this.x + 10, y: this.y + this.h - 28, w: 140, h: 20, label: `Pay ${this.pack.price}`, color: C.goodBtn, onClick: () => {
        this.phase = 'processing';
        this.timer = 0;
        this.game.sfx('click');
      } });
      b.add({ x: this.x + 156, y: this.y + this.h - 28, w: 64, h: 20, label: 'Cancel', color: C.panelLight, onClick: () => this.close() });
    } else if (this.phase === 'done') {
      b.add({ x: this.x + 10, y: this.y + this.h - 28, w: this.w - 20, h: 20, label: 'Great!', color: C.goodBtn, onClick: () => this.close() });
    }
  }
  update(dt) {
    if (this.phase === 'processing') {
      this.timer += dt;
      this.t += dt;
      if (this.timer > 1.2) {
        S.purchasePack(this.game.state, this.pack.id);
        this.game.markDirty();
        this.game.saveNow();
        this.game.sfx('cash');
        this.phase = 'done';
      }
      return;
    }
    super.update(dt);
  }
  renderBody(g, x, y) {
    const p = this.pack;
    drawText(g, `${p.label}: ${p.so} Stock Options`, x + 10, y + 6, { color: C.gold });
    drawText(g, `Total: ${p.price}`, x + 10, y + 18);
    if (this.phase === 'form') {
      const field = (yy, label, val) => {
        drawText(g, label, x + 10, yy, { color: C.dim });
        rect(g, x + 10, yy + 9, this.w - 20, 12, C.paper);
        drawText(g, val, x + 14, yy + 11, { color: C.ink });
      };
      field(y + 32, 'Card number', '4242 4242 4242 4242');
      field(y + 58, 'Name on card', this.game.state.player.name);
      drawText(g, 'Nothing is charged. This is a demo.', x + 10, y + 86, { color: '#ffb0a0' });
    } else if (this.phase === 'processing') {
      const dots = '.'.repeat(1 + (Math.floor(this.timer * 4) % 3));
      drawText(g, `Processing payment${dots}`, x + this.w / 2, y + 56, { align: 'center' });
      bar(g, x + 30, y + 72, this.w - 60, 8, this.timer / 1.2, C.so);
    } else {
      icon(g, 'so', x + this.w / 2 - 7, y + 40, 2);
      drawText(g, `+${p.so} Stock Options!`, x + this.w / 2, y + 62, { align: 'center', color: C.so });
      drawText(g, 'Thank you for your (pretend) money.', x + this.w / 2, y + 76, { align: 'center', color: C.dim });
    }
  }
}

// ------------------------------------------------------------------ perks
export class PerksOverlay extends Modal {
  constructor(game) {
    super(game, { w: 330, h: 196, title: 'Office Perks' });
  }
  build() {
    const s = this.game.state;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    E.PERKS.forEach((p, i) => {
      const lvl = S.perkLevel(s, p.id);
      const maxed = lvl >= p.max;
      const cost = maxed ? 0 : E.perkCost(p, lvl);
      b.add({
        x: this.x + this.w - 86, y: this.y + 20 + i * 26, w: 76, h: 18,
        label: maxed ? 'MAX' : formatNum(cost), icon: maxed ? 'check' : p.currency === 'so' ? 'so' : 'sp',
        disabled: maxed || s[p.currency] < cost, color: p.currency === 'so' ? '#2f7f6f' : C.accent,
        onClick: () => {
          const r = S.buyPerk(s, p.id);
          if (r.ok) {
            this.game.sfx('levelup');
            this.game.markDirty();
            this.game.toast(`${p.name} upgraded!`, C.good);
          }
        },
      });
    });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    E.PERKS.forEach((p, i) => {
      const yy = y + 8 + i * 26;
      const lvl = S.perkLevel(s, p.id);
      drawText(g, p.name, x + 10, yy, { color: p.currency === 'so' ? C.so : C.text });
      drawText(g, p.desc, x + 10, yy + 10, { color: C.dim });
      for (let k = 0; k < p.max; k++) rect(g, x + 150 + k * 9, yy + 2, 7, 7, k < lvl ? C.gold : C.panelDark);
    });
  }
}

// ------------------------------------------------------------------ training (SP → XP)
export class TrainOverlay extends Modal {
  constructor(game) {
    super(game, { w: 300, h: 150, title: 'Training Center' });
  }
  build() {
    const s = this.game.state;
    const need = E.xpToNext(s.level) - s.xp;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const opts = [Math.max(1, Math.round(need * 0.25)), Math.max(1, Math.round(need * 0.5)), Math.max(1, need)];
    const labels = ['Webinar', 'Workshop', 'Certification'];
    opts.forEach((xp, i) => {
      const cost = xp * E.TRAINING_SP_PER_XP;
      b.add({
        x: this.x + 10 + i * 96, y: this.y + 82, w: 88, h: 30, label: `${labels[i]}`, sub: `${formatNum(cost)} SP`,
        disabled: s.sp < cost,
        onClick: () => {
          const r = S.train(s, xp);
          if (r.ok) {
            this.game.sfx(r.levelsGained ? 'levelup' : 'coin');
            this.game.markDirty();
            this.game.toast(r.levelsGained ? `Level up! Now Lv${s.level} (+1 Stock Option)` : `+${xp} XP`, r.levelsGained ? C.gold : C.xp);
          }
        },
      });
    });
    b.add({ x: this.x + this.w - 64, y: this.y + this.h - 24, w: 54, h: 16, label: 'Close', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    drawWrapped(g, `Turn Synergy Points into experience. ${E.TRAINING_SP_PER_XP} SP buys 1 XP. Level up to qualify for promotions.`, x + 10, y + 6, this.w - 20);
    drawText(g, `Lv${s.level}`, x + 10, y + 32, { color: C.xp });
    bar(g, x + 36, y + 32, this.w - 100, 8, s.xp / E.xpToNext(s.level), C.xp);
    drawText(g, `${formatNum(s.xp)}/${formatNum(E.xpToNext(s.level))}`, x + this.w - 10, y + 32, { align: 'right', color: C.dim });
    const xpLabels = [0.25, 0.5, 1];
    const need = E.xpToNext(s.level) - s.xp;
    xpLabels.forEach((k, i) => drawText(g, `+${formatNum(Math.max(1, Math.round(need * k)))} XP`, x + 54 + i * 96, y + 50, { align: 'center', color: C.xp }));
  }
}

// ------------------------------------------------------------------ dialog
export class Dialog extends Modal {
  constructor(game, { title = '', text = '', button = 'OK', w = 280, onClose = null, extra = null }) {
    super(game, { w, h: 60, title });
    this.text = text;
    this.onClose = onClose;
    this.extra = extra;
    this.buttonLabel = button;
    const lines = wrapText(text, w - 24).length;
    this.h = Math.min(250, 44 + lines * 10 + (extra ? extra.h : 0));
  }
  close() {
    super.close();
    this.onClose?.();
  }
  build() {
    this.buttons.clear();
    this.buttons.add({ x: this.x + this.w / 2 - 40, y: this.y + this.h - 24, w: 80, h: 18, label: this.buttonLabel, onClick: () => this.close() });
  }
  renderBody(g, x, y) {
    const h = drawWrapped(g, this.text, x + 12, y + 6, this.w - 24);
    this.extra?.draw(g, x, y + 10 + h);
  }
}

// ------------------------------------------------------------------ pause menu
export class PauseMenu extends Modal {
  constructor(game, { onQuit }) {
    super(game, { w: 200, h: 176, title: 'Menu' });
    this.onQuit = onQuit;
    this.confirmReset = false;
  }
  build() {
    const s = this.game.state;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const add = (label, onClick, color) => b.add({ x: this.x + 20, y: this.y + 22 + b.items.length * 22, w: this.w - 40, h: 18, label, onClick, color });
    add('Resume', () => this.close());
    add(`Music: ${s.settings.music ? 'ON' : 'OFF'}`, () => {
      s.settings.music = !s.settings.music;
      this.game.audio.setMusic(s.settings.music);
      this.game.markDirty();
    });
    add(`Sound effects: ${s.settings.sfx ? 'ON' : 'OFF'}`, () => {
      s.settings.sfx = !s.settings.sfx;
      this.game.audio.setSfx(s.settings.sfx);
      this.game.markDirty();
    });
    add('How to play', () => this.game.push(new Dialog(this.game, { title: 'How to play', w: 320, text: HOW_TO })));
    add('Save & quit to title', () => {
      this.game.saveNow();
      this.onQuit();
    }, C.panelLight);
    add(this.confirmReset ? 'Really erase everything?' : 'Reset career', () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        return;
      }
      this.game.wipeSave();
      this.onQuit();
    }, C.bad);
    b.focus = Math.min(f, b.items.length - 1);
  }
}

export const HOW_TO =
  'Move: arrow keys / WASD, or click the floor.\n' +
  'Interact: SPACE / ENTER near a desk, printer, meeting room... or click it.\n' +
  'Each task is a mini-game that costs coffee and earns Synergy Points (SP), XP and 0-3 KPI stars.\n' +
  'Collect enough stars on a floor, reach the seniority level and pay the keycard fee at the elevator to get promoted.\n' +
  'Coffee refills over time (also offline). Tasks have cooldowns. Stock Options skip the waiting.\n' +
  'Esc: menu/back   M: music   B: shop   P: perks   T: training';

export function drawStarsLarge(g, n, x, y) {
  for (let i = 0; i < 3; i++) icon(g, i < n ? 'star' : 'starOff', x + i * 20, y, 2);
}

export { frame };
