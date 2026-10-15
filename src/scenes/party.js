// The Christmas party (core/party.js): a FloorScene in the party hall (core/partyHall.js) with a 10-minute wall clock. The
// CEO's speech on arrival (confetti!), guests who are colleagues you know (six dancing), the bar, five free activities
// (MinigameScene mode 'party'), disco lights. Tipsy, the view sways; the elevator doors at the top go back to the office.
import { W, H } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatTime, formatNum } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { isTouch, reducedMotion } from '../engine/platform.js';
import { createRng } from '../core/rng.js';
import * as PA from '../core/party.js';
import { buildPartyHall, partyGuests } from '../core/partyHall.js';
import { SONGS } from '../data/music.js';
import { PARTY_ACTIVITIES, PARTY_LINES, TIPSY_LINES, HR_WATCH_LINES, CEO_SPEECH, CEO_SPEECH_YOU, PARTY_LEAVE, FIRED_JOKE } from '../data/party.js';
import { FloorScene } from './floorScene.js';
import { NpcBrain } from './floorWorld.js';
import { MinigameScene } from './minigameScene.js';
import { Dialog } from './overlays.js';
import { PartyBar } from './partyBar.js';
import { partyLighting, moveDisco, discoBall } from './partyLights.js';
import { drawNight } from './nightLights.js';
import { Confetti } from './confetti.js';

const PARTY_RED = '#d8343a';
const BARTENDER_SEED = 2412;
const BEAT = 60 / SONGS.xmasparty.bpm;
const TURNS = ['down', 'left', 'down', 'right'];

/** The CEO's speech on arrival: the hall's confetti keeps flying, over the dialog (the hall waits underneath). */
class SpeechDialog extends Dialog {
  constructor(game, confetti, opts) {
    super(game, opts);
    this.confetti = confetti;
  }
  update(dt) {
    this.confetti.update(dt);
    super.update(dt);
  }
  render(g) {
    super.render(g);
    this.confetti.render(g);
  }
}

/** A guest on the dance floor: stays put, bounces on every beat, turns now and then. */
export class DanceBrain extends NpcBrain {
  constructor(actor, fl, seed) {
    super(actor, fl, seed);
    this.beatT = this.rng.float(0, BEAT);
  }
  update(dt) {
    if (this.talkPause > 0) this.talkPause -= dt;
    this.beatT += dt;
    const k = this.beatT / BEAT;
    this.a.moving = false;
    this.a.hop = Math.abs(Math.sin(k * Math.PI)) * 3;
    this.a.dir = TURNS[Math.floor(k / 2) % TURNS.length];
  }
}

export class PartyScene extends FloorScene {
  constructor(game) {
    const s = game.state;
    const year = s.party?.year ?? new Date(game.now()).getFullYear();
    const fl = { ...buildPartyHall(), npcs: partyGuests(s, year) };
    super(game, s.party?.floor ?? s.floor, { arrival: 'entrance', fl });
    this.taskMode = 'party';
    this.view.setNight(true); // an evening do: dark outside the windows
    this.leaving = false;
    this.year = year;
    const e = this.fl.entrance;
    this.exitItem = { x: e.x, y: e.y, w: e.w, h: 1 };
    this.player.dir = 'down';
    this.player.setLook({ ...this.player.look, hat: 'santa' });
    // Santa hats for about 60% of the guests; the dancers dance.
    const rng = createRng(year * 31 + 7);
    const dancers = new Set(fl.npcs.filter((n) => n.dancer).map((n) => n.seed));
    for (const n of this.npcs) {
      if (rng.chance(0.6)) n.a.setLook({ ...n.a.look, hat: 'santa' });
      if (dancers.has(n.seed)) n.brain = new DanceBrain(n.a, this.fl, n.seed);
    }
    if (this.hrRep) this.hrRep.who.role = 'HR, watching';
    this.hud.floorLabel = 'Party';
    this.confetti = new Confetti();
    this.hrT = 12;
    this.puffT = 8;
  }

  /** Behind the bar: the bartender (not the receptionist). */
  frontDesk() {
    return { seed: BARTENDER_SEED, uniform: '#1a1a22', role: 'Bartender' };
  }

  get music() {
    return 'xmasparty';
  }

  enter() {
    const game = this.game;
    const s = game.state;
    s.floor = this.floorNo;
    game.audio.play(this.music);
    this.banner = 4;
    // Arrival: two confetti cannons at the bottom corners, fanned up over the hall (and over the speech).
    this.confetti.burst(Math.round(W * 0.08), H - 8, 45, 0.6, 0.45);
    this.confetti.burst(Math.round(W * 0.92), H - 8, 45, 0.6, -0.45);
    const fired = Object.keys(s.fired || {}).length;
    game.toast(fired ? FIRED_JOKE(fired) : `The ${s.corp.name} Christmas party! ${formatTime(PA.partyLeft(s, game.now()))} of fun.`, PARTY_RED);
    if (s.party && !s.party.speech) {
      s.party.speech = true;
      game.markDirty();
      const you = !!s.flags.ceo;
      game.push(new SpeechDialog(game, this.confetti, { title: you ? 'Your speech' : 'The CEO\'s speech', w: 330, text: (you ? CEO_SPEECH_YOU : CEO_SPEECH)(s.corp.name), button: 'Cheers!', onClose: () => this.cheers() }));
    }
  }

  resume() {
    this.game.audio.play(this.music);
  }

  /** The confetti cannon: a big burst and a flash of light. */
  cheers() {
    this.game.sfx('levelup');
    this.confetti.burst(W / 2, H - 40, 120, 1.2);
    this.lighting?.flash?.(0.6, 0.8);
  }

  interactables() {
    return [...super.interactables(), ...this.fl.activities.map((it) => ({ kind: 'activity', it })), { kind: 'bar', it: this.fl.bar }, { kind: 'exit', it: this.exitItem }];
  }

  interact(t) {
    if (!['activity', 'bar', 'exit'].includes(t.kind)) return super.interact(t);
    this.pending = null;
    this.player.path = null;
    const p = this.player;
    if (t.kind === 'exit') return this.askLeave();
    p.faceTowards(t.it.x + t.it.w / 2 - p.x, t.it.y + t.it.h / 2 - p.y);
    if (t.kind === 'bar') {
      this.game.sfx('click');
      return this.game.push(new PartyBar(this.game, { bartender: this.receptionist }));
    }
    this.openActivity(t.it.activity);
  }

  /** Guests talk party; while you are tipsy, they talk about you. */
  nextLine() {
    return this.rng.pick(PA.tipsyLevel(this.game.state) ? TIPSY_LINES : PARTY_LINES);
  }

  openActivity(task) {
    const game = this.game;
    const s = game.state;
    const a = PARTY_ACTIVITIES.find((v) => v.game === task.game);
    const done = PA.activityDone(s, task.game);
    const pays = done ? 'Done tonight: play again just for fun.' : `Free. 1 star or more pays ${formatNum(PA.activityPay(s))} paperclips, once tonight.`;
    game.sfx('click');
    game.push(
      new Dialog(game, {
        title: `${a.where} · ${a.title}`,
        w: 300,
        text: `${a.blurb}\n${pays}`,
        button: 'Later',
        action: { label: done ? 'Again, for fun' : "Let's go", color: PARTY_RED, onClick: () => this.startActivity(task) },
      }),
    );
  }

  startActivity(task) {
    const game = this.game;
    if (!PA.partyActive(game.state, game.now())) return this.finish('done');
    game.push(new MinigameScene(game, task, (result) => this.activityDone(result), { mode: 'party' }));
  }

  /** Back from an activity: its play time counts towards sobering up; a star or more, confetti. */
  activityDone(result) {
    if (!result || this.leaving) return;
    PA.tickParty(this.game.state, result.playS || 0);
    if (result.stars > 0) this.confetti.burst(W / 2, H / 2, 50);
    if (result.gift) this.game.toast('Secret Santa brought you a little Christmas tree for your desk!', C.good);
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    this.confetti.update(dt);
    if (this.leaving || game.top !== this) return;
    const s = game.state;
    if (!PA.partyActive(s, game.now())) return this.finish('done');
    PA.tickParty(s, dt);
    if (game.input.down('ArrowUp') && this.atDoor()) this.askLeave();
    // Now and then: a puff of confetti over the dance floor, and a word from HR by the bar.
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = this.rng.float(6, 12);
      const d = this.fl.disco;
      this.confetti.burst(Math.round(d.x * TILE - this.cam.x), Math.round(d.y * TILE - this.cam.y), 25, 0.6);
    }
    this.hrT -= dt;
    if (this.hrT <= 0 && this.hrRep) {
      this.hrT = this.rng.float(18, 30);
      this.hrRep.say(this.rng.pick(HR_WATCH_LINES), 4);
    }
  }

  /** Walking up into the elevator doors (the top wall). */
  atDoor() {
    const e = this.fl.entrance;
    const p = this.player;
    return p.x > e.x && p.x < e.x + e.w && p.y < e.y + 1.7;
  }

  askLeave() {
    const game = this.game;
    if (this.leaving || game.top !== this) return;
    game.sfx('click');
    game.push(new Dialog(game, { title: 'Leave the party?', w: 300, text: PARTY_LEAVE(formatTime(PA.partyLeft(game.state, game.now()))), button: 'Stay', action: { label: 'Leave', onClick: () => this.finish('early') } }));
  }

  /** The party is over: back on the floor it started from, with the summary card. */
  finish(result) {
    if (this.leaving) return;
    this.leaving = true;
    const game = this.game;
    const floor = this.floorNo;
    const sum = PA.endParty(game.state, result) || { floor, year: this.year, result, activities: 0, total: PA.ACTIVITY_GAMES.length, sp: 0, drinks: 0, gift: null };
    track('party_end', { result: sum.result, activities: sum.activities, sp: sum.sp, drinks: sum.drinks });
    game.saveNow();
    game.sfx(result === 'early' ? 'door' : 'ding');
    game.set(new FloorScene(game, floor, { arrival: 'elevator', partySummary: sum }));
  }

  /** Tipsy, the world sways (the HUD does not): the camera moves for this frame only. */
  render(g) {
    const t = PA.tipsyLevel(this.game.state);
    const o = t && !reducedMotion() ? PA.sway(t, this.time) : { x: 0, y: 0 };
    this.cam.x += o.x;
    this.cam.y += o.y;
    super.render(g);
    this.cam.x -= o.x;
    this.cam.y -= o.y;
    if (!(this.game.top instanceof SpeechDialog)) this.confetti.render(g); // during the speech it flies over the dialog
  }

  /** The lights (under markers and the HUD): disco spots, then the disco ball over them; tipsy at 3, a double image. */
  drawDark(g) {
    this.lighting ||= partyLighting(this.fl);
    moveDisco(this.lighting, this.fl.disco, this.time);
    drawNight(g, this.lighting, { fade: 1, cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y) }, player: this.player, t: this.time });
    this.drawNightGlass(g);
    this.drawDiscoBall(g);
    if (PA.tipsyLevel(this.game.state) >= 3) {
      g.save();
      g.globalAlpha = 0.2;
      g.drawImage(g.canvas, 2, 1);
      g.restore();
    }
  }

  drawDiscoBall(g) {
    const b = discoBall(this.fl);
    const cx = b.x - Math.round(this.cam.x);
    const cy = b.ballY - Math.round(this.cam.y);
    const top = b.top - Math.round(this.cam.y);
    // A short string, fading up into the dark above.
    for (let y = top; y < cy - 6; y++) {
      g.globalAlpha = Math.min(1, (y - top + 1) / 8);
      rect(g, cx, y, 1, 1, '#9aa1ad');
    }
    g.globalAlpha = 1;
    const spin = Math.floor(this.time * 8);
    for (let y = -6; y <= 6; y += 2)
      for (let x = -6; x <= 6; x += 2) {
        if (x * x + y * y > 40) continue;
        const lit = ((((x + y) / 2 + spin) % 3) + 3) % 3 === 0;
        rect(g, cx + x, cy + y, 2, 2, lit ? '#ffffff' : '#8a90a0');
      }
    if (spin % 2) rect(g, cx + 5, cy - 5, 1, 1, '#fffbe0');
  }

  /** Activity markers (a gift to open, a tick once done) and the EXIT sign over the elevator doors. */
  drawMarkers(g, s, now) {
    super.drawMarkers(g, s, now);
    const e = this.fl.entrance;
    const ex = Math.round((e.x + e.w / 2) * TILE);
    const w = measureText('EXIT') + 6;
    rect(g, ex - w / 2, e.y * TILE + 2, w, 10, C.border);
    rect(g, ex - w / 2 + 1, e.y * TILE + 3, w - 2, 8, C.goodBtn);
    drawText(g, 'EXIT', ex, e.y * TILE + 3, { align: 'center', color: C.text });
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    for (const it of this.fl.activities) {
      const done = PA.activityDone(s, it.activity.game);
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const y = this.view.itemTop(it) - 16 + bob;
      rect(g, cx - 6, y, 13, 12, C.border);
      rect(g, cx - 5, y + 1, 11, 10, done ? C.goodBtn : PARTY_RED);
      rect(g, cx - 1, y + 12, 3, 2, C.border);
      icon(g, done ? 'check' : 'star', cx - 3, y + 3);
    }
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!['activity', 'bar', 'exit'].includes(t?.kind)) return super.drawPrompt(g, s, now);
    const a = t.kind === 'activity' ? PARTY_ACTIVITIES.find((v) => v.game === t.it.activity.game) : null;
    const text = a ? a.title : t.kind === 'bar' ? 'Bar' : 'Elevator';
    const sub = a ? (PA.activityDone(s, a.game) ? 'done, play for fun' : 'free') : t.kind === 'bar' ? 'free drinks' : 'leave the party';
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, isTouch() ? 'TAP' : 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
  }

  drawTimer(g, y) {
    const s = this.game.state;
    const done = PA.ACTIVITY_GAMES.filter((k) => PA.activityDone(s, k)).length;
    this.drawClockPanel(g, y, { name: 'CHRISTMAS PARTY', color: PARTY_RED, left: PA.partyLeft(s, this.game.now()), total: PA.PARTY.stayS * 1000, info: `${done}/${PA.ACTIVITY_GAMES.length} done`, infoColor: C.dim });
    return true;
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 4 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, PARTY_RED);
    rect(g, 0, y + 33, W, 1, PARTY_RED);
    drawText(g, 'CHRISTMAS PARTY', W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `${PA.PARTY.stayS / 60} minutes · dance, sing, eat and wrap a gift`, W / 2, y + 23, { align: 'center', color: '#f29cd0' });
    g.globalAlpha = 1;
  }
}
