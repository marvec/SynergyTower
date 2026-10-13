// Conduct: one colleague per floor can be asked out for a drink. The first ask is a fair question and gets a polite no;
// asking again after that no is a strike. HOLD_STRIKES strikes (across all floors) put the career on compliance hold:
// no tasks, no elevator, no terminal until the compliance training at any HR desk. Passing clears the strikes;
// failing also demotes the player one floor, and that floor's HR performance review has to be passed again.
// After the training the drink question is gone for good. Pure, no DOM.
import * as E from './economy.js';

const fresh = () => ({ strikes: 0, refused: {}, hold: null, trained: false, holds: 0, demotions: 0 });

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

/** Whether the drink question is on offer, and how it reads: 'ask' (never asked), 'again' (they said no), null (gone). */
export function askState(s, seed) {
  const c = conduct(s);
  if (c.trained || c.hold) return null;
  return c.refused[seed] ? 'again' : 'ask';
}

/**
 * The player asks this colleague out. Returns { kind: 'first' } (a polite no, no strike), { kind: 'repeat', strike,
 * hold } (strike = the career's strike count now; hold = this one started the compliance hold) or null (not on offer).
 */
export function askOut(s, seed, now) {
  const c = conduct(s);
  if (!askState(s, seed)) return null;
  if (!c.refused[seed]) {
    c.refused[seed] = 1;
    return { kind: 'first' };
  }
  c.refused[seed]++;
  c.strikes++;
  const hold = c.strikes >= E.HOLD_STRIKES;
  if (hold) {
    c.hold = { at: now, floor: s.floor };
    c.holds++;
  }
  return { kind: 'repeat', strike: c.strikes, hold };
}

/**
 * The compliance training's result. Passing clears the hold and the strikes; failing does too, after a demotion:
 * the highest floor drops by one (never below 1) and the review of the floor the player lands on is due again.
 * Returns { passed, demoted, from, to } (from/to: the highest floor before and after).
 */
export function completeTraining(s, score) {
  const c = conduct(s);
  const passed = score >= E.COMPLIANCE_PASS_SCORE;
  const from = s.maxFloor;
  c.hold = null;
  c.strikes = 0;
  c.trained = true;
  if (passed) return { passed, demoted: false, from, to: from };
  s.maxFloor = Math.max(1, from - 1);
  s.floor = Math.min(s.floor, s.maxFloor); // only moves you if you were on the floor you lost
  const reviews = { ...s.reviews };
  delete reviews[from];
  delete reviews[s.maxFloor];
  s.reviews = reviews;
  c.demotions++;
  return { passed, demoted: s.maxFloor < from, from, to: s.maxFloor };
}
