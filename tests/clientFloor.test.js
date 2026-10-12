import { test, expect } from 'bun:test';
import { buildClientFloor, CLIENT_W, CLIENT_H } from '../src/core/clientFloor.js';
import { FLOOR_W, FLOOR_H, isItemReachable, T_WALL } from '../src/core/floorgen.js';
import { TRIP_FLOORS, TRIP_STATIONS } from '../src/core/economy.js';
import { CLIENTS } from '../src/data/trip.js';

const offices = TRIP_FLOORS.map((f) => buildClientFloor(f));

test("the client's office is much larger than a tower floor", () => {
  for (const fl of offices) {
    expect(fl.w).toBe(CLIENT_W);
    expect(fl.h).toBe(CLIENT_H);
    expect(fl.w * fl.h).toBeGreaterThan(2.5 * FLOOR_W * FLOOR_H);
    expect(fl.rooms.length).toBeGreaterThanOrEqual(18);
    expect(fl.npcs.length).toBeGreaterThanOrEqual(14);
  }
});

test('it has an atrium, a boardroom, a lobby with the entrance and two kitchens with brewers, all reachable', () => {
  for (const fl of offices) {
    const types = fl.rooms.map((r) => r.type);
    for (const t of ['atrium', 'reception', 'special', 'openplan', 'meeting', 'manager', 'copy', 'restroom']) expect(types).toContain(t);
    expect(types.filter((t) => t === 'kitchen').length).toBe(2);
    const brewers = fl.items.filter((it) => it.interact === 'coffee');
    expect(brewers.length).toBe(2);
    for (const b of brewers) expect(isItemReachable(fl, fl.walk, fl.dist, b)).toBe(true);
    expect(fl.entrance).toEqual({ x: 31, y: CLIENT_H - 1, w: 2 });
    expect(fl.tiles[fl.entrance.y * fl.w + fl.entrance.x]).not.toBe(T_WALL);
    const sx = Math.floor(fl.spawn.x);
    const sy = Math.floor(fl.spawn.y);
    expect(fl.walk[sy * fl.w + sx]).toBe(1);
  }
});

test(`${TRIP_STATIONS} task stations, all reachable, varied and without floor quests`, () => {
  for (const fl of offices) {
    expect(fl.tasks.length).toBe(TRIP_STATIONS);
    for (const it of fl.tasks) {
      expect(isItemReachable(fl, fl.walk, fl.dist, it)).toBe(true);
      expect(it.task.id).toBe(`trip${fl.trip}-${it.id}`);
      expect(it.task.difficulty).toBeGreaterThanOrEqual(0);
      expect(it.task.difficulty).toBeLessThanOrEqual(1);
    }
    const games = fl.tasks.map((it) => it.task.game);
    expect(new Set(games).size).toBeGreaterThanOrEqual(14);
    expect(games).not.toContain('feedback');
    expect(games).not.toContain('lostpw');
  }
});

test('no tower fixtures: no elevator, HR desk, desk of your own, workstation terminal or posters', () => {
  for (const fl of offices) {
    expect(fl.items.some((it) => ['elevator', 'hr', 'turnstile'].includes(it.interact))).toBe(false);
    expect(fl.items.some((it) => it.terminal)).toBe(false);
    expect(fl.myDesk).toBeNull();
    expect(fl.hrRep).toBeNull();
    expect(fl.receptionist).toBeNull();
    expect(fl.posters).toEqual([]);
  }
});

test('each client has its own name and look, and the office is the same on every visit', () => {
  const [a, b] = offices;
  expect(a.client.name).toBe(CLIENTS[10].name);
  expect(b.client.name).toBe(CLIENTS[30].name);
  expect(a.client.name).not.toBe(b.client.name);
  expect(a.look.wall).not.toBe(b.look.wall);
  expect(buildClientFloor(10)).toBe(a); // cached
  const again = JSON.stringify(Array.from(a.tiles)) + JSON.stringify(a.items);
  expect(again.length).toBeGreaterThan(0);
});
