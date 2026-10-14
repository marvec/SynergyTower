import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as D from '../src/core/daily.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const player = () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  return s;
};

test('day keys follow the local calendar', () => {
  expect(D.dayKey(at(2026, 10, 12, 0))).toBe('2026-10-12');
  expect(D.dayKey(at(2026, 10, 12, 23))).toBe('2026-10-12');
  expect(D.prevDay('2026-10-12')).toBe('2026-10-11');
  expect(D.prevDay('2026-03-01')).toBe('2026-02-28');
  expect(D.prevDay('2027-01-01')).toBe('2026-12-31');
});

test('the stand-up waits for the lobby check-in, then comes once a day', () => {
  const s = player();
  s.lobby = 'checkin';
  expect(D.standupStatus(s, at(2026, 10, 12))).toBe('locked');
  s.lobby = 'done';
  expect(D.standupStatus(s, at(2026, 10, 12))).toBe('pending');
  expect(D.completeStandup(s, 'quiz', 0.9, at(2026, 10, 12, 9), () => 1)).toBeTruthy();
  expect(D.standupStatus(s, at(2026, 10, 12, 22))).toBe('done');
  expect(D.completeStandup(s, 'quiz', 0.9, at(2026, 10, 12, 23), () => 1)).toBe(null);
  expect(D.standupStatus(s, at(2026, 10, 13, 8))).toBe('pending');
});

test('stand-up favours are quick tier-1 games, picked by the day', () => {
  for (const day of ['2026-10-12', '2026-10-13', '2027-02-28']) {
    const g = D.standupGame(day);
    expect(E.gameTier(g)).toBe(1);
    expect(D.standupGame(day)).toBe(g);
  }
  const week = new Set(Array.from({ length: 14 }, (_, i) => D.standupGame(D.dayKey(at(2026, 10, 1 + i)))));
  expect(week.size).toBeGreaterThan(3);
});

test('the daily bonus: double paperclips, XP, a cup of coffee, no KPI stars or cooldown', () => {
  const s = player();
  s.maxFloor = 5;
  s.floor = 5;
  s.coffee.value = 2;
  const before = { sp: s.sp, so: s.so };
  const r = D.completeStandup(s, 'timing', 0.7, at(2026, 10, 12), () => 1);
  expect(r.stars).toBe(2);
  expect(r.sp).toBe(2 * E.taskReward(5, 2).sp);
  expect(s.sp).toBe(before.sp + r.sp);
  expect(r.xp).toBe(E.taskReward(5, 2).xp);
  expect(s.coffee.value).toBe(2 + E.STANDUP_COFFEE);
  expect(r.coffee).toBe(E.STANDUP_COFFEE);
  expect(s.starsByFloor[5]).toBeUndefined();
  expect(Object.keys(s.cooldowns)).toEqual([]);
  expect(s.played.timing).toBe(1);
  expect(s.stats.standups).toBe(1);
  expect(r.bonusSo).toBe(0);
  expect(s.so).toBe(before.so + r.levelsGained);
});

test('zero stars still pays the one-star paperclips', () => {
  const s = player();
  const r = D.completeStandup(s, 'quiz', 0, at(2026, 10, 12), () => 1);
  expect(r.stars).toBe(0);
  expect(r.sp).toBe(2 * E.taskReward(1, 1).sp);
});

test('streak: consecutive days count up, a gap starts over, every 7th day pays a Stock Option', () => {
  const s = player();
  let r;
  for (let d = 1; d <= 7; d++) r = D.completeStandup(s, 'quiz', 0.5, at(2026, 10, d), () => 1);
  expect(r.streak).toBe(7);
  expect(r.bonusSo).toBe(1);
  r = D.completeStandup(s, 'quiz', 0.5, at(2026, 10, 9), () => 1);
  expect(r.streak).toBe(1);
  expect(s.daily.best).toBe(7);
});

test('a lucky stand-up pays a Stock Option', () => {
  const s = player();
  const so = s.so;
  const r = D.completeStandup(s, 'quiz', 0.5, at(2026, 10, 12), () => 0);
  expect(r.bonusSo).toBe(1);
  expect(s.so).toBe(so + 1 + r.levelsGained);
});

test('old saves gain the daily state', () => {
  const s = player();
  delete s.daily;
  const back = S.deserialize(JSON.stringify(s), 0);
  expect(back.daily).toEqual({ day: null, streak: 0, best: 0 });
  expect(D.standupStatus(back, at(2026, 10, 12))).toBe('pending');
});

test('a stand-up started before midnight counts for the day it started', () => {
  const s = player();
  D.completeStandup(s, 'quiz', 0.5, at(2026, 10, 11, 9), () => 1);
  const r = D.completeStandup(s, 'quiz', 0.5, at(2026, 10, 13, 0), () => 1, '2026-10-12');
  expect(r.streak).toBe(2);
  expect(s.daily.day).toBe('2026-10-12');
  expect(D.standupStatus(s, at(2026, 10, 13, 1))).toBe('pending');
});

test('the stand-up coffee fills the mug, never past it', () => {
  const s = player();
  s.coffee.value = S.coffeeMax(s);
  const r = D.completeStandup(s, 'timing', 0.7, at(2026, 10, 12), () => 1);
  expect(r.coffee).toBe(0);
  expect(s.coffee.value).toBe(S.coffeeMax(s));
});
