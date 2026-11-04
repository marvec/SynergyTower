import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import { upcomingReminders } from '../src/core/reminders.js';

const hire = () => S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
// A player past the lobby check-in with a full coffee pot.
const fresh = () => {
  const s = hire();
  s.lobby = 'done';
  s.coffee.value = S.coffeeMax(s);
  return s;
};

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

test('no coffee reminder before the lobby check-in: the empty card does not refill on its own', () => {
  expect(upcomingReminders(hire(), 0)).toEqual([]);
});

// ------------------------------------------------------------ the Daily Memo reminder
const M = await import('../src/core/memo.js');
const [EY, EM, ED] = M.MEMO_EPOCH.split('-').map(Number);
const memoDay = (n, h = 12) => new Date(EY, EM - 1, ED + n - 1, h).getTime();
const memoOf = (s, now) => upcomingReminders(s, now).find((r) => r.kind === 'memo');

test('the Memo reminder: 10:00 today while today\'s Memo waits, else 10:00 tomorrow', () => {
  const s = fresh();
  const r = memoOf(s, memoDay(20, 8));
  expect(r.at).toBe(memoDay(20, 10));
  expect(r.title).toContain('#20');
  // In the afternoon a reminder for today would come after the player is back: tomorrow's instead.
  expect(memoOf(s, memoDay(20, 15)).at).toBe(memoDay(21, 10));
  expect(memoOf(s, memoDay(20, 15)).title).toContain('#21');
  // Today's done: tomorrow's.
  M.startMemo(s, memoDay(20, 9));
  M.completeMemo(s, 20, 0.7);
  expect(memoOf(s, memoDay(20, 9)).at).toBe(memoDay(21, 10));
});

test('no Memo reminder before the check-in; the list stays soonest first', () => {
  const s = fresh();
  s.lobby = 'checkin';
  expect(memoOf(s, memoDay(20, 8))).toBeUndefined();
  s.lobby = 'done';
  s.coffee = { value: 0, updatedAt: memoDay(20, 8) };
  const list = upcomingReminders(s, memoDay(20, 8));
  expect(list.map((r) => r.kind).sort()).toEqual(['coffee', 'memo']);
  for (let i = 1; i < list.length; i++) expect(list[i].at).toBeGreaterThanOrEqual(list[i - 1].at);
});

test('every reminder kind has a native notification id', async () => {
  const { NATIVE_IDS } = await import('../src/engine/reminders.js');
  const s = fresh();
  s.coffee = { value: 0, updatedAt: memoDay(20, 8) };
  s.cooldowns[S.reviewKey(1)] = memoDay(20, 9);
  s.starsByFloor[1] = E.starQuota(1);
  s.level = E.levelRequiredForFloor(2);
  s.sp = E.keycardFee(1);
  const kinds = upcomingReminders(s, memoDay(20, 8)).map((r) => r.kind);
  expect(kinds.sort()).toEqual(['coffee', 'memo', 'review']);
  for (const k of kinds) expect(NATIVE_IDS[k]).toBeGreaterThan(0);
  expect(new Set(Object.values(NATIVE_IDS)).size).toBe(Object.keys(NATIVE_IDS).length);
});
