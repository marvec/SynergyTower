// The Daily Memo: once per local calendar date every career gets the same station mini-game, seed, difficulty and
// department, one attempt each, and a short result text to share. Everything follows from the date and the build, so
// devices agree without a server. Pure, no DOM.
import * as E from './economy.js';
import { onHold } from './conduct.js';
import { dayKey } from './daily.js';
import { createRng, hashString } from './rng.js';
import { DEPARTMENTS, titleForFloor } from '../data/departments.js';
import { taskTitle } from '../data/taskTitles.js';

/** Memo #1. Set to the release date in the release PR. */
export const MEMO_EPOCH = '2026-11-01';
export const MEMO_HISTORY = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The games, append-only: never edit an entry. A new entry's `from` sits on a cycle boundary of the one before and at
 * least 60 Memos after the release that adds it, so older builds agree on every Memo before it. Only games whose
 * content depends on create() alone, at any frame rate (tests/memoGames.test.js).
 */
export const MEMO_POOLS = [
  {
    from: 1,
    games: [
      'inbox', 'compose', 'typing', 'spreadsheet', 'stealth', 'math', 'cables', 'simon', 'stocks', 'expense', 'order',
      'calendar', 'jargon', 'karaoke', 'orgchart', 'memory', 'bingo', 'quiz', 'coffee', 'tailgate', 'password',
    ],
  },
];

const utcDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Today's Memo number (local date); < 1 before the epoch. */
export const memoNumber = (now) => Math.round((utcDay(dayKey(now)) - utcDay(MEMO_EPOCH)) / DAY_MS) + 1;

const cycles = new WeakMap(); // pools → Map('entry:cycle' → games in order)

/** The game of Memo n: each entry's games shuffled per cycle, never the same game two days running. */
export function memoGame(n, pools = MEMO_POOLS) {
  let i = pools.length - 1;
  while (i >= 0 && pools[i].from > n) i--;
  if (i < 0) return null;
  const { from, games } = pools[i];
  const c = Math.floor((n - from) / games.length);
  let cache = cycles.get(pools);
  if (!cache) cycles.set(pools, (cache = new Map()));
  const key = `${i}:${c}`;
  if (!cache.has(key)) {
    const order = createRng(hashString(`memo-cycle:${from}:${c}`)).shuffle(games);
    const start = from + c * games.length;
    if (order.length > 1 && order[0] === memoGame(start - 1, pools)) [order[0], order[1]] = [order[1], order[0]];
    cache.set(key, order);
  }
  return cache.get(key)[(n - from) % games.length];
}

/** Everything Memo n fixes: { n, game, seed, difficulty, dept }, or null before the epoch. */
export function memoFor(n) {
  const game = memoGame(n);
  if (!game) return null;
  const rng = createRng(hashString(`memo:${n}`));
  const difficulty = Math.round((0.3 + rng.next() * 0.5) * 100) / 100;
  const dept = rng.pick(DEPARTMENTS).id;
  return { n, game, seed: hashString(`memo-game:${n}`), difficulty, dept };
}

/**
 * The theme the host passes to the game: fixed by the Memo, never by the career (password reads stats.floor), so
 * every career gets the same content. The floor is the department's first.
 */
export function memoTheme(memo) {
  const floor = 1 + 5 * DEPARTMENTS.findIndex((d) => d.id === memo.dept);
  return { dept: memo.dept, title: taskTitle(memo.game, memo.dept), stats: { floor, stars: 0, title: titleForFloor(floor) } };
}

/** 'locked' (no badge yet, compliance hold), 'none' (before the epoch), 'done' (played or under way), else 'pending'. */
export function memoStatus(s, now) {
  if (s.lobby !== 'done' || onHold(s)) return 'locked';
  const n = memoNumber(now);
  if (n < 1) return 'none';
  const m = s.memo || {};
  return n <= (m.last || 0) || (m.open && m.open.n >= n) ? 'done' : 'pending';
}

/** Uses today's attempt: the scene saves right after, so a reload settles it to 0. Null if it is not pending. */
export function startMemo(s, now) {
  if (memoStatus(s, now) !== 'pending') return null;
  const memo = memoFor(memoNumber(now));
  s.memo.open = { n: memo.n, game: memo.game };
  return memo;
}

/** Score cut to two decimals, the way the share text shows it. */
const cutScore = (score) => Math.floor(Math.max(0, Math.min(1, score)) * 100 + 1e-9) / 100;

/**
 * Stores the result of Memo n (the one started, also after midnight) and pays paperclips at 1+ star. No XP, coffee,
 * KPI stars or games played. Null if that Memo is already done.
 */
export function completeMemo(s, n, score, game = s.memo.open?.game) {
  const m = s.memo;
  if (n <= (m.last || 0)) return null;
  if (m.open?.n === n) m.open = null;
  const stars = E.starsFromScore(score);
  const sp = stars ? Math.round(E.MEMO * E.taskReward(s.maxFloor, stars, s.perks).sp) : 0;
  s.sp += sp;
  m.streak = m.last === n - 1 ? m.streak + 1 : 1;
  m.best = Math.max(m.best || 0, m.streak);
  m.last = n;
  m.count = (m.count || 0) + 1;
  const entry = { n, game: game || memoGame(n), score: cutScore(score), stars };
  m.history = [entry, ...(m.history || [])].slice(0, MEMO_HISTORY);
  s.stats.memos = (s.stats.memos || 0) + 1;
  return { memo: true, ...entry, sp, streak: m.streak };
}

/** An attempt left open (reload, crash, closed tab) is a 0. Runs when a career loads, never during play. */
export function settleMemo(s) {
  const open = s.memo?.open;
  if (!open) return null;
  const r = completeMemo(s, open.n, 0, open.game);
  s.memo.open = null;
  return r;
}

/** The streak as it stands today: 0 once a Memo was missed. */
export function memoStreak(s, now) {
  const m = s.memo || {};
  return m.last && m.last >= memoNumber(now) - 1 ? m.streak : 0;
}

/** Today's result, if played. */
export const memoResult = (s, n) => (s.memo?.history || []).find((h) => h.n === n) || null;

/** The text to share: three lines, the same everywhere. */
export function memoShareText(entry, name) {
  const stars = '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars);
  return `SynergyTower Memo #${entry.n} · ${name}\n${stars} ${entry.score.toFixed(2)}\nsynergytower.co.uk`;
}
