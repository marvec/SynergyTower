// The roof (core/roof.js): a FloorScene on buildRoof(), reached up the fire escape from floors 2, 12, 22 and 32. The sky
// follows the local time (day, sunset, night with the city lit and a few roof lamps); smokers from the floor below stand
// by the bench (a cigarette is the `cigarette` mini-game, MinigameScene mode 'roof'), the pay telescope looks over the
// city, the window cleaners' cradle rides down the facade, and now and then the facilities guard comes out of the roof
// door: in his sight for a moment and you are walked down the stairs, the window shut for the day.
import { W, H } from '../engine/screen.js';
import { TILE, CHAR_W, CHAR_H } from '../engine/art.js';
import { C, rect, panel, frame, formatNum, formatTime } from '../engine/ui.js';
import { drawText, drawWrapped, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { isTouch } from '../engine/platform.js';
import { findPath } from '../core/pathfind.js';
import * as RF from '../core/roof.js';
import * as S from '../core/state.js';
import * as PA from '../core/party.js';
import { buildFloor } from '../core/tasks.js';
import { departmentForFloor } from '../data/departments.js';
import * as T from '../data/roof.js';
import { FloorScene } from './floorScene.js';
import { Actor, NpcBrain, npcLook, npcIdentity, suit } from './floorWorld.js';
import { MinigameScene } from './minigameScene.js';
import { Dialog, Modal } from './overlays.js';
import { darkLighting, lampsAt, drawNight } from './nightLights.js';
import { drawSky, drawSkyline } from './cityscape.js';
import { HUD_H } from './hud.js';

const ROOF_COLOR = '#9fd3f0';
const GUARD_SEED = 9090;
const PARAPET_TOP = -12; // world y of the top parapet's upper edge: the sky shows above it
const NIGHT_AMBIENT = 0.42; // the city glow: lighter than the night shift's office

/** A smoker by the bench: stays put, faces the group, talks now and then (scenes/roof.js chatter). */
export class SmokerBrain extends NpcBrain {
  constructor(actor, fl, seed, face) {
    super(actor, fl, seed);
    this.face = face;
  }
  update(dt) {
    if (this.talkPause > 0) this.talkPause -= dt;
    this.a.moving = false;
    if (this.talkPause <= 0) this.a.dir = this.face;
  }
}

/** The smokers' card: small talk, a cigarette, no thanks, bye. */
export class SmokersCard extends Modal {
  constructor(game, { npc, line, floor, onTalk, onSmoke, onDecline }) {
    super(game, { w: 310, h: 162, title: 'Smoke Break' });
    this.npc = npc;
    this.line = line;
    this.floor = floor;
    this.onTalk = onTalk;
    this.onSmoke = onSmoke;
    this.onDecline = onDecline;
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    b.add({ x: this.x + 8, y: by, w: 78, h: 18, label: 'Small talk', hotkey: 't', onClick: () => (this.line = this.onTalk()) });
    b.add({ x: this.x + 90, y: by, w: 82, h: 18, label: 'Take one (C)', hotkey: 'c', color: '#8a5a3a', onClick: () => (this.close(), this.onSmoke()) });
    b.add({ x: this.x + 176, y: by, w: 74, h: 18, label: 'No thanks', hotkey: 'n', color: '#2f6f5f', onClick: () => (this.line = this.onDecline()) });
    b.add({ x: this.x + this.w - 54, y: by, w: 46, h: 18, label: 'Bye', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const { a, id } = this.npc;
    rect(g, x + 10, y + 8, 40, 52, C.panelDark);
    frame(g, x + 10, y + 8, 40, 52, C.border);
    g.drawImage(a.sheet, 0, 0, CHAR_W, CHAR_H, x + 14, y + 12, CHAR_W * 2, CHAR_H * 2);
    rect(g, x + 38, y + 40, 6, 2, '#f4f1e8');
    rect(g, x + 44, y + 40, 2, 2, '#e8743a');
    const tx = x + 60;
    drawText(g, id.name, tx, y + 8, { color: C.gold });
    drawText(g, id.role, tx, y + 19, { color: C.text });
    drawText(g, `${departmentForFloor(this.floor).name} · floor ${this.floor}`, tx, y + 30, { color: C.dim });
    drawText(g, 'On a smoke break. Officially: "a quick sync".', tx, y + 41, { color: C.dim });
    drawWrapped(g, `"${this.line}"`, x + 10, y + 68, this.w - 20, { color: C.so });
  }
}

export class RoofScene extends FloorScene {
  /** from: the roof floor whose fire-escape window the player came up through (and goes back down to). */
  constructor(game, from) {
    const s = game.state;
    const fl = { ...RF.buildRoof(), npcs: RF.smokersFor(s, from) };
    super(game, from, { arrival: 'elevator', fl });
    this.from = from;
    this.over = false;
    this.player.x = fl.arrive.x;
    this.player.y = fl.arrive.y;
    this.player.dir = 'down';
    this.hud.floorLabel = 'Roof';
    this.mode = RF.skyMode(game.now());
    // The smokers stand round the bench, facing the middle of the group.
    const mid = fl.smokeSpots.reduce((m, p) => ({ x: m.x + p.x / fl.smokeSpots.length, y: m.y + p.y / fl.smokeSpots.length }), { x: 0, y: 0 });
    for (const n of this.npcs) {
      const dx = mid.x - n.a.x;
      const dy = mid.y - n.a.y;
      const face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      n.brain = new SmokerBrain(n.a, this.fl, n.seed, face);
      n.a.dir = face;
      n.puffT = this.rng.float(0.5, 4);
    }
    this.puffs = [];
    this.bees = [];
    this.chatterT = 3;
    this.chatterMemo = {};
    this.talkMemos = new Map();
    this.declined = false; // said "No thanks" this visit: small talk may bring the archive tip
    this.guard = null;
    this.guardT = this.rng.float(...RF.ROOF.guardEveryS);
    this.sky = null; // 'day' | 'dusk' | 'night' to override the local time (__roof('night') and friends, dev only)
    this.camera();
  }

  /** Recentres on the arrival spot (the constructor placed the player after FloorScene snapped the camera). */
  camera() {
    this.snapCamera();
  }

  get music() {
    return 'rooftop';
  }

  enter() {
    const game = this.game;
    game.state.floor = this.floorNo;
    game.audio.play(this.music);
    game.saveNow();
    this.banner = 3.5;
    track('roof_enter', { floor: this.from });
    if (this.mode === 'night') game.toast('The city at night. Mind your step.', ROOF_COLOR);
  }

  resume() {
    this.game.audio.play(this.music);
  }

  /** The sky above the parapet: near the top the camera looks up a little more, to show it. */
  camTarget() {
    const t = super.camTarget();
    const p = this.player;
    t.y = Math.max(-HUD_H - 140, Math.min(this.fl.h * TILE - H + 24, p.y * TILE - H / 2 - 6 - Math.max(0, 8 - p.y) * 6));
    return t;
  }

  interactables() {
    const fl = this.fl;
    return [...super.interactables(), { kind: 'ladder', it: fl.ladder }, { kind: 'telescope', it: fl.telescope }, { kind: 'cradle', it: fl.cradle }];
  }

  interact(t) {
    if (this.over) return;
    if (!['ladder', 'telescope', 'cradle', 'npc'].includes(t.kind)) return super.interact(t);
    const game = this.game;
    const p = this.player;
    this.pending = null;
    p.path = null;
    if (t.kind === 'npc') return this.talkTo(t.n);
    p.faceTowards(t.it.x + t.it.w / 2 - p.x, t.it.y + t.it.h / 2 - p.y);
    game.sfx('click');
    if (t.kind === 'ladder') {
      return game.push(new Dialog(game, { title: T.LADDER_TITLE, w: 260, text: T.LADDER_TEXT(this.from), button: 'Stay', action: { label: 'Climb down', onClick: () => this.climbDown() } }));
    }
    if (t.kind === 'cradle') {
      return game.push(new Dialog(game, { title: T.CRADLE_TITLE, w: 300, text: T.CRADLE_TEXT(this.from), button: 'Not now', action: { label: T.CRADLE_GO, color: '#b08a18', onClick: () => this.rideCradle() } }));
    }
    this.useTelescope();
  }

  // ------------------------------------------------------------ the smokers
  talkLine(list) {
    if (!this.talkMemos.has(list)) this.talkMemos.set(list, {});
    return this.pickFrom(list, this.talkMemos.get(list));
  }
  pickFrom(list, memo) {
    const bag = (memo.bag ||= []);
    if (!bag.length) bag.push(...this.rng.shuffle(list.map((_, i) => i)));
    return list[bag.pop()];
  }

  talkTo(n) {
    const game = this.game;
    n.brain.talkPause = 8;
    n.a.faceTowards(this.player.x - n.a.x, this.player.y - n.a.y);
    this.player.faceTowards(n.a.x - this.player.x, n.a.y - this.player.y);
    const line = this.talkLine(T.SMOKER_GREETINGS);
    n.a.say(line, 3);
    game.sfx('blip');
    game.push(
      new SmokersCard(game, {
        npc: n,
        line,
        floor: this.from,
        onTalk: () => this.smallTalk(n),
        onSmoke: () => this.smoke(n),
        onDecline: () => this.decline(n),
      }),
    );
  }

  /** Small talk: after a "No thanks", the archive tip if there is one; otherwise office gossip, some of it true. */
  smallTalk(n) {
    n.brain.talkPause = 8;
    this.game.sfx('blip');
    const line = (this.declined && this.confess(n)) || this.gossip() || this.talkLine(T.SMALL_TALK);
    n.a.say(line, 4);
    return line;
  }

  /** Real gossip now and then: when the next office event is due, which station frees up soonest, the party. */
  gossip() {
    if (!this.rng.chance(0.4)) return null;
    const s = this.game.state;
    const now = this.game.now();
    const options = [];
    if (s.events?.nextAt) options.push(() => T.GOSSIP_EVENT(Math.max(0, Math.ceil((s.events.nextAt - now) / 60000))));
    const tasks = buildFloor(this.from).tasks.map((it) => ({ it, left: S.cooldownLeft(s, it.task.id, now) }));
    const busy = tasks.filter((t) => t.left > 0).sort((a, b) => a.left - b.left);
    const pick = busy[0] || tasks[0];
    if (pick) options.push(() => T.GOSSIP_STATION(pick.it.task.title, this.from, pick.left > 0 ? formatTime(pick.left) : 0));
    if (PA.partyWindow(now) && !s.parties?.[new Date(now).getFullYear()]) options.push(() => T.GOSSIP_PARTY);
    return options.length ? this.rng.pick(options)() : null;
  }

  /** The archive tip (core/roof.js archiveHint), when the next floor up has a folder still to find. */
  confess(n) {
    const game = this.game;
    const s = game.state;
    const hint = RF.archiveHint(s, this.from);
    if (!hint) return null;
    const fresh = RF.noteHint(s, hint);
    if (fresh) {
      track('roof_hint', { floor: hint.floor });
      game.sfx('coin');
      game.toast(`Archive tip: ${hint.label} (the lost folder from floor ${hint.floor}).`, C.gold);
    }
    game.saveNow();
    const line = fresh ? T.CONFESSION(hint.label, hint.floor) : T.CONFESSION_AGAIN(hint.label);
    n.a.say(line, 6);
    return line;
  }

  decline(n) {
    const game = this.game;
    RF.declineSmoke(game.state);
    this.declined = true;
    track('roof_decline', {});
    game.markDirty();
    game.sfx('blip');
    const line = this.talkLine(T.NO_THANKS);
    n.a.say(line, 3);
    return line;
  }

  /** A cigarette: the mini-game, free, pays nothing; afterwards the smoker may let the archive tip slip. */
  smoke(n) {
    const game = this.game;
    const r = RF.roof(game.state);
    const task = { id: 'roof-cigarette', game: 'cigarette', title: 'Smoke Break', difficulty: RF.ROOF.difficulty, seed: this.from * 13 + r.visits };
    game.push(
      new MinigameScene(game, task, (result) => {
        if (!result) return;
        n.brain.talkPause = 6;
        if (!this.confess(n)) n.a.say(this.talkLine(T.AFTER_SMOKE), 3);
      }, { mode: 'roof' }),
    );
  }

  /** Now and then one of them says something to the group. */
  updateChatter(dt) {
    this.chatterT -= dt;
    if (this.chatterT > 0 || !this.npcs.length) return;
    this.chatterT = this.rng.float(7, 13);
    const free = this.npcs.filter((n) => !n.a.bubble && n.brain.talkPause <= 0);
    if (!free.length) return;
    const p = this.player;
    const n = this.rng.pick(free);
    if (Math.hypot(n.a.x - p.x, n.a.y - p.y) > 12) return;
    n.a.say(this.pickFrom(T.SMOKER_CHATTER, this.chatterMemo), 4);
  }

  updatePuffs(dt) {
    for (const n of this.npcs) {
      n.puffT -= dt;
      if (n.puffT > 0) continue;
      n.puffT = this.rng.float(2, 5);
      for (let i = 0; i < 3; i++) this.puffs.push({ x: n.a.x * TILE + (n.a.dir === 'left' ? -4 : 4), y: n.a.y * TILE - 16 - i * 2, t: -i * 0.15, vx: this.rng.float(-4, 4) });
    }
    for (const q of this.puffs) {
      q.t += dt;
      q.y -= dt * 9;
      q.x += q.vx * dt + Math.sin(q.t * 3) * 0.15;
    }
    this.puffs = this.puffs.filter((q) => q.t < 2.2);
  }

  // ------------------------------------------------------------ the guard
  /** The guard steps out of the roof door and patrols a few spots (sometimes the bench, for a smoke himself). */
  spawnGuard() {
    const game = this.game;
    const fl = this.fl;
    const cast = S.castOf(game.state);
    const a = new Actor({ ...suit(npcLook(GUARD_SEED, 'lobby', cast), '#2b3550'), hat: 'cap', glasses: false }, fl.door.x, fl.door.y);
    a.who = { name: npcIdentity(GUARD_SEED, 'lobby', cast).name, role: T.GUARD_ROLE };
    a.dir = 'down';
    const stops = this.rng.sample(fl.patrol, this.rng.int(3, 4));
    if (this.rng.chance(0.5)) stops.splice(this.rng.int(0, stops.length), 0, { x: 19.5, y: 23.5, smoke: true });
    this.guard = { a, stops, out: 0, outS: this.rng.float(...RF.ROOF.guardOutS), wait: 0.8, sus: 0, alarmed: false, back: false, fx: 0, fy: 1 };
    game.sfx('door');
    a.say(this.rng.pick(T.GUARD_OUT), 2.5);
  }

  /** Walk the guard: to the next stop, waiting a moment there; once his time is up, back to the door and gone. */
  updateGuard(dt) {
    const gd = this.guard;
    if (!gd) {
      this.guardT -= dt;
      if (this.guardT <= 0) this.spawnGuard();
      return;
    }
    const a = gd.a;
    const fl = this.fl;
    const p = this.player;
    a.update(dt);
    gd.out += dt;
    // Seen? A "?" and a moment's grace; out of sight again, he shrugs it off.
    const sees = RF.guardSees(fl.opaque, fl.w, { x: a.x, y: a.y, fx: gd.fx, fy: gd.fy }, { x: p.x, y: p.y });
    if (sees) {
      if (!gd.alarmed) {
        gd.alarmed = true;
        this.game.sfx('bad');
      }
      gd.sus += dt;
      a.moving = false;
      a.faceTowards(p.x - a.x, p.y - a.y);
      if (gd.sus >= RF.ROOF.guardGraceS) return this.caught();
      return;
    }
    if (gd.alarmed) {
      gd.sus -= dt * 1.5;
      a.moving = false;
      if (gd.sus > 0) return;
      gd.sus = 0;
      gd.alarmed = false;
      RF.escapeGuard(this.game.state);
      this.game.markDirty();
      a.say(this.rng.pick(T.GUARD_LOST), 2.5);
    }
    if (gd.wait > 0) {
      gd.wait -= dt;
      a.moving = false;
      return;
    }
    if (!a.path?.length) {
      if (gd.back) {
        this.guard = null;
        this.guardT = this.rng.float(...RF.ROOF.guardEveryS);
        this.game.sfx('door');
        return;
      }
      if (gd.arrivedAt?.smoke) {
        a.say(this.rng.pick(T.GUARD_SMOKERS), 3);
        gd.wait = 4;
        gd.arrivedAt = null;
        return;
      }
      const next = gd.out >= gd.outS ? null : gd.stops.shift();
      const to = next || fl.door;
      if (!next) {
        gd.back = true;
        a.say(T.GUARD_BACK, 2);
      }
      a.path = findPath(fl.walk, fl.w, fl.h, Math.floor(a.x), Math.floor(a.y), Math.floor(to.x), Math.floor(to.y), 4000) || [];
      gd.arrivedAt = next;
      if (!a.path.length && !gd.back) gd.wait = 0.5;
      else if (!a.path.length) a.path = null;
      return;
    }
    const n = a.path[0];
    const tx = n.x + 0.5;
    const ty = n.y + 0.5;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    const step = RF.ROOF.guardSpeed * dt;
    a.faceTowards(dx, dy);
    a.moving = true;
    if (d > 0.01) {
      gd.fx = dx / d;
      gd.fy = dy / d;
    }
    if (d <= step) {
      a.x = tx;
      a.y = ty;
      a.path.shift();
      if (!a.path.length) gd.wait = gd.back ? 0 : this.rng.float(1, 2.5);
    } else {
      a.x += (dx / d) * step;
      a.y += (dy / d) * step;
    }
  }

  /** Caught: walked down the stairs to the roof floor, the window shut for the rest of the day. No HR strike. */
  caught() {
    if (this.over) return;
    this.over = true;
    const game = this.game;
    this.guard.a.say(this.rng.pick(T.GUARD_SEES), 3);
    const floor = RF.catchOnRoof(game.state, game.now());
    track('roof_caught', { floor });
    game.saveNow();
    game.sfx('fail');
    game.push(
      new Dialog(game, {
        title: T.CAUGHT_TITLE,
        w: 300,
        text: T.CAUGHT_TEXT,
        button: 'Sorry',
        onClose: () => game.set(new FloorScene(game, floor, { arrival: 'elevator' })),
      }),
    );
  }

  // ------------------------------------------------------------ ways down, the telescope
  async climbDown() {
    if (this.over) return;
    this.over = true;
    const game = this.game;
    RF.leaveRoof(game.state);
    game.saveNow();
    const { RoofClimb } = await import('./roofClimb.js');
    game.set(new RoofClimb(game, this.from, { up: false }));
  }

  async rideCradle() {
    if (this.over) return;
    this.over = true;
    const game = this.game;
    RF.leaveRoof(game.state);
    track('roof_cradle', { floor: this.from });
    game.saveNow();
    const { CradleRide } = await import('./cradle.js');
    game.set(new CradleRide(game, this.from));
  }

  useTelescope() {
    const game = this.game;
    const s = game.state;
    const cost = RF.ROOF.telescopeSp;
    const short = s.sp < cost;
    game.push(
      new Dialog(game, {
        title: 'Pay telescope',
        w: 280,
        text: short ? T.TELESCOPE_BROKE(formatNum(cost)) : `${T.TELESCOPE_PAY(formatNum(cost), RF.ROOF.telescopeS)}\nSpotted so far: ${RF.EGGS.filter((e) => s.roof?.spotted?.[e]).length}/${RF.EGGS.length}.`,
        button: 'Not now',
        action: { label: `Insert ${formatNum(cost)} paperclips`, disabled: short, onClick: () => this.lookThrough() },
      }),
    );
  }

  async lookThrough() {
    const game = this.game;
    const s = game.state;
    const cost = RF.ROOF.telescopeSp;
    if (s.sp < cost) return;
    s.sp -= cost;
    track('roof_telescope', {});
    game.sfx('coin');
    game.saveNow();
    const { TelescopeView } = await import('./telescope.js');
    game.push(new TelescopeView(game, { mode: this.mode, onClose: (line) => line && this.player.say(line, 4) }));
  }

  update(dt) {
    if (this.over) {
      this.time += dt;
      this.guard?.a.update(dt);
      return;
    }
    super.update(dt);
    if (this.over || this.game.top !== this) return;
    this.mode = this.sky || RF.skyMode(this.game.now());
    this.updateChatter(dt);
    this.updatePuffs(dt);
    this.updateGuard(dt);
  }

  // ------------------------------------------------------------ drawing
  /** The sky and the skyline behind the top parapet (screen space), by the local time. */
  drawBackdrop(g) {
    this.drawSkyArea(g);
    // Below the bottom parapet: the street, far down.
    const by = this.fl.h * TILE - Math.round(this.cam.y);
    if (by < H) rect(g, 0, by, W, H - by, '#2a2e3a');
  }

  drawSkyArea(g) {
    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    // The sky's bands squeezed into what shows above the parapet, so the sunset's glow sits on the horizon.
    const horizon = PARAPET_TOP - cy;
    drawSky(g, W, Math.max(60, horizon), this.mode, this.time);
    if (this.mode === 'dusk') {
      // The sun going down behind the city.
      const sx = Math.round(W - 90 - cx * 0.2);
      const sy = horizon - 62;
      rect(g, sx - 9, sy - 9, 18, 18, '#f2a65a');
      rect(g, sx - 7, sy - 11, 14, 22, '#f2a65a');
      rect(g, sx - 11, sy - 7, 22, 14, '#f2a65a');
    }
    drawSkyline(g, W, PARAPET_TOP - cy + 10, this.mode, cx * 0.6, 23);
  }

  /** Sunset tints the roof; at night the lamps, the player's light (and the guard's torch) over the dark. */
  drawDark(g) {
    if (this.mode === 'dusk') {
      g.fillStyle = 'rgba(242,120,70,0.13)';
      g.fillRect(0, 0, W, H);
      return;
    }
    if (this.mode !== 'night') return;
    if (!this.lighting) {
      this.lighting = darkLighting(this.fl, lampsAt(this.fl.lamps, 'roof'), { ambient: NIGHT_AMBIENT, outerRise: 0 });
      this.torch = this.lighting.addLight({ x: 0, y: 0, r: 40, intensity: 1.5, tint: [1, 0.95, 0.8], dynamic: true, level: 0 });
    }
    const gd = this.guard;
    this.torch.level = gd ? 1 : 0;
    if (gd) {
      this.torch.x = (gd.a.x + gd.fx * 1.6) * TILE;
      this.torch.y = (gd.a.y + gd.fy * 1.6) * TILE - 4;
    }
    drawNight(g, this.lighting, { fade: 1, cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y) }, player: this.player, t: this.time });
    // The sky keeps its own light: the stars and the city's windows over the parapet.
    const top = PARAPET_TOP - Math.round(this.cam.y);
    if (top > 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, W, top);
      g.clip();
      this.drawSkyArea(g);
      g.restore();
    }
  }

  render(g) {
    // The guard is drawn with everyone else (depth-sorted): he joins the hall's actors for this frame.
    const gd = this.guard;
    if (gd) this.npcs.push({ a: gd.a, brain: { exit: true }, guard: true });
    super.render(g);
    if (gd) this.npcs = this.npcs.filter((n) => !n.guard);
  }

  /** Smoke puffs and embers, the bees, the guard's "?", and the cradle's and telescope's markers. */
  drawMarkers(g, s, now) {
    super.drawMarkers(g, s, now);
    for (const n of this.npcs) {
      if (n.guard) continue;
      const a = n.a;
      const hx = Math.round(a.x * TILE + (a.dir === 'left' ? -5 : a.dir === 'right' ? 5 : 4));
      const hy = Math.round(a.y * TILE - 9);
      rect(g, hx, hy, 1, 1, Math.floor(this.time * 3 + n.seed) % 3 ? '#e8743a' : '#ffd06a');
    }
    for (const q of this.puffs) {
      if (q.t < 0) continue;
      g.globalAlpha = Math.max(0, 0.55 * (1 - q.t / 2.2));
      const r = 1 + Math.floor(q.t * 1.5);
      rect(g, Math.round(q.x - r / 2), Math.round(q.y), r, r, '#d8dce4');
      g.globalAlpha = 1;
    }
    // Bees round the hives.
    for (const it of this.fl.items) {
      if (it.type !== 'beehive') continue;
      for (let i = 0; i < 3; i++) {
        const k = this.time * (1.6 + i * 0.4) + it.id * 2 + i * 2.1;
        const bx = Math.round((it.x + 0.5) * TILE + Math.cos(k) * (6 + i * 3));
        const by = Math.round(it.y * TILE - 6 + Math.sin(k * 1.7) * 5);
        rect(g, bx, by, 1, 1, '#f2c230');
        if (Math.floor(this.time * 12 + i) % 2) rect(g, bx, by - 1, 1, 1, '#f4f1e8');
      }
    }
    const gd = this.guard;
    if (gd?.alarmed) {
      const x = Math.round(gd.a.x * TILE);
      const y = Math.round(gd.a.y * TILE) - CHAR_H - 14;
      const k = Math.min(1, gd.sus / RF.ROOF.guardGraceS);
      rect(g, x - 6, y, 12, 12, C.border);
      rect(g, x - 5, y + 1, 10, 10, k > 0.6 ? C.bad : C.warn);
      drawText(g, '?', x, y + 2, { align: 'center', color: C.ink });
    }
    // The telescope's coin slot glints; the cradle's controls blink.
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    const tel = this.fl.telescope;
    if (Math.floor(this.time * 2) % 2) rect(g, tel.x * TILE + 7, this.view.itemTop(tel) + 6, 3, 1, '#ffe8a0');
    const done = RF.allSpotted(s);
    if (!done) {
      const cx = Math.round((tel.x + 0.5) * TILE);
      const y = this.view.itemTop(tel) - 14 + bob;
      rect(g, cx - 6, y, 12, 11, C.border);
      rect(g, cx - 5, y + 1, 10, 9, ROOF_COLOR);
      rect(g, cx - 3, y + 3, 3, 3, C.ink);
      rect(g, cx + 1, y + 3, 3, 3, C.ink);
    }
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!t || !['ladder', 'telescope', 'cradle', 'npc'].includes(t.kind)) return super.drawPrompt(g, s, now);
    let text;
    let sub;
    if (t.kind === 'npc') {
      text = 'Talk';
      sub = `${t.n.id.name} - smoke break`;
    } else if (t.kind === 'ladder') {
      text = 'Fire escape';
      sub = `back down to F${this.from}`;
    } else if (t.kind === 'cradle') {
      text = 'Cradle';
      sub = `ride down the facade to F${this.from}`;
    } else {
      text = 'Pay telescope';
      sub = `${formatNum(RF.ROOF.telescopeSp)} paperclips a look`;
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

  drawBanner(g) {
    const a = Math.min(1, this.banner, 3.5 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, ROOF_COLOR);
    rect(g, 0, y + 33, W, 1, ROOF_COLOR);
    drawText(g, T.ROOF_BANNER, W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, T.ROOF_SUB, W / 2, y + 23, { align: 'center', color: ROOF_COLOR });
    g.globalAlpha = 1;
  }
}

