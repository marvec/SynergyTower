// Random office events, run by the FloorScene one at a time (rules and rewards: src/core/events.js).
//   drill:   fire alarm; get to the fire exit at the far end of the hallway before time runs out.
//   printer: a printer melts down; kick it three times before IT gets involved.
//   cake:    cake in the kitchen; beat the colleague racing for it. First one there gets +2 coffee.
//   audit:   auditors lock a few stations; talk to the auditor to wrap it up early.
// Timers run on the scene's dt, so they pause while an overlay or a mini-game is open.
import { track } from '../engine/analytics.js';
import { TILE, CHAR_H } from '../engine/art.js';
import { C, rect, panel, icon, bar, formatNum } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { findPath } from '../core/pathfind.js';
import { itemNeighbors } from '../core/floorgen.js';
import * as V from '../core/events.js';
import * as E from '../core/economy.js';
import { Actor, NpcBrain, npcLook, npcIdentity, suit } from './floorWorld.js';
import { MINIGAMES } from '../minigames/index.js';
import { HUD_H } from './hud.js';

const SPEED = 4.4; // the player's walking speed (tiles/s), as in floorScene.js
const AUDITOR_SEED = 7331;

const TITLES = { drill: 'FIRE DRILL', printer: 'PRINTER MELTDOWN', cake: 'CAKE IN THE KITCHEN', audit: 'SURPRISE AUDIT' };

/** Shortest walk (in tiles) from (x, y) to any of the goal tiles, or null. */
function walkLen(fl, x, y, goals) {
  let best = null;
  for (const [gx, gy] of goals) {
    if (!fl.walk[gy * fl.w + gx]) continue;
    const p = findPath(fl.walk, fl.w, fl.h, Math.floor(x), Math.floor(y), gx, gy);
    if (p && (best === null || p.length < best.length)) best = p;
  }
  return best;
}

export class OfficeEvent {
  constructor(scene, kind) {
    this.scene = scene;
    this.game = scene.game;
    this.kind = kind;
    this.time = 0;
    this.over = false;
    this.actors = [];
    const { fl, player: p } = scene;
    const game = this.game;
    if (kind === 'drill') {
      this.exit = V.fireExit(fl, p.x);
      const goals = [];
      for (let y = this.exit.y0; y <= this.exit.y1; y++) for (let x = this.exit.x0; x <= this.exit.x1; x++) goals.push([x, y]);
      const path = walkLen(fl, p.x, p.y, goals) || [];
      this.limit = Math.round((path.length / SPEED) * 1.8 + 6);
      // Colleagues head for the exit too, and wait there until the drill is over.
      for (const n of scene.npcs) {
        if (n.brain.exit) continue;
        const [gx, gy] = scene.rng.pick(goals);
        n.a.path = findPath(fl.walk, fl.w, fl.h, Math.floor(n.a.x), Math.floor(n.a.y), gx, gy) || null;
        n.brain.wait = this.limit + 4;
        n.brain.talkPause = 0;
      }
      game.sfx('alarm');
      game.toast(`Fire drill! Get to the fire exit at the ${this.exit.side} end of the hallway.`, C.bad);
    } else if (kind === 'printer') {
      this.target = V.eventTarget(fl, 'printer');
      this.kicks = 0;
      const path = walkLen(fl, p.x, p.y, itemNeighbors(fl, this.target)) || [];
      this.limit = Math.round((path.length / SPEED) * 1.6 + 15);
      game.sfx('bad');
      game.toast(`The ${this.target.type} is melting down! Fix it before IT finds out.`, C.warn);
    } else if (kind === 'cake') {
      this.target = V.eventTarget(fl, 'cake');
      const goals = itemNeighbors(fl, this.target);
      const mine = walkLen(fl, p.x, p.y, goals) || [];
      const arrive = Math.max(6, Math.round((mine.length / SPEED) * 1.5 + 3));
      this.limit = arrive;
      // One colleague races for it, timed to arrive just after a player who heads straight there.
      const pool = scene.npcs.filter((n) => !n.brain.exit);
      for (const n of scene.rng.shuffle(pool)) {
        const path = walkLen(fl, n.a.x, n.a.y, goals);
        if (!path || !path.length) continue;
        this.rival = n;
        this.rivalSpeed = n.brain.speed;
        n.a.path = path;
        n.brain.speed = path.length / arrive;
        n.brain.talkPause = 0;
        n.brain.wait = arrive + 6;
        this.limit = arrive + 3; // the clock is only a fallback: the rival reaching the cake ends it
        n.a.say('Did someone say CAKE?', 2.5);
        break;
      }
      game.sfx('ding');
      game.toast(this.rival ? `Cake in the kitchen! ${this.rival.id.name} is on the way...` : 'Cake in the kitchen! Get there before it is gone.', C.gold);
    } else {
      const tasks = scene.rng.shuffle(fl.tasks.filter((it) => !it.task.checkin));
      this.locked = new Set(tasks.slice(0, 3));
      this.limit = E.AUDIT_LOCK_S;
      const look = suit(npcLook(AUDITOR_SEED, 'finance'), '#22242e', { tie: '#5a5f70', glasses: true });
      const a = new Actor(look, fl.spawn.x, fl.spawn.y);
      const id = npcIdentity(AUDITOR_SEED, 'finance');
      a.who = { name: id.name, role: 'External Auditor' };
      a.say('Nobody touch anything. This is an audit.', 3);
      this.auditor = { a, brain: new NpcBrain(a, fl, AUDITOR_SEED), seed: -AUDITOR_SEED, id: { ...id, role: 'External Auditor' } };
      this.actors.push(a);
      game.sfx('door');
      game.toast(`Surprise audit! ${this.locked.size} stations are locked. The auditor might speed things up.`, C.warn);
    }
    this.left = this.limit;
  }

  get title() {
    return TITLES[this.kind];
  }
  get objective() {
    if (this.kind === 'drill') return `Get to the fire exit (${this.exit.side} end of the hallway)`;
    if (this.kind === 'printer') return `Kick the ${this.target.type} back to life (${this.kicks}/3)`;
    if (this.kind === 'cake') return this.rival ? `Beat ${this.rival.id.name.split(' ')[0]} to the kitchen cake` : 'Get to the kitchen cake';
    return `Talk to ${this.auditor.id.name.split(' ')[0]} the auditor to wrap it up`;
  }

  /** Extra things to interact with, listed before the floor's own (same furniture: the event wins). */
  interactables() {
    if (this.over) return [];
    if (this.target) return [{ kind: 'event', it: this.target }];
    if (this.auditor) return [{ kind: 'npc', n: this.auditor }];
    return [];
  }
  /** During a fire drill, nothing but the exit. Otherwise the floor works as usual (minus audited stations). */
  blocks(t) {
    const drill = 'Not now: fire drill! Get to the fire exit.';
    if (this.kind === 'drill' && ['task', 'elevator', 'hr', 'terminal', 'mydesk'].includes(t.kind)) return drill;
    if (this.kind === 'drill' && t.kind === 'npc' && t.n === this.scene.standupNpc) return drill;
    // Floor quests run their own clock and HUD panel: not while an event is on (checked before the coffee is charged).
    if (t.kind === 'task' && MINIGAMES[t.it.task.game].quest) return 'Better wait until the office event is over.';
    if (this.kind === 'audit' && t.kind === 'task' && this.locked.has(t.it)) return 'Locked for the audit. Talk to the auditor to speed it up.';
    return null;
  }
  isLocked(it) {
    return this.kind === 'audit' && !this.over && this.locked.has(it);
  }
  /** Station markers this event draws its own marker over (locked stations, the melting printer). */
  hidesMarker(it) {
    return !this.over && (this.isLocked(it) || ((this.kind === 'printer' || this.kind === 'cake') && it === this.target));
  }
  prompt() {
    if (this.kind === 'printer') return ['Kick it', `${3 - this.kicks} more`];
    return ['Cake!', `+${E.EVENT_CAKE_COFFEE} coffee`];
  }

  /** Returns true when the event handled the interaction. */
  onInteract(t) {
    if (this.over) return false;
    const game = this.game;
    const p = this.scene.player;
    if (t.kind === 'event' && this.kind === 'printer') {
      this.kicks++;
      this.shake = 0.3;
      game.sfx(this.kicks < 3 ? 'bad' : 'good');
      p.say(['Kick!', 'Come ON!', 'Percussive maintenance!'][this.kicks - 1], 1.2);
      if (this.kicks >= 3) this.finish(true, `The ${this.target.type} purrs again.`);
      return true;
    }
    if (t.kind === 'event' && this.kind === 'cake') {
      game.sfx('coin');
      p.say('Mmm, cake!', 2);
      this.rival?.a.say('Aww, the last slice...', 3);
      this.finish(true, 'First to the cake!');
      return true;
    }
    // Chatting must not stop colleagues on their way to the exit, or the cake rival mid-race.
    if (t.kind === 'npc' && this.kind === 'drill') {
      t.n.a.say('Fire drill! This way!', 2);
      return true;
    }
    if (t.kind === 'npc' && t.n === this.rival) {
      t.n.a.say('Out of my way! Cake waits for no one.', 2);
      return true;
    }
    if (t.kind === 'npc' && t.n === this.auditor) {
      const a = this.auditor.a;
      a.faceTowards(p.x - a.x, p.y - a.y);
      a.say('Thank you for your transparency. We are done here.', 3.5);
      game.sfx('good');
      this.finish(true, 'You helped the audit along. Stations unlocked.');
      return true;
    }
    return false;
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.left = Math.max(0, this.left - dt);
    this.shake = Math.max(0, (this.shake || 0) - dt);
    const p = this.scene.player;
    if (this.auditor) {
      this.auditor.brain.update(dt, (x, y) => Math.hypot(x - p.x, y - p.y) < 0.45);
      this.auditor.a.update(dt);
    }
    if (this.kind === 'drill' && V.inExit(this.exit, p.x, p.y)) return this.finish(true, 'Everyone accounted for. Safety first!');
    if (this.kind === 'cake' && this.rival) {
      const r = this.rival.a;
      const t = this.target;
      const near = Math.max(t.x - r.x, 0, r.x - (t.x + t.w)) + Math.max(t.y - r.y, 0, r.y - (t.y + t.h)) < 1.2;
      if (near && (!r.path || !r.path.length)) {
        r.say('Mmm, the last slice!', 3);
        return this.finish(false, `${this.rival.id.name} got the last slice.`);
      }
    }
    if (this.left <= 0) {
      const msg = {
        drill: 'Too slow. HR noted your absence at the assembly point.',
        printer: 'IT opened ticket #4711. They will be up "shortly".',
        cake: 'The cake is gone. Only crumbs left.',
        audit: 'The auditors are done. Stations unlocked.',
      }[this.kind];
      this.finish(false, msg);
    }
  }

  finish(won, msg) {
    const game = this.game;
    const s = game.state;
    this.over = true;
    const r = V.applyEventResult(s, this.kind, won, this.scene.floorNo);
    track('office_event', { kind: this.kind, won, floor: s.maxFloor });
    if (this.rival) {
      this.rival.brain.speed = this.rivalSpeed;
      this.rival.brain.wait = 3;
    }
    if (this.kind === 'drill') for (const n of this.scene.npcs) n.brain.wait = Math.min(n.brain.wait, 1 + this.scene.rng.float(0, 3));
    if (this.auditor) {
      // The auditor walks back to the elevator and leaves, like a fired colleague.
      this.auditor.brain.leave(Math.floor(this.scene.fl.spawn.x), Math.floor(this.scene.fl.spawn.y));
      this.scene.npcs.push(this.auditor);
    }
    const parts = [];
    if (r?.sp) parts.push(`+${formatNum(r.sp)} paperclips`);
    if (r?.xp) parts.push(`+${formatNum(r.xp)} XP`);
    if (r?.coffee) parts.push(`+${r.coffee} coffee`);
    game.toast(parts.length ? `${msg} ${parts.join(', ')}` : msg, won ? C.good : C.dim);
    if (!won) game.sfx('fail');
    else if (r?.levelsGained) game.sfx('levelup');
    game.markDirty();
    game.saveNow();
  }

  /** World-space art and markers (inside the camera transform). */
  renderWorld(g) {
    if (this.over) return;
    const bob = Math.round(Math.sin(this.time * 5) * 1.5);
    const view = this.scene.view;
    if (this.kind === 'drill') {
      const ex = this.exit;
      // A green EXIT sign on the hallway wall above the exit, and flashing arrows on the floor.
      const sx = ex.x0 * TILE + 4;
      const sy = ex.y0 * TILE - 14;
      rect(g, sx - 1, sy - 1, 26, 11, C.border);
      rect(g, sx, sy, 24, 9, '#1f9a4a');
      drawText(g, 'EXIT', sx + 12, sy + 1, { align: 'center', color: '#e8ffe8' });
      if (Math.floor(this.time * 3) % 2 === 0)
        for (let y = ex.y0; y <= ex.y1; y++)
          for (let x = ex.x0; x <= ex.x1; x++) {
            g.fillStyle = 'rgba(95,208,104,0.35)';
            g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
          }
    } else if (this.kind === 'printer') {
      const it = this.target;
      const cx = Math.round((it.x + it.w / 2) * TILE) + (this.shake > 0 ? Math.round(Math.sin(this.time * 80) * 2) : 0);
      const top = view.itemTop(it);
      for (let k = 0; k < 7; k++) {
        const ph = (this.time * 0.7 + k / 7) % 1;
        const r = 3 + Math.round(ph * 5);
        g.fillStyle = `rgba(48,48,56,${0.9 * (1 - ph * 0.8)})`;
        g.fillRect(cx - r + Math.round(Math.sin(k * 2.3 + this.time * 2) * 5), Math.round(top - 4 - ph * 34), r * 2, r * 2);
      }
      if (Math.floor(this.time * 6) % 2 === 0) rect(g, cx - 3, top + 2, 6, 3, '#f29c38');
      const y = top - 16 + bob;
      rect(g, cx - 5, y, 10, 12, C.border);
      rect(g, cx - 4, y + 1, 8, 10, C.bad);
      rect(g, cx - 1, y + 3, 2, 4, C.text);
      rect(g, cx - 1, y + 8, 2, 2, C.text);
    } else if (this.kind === 'cake') {
      const it = this.target;
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const top = view.itemTop(it) + 2;
      // A layered cake with a candle on the table.
      rect(g, cx - 7, top - 1, 14, 2, '#d8dce4');
      rect(g, cx - 6, top - 8, 12, 7, '#f4e0c0');
      rect(g, cx - 6, top - 5, 12, 2, '#e88a9a');
      rect(g, cx - 6, top - 8, 12, 1, '#ffffff');
      rect(g, cx, top - 12, 1, 4, '#f4f1e8');
      if (Math.floor(this.time * 8) % 2 === 0) rect(g, cx, top - 14, 1, 2, '#f2c14e');
      const y = top - 30 + bob;
      rect(g, cx - 5, y, 10, 12, C.border);
      rect(g, cx - 4, y + 1, 8, 10, C.gold);
      icon(g, 'coffee', cx - 3, y + 3);
    } else {
      for (const it of this.locked) {
        const cx = Math.round((it.x + it.w / 2) * TILE);
        const y = view.itemTop(it) - 16 + bob;
        rect(g, cx - 6, y - 1, 13, 10, C.border);
        icon(g, 'lock', cx - 3, y);
      }
      const a = this.auditor.a;
      if (!a.bubble) {
        const cx = Math.round(a.x * TILE);
        const y = Math.round(a.y * TILE) - CHAR_H - 12 + bob;
        rect(g, cx - 4, y, 9, 10, C.border);
        rect(g, cx - 3, y + 1, 7, 8, C.warn);
        drawText(g, '?', cx + 1, y + 1, { align: 'center', color: C.ink });
      }
    }
  }

  /** Screen-space: a red alarm flash during the drill, and the objective panel under the HUD. */
  renderHud(g) {
    if (this.over) return;
    if (this.kind === 'drill') {
      g.fillStyle = `rgba(226,80,74,${0.08 + 0.08 * Math.max(0, Math.sin(this.time * 6))})`;
      g.fillRect(0, HUD_H, 480, 270 - HUD_H);
    }
    const obj = this.objective;
    const w = Math.max(200, measureText(obj) + 16, measureText(this.title) + 70);
    const x = 4;
    const y = HUD_H + 3;
    panel(g, x, y, w, 32, { fill: C.panelDark });
    drawText(g, this.title, x + 6, y + 4, { color: this.kind === 'drill' ? C.bad : C.gold });
    drawText(g, 'office event', x + w - 6, y + 4, { align: 'right', color: C.dim });
    drawText(g, obj, x + 6, y + 14, { color: C.text });
    const f = this.left / this.limit;
    bar(g, x + 6, y + 25, w - 40, 4, f, f > 0.5 ? C.good : f > 0.2 ? C.warn : C.bad);
    drawText(g, `${Math.ceil(this.left)}s`, x + w - 6, y + 23, { align: 'right', color: f > 0.2 ? C.text : C.bad });
  }
}
