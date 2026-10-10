import { test, expect } from 'bun:test';
import { FLOORS, stationCount } from '../src/core/economy.js';
import { FLOOR_W, FLOOR_H, isItemReachable } from '../src/core/floorgen.js';
import { buildFloor, ALL_GAMES } from '../src/core/tasks.js';

const floors = Array.from({ length: FLOORS }, (_, i) => buildFloor(i + 1));

test('every floor has identical dimensions', () => {
  for (const fl of floors) {
    expect(fl.w).toBe(FLOOR_W);
    expect(fl.h).toBe(FLOOR_H);
  }
});

test('every floor has the core rooms and a reachable elevator', () => {
  for (const fl of floors) {
    const types = new Set(fl.rooms.map((r) => r.type));
    for (const t of ['elevator', 'kitchen', 'meeting', 'special', 'hr']) expect(types.has(t)).toBe(true);
    expect(fl.elevator).toBeTruthy();
    expect(isItemReachable(fl, fl.walk, fl.dist, fl.elevator)).toBe(true);
  }
});

test('every floor has a reachable HR review desk with the HR rep behind it', () => {
  for (const fl of floors) {
    expect(fl.hrDesk).toBeTruthy();
    expect(fl.hrRep).toBeTruthy();
    expect(fl.hrRep.y).toBe(fl.hrDesk.y - 1);
    expect(isItemReachable(fl, fl.walk, fl.dist, fl.hrDesk)).toBe(true);
  }
});

test('every floor has the full station count, all reachable', () => {
  for (const fl of floors) {
    expect(fl.tasks.length).toBe(stationCount(fl.floor));
    for (const it of fl.tasks) expect(isItemReachable(fl, fl.walk, fl.dist, it)).toBe(true);
    expect(new Set(fl.tasks.map((t) => t.task.id)).size).toBe(fl.tasks.length);
  }
});

test('all mini-games appear across the tower, and each floor has variety', () => {
  const seen = new Set();
  for (const fl of floors) {
    const games = new Set(fl.tasks.map((t) => t.task.game));
    games.forEach((g) => seen.add(g));
    expect(games.size).toBeGreaterThanOrEqual(5);
  }
  expect([...seen].sort()).toEqual([...ALL_GAMES].sort());
});

test('generation is deterministic', () => {
  const a = buildFloor(17);
  expect(a.tasks.map((t) => t.task.game)).toEqual(buildFloor(17).tasks.map((t) => t.task.game));
});

test('games are spread evenly over the tower: every game early, regularly, about equally often', () => {
  const floors = new Map(ALL_GAMES.map((g) => [g, []]));
  for (let f = 1; f <= 40; f++) {
    const games = buildFloor(f).tasks.map((t) => t.task.game);
    expect(new Set(games).size).toBe(games.length); // no repeats on one floor
    expect(games.filter((g) => g === 'feedback' || g === 'lostpw').length).toBeLessThanOrEqual(1); // one floor quest at most
    for (const g of games) floors.get(g).push(f);
  }
  const counts = [...floors.values()].map((l) => l.length);
  expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3);
  for (const [g, list] of floors) {
    expect([g, list[0] <= 6]).toEqual([g, true]);
    const gaps = list.slice(1).map((f, i) => f - list[i]);
    expect([g, Math.max(...gaps, 40 - list[list.length - 1]) <= 7]).toEqual([g, true]);
  }
});
