import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import { upcomingReminders } from '../src/core/reminders.js';

const fresh = () => S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);

test('a full coffee pot needs no reminder', () => {
  expect(upcomingReminders(fresh(), 0)).toEqual([]);
});

test('coffee reminder lands exactly when the pot is full', () => {
  const s = fresh();
  const max = S.coffeeMax(s);
  s.coffee = { value: max - 5, updatedAt: 0 };
  const now = 30_000; // part of the first cup has already brewed
  const [r] = upcomingReminders(s, now);
  expect(r.kind).toBe('coffee');
  expect(r.at).toBe(5 * E.coffeeRegenMs(s.perks));
  S.tick(s, r.at - 1);
  expect(s.coffee.value).toBeLessThan(max);
  S.tick(s, r.at);
  expect(s.coffee.value).toBe(max);
});

test('review reminder only for a ready player waiting on the HR cooldown', () => {
  const s = fresh();
  s.cooldowns[S.reviewKey(1)] = 600_000;
  expect(upcomingReminders(s, 0).some((r) => r.kind === 'review')).toBe(false); // not ready yet
  s.starsByFloor[1] = E.starQuota(1);
  s.level = E.levelRequiredForFloor(2);
  s.sp = E.keycardFee(1);
  expect(upcomingReminders(s, 0).find((r) => r.kind === 'review').at).toBe(600_000);
  s.reviews[1] = true;
  expect(upcomingReminders(s, 0).some((r) => r.kind === 'review')).toBe(false);
});

test('reminders are sorted soonest first', () => {
  const s = fresh();
  s.coffee = { value: 0, updatedAt: 0 };
  s.starsByFloor[1] = E.starQuota(1);
  s.level = E.levelRequiredForFloor(2);
  s.sp = E.keycardFee(1);
  s.cooldowns[S.reviewKey(1)] = 60_000;
  expect(upcomingReminders(s, 0).map((r) => r.kind)).toEqual(['review', 'coffee']);
});
