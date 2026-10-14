import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import { ALL_GAMES, buildFloor } from '../src/core/tasks.js';

const task = { id: 'f1-3', game: 'quiz' };
const hire = () => S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
// A player past the lobby check-in with a full coffee pot.
const fresh = () => {
  const s = hire();
  s.lobby = 'done';
  s.coffee.value = S.coffeeMax(s);
  return s;
};

test('a new career draws its own cast of colleagues; saves from before it keep the original one', () => {
  const a = S.newGame({ corpName: 'Acme' }, 1_760_000_000_000);
  const b = S.newGame({ corpName: 'Acme' }, 1_760_000_000_001);
  expect(a.cast).toBeGreaterThan(0);
  expect(b.cast).toBeGreaterThan(0);
  expect(a.cast).not.toBe(b.cast);
  expect(S.newGame({ corpName: 'Acme' }, 1_760_000_000_000).cast).toBe(a.cast);
  expect(S.castOf({})).toBe(0); // an old save without one
  expect(S.castOf(a)).toBe(a.cast);
  // Loading keeps the cast; a save from before it keeps the original colleagues on every load.
  expect(S.deserialize(S.serialize(a), 5).cast).toBe(a.cast);
  const old = { ...a };
  delete old.cast;
  expect(S.deserialize(JSON.stringify(old), 5).cast).toBe(0);
  expect(S.deserialize(JSON.stringify(old), 6).cast).toBe(0);
});

test('task costs coffee, sets cooldown and rewards', () => {
  const s = fresh();
  const start = s.coffee.value;
  expect(S.startTask(s, task, 1, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(start - E.taskCoffeeCost('quiz'));
  const r = S.completeTask(s, task, 1, 0.9, 0, () => 1);
  expect(r.stars).toBe(3);
  expect(s.starsByFloor[1]).toBe(3);
  expect(s.sp).toBe(E.STARTING.sp + r.sp);
  expect(S.canStartTask(s, task, 1, 1000).reason).toBe('cooldown');
  expect(S.canStartTask(s, task, 1, E.stationCooldownMs(1, {}, 'quiz') + 1).ok).toBe(true);
});

test('no coffee blocks tasks; coffee regenerates over time', () => {
  const s = fresh();
  s.coffee.value = 0;
  s.coffee.updatedAt = 0;
  expect(S.startTask(s, task, 1, 0).reason).toBe('coffee');
  expect(S.startTask(s, task, 1, E.coffeeRegenMs()).ok).toBe(true);
});

test('promotion needs stars, level, SP and a passed HR review', () => {
  const s = fresh();
  expect(S.promotionStatus(s).can).toBe(false);
  s.starsByFloor[1] = E.starQuota(1);
  s.level = 2;
  s.sp = E.keycardFee(1);
  expect(S.promotionStatus(s).ready).toBe(true);
  expect(S.promotionStatus(s).can).toBe(false);
  expect(S.promote(s, 0)).toBe(false);
  s.reviews[1] = true;
  expect(S.promotionStatus(s).can).toBe(true);
  const so = s.so;
  expect(S.promote(s, 0)).toBe(true);
  expect(s.floor).toBe(2);
  expect(s.maxFloor).toBe(2);
  expect(s.sp).toBe(0);
  expect(s.so).toBe(so + 1);
  expect(S.goToFloor(s, 1)).toBe(true);
  expect(S.goToFloor(s, 3)).toBe(false);
});

test('CEO ending unlocks on floor 40 quota', () => {
  const s = fresh();
  s.maxFloor = 40;
  s.floor = 40;
  s.starsByFloor[40] = E.starQuota(40) - 3;
  const r = S.completeTask(s, { id: 'f40-1' }, 40, 1, 0, () => 1);
  expect(r.ceoUnlocked).toBe(true);
  expect(s.flags.ceo).toBe(true);
  expect(S.promotionStatus(s).top).toBe(true);
});

test('perks, training, premium actions and fake purchases', () => {
  const s = fresh();
  s.sp = 10000;
  expect(S.buyPerk(s, 'mug').ok).toBe(true);
  expect(S.coffeeMax(s)).toBe(E.maxCoffee(1) + 2);
  expect(S.train(s, 10).ok).toBe(true);
  expect(s.xp).toBe(10);
  s.so = 0;
  expect(S.buyPerk(s, 'stapler').reason).toBe('so');
  expect(S.purchasePack(s, 'pack140').so).toBe(140);
  expect(s.so).toBe(140);
  s.cooldowns.x = 5000;
  expect(S.skipCooldown(s, 'x', 0).ok).toBe(true);
  s.coffee.value = 0;
  expect(S.refillCoffee(s, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(S.coffeeMax(s));
  expect(S.useCoffeeMachine(s, 1, 0).ok).toBe(true);
  expect(S.useCoffeeMachine(s, 1, 1).ok).toBe(false);
});

test('save round-trip and migration of missing fields', () => {
  const s = fresh();
  s.sp = 1234;
  const back = S.deserialize(S.serialize(s), 0);
  expect(back).toEqual(s);
  const old = JSON.parse(S.serialize(s));
  delete old.stats;
  expect(S.deserialize(JSON.stringify(old), 0).stats.tasksPlayed).toBe(0);
  expect(S.deserialize('garbage', 0)).toBe(null);
});

test('HR review: only when promotion-ready, costs coffee, failing locks it, passing unlocks the elevator', () => {
  const s = fresh();
  expect(S.reviewStatus(s, 0).state).toBe('notReady');
  s.starsByFloor[1] = E.starQuota(1);
  s.level = 2;
  s.sp = E.keycardFee(1);
  expect(S.reviewStatus(s, 0).state).toBe('available');
  const coffee = s.coffee.value;
  expect(S.startReview(s, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(coffee - E.REVIEW_COFFEE);
  const fail = S.completeReview(s, 0.4, 0);
  expect(fail.passed).toBe(false);
  expect(S.reviewStatus(s, 1000).state).toBe('cooldown');
  expect(S.skipCooldown(s, S.reviewKey(1), 1000).ok).toBe(true);
  expect(S.reviewStatus(s, 1000).state).toBe('available');
  S.startReview(s, 1000);
  expect(S.completeReview(s, E.REVIEW_PASS_SCORE, 1000).passed).toBe(true);
  expect(S.reviewStatus(s, 1000).state).toBe('passed');
  expect(S.promotionStatus(s).can).toBe(true);
  expect(S.promote(s, 1000)).toBe(true);
  // New floor: a fresh review is needed there.
  s.starsByFloor[2] = E.starQuota(2);
  s.level = 3;
  s.sp = E.keycardFee(2);
  expect(S.reviewStatus(s, 1000).state).toBe('available');
  expect(S.promotionStatus(s).can).toBe(false);
});

test('HR review is only taken on your highest floor; riding down is always allowed', () => {
  const s = fresh();
  s.maxFloor = 3;
  s.floor = 3;
  expect(S.goToFloor(s, 1)).toBe(true);
  expect(S.reviewStatus(s, 0).state).toBe('wrongFloor');
  expect(S.goToFloor(s, 3)).toBe(true);
});

test('old saves without reviews load and need a review', () => {
  const s = fresh();
  const old = JSON.parse(S.serialize(s));
  delete old.reviews;
  const back = S.deserialize(JSON.stringify(old), 0);
  expect(back.reviews).toEqual({});
  expect(S.promotionStatus(back).checks.review).toBe(false);
});

test('games played counts distinct mini-game types per character, any result, and survives old saves', () => {
  const s = S.newGame({ playerName: 'Pat' }, 0);
  expect(S.gamesPlayed(s)).toEqual({ played: 0, total: S.COUNTED_GAMES.length });
  const task = (game, id) => ({ id, game, difficulty: 0, seed: 1 });
  S.completeTask(s, task('inbox', 'f1-1'), 1, 0, 0); // even a zero-star attempt counts
  S.completeTask(s, task('inbox', 'f1-2'), 1, 1, 0);
  S.completeTask(s, task('chart', 'f1-3'), 1, 0.9, 0);
  S.completeTask(s, task('review', 'r'), 1, 0.9, 0); // the HR review is not a station game
  expect(S.gamesPlayed(s).played).toBe(2);
  expect(s.played.inbox).toBe(2);
  const old = JSON.parse(S.serialize(s));
  delete old.played;
  const loaded = S.deserialize(JSON.stringify(old), 0);
  expect(S.gamesPlayed(loaded).played).toBe(0);
  S.completeTask(loaded, task('quiz', 'f1-4'), 1, 1, 0);
  expect(S.gamesPlayed(loaded).played).toBe(1);
});

test('games played also counts the holiday activities: 33 office games + 8 at the hotel', async () => {
  const { ACTIVITIES } = await import('../src/data/vacation.js');
  const s = S.newGame({ playerName: 'Pat' }, 0);
  expect(S.gamesPlayed(s).total).toBe(ALL_GAMES.length + ACTIVITIES.length);
  expect(S.gamesPlayed(s).total).toBe(41);
  s.played.swim = 1;
  s.played.inbox = 3;
  expect(S.gamesPlayed(s).played).toBe(2);
});

test('complex games cost more coffee and cool down faster', () => {
  const s = fresh();
  const big = { id: 'f1-9', game: 'spreadsheet' };
  expect(S.canStartTask(s, big, 1, 0).cost).toBe(3);
  expect(S.startTask(s, big, 1, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(E.maxCoffee(1) - 3);
  S.completeTask(s, big, 1, 0.7, 0, () => 1);
  expect(S.cooldownLeft(s, big.id, 0)).toBe(E.stationCooldownMs(1, {}, 'spreadsheet'));
  expect(S.canStartTask(s, { id: 'q', game: 'lostpw' }, 1, 0).cost).toBe(3); // floor quests are complex
  expect(S.canStartTask(s, { id: 'x' }, 1, 0).cost).toBe(2); // no game: medium, never NaN
});

test('not enough coffee for a complex game, enough for a simple one', () => {
  const s = fresh();
  s.coffee = { value: 2, updatedAt: 0 };
  expect(S.canStartTask(s, { id: 'a', game: 'cables' }, 1, 0).reason).toBe('coffee');
  expect(S.canStartTask(s, { id: 'b', game: 'quiz' }, 1, 0).ok).toBe(true);
});

test('an old save above the new max keeps its coffee and can still play', () => {
  const s = fresh();
  s.coffee = { value: 13, updatedAt: 0 };
  S.tick(s, 10 * E.coffeeRegenMs());
  expect(s.coffee.value).toBe(13);
  expect(S.startTask(s, task, 1, 10 * E.coffeeRegenMs()).ok).toBe(true);
  expect(s.coffee.value).toBe(12);
});

test('Stock Options skip a long simple-game cooldown', () => {
  const s = fresh();
  S.startTask(s, task, 1, 0);
  S.completeTask(s, task, 1, 0.7, 0, () => 1);
  expect(S.cooldownLeft(s, task.id, 0)).toBe(240000);
  expect(S.skipCooldown(s, task.id, 0).ok).toBe(true);
  expect(S.canStartTask(s, task, 1, 0).ok).toBe(true);
});

test('coffee warning: empty below the cheapest task on this floor, low below the priciest', () => {
  const s = fresh();
  const costs = buildFloor(1).tasks.map((it) => E.taskCoffeeCost(it.task.game));
  const lo = Math.min(...costs);
  const hi = Math.max(...costs);
  expect(hi).toBeGreaterThan(lo); // floor 1 mixes cheap and pricey games
  s.coffee.value = hi;
  expect(S.coffeeLevel(s)).toBe('ok');
  s.coffee.value = hi - 1;
  expect(S.coffeeLevel(s)).toBe('low');
  s.coffee.value = lo - 1;
  expect(S.coffeeLevel(s)).toBe('empty');
});

// ---------------------------------------------------------------- lobby check-in
const checkinTask = () => buildFloor(1).tasks.find((it) => it.task.checkin).task;

test('a new hire starts with an empty coffee card that does not refill before check-in', () => {
  const s = hire();
  expect(s.lobby).toBe('checkin');
  expect(s.coffee.value).toBe(0);
  S.tick(s, 60 * E.coffeeRegenMs());
  expect(s.coffee.value).toBe(0);
  expect(S.msToNextCoffee(s, 60 * E.coffeeRegenMs())).toBe(0);
  expect(S.canStartTask(s, task, 1, 0).reason).toBe('coffee'); // ordinary tasks still cost coffee
});

test('the front-desk check-in is free, fills the coffee card and starts the refill', () => {
  const s = hire();
  const t = checkinTask();
  expect(S.taskCost(s, t)).toBe(0);
  expect(S.startTask(s, t, 1, 1000).ok).toBe(true);
  const r = S.completeTask(s, t, 1, 0, 5000); // any result counts, even a flop
  expect(r.checkedIn).toBe(true);
  expect(s.lobby).toBe('gate');
  expect(s.coffee.value).toBe(S.coffeeMax(s));
  s.coffee.value -= 1;
  S.tick(s, 5000 + E.coffeeRegenMs());
  expect(s.coffee.value).toBe(S.coffeeMax(s));
  // Afterwards the front desk is an ordinary task with an ordinary price.
  expect(S.taskCost(s, t)).toBe(E.taskCoffeeCost(t.game));
  expect(S.completeTask(s, t, 1, 0, 9000).checkedIn).toBe(false);
});

test('the turnstiles take one coffee on the first entry only, and only after check-in', () => {
  const s = hire();
  expect(S.passTurnstile(s, 0)).toEqual({ ok: false, reason: 'checkin' });
  const t = checkinTask();
  S.startTask(s, t, 1, 0);
  S.completeTask(s, t, 1, 0.9, 1000);
  expect(S.passTurnstile(s, 2000)).toEqual({ ok: true, cost: E.TURNSTILE_COFFEE });
  expect(s.lobby).toBe('done');
  expect(s.coffee.value).toBe(S.coffeeMax(s) - E.TURNSTILE_COFFEE);
  expect(s.coffee.updatedAt).toBe(2000); // the refill clock starts with the first cup taken
  expect(S.passTurnstile(s, 3000)).toEqual({ ok: true, cost: 0 });
  expect(s.coffee.value).toBe(S.coffeeMax(s) - E.TURNSTILE_COFFEE);
});

test('the turnstile waits for a cup if the card was emptied again', () => {
  const s = hire();
  s.lobby = 'gate';
  s.coffee = { value: 0, updatedAt: 0 };
  expect(S.passTurnstile(s, 0)).toEqual({ ok: false, reason: 'coffee' });
  expect(S.passTurnstile(s, E.coffeeRegenMs()).ok).toBe(true);
});

test('saves from before the lobby check-in skip it; a new hire save keeps it', () => {
  const old = JSON.parse(S.serialize(fresh()));
  delete old.lobby;
  expect(S.deserialize(JSON.stringify(old), 0).lobby).toBe('done');
  expect(S.deserialize(S.serialize(hire()), 0).lobby).toBe('checkin');
});
