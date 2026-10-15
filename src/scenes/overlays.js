// Modal overlays drawn above the floor: task card, elevator, shop + fake checkout, perks, training, menu, dialogs.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, icon, stars, bar, formatNum, formatTime, ButtonSet, frame, openCoffee, drawLink } from '../engine/ui.js';
import { drawText, drawWrapped, measureText, wrapText } from '../engine/font.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import * as C_ from '../core/conduct.js';
import { taskCooldownMs } from '../core/nightShift.js';
import { archiveOpen } from '../core/archive.js';
import * as PA from '../core/party.js';
import { MINIGAMES } from '../minigames/index.js';
import { titleForFloor, floorName, departmentForFloor } from '../data/departments.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import { openFeedback } from '../engine/feedback.js';
import { track } from '../engine/analytics.js';
import { remindersSupported, remindersOn, remindersBlocked, enableReminders, disableReminders } from '../engine/reminders.js';
import { isNative, isTouch, features, openExternal } from '../engine/platform.js';

export class Modal {
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

/** Analytics: Stock Options spent (`on` = what for), tagged with the career floor. */
const trackSpend = (game, on, so) => track('so_spend', { on, so, floor: game.state.maxFloor });

const inside = (p, x, y, w, h) => p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;

// ------------------------------------------------------------------ task card
export class TaskCard extends Modal {
  /**
   * peek: optional callback for stations that are also curiosities (the fridge, a plant): a "Peek" button.
   * trip: a task in a client's office (business trip): double paperclips, no KPI stars.
   */
  constructor(game, task, onStart, { peek = null, trip = false } = {}) {
    super(game, { w: peek ? 340 : 280, h: 170, title: task.title });
    this.task = task;
    this.onStart = onStart;
    this.peek = peek;
    this.trip = trip;
    this.mg = MINIGAMES[task.game];
  }
  build() {
    const s = this.game.state;
    const now = this.game.now();
    const floor = s.floor;
    const check = S.canStartTask(s, this.task, floor, now);
    this.noCoffee = check.reason === 'coffee';
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
      b.add({ x: this.x + 10, y: by, w: 200, h: 18, label: check.cost ? `Start  (-${check.cost} coffee)` : 'Start  (free)', color: C.goodBtn, onClick: () => this.start() });
    }
    if (this.peek) b.add({ x: this.x + this.w - 124, y: by, w: 54, h: 18, label: 'Peek', color: C.panelLight, onClick: () => (this.close(), this.peek()) });
    b.add({ x: this.x + this.w - 64, y: by, w: 54, h: 18, label: 'Back', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(keepFocus, b.items.length - 1);
  }
  close() {
    super.close();
    if (this.noCoffee) offerReminders(this.game);
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
      trackSpend(this.game, 'skip_task', E.SKIP_COOLDOWN_SO);
      this.game.sfx('coin');
      this.game.markDirty();
    }
  }
  refill() {
    const r = S.refillCoffee(this.game.state, this.game.now());
    if (r.ok) {
      trackSpend(this.game, 'refill', E.REFILL_COFFEE_SO);
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
    const cost = S.taskCost(s, t);
    drawText(g, 'Coffee', x + this.w - 100, y + 72, { color: C.dim });
    for (let i = 0; i < cost; i++) icon(g, 'coffee', x + this.w - 46 + i * 10, y + 72);
    if (!cost) drawText(g, 'free', x + this.w - 46, y + 72, { color: C.good });
    if (best == null) drawText(g, 'not attempted', x + 40, y + 72, { color: C.dim });
    else stars(g, best, x + 40, y + 72);
    const r3 = E.taskReward(s.floor, 3, s.perks);
    const r1 = E.taskReward(s.floor, 1, s.perks);
    const m = this.trip ? E.TRIP_SP_MULT : 1;
    drawText(g, 'Rewards:', x + 10, y + 86, { color: C.dim });
    icon(g, 'sp', x + 56, y + 86);
    drawText(g, `${formatNum(r1.sp * m)}-${formatNum(r3.sp * m)}`, x + 66, y + 86, { color: C.gold });
    icon(g, 'xp', x + 130, y + 86);
    drawText(g, `${formatNum(r1.xp)}-${formatNum(r3.xp)}`, x + 140, y + 86, { color: C.xp });
    if (this.trip) drawText(g, 'x2 clips', x + 200, y + 86, { color: C.good });
    else {
      icon(g, 'star', x + 200, y + 86);
      drawText(g, '0-3 KPI', x + 210, y + 86);
    }
    if (t.checkin && s.lobby === 'checkin') drawText(g, `Check-in: any result loads your coffee card`, x + 10, y + 100, { color: C.coffee });
    else {
      const half = s.nightShift?.floor === s.floor;
      drawText(g, `Cooldown after play: ${formatTime(taskCooldownMs(s, t.game))}${half ? ' (half, night shift)' : ''}`, x + 10, y + 100, { color: half ? C.good : C.dim });
    }
  }
}

// ------------------------------------------------------------------ HR performance review
export class ReviewCard extends Modal {
  constructor(game, onStart) {
    super(game, { w: 290, h: 168, title: 'HR Office · Performance Review' });
    this.onStart = onStart;
  }
  build() {
    const s = this.game.state;
    const r = S.reviewStatus(s, this.game.now());
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    if (r.state === 'cooldown') {
      b.add({ x: this.x + 10, y: by, w: 120, h: 18, label: `Retry in ${formatTime(r.left)}`, disabled: true });
      b.add({ x: this.x + 136, y: by, w: 84, h: 18, label: 'Skip', icon: 'so', color: '#2f7f6f', disabled: s.so < E.SKIP_COOLDOWN_SO, onClick: () => {
        if (S.skipCooldown(s, S.reviewKey(s.maxFloor), this.game.now()).ok) {
          trackSpend(this.game, 'skip_review', E.SKIP_COOLDOWN_SO);
          this.game.sfx('coin');
          this.game.markDirty();
        }
      } });
    } else if (r.state === 'coffee') {
      b.add({ x: this.x + 10, y: by, w: 120, h: 18, label: `Need ${r.cost} coffee`, disabled: true });
      b.add({ x: this.x + 136, y: by, w: 84, h: 18, label: `Refill ${E.REFILL_COFFEE_SO}`, icon: 'so', color: '#2f7f6f', disabled: s.so < E.REFILL_COFFEE_SO, onClick: () => {
        if (S.refillCoffee(s, this.game.now()).ok) {
          trackSpend(this.game, 'refill', E.REFILL_COFFEE_SO);
          this.game.sfx('coin');
          this.game.markDirty();
        }
      } });
    } else {
      b.add({ x: this.x + 10, y: by, w: 210, h: 18, label: `Start review  (-${r.cost} coffee)`, color: C.goodBtn, onClick: () => {
        if (!S.startReview(s, this.game.now()).ok) return this.game.sfx('bad');
        this.game.markDirty();
        this.game.pop();
        this.onStart();
      } });
    }
    b.add({ x: this.x + this.w - 64, y: by, w: 54, h: 18, label: 'Back', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    drawText(g, `Promotion to floor ${s.maxFloor + 1}: ${titleForFloor(s.maxFloor + 1)}`, x + 10, y + 6, { color: C.gold });
    drawWrapped(
      g,
      'Your numbers look good. Before the elevator takes you up, HR needs a quick chat about your growth mindset. Answer like a future leader.',
      x + 10, y + 20, this.w - 20,
    );
    drawText(g, `Pass mark: ${Math.round(E.REVIEW_PASS_SCORE * 100)}% · retry wait if you fail: ${formatTime(E.reviewCooldownMs(s.maxFloor, s.perks))}`, x + 10, y + 78, { color: C.dim });
    drawText(g, 'One question is about your own track record.', x + 10, y + 92, { color: C.dim });
  }
}

/** Shown when the HR desk is visited but no review is possible (not ready, already passed, wrong floor). */
/** HR's note on why there is no review now; onClose runs after it (the archive challenge's offer follows it). */
export function hrNotice(game, state, onClose = null) {
  const s = game.state;
  const st = S.promotionStatus(s);
  let text;
  if (state === 'passed') text = 'You already aced your performance review. The elevator is waiting for you!';
  else if (state === 'top') text = s.flags.ceo ? 'HR reports to you now, CEO.' : 'There is nobody left to review you. Hit the KPI quota on this floor to become CEO.';
  else if (state === 'wrongFloor') text = `Performance reviews happen on your highest floor (F${s.maxFloor}). Take the elevator up when you are ready.`;
  else {
    const missing = [];
    if (!st.checks.stars) missing.push(`- KPI stars on this floor: ${st.stars}/${st.quota}`);
    if (!st.checks.level) missing.push(`- Seniority level: Lv${st.level}/${st.levelReq}`);
    if (!st.checks.sp) missing.push(`- Keycard fee: ${formatNum(st.sp)}/${formatNum(st.fee)} paperclips`);
    text = `Reviews are by appointment only. Come back when you are promotion-ready:\n${missing.join('\n')}`;
  }
  game.push(new Dialog(game, { title: 'HR Office', w: 300, text, button: 'Understood', onClose }));
}

// ------------------------------------------------------------------ elevator
export class ElevatorPanel extends Modal {
  /** onArchive: the A button down to the archive, shown only while the archive challenge's folder is down there; onParty: the Christmas party's button while this year's is on offer. */
  constructor(game, { onPromote, onTravel, onArchive = null, onParty = null }) {
    const archive = !!onArchive && archiveOpen(game.state);
    const party = !!onParty && PA.partyStatus(game.state, game.now()) === 'available';
    super(game, { w: 320, h: 208 + (archive ? 18 : 0) + (party ? 18 : 0), title: 'Elevator' });
    this.onPromote = onPromote;
    this.onTravel = onTravel;
    this.onArchive = archive ? onArchive : null;
    this.onParty = party ? onParty : null;
  }
  build() {
    const s = this.game.state;
    const st = S.promotionStatus(s);
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    if (!st.top) {
      b.add({
        x: this.x + 10, y: this.y + 94, w: this.w - 20, h: 20,
        label: st.can ? `Get promoted to floor ${st.floor + 1}!` : st.ready ? 'Pass your HR review first' : `Promotion to floor ${st.floor + 1} locked`,
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
        x: gx + (i % cols) * (bw + 2), y: this.y + 136 + Math.floor(i / cols) * (bh + 2), w: bw, h: bh,
        label: String(fl), disabled: !unlocked,
        color: here ? C.gold : departmentColor(fl), textColor: here ? C.ink : null,
        onClick: () => {
          this.game.pop();
          if (here) this.game.toast(`You are already on floor ${fl}.`, C.dim);
          else this.onTravel(fl);
        },
      });
    }
    if (this.onArchive) {
      b.add({
        x: gx, y: this.y + 202, w: cols * (bw + 2) - 2, h: 14, label: 'A · Archive: fetch the lost folder', icon: 'folder', color: '#5a4a7a',
        onClick: () => {
          this.game.pop();
          this.onArchive();
        },
      });
    }
    if (this.onParty) {
      b.add({
        x: gx, y: this.y + 202 + (this.onArchive ? 18 : 0), w: cols * (bw + 2) - 2, h: 14, label: 'P · Christmas party', icon: 'star', color: '#a8242a',
        onClick: () => {
          this.game.pop();
          this.onParty();
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
      row(2, st.checks.sp, 'Keycard fee (paperclips)', `${formatNum(st.sp)}/${formatNum(st.fee)}`);
      row(3, st.checks.review, st.checks.review ? 'Performance review (HR)' : st.ready ? 'Performance review: visit the HR office' : 'Performance review (HR, once ready)', st.checks.review ? 'PASSED' : 'pending');
      if (s.floor !== s.maxFloor) drawText(g, `(Promotions happen from your highest floor, F${s.maxFloor}.)`, x + 10, y + 68, { color: C.dim });
    }
    drawText(g, 'Ride to an unlocked floor (gold = you are here):', x + 10, y + 108, { color: C.dim });
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
    track('shop_open', { floor: game.state.maxFloor });
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const cw = 76;
    if (features.shop) E.SO_PACKS.forEach((p, i) => {
      b.add({
        x: this.x + 10 + i * (cw + 4), y: this.y + 104, w: cw, h: 28, label: p.price, sub: null, color: '#2f7f6f',
        onClick: () => {
          track('checkout_open', { pack: p.id, floor: this.game.state.maxFloor });
          this.game.push(new FakeCheckout(this.game, p));
        },
      });
    });
    const s = this.game.state;
    b.add({ x: this.x + 10, y: this.y + 160, w: 150, h: 18, label: `Refill coffee (${E.REFILL_COFFEE_SO})`, icon: 'coffee', color: C.coffee, disabled: s.so < E.REFILL_COFFEE_SO || s.coffee.value >= S.coffeeMax(s), onClick: () => {
      if (S.refillCoffee(s, this.game.now()).ok) {
        trackSpend(this.game, 'refill', E.REFILL_COFFEE_SO);
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
    // The app has no checkout (the stores only allow their own billing): Stock Options are earned in the tower.
    if (!features.shop) {
      icon(g, 'so', x + 18, y + 40, 2);
      drawText(g, `You have ${this.game.state.so} Stock Options.`, x + 44, y + 40, { color: C.so });
      drawWrapped(g, 'Earn more with every Seniority level-up and promotion, the odd perfect 3-star task and daily stand-up streaks.', x + 44, y + 54, this.w - 60, { color: C.dim });
      return;
    }
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
        // The checkout is fake, so this measures willingness to pay rather than revenue.
        if (S.purchasePack(this.game.state, this.pack.id).ok) track('so_purchase', { pack: this.pack.id, so: this.pack.so, floor: this.game.state.maxFloor });
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
            if (p.currency === 'so') trackSpend(this.game, `perk:${p.id}`, r.cost);
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

// ------------------------------------------------------------------ training (paperclips → XP)
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
        x: this.x + 10 + i * 96, y: this.y + 82, w: 88, h: 30, label: `${labels[i]}`, sub: `${formatNum(cost)} clips`,
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
    drawWrapped(g, `Turn paperclips into experience. ${E.TRAINING_SP_PER_XP} paperclips buy 1 XP. Level up to qualify for promotions.`, x + 10, y + 6, this.w - 20);
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
  /**
   * action: optional second button { label, onClick, color, disabled }, shown left of the close button.
   * link: optional { text, url }, an external link at the bottom left (opened from the click itself, see drawLink).
   */
  constructor(game, { title = '', text = '', button = 'OK', w = 280, onClose = null, extra = null, action = null, link = null }) {
    super(game, { w, h: 60, title });
    this.action = action;
    this.link = link;
    this.text = text;
    this.onClose = onClose;
    this.extra = extra;
    this.buttonLabel = button;
    const lines = wrapText(text, w - 24).length;
    this.h = Math.min(250, 54 + lines * 10 + (extra ? extra.h : 0));
  }
  close() {
    super.close();
    this.onClose?.();
  }
  build() {
    this.buttons.clear();
    const y = this.y + this.h - 24;
    const a = this.action;
    if (a) {
      const aw = measureText(a.label) + 20;
      const x = this.x + (this.w - aw - 86) / 2;
      this.buttons.add({ x, y, w: aw, h: 18, label: a.label, color: a.color || C.goodBtn, disabled: !!a.disabled, onClick: () => (this.close(), a.onClick()) });
      this.buttons.add({ x: x + aw + 6, y, w: 80, h: 18, label: this.buttonLabel, color: C.panelLight, onClick: () => this.close() });
    } else this.buttons.add({ x: this.x + this.w / 2 - 40, y, w: 80, h: 18, label: this.buttonLabel, onClick: () => this.close() });
  }
  renderBody(g, x, y) {
    const h = drawWrapped(g, this.text, x + 12, y + 6, this.w - 24);
    this.extra?.draw(g, x, y + 10 + h);
    const l = this.link;
    if (l) drawLink(g, this.game.input, l.text, this.x + 12 + measureText(l.text), this.y + this.h - 19, l.url);
  }
}

/** The in-game help, with a link to the full guide (public/how-to-play/). */
export const howToDialog = (game) =>
  new Dialog(game, { title: 'How to play', w: 320, text: isTouch() ? HOW_TO_TOUCH : HOW_TO, link: { text: 'Read more...', url: 'how-to-play/' } });

// ------------------------------------------------------------------ CEO: personnel decision
/** The CEO talks to a colleague and decides their fate. npc: { a (Actor), id: { name, role, years, note } }. */
export class FateDialog extends Modal {
  constructor(game, { npc, line, dept, floor, onFire, onKeep }) {
    super(game, { w: 300, h: 148, title: 'Personnel Decision' });
    this.npc = npc;
    this.line = line;
    this.dept = dept;
    this.floor = floor;
    this.onFire = onFire;
    this.onKeep = onKeep;
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    b.add({ x: this.x + 10, y: by, w: 96, h: 18, label: 'Fire (F)', hotkey: 'f', color: C.bad, onClick: () => this.decide(this.onFire) });
    b.add({ x: this.x + 112, y: by, w: 96, h: 18, label: 'Keep (K)', hotkey: 'k', color: C.goodBtn, onClick: () => this.decide(this.onKeep) });
    b.add({ x: this.x + 214, y: by, w: 76, h: 18, label: 'Later', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  decide(fn) {
    this.close();
    fn?.();
  }
  renderBody(g, x, y) {
    const { a, id } = this.npc;
    rect(g, x + 10, y + 8, 40, 52, C.panelDark);
    frame(g, x + 10, y + 8, 40, 52, C.border);
    g.drawImage(a.sheet, 0, 0, CHAR_W, CHAR_H, x + 14, y + 12, CHAR_W * 2, CHAR_H * 2);
    const tx = x + 60;
    drawText(g, id.name, tx, y + 8, { color: C.gold });
    drawText(g, id.role, tx, y + 19, { color: C.text });
    drawText(g, `${this.dept} · floor ${this.floor}`, tx, y + 30, { color: C.dim });
    drawText(g, `With the company: ${id.years} year${id.years === 1 ? '' : 's'}`, tx, y + 41, { color: C.dim });
    drawText(g, `File: ${id.note}`, tx, y + 52, { color: C.dim });
    drawWrapped(g, `"${this.line}"`, x + 10, y + 68, this.w - 20, { color: C.so });
  }
}

// ------------------------------------------------------------------ coffee break chat (core/conduct.js)
const MOODS = ['', 'polite', 'guarded', 'annoyed', 'icy', 'icy'];

/**
 * The one colleague per floor who can be asked out (every ask is a strike). onTalk() returns their small-talk line; onAsk() returns
 * { line, strike, hold } (the card closes on hold). The HR notes row shows the career's strikes once there are any.
 */
export class ChatCard extends Modal {
  constructor(game, { npc, line, dept, floor, onTalk, onAsk }) {
    super(game, { w: 300, h: 162, title: 'Coffee Break Chat' });
    this.npc = npc;
    this.line = line;
    this.dept = dept;
    this.floor = floor;
    this.onTalk = onTalk;
    this.onAsk = onAsk;
    this.flashT = 0;
  }
  get ask() {
    return C_.askState(this.game.state, this.npc.seed);
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    b.add({ x: this.x + 10, y: by, w: 86, h: 18, label: 'Small talk', hotkey: 't', onClick: () => (this.line = this.onTalk()) });
    const ask = this.ask;
    if (ask) {
      b.add({
        x: this.x + 102, y: by, w: 124, h: 18, label: ask === 'ask' ? 'Ask for a drink (D)' : 'Ask again (D)', hotkey: 'd', color: ask === 'ask' ? '#2f5d8a' : '#7a3b3b',
        onClick: () => {
          const r = this.onAsk();
          if (!r) return;
          this.line = r.line;
          this.flashT = r.strike ? 1.2 : 0;
          if (r.hold) this.close();
        },
      });
    }
    b.add({ x: this.x + this.w - 64, y: by, w: 54, h: 18, label: 'Bye', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  update(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    super.update(dt);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const c = C_.conduct(s);
    const { a, id, seed } = this.npc;
    rect(g, x + 10, y + 8, 40, 52, C.panelDark);
    frame(g, x + 10, y + 8, 40, 52, C.border);
    g.drawImage(a.sheet, 0, 0, CHAR_W, CHAR_H, x + 14, y + 12, CHAR_W * 2, CHAR_H * 2);
    const tx = x + 60;
    drawText(g, id.name, tx, y + 8, { color: C.gold });
    drawText(g, id.role, tx, y + 19, { color: C.text });
    drawText(g, `${this.dept} · floor ${this.floor}`, tx, y + 30, { color: C.dim });
    const refused = c.refused[seed] || 0;
    if (refused) drawText(g, `Mood: ${MOODS[Math.min(refused, MOODS.length - 1)]}`, tx, y + 41, { color: refused > 2 ? C.bad : C.dim });
    else drawText(g, `With the company: ${id.years} year${id.years === 1 ? '' : 's'}`, tx, y + 41, { color: C.dim });
    drawWrapped(g, `"${this.line}"`, x + 10, y + 68, this.w - 20, { color: C.so });
    if (c.strikes > 0 || refused) {
      const ny = y + 98;
      drawText(g, 'HR notes:', x + 10, ny, { color: C.dim });
      for (let i = 0; i < E.HOLD_STRIKES; i++) {
        const on = i < c.strikes;
        const flash = on && i === c.strikes - 1 && this.flashT > 0 && Math.floor(this.flashT * 8) % 2 === 0;
        const bx = x + 60 + i * 12;
        rect(g, bx, ny - 1, 9, 9, C.border);
        rect(g, bx + 1, ny, 7, 7, flash ? '#ff5a4a' : on ? (c.strikes >= E.HOLD_STRIKES - 1 ? C.bad : C.warn) : C.panelDark);
      }
      drawText(g, `${c.strikes}/${E.HOLD_STRIKES}`, x + 60 + E.HOLD_STRIKES * 12 + 4, ny, { color: c.strikes ? C.warn : C.dim });
    }
  }
}

// ------------------------------------------------------------------ pause menu
/** Menu height for n stacked 18 px buttons (22 px apart) under the title. */
const menuH = (n) => 44 + n * 22;
/** A button adder for a vertical menu modal. */
const stacker = (m) => (label, onClick, color) =>
  m.buttons.add({ x: m.x + 20, y: m.y + 22 + m.buttons.items.length * 22, w: m.w - 40, h: 18, label, onClick, color });

export class PauseMenu extends Modal {
  /** The timed stays (trip, holiday, night shift, home office) stand still while the menu is open (game.update). */
  pausesClocks = true;
  constructor(game, { onQuit }) {
    super(game, { w: 200, h: menuH(features.tips ? 7 : 6), title: 'Menu' });
    this.onQuit = onQuit;
    this.confirmReset = false;
  }
  build() {
    const s = this.game.state;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const add = stacker(this);
    add('Resume', () => this.close());
    add('Settings', () => this.game.push(new SettingsMenu(this.game)));
    add('How to play', () => this.game.push(howToDialog(this.game)));
    add('Send feedback', () => openFeedback(`floor ${s.floor}, level ${s.level}, ${s.player.name} @ ${s.corp.name}`));
    if (features.tips) add('Buy author a coffee', openCoffee, C.goodBtn);
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

/** Menu > Settings: music, sound effects, reminders (where notifications exist) and the privacy policy. */
export class SettingsMenu extends Modal {
  constructor(game) {
    super(game, { w: 200, h: menuH(remindersSupported() ? 5 : 4), title: 'Settings' });
  }
  build() {
    const s = this.game.state;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const add = stacker(this);
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
    if (remindersSupported()) add(`Reminders: ${remindersOn(s) ? 'ON' : 'OFF'}`, () => toggleReminders(this.game));
    add('Privacy policy', () => openExternal('/privacy/'), C.panelLight);
    add('Back', () => this.close(), C.panelLight);
    b.focus = Math.min(f, b.items.length - 1);
  }
}

function toggleReminders(game) {
  if (remindersOn(game.state)) {
    disableReminders(game);
    return game.toast('Reminders off');
  }
  enableReminders(game).then((r) =>
    game.toast(r === 'on' ? 'Reminders on: at most 3 a day, never at night' : isNative() ? 'Notifications are off in the phone settings' : 'Notifications are blocked by the browser', r === 'on' ? C.text : C.bad),
  );
}

/** Offered once per career, the first time the player runs out of coffee. */
function offerReminders(game) {
  const s = game.state;
  if (s.flags.reminderOffered || !remindersSupported() || remindersBlocked() || remindersOn(s)) return;
  s.flags.reminderOffered = true;
  game.markDirty();
  game.push(new Dialog(game, {
    title: 'Not enough coffee',
    text: 'Coffee refills by itself, even while you are away. Want a reminder when the pot is full again? At most 3 a day, never at night. You can switch it off in the Menu.',
    button: 'No thanks',
    action: { label: 'Remind me', onClick: () => toggleReminders(game) },
  }));
}

export const HOW_TO =
  'Move: arrow keys / WASD, or click the floor.\n' +
  'Interact: SPACE / ENTER near a desk, printer, meeting room... or click it. Curious? Most other things react too.\n' +
  'Each task is a mini-game that costs coffee and earns paperclips (the office currency), XP and 0-3 KPI stars.\n' +
  'Collect enough stars on a floor, reach the seniority level and the keycard fee, then pass the HR performance review. Only then does the elevator take you up (going down is always fine).\n' +
  'Coffee refills over time (also offline). Tasks have cooldowns. Stock Options skip the waiting.\n' +
  'Daily: a colleague with a blue bubble has a stand-up favour. Decorate your desk (MY DESK): each floor sells new items. Collect badges (medal button or B).\n' +
  'Esc: menu/back   M: music   H: this help\n' +
  'O: shop   P: perks   T: training   B: badges';

/** The same help for phones and tablets: taps instead of keys. */
export const HOW_TO_TOUCH =
  'Move: tap the floor where you want to go.\n' +
  'Interact: tap a desk, printer, meeting room... Curious? Most other things react too.\n' +
  'Each task is a mini-game that costs coffee and earns paperclips (the office currency), XP and 0-3 KPI stars.\n' +
  'Collect enough stars on a floor, reach the seniority level and the keycard fee, then pass the HR performance review. Only then does the elevator take you up (going down is always fine).\n' +
  'Coffee refills over time (also offline). Tasks have cooldowns. Stock Options skip the waiting.\n' +
  'Daily: a colleague with a blue bubble has a stand-up favour. Decorate your desk (MY DESK): each floor sells new items. Collect badges (the medal button).\n' +
  'Tap the numbers at the top to see what they mean. The menu button (bottom right) has settings and help.';

/** Three big result stars centred on cx (74 px wide, 22 px tall). */
export function drawStarsLarge(g, n, cx, y) {
  for (let i = 0; i < 3; i++) icon(g, i < n ? 'starBig' : 'starBigOff', cx - 37 + i * 26, y, 2);
}

export { frame };
