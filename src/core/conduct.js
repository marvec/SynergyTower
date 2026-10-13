// Conduct: one colleague per floor can be asked out for a drink. Every ask is a strike (the first one gets a polite no,
// asking again after it gets colder answers). HOLD_STRIKES strikes (across all floors) put the career on compliance hold:
// no tasks, no elevator, no terminal until the compliance training at any HR desk. Passing clears the strikes;
// failing also demotes the player one floor, and that floor's HR performance review has to be passed again; failing on
// the ground floor, with no floor below, gets the player fired: the career is over (the scene deletes it).
// After the training the strikes start from zero, so the whole thing can happen again (on every floor), except with
// the colleague who reported you: they never get asked again. Pure, no DOM.
import * as E from './economy.js';

const fresh = () => ({ strikes: 0, refused: {}, reported: {}, hold: null, trained: false, holds: 0, demotions: 0 });

/** The career's conduct record (saves from before it get an empty one). */
export function conduct(s) {
  if (!s.conduct) s.conduct = fresh();
  return s.conduct;
}

/** The colleague on a tower floor who can be asked out: a fixed one of fl.npcs (not the first: trip / leave offers). */
export function chatSeed(fl, floor) {
  const pool = fl.npcs.slice(1);
  if (!pool.length) return null;
  return pool[(floor * 7 + 3) % pool.length].seed;
}

export const onHold = (s) => !!s.conduct?.hold;

/** On hold before checking in at reception: no badge, so the HR office beyond the turnstiles is out of reach. Fired. */
export const lockedOut = (s) => onHold(s) && s.lobby === 'checkin';

/** Whether the drink question is on offer: 'ask' (never asked), 'again' (they said no), null (on hold, or they reported you). */
export function askState(s, seed) {
  const c = conduct(s);
  if (c.hold || c.reported?.[seed]) return null;
  return c.refused[seed] ? 'again' : 'ask';
}

/**
 * The player asks this colleague out: always a strike. Returns { kind: 'first' | 'repeat' (they had said no before),
 * strike (the career's strike count now), hold (this one started the compliance hold) } or null (on hold).
 */
export function askOut(s, seed, now) {
  const c = conduct(s);
  if (!askState(s, seed)) return null;
  const kind = c.refused[seed] ? 'repeat' : 'first';
  c.refused[seed] = (c.refused[seed] || 0) + 1;
  c.strikes++;
  const hold = c.strikes >= E.HOLD_STRIKES;
  if (hold) {
    c.hold = { at: now, floor: s.floor, by: seed };
    c.reported = { ...c.reported, [seed]: true };
    c.holds++;
  }
  return { kind, strike: c.strikes, hold };
}

/**
 * The compliance training's result. Passing clears the hold and the strikes; failing does too, after a demotion:
 * the highest floor drops by one and the review of the floor the player lands on is due again. Failing on floor 1
 * fires the player (`fired`; `conduct.fired` is set, the caller ends the career).
 * Returns { passed, demoted, fired, from, to } (from/to: the highest floor before and after).
 */
export function completeTraining(s, score) {
  const c = conduct(s);
  const passed = score >= E.COMPLIANCE_PASS_SCORE;
  const from = s.maxFloor;
  c.hold = null;
  c.strikes = 0;
  c.trained = true; // took the training at least once
  if (passed) return { passed, demoted: false, fired: false, from, to: from };
  if (from <= 1) {
    c.fired = true;
    return { passed, demoted: false, fired: true, from, to: from };
  }
  s.maxFloor = from - 1;
  s.floor = Math.min(s.floor, s.maxFloor); // only moves you if you were on the floor you lost
  const reviews = { ...s.reviews };
  delete reviews[from];
  delete reviews[s.maxFloor];
  s.reviews = reviews;
  c.demotions++;
  return { passed, demoted: true, fired: false, from, to: s.maxFloor };
}
