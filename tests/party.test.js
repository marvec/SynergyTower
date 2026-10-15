// tests/party.test.js
// Christmas party rules (core/party.js): the December window, once a year, who may go, pay once per activity, the Secret
// Santa gift, drinks and sobering up, the sway, the summary and its badge counters.
import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as PA from '../src/core/party.js';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const DEC10 = at(2026, 12, 10);
const guest = () => {
  const s = S.newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  s.maxFloor = s.floor = 12;
  return s;
};

test('the window is 6-23 December, local time', () => {
  expect(PA.partyWindow(at(2026, 12, 5, 23, 59))).toBe(false);
  expect(PA.partyWindow(at(2026, 12, 6, 0, 0))).toBe(true);
  expect(PA.partyWindow(at(2026, 12, 23, 23, 59))).toBe(true);
  expect(PA.partyWindow(at(2026, 12, 24, 0, 0))).toBe(false);
  expect(PA.partyWindow(at(2026, 11, 10))).toBe(false);
  expect(PA.partyWindow(at(2027, 1, 10))).toBe(false);
});

test('once per career and year; blocked on hold, before check-in and while away', () => {
  const s = guest();
  expect(PA.partyStatus(s, at(2026, 11, 30))).toBe('closed');
  expect(PA.partyStatus(s, DEC10)).toBe('available');
  expect(PA.inviteDue(s, DEC10)).toBe(true);
  PA.markInvited(s, DEC10);
  expect(PA.inviteDue(s, DEC10)).toBe(false);
  const so = s.so;
  expect(PA.startParty(s, 12, DEC10)).toEqual({ ok: true, so: 1 });
  expect(s.so).toBe(so + 1);
  expect(s.parties[2026]).toBe('done');
  expect(s.stats.parties).toBe(1);
  expect(PA.partyStatus(s, DEC10)).toBe('on');
  PA.endParty(s, 'done');
  expect(PA.partyStatus(s, at(2026, 12, 20))).toBe('done');
  expect(PA.startParty(s, 12, at(2026, 12, 20))).toEqual({ ok: false, reason: 'done' });
  expect(PA.partyStatus(s, at(2027, 12, 10))).toBe('available'); // next year
  const t = guest();
  t.lobby = 'checkin';
  expect(PA.partyBlock(t)).toBe('badge');
  t.lobby = 'done';
  t.conduct.hold = { since: 0 };
  expect(PA.partyBlock(t)).toBe('hold');
  t.conduct.hold = null;
  for (const k of ['trip', 'vacation', 'nightShift', 'home']) {
    t[k] = { endsAt: DEC10 + 1 };
    expect(PA.partyStatus(t, DEC10)).toBe('blocked');
    t[k] = null;
  }
  // The dev helper may force a party outside the window.
  expect(PA.startParty(guest(), 12, at(2026, 7, 1), { force: true }).ok).toBe(true);
});

test('a party started late on 23 December runs past midnight and keeps its year', () => {
  const s = guest();
  const start = at(2026, 12, 23, 23, 55);
  expect(PA.startParty(s, 12, start).ok).toBe(true);
  const after = at(2026, 12, 24, 0, 2);
  expect(PA.partyActive(s, after)).toBe(true);
  expect(PA.partyStatus(s, after)).toBe('on');
  expect(s.party.year).toBe(2026);
  expect(PA.partyActive(s, start + E.PARTY.stayS * 1000)).toBe(false);
});

test('pausing holds the party clock', () => {
  const s = guest();
  PA.startParty(s, 12, DEC10);
  const ends = s.party.endsAt;
  S.holdClocks(s, 5000);
  expect(s.party.endsAt).toBe(ends + 5000);
});

test('activities pay twice a 3-star task on your highest floor, once each; never XP, KPI stars or coffee', () => {
  const s = guest();
  PA.startParty(s, 12, DEC10);
  const pay = Math.round(E.taskReward(12, 3, s.perks).sp * E.PARTY.spMult);
  expect(PA.activityPay(s)).toBe(pay);
  const before = { sp: s.sp, xp: s.xp, coffee: s.coffee.value, stars: s.starsByFloor[12] };
  expect(PA.completePartyActivity(s, 'dance', 0.2)).toMatchObject({ stars: 0, sp: 0, first: false });
  expect(PA.completePartyActivity(s, 'dance', 0.9)).toMatchObject({ stars: 3, sp: pay, first: true });
  expect(PA.completePartyActivity(s, 'dance', 0.9)).toMatchObject({ sp: 0, first: false });
  expect(PA.activityDone(s, 'dance')).toBe(true);
  expect(s.sp).toBe(before.sp + pay);
  expect(s.party.sp).toBe(pay);
  expect(s.xp).toBe(before.xp);
  expect(s.coffee.value).toBe(before.coffee);
  expect(s.starsByFloor[12]).toBe(before.stars);
  expect(s.played.dance).toBe(3);
});

test('gift wrapping at 1 star brings the year\'s Secret Santa gift, once', () => {
  const s = guest();
  PA.startParty(s, 12, DEC10);
  expect(PA.completePartyActivity(s, 'giftwrap', 0.1).gift).toBe(null);
  expect(PA.completePartyActivity(s, 'giftwrap', 0.5).gift).toBe('xmas-2026');
  expect(s.desk.owned).toContain('xmas-2026');
  expect(PA.completePartyActivity(s, 'giftwrap', 0.9).gift).toBe(null);
  expect(s.desk.owned.filter((id) => id === 'xmas-2026').length).toBe(1);
});

test('drinks: up to 3, then the bartender refuses; water sobers; one level wears off per 120 s of play', () => {
  const s = guest();
  expect(PA.drink(s, 'punch')).toEqual({ ok: false, reason: 'off' });
  PA.startParty(s, 12, DEC10);
  expect(PA.drink(s, 'mulled')).toEqual({ ok: true, tipsy: 1 });
  expect(PA.drink(s, 'eggnog')).toEqual({ ok: true, tipsy: 2 });
  expect(PA.drink(s, 'punch')).toEqual({ ok: true, tipsy: 3 });
  expect(PA.drink(s, 'punch')).toEqual({ ok: false, reason: 'enough' });
  expect(s.party.drinks).toBe(3);
  PA.tickParty(s, 119);
  expect(PA.tipsyLevel(s)).toBe(3);
  PA.tickParty(s, 2);
  expect(PA.tipsyLevel(s)).toBe(2);
  PA.tickParty(s, 240);
  expect(PA.tipsyLevel(s)).toBe(0);
  PA.drink(s, 'punch');
  expect(PA.drink(s, 'water')).toEqual({ ok: true, tipsy: 0 });
  expect(s.party.drinks).toBe(4);
  expect(s.party.t).toBeCloseTo(361);
});

test('the sway grows with the drinks and is nothing when sober', () => {
  expect(PA.sway(0, 3.3)).toEqual({ x: 0, y: 0 });
  for (let t = 0; t < 20; t += 0.37)
    for (const k of [1, 2, 3]) {
      const o = PA.sway(k, t);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(k);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(Math.ceil(k / 2));
    }
});

test('the summary, and the counters behind the Tipsy and Designated Driver badges', () => {
  const s = guest();
  PA.startParty(s, 12, DEC10);
  for (const g of PA.ACTIVITY_GAMES) PA.completePartyActivity(s, g, 0.5);
  const sum = PA.endParty(s, 'done');
  expect(sum).toMatchObject({ floor: 12, year: 2026, result: 'done', activities: 5, total: 5, drinks: 0, gift: 'xmas-2026' });
  expect(sum.sp).toBe(5 * PA.activityPay(s));
  expect(s.party).toBe(null);
  expect(s.stats.partyDesignated).toBe(1);
  expect(s.stats.partyTipsy || 0).toBe(0);
  const t = guest();
  PA.startParty(t, 12, DEC10);
  for (let i = 0; i < 3; i++) PA.drink(t, 'punch');
  expect(PA.endParty(t, 'early')).toMatchObject({ result: 'early', drinks: 3, activities: 0 });
  expect(t.stats.partyTipsy).toBe(1);
  expect(t.stats.partyDesignated || 0).toBe(0);
});

test('resetParty (the dev helper) offers this year\'s party again', () => {
  const s = guest();
  PA.startParty(s, 12, DEC10);
  PA.markInvited(s, DEC10);
  PA.resetParty(s, DEC10);
  expect(s.party).toBe(null);
  expect(PA.partyStatus(s, DEC10)).toBe('available');
  expect(PA.inviteDue(s, DEC10)).toBe(true);
});

test('old saves gain the party fields', () => {
  const s = guest();
  delete s.parties;
  delete s.partyInvite;
  delete s.party;
  const back = S.deserialize(JSON.stringify(s), DEC10);
  expect(back.parties).toEqual({});
  expect(back.party).toBe(null);
  expect(PA.partyStatus(back, DEC10)).toBe('available');
});
