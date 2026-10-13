import { test, expect } from 'bun:test';
import { newGame } from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as V from '../src/core/vacation.js';
import { dayKey } from '../src/core/daily.js';
import { BADGES } from '../src/core/achievements.js';
import { buildHotel, ACTIVITIES } from '../src/core/hotel.js';
import { buildWalkable, bfs, isItemReachable, T_WATER } from '../src/core/floorgen.js';
import { MINIGAMES } from '../src/minigames/index.js';
import { ALL_GAMES } from '../src/core/tasks.js';

const MIN = 60 * 1000;
const NOON = new Date(2026, 9, 13, 12).getTime();
const game = (floor = 20, sp = 6000) => {
  const s = newGame({ corpName: 'Test' }, 0);
  s.lobby = 'done';
  s.floor = s.maxFloor = floor;
  s.sp = sp;
  s.coffee.value = 5;
  return s;
};

test('the boss on floor 20 grants vacation for 5000 paperclips, once a day', () => {
  expect(E.VACATION_FLOOR).toBe(20);
  expect(E.VACATION_COST).toBe(5000);
  const s = game();
  expect(V.vacationStatus(s, 19, NOON)).toBe('none');
  expect(V.vacationStatus(s, 20, NOON)).toBe('available');
  expect(V.requestVacation(s, 19, NOON).ok).toBe(false);
  const r = V.requestVacation(s, 20, NOON);
  expect(r.ok).toBe(true);
  expect(s.sp).toBe(1000);
  expect(s.vacation).toEqual({ endsAt: NOON + E.VACATION_S * 1000, done: {}, coffee: 0 });
  expect(E.VACATION_S).toBe(15 * 60);
  expect(V.vacationActive(s, NOON + 14 * MIN)).toBe(true);
  expect(V.vacationLeft(s, NOON + 5 * MIN)).toBe(10 * MIN);
  expect(V.vacationActive(s, NOON + 15 * MIN)).toBe(false);
  V.endVacation(s);
  // Back at work the same day: no second holiday, even with the money.
  s.sp = 9000;
  expect(V.vacationStatus(s, 20, NOON + 60 * MIN)).toBe('today');
  expect(V.requestVacation(s, 20, NOON + 60 * MIN).ok).toBe(false);
  expect(s.sp).toBe(9000);
  // The next day the boss signs again.
  expect(V.vacationStatus(s, 20, NOON + 24 * 60 * MIN)).toBe('available');
  expect(s.vacations).toEqual({ day: dayKey(NOON), count: 1 });
});

test('without 5000 paperclips the request is refused and nothing is charged', () => {
  const s = game(20, 4999);
  expect(V.vacationStatus(s, 20, NOON)).toBe('available');
  const r = V.requestVacation(s, 20, NOON);
  expect(r).toEqual({ ok: false, reason: 'sp', missing: 1 });
  expect(s.sp).toBe(4999);
  expect(s.vacation).toBeFalsy();
});

test('an activity with at least 1 star gives one coffee on top of a full pot, once per stay', () => {
  const s = game();
  s.coffee.value = 30; // over the maximum already
  V.requestVacation(s, 20, NOON);
  const a = V.completeActivity(s, 'sleep', 0.9);
  expect(a).toEqual({ stars: 3, coffee: E.VACATION_COFFEE, first: true });
  expect(E.VACATION_COFFEE).toBe(1);
  expect(s.coffee.value).toBe(31);
  expect(V.activityDone(s, 'sleep')).toBe(true);
  // Done: playing it again pays nothing.
  expect(V.completeActivity(s, 'sleep', 1)).toEqual({ stars: 3, coffee: 0, first: false });
  expect(s.coffee.value).toBe(31);
  // A flop (0 stars) pays nothing and leaves the activity open for another go.
  expect(V.completeActivity(s, 'swim', 0.2)).toEqual({ stars: 0, coffee: 0, first: false });
  expect(V.activityDone(s, 'swim')).toBe(false);
  expect(V.completeActivity(s, 'swim', 0.5).coffee).toBe(1);
  expect(s.vacation.coffee).toBe(2);
  // The extra coffee is not regenerated away: it stays until it is drunk.
  expect(V.endVacation(s)).toEqual({ coffee: 2, activities: 2 });
  expect(s.vacation).toBeNull();
  expect(s.coffee.value).toBe(32);
});

test('Out of Office badge comes with the first vacation; resetVacation (debugging) allows another', () => {
  const s = game();
  const badge = BADGES.find((b) => b.id === 'vacation');
  expect(badge.test(s)).toBe(false);
  V.requestVacation(s, 20, NOON);
  expect(badge.test(s)).toBe(true);
  V.resetVacation(s);
  expect(s.vacation).toBeNull();
  expect(V.vacationStatus(s, 20, NOON)).toBe('available');
  expect(badge.test(s)).toBe(true); // the count stays
});

test('the hotel: every activity is reachable from the entrance, water is not walkable', () => {
  const fl = buildHotel();
  expect(fl.foreign).toBe(true);
  const games = fl.activities.map((it) => it.activity.game).sort();
  expect(games).toEqual(ACTIVITIES.map((a) => a.game).sort());
  expect(games.length).toBeGreaterThanOrEqual(8);
  const walk = buildWalkable(fl);
  const e = fl.entrance;
  const dist = bfs(fl, walk, e.x, e.y + 1);
  for (const it of fl.activities) expect(isItemReachable(fl, walk, dist, it), it.activity.game).toBe(true);
  let water = 0;
  for (let i = 0; i < fl.tiles.length; i++) if (fl.tiles[i] === T_WATER) {
    water++;
    expect(walk[i]).toBe(0);
  }
  expect(water).toBeGreaterThan(200); // the pool and the sea
  // The arrival point is walkable and right inside the main entrance.
  expect(walk[Math.floor(fl.arrive.y) * fl.w + Math.floor(fl.arrive.x)]).toBe(1);
  expect(e.y).toBe(0);
});

test('holiday games are registered mini-games but never office stations', () => {
  for (const a of ACTIVITIES) {
    expect(MINIGAMES[a.game]?.id).toBe(a.game);
    expect(ALL_GAMES).not.toContain(a.game);
    expect(E.GAME_TIER[a.game]).toBeUndefined();
  }
});

const inSuite = (fl, x, y) => fl.rooms[fl.roomOf[y * fl.w + x]]?.type === 'suite';

test('the suite is private: guests never start in it or walk into it', () => {
  const fl = buildHotel();
  const doors = [];
  for (let y = 0; y < fl.h; y++)
    for (let x = 0; x < fl.w; x++) {
      const i = y * fl.w + x;
      if (inSuite(fl, x, y)) expect(!!fl.npcWalk[i]).toBe(false);
      // Doorways out of the suite (to the lobby, onto the terrace) are closed to guests too.
      if (fl.walk[i] && !inSuite(fl, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inSuite(fl, x + dx, y + dy)) && fl.roomOf[i] < 0) doors.push(i);
    }
  expect(doors.length).toBeGreaterThan(0);
  for (const i of doors) expect(!!fl.npcWalk[i]).toBe(false);
  for (const n of fl.npcs) expect(!!fl.npcWalk[Math.floor(n.y) * fl.w + Math.floor(n.x)]).toBe(true);
  // Everywhere else the guests can still reach is open to them.
  const open = fl.walk.filter((w, i) => w && !inSuite(fl, i % fl.w, Math.floor(i / fl.w))).length;
  expect(fl.npcWalk.filter(Boolean).length).toBeGreaterThan(open - 8);
});

test('hotel decor answers a poke with holiday lines; activities stay gameplay', async () => {
  const Q = await import('../src/core/curios.js');
  const { HOTEL_QUIPS } = await import('../src/data/vacation.js');
  const { measureText } = await import('../src/engine/font.js');
  const fl = buildHotel();
  const types = new Set();
  for (const it of fl.items) {
    if (it.activity || ['receptionist', 'reception'].includes(it.type)) { // the reception desk is the concierge's
      expect(Q.curioOf(fl, it), it.type).toBeNull();
      continue;
    }
    expect(Q.curioOf(fl, it), it.type).toBe('quip');
    types.add(it.type);
    const line = Q.quipFor(fl, it, {});
    expect(line.length).toBeGreaterThan(0);
  }
  for (const t of ['palm', 'pottedpalm', 'lounger', 'hammock', 'sofa', 'fountain', 'flowers', 'torch']) expect(types.has(t), t).toBe(true);
  // Hotel lines, not the office's: the hotel sofa is not the meeting-room sofa.
  const sofa = fl.items.find((it) => it.type === 'sofa');
  const { QUIPS } = await import('../src/data/curios.js');
  expect(QUIPS.sofa).not.toContain(Q.quipFor(fl, sofa, {}));
  for (const [type, lines] of Object.entries(HOTEL_QUIPS)) {
    expect(lines.length, type).toBeGreaterThanOrEqual(20);
    expect(new Set(lines).size, type).toBe(lines.length);
    for (const l of lines) expect(measureText(l), `${type}: ${l}`).toBeLessThanOrEqual(560);
  }
});

test('the suite rug lies flat: you are drawn on top of it wherever you stand on it', async () => {
  const { installMockDocument } = await import('./mock-canvas.js');
  installMockDocument();
  const { FloorView, itemDepth } = await import('../src/scenes/floorWorld.js');
  const { TILE } = await import('../src/engine/art.js');
  const fl = buildHotel();
  const view = new FloorView(fl, { color: '#3366cc', dark: '#22448a', light: '#88aaee' });
  const rug = view.sprites.find((s) => s.it.type === 'rug');
  expect(rug).toBeTruthy();
  for (let y = rug.it.y; y <= rug.it.y + rug.it.h; y += 0.25) expect(itemDepth(rug)).toBeLessThan(y * TILE);
  // Standing furniture still sorts by its base, in front of someone standing behind it.
  const bed = view.sprites.find((s) => s.it.type === 'hotelbed');
  expect(itemDepth(bed)).toBeGreaterThan(bed.it.y * TILE);
});
