import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as K from '../src/core/desk.js';
import { buildFloor } from '../src/core/tasks.js';
import { isItemReachable } from '../src/core/floorgen.js';

const player = () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  s.sp = 100000;
  return s;
};

test('every floor has a desk of your own: a reachable desk with no task and no terminal', () => {
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    const d = fl.myDesk;
    expect(d).toBeTruthy();
    expect(['desk', 'headsetdesk', 'tradingdesk', 'bossdesk']).toContain(d.type);
    expect(d.task).toBeUndefined();
    expect(d.terminal).toBeUndefined();
    expect(isItemReachable(fl, fl.walk, fl.dist, d)).toBe(true);
  }
});

test('you get a desk on every floor you have reached, floor 1 once checked in', () => {
  const s = player();
  s.lobby = 'checkin';
  expect(K.hasDesk(s, 1)).toBe(false);
  s.lobby = 'done';
  expect(K.hasDesk(s, 1)).toBe(true);
  expect(K.hasDesk(s, 2)).toBe(false);
  s.maxFloor = 7;
  expect(K.hasDesk(s, 7)).toBe(true);
  expect(K.hasDesk(s, 8)).toBe(false);
});

test('decorations cost more on higher floors and go on show when bought', () => {
  const s = player();
  s.maxFloor = 10;
  const plant = E.DESK_DECOR.find((d) => d.id === 'plant');
  expect(E.decorCost(plant, 10)).toBeGreaterThan(E.decorCost(plant, 1));
  const sp = s.sp;
  const r = K.buyDecor(s, 10, 'plant');
  expect(r).toEqual({ ok: true, cost: E.decorCost(plant, 10) });
  expect(s.sp).toBe(sp - r.cost);
  expect(K.deskOf(s, 10).show.left).toBe('plant');
  expect(K.buyDecor(s, 10, 'plant').reason).toBe('owned');
  expect(K.deskOf(s, 9).owned).toEqual([]);
});

test('one decoration per slot: a new one takes the spot, owned ones swap for free', () => {
  const s = player();
  K.buyDecor(s, 1, 'plant');
  K.buyDecor(s, 1, 'cactus');
  expect(K.deskOf(s, 1).show.left).toBe('cactus');
  const sp = s.sp;
  expect(K.toggleDecor(s, 1, 'plant')).toEqual({ ok: true, shown: true });
  expect(K.deskOf(s, 1).show.left).toBe('plant');
  expect(K.toggleDecor(s, 1, 'plant')).toEqual({ ok: true, shown: false });
  expect(K.deskOf(s, 1).show.left).toBeUndefined();
  expect(s.sp).toBe(sp);
  expect(K.toggleDecor(s, 1, 'lamp').ok).toBe(false);
});

test('no desk, no money, no trophy before the floor quota', () => {
  const s = player();
  expect(K.buyDecor(s, 3, 'mug').reason).toBe('nodesk');
  s.sp = 0;
  expect(K.buyDecor(s, 1, 'mug').reason).toBe('sp');
  s.sp = 100000;
  expect(K.buyDecor(s, 1, 'trophy').reason).toBe('quota');
  s.starsByFloor[1] = E.starQuota(1);
  expect(K.buyDecor(s, 1, 'trophy').ok).toBe(true);
  expect(K.buyDecor(s, 1, 'nope').reason).toBe('unknown');
});
