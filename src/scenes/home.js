// Home office (core/home.js): a FloorScene on your flat (buildHome) with a 10-minute wall clock. Chores are mini-games
// (MinigameScene mode 'home'), the coffee maker pours your own cups, and the computer's presence meter must not run
// dry: it drains on the stay's play time (walking about here, plus each chore's play time when it ends). The boss calls
// once or twice; three lapses and you are called back in. The front door goes back to the office at any time.
import { W, H } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatTime } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { isTouch } from '../engine/platform.js';
import * as HO from '../core/home.js';
import * as S from '../core/state.js';
import { CHORES, LAPSE_LINES, SENT_BACK, CALL_RING, CALL_ANSWERED, CALL_MISSED, HOME_LEAVE } from '../data/home.js';
import { FloorScene } from './floorScene.js';
import { MinigameScene } from './minigameScene.js';
import { Dialog } from './overlays.js';

const HOME_COLOR = '#f2a65a';

export class HomeScene extends FloorScene {
  constructor(game) {
    const s = game.state;
    super(game, s.home?.floor ?? s.floor, { arrival: 'entrance', fl: HO.buildHome() });
    this.taskMode = 'home';
    this.leaving = false;
    const e = this.fl.entrance;
    this.exitItem = { x: e.x, y: e.y, w: e.w, h: 1 };
    this.player.dir = 'up';
    // Home clothes: a comfy hoodie and joggers, no badge.
    this.player.setLook({ ...this.player.look, jacket: null, tie: null, badge: false, shirt: '#5a7ab8', pants: '#6a6e78', shoes: '#e8e6e0', ...(this.player.look.skirt ? { skirt: '#6a6e78', tights: null } : {}) });
    this.hud.floorLabel = 'Home';
    this.lapseMemo = {};
  }

  get music() {
    return 'homeoffice';
  }

  enter() {
    const game = this.game;
    game.state.floor = this.floorNo;
    game.audio.play(this.music);
    this.banner = 4;
    game.toast(`Working from home: ${formatTime(HO.homeLeft(game.state, game.now()))}. Keep your status green at the computer!`, HOME_COLOR);
  }

  resume() {
    this.game.audio.play(this.music);
  }

  interactables() {
    return [...super.interactables(), { kind: 'computer', it: this.fl.computer }, ...this.fl.chores.map((it) => ({ kind: 'chore', it })), { kind: 'exit', it: this.exitItem }];
  }

  interact(t) {
    if (!['exit', 'chore', 'computer'].includes(t.kind)) return super.interact(t);
    this.pending = null;
    this.player.path = null;
    const it = t.it;
    const p = this.player;
    if (t.kind === 'exit') return this.askLeave();
    p.faceTowards(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y);
    if (t.kind === 'computer') return this.useComputer();
    this.openChore(it.chore);
  }

  /** At the computer: the presence meter is full again; a ringing call is answered (camera on!). */
  useComputer() {
    const game = this.game;
    const r = HO.pokeComputer(game.state);
    game.markDirty();
    if (r.answered) {
      game.sfx('good');
      track('home_call', { answered: true });
      this.player.say(this.rng.pick(CALL_ANSWERED), 4);
    } else {
      game.sfx('type');
      this.player.say('Wiggle the mouse. Still online!', 2);
    }
  }

  /** The chore card: what it is and what it pays; a ringing call comes first. */
  openChore(task) {
    const game = this.game;
    const s = game.state;
    if (HO.ringingCall(s)) {
      game.sfx('bad');
      return game.toast('The boss is calling! Get to the computer first.', C.warn);
    }
    const c = CHORES.find((v) => v.game === task.game);
    const brew = task.game === 'brew';
    const done = HO.choreDone(s, task.game);
    const left = brew ? S.cooldownLeft(s, HO.BREW_KEY, game.now()) : 0;
    const pays = brew
      ? left > 0
        ? `Still warm from the last pot: ready again in ${formatTime(left)}.`
        : `Free: up to ${HO.HOME.brewCoffee} cups of coffee (never past your mug's maximum). The better the brew, the sooner the next one.`
      : done
        ? 'Done today: play again just for fun (it still costs a cup).'
        : `Costs ${HO.HOME.choreCoffee} coffee. 1 star or more pays XP and a few paperclips, once today. No KPI stars at home.`;
    game.sfx('click');
    game.push(
      new Dialog(game, {
        title: `${c.where} · ${c.title}`,
        w: 300,
        text: `${c.blurb}\n${pays}`,
        button: 'Later',
        action: { label: brew ? 'Brew' : done ? 'Again, for fun' : "Let's do it", disabled: left > 0, onClick: () => this.startChore(task) },
      }),
    );
  }

  startChore(task) {
    const game = this.game;
    const s = game.state;
    if (!HO.homeActive(s, game.now())) return this.finish('done');
    const r = HO.startChore(s, task.game, game.now());
    if (!r.ok) {
      game.sfx('bad');
      const msg = { coffee: `Out of coffee: brew some in the kitchen first.`, full: 'Your mug is full. Drink some first.', cooldown: `The coffee maker needs ${formatTime(r.left)}.` }[r.reason];
      return game.toast(msg, C.warn);
    }
    game.markDirty();
    game.push(new MinigameScene(game, task, (result) => this.choreDone(result), { mode: 'home' }));
  }

  /** Back from a chore: its play time drains the presence meter (and may bring a call). */
  choreDone(result) {
    if (!result || this.leaving) return;
    this.handle(HO.tickHome(this.game.state, result.playS || 0, { away: true }), true);
  }

  /** Lapses, calls ringing and calls missed, as they happen. */
  handle(events, away = false) {
    const game = this.game;
    for (const e of events) {
      if (e.type === 'lapse') {
        game.sfx('bad');
        game.toast(away ? `While you were busy, your status went Away. ${this.lapseLine()}` : this.lapseLine(), C.warn);
      } else if (e.type === 'ring') {
        game.sfx('ding');
        game.toast(CALL_RING, C.gold);
      } else if (e.type === 'missed') {
        game.sfx('fail');
        track('home_call', { answered: false });
        game.toast(CALL_MISSED, C.warn);
      }
    }
    if (events.length) game.markDirty();
  }

  lapseLine() {
    const s = this.game.state;
    return `${this.rng.pick(LAPSE_LINES)} (${s.home?.lapses || 0}/${HO.HOME.maxLapses})`;
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    if (this.leaving || game.top !== this) return;
    const s = game.state;
    if (!HO.homeActive(s, game.now())) return this.finish('done');
    this.handle(HO.tickHome(s, dt));
    if (HO.sentBack(s)) return this.finish('sent_back');
    if (game.input.down('ArrowDown') && this.atDoor()) this.askLeave();
  }

  /** Walking down into the front door (its doorway is solid, so the player stops right above it). */
  atDoor() {
    const e = this.fl.entrance;
    const p = this.player;
    return p.x > e.x && p.x < e.x + e.w && p.y > e.y - 0.5;
  }

  askLeave() {
    const game = this.game;
    if (this.leaving || game.top !== this) return;
    game.sfx('click');
    game.push(
      new Dialog(game, {
        title: 'Back to the office?',
        w: 300,
        text: HOME_LEAVE(formatTime(HO.homeLeft(game.state, game.now()))),
        button: 'Stay home',
        action: { label: 'Back to the office', onClick: () => this.finish('early') },
      }),
    );
  }

  /** The day is over: back on the office floor with the summary card (three lapses: the boss's message first). */
  finish(result) {
    if (this.leaving) return;
    this.leaving = true;
    const game = this.game;
    const floor = this.floorNo;
    const sum = HO.endHome(game.state, result) || { floor, result, chores: 0, lapses: 0, maxLapses: HO.HOME.maxLapses, calls: 0, answered: 0, coffee: 0, cleared: false };
    track('home_end', { floor, result: sum.result, lapses: sum.lapses, chores: sum.chores });
    game.saveNow();
    const back = () => game.set(new FloorScene(game, floor, { arrival: 'elevator', homeSummary: sum }));
    if (sum.result !== 'sent_back') {
      game.sfx(result === 'early' ? 'door' : 'ding');
      return back();
    }
    game.sfx('fail');
    game.push(new Dialog(game, { title: 'Teams · Your boss', w: 300, text: SENT_BACK, button: 'On my way', onClose: back }));
  }

  /** Chore markers (a cup to spend, a tick once done, the coffee maker's clock), the presence chart, the EXIT sign. */
  drawMarkers(g, s, now) {
    super.drawMarkers(g, s, now);
    this.drawExitSign(g);
    this.drawPresence(g, s);
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    for (const it of this.fl.chores) {
      const game = it.chore.game;
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const top = this.view.itemTop(it);
      if (game === 'brew') {
        const left = S.cooldownLeft(s, HO.BREW_KEY, now);
        if (left > 0) {
          const t = formatTime(left);
          const w = measureText(t) + 12;
          rect(g, cx - w / 2, top - 13, w, 10, 'rgba(13,15,24,0.75)');
          icon(g, 'clock', cx - w / 2 + 1, top - 12);
          drawText(g, t, cx - w / 2 + 10, top - 12, { color: C.dim });
          continue;
        }
      }
      const done = game !== 'brew' && HO.choreDone(s, game);
      const y = top - 16 + bob;
      rect(g, cx - 6, y, 13, 12, C.border);
      rect(g, cx - 5, y + 1, 11, 10, done ? C.goodBtn : game === 'brew' ? '#f6dfb8' : '#fbf8ef');
      rect(g, cx - 1, y + 12, 3, 2, C.border);
      icon(g, done ? 'check' : game === 'brew' ? 'coffee' : 'xp', cx - 3, y + 3);
    }
  }

  /** The bar chart over the computer: the presence meter, green to red; a ringing call flashes over it. */
  drawPresence(g, s) {
    const h = s.home;
    const it = this.fl.computer;
    if (!h || !it) return;
    const cx = Math.round((it.x + it.w / 2) * TILE);
    const y = this.view.itemTop(it) - 18;
    const f = Math.max(0, h.presence / HO.HOME.presenceS);
    const col = f > 0.5 ? C.good : f > 0.2 ? C.warn : C.bad;
    rect(g, cx - 14, y, 28, 14, C.border);
    rect(g, cx - 13, y + 1, 26, 12, '#1a1d28');
    const bars = 5;
    for (let i = 0; i < bars; i++) {
      const on = f > i / bars;
      const bh = 3 + i * 2;
      rect(g, cx - 11 + i * 5, y + 12 - bh, 4, bh, on ? col : '#3a3d48');
    }
    if (HO.ringingCall(s) && Math.floor(this.time * 4) % 2) {
      const label = 'CALL!';
      const w = measureText(label) + 6;
      rect(g, cx - w / 2, y - 12, w, 10, C.border);
      rect(g, cx - w / 2 + 1, y - 11, w - 2, 8, C.bad);
      drawText(g, label, cx, y - 11, { align: 'center', color: C.text });
    }
  }

  /** A green EXIT sign over the front door (the bottom wall). */
  drawExitSign(g) {
    const e = this.fl.entrance;
    const x = Math.round((e.x + e.w / 2) * TILE);
    const y = e.y * TILE - 12;
    const w = measureText('EXIT') + 6;
    rect(g, x - w / 2, y, w, 10, C.border);
    rect(g, x - w / 2 + 1, y + 1, w - 2, 8, C.goodBtn);
    drawText(g, 'EXIT', x, y + 1, { align: 'center', color: C.text });
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!['chore', 'computer', 'exit'].includes(t?.kind)) return super.drawPrompt(g, s, now);
    let text;
    let sub;
    if (t.kind === 'computer') {
      text = 'Computer';
      sub = HO.ringingCall(s) ? 'answer the call!' : 'stay online';
    } else if (t.kind === 'exit') {
      text = 'Front door';
      sub = 'back to the office';
    } else {
      const c = t.it.chore;
      text = c.title;
      const left = c.game === 'brew' ? S.cooldownLeft(s, HO.BREW_KEY, now) : 0;
      sub = c.game === 'brew' ? (left > 0 ? `ready in ${formatTime(left)}` : `+${HO.HOME.brewCoffee} coffee`) : HO.choreDone(s, c.game) ? 'done, play for fun' : `${HO.HOME.choreCoffee} coffee`;
    }
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, isTouch() ? 'TAP' : 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
  }

  /** The day's clock under the HUD: time left and the status lapses so far. */
  drawTimer(g, y) {
    const s = this.game.state;
    const lapses = s.home?.lapses || 0;
    this.drawClockPanel(g, y, {
      name: 'HOME OFFICE', color: HOME_COLOR, left: HO.homeLeft(s, this.game.now()), total: HO.HOME.stayS * 1000,
      info: `away ${lapses}/${HO.HOME.maxLapses}`, infoColor: lapses ? C.warn : C.dim,
    });
    return true;
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 4 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, HOME_COLOR);
    rect(g, 0, y + 33, W, 1, HOME_COLOR);
    drawText(g, 'HOME OFFICE', W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `${HO.HOME.stayS / 60} minutes · chores and coffee · keep your status green`, W / 2, y + 23, { align: 'center', color: HOME_COLOR });
    g.globalAlpha = 1;
  }
}
