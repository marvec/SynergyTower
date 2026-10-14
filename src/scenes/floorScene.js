// The main play scene: walk a floor, talk to colleagues, start tasks, use the elevator.
import { W, H } from '../engine/screen.js';
import { TILE, CHAR_H } from '../engine/art.js';
import { C, rect, panel, icon, stars, formatTime, formatNum, openCoffee } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { buildFloor } from '../core/tasks.js';
import { itemNeighbors, gatedWalk } from '../core/floorgen.js';
import { findPath } from '../core/pathfind.js';
import { createRng } from '../core/rng.js';
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { departmentForFloor, floorName, titleForFloor } from '../data/departments.js';
import { COMMON_NPC_LINES } from '../data/npcLines.js';
import { STANDUP_ASKS, STANDUP_NUDGES, STANDUP_THANKS } from '../data/standup.js';
import * as D from '../core/daily.js';
import { FIRED_LINES, KEPT_LINES } from '../data/people.js';
import { SPONSOR_PITCH, adPitch } from '../data/sponsors.js';
import { openFeedback } from '../engine/feedback.js';
import { track } from '../engine/analytics.js';
import { FloorView, Actor, NpcBrain, npcLook, npcIdentity, posterContent, suit } from './floorWorld.js';
import { Hud, HUD_H } from './hud.js';
import { TaskCard, ElevatorPanel, ShopOverlay, PerksOverlay, TrainOverlay, PauseMenu, Dialog, howToDialog, ReviewCard, hrNotice, FateDialog, ChatCard } from './overlays.js';
import { TerminalScene } from './terminal.js';
import { MinigameScene } from './minigameScene.js';
import { FloorQuest } from './floorQuest.js';
import { OfficeEvent } from './officeEvent.js';
import { DeskOverlay } from './deskOverlay.js';
import { BadgeWall } from './badgeWall.js';
import * as K from '../core/desk.js';
import * as V from '../core/events.js';
import { MINIGAMES } from '../minigames/index.js';
import * as Q from '../core/curios.js';
import { FRIDGE_LINES, PLANT_LINES, QUIPS } from '../data/curios.js';
import { FridgeCloseUp, PlantCloseUp, VendingCloseUp, FilesCloseUp } from './closeUp.js';
import * as T from '../core/trip.js';
import { CLIENTS, TRIP_TEASERS, TRIP_OFFER, TRIP_AFTER } from '../data/trip.js';
import * as L from '../core/vacation.js'; // leave
import { BOSS_TEASERS, BOSS_AFTER, VACATION_OFFER } from '../data/vacation.js';
import { isTouch } from '../engine/platform.js';
import * as CD from '../core/conduct.js';
import { fireCareer, FiredScene } from './fired.js';
import { nightLamps, drawNight } from './nightLights.js';
import * as N from '../core/nightShift.js';
import { NIGHT_TEASERS, NIGHT_OFFER, NIGHT_AFTER, NIGHT_GOODBYE, NIGHT_REFUSALS, NIGHT_GO_HOME, NIGHT_SUMMARY, NIGHT_SUMMARY_TITLE, NIGHT_SUMMARY_LINES } from '../data/nightShift.js';
import { ASK_LINES, ASK_AGAIN_LINES, FIRST_NO, REPEAT_NO, FROSTY_LINES, GOSSIP_LINES, HR_CALL_LINES, HR_PASSED_LINES, HR_FAILED_LINES, HOLD_INTRO } from '../data/conduct.js';

const SPEED = 4.4;
const R = 0.3;
const REACH = 1.05;
const TOP_MARGIN = 36;
const RECEPTIONIST_SEED = 4242;
const WALK_OUT_S = 8; // the night shift's walk-out: the lights go out after this at the latest
const NIGHT_QUEST_CLOSED = 'Closed for the night: that one needs your colleagues.';
// The receptionist's nudges while the new hire has not checked in yet.
const CHECKIN_NUDGES = [
  'Over here! New starters check in at the front desk.',
  'Front desk, please. I only bite on Mondays.',
  'Your badge will not print itself, you know.',
  'Check in with me and I will load your coffee card.',
];

export class FloorScene {
  /** Badges unlock only while a floor is on the stack (not on the title, setup or exterior screens). */
  inTower = true;
  /**
   * fl: a prebuilt floor instead of the tower's (the client's office on a business trip, see clientOffice.js).
   * nightSummary: the night shift that just ended here (finishNight), shown once as a card.
   */
  constructor(game, floor, { arrival = 'elevator', fl = null, nightSummary = null } = {}) {
    this.game = game;
    this.floorNo = floor;
    this.fl = fl || buildFloor(floor);
    this.foreign = !!(this.fl.client || this.fl.foreign); // a client's office or the hotel: no firing, events, stand-ups or trips
    this.nightSummary = nightSummary;
    // A night shift under way here (a reload, an elevator ride, a warp): the floor is empty and dark from the start.
    const night = this.night;
    this.nightFade = night ? 1 : 0; // darkness, 0..1: grows during the walk-out, full once everyone has left
    this.walkOut = null; // seconds since the walk-out started, while colleagues still head for the elevator
    this.dept = departmentForFloor(floor);
    this.view = new FloorView(this.fl, game.corpColor());
    const e = this.fl.entrance;
    // fl.arrive: a floor whose way in is not in the bottom wall (the vacation hotel's front door is at the top).
    const spawn = arrival === 'entrance' && e ? this.fl.arrive || { x: e.x + e.w / 2 - 0.1, y: this.fl.h - 2.2 } : { x: 19.9, y: 2.6 };
    this.player = new Actor(game.playerLook(), spawn.x, spawn.y);
    this.player.dir = arrival === 'entrance' && !this.fl.arrive ? 'up' : 'down';
    const fired = game.state.fired || {};
    const cast = S.castOf(game.state);
    this.npcs = this.fl.npcs
      .filter((n) => !fired[n.seed] && !night)
      .map((n) => {
        const a = new Actor(npcLook(n.seed, this.fl.dept, cast), n.x, n.y);
        const id = npcIdentity(n.seed, this.fl.dept, cast);
        a.who = { name: id.name, role: id.role };
        return { a, brain: new NpcBrain(a, this.fl, n.seed), seed: n.seed, id };
      });
    // The HR rep stands behind the review desk all day.
    const rep = this.fl.hrRep;
    this.hrRep = rep && !night ? new Actor(suit(npcLook(floor * 91 + 7, this.fl.dept, cast), '#4a3a6a', { glasses: true }), rep.x + 0.5, rep.y + 0.75) : null;
    if (this.hrRep) this.hrRep.who = { name: npcIdentity(floor * 91 + 7, 'legalhr', cast).name, role: 'HR Business Partner' };
    // Ground floor: the receptionist behind the front desk runs the new hire's check-in (see S.passTurnstile).
    const rc = this.fl.receptionist;
    const desk = this.frontDesk();
    this.receptionist = rc ? new Actor(suit(npcLook(desk.seed, 'lobby', cast), desk.uniform), rc.x + rc.w / 2, rc.y + 0.75) : null;
    if (this.receptionist) this.receptionist.who = { name: npcIdentity(desk.seed, 'lobby', cast).name, role: desk.role };
    this.nudgeT = 4;
    this.gateNag = 0;
    // Sponsorship posters on the hallway wall, as interactable pseudo-items (top = the wall's front face).
    this.posters = (this.fl.posters || []).map((p) => {
      const c = posterContent(p, floor);
      const x0 = Math.floor(c.x / TILE);
      return { x: x0, y: p.y, w: Math.ceil((c.x + c.w) / TILE) - x0, h: 1, top: p.y * TILE - 12, ad: c.ad };
    });
    // Curiosities: furniture that reacts when poked but is not gameplay (no focus brackets, no prompt). See core/curios.js.
    this.curios = this.fl.items.filter((it) => Q.curioOf(this.fl, it)).map((it) => ({ kind: 'curio', it }));
    this.pokes = new Map(); // item → its line memo (core/curios pickLine), so lines come at random without repeats
    this.rng = createRng(floor * 17 + Date.now());
    this.cam = { x: 0, y: 0 };
    this.snapCamera();
    this.pending = null;
    this.banner = 3.5;
    this.time = 0;
    this.stepT = 0;
    this.focus = null;
    this.quest = null; // active floor quest (360 Feedback, Lost Password)
    this.standupNpc = null; // the colleague with today's stand-up favour (core/daily.js)
    this.event = null; // a running random office event (officeEvent.js)
    this.onFloorS = 0;
    this.standupT = 0;
    this.taskMode = 'task'; // MinigameScene mode for this floor's stations
    // Business trip (core/trip.js): on floors 10 and 30 the first colleague is the account manager with the offer.
    this.tripNpc = !this.foreign && T.isTripFloor(floor) ? this.npcs.find((n) => n.seed === this.fl.npcs[0]?.seed) || null : null;
    if (this.tripNpc) this.tripNpc.a.who.role = 'Account Manager';
    // Vacation (core/vacation.js): on floor 20 the first colleague is your own manager, who signs leave requests.
    this.bossNpc = !this.foreign && floor === E.VACATION_FLOOR ? this.npcs.find((n) => n.seed === this.fl.npcs[0]?.seed) || null : null;
    if (this.bossNpc) this.bossNpc.a.who.role = 'Your Manager';
    // Night shift (core/nightShift.js): on floors 5, 15, 25 and 35 the first colleague is your manager, who offers it.
    this.nightBoss = !this.foreign && N.isNightFloor(floor) ? this.npcs.find((n) => n.seed === this.fl.npcs[0]?.seed) || null : null;
    if (this.nightBoss) this.nightBoss.a.who.role = 'Your Manager';
    // Conduct (core/conduct.js): one colleague per tower floor gets the coffee break chat, with the drink question.
    const chat = this.foreign || night ? null : CD.chatSeed(this.fl, floor);
    this.chatNpc = chat == null ? null : this.npcs.find((n) => n.seed === chat) || null;
    this.chatMemos = new Map(); // line list → pickLine memo, so answers come at random without repeats
    this.hrCallT = 2;
    this.teaseT = 5;
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
      coffee: openCoffee,
      badges: () => game.push(new BadgeWall(game)),
      menu: () => this.openMenu(),
    });
  }

  /** A night shift is under way on this floor (read live: the scene that accepts it switches at once). */
  get night() {
    return !this.foreign && this.game.state.nightShift?.floor === this.floorNo;
  }

  /** The floor's song; the night shift has its own. */
  get music() {
    return this.night ? 'nightshift' : this.dept.music;
  }

  enter() {
    this.game.state.floor = this.floorNo;
    this.game.markDirty();
    this.game.audio.play(this.music);
    const s = this.game.state;
    this.refreshStandup();
    if (this.standupNpc && !this.standupToast && !CD.onHold(s)) {
      this.standupToast = true;
      this.game.toast(`Daily stand-up: ${this.standupNpc.id.name} is looking for you.`, C.xp);
    }
    if (CD.lockedOut(s)) this.startLockout(); // a career saved in that state (reloaded): finish the job
    const checkin = s.lobby === 'checkin' && this.receptionist;
    if (checkin) this.receptionist.say(`Welcome, ${s.player.name}! Please check in at the front desk.`, 6);
    if (!s.flags.introSeen) {
      s.flags.introSeen = true;
      this.game.push(
        new Dialog(this.game, {
          title: `Welcome to ${s.corp.name}!`,
          w: 320,
          text:
            `Congratulations, ${s.player.name}! You are our newest ${titleForFloor(1)}.\n` +
            'Complete tasks marked with ! to earn paperclips, XP and KPI stars. Hit the star quota, level up, save up for the keycard fee and pass your HR performance review - then the elevator takes you up.\n' +
            '40 floors. One corner office. Good luck!' +
            (checkin ? '\nFirst stop: the front desk, for your badge and your coffee card.' : ''),
          button: "Let's synergize",
        }),
      );
    }
    if (this.nightSummary) this.showNightSummary();
  }

  resume() {
    this.game.audio.play(this.music);
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
  /** Your desk on this floor (core/desk.js): every floor you have reached, floor 1 once checked in. */
  get hasDesk() {
    return !!this.fl.myDesk && K.hasDesk(this.game.state, this.floorNo);
  }

  /** The lobby turnstiles stay shut until the new hire has checked in and paid their first cup. */
  get gateClosed() {
    return !!this.fl.turnstile && this.game.state.lobby !== 'done';
  }
  walkGrid() {
    if (!this.gateClosed) return this.fl.walk;
    return (this.gatedGrid ||= gatedWalk(this.fl));
  }
  walkableAt(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const { fl } = this;
    if (tx < 0 || ty < 0 || tx >= fl.w || ty >= fl.h) return false;
    return !!this.walkGrid()[ty * fl.w + tx];
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
    const list = [...(this.event?.interactables() || [])];
    for (const it of this.fl.items) {
      if (it.task) list.push({ kind: 'task', it });
      else if (it.interact === 'elevator') list.push({ kind: 'elevator', it });
      else if (it.interact === 'coffee') list.push({ kind: 'coffee', it });
      else if (it.interact === 'hr') list.push({ kind: 'hr', it });
      else if (it.interact === 'turnstile' && this.gateClosed) list.push({ kind: 'turnstile', it });
      else if (it.terminal) list.push({ kind: 'terminal', it });
      else if (it === this.fl.myDesk && this.hasDesk) list.push({ kind: 'mydesk', it });
    }
    for (const n of this.npcs) if (!n.brain.exit) list.push({ kind: 'npc', n });
    for (const b of this.quest?.props || []) list.push({ kind: 'board', it: b.it, b });
    for (const it of this.posters) list.push({ kind: 'poster', it });
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
  /** Curios that can be poked right now (the open turnstile and an unassigned desk only say something). */
  curioTargets() {
    return this.curios.filter((t) => !(t.it.interact === 'turnstile' && this.gateClosed) && !(t.it === this.fl.myDesk && this.hasDesk));
  }
  nearest(list = this.interactables()) {
    let best = null;
    let bd = REACH;
    for (const t of list) {
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
    // Someone walking out (fired, or the auditor leaving) may still be a stale click target: let them go.
    if (t.kind === 'npc' && t.n.brain.exit) return;
    const ev = this.event;
    if (ev) {
      if (ev.onInteract(t)) {
        if (t.kind !== 'npc') p.faceTowards(t.it.x + t.it.w / 2 - p.x, t.it.y + t.it.h / 2 - p.y);
        return;
      }
      const msg = ev.blocks(t);
      if (msg) {
        game.sfx('bad');
        game.toast(msg, C.warn);
        return;
      }
    }
    const q = this.quest;
    if (q) {
      if (t.kind === 'board') {
        p.faceTowards(t.b.x - p.x, t.b.y - p.y);
        return q.inspect(t.b);
      }
      if (t.kind === 'npc' && q.onTalk(t.n)) {
        p.faceTowards(t.n.a.x - p.x, t.n.a.y - p.y);
        t.n.a.faceTowards(p.x - t.n.a.x, p.y - t.n.a.y);
        t.n.a.path = null;
        return;
      }
      if (t.kind === 'task' && q.isStation(t.it)) return q.atStation();
      if (['task', 'elevator', 'hr', 'terminal'].includes(t.kind)) {
        game.sfx('bad');
        game.toast(`Busy with "${q.task.title}". Finish it or give up (G).`, C.warn);
        return;
      }
    }
    const hold = CD.onHold(s);
    if (hold && ['task', 'elevator', 'terminal', 'mydesk'].includes(t.kind)) {
      game.sfx('bad');
      game.toast('Compliance hold: complete your training at the HR office first.', C.bad);
      this.hrRep?.say(this.chatLine(HR_CALL_LINES), 3);
      return;
    }
    // The night shift: the workstations are locked and the floor quests need colleagues who have gone home.
    const night = this.night;
    if (night && (t.kind === 'terminal' || (t.kind === 'task' && MINIGAMES[t.it.task.game].quest))) {
      game.sfx('bad');
      game.toast(t.kind === 'terminal' ? 'The workstations are locked for the night.' : NIGHT_QUEST_CLOSED, C.warn);
      return;
    }
    if (t.kind === 'npc') {
      const a = t.n.a;
      a.faceTowards(p.x - a.x, p.y - a.y);
      p.faceTowards(a.x - p.x, a.y - p.y);
      t.n.brain.talkPause = 3.5;
      a.path = null;
      const trip = t.n === this.tripNpc ? T.tripStatus(s, this.floorNo) : null;
      if (trip === 'available' && !q && !ev && !hold) return this.askTrip(t.n);
      const leave = t.n === this.bossNpc ? L.vacationStatus(s, this.floorNo, game.now()) : null;
      if (leave === 'available' && !q && !ev && !hold) return this.askVacation(t.n);
      const shift = t.n === this.nightBoss ? N.nightStatus(s, this.floorNo, game.now()) : null;
      if (shift === 'available' && !q && !ev && !hold) return this.askNight(t.n);
      if (shift === 'blocked' || shift === 'available') return this.refuseNight(t.n); // available but a quest or event runs
      if (t.n === this.standupNpc && !q && !hold) return this.askStandup(t.n);
      if (t.n === this.chatNpc && !q && !ev) return this.openChat(t.n);
      const tripAfter = trip && trip !== 'available' && this.rng.chance(0.5) ? this.rng.pick(TRIP_AFTER[trip]) : null;
      const after =
        tripAfter ||
        (leave === 'today' && this.rng.chance(0.5) ? this.rng.pick(BOSS_AFTER) : null) ||
        (shift === 'today' && this.rng.chance(0.5) ? this.rng.pick(NIGHT_AFTER) : null);
      const line = q?.hintLine(t.n) || after || this.nextLine();
      a.say(line);
      game.sfx('blip');
      if (S.canFire(s) && !q && !this.foreign) {
        game.push(new FateDialog(game, { npc: t.n, line, dept: this.dept.name, floor: this.floorNo, onFire: () => this.fire(t.n), onKeep: () => this.keep(t.n) }));
      }
      return;
    }
    const it = t.it;
    p.faceTowards(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y);
    if (t.kind === 'curio') {
      this.poke(it);
    } else if (t.kind === 'task') {
      game.sfx('click');
      if (it.task.checkin && s.lobby === 'checkin') this.receptionist?.say('Quick test before your badge: spot the buzzwords!', 4);
      const peek = Q.closeUpOf(this.fl, it) ? () => this.poke(it) : null;
      game.push(new TaskCard(game, it.task, (task) => this.startTask(task), { peek, trip: this.taskMode === 'trip' }));
    } else if (t.kind === 'turnstile') {
      this.useTurnstile();
    } else if (t.kind === 'mydesk') {
      game.sfx('click');
      game.push(new DeskOverlay(game, this.floorNo, this.view));
    } else if (t.kind === 'elevator') {
      game.sfx('ding');
      if (night) return this.askGoHome();
      game.push(new ElevatorPanel(game, { onPromote: () => this.promote(), onTravel: (f) => this.travel(f) }));
    } else if (t.kind === 'hr') {
      const r = S.reviewStatus(s, game.now());
      game.sfx('click');
      if (night) {
        game.sfx('bad');
        game.toast('HR has gone home. Come back in the morning.', C.dim);
      } else if (hold) {
        this.hrRep?.say('Sit down. This will not take long. Well, it might.', 3);
        game.push(new Dialog(game, { title: 'HR Office · Compliance hold', w: 320, text: HOLD_INTRO(s.maxFloor), button: 'Later', action: { label: 'Start the training', color: C.goodBtn, onClick: () => this.startCompliance() } }));
      } else if (['available', 'cooldown', 'coffee'].includes(r.state)) {
        this.hrRep?.say('Have a seat. Let us talk about your growth.', 2.5);
        game.push(new ReviewCard(game, () => this.startReview()));
      } else {
        this.hrRep?.say(r.state === 'passed' ? 'Congratulations again!' : 'Do you have an appointment?', 2.5);
        hrNotice(game, r.state);
      }
    } else if (t.kind === 'terminal') {
      game.sfx('click');
      game.push(new TerminalScene(game, { floor: this.floorNo, ws: it.id, onWarp: (f) => this.warp(f) }));
    } else if (t.kind === 'poster') {
      game.sfx('click');
      track('poster_view', { kind: t.it.ad ? 'ad' : 'sponsor' });
      const action = { label: 'Advertise here', onClick: () => openFeedback(`poster on floor ${this.floorNo}`, 'sponsor') };
      game.push(new Dialog(game, { ...(t.it.ad ? adPitch(t.it.ad) : SPONSOR_PITCH), w: 280, action }));
    } else if (t.kind === 'coffee') {
      const r = this.useCoffee();
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

  /** The floor's coffee machine (a client's brewer refills sooner, see clientOffice.js; so does the night machine). */
  useCoffee() {
    if (this.night) return N.useNightBrewer(this.game.state, this.game.now());
    return S.useCoffeeMachine(this.game.state, this.floorNo, this.game.now());
  }
  get brewerKey() {
    return this.night ? N.BREWER_KEY : `coffee-machine-${this.floorNo}`;
  }

  /** The account manager's business trip offer (floors 10 and 30, once per career). */
  askTrip(n) {
    const game = this.game;
    n.brain.talkPause = 6;
    game.sfx('blip');
    game.push(
      new Dialog(game, {
        title: `${n.id.name} · Business trip`,
        w: 320,
        text: TRIP_OFFER(CLIENTS[this.floorNo]),
        button: 'Not now',
        action: { label: 'Grab the keys', onClick: () => this.startTrip() },
      }),
    );
  }

  async startTrip() {
    const game = this.game;
    if (this.quest || this.event) return game.toast('Finish what you are doing first.', C.warn);
    if (!T.departTrip(game.state, this.floorNo).ok) return;
    track('trip_start', { floor: this.floorNo });
    game.saveNow();
    const { DriveScene } = await import('./driveScene.js');
    game.set(new DriveScene(game, this.floorNo));
  }

  /** Your manager on floor 20 signs a leave request: a stay at the hotel for paperclips, once a day. `cost` 0 is __vacation(). */
  askVacation(n, cost = E.VACATION_COST) {
    const game = this.game;
    const s = game.state;
    n.brain.talkPause = 6;
    game.sfx('blip');
    const missing = cost - s.sp;
    const text = VACATION_OFFER(formatNum(E.VACATION_COST)) + (missing > 0 ? `\nYou are ${formatNum(missing)} paperclips short.` : '');
    game.push(
      new Dialog(game, {
        title: `${n.id.name} · Leave request`,
        w: 330,
        text,
        button: 'Not now',
        action: { label: `Go on vacation (${cost ? formatNum(cost) : 'free'})`, disabled: missing > 0, onClick: () => this.startVacation(cost) },
      }),
    );
  }

  async startVacation(cost = E.VACATION_COST) {
    const game = this.game;
    if (this.quest || this.event) return game.toast('Finish what you are doing first.', C.warn);
    if (!L.requestVacation(game.state, this.floorNo, game.now(), cost).ok) return;
    track('vacation_start', { floor: this.floorNo });
    game.sfx('cash');
    game.saveNow();
    const { HotelScene } = await import('./hotel.js');
    game.set(new HotelScene(game));
  }

  /** Your manager hints at the unused holiday now and then while today's leave is still on offer. */
  updateBossTease(dt) {
    const n = this.bossNpc;
    if (!n || n.brain.exit || n.a.bubble || this.quest || this.event) return;
    if (L.vacationStatus(this.game.state, this.floorNo, this.game.now()) !== 'available') return;
    if (Math.hypot(n.a.x - this.player.x, n.a.y - this.player.y) > 8) return;
    this.teaseT -= dt;
    if (this.teaseT > 0) return;
    this.teaseT = 16;
    n.a.say(Q.pickLine(BOSS_TEASERS, (this.teaseMemo ||= {})), 4);
  }

  /** Your manager on floors 5, 15, 25 and 35 asks for a volunteer for tonight's shift (once a day, free). */
  askNight(n) {
    const game = this.game;
    n.brain.talkPause = 6;
    game.sfx('blip');
    game.push(
      new Dialog(game, {
        title: `${n.id.name} · Night shift`,
        w: 330,
        text: NIGHT_OFFER(E.NIGHT_SHIFT_S / 60),
        button: 'Not now',
        action: { label: 'Start the shift', onClick: () => this.startNight() },
      }),
    );
  }

  /** No shift right now: your manager says why (a compliance hold, no badge yet, or something else going on). */
  refuseNight(n) {
    n.a.say(NIGHT_REFUSALS[N.nightBlock(this.game.state) || 'busy'], 3.5);
    this.game.sfx('blip');
  }

  /** Accepting the shift: everyone goes home, the lights go out and the machines speed up (core/nightShift.js). */
  startNight() {
    const game = this.game;
    const s = game.state;
    if (this.quest || this.event) return game.toast('Finish what you are doing first.', C.warn);
    if (!N.startNightShift(s, this.floorNo, game.now()).ok) return;
    this.standupNpc = null;
    this.chatNpc = null;
    if (this.hrRep) this.hrRep.bubble = null;
    this.nightBoss?.a.say(this.rng.pick(NIGHT_GOODBYE), 3);
    this.nightBoss = null;
    this.startWalkOut();
    game.audio.play(this.music);
    game.toast(`Night shift: ${E.NIGHT_SHIFT_S / 60} minutes, and the machines are all yours.`, C.gold);
    track('night_start', { floor: this.floorNo });
    game.markDirty();
    game.saveNow();
  }

  /** Colleagues and the HR rep head for the elevator (the CEO-firing exit); see updateWalkOut. */
  startWalkOut() {
    const fl = this.fl;
    const ex = Math.floor(fl.spawn.x);
    const ey = Math.floor(fl.spawn.y);
    for (const n of this.npcs) n.brain.leave(ex, ey);
    // The HR rep stands behind a solid desk: they step out beside it first, then walk like everyone else.
    const a = this.hrRep;
    const rep = fl.hrRep;
    if (a && rep) {
      const free = itemNeighbors(fl, rep)
        .filter(([x, y]) => fl.walk[y * fl.w + x] && fl.dist[y * fl.w + x] >= 0)
        .sort(([x1, y1], [x2, y2]) => Math.hypot(x1 + 0.5 - a.x, y1 + 0.5 - a.y) - Math.hypot(x2 + 0.5 - a.x, y2 + 0.5 - a.y));
      if (free.length) {
        a.x = free[0][0] + 0.5;
        a.y = free[0][1] + 0.5;
        const brain = new NpcBrain(a, fl, this.floorNo * 91 + 7);
        brain.leave(ex, ey);
        this.npcs.push({ a, brain, seed: this.floorNo * 91 + 7, id: a.who });
      }
    }
    this.hrRep = null;
    this.walkOut = 0;
    this.nightFade = 0;
  }

  /** One ding for the whole walk-out: when the last one is gone, or after WALK_OUT_S for anyone still walking. */
  updateWalkOut(dt) {
    this.walkOut += dt;
    this.nightFade = Math.min(1, this.walkOut / WALK_OUT_S);
    if (this.npcs.length && this.walkOut < WALK_OUT_S) return;
    this.npcs = [];
    this.walkOut = null;
    this.nightFade = 1;
    this.game.sfx('ding');
  }

  /** Your manager hints at the night shift now and then while today's is still on offer. */
  updateNightTease(dt) {
    const n = this.nightBoss;
    if (!n || n.brain.exit || n.a.bubble || this.quest || this.event) return;
    if (Math.hypot(n.a.x - this.player.x, n.a.y - this.player.y) > 8) return;
    this.teaseT -= dt;
    if (this.teaseT > 0) return;
    this.teaseT = 16;
    if (N.nightStatus(this.game.state, this.floorNo, this.game.now()) !== 'available') return;
    n.a.say(Q.pickLine(NIGHT_TEASERS, (this.teaseMemo ||= {})), 4);
  }

  /** The elevator at night: going home ends the shift (today's is used up either way). */
  askGoHome() {
    const game = this.game;
    game.push(
      new Dialog(game, {
        title: 'Go home early?',
        w: 300,
        text: NIGHT_GO_HOME(formatTime(N.nightLeft(game.state, game.now()))),
        button: 'Keep working',
        action: { label: 'Go home', onClick: () => this.finishNight(true) },
      }),
    );
  }

  /** The shift is over (gone home early, or the time is up with the floor on top): the daytime floor and a summary. */
  finishNight(early = false) {
    if (this.endingNight) return;
    this.endingNight = true;
    const game = this.game;
    const sum = N.endNightShift(game.state) || { floor: this.floorNo, tasks: 0, sp: 0, stars: 0, coffee: 0 };
    track('night_end', { floor: this.floorNo, sp: sum.sp, tasks: sum.tasks, early });
    game.saveNow();
    game.set(new FloorScene(game, this.floorNo, { arrival: 'elevator', nightSummary: { ...sum, early } }));
  }

  /** The morning after (or going home early): one card with the shift's tally. */
  showNightSummary() {
    const sum = this.nightSummary;
    this.nightSummary = null;
    const kind = sum.early ? 'early' : 'done';
    this.game.push(
      new Dialog(this.game, {
        title: NIGHT_SUMMARY_TITLE[kind],
        w: 300,
        text: NIGHT_SUMMARY({ ...sum, sp: formatNum(sum.sp) }, this.rng.pick(NIGHT_SUMMARY_LINES[kind])),
      }),
    );
  }

  /** Now and then the account manager calls out the trip while the player is around (it is a secret, not a hidden one). */
  updateTripTease(dt) {
    const n = this.tripNpc;
    if (!n || n.brain.exit || n.a.bubble || this.quest || this.event) return;
    if (T.tripStatus(this.game.state, this.floorNo) !== 'available') return;
    if (Math.hypot(n.a.x - this.player.x, n.a.y - this.player.y) > 8) return;
    this.teaseT -= dt;
    if (this.teaseT > 0) return;
    this.teaseT = 16;
    n.a.say(Q.pickLine(TRIP_TEASERS, (this.teaseMemo ||= {})), 4);
  }

  /** The lobby turnstiles: closed before check-in, one cup for the first way in. */
  useTurnstile() {
    const game = this.game;
    const s = game.state;
    const r = S.passTurnstile(s, game.now());
    this.gateNag = 2.5;
    if (r.ok) {
      game.sfx('coin');
      track('turnstile');
      game.toast(`Beep! -${r.cost} coffee. Welcome to ${s.corp.name}!`, C.coffee);
      this.receptionist?.say('Have a synergistic day!', 3.5);
      game.saveNow();
      return;
    }
    game.sfx('bad');
    if (r.reason === 'checkin') {
      this.receptionist?.say('Not so fast! Check in at the front desk first.', 3.5);
      game.toast('No badge yet: check in at the front desk.', C.warn);
    } else game.toast(`The turnstile wants ${E.TURNSTILE_COFFEE} coffee. Next cup in ${formatTime(S.msToNextCoffee(s, game.now()))}.`, C.warn);
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

  /** Today's stand-up colleague on this floor: picked by day and floor among the colleagues still here. */
  refreshStandup() {
    const s = this.game.state;
    const now = this.game.now();
    if (this.foreign || this.night || D.standupStatus(s, now) !== 'pending') {
      this.standupNpc = null;
      return;
    }
    const day = D.dayKey(now);
    if (this.standupNpc && this.standupDay === day && !this.standupNpc.brain.exit) return;
    // Not the account manager, your manager or the coffee-chat colleague: their own card would hide the favour.
    const pool = this.npcs.filter((n) => !n.brain.exit && n !== this.tripNpc && n !== this.bossNpc && n !== this.nightBoss && n !== this.chatNpc);
    let h = this.floorNo;
    for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.standupNpc = pool.length ? createRng(h).pick(pool) : null;
    this.standupDay = day;
  }

  askStandup(n) {
    const game = this.game;
    const mg = MINIGAMES[D.standupGame(D.dayKey(game.now()))];
    n.brain.talkPause = 6;
    n.a.say(this.rng.pick(STANDUP_NUDGES), 3);
    game.sfx('blip');
    game.push(
      new Dialog(game, {
        title: `${n.id.name} · Daily stand-up`,
        w: 300,
        text:
          `"${this.rng.pick(STANDUP_ASKS).replace('{game}', mg.name)}"\n` +
          `Free to play, once a day. Bonus: double paperclips, +${E.STANDUP_COFFEE} coffee and a chance of a Stock Option (a sure one every ${E.STANDUP_STREAK_SO}th day in a row).`,
        button: 'Later',
        action: { label: 'Sure!', onClick: () => this.startStandup(n) },
      }),
    );
  }

  startStandup(n) {
    const game = this.game;
    const now = game.now();
    if (D.standupStatus(game.state, now) !== 'pending') return;
    const day = D.dayKey(now);
    const f = this.floorNo;
    const task = { id: `standup-${day}`, day, game: D.standupGame(day), title: 'Daily stand-up favour', difficulty: Math.min(1, ((f - 1) / 39) * 0.85 + 0.075), seed: f * 977 + day.length };
    game.push(
      new MinigameScene(game, task, (r) => {
        if (!r?.standup) return;
        this.standupNpc = null;
        n.a.say(this.rng.pick(STANDUP_THANKS), 4);
      }, { mode: 'standup' }),
    );
  }

  // ------------------------------------------------------------ conduct (core/conduct.js)
  /** A line from the list at random, without repeats until the list is used up. */
  chatLine(list) {
    if (!this.chatMemos.has(list)) this.chatMemos.set(list, {});
    return Q.pickLine(list, this.chatMemos.get(list));
  }

  /** Small talk with the chat colleague: office talk, or frosty once they have said no three times or reported you. */
  chatSmallTalk(n) {
    const c = CD.conduct(this.game.state);
    return (c.refused[n.seed] || 0) >= 3 || c.reported?.[n.seed] ? this.chatLine(FROSTY_LINES) : this.nextLine();
  }

  /** The coffee break chat card: small talk, the drink question (every ask is a strike), bye. */
  openChat(n) {
    const game = this.game;
    n.brain.talkPause = 8;
    const line = this.chatSmallTalk(n);
    n.a.say(line, 3.5);
    game.sfx('blip');
    game.push(
      new ChatCard(game, {
        npc: n,
        line,
        dept: this.dept.name,
        floor: this.floorNo,
        onTalk: () => {
          n.brain.talkPause = 8;
          const l = this.chatSmallTalk(n);
          n.a.say(l, 3.5);
          game.sfx('blip');
          return l;
        },
        onAsk: () => this.askOut(n),
      }),
    );
  }

  askOut(n) {
    const game = this.game;
    const s = game.state;
    const again = CD.askState(s, n.seed) === 'again';
    const r = CD.askOut(s, n.seed, game.now());
    if (!r) return null;
    n.brain.talkPause = 8;
    this.player.say(this.chatLine(again ? ASK_AGAIN_LINES : ASK_LINES), 1.6);
    // A colleague asked for the first time says a polite no; after that the answers follow the strike count.
    const level = r.hold ? REPEAT_NO.length : Math.min(r.strike, REPEAT_NO.length - 1);
    const line = r.kind === 'first' && !r.hold ? this.chatLine(FIRST_NO) : this.chatLine(REPEAT_NO[level - 1]);
    n.a.say(line, 4.5, 1.2); // the answer, once the question has been asked
    track('ask_out', { strike: r.strike, floor: s.maxFloor });
    game.markDirty();
    game.saveNow();
    game.sfx('bad');
    if (r.strike >= 3 && !r.hold) this.gossip(n);
    if (r.hold) this.startHold();
    return { line, strike: r.strike, hold: r.hold };
  }

  /** Someone else nearby has noticed. */
  gossip(about) {
    const p = this.player;
    const near = this.npcs.filter((m) => m !== about && !m.brain.exit && !m.a.bubble && Math.hypot(m.a.x - p.x, m.a.y - p.y) < 9);
    if (!near.length) return;
    const m = this.rng.pick(near);
    m.a.say(this.chatLine(GOSSIP_LINES), 4.5, 2.5);
  }

  startHold() {
    const game = this.game;
    if (CD.lockedOut(game.state)) return this.startLockout();
    track('compliance_hold', { floor: game.state.maxFloor });
    game.sfx('fail');
    game.toast('Compliance hold! Report to the HR office for training.', C.bad);
    this.hrCallT = 1.5;
  }

  /** On hold without a badge (CD.lockedOut): reception calls security, and a few seconds later the career is over. */
  startLockout() {
    if (this.firingT) return;
    const game = this.game;
    game.sfx('fail');
    game.toast('Reported to HR before you even got your badge. Security!', C.bad);
    this.receptionist?.say('No badge, no job. Security!', 4);
    this.firingT = 3;
  }
  updateLockout(dt) {
    this.firingT -= dt;
    this.player.update(dt);
    this.receptionist?.update(dt);
    for (const n of this.npcs) n.a.update(dt);
    if (this.firingT > 0 || this.fired) return;
    this.fired = true;
    this.game.set(new FiredScene(this.game, fireCareer(this.game, 'checkin')));
  }

  /** On hold, the HR rep calls you in now and then. */
  updateHrCall(dt) {
    const r = this.hrRep;
    if (!r || r.bubble || this.night || !CD.onHold(this.game.state)) return;
    this.hrCallT -= dt;
    if (this.hrCallT > 0) return;
    this.hrCallT = 14;
    r.say(this.chatLine(HR_CALL_LINES), 4);
  }

  /** The compliance training at the HR desk: pass and the hold is lifted; fail and you go down a floor. */
  startCompliance() {
    const game = this.game;
    const s = game.state;
    if (!CD.onHold(s)) return;
    const f = s.maxFloor;
    const task = { id: 'compliance', game: 'compliance', title: 'Compliance & Ethics', difficulty: Math.min(1, ((f - 1) / 39) * 0.8 + 0.1), seed: f * 13 + 5 };
    game.push(
      new MinigameScene(game, task, async (r) => {
        if (!r?.compliance) return;
        this.hrRep?.say(this.chatLine(r.passed ? HR_PASSED_LINES : HR_FAILED_LINES), 4);
        if (r.passed) return game.toast('Training complete. The compliance hold is lifted.', C.good);
        if (this.floorNo <= s.floor) return game.toast(`Demoted to ${titleForFloor(r.to)}. Your HR review is due again.`, C.warn);
        // You lost the floor you are standing on: the elevator takes you down to your new desk.
        const { ElevatorRide } = await import('./elevatorRide.js');
        game.set(new ElevatorRide(game, this.floorNo, s.floor, { promoted: false }));
      }, { mode: 'compliance' }),
    );
  }

  /** Starts a random office event now (or the given kind, e.g. from the console: `__game.top.startEvent('cake')`). */
  startEvent(kind) {
    const game = this.game;
    const list = V.availableEvents(this.fl);
    const k = kind && list.includes(kind) ? kind : V.pickEvent(this.rng, list);
    V.scheduleNext(game.state, game.now(), this.rng);
    game.markDirty();
    this.event = new OfficeEvent(this, k);
  }

  startTask(task) {
    // The night shift's clock ran out while a card was open: end it instead (the floor is back on top).
    if (this.night && !N.nightActive(this.game.state, this.game.now())) return this.finishNight();
    if (MINIGAMES[task.game].quest) {
      if (this.night) return this.game.toast(NIGHT_QUEST_CLOSED, C.warn);
      if (this.event) {
        this.game.toast('Better wait until the office event is over.', C.warn);
        return;
      }
      this.quest = new FloorQuest(this, task);
      return;
    }
    this.game.push(new MinigameScene(this.game, task, (result) => this.taskDone(result), { mode: this.night ? 'night' : this.taskMode }));
  }

  async taskDone(result) {
    if (result?.checkedIn) {
      const s = this.game.state;
      track('checkin', { stars: result.stars });
      this.receptionist?.say('Welcome aboard! The turnstiles behind me take one cup.', 6);
      this.game.toast(`Coffee card loaded: ${s.coffee.value} cups. It refills by itself from now on.`, C.coffee);
    }
    if (result?.ceoUnlocked) {
      const { EndingScene } = await import('./ending.js');
      this.game.push(new EndingScene(this.game));
    }
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
    track('promotion', { floor: game.state.maxFloor });
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

  /** Pokes a curiosity: a close-up for the fridge, plants and HR files, otherwise the player says something about it. */
  poke(it) {
    const game = this.game;
    const fl = this.fl;
    const seed = Q.itemSeed(fl, it);
    const kind = Q.closeUpOf(fl, it);
    const memo = this.pokes.get(it) || {};
    this.pokes.set(it, memo);
    // What the player says about it: on leaving a close-up, or straight away.
    const say = (list) => {
      const line = Q.pickLine(list, memo);
      if (line) this.player.say(line, 2.5 + line.length / 25);
    };
    if (kind === 'fridge') {
      game.sfx('click');
      game.push(new FridgeCloseUp(game, { seed, onClose: () => say(FRIDGE_LINES) }));
    } else if (kind === 'plant') {
      game.sfx('click');
      game.push(new PlantCloseUp(game, { seed, onClose: () => say(PLANT_LINES) }));
    } else if (kind === 'vending') {
      game.sfx('click');
      game.push(new VendingCloseUp(game, { seed, onClose: () => say(QUIPS.vending) }));
    } else if (kind === 'files') {
      game.sfx('click');
      game.push(new FilesCloseUp(game, { people: this.personnel(), floor: this.floorNo }));
    } else {
      const line = Q.quipFor(fl, it, memo);
      if (!line) return;
      game.sfx('blip');
      this.player.say(line, 2.5 + line.length / 25);
    }
  }

  /** Who stands behind the front desk, in what uniform (the vacation hotel has a concierge of its own). */
  frontDesk() {
    return { seed: RECEPTIONIST_SEED, uniform: this.game.corpColor().color, role: 'Reception' };
  }

  /** Everyone HR keeps a folder on: colleagues on this and the neighbouring floors (let-go ones too), the HR rep, the receptionist and you. */
  personnel() {
    const s = this.game.state;
    const fired = s.fired || {};
    // The cabinet also holds the floors just below and above (HR shares the drawers, and the dust).
    const floors = [this.floorNo, this.floorNo - 1, this.floorNo + 1].filter((f) => f >= 1 && f <= 40);
    const people = floors.flatMap((f) => {
      const fl = buildFloor(f);
      return fl.npcs.map((n) => {
        const id = npcIdentity(n.seed, fl.dept, S.castOf(s));
        return { name: id.name, role: id.role, seed: n.seed, years: id.years, note: id.note, fired: !!fired[n.seed], floor: f };
      });
    });
    if (this.hrRep) people.push({ ...this.hrRep.who, seed: this.floorNo * 91 + 7, floor: this.floorNo });
    if (this.receptionist) people.push({ ...this.receptionist.who, seed: this.frontDesk().seed, floor: 1 });
    people.push({ name: s.player?.name || 'New Hire', role: 'You', you: true, file: Q.playerFile(s) });
    return people;
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

  /** Item or NPC under a world-space point; curios only when no gameplay target is there. */
  pick(wx, wy) {
    // Walk-through decor (chairs, stools, beanbags) only answers a click within reach, so clicks still walk over it.
    const curios = this.curioTargets().filter((t) => t.it.solid !== false || this.distTo(t) <= REACH);
    return this.pickIn(wx, wy, this.interactables()) || this.pickIn(wx, wy, curios);
  }
  pickIn(wx, wy, list) {
    let hit = null;
    let hitBase = -1;
    for (const t of list) {
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
    const walk = this.walkGrid();
    for (const [gx, gy] of goals) {
      if (!walk[gy * fl.w + gx]) continue;
      const path = findPath(walk, fl.w, fl.h, sx, sy, gx, gy);
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

    if (this.firingT) return this.updateLockout(dt);
    // The night shift's time is up: it ends once the floor is on top again (a mini-game or card is never cut short).
    if (this.night && game.top === this && !N.nightActive(game.state, game.now())) return this.finishNight();
    const hudUsed = this.hud.update(dt, input);
    if (input.back()) {
      game.sfx('click');
      return this.openMenu();
    }
    if (input.pressedExact('h') || input.pressedExact('?')) game.push(howToDialog(game));
    if (this.quest) {
      if (input.pressedExact('g')) this.quest.giveUp();
      else this.quest.update(dt);
    }
    this.onFloorS += dt;
    if (this.event) {
      this.event.update(dt);
      if (this.event.over) this.event = null;
    } else if (!this.quest && !this.foreign && !this.night && !CD.onHold(game.state) && V.canStartEvent(game.state, game.now(), { onFloorS: this.onFloorS, busy: false })) this.startEvent();

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
      if (ky < 0) this.bumpGate();
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
      p.bubble = null; // what the player said about something goes away once they walk on
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
    if (input.confirm()) {
      const t = this.focus || this.nearest(this.curioTargets());
      if (t) this.interact(t);
    }

    for (const n of this.npcs) {
      n.brain.update(dt, (x, y) => Math.hypot(x - p.x, y - p.y) < 0.45);
      n.a.update(dt);
      if (n.brain.gone && this.walkOut == null) game.sfx('ding');
    }
    this.npcs = this.npcs.filter((n) => !n.brain.gone);
    if (this.walkOut != null) this.updateWalkOut(dt);
    p.update(dt);
    this.hrRep?.update(dt);
    this.updateReceptionist(dt);
    this.updateTripTease(dt);
    this.updateBossTease(dt);
    this.updateNightTease(dt);
    this.updateHrCall(dt);
    this.standupT -= dt;
    if (this.standupT <= 0) {
      this.standupT = 1;
      this.refreshStandup();
    }

    const t = this.camTarget();
    const k = Math.min(1, dt * 8);
    this.cam.x += (t.x - this.cam.x) * k;
    this.cam.y += (t.y - this.cam.y) * k;
  }

  /** Walking up into the closed turnstiles tries them, like a badge tap. */
  bumpGate() {
    const t = this.fl.turnstile;
    const p = this.player;
    if (!this.gateClosed || this.gateNag > 0 || this.quest) return;
    if (p.x > t.x && p.x < t.x + t.w && p.y < t.y + 1 + R + 0.1 && p.y > t.y + 1) this.useTurnstile();
  }

  updateReceptionist(dt) {
    const r = this.receptionist;
    if (!r) return;
    this.gateNag = Math.max(0, this.gateNag - dt);
    r.update(dt);
    const p = this.player;
    r.faceTowards(p.x - r.x, Math.max(0.1, p.y - r.y));
    // Until check-in, an occasional friendly nudge while the new hire looks lost.
    if (this.game.state.lobby !== 'checkin' || r.bubble) return;
    this.nudgeT -= dt;
    if (this.nudgeT > 0) return;
    this.nudgeT = 12;
    this.nudgeI = ((this.nudgeI ?? -1) + 1) % CHECKIN_NUDGES.length;
    r.say(CHECKIN_NUDGES[this.nudgeI], 4);
  }

  render(g) {
    const s = this.game.state;
    const now = this.game.now();
    g.fillStyle = '#0d0f18';
    g.fillRect(0, 0, W, H);
    this.view.gateOpen = !this.gateClosed;
    this.view.desk = this.hasDesk ? K.myDesk(s) : null;
    const actors = [this.player, ...this.npcs.map((n) => n.a), ...(this.hrRep ? [this.hrRep] : []), ...(this.receptionist ? [this.receptionist] : []), ...(this.event?.actors || [])];
    this.view.render(g, this.cam, [...actors, ...(this.quest?.props || [])]);
    if (this.night) {
      this.lamps ||= nightLamps(this.fl, this.floorNo);
      drawNight(g, { lamps: this.lamps, fade: this.nightFade, cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y) }, player: this.player, t: this.time });
    }

    g.save();
    g.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
    if (this.focus && this.focus.kind !== 'npc') this.drawFocus(g, this.focus.it);
    this.drawMarkers(g, s, now);
    this.drawStandupMarker(g);
    this.quest?.renderWorld(g);
    this.event?.renderWorld(g);
    const bubbleView = { x: Math.round(this.cam.x), y: Math.round(this.cam.y), w: W, h: H, top: HUD_H };
    for (const a of actors) a.drawBubble(g, bubbleView);
    g.restore();

    this.drawPrompt(g, s, now);
    this.hud.render(g);
    if (CD.onHold(s)) this.drawHoldStrip(g);
    if (this.night) this.drawNightClock(g, s, now);
    this.quest?.renderHud(g);
    this.event?.renderHud(g);
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
    const hold = CD.onHold(s);
    const night = this.night;
    for (const it of this.fl.items) {
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const top = this.view.itemTop(it) - 3;
      if (it.task) {
        if (this.event?.hidesMarker(it)) continue;
        if (hold) {
          this.drawHoldTape(g, cx, top);
          continue;
        }
        if (night && MINIGAMES[it.task.game].quest) {
          this.drawHoldTape(g, cx, top, 'CLOSED');
          continue;
        }
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
        if (hold) this.drawHoldTape(g, cx, top);
        else if (!night && s.floor === s.maxFloor && S.promotionStatus(s).can) {
          const y = top - 14 + bob;
          rect(g, cx - 6, y, 12, 12, C.border);
          rect(g, cx - 5, y + 1, 10, 10, C.good);
          icon(g, 'up', cx - 3, y + 3);
        }
      } else if (it.interact === 'hr') {
        if (night) continue; // HR has gone home
        const r = S.reviewStatus(s, now);
        const y = top - 24 + bob;
        if (hold) {
          const c = Math.floor(this.time * 3) % 2 ? C.bad : '#ff8a6a';
          rect(g, cx - 12, y, 24, 12, C.border);
          rect(g, cx - 11, y + 1, 22, 10, c);
          drawText(g, 'HR!', cx, y + 3, { align: 'center', color: C.ink });
          rect(g, cx - 1, y + 12, 2, 2, C.border);
        } else if (r.state === 'available' || r.state === 'coffee') {
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
      } else if (it === this.fl.myDesk && this.hasDesk) {
        // "MY DESK" tag until something is on show.
        if (Object.values(K.myDesk(s).show).some(Boolean)) continue;
        const y = top - 12 + bob;
        const w = measureText('MY DESK') + 6;
        rect(g, cx - w / 2, y, w, 10, C.border);
        rect(g, cx - w / 2 + 1, y + 1, w - 2, 8, C.gold);
        drawText(g, 'MY DESK', cx, y + 1, { align: 'center', color: C.ink });
      } else if (it.interact === 'coffee') {
        if (S.cooldownLeft(s, this.brewerKey, now) <= 0) icon(g, 'coffee', cx - 3, top - 10 + bob);
      }
    }
  }

  /** Compliance hold: a strip under the HUD until the training is done. */
  drawHoldStrip(g) {
    const text = 'COMPLIANCE HOLD - report to the HR office';
    const w = measureText(text) + 12;
    const x = Math.round((W - w) / 2);
    const y = HUD_H + 2;
    rect(g, x, y, w, 12, C.border);
    rect(g, x + 1, y + 1, w - 2, 10, Math.floor(this.time * 2) % 2 ? '#7a2b2b' : '#9a3530');
    drawText(g, text, W / 2, y + 3, { align: 'center', color: '#ffe8a0' });
  }

  /** Black-and-yellow tape over a station or the elevator: 'ON HOLD' (compliance hold) or 'CLOSED' (a floor quest at night). */
  drawHoldTape(g, cx, top, text = 'ON HOLD') {
    const w = measureText(text) + 16;
    const x = Math.round(cx - w / 2);
    const y = top - 12;
    rect(g, x - 1, y - 1, w + 2, 11, C.border);
    rect(g, x, y, w, 9, '#1a1a1a');
    for (const ex of [x, x + w - 5]) for (let i = 0; i < 5; i += 2) rect(g, ex + i, y, 1, 9, '#f2c230');
    drawText(g, text, cx, y + 1, { align: 'center', color: '#f2c230' });
  }

  /** The night shift's clock under the HUD (top right): time left, tasks done, a bar running down. */
  drawNightClock(g, s, now) {
    const left = N.nightLeft(s, now);
    const t = formatTime(left);
    const done = `${s.nightShift?.tasks || 0} done`;
    const name = 'NIGHT SHIFT';
    const w = measureText(name) + measureText(t) + measureText(done) + 36;
    const x = W - w - 4; // right-aligned: toasts take the middle
    const y = HUD_H + 3;
    const low = left < 60000;
    panel(g, x, y, w, 15, { fill: C.panelDark });
    drawText(g, name, x + 6, y + 4, { color: '#9fb4ff' });
    let cx = x + 10 + measureText(name);
    icon(g, 'clock', cx, y + 4);
    cx += 10;
    if (!low || Math.floor(this.time * 3) % 2) drawText(g, t, cx, y + 4, { color: low ? C.bad : C.text });
    cx += measureText(t) + 6;
    drawText(g, done, cx, y + 4, { color: C.dim });
    rect(g, x + 1, y + 13, Math.round((w - 2) * Math.min(1, left / (E.NIGHT_SHIFT_S * 1000))), 1, low ? C.bad : '#9fb4ff');
  }

  /** A blue speech bubble over the colleague with today's stand-up favour. */
  drawStandupMarker(g) {
    const n = this.standupNpc;
    if (!n || n.a.bubble || this.quest || CD.onHold(this.game.state)) return;
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    const cx = Math.round(n.a.x * TILE);
    const y = Math.round(n.a.y * TILE) - CHAR_H - 14 + bob;
    rect(g, cx - 6, y, 13, 10, C.border);
    rect(g, cx - 5, y + 1, 11, 8, C.xp);
    rect(g, cx - 2, y + 10, 3, 2, C.border);
    rect(g, cx - 1, y + 9, 1, 2, C.xp);
    for (const dx of [-3, 0, 3]) rect(g, cx + dx, y + 4, 2, 2, C.ink);
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!t) return;
    let text = '';
    let sub = '';
    if (t.kind === 'npc') {
      text = 'Talk';
      if (t.n === this.event?.auditor) sub = `${t.n.id.name} - wrap up the audit`;
      else if (t.n === this.chatNpc && !this.quest) sub = `${t.n.id.name} - coffee break chat`;
      else sub = t.n === this.standupNpc && !this.quest && !CD.onHold(s) ? `${t.n.id.name} - daily stand-up` : S.canFire(s) && !this.quest ? `${t.n.id.name} - decide their fate` : t.n.id.name;
    } else if (t.kind === 'terminal') {
      text = 'Workstation';
      sub = this.night ? 'locked for the night' : 'open terminal';
    } else if (t.kind === 'poster') {
      text = t.it.ad ? t.it.ad.name : 'Ad space';
      sub = t.it.ad ? 'advertisement' : 'sponsor this wall';
    } else if (t.kind === 'event') {
      [text, sub] = this.event.prompt();
    } else if (t.kind === 'board') {
      text = 'Whiteboard';
      sub = t.b.checked ? 'look again' : 'take a look';
    }
    else if (t.kind === 'elevator') {
      text = 'Elevator';
      if (this.night) sub = 'go home early';
    }
    else if (t.kind === 'exit') {
      text = 'Way out';
      sub = 'back to the office';
    }
    else if (t.kind === 'mydesk') {
      text = 'Your desk';
      sub = 'decorate';
    }
    else if (t.kind === 'turnstile') {
      text = 'Turnstiles';
      sub = s.lobby === 'checkin' ? 'check in first' : `-${E.TURNSTILE_COFFEE} coffee`;
    }
    else if (t.kind === 'coffee') text = 'Coffee machine';
    else if (t.kind === 'hr') {
      text = 'HR office';
      const r = S.reviewStatus(s, now);
      sub = { available: 'performance review', coffee: 'performance review', cooldown: `retry ${formatTime(r.left)}`, passed: 'review passed', notReady: 'not promotion-ready yet' }[r.state] || '';
      if (CD.onHold(s)) sub = 'compliance training';
      if (this.night) sub = 'gone home';
    }
    else {
      text = t.it.task.title;
      const left = S.cooldownLeft(s, t.it.task.id, now);
      const cost = S.taskCost(s, t.it.task);
      sub = left > 0 ? `busy ${formatTime(left)}` : cost ? `-${cost} coffee` : 'check-in, free';
      if (this.quest) sub = this.quest.isStation(t.it) ? this.quest.stationSub() : 'finish your task first';
      if (this.event?.isLocked(t.it)) sub = 'locked for the audit';
      if (this.night && MINIGAMES[t.it.task.game].quest) sub = 'closed for the night';
    }
    if (CD.onHold(s) && ['task', 'elevator', 'terminal', 'mydesk'].includes(t.kind)) sub = 'on hold: see HR';
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, isTouch() ? 'TAP' : 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
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
