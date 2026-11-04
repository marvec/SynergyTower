import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as M from '../src/core/memo.js';
import { DEPARTMENTS } from '../src/data/departments.js';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const [EY, EM, ED] = M.MEMO_EPOCH.split('-').map(Number);
/** Local time on the date of Memo n. */
const memoDay = (n, h = 12, min = 0) => at(EY, EM, ED + n - 1, h, min);
const player = () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  return s;
};

test('the Memo number counts local calendar days from the epoch (AE1)', () => {
  expect(M.memoNumber(memoDay(1, 0, 0))).toBe(1);
  expect(M.memoNumber(memoDay(1, 23, 59))).toBe(1);
  expect(M.memoNumber(memoDay(2, 0, 0))).toBe(2);
  expect(M.memoNumber(memoDay(212, 9))).toBe(212);
  expect(M.memoNumber(memoDay(0, 23, 59))).toBe(0);
});

test('the number goes up by one a day across DST changes', () => {
  for (const [y, m, d] of [[2027, 3, 28], [2027, 10, 31], [2028, 3, 26]]) {
    let prev = M.memoNumber(at(y, m, d - 3, 0, 30));
    for (let i = -2; i <= 3; i++) {
      for (const h of [0, 12, 23]) expect(M.memoNumber(at(y, m, d + i, h, h === 23 ? 59 : 0))).toBe(prev + 1);
      prev++;
    }
  }
});

test('before the epoch there is no Memo to play', () => {
  const s = player();
  expect(M.memoStatus(s, memoDay(0))).toBe('none');
  expect(M.startMemo(s, memoDay(0))).toBe(null);
  expect(M.memoFor(0)).toBe(null);
});

test('memoFor fixes the game, seed, difficulty and department', () => {
  const ids = DEPARTMENTS.map((d) => d.id);
  for (const n of [1, 2, 40, 212, 999]) {
    const m = M.memoFor(n);
    expect(M.memoFor(n)).toEqual(m);
    expect(m.n).toBe(n);
    expect(M.MEMO_POOLS[0].games).toContain(m.game);
    expect(m.difficulty).toBeGreaterThanOrEqual(0.3);
    expect(m.difficulty).toBeLessThanOrEqual(0.8);
    expect(ids).toContain(m.dept);
    expect(Number.isInteger(m.seed)).toBe(true);
  }
  expect(M.memoFor(1).seed).not.toBe(M.memoFor(2).seed);
});

test('every pool game comes once per cycle, never on two days in a row', () => {
  const games = M.MEMO_POOLS[0].games;
  const L = games.length;
  const seq = Array.from({ length: 3 * L }, (_, i) => M.memoGame(1 + i));
  for (let c = 0; c < 3; c++) expect([...seq.slice(c * L, (c + 1) * L)].sort()).toEqual([...games].sort());
  for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  // Over many cycles too, including the swaps at the boundaries.
  for (let n = 2; n < 40 * L; n++) expect(M.memoGame(n)).not.toBe(M.memoGame(n - 1));
});

test('a new pool entry leaves every earlier Memo alone', () => {
  const first = M.MEMO_POOLS[0];
  const from = first.from + 5 * first.games.length; // on a cycle boundary
  const pools = [first, { from, games: [...first.games, 'whack'] }];
  for (let n = 1; n < from; n++) expect(M.memoGame(n, pools)).toBe(M.memoGame(n));
  expect(M.memoGame(from, pools)).not.toBe(M.memoGame(from - 1, pools));
  const L2 = pools[1].games.length;
  const cycle = Array.from({ length: L2 }, (_, i) => M.memoGame(from + i, pools));
  expect(cycle.sort()).toEqual([...pools[1].games].sort());
});

test('a clock set back cannot open an earlier Memo', () => {
  const s = player();
  expect(M.startMemo(s, memoDay(10))).toBeTruthy();
  M.completeMemo(s, 10, 0.7);
  expect(M.memoStatus(s, memoDay(7))).toBe('done');
  expect(M.startMemo(s, memoDay(7))).toBe(null);
});

test('the streak counts consecutive Memos; it reads 0 after a missed one (AE4)', () => {
  const s = player();
  M.startMemo(s, memoDay(40));
  expect(M.completeMemo(s, 40, 0.1).streak).toBe(1);
  M.startMemo(s, memoDay(41));
  expect(M.completeMemo(s, 41, 0.95).streak).toBe(2);
  expect(M.memoStreak(s, memoDay(41))).toBe(2);
  expect(M.memoStreak(s, memoDay(42))).toBe(2);
  expect(M.memoStreak(s, memoDay(43))).toBe(0);
  M.startMemo(s, memoDay(43));
  expect(M.completeMemo(s, 43, 0.5).streak).toBe(1);
  expect(s.memo.best).toBe(2);
  expect(s.memo.count).toBe(3);
});

test('a started attempt left open settles to 0 and cannot be retried (AE2)', () => {
  const s = player();
  const m = M.startMemo(s, memoDay(5, 9));
  expect(m.game).toBe(M.memoFor(5).game);
  expect(s.memo.open).toEqual({ n: 5, game: m.game });
  expect(M.memoStatus(s, memoDay(5, 9))).toBe('done');
  const r = M.settleMemo(s);
  expect(r.score).toBe(0);
  expect(r.stars).toBe(0);
  expect(s.memo.open).toBe(null);
  expect(s.memo.history[0]).toEqual({ n: 5, game: m.game, score: 0, stars: 0 });
  expect(M.memoStatus(s, memoDay(5, 10))).toBe('done');
  expect(M.startMemo(s, memoDay(5, 10))).toBe(null);
  expect(M.settleMemo(s)).toBe(null);
});

test('an attempt started before midnight counts for its own Memo (AE3)', () => {
  const s = player();
  M.startMemo(s, memoDay(40, 23, 59));
  const r = M.completeMemo(s, 40, 0.9);
  expect(r.n).toBe(40);
  expect(s.memo.history[0].n).toBe(40);
  expect(M.memoNumber(memoDay(41, 0, 1))).toBe(41);
  expect(M.memoStatus(s, memoDay(41, 0, 1))).toBe('pending');
});

test('the reward: paperclips at 1+ star only; no XP, coffee, KPI stars or games played', () => {
  for (const [score, stars] of [[0.1, 0], [0.4, 1], [0.7, 2], [0.95, 3]]) {
    const s = player();
    s.maxFloor = 7;
    s.coffee.value = 2;
    const before = { sp: s.sp, xp: s.xp, so: s.so, level: s.level };
    M.startMemo(s, memoDay(3));
    const r = M.completeMemo(s, 3, score);
    expect(r.stars).toBe(stars);
    const sp = stars ? Math.round(E.MEMO * E.taskReward(7, stars).sp) : 0;
    expect(r.sp).toBe(sp);
    expect(s.sp).toBe(before.sp + sp);
    expect(s.xp).toBe(before.xp);
    expect(s.level).toBe(before.level);
    expect(s.so).toBe(before.so);
    expect(s.coffee.value).toBe(2);
    expect(s.played).toEqual({});
    expect(s.bestByTask).toEqual({});
    expect(s.starsByFloor).toEqual({});
    expect(s.cooldowns).toEqual({});
    expect(S.gamesPlayed(s).played).toBe(0);
    expect(s.stats.memos).toBe(1);
  }
});

test('completing the same Memo twice does nothing the second time', () => {
  const s = player();
  M.startMemo(s, memoDay(3));
  expect(M.completeMemo(s, 3, 0.9)).toBeTruthy();
  const sp = s.sp;
  expect(M.completeMemo(s, 3, 0.9)).toBe(null);
  expect(s.sp).toBe(sp);
});

test('the share text: three lines, the score with two decimals', () => {
  expect(M.memoShareText({ n: 212, score: 0.78, stars: 2 }, 'Spreadsheet')).toBe('SynergyTower Memo #212 · Spreadsheet\n★★☆ 0.78\nsynergytower.co.uk');
  expect(M.memoShareText({ n: 3, score: 1, stars: 3 }, 'Quiz').split('\n')[1]).toBe('★★★ 1.00');
  expect(M.memoShareText({ n: 3, score: 0, stars: 0 }, 'Quiz').split('\n')[1]).toBe('☆☆☆ 0.00');
});

test('stored scores are cut to two decimals and match their stars', () => {
  const s = player();
  M.startMemo(s, memoDay(3));
  const r = M.completeMemo(s, 3, 0.84999);
  expect(r.score).toBe(0.84);
  expect(r.stars).toBe(2);
});

test('the history keeps the last 30 results, newest first', () => {
  const s = player();
  for (let n = 1; n <= 35; n++) {
    M.startMemo(s, memoDay(n));
    M.completeMemo(s, n, 0.5);
  }
  expect(s.memo.history.length).toBe(30);
  expect(s.memo.history[0].n).toBe(35);
  expect(s.memo.history[29].n).toBe(6);
  expect(s.memo.best).toBe(35);
});

test('an old save without a Memo loads with the default', () => {
  const s = player();
  delete s.memo;
  delete s.stats.memos;
  const t = S.deserialize(JSON.stringify(s), 0);
  expect(t.memo).toEqual(S.newGame({}, 0).memo);
  expect(M.memoStatus(t, memoDay(3))).toBe('pending');
});

test('locked before the check-in and during a compliance hold', () => {
  const s = player();
  s.lobby = 'checkin';
  expect(M.memoStatus(s, memoDay(3))).toBe('locked');
  expect(M.startMemo(s, memoDay(3))).toBe(null);
  s.lobby = 'done';
  s.conduct.hold = { since: 0 };
  expect(M.memoStatus(s, memoDay(3))).toBe('locked');
  s.conduct.hold = null;
  expect(M.memoStatus(s, memoDay(3))).toBe('pending');
});
