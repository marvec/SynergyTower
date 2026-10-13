// Game state + all player actions as pure-ish functions (mutate the passed state, never touch the DOM).
import * as E from './economy.js';
import { COUNTED_GAMES, buildFloor } from './tasks.js';
export { COUNTED_GAMES };
import { mergeOldDesks } from './desk.js';

export const SAVE_VERSION = 1;

export function newGame({ corpName, colorId, playerName, skin = 0, hair = 0 }, now) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    corp: { name: corpName || 'Synergy Corp', colorId: colorId || 'bigblue' },
    player: { name: playerName || 'New Hire', skin, hair },
    floor: 1,
    maxFloor: 1,
    sp: E.STARTING.sp,
    xp: E.STARTING.xp,
    level: E.STARTING.level,
    so: E.STARTING.so,
    // The new hire's coffee card starts empty and does not refill until they check in at the front desk.
    coffee: { value: 0, updatedAt: now },
    lobby: 'checkin', // ground-floor onboarding: 'checkin' (front desk) → 'gate' (turnstiles cost a cup) → 'done'
    starsByFloor: {},
    reviews: {}, // floor → true once the HR performance review there is passed
    fired: {}, // NPC seed → true: colleagues the CEO has let go (they never come back)
    bestByTask: {},
    played: {}, // mini-game id → times played with this character (any result)
    cooldowns: {},
    perks: {},
    stats: { tasksPlayed: 0, perfectTasks: 0, soPurchased: 0, promotions: 0, fired: 0, warps: 0, standups: 0, soSpent: 0, coffeeMachine: 0, events: {} },
    daily: { day: null, streak: 0, best: 0 }, // daily stand-up (core/daily.js): last local day played + streak of days in a row
    events: { nextAt: now + 5 * 60 * 1000 }, // random office events (core/events.js): none before this wall-clock time
    desk: { owned: [], show: {} }, // your desk, moves with you: owned decor ids + one on show per slot (core/desk.js)
    badges: {}, // badge id → unlocked at (core/achievements.js)
    trips: {}, // business trips (core/trip.js): floor → 'missed' (left in the car) | 'done' (made it to the client)
    trip: null, // the client visit under way: { floor, endsAt, sp, tasks }
    vacations: { day: null, count: 0 }, // vacation (core/vacation.js): the local day of the last one + how many so far
    vacation: null, // the hotel stay under way: { endsAt, done: { game: true }, coffee }
    // conduct (core/conduct.js): strikes for asking a colleague out again after their no; hold = compliance hold
    conduct: { strikes: 0, refused: {}, reported: {}, hold: null, trained: false, holds: 0, demotions: 0 },
    settings: { music: true, sfx: true, reminders: false },
    flags: { introSeen: false, ceo: false, reminderOffered: false },
  };
}

export const coffeeMax = (s) => E.maxCoffee(s.maxFloor, s.perks);

/** Coffee refills on its own once the new hire has checked in at the front desk. */
export const coffeeRegenOn = (s) => s.lobby !== 'checkin';

/** Applies offline/real-time coffee regeneration. */
export function tick(s, now) {
  if (!coffeeRegenOn(s)) {
    s.coffee.updatedAt = now;
    return;
  }
  const r = E.regenCoffee(s.coffee.value, s.coffee.updatedAt, now, coffeeMax(s), E.coffeeRegenMs(s.perks));
  s.coffee.value = r.value;
  s.coffee.updatedAt = r.updatedAt;
}

export function msToNextCoffee(s, now) {
  if (!coffeeRegenOn(s) || s.coffee.value >= coffeeMax(s)) return 0;
  return Math.max(0, s.coffee.updatedAt + E.coffeeRegenMs(s.perks) - now);
}

/** HUD warning: 'empty' = can't afford any task on this floor, 'low' = can't afford the priciest one, else 'ok'. */
export function coffeeLevel(s) {
  const costs = buildFloor(s.floor).tasks.map((it) => E.taskCoffeeCost(it.task.game));
  if (s.coffee.value < Math.min(...costs)) return 'empty';
  return s.coffee.value < Math.max(...costs) ? 'low' : 'ok';
}

export const cooldownLeft = (s, key, now) => Math.max(0, (s.cooldowns[key] || 0) - now);

/** Coffee a task costs right now: the front-desk check-in is free for a new hire (they have no coffee yet). */
export const taskCost = (s, task) => (task.checkin && s.lobby === 'checkin' ? 0 : E.taskCoffeeCost(task.game));

/** Takes coffee; a full pot starts its refill clock now. */
function spendCoffee(s, n, now) {
  if (s.coffee.value >= coffeeMax(s)) s.coffee.updatedAt = now;
  s.coffee.value -= n;
}

export function canStartTask(s, task, floor, now) {
  const cost = taskCost(s, task);
  if (cooldownLeft(s, task.id, now) > 0) return { ok: false, reason: 'cooldown', cost };
  if (s.coffee.value < cost) return { ok: false, reason: 'coffee', cost };
  return { ok: true, cost };
}

/** Charges coffee for a task attempt. Returns false if not allowed. */
export function startTask(s, task, floor, now) {
  tick(s, now);
  const c = canStartTask(s, task, floor, now);
  if (!c.ok) return c;
  spendCoffee(s, c.cost, now);
  return c;
}

/** opts: spMult multiplies the paperclips; kpi: false keeps the stars off the floor's quota (a client's office). */
export function completeTask(s, task, floor, score, now, rng = Math.random, { spMult = 1, kpi = true } = {}) {
  const stars = E.starsFromScore(score);
  const reward = E.taskReward(floor, stars, s.perks);
  reward.sp *= spMult;
  s.sp += reward.sp;
  const lv = E.addXp(s.level, s.xp, reward.xp);
  s.level = lv.level;
  s.xp = lv.xp;
  let soGained = lv.levelsGained;
  if (stars === 3 && rng() < 0.05) soGained++;
  s.so += soGained;
  if (kpi) s.starsByFloor[floor] = (s.starsByFloor[floor] || 0) + stars;
  const prevBest = s.bestByTask[task.id] ?? -1;
  if (stars > prevBest) s.bestByTask[task.id] = stars;
  s.cooldowns[task.id] = now + E.stationCooldownMs(floor, s.perks, task.game);
  if (task.game) s.played[task.game] = (s.played[task.game] || 0) + 1;
  s.stats.tasksPlayed++;
  if (stars === 3) s.stats.perfectTasks++;
  const ceoUnlocked = kpi && floor === E.FLOORS && !s.flags.ceo && s.starsByFloor[floor] >= E.starQuota(floor);
  if (ceoUnlocked) s.flags.ceo = true;
  // Playing the front-desk check-in (any result) loads the coffee card and starts its refill.
  const checkedIn = kpi && !!task.checkin && s.lobby === 'checkin';
  if (checkedIn) {
    s.lobby = 'gate';
    s.coffee = { value: Math.max(s.coffee.value, coffeeMax(s)), updatedAt: now };
  }
  return { stars, sp: reward.sp, xp: reward.xp, levelsGained: lv.levelsGained, soGained, newBest: stars > prevBest, ceoUnlocked, checkedIn };
}

/** How many of the mini-game types (station games and holiday activities) this character has played at least once. */
export function gamesPlayed(s) {
  return { played: COUNTED_GAMES.filter((g) => s.played?.[g]).length, total: COUNTED_GAMES.length };
}

export function promotionStatus(s) {
  const f = s.maxFloor;
  const stars = s.starsByFloor[f] || 0;
  const quota = E.starQuota(f);
  const levelReq = E.levelRequiredForFloor(f + 1);
  const fee = E.keycardFee(f);
  const top = f >= E.FLOORS;
  const checks = {
    stars: stars >= quota,
    level: s.level >= levelReq,
    sp: s.sp >= fee,
    review: !!s.reviews?.[f],
  };
  // `ready` = everything except the HR review: that is when HR will see you.
  const ready = !top && checks.stars && checks.level && checks.sp;
  return { floor: f, stars, quota, levelReq, level: s.level, fee, sp: s.sp, checks, top, ready, can: ready && checks.review };
}

export const reviewKey = (floor) => `review-${floor}`;

/**
 * Can the player take the HR performance review now?
 * state: 'top' | 'wrongFloor' | 'notReady' | 'passed' | 'cooldown' | 'coffee' | 'available'
 */
export function reviewStatus(s, now) {
  const st = promotionStatus(s);
  const cost = E.REVIEW_COFFEE;
  const base = { cost, st, left: 0 };
  if (st.top) return { ...base, state: 'top' };
  if (s.floor !== s.maxFloor) return { ...base, state: 'wrongFloor' };
  if (st.checks.review) return { ...base, state: 'passed' };
  if (!st.ready) return { ...base, state: 'notReady' };
  const left = cooldownLeft(s, reviewKey(s.maxFloor), now);
  if (left > 0) return { ...base, state: 'cooldown', left };
  if (s.coffee.value < cost) return { ...base, state: 'coffee' };
  return { ...base, state: 'available' };
}

/** Charges coffee for a review attempt. */
export function startReview(s, now) {
  tick(s, now);
  const r = reviewStatus(s, now);
  if (r.state !== 'available') return { ok: false, reason: r.state };
  spendCoffee(s, r.cost, now);
  return { ok: true, cost: r.cost };
}

/** The lobby turnstiles: closed until check-in, then one cup for the first way in, free ever after. */
export function passTurnstile(s, now) {
  if (s.lobby === 'checkin') return { ok: false, reason: 'checkin' };
  if (s.lobby !== 'gate') return { ok: true, cost: 0 };
  tick(s, now);
  if (s.coffee.value < E.TURNSTILE_COFFEE) return { ok: false, reason: 'coffee' };
  spendCoffee(s, E.TURNSTILE_COFFEE, now);
  s.lobby = 'done';
  return { ok: true, cost: E.TURNSTILE_COFFEE };
}

export function completeReview(s, score, now) {
  const f = s.maxFloor;
  const passed = score >= E.REVIEW_PASS_SCORE;
  if (passed) {
    s.reviews = { ...s.reviews, [f]: true };
    delete s.cooldowns[reviewKey(f)];
  } else s.cooldowns[reviewKey(f)] = now + E.reviewCooldownMs(f, s.perks);
  s.stats.reviews = (s.stats.reviews || 0) + 1;
  return { review: true, passed, score, retryIn: passed ? 0 : E.reviewCooldownMs(f, s.perks) };
}

export function promote(s, now) {
  const st = promotionStatus(s);
  if (!st.can) return false;
  s.sp -= st.fee;
  s.maxFloor++;
  s.floor = s.maxFloor;
  s.so += 1;
  s.stats.promotions++;
  tick(s, now);
  // New floor raises max coffee; top up as a promotion gift.
  s.coffee.value = Math.max(s.coffee.value, coffeeMax(s));
  s.coffee.updatedAt = now;
  return true;
}

/**
 * The terminal's `systemctl isolate levelXX.target`: jump straight to any floor. Jumping above your highest floor
 * makes it your new highest floor (no fee, no review). Returns { ok, promoted }.
 */
export function warpToFloor(s, floor) {
  if (!Number.isInteger(floor) || floor < 1 || floor > E.FLOORS) return { ok: false, promoted: false };
  const promoted = floor > s.maxFloor;
  s.maxFloor = Math.max(s.maxFloor, floor);
  s.floor = floor;
  s.stats.warps = (s.stats.warps || 0) + 1;
  return { ok: true, promoted };
}

/** Once you reach the CEO floor you can fire anybody, on any floor. */
export const canFire = (s) => s.maxFloor >= E.FLOORS;

/** Fires the colleague with this NPC seed; their desk stash of paperclips goes to the CEO. */
export function fireEmployee(s, seed, stash = 0) {
  if (!canFire(s) || s.fired?.[seed]) return { ok: false };
  s.fired = { ...s.fired, [seed]: true };
  s.sp += stash;
  s.stats.fired = (s.stats.fired || 0) + 1;
  return { ok: true, stash };
}

export function goToFloor(s, floor) {
  if (floor < 1 || floor > s.maxFloor) return false;
  s.floor = floor;
  return true;
}

export function perkLevel(s, id) {
  return s.perks[id] || 0;
}

export function buyPerk(s, perkId) {
  const perk = E.PERKS.find((p) => p.id === perkId);
  if (!perk) return { ok: false, reason: 'unknown' };
  const lvl = perkLevel(s, perkId);
  if (lvl >= perk.max) return { ok: false, reason: 'max' };
  const cost = E.perkCost(perk, lvl);
  if (s[perk.currency] < cost) return { ok: false, reason: perk.currency };
  if (perk.currency === 'so') spendSo(s, cost);
  else s.sp -= cost;
  s.perks[perkId] = lvl + 1;
  return { ok: true, cost };
}

/** Converts SP into XP (Training). Amount in XP. */
export function train(s, xpAmount) {
  const cost = xpAmount * E.TRAINING_SP_PER_XP;
  if (xpAmount <= 0 || s.sp < cost) return { ok: false };
  s.sp -= cost;
  const lv = E.addXp(s.level, s.xp, xpAmount);
  s.level = lv.level;
  s.xp = lv.xp;
  s.so += lv.levelsGained;
  return { ok: true, cost, levelsGained: lv.levelsGained };
}

/** Stock Options spent are counted for the "Bootstrapped" badge (-1 = unknown, from a save older than the count). */
function spendSo(s, n) {
  s.so -= n;
  if (s.stats.soSpent >= 0) s.stats.soSpent += n;
}

export function skipCooldown(s, key, now) {
  if (cooldownLeft(s, key, now) <= 0) return { ok: false, reason: 'ready' };
  if (s.so < E.SKIP_COOLDOWN_SO) return { ok: false, reason: 'so' };
  spendSo(s, E.SKIP_COOLDOWN_SO);
  delete s.cooldowns[key];
  return { ok: true };
}

export function refillCoffee(s, now) {
  tick(s, now);
  if (s.coffee.value >= coffeeMax(s)) return { ok: false, reason: 'full' };
  if (s.so < E.REFILL_COFFEE_SO) return { ok: false, reason: 'so' };
  spendSo(s, E.REFILL_COFFEE_SO);
  s.coffee.value = coffeeMax(s);
  s.coffee.updatedAt = now;
  return { ok: true };
}

/** A floor's coffee machine; a client's brewer passes its own key and cooldown (core/trip.js). */
export function useCoffeeMachine(s, floor, now, { key = `coffee-machine-${floor}`, cooldownS = E.COFFEE_MACHINE_COOLDOWN_S } = {}) {
  tick(s, now);
  if (cooldownLeft(s, key, now) > 0) return { ok: false, reason: 'cooldown', left: cooldownLeft(s, key, now) };
  const before = s.coffee.value;
  s.coffee.value = s.coffee.value + E.COFFEE_MACHINE_AMOUNT; // may exceed max: a little treat
  s.cooldowns[key] = now + cooldownS * 1000;
  s.stats.coffeeMachine = (s.stats.coffeeMachine || 0) + 1;
  return { ok: true, gained: s.coffee.value - before };
}

/** Fake purchase — no real payment. */
export function purchasePack(s, packId) {
  const pack = E.SO_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false };
  s.so += pack.so;
  s.stats.soPurchased += pack.so;
  return { ok: true, so: pack.so };
}

export function serialize(s) {
  return JSON.stringify(s);
}

export function deserialize(json, now) {
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object' || !s.corp) return null;
    const base = newGame({ corpName: s.corp.name, colorId: s.corp.colorId }, now);
    // Shallow-merge so saves from older versions gain new fields.
    const merged = { ...base, ...s, settings: { ...base.settings, ...s.settings }, flags: { ...base.flags, ...s.flags }, stats: { ...base.stats, ...s.stats } };
    merged.version = SAVE_VERSION;
    if (s.lobby === undefined) merged.lobby = 'done'; // careers from before the lobby check-in
    if (s.stats && s.stats.soSpent === undefined) merged.stats.soSpent = -1; // spent before we counted: unknown
    if (s.desks) {
      if (!s.desk) merged.desk = mergeOldDesks(s.desks, merged.maxFloor);
      delete merged.desks;
    }
    return merged;
  } catch {
    return null;
  }
}
