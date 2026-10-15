// Christmas party (spec 2026-10-15-christmas-party): once per career and calendar year, local dates 6-23 December. The
// Fun Committee's invitation (or the elevator's party button) starts 10 minutes in the party hall (scenes/party.js).
// Activities are free and pay paperclips once each; arriving pays a Stock Option; gift wrapping brings the year's Secret
// Santa desk decoration. Drinks at the bar only make things wobblier. Pure, no DOM.
//
// state.parties = { [year]: 'done' }: that year's party has started
// state.partyInvite = year: the invitation for that year has been shown
// state.party = { floor, year, endsAt, t, paid, best, sp, drinks, tipsy, soberT, gift, speech } while it lasts
//   t       seconds of play at the party (walking about, plus each activity's play time when it ends): sobering runs on it
//   paid    { game: true }: the activity has paid out (at least 1 star)
//   best    { game: stars }: the best result per activity (Designated Driver)
//   tipsy   0..maxTipsy; soberT: play seconds since the last level wore off (or the last drink)
//   speech  the CEO's speech has been given
import * as E from './economy.js';
import { onHold } from './conduct.js';
import { partyGiftId, giveDecor } from './desk.js';

export const PARTY = E.PARTY;
/** The party's activities: dance (DJ booth), gift wrapping (Secret Santa), carols (stage), buffet, photo booth. */
export const ACTIVITY_GAMES = ['dance', 'giftwrap', 'carols', 'buffet', 'photobooth'];

export const partyYear = (now) => new Date(now).getFullYear();

/** True on the local dates fromDay..toDay of December. */
export function partyWindow(now) {
  const d = new Date(now);
  return d.getMonth() === PARTY.month && d.getDate() >= PARTY.fromDay && d.getDate() <= PARTY.toDay;
}

/** Why nobody can go right now: 'hold' (compliance hold), 'badge' (not checked in), 'away' (a trip, holiday, night shift, home office or the archive), or null. */
export function partyBlock(s) {
  if (onHold(s)) return 'hold';
  if (s.lobby !== 'done') return 'badge';
  if (s.trip || s.vacation || s.nightShift || s.home || s.archive?.task?.inside) return 'away';
  return null;
}

/** 'on' (under way) | 'closed' (not in the window) | 'done' (this year's is used up) | 'blocked' | 'available'. force: ignore the date (dev helper). */
export function partyStatus(s, now, { force = false } = {}) {
  if (s.party) return 'on';
  if (!force && !partyWindow(now)) return 'closed';
  if (s.parties?.[partyYear(now)]) return 'done';
  if (partyBlock(s)) return 'blocked';
  return 'available';
}

/** The invitation opens once a year, the first time it can. */
export const inviteDue = (s, now) => partyStatus(s, now) === 'available' && s.partyInvite !== partyYear(now);
export function markInvited(s, now) {
  s.partyInvite = partyYear(now);
}

/** Starts the party: this year's is used up, the year-end bonus is paid. */
export function startParty(s, floor, now, { force = false } = {}) {
  const st = partyStatus(s, now, { force });
  if (st !== 'available') return { ok: false, reason: st };
  const year = partyYear(now);
  s.parties = { ...s.parties, [year]: 'done' };
  s.so += PARTY.bonusSo;
  s.stats.parties = (s.stats.parties || 0) + 1;
  s.party = { floor, year, endsAt: now + PARTY.stayS * 1000, t: 0, paid: {}, best: {}, sp: 0, drinks: 0, tipsy: 0, soberT: 0, gift: null, speech: false };
  return { ok: true, so: PARTY.bonusSo };
}

export const partyLeft = (s, now) => (s.party ? Math.max(0, s.party.endsAt - now) : 0);
export const partyActive = (s, now) => partyLeft(s, now) > 0;

/** What an activity pays the first time it reaches a star: twice a 3-star task on your highest floor. */
export const activityPay = (s) => Math.round(E.taskReward(s.maxFloor, 3, s.perks).sp * PARTY.spMult);

/** An activity finished with `score`: paperclips once at 1 star or more; gift wrapping also brings the Secret Santa gift. */
export function completePartyActivity(s, game, score) {
  const stars = E.starsFromScore(score);
  s.played[game] = (s.played[game] || 0) + 1;
  const p = s.party;
  if (p) p.best[game] = Math.max(p.best[game] || 0, stars);
  let gift = null;
  if (game === 'giftwrap' && stars > 0 && p && !p.gift) {
    gift = partyGiftId(p.year);
    p.gift = gift;
    giveDecor(s, gift);
  }
  const first = stars > 0 && !!p && !p.paid[game];
  if (!first) return { stars, sp: 0, first: false, gift };
  p.paid[game] = true;
  const sp = activityPay(s);
  s.sp += sp;
  p.sp += sp;
  return { stars, sp, first: true, gift };
}

export const activityDone = (s, game) => !!s.party?.paid[game];

/** At the bar: a drink raises tipsy up to maxTipsy (then the bartender refuses); water sobers you up at once. */
export function drink(s, kind) {
  const p = s.party;
  if (!p) return { ok: false, reason: 'off' };
  if (kind === 'water') {
    p.tipsy = 0;
    p.soberT = 0;
    return { ok: true, tipsy: 0 };
  }
  if (p.tipsy >= PARTY.maxTipsy) return { ok: false, reason: 'enough' };
  p.tipsy++;
  p.drinks++;
  p.soberT = 0;
  return { ok: true, tipsy: p.tipsy };
}

export const tipsyLevel = (s) => s.party?.tipsy || 0;

/** dt seconds of play at the party: one tipsy level wears off per soberS. */
export function tickParty(s, dt) {
  const p = s.party;
  if (!p || dt <= 0) return;
  p.t += dt;
  if (!p.tipsy) return;
  p.soberT += dt;
  while (p.soberT >= PARTY.soberS && p.tipsy > 0) {
    p.soberT -= PARTY.soberS;
    p.tipsy--;
  }
  if (!p.tipsy) p.soberT = 0;
}

/** How far a tipsy view leans at t seconds, in px: slow, at most `tipsy` sideways and half that up and down. */
export function sway(tipsy, t) {
  if (!tipsy) return { x: 0, y: 0 };
  return { x: Math.round(Math.sin(t * 1.3) * tipsy), y: Math.round(Math.sin(t * 0.9 + 1) * tipsy * 0.5) };
}

/** The party is over: 'done' (time is up) or 'early' (left by the elevator). Returns the summary; counts the badges' stats. */
export function endParty(s, result) {
  const p = s.party;
  s.party = null;
  if (!p) return null;
  const activities = ACTIVITY_GAMES.filter((g) => p.paid[g]).length;
  const st = s.stats;
  if (p.drinks >= PARTY.maxTipsy) st.partyTipsy = (st.partyTipsy || 0) + 1;
  if (p.drinks === 0 && ACTIVITY_GAMES.every((g) => (p.best[g] || 0) >= 1)) st.partyDesignated = (st.partyDesignated || 0) + 1;
  return { floor: p.floor, year: p.year, result, activities, total: ACTIVITY_GAMES.length, sp: p.sp, drinks: p.drinks, gift: p.gift };
}

/** Debugging (window.__party): this year's party is on offer again (and its invitation); one under way is dropped. */
export function resetParty(s, now) {
  s.party = null;
  const { [partyYear(now)]: _, ...rest } = s.parties || {};
  s.parties = rest;
  s.partyInvite = null;
}
