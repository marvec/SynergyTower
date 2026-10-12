import { test, expect } from 'bun:test';
import * as E from '../src/core/economy.js';
import { ALL_GAMES } from '../src/core/tasks.js';

test('star thresholds', () => {
  expect([0, 0.34, 0.35, 0.59, 0.6, 0.84, 0.85, 1].map(E.starsFromScore)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});

test('requirements grow every floor', () => {
  for (let f = 2; f <= E.FLOORS; f++) {
    expect(E.starQuota(f)).toBeGreaterThan(E.starQuota(f - 1));
    expect(E.keycardFee(f)).toBeGreaterThan(E.keycardFee(f - 1));
    expect(E.baseCooldownMs(f)).toBeGreaterThan(E.baseCooldownMs(f - 1));
    expect(E.xpToNext(f)).toBeGreaterThan(E.xpToNext(f - 1));
  }
});

test('an average player (2★ per play) can afford each floor from that floor’s earnings', () => {
  // Plays needed to hit the quota at 2★ average; SP earned must cover the keycard fee
  // and cumulative XP must reach the next floor's level requirement.
  let level = 1;
  let xp = 0;
  for (let f = 1; f < E.FLOORS; f++) {
    const plays = Math.ceil(E.starQuota(f) / 2);
    const r = E.taskReward(f, 2);
    expect(r.sp * plays).toBeGreaterThan(E.keycardFee(f));
    ({ level, xp } = E.addXp(level, xp, r.xp * plays));
    expect(level).toBeGreaterThanOrEqual(E.levelRequiredForFloor(f + 1));
  }
});

test('addXp handles multiple level-ups', () => {
  const big = E.xpToNext(1) + E.xpToNext(2) + 5;
  expect(E.addXp(1, 0, big)).toEqual({ level: 3, xp: 5, levelsGained: 2 });
});

test('coffee regen keeps partial progress and caps at max', () => {
  const r = E.regenCoffee(3, 0, 250000, 12, 120000);
  expect(r).toEqual({ value: 5, updatedAt: 240000 });
  expect(E.regenCoffee(11, 0, 10 ** 9, 12, 120000).value).toBe(12);
});

test('perk costs escalate', () => {
  const mug = E.PERKS.find((p) => p.id === 'mug');
  expect(E.perkCost(mug, 1)).toBeGreaterThan(E.perkCost(mug, 0));
});

test('every mini-game has a complexity tier of 1-3', () => {
  for (const g of ALL_GAMES) expect([1, 2, 3]).toContain(E.GAME_TIER[g]);
  expect(Object.keys(E.GAME_TIER).sort()).toEqual([...ALL_GAMES].sort());
  expect(E.gameTier(undefined)).toBe(2);
  expect(E.gameTier('nope')).toBe(2);
});

test('coffee cost follows the tier; simple games cool down longest', () => {
  expect(E.taskCoffeeCost('quiz')).toBe(1);
  expect(E.taskCoffeeCost('typing')).toBe(2);
  expect(E.taskCoffeeCost('spreadsheet')).toBe(3);
  expect(E.taskCoffeeCost(undefined)).toBe(2);
  for (const f of [1, 20, 40]) {
    const simple = E.stationCooldownMs(f, {}, 'quiz');
    const medium = E.stationCooldownMs(f, {}, 'typing');
    const complex = E.stationCooldownMs(f, {}, 'spreadsheet');
    expect(simple).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(complex);
  }
  expect(E.stationCooldownMs(1, {}, 'quiz')).toBe(240000);
  expect(E.stationCooldownMs(1, {}, 'spreadsheet')).toBe(45000);
  expect(E.reviewCooldownMs(1)).toBe(2 * E.baseCooldownMs(1));
});

test('smaller pot, 2-minute regen', () => {
  expect(E.maxCoffee(1)).toBe(6);
  expect(E.maxCoffee(40)).toBe(14);
  expect(E.maxCoffee(1, { mug: 2 })).toBe(10);
  expect(E.coffeeRegenMs()).toBe(120000);
  expect(E.coffeeRegenMs({ espresso: 5 })).toBe(60000);
});
