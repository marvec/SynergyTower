// Vacation (spec 2026-10-13-vacation): the boss on floor 20 signs a leave request once a day, for paperclips. The stay at
// the hotel (core/hotel.js) has a wall-clock limit; holiday activities pay a coffee each, once per stay. Pure, no DOM.
import * as E from './economy.js';
import { dayKey } from './daily.js';

/** 'none' (not the boss's floor) | 'available' | 'today' (already had today's holiday) | 'away' (a stay is under way). */
export function vacationStatus(s, floor, now) {
  if (floor !== E.VACATION_FLOOR) return 'none';
  if (s.vacation) return 'away';
  return s.vacations?.day === dayKey(now) ? 'today' : 'available';
}

/** Pays and starts the stay. { ok } or { ok: false, reason: 'sp', missing } / { ok: false, reason: <status> }. */
export function requestVacation(s, floor, now) {
  const st = vacationStatus(s, floor, now);
  if (st !== 'available') return { ok: false, reason: st };
  if (s.sp < E.VACATION_COST) return { ok: false, reason: 'sp', missing: E.VACATION_COST - s.sp };
  s.sp -= E.VACATION_COST;
  s.vacations = { day: dayKey(now), count: (s.vacations?.count || 0) + 1 };
  s.vacation = { endsAt: now + E.VACATION_S * 1000, done: {}, coffee: 0 };
  return { ok: true };
}

export const vacationLeft = (s, now) => (s.vacation ? Math.max(0, s.vacation.endsAt - now) : 0);
export const vacationActive = (s, now) => vacationLeft(s, now) > 0;
export const activityDone = (s, game) => !!s.vacation?.done[game];

/**
 * A holiday activity finished with `score`. At least 1 star pays a coffee on top of the pot (it may go over the
 * maximum, so it stays until it is drunk), once per activity and stay; a flop leaves it open for another go.
 */
export function completeActivity(s, game, score) {
  const stars = E.starsFromScore(score);
  const first = stars > 0 && !!s.vacation && !s.vacation.done[game];
  if (!first) return { stars, coffee: 0, first: false };
  s.vacation.done[game] = true;
  s.vacation.coffee += E.VACATION_COFFEE;
  s.coffee.value += E.VACATION_COFFEE;
  return { stars, coffee: E.VACATION_COFFEE, first: true };
}

/** The stay is over (time up or checked out early): returns { coffee, activities }. */
export function endVacation(s) {
  const v = s.vacation;
  s.vacation = null;
  return v ? { coffee: v.coffee, activities: Object.keys(v.done).length } : null;
}

/** Debugging (window.__vacation): today's holiday is on offer again; a stay under way is dropped. */
export function resetVacation(s) {
  s.vacation = null;
  s.vacations = { ...s.vacations, day: null };
}
