import { test, expect } from 'bun:test';
import { newGame, deserialize } from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as N from '../src/core/nightShift.js';
import { buildFloor } from '../src/core/tasks.js';

const MIN = 60 * 1000;
const NOON = new Date(2026, 9, 14, 12).getTime();
const TOMORROW = NOON + 24 * 60 * MIN;
const game = (floor = 15) => {
  const s = newGame({ corpName: 'Test' }, 0);
  s.lobby = 'done';
  s.floor = s.maxFloor = floor;
  s.coffee.value = 5;
  return s;
};
const stations = (floor) => buildFloor(floor).tasks.map((it) => it.task);

test('the night floors are 5, 15, 25 and 35, for 10 minutes', () => {
  expect(E.NIGHT_FLOORS).toEqual([5, 15, 25, 35]);
  expect(E.NIGHT_SHIFT_S).toBe(600);
  expect(N.isNightFloor(5)).toBe(true);
  expect(N.isNightFloor(6)).toBe(false);
});

test('one shift a day, shared by the four floors', () => {
  const s = game(35);
  expect(N.nightStatus(s, 5, NOON)).toBe('available');
  expect(N.nightStatus(s, 6, NOON)).toBe('none');
  expect(N.startNightShift(s, 5, NOON).ok).toBe(true);
  expect(N.nightStatus(s, 5, NOON + MIN)).toBe('on');
  N.endNightShift(s);
  expect(N.nightStatus(s, 35, NOON + 20 * MIN)).toBe('today');
  expect(N.startNightShift(s, 35, NOON + 20 * MIN).ok).toBe(false);
  expect(N.nightStatus(s, 35, TOMORROW)).toBe('available');
  expect(s.nightShifts.count).toBe(1);
});

test('no shift on hold, on a trip or holiday, or before checking in', () => {
  const cases = [
    (s) => (s.conduct.hold = { at: 0, floor: 15, by: 1 }),
    (s) => (s.trip = { floor: 10, endsAt: NOON + MIN }),
    (s) => (s.vacation = { endsAt: NOON + MIN, done: {}, coffee: 0 }),
    (s) => (s.lobby = 'checkin'),
  ];
  for (const set of cases) {
    const s = game();
    set(s);
    expect(N.nightStatus(s, 15, NOON)).toBe('blocked');
    expect(N.startNightShift(s, 15, NOON).ok).toBe(false);
    expect(s.nightShift).toBe(null);
  }
});

test('starting the shift halves the cooldowns running on that floor only', () => {
  const s = game();
  const [a] = stations(15);
  const [b] = stations(14);
  s.cooldowns[a.id] = NOON + 6 * MIN;
  s.cooldowns[b.id] = NOON + 6 * MIN;
  s.cooldowns['coffee-machine-15'] = NOON + 10 * MIN;
  N.startNightShift(s, 15, NOON);
  expect(s.cooldowns[a.id]).toBe(NOON + 3 * MIN);
  expect(s.cooldowns[b.id]).toBe(NOON + 6 * MIN);
  expect(s.cooldowns['coffee-machine-15']).toBe(NOON + 10 * MIN); // the day machine keeps its own
  expect(s.nightShift).toEqual({ floor: 15, endsAt: NOON + 10 * MIN, tasks: 0, sp: 0, stars: 0, coffee: 0 });
});

test('a night task has half the cooldown, pays as usual and counts in the tally', () => {
  const s = game();
  const task = stations(15)[0];
  N.startNightShift(s, 15, NOON);
  const sp0 = s.sp;
  const r = N.completeNightTask(s, task, 0.9, NOON + MIN, () => 1);
  expect(s.cooldowns[task.id] - (NOON + MIN)).toBe(Math.round(E.stationCooldownMs(15, s.perks, task.game) * 0.5));
  expect(s.starsByFloor[15]).toBe(r.stars);
  expect(s.sp - sp0).toBe(r.sp);
  expect(s.nightShift).toMatchObject({ tasks: 1, sp: r.sp, stars: r.stars });
});

test('the task card shows the halved cooldown on the night shift\'s floor only', () => {
  const s = game();
  const task = stations(15)[0];
  const day = E.stationCooldownMs(15, s.perks, task.game);
  expect(N.taskCooldownMs(s, task.game)).toBe(day);
  N.startNightShift(s, 15, NOON);
  expect(N.taskCooldownMs(s, task.game)).toBe(Math.round(day * 0.5));
  N.completeNightTask(s, task, 0.9, NOON + MIN, () => 1);
  expect(s.cooldowns[task.id] - (NOON + MIN)).toBe(N.taskCooldownMs(s, task.game));
  s.floor = 14;
  expect(N.taskCooldownMs(s, stations(14)[0].game)).toBe(E.stationCooldownMs(14, s.perks, stations(14)[0].game));
});

test('the night brewer is ready at once and every 2 minutes after', () => {
  const s = game();
  s.cooldowns['coffee-machine-15'] = NOON + 10 * MIN;
  N.startNightShift(s, 15, NOON);
  s.coffee = { value: 0, updatedAt: NOON }; // room in the mug: the brewers stop at its maximum
  const first = N.useNightBrewer(s, NOON);
  expect(first.ok).toBe(true);
  expect(N.useNightBrewer(s, NOON + MIN).ok).toBe(false);
  expect(N.useNightBrewer(s, NOON + 2 * MIN).ok).toBe(true);
  expect(s.nightShift.coffee).toBe(2 * E.COFFEE_MACHINE_AMOUNT);
  expect(s.cooldowns['coffee-machine-15']).toBe(NOON + 10 * MIN);
});

test('the shift runs out after 10 minutes and ending it returns the tally', () => {
  const s = game();
  N.startNightShift(s, 15, NOON);
  expect(N.nightActive(s, NOON + 9 * MIN)).toBe(true);
  expect(N.nightLeft(s, NOON + 9 * MIN)).toBe(MIN);
  expect(N.nightActive(s, NOON + 10 * MIN)).toBe(false);
  expect(N.endNightShift(s)).toEqual({ floor: 15, tasks: 0, sp: 0, stars: 0, coffee: 0 });
  expect(s.nightShift).toBe(null);
  expect(N.endNightShift(s)).toBe(null);
});

test('resetNight offers today\'s shift again', () => {
  const s = game();
  N.startNightShift(s, 15, NOON);
  N.resetNight(s);
  expect(s.nightShift).toBe(null);
  expect(N.nightStatus(s, 15, NOON)).toBe('available');
});

test('saves from before the night shift load with the defaults', () => {
  const s = game();
  delete s.nightShifts;
  delete s.nightShift;
  const loaded = deserialize(JSON.stringify(s));
  expect(loaded.nightShifts).toEqual({ day: null, count: 0 });
  expect(loaded.nightShift).toBe(null);
  expect(N.nightStatus(loaded, 15, NOON)).toBe('available');
});
