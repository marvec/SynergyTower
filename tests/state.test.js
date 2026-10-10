import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import { ALL_GAMES } from '../src/core/tasks.js';

const task = { id: 'f1-3' };
const fresh = () => S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);

test('task costs coffee, sets cooldown and rewards', () => {
  const s = fresh();
  const start = s.coffee.value;
  expect(S.startTask(s, task, 1, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(start - E.coffeeCost(1));
  const r = S.completeTask(s, task, 1, 0.9, 0, () => 1);
  expect(r.stars).toBe(3);
  expect(s.starsByFloor[1]).toBe(3);
  expect(s.sp).toBe(E.STARTING.sp + r.sp);
  expect(S.canStartTask(s, task, 1, 1000).reason).toBe('cooldown');
  expect(S.canStartTask(s, task, 1, E.stationCooldownMs(1) + 1).ok).toBe(true);
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
  expect(s.coffee.value).toBe(coffee - E.coffeeCost(1));
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
  expect(S.gamesPlayed(s)).toEqual({ played: 0, total: ALL_GAMES.length });
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
