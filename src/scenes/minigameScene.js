// Hosts one mini-game: countdown → play → results (stars, rewards, level-ups). Esc during play offers to forfeit.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, icon, bar, formatNum, formatTime, ButtonSet } from '../engine/ui.js';
import { drawText, wrapText } from '../engine/font.js';
import { createRng } from '../core/rng.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { MINIGAMES } from '../minigames/index.js';
import { departmentForFloor, titleForFloor } from '../data/departments.js';
import { drawStarsLarge } from './overlays.js';

export class MinigameScene {
  /** opts.mode: 'task' (default, rewards + KPI stars) or 'review' (HR performance review: pass/fail gate). */
  constructor(game, task, onDone, opts = {}) {
    this.game = game;
    this.task = task;
    this.onDone = onDone;
    this.mode = opts.mode || 'task';
    this.capturesKeys = true; // disables global hotkeys such as M (music) while playing
    this.floor = game.state.floor;
    const s = game.state;
    const stats = { floor: this.floor, stars: s.starsByFloor[this.floor] || 0, title: titleForFloor(s.maxFloor) };
    const mod = MINIGAMES[task.game];
    this.mod = mod;
    const dept = departmentForFloor(this.floor).id;
    this.inst = mod.create({
      difficulty: task.difficulty,
      rng: createRng((task.seed * 7919 + Date.now()) >>> 0),
      theme: { dept, title: task.title, stats },
      sfx: (n) => game.sfx(n),
    });
    this.phase = 'ready';
    this.t = 0;
    this.buttons = new ButtonSet();
    this.result = null;
    this.revealed = 0;
  }
  enter() {
    this.game.audio.play('minigame');
    this.game.sfx('start');
  }
  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.phase === 'ready') {
      if (this.t > 1.5 || (this.t > 0.3 && (input.confirm() || input.pointer.clicked))) {
        this.phase = 'play';
        this.t = 0;
        input.consumeKeys();
        input.consumeClick();
      }
      return;
    }
    if (this.phase === 'play') {
      if (input.back()) {
        this.phase = 'paused';
        this.buildPause();
        return;
      }
      this.inst.update(dt, input);
      if (this.inst.done) this.complete(this.inst.score);
      return;
    }
    if (this.phase === 'paused') {
      if (input.back()) {
        this.phase = 'play';
        return;
      }
      this.buttons.update(input, (n) => this.game.sfx(n));
      return;
    }
    if (this.phase === 'result') {
      const want = Math.min(this.result.stars ?? 0, Math.floor((this.t - 0.4) / 0.35) + 1);
      if (this.t > 0.4 && want > this.revealed) {
        this.revealed = want;
        this.game.sfx('star');
      }
      this.buttons.update(input, (n) => this.game.sfx(n));
    }
  }
  buildPause() {
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 90, y: H / 2 + 10, w: 85, h: 18, label: 'Keep going', onClick: () => (this.phase = 'play') });
    this.buttons.add({ x: W / 2 + 5, y: H / 2 + 10, w: 85, h: 18, label: 'Give up', color: C.bad, onClick: () => this.complete(0) });
  }
  complete(score) {
    if (this.mode === 'review') return this.completeReview(score);
    const s = this.game.state;
    const before = { level: s.level };
    this.result = S.completeTask(s, this.task, this.floor, score, this.game.now());
    this.result.score = score;
    this.result.before = before;
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.revealed = 0;
    this.game.sfx(this.result.stars > 0 ? 'good' : 'fail');
    if (this.result.levelsGained) setTimeout(() => this.game.sfx('levelup'), 900);
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 78, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  completeReview(score) {
    this.result = S.completeReview(this.game.state, score, this.game.now());
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.game.sfx(this.result.passed ? 'levelup' : 'fail');
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 62, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  renderReviewResult(g) {
    const r = this.result;
    dim(g, 0.65);
    const x = W / 2 - 130;
    const y = H / 2 - 80;
    panel(g, x, y, 260, 168, { title: r.passed ? 'REVIEW PASSED' : 'REVIEW FAILED', titleColor: r.passed ? C.goodBtn : '#7a2b2b' });
    const stamp = r.passed ? 'APPROVED' : 'NEEDS IMPROVEMENT';
    const k = Math.min(1, this.t * 4);
    drawText(g, stamp, W / 2, y + 28, { align: 'center', scale: k > 0.9 ? 2 : 1, color: r.passed ? C.good : C.bad, shadow: C.border });
    drawText(g, `Score ${Math.round(r.score * 100)}%  (pass mark ${Math.round(E.REVIEW_PASS_SCORE * 100)}%)`, W / 2, y + 54, { align: 'center', color: C.dim });
    const lines = r.passed
      ? ['HR is satisfied. Your paperwork is approved.', 'Head to the elevator for your promotion!']
      : ['HR has "concerns". Reflect on your growth.', `You can retry in ${formatTime(r.retryIn)}.`, '(Stock Options can skip the wait.)'];
    lines.forEach((l, i) => drawText(g, l, W / 2, y + 74 + i * 12, { align: 'center', color: i === 1 && r.passed ? C.good : C.text }));
    this.buttons.render(g);
  }
  finish() {
    this.game.pop();
    this.onDone?.(this.result);
  }
  render(g) {
    this.inst.render(g);
    if (this.phase === 'ready') {
      dim(g, 0.5);
      panel(g, W / 2 - 130, H / 2 - 45, 260, 90, { title: this.task.title });
      drawText(g, this.mod.name, W / 2, H / 2 - 24, { align: 'center', color: C.gold });
      const lines = wrapText(this.mod.help, 240);
      lines.slice(0, 3).forEach((l, i) => drawText(g, l, W / 2, H / 2 - 10 + i * 10, { align: 'center' }));
      const n = Math.max(1, 3 - Math.floor(this.t / 0.5));
      drawText(g, this.t > 1.4 ? 'GO!' : String(n), W / 2, H / 2 + 24, { align: 'center', scale: 2, color: C.gold, shadow: C.border });
    } else if (this.phase === 'paused') {
      dim(g, 0.6);
      panel(g, W / 2 - 110, H / 2 - 30, 220, 66, { title: 'Paused' });
      drawText(g, 'Give up? Coffee is not refunded.', W / 2, H / 2 - 10, { align: 'center' });
      this.buttons.render(g);
    } else if (this.phase === 'result') {
      if (this.mode === 'review') this.renderReviewResult(g);
      else this.renderResult(g);
    }
    drawText(g, 'Esc: pause', W - 4, H - 10, { align: 'right', color: 'rgba(255,255,255,0.4)' });
  }
  renderResult(g) {
    const r = this.result;
    const s = this.game.state;
    dim(g, 0.65);
    const x = W / 2 - 120;
    const y = H / 2 - 100;
    const titles = ['Needs improvement', 'Meets expectations', 'Exceeds expectations', 'Outstanding!'];
    panel(g, x, y, 240, 206, { title: titles[r.stars], titleColor: r.stars ? C.accent : '#7a2b2b' });
    drawStarsLarge(g, this.revealed, W / 2 - 27, y + 22);
    drawText(g, `Score ${Math.round(r.score * 100)}%`, W / 2, y + 42, { align: 'center', color: C.dim });
    let yy = y + 56;
    const line = (ic, label, val, color) => {
      icon(g, ic, x + 40, yy);
      drawText(g, label, x + 52, yy, { color: C.dim });
      drawText(g, val, x + 200, yy, { align: 'right', color });
      yy += 12;
    };
    line('sp', 'Synergy Points', `+${formatNum(r.sp)}`, C.gold);
    line('xp', 'Experience', `+${formatNum(r.xp)}`, C.xp);
    line('star', 'KPI stars', `+${r.stars}`, C.text);
    if (r.soGained) line('so', 'Stock Options', `+${r.soGained}`, C.so);
    if (r.levelsGained) {
      rect(g, x + 10, yy, 220, 12, '#3a3a10');
      drawText(g, `LEVEL UP! Seniority Lv${s.level}`, W / 2, yy + 2, { align: 'center', color: C.gold });
      yy += 14;
    }
    if (r.newBest && r.stars > 0) {
      drawText(g, 'New personal best!', W / 2, yy, { align: 'center', color: C.good });
      yy += 12;
    }
    const stars = s.starsByFloor[this.floor] || 0;
    const quota = E.starQuota(this.floor);
    drawText(g, `Floor ${this.floor} KPI: ${stars}/${quota}`, W / 2, y + 150, { align: 'center' });
    bar(g, x + 30, y + 161, 180, 7, stars / quota, stars >= quota ? C.good : C.gold);
    if (r.ceoUnlocked) drawText(g, 'The board is calling...', W / 2, y + 170, { align: 'center', color: C.gold });
    else if (stars >= quota && this.floor === s.maxFloor && this.floor < E.FLOORS) drawText(g, s.reviews?.[this.floor] ? 'Quota met! Head to the elevator.' : 'Quota met! Visit the HR office.', W / 2, y + 170, { align: 'center', color: C.good });
    this.buttons.render(g);
  }
  exit() {}
}

