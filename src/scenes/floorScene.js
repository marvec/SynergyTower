// The main play scene: walk a floor, talk to colleagues, start tasks, use the elevator.
import { W, H } from '../engine/screen.js';
import { TILE, CHAR_H } from '../engine/art.js';
import { C, rect, panel, icon, stars, formatTime } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { buildFloor } from '../core/tasks.js';
import { itemNeighbors } from '../core/floorgen.js';
import { findPath } from '../core/pathfind.js';
import { createRng } from '../core/rng.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { departmentForFloor, floorName, titleForFloor } from '../data/departments.js';
import { COMMON_NPC_LINES } from '../data/npcLines.js';
import { FIRED_LINES, KEPT_LINES } from '../data/people.js';
import { FloorView, Actor, NpcBrain, npcLook, npcIdentity } from './floorWorld.js';
import { Hud, HUD_H } from './hud.js';
import { TaskCard, ElevatorPanel, ShopOverlay, PerksOverlay, TrainOverlay, PauseMenu, Dialog, HOW_TO, ReviewCard, hrNotice, FateDialog } from './overlays.js';
import { TerminalScene } from './terminal.js';
import { MinigameScene } from './minigameScene.js';

const SPEED = 4.4;
const R = 0.3;
const REACH = 1.05;
const TOP_MARGIN = 36;

export class FloorScene {
  constructor(game, floor, { arrival = 'elevator' } = {}) {
    this.game = game;
    this.floorNo = floor;
    this.fl = buildFloor(floor);
    this.dept = departmentForFloor(floor);
    this.view = new FloorView(this.fl, game.corpColor());
    const spawn = arrival === 'entrance' ? { x: 19.9, y: this.fl.h - 2.2 } : { x: 19.9, y: 2.6 };
    this.player = new Actor(game.playerLook(), spawn.x, spawn.y);
    this.player.dir = arrival === 'entrance' ? 'up' : 'down';
    const fired = game.state.fired || {};
    this.npcs = this.fl.npcs
      .filter((n) => !fired[n.seed])
      .map((n) => {
        const a = new Actor(npcLook(n.seed, this.fl.dept), n.x, n.y);
        const id = npcIdentity(n.seed, this.fl.dept);
        a.who = { name: id.name, role: id.role };
        return { a, brain: new NpcBrain(a, this.fl, n.seed), seed: n.seed, id };
      });
    // The HR rep stands behind the review desk all day.
    const rep = this.fl.hrRep;
    this.hrRep = rep ? new Actor({ ...npcLook(floor * 91 + 7, this.fl.dept), jacket: '#4a3a6a', tie: null, glasses: true }, rep.x + 0.5, rep.y + 0.75) : null;
    if (this.hrRep) this.hrRep.who = { name: npcIdentity(floor * 91 + 7, 'legalhr').name, role: 'HR Business Partner' };
    this.rng = createRng(floor * 17 + Date.now());
    this.cam = { x: 0, y: 0 };
    this.snapCamera();
    this.pending = null;
    this.banner = 3.5;
    this.time = 0;
    this.stepT = 0;
    this.focus = null;
    this.hud = new Hud(game, {
      shop: () => game.push(new ShopOverlay(game)),
      perks: () => game.push(new PerksOverlay(game)),
      train: () => game.push(new TrainOverlay(game)),
      music: () => {
        const st = game.state.settings;
        st.music = !st.music;
        game.audio.setMusic(st.music);
        game.markDirty();
      },
      menu: () => this.openMenu(),
    });
  }

  enter() {
    this.game.state.floor = this.floorNo;
    this.game.markDirty();
    this.game.audio.play(this.dept.music);
    const s = this.game.state;
    if (!s.flags.introSeen) {
      s.flags.introSeen = true;
      this.game.push(
        new Dialog(this.game, {
          title: `Welcome to ${s.corp.name}!`,
          w: 320,
          text:
            `Congratulations, ${s.player.name}! You are our newest ${titleForFloor(1)}.\n` +
            'Complete tasks marked with ! to earn paperclips, XP and KPI stars. Hit the star quota, level up, save up for the keycard fee and pass your HR performance review - then the elevator takes you up.\n' +
            '40 floors. One corner office. Good luck!',
          button: "Let's synergize",
        }),
      );
    }
  }

  resume() {
    this.game.audio.play(this.dept.music);
  }

  openMenu() {
    const game = this.game;
    game.push(
      new PauseMenu(game, {
        onQuit: async () => {
          const { TitleScene } = await import('./title.js');
          game.set(new TitleScene(game));
        },
      }),
    );
  }

  // ------------------------------------------------------------ collision & movement
  walkableAt(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const { fl } = this;
    if (tx < 0 || ty < 0 || tx >= fl.w || ty >= fl.h) return false;
    return !!fl.walk[ty * fl.w + tx];
  }
  fits(x, y) {
    return this.walkableAt(x - R, y - 0.2) && this.walkableAt(x + R, y - 0.2) && this.walkableAt(x - R, y + 0.12) && this.walkableAt(x + R, y + 0.12);
  }
  moveBy(dx, dy) {
    const p = this.player;
    if (dx && this.fits(p.x + dx, p.y)) p.x += dx;
    if (dy && this.fits(p.x, p.y + dy)) p.y += dy;
  }

  snapCamera() {
    const t = this.camTarget();
    this.cam.x = t.x;
    this.cam.y = t.y;
  }
  camTarget() {
    const { fl } = this;
    const x = Math.max(0, Math.min(fl.w * TILE - W, this.player.x * TILE - W / 2));
    // Top limit: the tallest furniture in the first row (lift 26) plus its bobbing "!" marker and best-star dots
    // reach ~30 px above the map edge; keep all of that below the HUD.
    const y = Math.max(-HUD_H - TOP_MARGIN, Math.min(fl.h * TILE - H + 24, this.player.y * TILE - H / 2 - 6));
    return { x, y };
  }

  // ------------------------------------------------------------ interactables
  interactables() {
    const list = [];
    for (const it of this.fl.items) {
      if (it.task) list.push({ kind: 'task', it });
      else if (it.interact === 'elevator') list.push({ kind: 'elevator', it });
      else if (it.interact === 'coffee') list.push({ kind: 'coffee', it });
      else if (it.interact === 'hr') list.push({ kind: 'hr', it });
      else if (it.terminal) list.push({ kind: 'terminal', it });
    }
    for (const n of this.npcs) if (!n.brain.exit) list.push({ kind: 'npc', n });
    return list;
  }
  distTo(target) {
    const p = this.player;
    if (target.kind === 'npc') return Math.hypot(target.n.a.x - p.x, target.n.a.y - p.y) - 0.2;
    const it = target.it;
    const dx = Math.max(it.x - p.x, 0, p.x - (it.x + it.w));
    const dy = Math.max(it.y - (p.y - 0.1), 0, p.y - 0.1 - (it.y + it.h));
    return Math.hypot(dx, dy);
  }
  nearest() {
    let best = null;
    let bd = REACH;
    for (const t of this.interactables()) {
      const d = this.distTo(t) - (t.kind === 'npc' ? 0 : 0.05);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
  sameTarget(a, b) {
    return a && b && a.kind === b.kind && (a.it ? a.it === b.it : a.n === b.n);
  }

  interact(t) {
    const game = this.game;
    const s = game.state;
    const p = this.player;
    this.pending = null;
    p.path = null;
    if (t.kind === 'npc') {
      const a = t.n.a;
      a.faceTowards(p.x - a.x, p.y - a.y);
      p.faceTowards(a.x - p.x, a.y - p.y);
      t.n.brain.talkPause = 3.5;
      a.path = null;
      const line = this.nextLine();
      a.say(line);
      game.sfx('blip');
      if (S.canFire(s)) {
        game.push(new FateDialog(game, { npc: t.n, line, dept: this.dept.name, floor: this.floorNo, onFire: () => this.fire(t.n), onKeep: () => this.keep(t.n) }));
      }
      return;
    }
    const it = t.it;
    p.faceTowards(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y);
    if (t.kind === 'task') {
      game.sfx('click');
      game.push(new TaskCard(game, it.task, (task) => this.startTask(task)));
    } else if (t.kind === 'elevator') {
      game.sfx('ding');
      game.push(new ElevatorPanel(game, { onPromote: () => this.promote(), onTravel: (f) => this.travel(f) }));
    } else if (t.kind === 'hr') {
      const r = S.reviewStatus(s, game.now());
      game.sfx('click');
      if (['available', 'cooldown', 'coffee'].includes(r.state)) {
        this.hrRep?.say('Have a seat. Let us talk about your growth.', 2.5);
        game.push(new ReviewCard(game, () => this.startReview()));
      } else {
        this.hrRep?.say(r.state === 'passed' ? 'Congratulations again!' : 'Do you have an appointment?', 2.5);
        hrNotice(game, r.state);
      }
    } else if (t.kind === 'terminal') {
      game.sfx('click');
      game.push(new TerminalScene(game, { floor: this.floorNo, ws: it.id, onWarp: (f) => this.warp(f) }));
    } else if (t.kind === 'coffee') {
      const r = S.useCoffeeMachine(s, this.floorNo, game.now());
      if (r.ok) {
        game.sfx('coin');
        game.toast(`Fresh brew! +${r.gained} coffee`, C.coffee);
        game.markDirty();
      } else {
        game.sfx('bad');
        game.toast(`The machine is brewing... ready in ${formatTime(r.left)}`, C.dim);
      }
    }
  }

  /** A colleague one-liner: 40% department flavour, 60% common office life; avoids recent repeats. */
  nextLine() {
    this.recentLines ||= [];
    const pool = this.rng.chance(0.4) ? this.dept.npcLines : COMMON_NPC_LINES;
    let line = this.rng.pick(pool);
    for (let i = 0; i < 8 && this.recentLines.includes(line); i++) line = this.rng.pick(pool);
    this.recentLines.push(line);
    if (this.recentLines.length > 30) this.recentLines.shift();
    return line;
  }

  startTask(task) {
    const game = this.game;
    game.push(
      new MinigameScene(game, task, async (result) => {
        if (result.ceoUnlocked) {
          const { EndingScene } = await import('./ending.js');
          game.push(new EndingScene(game));
        }
      }),
    );
  }

  startReview() {
    const game = this.game;
    const f = game.state.maxFloor;
    const task = { id: `review-${f}`, game: 'review', title: `Performance Review · F${f}`, difficulty: Math.min(1, ((f - 1) / 39) * 0.9 + 0.05), seed: f * 7 };
    game.push(
      new MinigameScene(game, task, (result) => {
        if (result.passed) {
          this.hrRep?.say('Approved! The elevator is all yours.', 3);
          game.toast('Review passed! Take the elevator up.', C.good);
        } else this.hrRep?.say('We will revisit this. Reflect on it.', 3);
      }, { mode: 'review' }),
    );
  }

  async promote() {
    const game = this.game;
    const from = game.state.maxFloor;
    if (!S.promote(game.state, game.now())) return game.sfx('bad');
    game.saveNow();
    const { ElevatorRide } = await import('./elevatorRide.js');
    game.set(new ElevatorRide(game, from, game.state.maxFloor, { promoted: true }));
  }

  async travel(f) {
    const game = this.game;
    const from = game.state.floor;
    if (!S.goToFloor(game.state, f)) return;
    game.markDirty();
    const { ElevatorRide } = await import('./elevatorRide.js');
    game.set(new ElevatorRide(game, from, f, { promoted: false }));
  }

  /** CEO only: the colleague clears their desk and takes the elevator out, never to return. */
  fire(n) {
    const game = this.game;
    const stash = this.rng.int(5, 60);
    if (!S.fireEmployee(game.state, n.seed, stash).ok) return game.sfx('bad');
    game.saveNow();
    game.sfx('fail');
    n.a.say(this.rng.pick(FIRED_LINES), 4);
    n.a.carry = 'box';
    n.brain.leave(Math.floor(this.fl.spawn.x), Math.floor(this.fl.spawn.y));
    game.toast(`${n.id.name} is out. Desk stash: +${stash} paperclips`, C.gold);
  }

  keep(n) {
    this.game.sfx('good');
    n.a.say(this.rng.pick(KEPT_LINES), 3.5);
    n.brain.talkPause = 3.5;
  }

  /** Terminal secret (`systemctl isolate levelXX.target`): ride straight to any floor. */
  async warp(f) {
    const game = this.game;
    const from = game.state.floor;
    const r = S.warpToFloor(game.state, f);
    if (!r.ok) return;
    game.saveNow();
    const { ElevatorRide } = await import('./elevatorRide.js');
    game.set(new ElevatorRide(game, from, f, { promoted: r.promoted, warp: true }));
  }

  /** Item or NPC under a world-space point. */
  pick(wx, wy) {
    let hit = null;
    let hitBase = -1;
    for (const t of this.interactables()) {
      let x0, y0, x1, y1, base;
      if (t.kind === 'npc') {
        const a = t.n.a;
        x0 = a.x * TILE - 7;
        x1 = a.x * TILE + 7;
        y0 = a.y * TILE - CHAR_H;
        y1 = a.y * TILE + 2;
        base = a.y * TILE;
      } else {
        const it = t.it;
        x0 = it.x * TILE;
        x1 = (it.x + it.w) * TILE;
        y0 = this.view.itemTop(it);
        y1 = (it.y + it.h) * TILE;
        base = y1;
      }
      if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1 && base > hitBase) {
        hit = t;
        hitBase = base;
      }
    }
    return hit;
  }

  walkTo(tx, ty, target = null) {
    const { fl } = this;
    const p = this.player;
    const sx = Math.floor(p.x);
    const sy = Math.floor(p.y);
    let goals = [[tx, ty]];
    if (target && target.kind !== 'npc') goals = itemNeighbors(fl, target.it);
    let best = null;
    for (const [gx, gy] of goals) {
      if (!fl.walk[gy * fl.w + gx]) continue;
      const path = findPath(fl.walk, fl.w, fl.h, sx, sy, gx, gy);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) return false;
    p.path = best;
    this.pending = target;
    return true;
  }

  // ------------------------------------------------------------ loop
  update(dt) {
    const game = this.game;
    const input = game.input;
    this.time += dt;
    this.banner -= dt;
    const p = this.player;

    const hudUsed = this.hud.update(dt, input);
    if (input.back()) {
      game.sfx('click');
      return this.openMenu();
    }
    if (input.pressedExact('h') || input.pressedExact('?')) game.push(new Dialog(game, { title: 'How to play', w: 320, text: HOW_TO }));

    // Keyboard movement.
    let kx = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
    let ky = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
    if (kx || ky) {
      p.path = null;
      this.pending = null;
      const len = Math.hypot(kx, ky);
      this.moveBy((kx / len) * SPEED * dt, (ky / len) * SPEED * dt);
      p.faceTowards(kx, ky);
      p.moving = true;
    } else if (p.path && p.path.length) {
      const n = p.path[0];
      const tx = n.x + 0.5;
      const ty = n.y + 0.55;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = SPEED * dt;
      p.faceTowards(dx, dy);
      p.moving = true;
      if (d <= step) {
        p.x = tx;
        p.y = ty;
        p.path.shift();
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    } else {
      p.moving = false;
      if (this.pending) {
        const t = this.pending;
        this.pending = null;
        if (this.distTo(t) <= REACH + 0.3) this.interact(t);
      }
    }
    if (p.moving) {
      this.stepT += dt;
      if (this.stepT > 0.32) {
        this.stepT = 0;
        game.sfx('step');
      }
    }

    // Mouse.
    if (!hudUsed && input.pointer.clicked && input.pointer.y > HUD_H) {
      const wx = input.pointer.x + this.cam.x;
      const wy = input.pointer.y + this.cam.y;
      const t = this.pick(wx, wy);
      if (t) {
        if (this.distTo(t) <= REACH) this.interact(t);
        else if (t.kind === 'npc') this.walkTo(Math.floor(t.n.a.x), Math.floor(t.n.a.y), t);
        else this.walkTo(0, 0, t);
      } else {
        const tx = Math.floor(wx / TILE);
        const ty = Math.floor(wy / TILE);
        if (tx >= 0 && ty >= 0 && tx < this.fl.w && ty < this.fl.h) this.walkTo(tx, ty);
      }
    }

    this.focus = this.nearest();
    if (input.confirm() && this.focus) this.interact(this.focus);

    for (const n of this.npcs) {
      n.brain.update(dt, (x, y) => Math.hypot(x - p.x, y - p.y) < 0.45);
      n.a.update(dt);
      if (n.brain.gone) game.sfx('ding');
    }
    this.npcs = this.npcs.filter((n) => !n.brain.gone);
    p.update(dt);
    this.hrRep?.update(dt);

    const t = this.camTarget();
    const k = Math.min(1, dt * 8);
    this.cam.x += (t.x - this.cam.x) * k;
    this.cam.y += (t.y - this.cam.y) * k;
  }

  render(g) {
    const s = this.game.state;
    const now = this.game.now();
    g.fillStyle = '#0d0f18';
    g.fillRect(0, 0, W, H);
    const actors = [this.player, ...this.npcs.map((n) => n.a), ...(this.hrRep ? [this.hrRep] : [])];
    this.view.render(g, this.cam, actors);

    g.save();
    g.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
    if (this.focus && this.focus.kind !== 'npc') this.drawFocus(g, this.focus.it);
    this.drawMarkers(g, s, now);
    for (const a of actors) a.drawBubble(g);
    g.restore();

    this.drawPrompt(g, s, now);
    this.hud.render(g);
    if (this.banner > 0) this.drawBanner(g);
  }

  drawFocus(g, it) {
    const x0 = it.x * TILE - 2;
    const y0 = this.view.itemTop(it) - 2;
    const x1 = (it.x + it.w) * TILE + 1;
    const y1 = (it.y + it.h) * TILE + 1;
    const c = Math.floor(this.time * 4) % 2 ? C.gold : '#fff6c8';
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      rect(g, sx > 0 ? x : x - 3, y, 4, 1, c);
      rect(g, x, sy > 0 ? y : y - 3, 1, 4, c);
    }
  }

  drawMarkers(g, s, now) {
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    for (const it of this.fl.items) {
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const top = this.view.itemTop(it) - 3;
      if (it.task) {
        const left = S.cooldownLeft(s, it.task.id, now);
        if (left > 0) {
          const t = formatTime(left);
          const w = measureText(t) + 12;
          rect(g, cx - w / 2, top - 10, w, 10, 'rgba(13,15,24,0.75)');
          icon(g, 'clock', cx - w / 2 + 1, top - 9);
          drawText(g, t, cx - w / 2 + 10, top - 9, { color: C.dim });
        } else {
          const y = top - 13 + bob;
          rect(g, cx - 5, y, 10, 12, C.border);
          rect(g, cx - 4, y + 1, 8, 10, C.gold);
          rect(g, cx - 1, y + 3, 2, 4, C.ink);
          rect(g, cx - 1, y + 8, 2, 2, C.ink);
          rect(g, cx - 1, y + 12, 2, 2, C.border);
          const best = s.bestByTask[it.task.id];
          if (best != null) for (let i = 0; i < 3; i++) rect(g, cx - 7 + i * 5, y - 4, 4, 3, i < best ? C.gold : '#4a5068');
        }
      } else if (it.interact === 'elevator') {
        if (s.floor === s.maxFloor && S.promotionStatus(s).can) {
          const y = top - 14 + bob;
          rect(g, cx - 6, y, 12, 12, C.border);
          rect(g, cx - 5, y + 1, 10, 10, C.good);
          icon(g, 'up', cx - 3, y + 3);
        }
      } else if (it.interact === 'hr') {
        const r = S.reviewStatus(s, now);
        const y = top - 24 + bob;
        if (r.state === 'available' || r.state === 'coffee') {
          rect(g, cx - 10, y, 20, 12, C.border);
          rect(g, cx - 9, y + 1, 18, 10, C.so);
          drawText(g, 'HR', cx, y + 3, { align: 'center', color: C.ink });
          rect(g, cx - 1, y + 12, 2, 2, C.border);
        } else if (r.state === 'cooldown') {
          const t = formatTime(r.left);
          const w = measureText(t) + 12;
          rect(g, cx - w / 2, y + 2, w, 10, 'rgba(13,15,24,0.75)');
          icon(g, 'clock', cx - w / 2 + 1, y + 3);
          drawText(g, t, cx - w / 2 + 10, y + 3, { color: C.dim });
        } else if (r.state === 'passed') icon(g, 'check', cx - 3, y + 4);
      } else if (it.terminal) {
        const y = top - 7 + bob;
        rect(g, cx - 8, y, 16, 10, C.border);
        rect(g, cx - 7, y + 1, 14, 8, '#070b08');
        drawText(g, '>', cx - 5, y + 1, { color: '#5fd068' });
        if (Math.floor(this.time * 2) % 2 === 0) rect(g, cx, y + 7, 4, 1, '#5fd068');
      } else if (it.interact === 'coffee') {
        if (S.cooldownLeft(s, `coffee-machine-${this.floorNo}`, now) <= 0) icon(g, 'coffee', cx - 3, top - 10 + bob);
      }
    }
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!t) return;
    let text = '';
    let sub = '';
    if (t.kind === 'npc') {
      text = 'Talk';
      sub = S.canFire(s) ? `${t.n.id.name} - decide their fate` : t.n.id.name;
    } else if (t.kind === 'terminal') {
      text = 'Workstation';
      sub = 'open terminal';
    }
    else if (t.kind === 'elevator') text = 'Elevator';
    else if (t.kind === 'coffee') text = 'Coffee machine';
    else if (t.kind === 'hr') {
      text = 'HR office';
      const r = S.reviewStatus(s, now);
      sub = { available: 'performance review', coffee: 'performance review', cooldown: `retry ${formatTime(r.left)}`, passed: 'review passed', notReady: 'not promotion-ready yet' }[r.state] || '';
    }
    else {
      text = t.it.task.title;
      const left = S.cooldownLeft(s, t.it.task.id, now);
      sub = left > 0 ? `busy ${formatTime(left)}` : `-${E.coffeeCost(this.floorNo)} coffee`;
    }
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    if (sub) drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
    if (t.kind === 'task') {
      const best = s.bestByTask[t.it.task.id];
      if (best != null) stars(g, best, x + w + 4, y + 5);
    }
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 3.5 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, this.game.corpColor().color);
    rect(g, 0, y + 33, W, 1, this.game.corpColor().color);
    drawText(g, `FLOOR ${this.floorNo} · ${floorName(this.floorNo).toUpperCase()}`, W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `${this.dept.name} department`, W / 2, y + 23, { align: 'center', color: C.gold });
    g.globalAlpha = 1;
  }
}
