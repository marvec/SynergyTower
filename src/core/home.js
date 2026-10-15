// Home office: on floors 8, 18, 28 and 38 your manager sends you home for the day, once a day for all four floors
// together, free. 10 minutes of wall clock (held while paused) in a small flat (buildHome): chores are mini-games (a cup each, XP and a few
// paperclips once per chore, never KPI stars), the coffee maker pours your own cups, and the computer's presence meter
// must not run dry. Three lapses (a dry meter or a missed video call) end the day early; coming back without that
// clears the floor's station cooldowns. Pure, no DOM: scenes/home.js runs the flat.
//
// state.homeDays = { day, count }: today's home office is used up once started (like the night shift)
// state.home = { floor, endsAt, t, presence, lapses, paid, best, calls, coffee } while the stay lasts
//   t         seconds of play at home (walking about and chores; never the pause menu): the presence meter and the
//             video calls run on it, the stay itself on the wall clock (endsAt)
//   presence  seconds left on the presence meter (HOME.presenceS when full)
//   paid      { game: true }: the chore has paid out this stay (at least 1 star)
//   best      { game: stars }: the best result per chore this stay (Domestic Hero)
//   calls     [{ at, state: 'pending' | 'ringing' | 'answered' | 'missed', left }]
import * as E from './economy.js';
import { dayKey } from './daily.js';
import { onHold } from './conduct.js';
import { addCoffee, cooldownLeft, coffeeMax, spendCoffee, tick } from './state.js';
import { buildFloor } from './tasks.js';
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs } from './floorgen.js';
import { DEPARTMENTS } from '../data/departments.js';
import { CHORES, CHORE_GAMES } from '../data/home.js';

export const HOME = E.HOME;
export { CHORES, CHORE_GAMES };
/** The coffee maker's cooldown key (not a station: no floor clears it). */
export const BREW_KEY = 'home-brew';

export const isHomeFloor = (floor) => HOME.floors.includes(floor);

/** Why no home office can start: 'hold' (compliance hold), 'badge' (not checked in), 'away' (trip, holiday, night shift, archive), or null. */
export function homeBlock(s) {
  if (onHold(s)) return 'hold';
  if (s.lobby !== 'done') return 'badge';
  if (s.trip || s.vacation || s.nightShift || s.archive?.task?.inside) return 'away';
  return null;
}

/** 'none' (not a home floor) | 'on' (a stay is under way) | 'blocked' | 'today' (used up today) | 'available'. */
export function homeStatus(s, floor, now) {
  if (!isHomeFloor(floor)) return 'none';
  if (s.home) return 'on';
  if (homeBlock(s)) return 'blocked';
  return s.homeDays?.day === dayKey(now) ? 'today' : 'available';
}

/** Starts the day at home: 1-2 video calls are planned on the stay's play time. */
export function startHome(s, floor, now, rng = Math.random) {
  const st = homeStatus(s, floor, now);
  if (st !== 'available') return { ok: false, reason: st };
  const [lo, hi] = HOME.calls;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const [w0, w1] = HOME.callWindow;
  // Spread the calls over the window: each in its own slice, so two calls never ring at once.
  const calls = [];
  for (let i = 0; i < n; i++) {
    const a = w0 + ((w1 - w0) * i) / n;
    const b = w0 + ((w1 - w0) * (i + 1)) / n;
    calls.push({ at: Math.round((a + (b - a) * rng()) * HOME.stayS), state: 'pending', left: 0 });
  }
  s.homeDays = { day: dayKey(now), count: (s.homeDays?.count || 0) + 1 };
  s.home = { floor, endsAt: now + HOME.stayS * 1000, t: 0, presence: HOME.presenceS, lapses: 0, paid: {}, best: {}, calls, coffee: 0 };
  return { ok: true };
}

export const homeLeft = (s, now) => (s.home ? Math.max(0, s.home.endsAt - now) : 0);
export const homeActive = (s, now) => homeLeft(s, now) > 0;
/** Three lapses: your manager calls you back in. */
export const sentBack = (s) => (s.home?.lapses || 0) >= HOME.maxLapses;
export const ringingCall = (s) => s.home?.calls.find((c) => c.state === 'ringing') || null;

/**
 * `dt` seconds of play at home. `away`: the time went on a chore (the scene adds the game's play time afterwards), so a
 * call that falls due in it starts ringing only now, with its full time to answer. Returns what happened, in order:
 * [{ type: 'lapse' } | { type: 'ring' } | { type: 'missed' }]. A dry meter refills (the next lapse needs another full
 * drain), a missed call counts as a lapse too.
 */
export function tickHome(s, dt, { away = false } = {}) {
  const h = s.home;
  if (!h || dt <= 0) return [];
  const out = [];
  h.t += dt;
  h.presence -= dt;
  if (h.presence <= 0) {
    h.lapses++;
    h.presence = HOME.presenceS;
    out.push({ type: 'lapse' });
  }
  for (const c of h.calls) {
    if (c.state === 'ringing') {
      c.left -= dt;
      if (c.left <= 0) {
        c.state = 'missed';
        h.lapses++;
        out.push({ type: 'missed' });
      }
    } else if (c.state === 'pending' && h.t >= c.at && !h.calls.some((o) => o.state === 'ringing')) {
      c.state = 'ringing';
      c.left = HOME.callS;
      out.push({ type: 'ring' });
    }
  }
  if (away) for (const c of h.calls) if (c.state === 'ringing') c.left = Math.max(c.left, HOME.callS);
  return out;
}

/** At the computer: the presence meter is full again, and a ringing call is answered. { answered }. */
export function pokeComputer(s) {
  const h = s.home;
  if (!h) return { answered: false };
  h.presence = HOME.presenceS;
  const c = ringingCall(s);
  if (c) c.state = 'answered';
  return { answered: !!c };
}

export const choreCost = (game) => (game === 'brew' ? 0 : HOME.choreCoffee);

/**
 * Before a chore: a cup of coffee (the coffee maker is free but has a cooldown, and waits for a mug with room in it).
 * { ok } or { ok: false, reason: 'coffee' | 'cooldown' | 'full', left, cost }.
 */
export function startChore(s, game, now) {
  tick(s, now);
  if (game === 'brew') {
    const left = cooldownLeft(s, BREW_KEY, now);
    if (left > 0) return { ok: false, reason: 'cooldown', left };
    if (s.coffee.value >= coffeeMax(s)) return { ok: false, reason: 'full' };
    return { ok: true, cost: 0 };
  }
  const cost = choreCost(game);
  if (s.coffee.value < cost) return { ok: false, reason: 'coffee', cost };
  spendCoffee(s, cost, now);
  return { ok: true, cost };
}

/**
 * A chore finished with `score` on the stay's floor. Brewing pours HOME.brewCoffee cups (up to the maximum) for at least
 * a star and sets the coffee maker's cooldown by the stars. Other chores pay XP and a share of an ordinary task's
 * paperclips the first time they reach a star this stay; never KPI stars.
 */
export function completeChore(s, game, score, now) {
  const stars = E.starsFromScore(score);
  s.played[game] = (s.played[game] || 0) + 1; // counts towards games played, any result
  const h = s.home;
  if (h) h.best[game] = Math.max(h.best[game] || 0, stars);
  if (game === 'brew') {
    const coffee = stars > 0 ? addCoffee(s, HOME.brewCoffee) : 0;
    const cooldownS = HOME.brewCooldownS[stars];
    s.cooldowns[BREW_KEY] = now + cooldownS * 1000;
    if (h) h.coffee += coffee;
    return { stars, brew: true, coffee, cooldownS };
  }
  const first = stars > 0 && !!h && !h.paid[game];
  if (!first) return { stars, sp: 0, xp: 0, first: false, levelsGained: 0, soGained: 0 };
  h.paid[game] = true;
  const reward = E.taskReward(h.floor, stars, s.perks);
  const sp = Math.round(reward.sp * HOME.choreSpMult);
  s.sp += sp;
  const lv = E.addXp(s.level, s.xp, reward.xp);
  s.level = lv.level;
  s.xp = lv.xp;
  s.so += lv.levelsGained;
  return { stars, sp, xp: reward.xp, first: true, levelsGained: lv.levelsGained, soGained: lv.levelsGained };
}

export const choreDone = (s, game) => !!s.home?.paid[game];

/**
 * The day is over: 'done' (time is up), 'early' (left by the front door) or 'sent_back' (three lapses). Without the
 * three lapses every station cooldown on the stay's floor is cleared. Returns the summary.
 */
export function endHome(s, result) {
  const h = s.home;
  s.home = null;
  if (!h) return null;
  const res = h.lapses >= HOME.maxLapses ? 'sent_back' : result;
  const cleared = res !== 'sent_back';
  if (cleared) for (const it of buildFloor(h.floor).tasks) delete s.cooldowns[it.task.id];
  const rang = h.calls.filter((c) => c.state !== 'pending');
  const answered = h.calls.filter((c) => c.state === 'answered').length;
  const chores = CHORE_GAMES.filter((g) => h.paid[g]).length;
  const st = s.stats;
  if (CHORE_GAMES.every((g) => h.best[g] === 3)) st.homeHero = (st.homeHero || 0) + 1;
  if (res === 'done' && h.lapses === 0) st.homeOnline = (st.homeOnline || 0) + 1;
  if (h.calls.length && answered === h.calls.length) st.homeCamera = (st.homeCamera || 0) + 1;
  return { floor: h.floor, result: res, chores, lapses: h.lapses, maxLapses: HOME.maxLapses, calls: rang.length, planned: h.calls.length, answered, coffee: h.coffee, cleared };
}

/** Debugging (window.__home): today's home office is on offer again; a stay under way is dropped. */
export function resetHome(s) {
  s.home = null;
  s.homeDays = { ...s.homeDays, day: null };
}

// ------------------------------------------------------------------ the flat
export const HOME_W = 26;
export const HOME_H = 13;
const DOOR_X = 17; // the front door in the bottom wall (2 tiles)

let cached = null;

/**
 * Your flat: the kitchen (sink, coffee maker, fridge) and the bathroom (bath, washing machine) on the left, the living
 * room (the computer, sofa, TV, bed, ironing board and the vacuum in its corner) on the right. Smaller than the screen: the
 * scene centres it. Deterministic.
 */
export function buildHome() {
  return (cached ||= generateHome());
}

function generateHome() {
  const W = HOME_W;
  const H = HOME_H;
  const dept = DEPARTMENTS.find((d) => d.id === 'marketing');
  const P = createPlanner(W, H, createRng(808), dept);
  const { tiles, idx, setWall, rooms, roomOf, items, place, decor } = P;
  const ground = new Array(W * H).fill(null);
  const area = (type, x0, x1, y0, y1, style) => {
    const room = { id: rooms.length, type, x0, x1, y0, y1, doors: [] };
    rooms.push(room);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        roomOf[idx(x, y)] = room.id;
        ground[idx(x, y)] = style;
      }
    return room;
  };
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    setWall(0, y);
    setWall(W - 1, y);
    setWall(10, y);
  }
  for (let x = 1; x < 10; x++) setWall(x, 7);
  // Doors: the living room to the kitchen (rows 3-4) and to the bathroom (rows 9-10); the front door at the bottom.
  // The kitchen and bathroom are on the left, so nothing with a marker sits under the clock panel (top right).
  for (const y of [3, 4, 9, 10]) tiles[idx(10, y)] = 0;
  const entrance = { x: DOOR_X, y: H - 1, w: 2 };

  const kitchen = area('kitchen', 1, 9, 1, 6, 'tile');
  const bath = area('bathroom', 1, 9, 8, H - 2, 'bathroom');
  const living = area('living', 11, W - 2, 1, H - 2, 'parquet');

  const chore = (room, type, game, x, y, w = 1, h = 1) => {
    const c = CHORES.find((v) => v.game === game);
    return place(room, type, x, y, w, h, { chore: { id: `home-${game}`, game, title: c.title, difficulty: 0, seed: 8000 + items.length } });
  };

  // The kitchen: the fridge, the coffee maker on the counter, the sink full of dishes, a little table.
  place(kitchen, 'fridge', 1, 1);
  place(kitchen, 'counter', 2, 1);
  chore(kitchen, 'homebrewer', 'brew', 3, 1);
  place(kitchen, 'counter', 4, 1);
  chore(kitchen, 'dishsink', 'dishes', 5, 1, 2, 1);
  place(kitchen, 'counter', 7, 1);
  place(kitchen, 'kitchentable', 3, 4, 2, 1);

  // The bathroom: the bath, the toilet, the washing machine, a washbasin.
  chore(bath, 'bathtub', 'bath', 1, 8, 3, 1);
  place(bath, 'toilet', 5, 8);
  chore(bath, 'washer', 'laundry', 7, 8);
  place(bath, 'sink', 8, 8);
  decor(bath, 'rug', 1, 10, 3, 1);

  // The living room: your desk and its computer, the sofa facing the TV, the bed, the ironing board, the vacuum.
  const computer = place(living, 'homedesk', 11, 1, 2, 1, { interact: 'computer' });
  place(living, 'bookshelf', 13, 1, 2, 1);
  place(living, 'hometv', 17, 1, 2, 1);
  place(living, 'houseplant', W - 2, 1);
  place(living, 'sofa', 16, 4, 4, 1);
  decor(living, 'rug', 16, 5, 4, 2);
  place(living, 'homebed', W - 3, 8, 2, 3);
  chore(living, 'ironingboard', 'ironing', 13, 8, 2, 1);
  chore(living, 'vacuum', 'vacuum', 11, H - 2);
  place(living, 'houseplant', W - 2, H - 2);

  const fl = {
    floor: 0, home: true, foreign: true, dept: dept.id, w: W, h: H, tiles, roomOf, rooms, items, entrance, ground,
    look: { carpet: ['#b98a5a', '#b3845a'], wall: '#e8dcc8' },
  };
  // Arrive just inside the front door, facing in (walking down into it leaves).
  fl.arrive = { x: DOOR_X + 1, y: H - 2.6 };
  Object.assign(fl, { elevator: null, hrDesk: null, hrRep: null, receptionist: null, turnstile: null, posters: [], myDesk: null, tasks: [], npcs: [] });
  fl.computer = computer;
  fl.chores = items.filter((it) => it.chore);
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, DOOR_X, H - 2);
  return fl;
}
