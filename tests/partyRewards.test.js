// The Christmas party's lasting rewards: the year's Secret Santa desk decoration (never in a shop) and three badges.
import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as K from '../src/core/desk.js';
import { BADGES } from '../src/core/achievements.js';

const player = () => {
  const s = S.newGame({ corpName: 'Acme' }, 0);
  s.lobby = 'done';
  return s;
};
const badge = (id) => BADGES.find((b) => b.id === id);

test('the Secret Santa gift is a desk decoration of its year, in no shop, owned only as a gift', () => {
  expect(K.decorItem('xmas-2026')).toEqual({ id: 'xmas-2026', name: 'Christmas tree 2026', slot: 'left', cost: 0, needs: 'party', year: 2026 });
  expect(K.decorItem('xmas-26')).toBe(null);
  for (let f = 1; f <= 40; f++) expect(K.deskOffer(f).some((d) => d.id.startsWith('xmas-'))).toBe(false);
  const s = player();
  s.sp = 1e6;
  expect(K.buyDecor(s, 1, 'xmas-2026').ok).toBe(false);
  expect(K.decorUnlocked(s, K.decorItem('xmas-2026'))).toBe(false);
  expect(K.giveDecor(s, 'xmas-2026')).toBe(true);
  expect(K.giveDecor(s, 'xmas-2026')).toBe(false);
  expect(K.decorUnlocked(s, K.decorItem('xmas-2026'))).toBe(true);
  expect(K.toggleDecor(s, 'xmas-2026')).toEqual({ ok: true, shown: true });
  expect(s.desk.show.left).toBe('xmas-2026');
});

test('Party Animal, Tipsy and Designated Driver follow the party counters', () => {
  const s = player();
  for (const id of ['partyanimal', 'tipsy', 'designated']) expect(badge(id).test(s)).toBe(false);
  s.stats.parties = 1;
  expect(badge('partyanimal').test(s)).toBe(true);
  s.stats.partyTipsy = 1;
  expect(badge('tipsy').test(s)).toBe(true);
  s.stats.partyDesignated = 1;
  expect(badge('designated').test(s)).toBe(true);
});
