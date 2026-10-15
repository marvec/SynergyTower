// Hosts one mini-game: countdown → play → results (stars, rewards, level-ups). Esc during play offers to forfeit.
import { track } from '../engine/analytics.js';
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, icon, bar, formatNum, formatTime, ButtonSet } from '../engine/ui.js';
import { drawText, wrapText } from '../engine/font.js';
import { createRng } from '../core/rng.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { completeStandup } from '../core/daily.js';
import { completeTripTask, tripLeft } from '../core/trip.js';
import { completeNightTask } from '../core/nightShift.js';
import { completeActivity, vacationLeft } from '../core/vacation.js';
import { completeTraining } from '../core/conduct.js';
import { completeChore, homeLeft, HOME } from '../core/home.js';
import { fireCareer, FiredScene } from './fired.js';
import { MINIGAMES } from '../minigames/index.js';
import { departmentForFloor, titleForFloor } from '../data/departments.js';
import { drawStarsLarge } from './overlays.js';

export class MinigameScene {
  /**
   * opts.mode: 'task' (default, rewards + KPI stars), 'review' (HR performance review: pass/fail gate) or 'standup'
   * (the daily stand-up favour: a daily bonus, no KPI stars or cooldown) or 'trip' (a client's office on a business
   * trip: double paperclips, no KPI stars) or 'vacation' (a holiday activity at the hotel: free, a coffee for 1 star or
   * more, once per stay; no paperclips, XP or KPI stars) or 'compliance' (the compliance training that ends a
   * compliance hold: pass or be demoted, see core/conduct.js) or 'night' (a station on the night shift: the usual
   * rewards, half the cooldown, tallied for the shift's summary, see core/nightShift.js) or 'home' (a chore in your
   * flat: XP and a few paperclips once per chore and stay, never KPI stars; the coffee maker pours cups instead, see
   * core/home.js). The result carries `playS`, the seconds of play (the home's presence meter drains by them).
   */
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
      quest: task.quest, // floor-quest findings (360 Feedback, Lost Password)
    });
    this.phase = 'ready';
    this.t = 0;
    this.buttons = new ButtonSet();
    this.result = null;
    this.revealed = 0;
    this.playT = 0;
  }
  /** A paused mini-game stops the timed stays' clocks too (game.update), like the menu. */
  get pausesClocks() {
    return this.phase === 'paused';
  }
  enter() {
    this.game.audio.play(this.mode === 'vacation' ? 'tropical' : this.mode === 'home' ? 'homeoffice' : 'minigame');
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
      this.playT += dt;
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
    if (this.mode === 'compliance') return this.completeCompliance(score);
    if (this.mode === 'standup') return this.completeStandup(score);
    if (this.mode === 'vacation') return this.completeVacation(score);
    if (this.mode === 'home') return this.completeHome(score);
    const s = this.game.state;
    const before = { level: s.level };
    const trip = this.mode === 'trip';
    const night = this.mode === 'night';
    const now = this.game.now();
    this.result = trip ? completeTripTask(s, this.task, score, now) : night ? completeNightTask(s, this.task, score, now) : S.completeTask(s, this.task, this.floor, score, now);
    this.result.score = score;
    track('task_played', { game: this.task.game, floor: this.floor, stars: this.result.stars, ...(trip ? { trip: true } : {}), ...(night ? { night: true } : {}) });
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
    track('review', { floor: this.floor, passed: this.result.passed });
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.game.sfx(this.result.passed ? 'levelup' : 'fail');
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 62, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  completeCompliance(score) {
    const game = this.game;
    this.result = { compliance: true, score, ...completeTraining(game.state, score) };
    track('compliance', { passed: this.result.passed, demoted: this.result.demoted, fired: this.result.fired, floor: this.result.from });
    if (this.result.fired) {
      // Fired on the ground floor: the career is over, deleted right away (no reload undoes it).
      this.firedCareer = fireCareer(game, 'training');
    } else {
      game.markDirty();
      game.saveNow();
    }
    this.phase = 'result';
    this.t = 0;
    this.game.sfx(this.result.passed ? 'levelup' : 'fail');
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 62, w: 100, h: 18, label: this.result.fired ? 'Clear my desk' : 'Continue', onClick: () => this.finish() });
  }
  renderComplianceResult(g) {
    const r = this.result;
    dim(g, 0.65);
    const x = W / 2 - 130;
    const y = H / 2 - 80;
    panel(g, x, y, 260, 168, { title: r.passed ? 'TRAINING COMPLETE' : 'TRAINING FAILED', titleColor: r.passed ? C.goodBtn : '#7a2b2b' });
    const k = Math.min(1, this.t * 4);
    drawText(g, r.passed ? 'CERTIFIED' : r.demoted ? 'DEMOTED' : "YOU'RE FIRED", W / 2, y + 28, { align: 'center', scale: k > 0.9 ? 2 : 1, color: r.passed ? C.good : C.bad, shadow: C.border });
    drawText(g, `Score ${Math.round(r.score * 100)}%  (pass mark ${Math.round(E.COMPLIANCE_PASS_SCORE * 100)}%)`, W / 2, y + 54, { align: 'center', color: C.dim });
    const lines = r.passed
      ? ['Your record is clear. The hold is lifted.', 'Colleagues who said no still mean it.']
      : r.demoted
        ? [`Back on floor ${r.to}: ${titleForFloor(r.to)}`, `Your HR review on floor ${r.to} is due again.`, 'The hold is lifted. Lesson learned, hopefully.']
        : ['There is no floor below the lobby.', 'HR has no choice: your employment is terminated.', 'This career is over.'];
    lines.forEach((l, i) => drawText(g, l, W / 2, y + 74 + i * 12, { align: 'center', color: C.text }));
    this.buttons.render(g);
  }
  completeStandup(score) {
    const s = this.game.state;
    // Null if the stand-up was already done today (another tab): show the stars, pay nothing.
    this.result = completeStandup(s, this.task.game, score, this.game.now(), Math.random, this.task.day) || { standup: true, stars: E.starsFromScore(score), none: true };
    this.result.score = score;
    track('standup', { stars: this.result.stars, streak: this.result.streak || 0, floor: s.maxFloor });
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.revealed = 0;
    this.game.sfx('good');
    if (this.result.levelsGained) setTimeout(() => this.game.sfx('levelup'), 900);
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 72, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  completeVacation(score) {
    const s = this.game.state;
    this.result = completeActivity(s, this.task.game, score);
    this.result.score = score;
    track('vacation_activity', { game: this.task.game, stars: this.result.stars });
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.revealed = 0;
    this.game.sfx(this.result.stars > 0 ? 'good' : 'fail');
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 58, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  completeHome(score) {
    const s = this.game.state;
    this.result = completeChore(s, this.task.game, score, this.game.now());
    this.result.score = score;
    track('home_chore', { game: this.task.game, stars: this.result.stars });
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.revealed = 0;
    this.game.sfx(this.result.stars > 0 ? 'good' : 'fail');
    if (this.result.levelsGained) setTimeout(() => this.game.sfx('levelup'), 900);
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 58, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  renderHomeResult(g) {
    const r = this.result;
    const s = this.game.state;
    dim(g, 0.65);
    const x = W / 2 - 120;
    const y = H / 2 - 82;
    const titles = r.brew ? ['Undrinkable', 'Drinkable', 'Good coffee', 'Barista level!'] : ['Still a mess', 'Good enough', 'Spotless', 'Domestic hero!'];
    panel(g, x, y, 240, 168, { title: titles[r.stars], titleColor: r.stars ? '#5a8a4a' : '#7a2b2b' });
    drawStarsLarge(g, this.revealed, W / 2, y + 18);
    drawText(g, `Score ${Math.round(r.score * 100)}%`, W / 2, y + 44, { align: 'center', color: C.dim });
    let yy = y + 60;
    const line = (ic, label, val, color) => {
      icon(g, ic, x + 40, yy);
      drawText(g, label, x + 52, yy, { color: C.dim });
      drawText(g, val, x + 200, yy, { align: 'right', color });
      yy += 12;
    };
    if (r.brew) {
      if (r.coffee) line('coffee', 'Coffee', `+${r.coffee}`, C.coffee);
      else drawText(g, r.stars ? 'Your mug is already full.' : 'Down the sink. Try again in a minute.', W / 2, yy, { align: 'center', color: C.warn }), (yy += 12);
      drawText(g, `The coffee maker is ready again in ${formatTime(r.cooldownS * 1000)}`, W / 2, yy + 4, { align: 'center', color: C.dim });
    } else if (r.first) {
      line('sp', 'Paperclips', `+${formatNum(r.sp)}`, C.gold);
      line('xp', 'Experience', `+${formatNum(r.xp)}`, C.xp);
      if (r.levelsGained) drawText(g, `LEVEL UP! Seniority Lv${s.level}`, W / 2, yy + 2, { align: 'center', color: C.gold });
    } else {
      drawText(g, r.stars ? 'Already done today: no pay twice.' : 'Have another go: it pays at 1 star.', W / 2, yy, { align: 'center', color: r.stars ? C.dim : C.warn });
    }
    const left = homeLeft(s, this.game.now());
    drawText(g, left > 0 ? `${formatTime(left)} left at home` : 'Time to head back!', W / 2, y + 112, { align: 'center', color: C.dim });
    if (s.home) drawText(g, `Status lapses: ${s.home.lapses}/${HOME.maxLapses}`, W / 2, y + 124, { align: 'center', color: s.home.lapses ? C.warn : C.dim });
    this.buttons.render(g);
  }
  renderVacationResult(g) {
    const r = this.result;
    const s = this.game.state;
    dim(g, 0.65);
    const x = W / 2 - 120;
    const y = H / 2 - 82;
    const titles = ['Not very relaxing', 'Nice and easy', 'Bliss', 'Pure paradise!'];
    panel(g, x, y, 240, 168, { title: titles[r.stars], titleColor: r.stars ? '#2fa39a' : '#7a2b2b' });
    drawStarsLarge(g, this.revealed, W / 2, y + 18);
    drawText(g, `Score ${Math.round(r.score * 100)}%`, W / 2, y + 44, { align: 'center', color: C.dim });
    if (r.coffee) {
      icon(g, 'coffee', W / 2 - 54, y + 62);
      drawText(g, `+${r.coffee} coffee, yours to keep`, W / 2 - 42, y + 62, { color: C.coffee });
    } else {
      const line = r.stars ? 'Already enjoyed: its coffee is in your cup.' : 'Try it again for the coffee!';
      drawText(g, line, W / 2, y + 62, { align: 'center', color: r.stars ? C.dim : C.warn });
    }
    const v = s.vacation;
    if (v) drawText(g, `Holiday so far: +${v.coffee} coffee`, W / 2, y + 86, { align: 'center' });
    const left = vacationLeft(s, this.game.now());
    drawText(g, left > 0 ? `${formatTime(left)} left at the resort` : 'Check-out time!', W / 2, y + 100, { align: 'center', color: C.dim });
    this.buttons.render(g);
  }
  renderStandupResult(g) {
    const r = this.result;
    const s = this.game.state;
    dim(g, 0.65);
    const x = W / 2 - 120;
    const y = H / 2 - 94;
    panel(g, x, y, 240, 192, { title: 'Stand-up favour done!', titleColor: C.accent });
    drawStarsLarge(g, this.revealed, W / 2, y + 18);
    drawText(g, `Score ${Math.round(r.score * 100)}%  ·  any result counts`, W / 2, y + 44, { align: 'center', color: C.dim });
    let yy = y + 58;
    const line = (ic, label, val, color) => {
      icon(g, ic, x + 40, yy);
      drawText(g, label, x + 52, yy, { color: C.dim });
      drawText(g, val, x + 200, yy, { align: 'right', color });
      yy += 12;
    };
    if (r.none) drawText(g, 'Already done today. See you tomorrow!', W / 2, yy, { align: 'center', color: C.dim });
    else {
      line('sp', 'Paperclips (x2)', `+${formatNum(r.sp)}`, C.gold);
      line('xp', 'Experience', `+${formatNum(r.xp)}`, C.xp);
      line('coffee', 'Coffee', `+${r.coffee}`, C.coffee);
      if (r.bonusSo) line('so', 'Stock Option', `+${r.bonusSo}`, C.so);
      if (r.levelsGained) {
        rect(g, x + 10, yy, 220, 12, '#3a3a10');
        drawText(g, `LEVEL UP! Seniority Lv${s.level}`, W / 2, yy + 2, { align: 'center', color: C.gold });
        yy += 14;
      }
      const toGo = E.STANDUP_STREAK_SO - (r.streak % E.STANDUP_STREAK_SO);
      drawText(g, `Stand-up streak: ${r.streak} day${r.streak === 1 ? '' : 's'}`, W / 2, yy + 8, { align: 'center', color: C.text });
      drawText(g, toGo === E.STANDUP_STREAK_SO ? 'Streak bonus paid! Come back tomorrow.' : `${toGo} more day${toGo === 1 ? '' : 's'} in a row for a sure Stock Option`, W / 2, yy + 20, { align: 'center', color: C.dim });
    }
    this.buttons.render(g);
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
    if (this.firedCareer) return this.game.set(new FiredScene(this.game, this.firedCareer));
    this.game.pop();
    if (this.result) this.result.playS = this.playT;
    this.onDone?.(this.result);
  }
  render(g) {
    this.inst.render(g);
    if (this.phase === 'ready') {
      dim(g, 0.5);
      panel(g, W / 2 - 130, H / 2 - 45, 260, 90, { title: this.task.title });
      drawText(g, this.mod.name, W / 2, H / 2 - 24, { align: 'center', color: C.gold });
      const lines = wrapText((this.task.quest && this.mod.deskHelp) || this.mod.help, 240);
      lines.slice(0, 3).forEach((l, i) => drawText(g, l, W / 2, H / 2 - 10 + i * 10, { align: 'center' }));
      const n = Math.max(1, 3 - Math.floor(this.t / 0.5));
      drawText(g, this.t > 1.4 ? 'GO!' : String(n), W / 2, H / 2 + 24, { align: 'center', scale: 2, color: C.gold, shadow: C.border });
    } else if (this.phase === 'paused') {
      dim(g, 0.6);
      panel(g, W / 2 - 110, H / 2 - 30, 220, 66, { title: 'Paused' });
      const msg = { standup: 'Give up? The favour still counts.', vacation: 'Give up? You can try again later.', compliance: this.game.state?.maxFloor > 1 ? 'Give up? That counts as failing.' : "Give up? You'll be fired." }[this.mode] || 'Give up? Coffee is not refunded.';
      drawText(g, msg, W / 2, H / 2 - 10, { align: 'center' });
      this.buttons.render(g);
    } else if (this.phase === 'result') {
      if (this.mode === 'review') this.renderReviewResult(g);
      else if (this.mode === 'compliance') this.renderComplianceResult(g);
      else if (this.mode === 'standup') this.renderStandupResult(g);
      else if (this.mode === 'vacation') this.renderVacationResult(g);
      else if (this.mode === 'home') this.renderHomeResult(g);
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
    drawStarsLarge(g, this.revealed, W / 2, y + 18);
    drawText(g, `Score ${Math.round(r.score * 100)}%`, W / 2, y + 44, { align: 'center', color: C.dim });
    let yy = y + 58;
    const line = (ic, label, val, color) => {
      icon(g, ic, x + 40, yy);
      drawText(g, label, x + 52, yy, { color: C.dim });
      drawText(g, val, x + 200, yy, { align: 'right', color });
      yy += 12;
    };
    const trip = this.mode === 'trip';
    line('sp', trip ? 'Paperclips (x2)' : 'Paperclips', `+${formatNum(r.sp)}`, C.gold);
    line('xp', 'Experience', `+${formatNum(r.xp)}`, C.xp);
    if (!trip) line('star', 'KPI stars', `+${r.stars}`, C.text);
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
    if (trip) {
      // The visit so far instead of the floor's KPI bar.
      const t = s.trip;
      if (t) drawText(g, `Client visit: ${t.tasks} task${t.tasks === 1 ? '' : 's'}, +${formatNum(t.sp)} paperclips`, W / 2, y + 141, { align: 'center' });
      drawText(g, t && tripLeft(s, this.game.now()) > 0 ? `${formatTime(tripLeft(s, this.game.now()))} left at the client` : 'Time is up at the client', W / 2, y + 155, { align: 'center', color: C.dim });
      this.buttons.render(g);
      return;
    }
    const stars = s.starsByFloor[this.floor] || 0;
    const quota = E.starQuota(this.floor);
    drawText(g, `Floor ${this.floor} KPI: ${stars}/${quota}`, W / 2, y + 141, { align: 'center' });
    bar(g, x + 30, y + 152, 180, 7, stars / quota, stars >= quota ? C.good : C.gold);
    if (r.ceoUnlocked) drawText(g, 'The board is calling...', W / 2, y + 162, { align: 'center', color: C.gold });
    else if (stars >= quota && this.floor === s.maxFloor && this.floor < E.FLOORS) drawText(g, s.reviews?.[this.floor] ? 'Quota met! Head to the elevator.' : 'Quota met! Visit the HR office.', W / 2, y + 162, { align: 'center', color: C.good });
    this.buttons.render(g);
  }
  exit() {}
}

