import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as V from '../src/core/events.js';
import { buildFloor } from '../src/core/tasks.js';
import { createRng } from '../src/core/rng.js';

const player = () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  return s;
};
const MIN = 60 * 1000;

test('events wait for the check-in, some time on the floor, no other quest, and the gap since the last one', () => {
  const s = player();
  const ok = { onFloorS: E.EVENT_MIN_ON_FLOOR_S, busy: false };
  expect(V.canStartEvent(s, 4 * MIN, ok)).toBe(false); // a new career gets 5 quiet minutes
  expect(V.canStartEvent(s, 5 * MIN, ok)).toBe(true);
  expect(V.canStartEvent(s, 5 * MIN, { ...ok, onFloorS: 10 })).toBe(false);
  expect(V.canStartEvent(s, 5 * MIN, { ...ok, busy: true })).toBe(false);
  s.lobby = 'gate';
  expect(V.canStartEvent(s, 5 * MIN, ok)).toBe(false);
  s.lobby = 'done';
  V.scheduleNext(s, 10 * MIN, createRng(1));
  expect(s.events.nextAt).toBeGreaterThanOrEqual(10 * MIN + E.EVENT_GAP_MIN_S * 1000);
  expect(s.events.nextAt).toBeLessThanOrEqual(10 * MIN + E.EVENT_GAP_MAX_S * 1000);
});

test('every floor can hold a fire drill, cake and an audit; printers only where there is one', () => {
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    const list = V.availableEvents(fl);
    expect(list).toContain('drill');
    expect(list).toContain('cake');
    expect(list).toContain('audit');
    const hasPrinter = fl.items.some((it) => it.type === 'printer' || it.type === 'copier');
    expect(list.includes('printer')).toBe(hasPrinter);
    if (hasPrinter) expect(['printer', 'copier']).toContain(V.eventTarget(fl, 'printer').type);
    expect(['kitchentable', 'counter']).toContain(V.eventTarget(fl, 'cake').type);
  }
});

test('the fire exit is the corridor end farther from the player, and it is walkable', () => {
  const fl = buildFloor(3);
  const left = V.fireExit(fl, 30);
  const right = V.fireExit(fl, 5);
  expect(left.side).toBe('left');
  expect(right.side).toBe('right');
  for (const ex of [left, right])
    for (let y = ex.y0; y <= ex.y1; y++) for (let x = ex.x0; x <= ex.x1; x++) expect(fl.walk[y * fl.w + x]).toBe(1);
  expect(V.inExit(left, 1.5, left.y0 + 0.5)).toBe(true);
  expect(V.inExit(left, 6.5, left.y0 + 0.5)).toBe(false);
});

test('winning an event pays its reward and counts it; losing pays nothing', () => {
  const s = player();
  s.floor = 4;
  const sp = s.sp;
  const r = V.applyEventResult(s, 'drill', true, 4);
  expect(r.sp).toBe(E.taskReward(4, 1).sp);
  expect(s.sp).toBe(sp + r.sp);
  expect(s.stats.events.drill).toBe(1);
  expect(V.applyEventResult(s, 'drill', false, 4)).toBe(null);
  expect(s.stats.events.drill).toBe(1);
  s.coffee.value = S.coffeeMax(s) - 3;
  expect(V.applyEventResult(s, 'cake', true, 4).coffee).toBe(E.EVENT_CAKE_COFFEE);
  expect(s.coffee.value).toBe(S.coffeeMax(s) - 3 + E.EVENT_CAKE_COFFEE);
  // The cake fills the mug, never past it.
  expect(V.applyEventResult(s, 'cake', true, 4).coffee).toBe(1);
  expect(s.coffee.value).toBe(S.coffeeMax(s));
  expect(V.applyEventResult(s, 'cake', true, 4).coffee).toBe(0);
  expect(s.coffee.value).toBe(S.coffeeMax(s));
  const xp = s.xp;
  const a = V.applyEventResult(s, 'audit', true, 4);
  expect(a.xp).toBe(E.taskReward(4, 2).xp);
  expect(s.xp === xp + a.xp || a.levelsGained > 0).toBe(true);
});

test('old saves gain the event clock', () => {
  const s = player();
  delete s.events;
  const back = S.deserialize(JSON.stringify(s), 1000);
  expect(back.events.nextAt).toBeGreaterThan(1000);
});
