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

const offer = (f) => K.deskOffer(f).map((d) => d.id);

test('each floor offers its own selection: seven items with stationery, plus the floor trophy', () => {
  const seen = new Set();
  for (let f = 1; f <= 40; f++) {
    const items = K.deskOffer(f);
    expect(items.length).toBe(E.DESK_OFFER + 1);
    expect(items.filter((d) => d.stationery).length).toBeGreaterThanOrEqual(3);
    for (const d of items) expect(d.minFloor || 1).toBeLessThanOrEqual(f);
    const trophy = items[items.length - 1];
    expect(trophy.id).toBe(K.trophyId(f));
    expect(trophy.needs).toBe('quota');
    expect(K.deskOffer(f)).toEqual(items);
    items.forEach((d) => seen.add(d.id));
    if (f > 1) expect(offer(f)).not.toEqual(offer(f - 1));
  }
  // Items repeat across floors, but over the tower the whole pool comes up.
  for (const d of E.DESK_DECOR) expect(seen.has(d.id)).toBe(true);
});

test('the trophy is named after its floor', () => {
  expect(K.decorItem(K.trophyId(40)).name).toBe("40th Floor's Best Employee");
  expect(K.decorItem(K.trophyId(1)).name).toBe("1st Floor's Best Employee");
  expect(K.decorItem(K.trophyId(2)).name).toBe("2nd Floor's Best Employee");
  expect(K.decorItem(K.trophyId(13)).name).toBe("13th Floor's Best Employee");
  expect(K.decorItem(K.trophyId(23)).name).toBe("23rd Floor's Best Employee");
  expect(K.decorItem('trophy-41')).toBe(null);
});

test('decorations cost more on higher floors, go on show when bought and move with you', () => {
  const s = player();
  s.maxFloor = 40;
  const f = [...Array(40).keys()].map((i) => i + 1).filter((n) => n > 5 && offer(n).includes(offer(1)[0]))[0];
  const id = offer(1)[0];
  const d = K.decorItem(id);
  expect(E.decorCost(d, f)).toBeGreaterThan(E.decorCost(d, 1));
  const sp = s.sp;
  const r = K.buyDecor(s, f, id);
  expect(r).toEqual({ ok: true, cost: E.decorCost(d, f) });
  expect(s.sp).toBe(sp - r.cost);
  expect(K.myDesk(s).show[d.slot]).toBe(id);
  expect(K.buyDecor(s, 1, id).reason).toBe('owned');
  const other = E.DESK_DECOR.find((x) => !offer(1).includes(x.id) && (x.minFloor || 1) === 1);
  expect(K.buyDecor(s, 1, other.id).reason).toBe('notoffered');
});

test('one decoration per slot: a new one takes the spot, owned ones swap for free', () => {
  const s = player();
  // Seven items in three slots: some slot always offers two.
  const items = K.deskOffer(1).filter((d) => !d.needs);
  const slot = ['left', 'right', 'top'].find((sl) => items.filter((d) => d.slot === sl).length >= 2);
  const [a, b] = items.filter((d) => d.slot === slot);
  K.buyDecor(s, 1, a.id);
  K.buyDecor(s, 1, b.id);
  expect(K.myDesk(s).show[a.slot]).toBe(b.id);
  const sp = s.sp;
  expect(K.toggleDecor(s, a.id)).toEqual({ ok: true, shown: true });
  expect(K.myDesk(s).show[a.slot]).toBe(a.id);
  expect(K.toggleDecor(s, a.id)).toEqual({ ok: true, shown: false });
  expect(K.myDesk(s).show[a.slot]).toBeUndefined();
  expect(s.sp).toBe(sp);
  expect(K.toggleDecor(s, 'bonsai').ok).toBe(false);
});

test('no desk, no money, no trophy before the floor quota', () => {
  const s = player();
  const cheap = offer(3)[0];
  expect(K.buyDecor(s, 3, cheap).reason).toBe('nodesk');
  s.sp = 0;
  expect(K.buyDecor(s, 1, offer(1)[0]).reason).toBe('sp');
  s.sp = 100000;
  expect(K.buyDecor(s, 1, K.trophyId(1)).reason).toBe('quota');
  s.starsByFloor[1] = E.starQuota(1);
  expect(K.buyDecor(s, 1, K.trophyId(1)).ok).toBe(true);
  expect(K.myDesk(s).show.right).toBe(K.trophyId(1));
  expect(K.buyDecor(s, 1, 'nope').reason).toBe('unknown');
});

test('old per-floor desks merge into one collection', () => {
  const s = player();
  delete s.desk;
  s.maxFloor = 4;
  s.desks = { 2: { owned: ['plant', 'mug'], show: { left: 'plant' } }, 4: { owned: ['lamp', 'trophy'], show: { left: 'lamp', right: 'trophy' } } };
  const back = S.deserialize(JSON.stringify(s), 0);
  expect(back.desks).toBeUndefined();
  expect(back.desk.owned.sort()).toEqual(['lamp', 'mug', 'plant', 'trophy-4']);
  expect(back.desk.show).toEqual({ left: 'lamp', right: 'trophy-4' });
  const fresh = S.deserialize(JSON.stringify(player()), 0);
  expect(fresh.desk).toEqual({ owned: [], show: {} });
});
