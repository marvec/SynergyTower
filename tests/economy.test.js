import { test, expect } from 'bun:test';
import * as E from '../src/core/economy.js';

test('star thresholds', () => {
  expect([0, 0.34, 0.35, 0.59, 0.6, 0.84, 0.85, 1].map(E.starsFromScore)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});

test('requirements grow every floor', () => {
  for (let f = 2; f <= E.FLOORS; f++) {
    expect(E.starQuota(f)).toBeGreaterThan(E.starQuota(f - 1));
    expect(E.keycardFee(f)).toBeGreaterThan(E.keycardFee(f - 1));
    expect(E.stationCooldownMs(f)).toBeGreaterThan(E.stationCooldownMs(f - 1));
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
