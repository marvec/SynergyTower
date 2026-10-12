import { test, expect } from 'bun:test';
import { newGame, startTask, completeTask } from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as T from '../src/core/trip.js';
import { BADGES } from '../src/core/achievements.js';

const MIN = 60 * 1000;
const game = (floor = 10) => {
  const s = newGame({ corpName: 'Test' }, 0);
  s.lobby = 'done';
  s.floor = s.maxFloor = floor;
  s.coffee.value = 20;
  return s;
};
const task = { id: 'trip10-5', game: 'inbox', title: 'Client inbox', difficulty: 0.3, seed: 1 };

test('the trip is offered on floors 10 and 30 only, once', () => {
  const s = game();
  expect(E.TRIP_FLOORS).toEqual([10, 30]);
  expect(T.tripStatus(s, 10)).toBe('available');
  expect(T.tripStatus(s, 30)).toBe('available');
  expect(T.tripStatus(s, 11)).toBe('none');
  expect(T.departTrip(s, 11).ok).toBe(false);
  expect(T.departTrip(s, 10).ok).toBe(true);
  // Leaving in the car already uses up the chance: a refresh during the drive does not bring it back.
  expect(T.tripStatus(s, 10)).toBe('missed');
  expect(T.departTrip(s, 10).ok).toBe(false);
  expect(T.tripStatus(s, 30)).toBe('available');
});

test('arriving starts a 15-minute visit; the clock is wall time and the trip counts as done', () => {
  const s = game();
  T.departTrip(s, 10);
  const trip = T.arriveTrip(s, 10, 1000);
  expect(T.tripStatus(s, 10)).toBe('done');
  expect(trip).toEqual({ floor: 10, endsAt: 1000 + E.TRIP_VISIT_S * 1000, sp: 0, tasks: 0 });
  expect(E.TRIP_VISIT_S).toBe(15 * 60);
  expect(T.tripLeft(s, 1000 + 5 * MIN)).toBe(10 * MIN);
  expect(T.tripActive(s, 1000 + 5 * MIN)).toBe(true);
  expect(T.tripActive(s, 1000 + 15 * MIN)).toBe(false);
  expect(T.tripLeft(s, 1000 + 16 * MIN)).toBe(0);
  expect(T.endTrip(s)).toEqual({ floor: 10, sp: 0, tasks: 0 });
  expect(s.trip).toBeNull();
  expect(T.tripActive(s, 2000)).toBe(false);
});

test('client tasks cost the same coffee and pay double paperclips, normal XP and no KPI stars', () => {
  const s = game();
  const home = game();
  T.departTrip(s, 10);
  T.arriveTrip(s, 10, 0);
  const before = s.coffee.value;
  expect(startTask(s, task, 10, 0).ok).toBe(true);
  expect(before - s.coffee.value).toBe(E.taskCoffeeCost('inbox'));
  const r = T.completeTripTask(s, task, 0.9, 0, () => 1);
  const h = completeTask(home, task, 10, 0.9, 0, () => 1);
  expect(r.stars).toBe(3);
  expect(r.sp).toBe(h.sp * E.TRIP_SP_MULT);
  expect(E.TRIP_SP_MULT).toBe(2);
  expect(r.xp).toBe(h.xp);
  expect(s.starsByFloor[10] || 0).toBe(0);
  expect(s.trip.sp).toBe(r.sp);
  expect(s.trip.tasks).toBe(1);
  expect(s.bestByTask[task.id]).toBe(3);
  expect(s.played.inbox).toBe(1);
  expect(s.cooldowns[task.id]).toBeGreaterThan(0);
});

test('the client brewer gives the usual cups and is ready again after 2 minutes', () => {
  const s = game();
  T.departTrip(s, 10);
  T.arriveTrip(s, 10, 0);
  s.coffee.value = 1;
  const a = T.useBrewer(s, 0);
  expect(a.ok).toBe(true);
  expect(a.gained).toBe(E.COFFEE_MACHINE_AMOUNT);
  expect(E.TRIP_BREWER_S).toBe(2 * 60);
  expect(T.useBrewer(s, 1 * MIN).ok).toBe(false);
  expect(T.useBrewer(s, 1 * MIN).left).toBe(1 * MIN);
  expect(T.useBrewer(s, 2 * MIN).ok).toBe(true);
  // The tower's own machine is not affected.
  expect(s.cooldowns['coffee-machine-10']).toBeUndefined();
});

test('the Road Warrior badge comes with the first client reached', () => {
  const s = game();
  const badge = BADGES.find((b) => b.id === 'roadwarrior');
  expect(badge.test(s)).toBe(false);
  T.departTrip(s, 10);
  expect(badge.test(s)).toBe(false); // crashed or still driving
  T.arriveTrip(s, 10, 0);
  expect(badge.test(s)).toBe(true);
});
