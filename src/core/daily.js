// The daily stand-up: once per local calendar day a colleague asks for a quick favour (a tier-1 mini-game). Free to play,
// no KPI stars or cooldown; pays a daily bonus and keeps a streak of consecutive days. Pure, no DOM.
import * as E from './economy.js';

/** Quick games only: the favour should take a minute. */
export const STANDUP_GAMES = Object.keys(E.GAME_TIER).filter((g) => E.GAME_TIER[g] === 1);

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day, 'YYYY-MM-DD'. */
export function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

/** 'locked' before the lobby check-in, 'done' once today's stand-up is played, else 'pending'. */
export function standupStatus(s, now) {
  if (s.lobby !== 'done') return 'locked';
  return s.daily?.day === dayKey(now) ? 'done' : 'pending';
}

/** Today's favour, the same all day. */
export function standupGame(day) {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STANDUP_GAMES[h % STANDUP_GAMES.length];
}

/**
 * Pays the daily bonus for any result. `day` = the day the stand-up was started (it may end after midnight); it counts
 * for that day. Returns null if that day's stand-up is already done.
 */
export function completeStandup(s, game, score, now, rng = Math.random, day = dayKey(now)) {
  if (s.lobby !== 'done' || !(day > (s.daily?.day || ''))) return null;
  const stars = E.starsFromScore(score);
  const sp = 2 * E.taskReward(s.maxFloor, Math.max(1, stars), s.perks).sp;
  const xp = E.taskReward(s.maxFloor, stars, s.perks).xp;
  s.sp += sp;
  const lv = E.addXp(s.level, s.xp, xp);
  s.level = lv.level;
  s.xp = lv.xp;
  const prev = s.daily || { day: null, streak: 0, best: 0 };
  const streak = prev.day && prev.day === prevDay(day) ? prev.streak + 1 : 1;
  s.daily = { day, streak, best: Math.max(prev.best || 0, streak) };
  const bonusSo = streak % E.STANDUP_STREAK_SO === 0 || rng() < E.STANDUP_SO_CHANCE ? 1 : 0;
  s.so += lv.levelsGained + bonusSo;
  s.coffee.value += E.STANDUP_COFFEE; // may top the pot over, like the coffee machine
  s.played[game] = (s.played[game] || 0) + 1;
  s.stats.standups = (s.stats.standups || 0) + 1;
  return { standup: true, stars, sp, xp, coffee: E.STANDUP_COFFEE, bonusSo, streak, levelsGained: lv.levelsGained };
}
