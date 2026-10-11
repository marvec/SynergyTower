import { test, expect } from 'bun:test';
import { FLOORS, stationCount } from '../src/core/economy.js';
import { FLOOR_W, FLOOR_H, T_WALL, isItemReachable, bfs, gatedWalk } from '../src/core/floorgen.js';
import { buildFloor, ALL_GAMES } from '../src/core/tasks.js';
import { measureText } from '../src/engine/font.js';
import { POSTER_TEXT, FAKE_ADS } from '../src/data/sponsors.js';

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

test('every floor has a "your logo here" poster and a fake ad, each fitting an unbroken hallway wall section', () => {
  const room = (p) => (p.x1 - p.x0 + 1) * 16 - 4;
  for (let f = 1; f <= FLOORS; f++) {
    const fl = buildFloor(f);
    expect(fl.posters.map((p) => p.kind).sort()).toEqual(['ad', 'logo']);
    for (const p of fl.posters) {
      for (let x = p.x0; x <= p.x1; x++) {
        expect(fl.tiles[p.y * fl.w + x]).toBe(T_WALL);
        expect(fl.tiles[(p.y + 1) * fl.w + x]).not.toBe(T_WALL);
      }
      if (p.kind === 'logo') expect(measureText(POSTER_TEXT) + 10).toBeLessThanOrEqual(room(p));
      else expect(FAKE_ADS.some((a) => measureText(a.name) + 16 <= room(p))).toBe(true);
    }
  }
  expect(measureText(FAKE_ADS[0].name) + 16).toBeLessThanOrEqual(room(buildFloor(1).posters.find((p) => p.kind === 'ad')));
});

test('the ground floor lobby: Jargon Detector check-in at the front desk, a receptionist, turnstiles in the only way out', () => {
  const fl = buildFloor(1);
  const desk = fl.tasks.find((it) => it.task.checkin);
  expect(desk.type).toBe('reception');
  expect(desk.task.game).toBe('jargon');
  expect(fl.tasks.filter((it) => it.task.checkin).length).toBe(1);
  expect(fl.receptionist.y).toBe(desk.y - 1);
  const lobby = fl.rooms.find((r) => r.type === 'reception');
  const door = lobby.doors[0];
  expect(fl.turnstile).toMatchObject({ x: door.x, y: door.y, w: door.w, interact: 'turnstile' });
  // Closed, the turnstiles shut the lobby off from the rest of the floor; open, everything is reachable.
  const closed = gatedWalk(fl);
  const dist = bfs(fl, closed, Math.floor(fl.spawn.x), Math.floor(fl.spawn.y));
  expect(isItemReachable(fl, closed, dist, desk)).toBe(true);
  expect(isItemReachable(fl, closed, dist, fl.elevator)).toBe(false);
  expect(fl.tasks.filter((it) => isItemReachable(fl, closed, dist, it))).toEqual([desk]);
  for (let f = 2; f <= FLOORS; f++) {
    expect(buildFloor(f).turnstile).toBeFalsy();
    expect(buildFloor(f).tasks.some((it) => it.task.checkin)).toBe(false);
  }
});

test('turnstile posts are solid even when the gates are open; the lanes between them stay walkable', () => {
  const fl = buildFloor(1);
  const t = fl.turnstile;
  expect(t.posts.length).toBeGreaterThan(0);
  for (let k = 0; k < t.w; k++) expect([k, fl.walk[t.y * fl.w + t.x + k]]).toEqual([k, t.posts.includes(k) ? 0 : 1]);
});
