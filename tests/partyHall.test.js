// tests/partyHall.test.js
// The party hall (core/partyHall.js): every activity, the bar and the doors reachable; guests are colleagues you know.
import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import { buildFloor } from '../src/core/tasks.js';
import { isItemReachable } from '../src/core/floorgen.js';
import { buildPartyHall, partyGuests } from '../src/core/partyHall.js';
import { ACTIVITY_GAMES } from '../src/core/party.js';
import { PARTY_QUIPS } from '../src/data/party.js';
import { curioOf } from '../src/core/curios.js';

const hall = buildPartyHall();
const career = (maxFloor) => {
  const s = S.newGame({ corpName: 'Acme' }, 0);
  s.lobby = 'done';
  s.maxFloor = maxFloor;
  return s;
};

test('the hall: every activity and the bar reachable from the doors; spots free to stand on', () => {
  expect(hall).toMatchObject({ party: true, foreign: true, w: 44, h: 28 });
  expect(hall.activities.map((it) => it.activity.game).sort()).toEqual([...ACTIVITY_GAMES].sort());
  for (const it of [...hall.activities, hall.bar]) expect(isItemReachable(hall, hall.walk, hall.dist, it), it.type).toBe(true);
  expect(hall.danceSpots.length).toBe(6);
  expect(hall.mingleSpots.length).toBe(8);
  for (const p of [...hall.danceSpots, ...hall.mingleSpots, hall.arrive]) {
    const i = Math.floor(p.y) * hall.w + Math.floor(p.x);
    expect(hall.walk[i], `${p.x},${p.y}`).toBe(1);
    expect(hall.dist[i]).toBeGreaterThanOrEqual(0);
  }
  expect(buildPartyHall()).toBe(hall); // cached
});

test('every piece of non-gameplay furniture in the hall has party lines of its own', () => {
  for (const it of hall.items) {
    const c = curioOf(hall, it);
    if (!c) continue;
    const key = it.type === 'chairup' ? 'chair' : it.type;
    expect(PARTY_QUIPS[key]?.length || 0, it.type).toBeGreaterThanOrEqual(20);
  }
});

test('guests are colleagues from the floors you know, never one the CEO fired; 6 dance', () => {
  const s = career(12);
  const known = new Map();
  for (let f = 1; f <= 12; f++) for (const n of buildFloor(f).npcs) known.set(n.seed, buildFloor(f).dept);
  const fired = [...known.keys()].slice(0, 5);
  for (const seed of fired) s.fired[seed] = true;
  const guests = partyGuests(s, 2026);
  expect(guests.length).toBe(14);
  expect(new Set(guests.map((g) => g.seed)).size).toBe(14);
  for (const g of guests) {
    expect(known.get(g.seed)).toBe(g.dept);
    expect(fired).not.toContain(g.seed);
  }
  expect(guests.filter((g) => g.dancer).length).toBe(6);
  expect(partyGuests(s, 2026)).toEqual(guests); // the same party on every load
  expect(partyGuests(s, 2027)).not.toEqual(guests);
});

test('a new hire\'s party: no more guests than colleagues on floor 1', () => {
  const s = career(1);
  const pool = buildFloor(1).npcs.length;
  const guests = partyGuests(s, 2026);
  expect(guests.length).toBe(Math.min(14, pool));
  for (const seed of buildFloor(1).npcs.map((n) => n.seed)) s.fired[seed] = true;
  expect(partyGuests(s, 2026)).toEqual([]);
});
