# Christmas Party Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An office Christmas party once per career and calendar year (local dates 6–23 December): an invitation, 10 minutes in a
party hall with a disco ball, confetti, guests from the colleagues you know, five free activities, a bar whose drinks only make
things wobblier, a Secret Santa desk decoration and three badges.

**Architecture:** Pure rules in `src/core/party.js` (window, status, start/end, pay, drinks, sway) and the hall map plus guest list in
`src/core/partyHall.js`; text in `src/data/party.js`; four new mini-games plus a Christmas theme for the existing buffet;
`PartyScene` (`src/scenes/party.js`) is a `FloorScene` subclass like `HomeScene`/`HotelScene`, lit by `src/scenes/partyLights.js`
through the existing DOS-style `Lighting` engine; the mini-game host gets a `'party'` mode. The trigger lives in `FloorScene`
(invitation on entering a tower floor) and `ElevatorPanel` (a party button).

**Tech Stack:** Bun 1.3, vanilla ES modules, Canvas 2D at 480×270, WebAudio tracker songs, `bun test` with the mock canvas.

**Spec:** `docs/superpowers/specs/2026-10-15-christmas-party-design.md`

## Global Constraints

- No npm dependencies, no external assets: art drawn in code, music in the tracker format of `src/data/music.js`.
- Core modules (`src/core/`) stay pure: no DOM, no `window`.
- All text is ASCII and uses glyphs the bitmap font has (`tests/font.test.js`); about 5 px per character, check strings fit.
- Window: `month === 11` (December) and `6 <= date <= 23`, local time. Once per career per calendar year (`state.parties[year]`).
- Stay: 10 minutes (`PARTY.stayS = 600`), held while paused (`party` in `TIMED`).
- Activities free (no coffee); pay once per party at 1 star or more: `round(taskReward(maxFloor, 3).sp * 2)` paperclips; no XP,
  no KPI stars, no coffee. Arriving pays 1 Stock Option.
- Drinks: no reward and no economy effect; tipsy 0..3, one level wears off per 120 s of party play time; water sobers at once.
- New party mini-games are NOT in `COUNTED_GAMES`. Every mini-game: overall time limit ≤ ~90 s, keyboard and mouse/touch, a
  perfect player ≥ 0.85, an idle or random one < 0.35.
- Dev-only helpers live in `src/debug.js` only (`tests/devOnly.test.js`).
- `isTouch()` hints: every new keyboard hint has a tap version.
- Pushing `main` deploys to production: commit per task, never push unless Martin says "push".
- Another Claude session may edit the same working tree: stage only your own files/hunks (`git add <paths>`), never stash,
  never switch branches.

## Review Focus

1. Local-date boundaries: 5 Dec 23:59 → closed, 6 Dec 00:00 → open, 23 Dec 23:59 → open, 24 Dec 00:00 → closed (Task 1 test).
2. A party started on 23 Dec at 23:55 keeps running past midnight, and its year stays the year it started in (Task 1 test).
3. Continuing a career saved mid-party on 24 Dec (window closed) returns to the hall while its clock runs (Task 14 test).
4. A floor-1 career (tiny guest pool) and colleagues the CEO fired: never more guests than candidates, never a fired one (Task 10 test).
5. Pausing (menu, paused mini-game) holds the party clock: `holdClocks` moves `party.endsAt` (Task 1 test).

---

### Task 1: Party rules (economy constants, state, core/party.js)

**Files:**
- Modify: `src/core/economy.js` (after the `HOME` block, ~line 105)
- Modify: `src/core/state.js` (`newGame` fields; `TIMED` at ~line 338)
- Create: `src/core/party.js`
- Test: `tests/party.test.js`

**Interfaces:**
- Consumes: `E.taskReward(floor, stars, perks)`, `E.starsFromScore(score)`, `onHold(s)` (core/conduct.js), `S.holdClocks(s, ms)`.
- Produces (core/party.js): `PARTY` (= `E.PARTY`), `ACTIVITY_GAMES` (`['dance','giftwrap','carols','buffet','photobooth']`),
  `partyYear(now)`, `partyWindow(now)`, `partyBlock(s)` → `'hold'|'badge'|'away'|null`,
  `partyStatus(s, now, { force })` → `'on'|'closed'|'done'|'blocked'|'available'`, `inviteDue(s, now)`, `markInvited(s, now)`,
  `startParty(s, floor, now, { force })` → `{ ok, so } | { ok: false, reason }`, `partyLeft(s, now)`, `partyActive(s, now)`,
  `activityPay(s)`, `completePartyActivity(s, game, score)` → `{ stars, sp, first, gift }`, `activityDone(s, game)`,
  `drink(s, kind)` (`kind`: `'mulled'|'eggnog'|'punch'|'water'`) → `{ ok, tipsy } | { ok: false, reason: 'enough'|'off' }`,
  `tipsyLevel(s)`, `tickParty(s, dt)`, `sway(tipsy, t)` → `{ x, y }`, `endParty(s, result)` → summary, `resetParty(s, now)`.
- `state.party` shape: `{ floor, year, endsAt, t, paid: {}, best: {}, sp, drinks, tipsy, soberT, gift, speech }`.
- The gift id (`xmas-<year>`) and adding it to the desk come from Task 2 (`partyGiftId`, `giveDecor` in core/desk.js); in this
  task `completePartyActivity` imports them, so Task 2's two exports are added here first (see Step 3).

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/party.test.js`
Expected: FAIL: `Cannot find module '../src/core/party.js'`.

- [ ] **Step 3: Implement**

In `src/core/economy.js`, after the `HOME` block:

```js
/**
 * Christmas party (core/party.js): once per career and calendar year, local dates fromDay-toDay of December (month 11).
 * stayS in the party hall; activities are free and pay spMult x a 3-star task's paperclips on your highest floor, once
 * each; arriving pays bonusSo. Drinks only make things wobblier: tipsy 0..maxTipsy, one level wears off per soberS of play.
 */
export const PARTY = { month: 11, fromDay: 6, toDay: 23, stayS: 10 * 60, bonusSo: 1, spMult: 2, difficulty: 0.3, guests: 14, dancers: 6, maxTipsy: 3, soberS: 120 };
```

In `src/core/state.js` `newGame`, after `vacation: null,`:

```js
    parties: {}, // Christmas parties (core/party.js): year → 'done' once that year's party has started
    partyInvite: null, // the year whose invitation has been shown
    party: null, // the party under way: { floor, year, endsAt, t, paid, best, sp, drinks, tipsy, soberT, gift, speech }
```

and change `const TIMED = ['trip', 'vacation', 'nightShift', 'home'];` to
`const TIMED = ['trip', 'vacation', 'nightShift', 'home', 'party'];`.

In `src/core/desk.js` (used here, tested in Task 2), after `trophyId`:

```js
/** The Christmas party's Secret Santa gift for `year`: a desk decoration no shop sells. */
export const partyGiftId = (year) => `xmas-${year}`;

/** Adds a decoration to the collection (not on show); false if it was owned already. */
export function giveDecor(s, id) {
  const desk = myDesk(s);
  if (desk.owned.includes(id)) return false;
  s.desk = { ...desk, owned: [...desk.owned, id] };
  return true;
}
```

Create `src/core/party.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/party.test.js tests/state.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/core/economy.js src/core/state.js src/core/desk.js src/core/party.js tests/party.test.js
git commit -m "Christmas party rules: the December window, once a year, pay once per activity, Secret Santa gift, drinks and sway"
```

---

### Task 2: Secret Santa decoration and the three badges

**Files:**
- Modify: `src/core/desk.js` (`decorItem`, `decorUnlocked`)
- Modify: `src/engine/art.js` (`drawDeskDecor`, switch key and a new `case 'xmas'`)
- Modify: `src/core/achievements.js` (`BADGES`, after `cameraready`)
- Test: `tests/partyRewards.test.js`

**Interfaces:**
- Consumes: `partyGiftId(year)`, `giveDecor(s, id)` (Task 1).
- Produces: `decorItem('xmas-2026')` → `{ id, name: 'Christmas tree 2026', slot: 'left', cost: 0, needs: 'party', year: 2026 }`;
  badges `partyanimal`, `tipsy`, `designated`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/partyRewards.test.js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyRewards.test.js`
Expected: FAIL (`decorItem('xmas-2026')` is null; badges undefined).

- [ ] **Step 3: Implement**

`src/core/desk.js`, at the top of `decorItem` (before the trophy match):

```js
  const xm = /^xmas-(\d{4})$/.exec(id);
  if (xm) return { id, name: `Christmas tree ${xm[1]}`, slot: 'left', cost: 0, needs: 'party', year: +xm[1] };
```

and replace `decorUnlocked`:

```js
/** A trophy is earned: it needs its floor's KPI star quota. A party gift is only ever a gift. */
export const decorUnlocked = (s, d) => (d.needs === 'party' ? myDesk(s).owned.includes(d.id) : d.needs !== 'quota' || (s.starsByFloor[d.floor] || 0) >= E.starQuota(d.floor));
```

`src/engine/art.js` `drawDeskDecor`: change the switch key to
`switch (id.startsWith('trophy-') ? 'trophy' : id.startsWith('xmas-') ? 'xmas' : id) {` and add:

```js
    case 'xmas': {
      // The Secret Santa gift: a little tree in a pot, its baubles in the year's colours.
      const year = +id.slice(5);
      const [b1, b2] = [['#e2504a', '#f2c14e'], ['#5b8def', '#f4f1e8'], ['#f29cd0', '#5fd068'], ['#f2c14e', '#b15cff']][year % 4];
      r(L + 2, y - 3, 5, 3, '#8a4a2a');
      r(L + 1, y - 7, 7, 4, '#2f8a3a');
      r(L + 2, y - 10, 5, 3, '#2f8a3a');
      r(L + 3, y - 12, 3, 2, '#2f8a3a');
      r(L + 4, y - 14, 1, 2, '#f2e14e');
      r(L + 2, y - 6, 1, 1, b1);
      r(L + 6, y - 5, 1, 1, b2);
      r(L + 3, y - 9, 1, 1, b2);
      r(L + 5, y - 8, 1, 1, b1);
      r(L + 4, y - 11, 1, 1, b1);
      break;
    }
```

`src/core/achievements.js`, after the `cameraready` entry:

```js
  { id: 'partyanimal', name: 'Party Animal', desc: 'Go to the office Christmas party.', icon: 'star', test: (s) => (s.stats.parties || 0) >= 1 },
  { id: 'tipsy', name: 'Tipsy', desc: 'Have 3 drinks at one Christmas party.', icon: 'coffee', test: (s) => (s.stats.partyTipsy || 0) >= 1 },
  { id: 'designated', name: 'Designated Driver', desc: 'A Christmas party without a drink, every activity at 1 star or more.', icon: 'check', test: (s) => (s.stats.partyDesignated || 0) >= 1 },
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyRewards.test.js tests/desk.test.js tests/achievements.test.js`
Expected: PASS. If a test asserts the total badge count (e.g. 37), update it to 40 and note it for the docs (Task 15).

- [ ] **Step 5: Commit**

```bash
git add src/core/desk.js src/engine/art.js src/core/achievements.js tests/partyRewards.test.js
git commit -m "Christmas party rewards: the year's Secret Santa desk tree (never in a shop) and the Party Animal, Tipsy and Designated Driver badges"
```

---

### Task 3: Santa hats and hopping dancers (character art)

**Files:**
- Modify: `src/engine/art.js` (`bakeCharacter`: after the head/hair block, both directions)
- Modify: `src/scenes/floorWorld.js` (`Actor.draw`: the sprite drawn `hop` px higher)
- Test: `tests/characters.test.js` (append)

**Interfaces:**
- Produces: look field `hat: 'santa'`; `Actor.hop` (number, px, default 0).

- [ ] **Step 1: Write the failing test** (append to `tests/characters.test.js`; it already has `bakeCharacter`, `npcLook` and the
  pixel canvas helpers `made`/`pixelCanvas` at the top. Read how the existing "woman figure" test samples pixels and use the
  same helper, here named `pixelAt(sheet, x, y)`; if the file's helper has another name, use that.)

```js
test('a Santa hat: red with a white trim on the head, in every direction', () => {
  const base = { ...npcLook(3, 'support'), skirt: undefined };
  const plain = bakeCharacter(base);
  const hat = bakeCharacter({ ...base, hat: 'santa' });
  for (let row = 0; row < 4; row++) {
    const y = row * CHAR_H;
    expect(pixelAt(hat, 7, y + 1)).toBe('#d8343a'); // the red cap, just above the head
    expect(pixelAt(hat, 7, y + 2)).toBe('#f4f1e8'); // the white trim
    expect(pixelAt(plain, 7, y + 2)).not.toBe('#f4f1e8');
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/characters.test.js`
Expected: FAIL on the new test.

- [ ] **Step 3: Implement**

In `bakeCharacter`, after the `if (dir === 'down') { ...face... } else { ...hair... }` block (head drawn), add:

```js
    // A Santa hat (the Christmas party): a red cap over the hair, a white trim on the brow, the pompom on one side.
    if (L.hat === 'santa') {
      r(4, y0 - 1, 8, 3, O);
      r(5, y0, 6, 1, '#d8343a');
      r(4, y0 + 1, 8, 1, '#f4f1e8');
      r(12, y0 - 1, 2, 2, '#f4f1e8');
    }
```

(`y0` is 1, so the cap fills rows 0–2. The 'right' row is drawn mirrored by the existing `scale(-1, 1)`, so the pompom
flips with it.)

In `Actor.draw` (`src/scenes/floorWorld.js`), keep the shadow at the feet and lift only the sprite:

```js
    const lift = Math.round(this.hop || 0); // a dancer's bounce (scenes/party.js), the shadow stays on the floor
```

and use `py - lift` instead of `py` in the `g.drawImage(this.sheet, ...)` call (and in the `box()` helper's `by`).

- [ ] **Step 4: Run tests**

Run: `bun test tests/characters.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/art.js src/scenes/floorWorld.js tests/characters.test.js
git commit -m "Santa hats for the Christmas party (look.hat), and Actor.hop for dancers"
```

---

### Task 4: Party text, the party song and three carols

**Files:**
- Create: `src/data/party.js`
- Modify: `src/data/music.js` (`SONGS`: `xmasparty`, `jinglebells`, `deckhalls`, `wenceslas`)
- Test: `tests/partyData.test.js`

**Interfaces:**
- Produces (data/party.js): `PARTY_ACTIVITIES` (`[{ game, title, where, blurb }]` for the 5 `ACTIVITY_GAMES`), `PARTY_INVITE(corp, minutes)`,
  `PARTY_REFUSALS` (`{ hold, badge, away, done, closed, on }`), `CEO_SPEECH(corp)`, `CEO_SPEECH_YOU(corp)`, `PARTY_LINES`, `TIPSY_LINES`,
  `HR_WATCH_LINES`, `BARTENDER` (`{ name, serve, enough, water }`), `DRINKS` (`[{ kind, label }]`), `PARTY_LEAVE(left)`,
  `FIRED_JOKE(count)`, `PARTY_SUMMARY_TITLE` (`{ done, early }`), `PARTY_SUMMARY(sum)`, `CAROLS` (`[{ id, title, syllables }]`),
  `PARTY_QUIPS` (`{ stage, poinsettia, partytable, chair, punchbowl, xmastree }`, ≥20 lines each).
- Songs: `SONGS.xmasparty` (bpm 120), `SONGS.jinglebells` (16 bars), `SONGS.deckhalls` (8), `SONGS.wenceslas` (8).
- `melodyNotes(song)` (Task 7) counts one note per pitch token; each carol's syllable count must equal it. This task's test
  counts note tokens directly so it does not depend on Task 7.

- [ ] **Step 1: Write the failing tests**

```js
// tests/partyData.test.js
// The party's text and songs: carols line up syllable for note, every line is plain ASCII and the curio lists are long enough.
import { test, expect } from 'bun:test';
import { SONGS } from '../src/data/music.js';
import * as D from '../src/data/party.js';
import { ACTIVITY_GAMES } from '../src/core/party.js';

const notes = (song) => song.melody.flatMap((bar) => bar.trim().split(/\s+/)).filter((t) => /^[A-G][#b]?\d$/.test(t)).length;

test('every bar has 16 steps and a chord', () => {
  for (const id of ['xmasparty', 'jinglebells', 'deckhalls', 'wenceslas']) {
    const song = SONGS[id];
    expect(song, id).toBeTruthy();
    expect(song.melody.length).toBe(song.chords.length);
    for (const bar of song.melody) expect(bar.trim().split(/\s+/).length, `${id}: ${bar}`).toBe(16);
  }
});

test('each carol has one syllable per sung note', () => {
  expect(D.CAROLS.map((c) => c.id).sort()).toEqual(['deckhalls', 'jinglebells', 'wenceslas']);
  for (const c of D.CAROLS) expect(c.syllables.length, c.id).toBe(notes(SONGS[c.id]));
});

test('the activities, and plain ASCII text everywhere', () => {
  expect(D.PARTY_ACTIVITIES.map((a) => a.game).sort()).toEqual([...ACTIVITY_GAMES].sort());
  const strings = [];
  const walk = (v) => (typeof v === 'string' ? strings.push(v) : Array.isArray(v) ? v.forEach(walk) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : null);
  walk(Object.fromEntries(Object.entries(D).filter(([, v]) => typeof v !== 'function')));
  walk([D.PARTY_INVITE('Acme', 10), D.CEO_SPEECH('Acme'), D.CEO_SPEECH_YOU('Acme'), D.PARTY_LEAVE('5:00'), D.FIRED_JOKE(2)]);
  walk(D.PARTY_SUMMARY({ result: 'done', activities: 3, total: 5, sp: 1200, drinks: 1, gift: 'xmas-2026' }));
  for (const s of strings) expect(/^[\x20-\x7e\n]*$/.test(s), s).toBe(true);
  expect(D.PARTY_LINES.length).toBeGreaterThanOrEqual(20);
  expect(D.TIPSY_LINES.length).toBeGreaterThanOrEqual(12);
  expect(D.HR_WATCH_LINES.length).toBeGreaterThanOrEqual(10);
  for (const [type, lines] of Object.entries(D.PARTY_QUIPS)) expect(lines.length, type).toBeGreaterThanOrEqual(20);
});

test('the summary mentions the taxi only after a drink', () => {
  expect(D.PARTY_SUMMARY({ result: 'done', activities: 5, total: 5, sp: 900, drinks: 2, gift: null })).toContain('taxi');
  expect(D.PARTY_SUMMARY({ result: 'done', activities: 5, total: 5, sp: 900, drinks: 0, gift: null })).not.toContain('taxi');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyData.test.js`
Expected: FAIL: `Cannot find module '../src/data/party.js'`.

- [ ] **Step 3: Add the songs** to `SONGS` in `src/data/music.js` (before `fanfare`):

```js
  // The Christmas party (scenes/party.js): an original, upbeat tune; Dance-Off (minigames/dance.js) is timed to its bpm.
  xmasparty: {
    bpm: 120, swing: 0, lead: 'pulse25', leadVol: 0.14,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    bass: { steps: [0, 4, 8, 12], tones: [0, 2, 0, 2], len: 2 },
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 1, 2, 1, 0, 1, 2, 1], vol: 0.04 },
    drums: 'k.h.s.h.k.h.s.hk',
    melody: [
      'E5 - G5 - C6 - G5 - E5 - G5 - A5 - G5 -', 'E5 - - - C5 - E5 - A4 - - - C5 - E5 -',
      'F5 - A5 - C6 - A5 - F5 - A5 - G5 - F5 -', 'D5 - - - G5 - - - B4 - D5 - G5 - . .',
      'E5 - G5 - C6 - G5 - E5 - G5 - A5 - G5 -', 'A5 - - - E5 - C5 - A4 - C5 - E5 - . .',
      'F5 - A5 - C6 - D6 - C6 - A5 - F5 - A5 -', 'G5 - - - B5 - - - D6 - - - C6 - . .',
    ],
  },
  // Carols in the public domain for Carol Karaoke (minigames/carols.js); the syllables are in data/party.js (CAROLS).
  jinglebells: {
    bpm: 120, swing: 0, lead: 'triangle', leadVol: 0.2,
    chords: ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'],
    bass: { steps: [0, 8], tones: [0, 2], len: 4 },
    arp: { steps: [0, 4, 8, 12], tones: [0, 1, 2, 1], vol: 0.03 },
    drums: 'k...h...s...h...',
    melody: [
      'E5 - - - E5 - - - E5 - - - - - - -', 'E5 - - - E5 - - - E5 - - - - - - -',
      'E5 - - - G5 - - - C5 - - - - - D5 -', 'E5 - - - - - - - - - - - - - - -',
      'F5 - - - F5 - - - F5 - - - - - F5 -', 'F5 - - - E5 - - - E5 - - - E5 - E5 -',
      'E5 - - - D5 - - - D5 - - - E5 - - -', 'D5 - - - - - - - G5 - - - - - - -',
      'E5 - - - E5 - - - E5 - - - - - - -', 'E5 - - - E5 - - - E5 - - - - - - -',
      'E5 - - - G5 - - - C5 - - - - - D5 -', 'E5 - - - - - - - - - - - - - - -',
      'F5 - - - F5 - - - F5 - - - - - F5 -', 'F5 - - - E5 - - - E5 - - - E5 - E5 -',
      'G5 - - - G5 - - - F5 - - - D5 - - -', 'C5 - - - - - - - - - - - . . . .',
    ],
  },
  deckhalls: {
    bpm: 112, swing: 0, lead: 'triangle', leadVol: 0.2,
    chords: ['C', 'C', 'G7', 'C', 'C', 'C', 'G7', 'C'],
    bass: { steps: [0, 8], tones: [0, 2], len: 4 },
    arp: { steps: [0, 4, 8, 12], tones: [0, 1, 2, 1], vol: 0.03 },
    drums: 'k...h...s...h...',
    melody: [
      'G5 - - - - - F5 - E5 - - - D5 - - -', 'C5 - - - D5 - - - E5 - - - C5 - - -',
      'D5 - E5 - F5 - D5 - E5 - - - - - D5 -', 'C5 - - - B4 - - - C5 - - - - - - -',
      'G5 - - - - - F5 - E5 - - - D5 - - -', 'C5 - - - D5 - - - E5 - - - C5 - - -',
      'D5 - E5 - F5 - D5 - E5 - - - - - D5 -', 'C5 - - - B4 - - - C5 - - - - - - -',
    ],
  },
  wenceslas: {
    bpm: 100, swing: 0, lead: 'triangle', leadVol: 0.2,
    chords: ['G', 'G', 'D', 'G', 'G', 'G', 'D', 'G'],
    bass: { steps: [0, 8], tones: [0, 2], len: 4 },
    arp: { steps: [0, 4, 8, 12], tones: [0, 1, 2, 1], vol: 0.03 },
    drums: 'k...h...s...h...',
    melody: [
      'G5 - - - G5 - - - G5 - - - A5 - - -', 'G5 - - - G5 - - - D5 - - - - - - -',
      'E5 - - - D5 - - - E5 - - - F#5 - - -', 'G5 - - - - - - - G5 - - - - - - -',
      'G5 - - - G5 - - - G5 - - - A5 - - -', 'G5 - - - G5 - - - D5 - - - - - - -',
      'E5 - - - D5 - - - E5 - - - F#5 - - -', 'G5 - - - - - - - G5 - - - - - - -',
    ],
  },
```

If the tracker's chord parser (`CHORD_QUALITIES`) lacks a quality used here (`D7`, `G7`, `Am`), use the nearest one it has.

- [ ] **Step 4: Create `src/data/party.js`**

```js
// The Christmas party's text (core/party.js, scenes/party.js): the invitation, the CEO's speech, guests' lines, the bar,
// the summary, the carols' syllables and the hall's curio lines. Plain ASCII (the bitmap font).

export const PARTY_ACTIVITIES = [
  { game: 'dance', title: 'Dance-Off', where: 'DJ booth', blurb: 'The DJ challenges you. Hit the arrows on the beat.' },
  { game: 'giftwrap', title: 'Secret Santa', where: 'Secret Santa table', blurb: 'Wrap your Secret Santa gift: cut, tape, bow. Your own gift is waiting for you.' },
  { game: 'carols', title: 'Carol Karaoke', where: 'Stage', blurb: 'Take the mic and sing a carol. Stay on the note.' },
  { game: 'buffet', title: 'Christmas Buffet', where: 'Buffet', blurb: 'Turkey, mince pies, gingerbread. Fill your plate before it is gone.' },
  { game: 'photobooth', title: 'Photo Booth', where: 'Photo booth', blurb: 'Four shots. Strike the pose on the card when the flash goes off.' },
];

export const PARTY_INVITE = (corp, minutes) =>
  `The ${corp} Christmas party is on! Dancing, a buffet, karaoke, Secret Santa and a free bar.\n` +
  `It lasts ${minutes} minutes, and you only get one party a year.\n` +
  'No time now? The elevator has a party button until you go.';

export const PARTY_REFUSALS = {
  hold: 'HR says: no party during a compliance hold.',
  badge: 'Check in at the front desk first. No badge, no party.',
  away: 'Finish what you are doing first.',
  done: 'You have been to this year\'s party already.',
  closed: 'The party is over. See you next December!',
  on: 'The party is already on.',
};

export const CEO_SPEECH = (corp) =>
  `What a year for ${corp}! We leveraged our synergies, pivoted twice and disrupted ourselves.\n` +
  'Your bonus is in the form of this party. And one Stock Option each.\n' +
  'Raise your glasses to another year of growth, alignment and mandatory fun!';

export const CEO_SPEECH_YOU = (corp) =>
  `You tap your glass. As CEO of ${corp}, the speech is yours.\n` +
  '"What a year. We shifted paradigms and moved the needle. The needle is fine."\n' +
  '"Here is to all of you, and to one Stock Option each. Cheers!"';

export const PARTY_LINES = [
  'Great party! Is that the CFO doing the robot?',
  'I came for the buffet. I am staying for the buffet.',
  'Who put the reply-all Secret Santa list together?',
  'This is the only meeting I enjoy all year.',
  'The DJ only takes requests by email.',
  'I wrapped my gift in last quarter\'s report.',
  'Nobody talk about work. Okay, one KPI.',
  'The punch has synergy in it. Literally.',
  'My Secret Santa is someone in Legal. I am scared.',
  'I have never seen the CEO dance. I want to unsee it.',
  'Is there a dress code? I wore my best lanyard.',
  'The photo booth has more filters than our spam folder.',
  'Last year someone sang for 20 minutes. It was me.',
  'I am networking. With the cheese board.',
  'Do not tell IT, but I left my laptop at my desk.',
  'This is my third mince pie. Do not count.',
  'Best part of the year. Worst music.',
  'The disco ball was a budget line item. It was approved.',
  'I asked for a raise and got a party hat.',
  'Merry Christmas! Or as Finance says, Q4 close.',
  'The karaoke list is all carols. Bold choice.',
  'Somebody tell the intern the open bar is not a meeting room.',
];

export const TIPSY_LINES = [
  'Have you been to the bar? You look... festive.',
  'You are swaying. Or the room is. One of you is.',
  'Maybe some water? Just a thought.',
  'Did you just high-five the Christmas tree?',
  'You told me that story already. Twice. It was good.',
  'Careful, HR is right over there.',
  'Your Santa hat is on sideways. It works.',
  'I love you too, colleague. Please sit down.',
  'Let us not dance on the buffet table.',
  'You called me "boss" three times. I am in Accounts.',
  'Somebody order a taxi for this legend.',
  'Your karaoke was... brave.',
];

export const HR_WATCH_LINES = [
  'HR is watching. Festively.',
  'Remember: the code of conduct applies at parties too.',
  'I am not working. I am observing.',
  'Lovely party. I am taking notes.',
  'Pace yourselves, everyone.',
  'There is water at the bar. Just saying.',
  'Mistletoe has been removed per policy 4.2.',
  'Have fun. Within the guidelines.',
  'Who is doing the worm? I need a name for the form.',
  'Everyone is having fun. Good. Measured fun.',
];

export const BARTENDER = {
  name: 'Bartender',
  serve: ['Coming right up!', 'Cheers!', 'One festive drink.', 'Enjoy, and take it easy.', 'Here you go. Merry Christmas!'],
  enough: 'I think you have had enough. Here is some water.',
  water: 'Water. The wisest drink of the night.',
};

export const DRINKS = [
  { kind: 'mulled', label: 'Mulled wine' },
  { kind: 'eggnog', label: 'Eggnog' },
  { kind: 'punch', label: 'Synergy Punch' },
];

export const PARTY_LEAVE = (left) => `Leave the party already? There are ${left} to go, and you only get one party a year.`;

export const FIRED_JOKE = (count) => `Security has a guest list. ${count === 1 ? 'One name' : `${count} names`} you let go are not on it.`;

export const PARTY_SUMMARY_TITLE = { done: 'That was a party!', early: 'An early night' };

export const PARTY_SUMMARY = (sum) =>
  `Activities: ${sum.activities}/${sum.total}. Paperclips: +${sum.sp}. Stock Options: +1 (year-end bonus).\n` +
  (sum.gift ? `Your Secret Santa gift: a little Christmas tree for your desk (Collection tab).\n` : '') +
  (sum.drinks ? `Drinks: ${sum.drinks}. We called you a taxi.` : 'Not a drop. Somebody has to drive.');

/** Carols for Carol Karaoke: one syllable per sung note of SONGS[id] (tests/partyData.test.js checks the count). */
export const CAROLS = [
  {
    id: 'jinglebells',
    title: 'Jingle Bells',
    syllables: [
      'Jin', 'gle', 'bells,', 'jin', 'gle', 'bells,', 'jin', 'gle', 'all', 'the', 'way!', 'Oh', 'what', 'fun', 'it', 'is', 'to', 'ride', 'in', 'a',
      'one', 'horse', 'o', 'pen', 'sleigh,', 'hey!', 'Jin', 'gle', 'bells,', 'jin', 'gle', 'bells,', 'jin', 'gle', 'all', 'the', 'way!',
      'Oh', 'what', 'fun', 'it', 'is', 'to', 'ride', 'in', 'a', 'one', 'horse', 'o', 'pen', 'sleigh!',
    ],
  },
  {
    id: 'deckhalls',
    title: 'Deck the Halls',
    syllables: [
      'Deck', 'the', 'halls', 'with', 'boughs', 'of', 'hol', 'ly,', 'Fa', 'la', 'la', 'la', 'la,', 'la', 'la', 'la', 'la!',
      "'Tis", 'the', 'sea', 'son', 'to', 'be', 'jol', 'ly,', 'Fa', 'la', 'la', 'la', 'la,', 'la', 'la', 'la', 'la!',
    ],
  },
  {
    id: 'wenceslas',
    title: 'Good King Wenceslas',
    syllables: [
      'Good', 'King', 'Wen', 'ces', 'las', 'looked', 'out', 'on', 'the', 'feast', 'of', 'Ste', 'phen.',
      'When', 'the', 'snow', 'lay', 'round', 'a', 'bout,', 'deep', 'and', 'crisp', 'and', 'e', 'ven.',
    ],
  },
];

/** Curio lines for the party hall's furniture (core/curios.js reads these when fl.party): at least 20 each. */
export const PARTY_QUIPS = {
  stage: [
    'A stage. Last year\'s karaoke still echoes here.',
    'The spotlight is pointed at the exit. Coincidence?',
    'Someone taped a setlist here: 14 carols, 0 breaks.',
    'The stage creaks under the weight of expectations.',
    'A sign: "Speeches max. 2 minutes". Nobody reads it.',
    // ...at least 20 in total, same voice: dry office humour, one line, up to ~70 characters.
  ],
  poinsettia: [
    'A poinsettia. It has a facilities asset tag.',
    'Red leaves, green leaves. Very on brand.',
    'Do not eat the poinsettia. There is a memo about it.',
    'It looks festive. It looks tired. It looks like you.',
    'Watered by everyone, so watered by no one.',
  ],
  partytable: [
    'Crackers, napkins and a name card that says "Guest".',
    'The centrepiece is a pine cone with a budget code.',
    'Someone has stacked the paper hats into a pyramid.',
    'A half-eaten mince pie. Evidence.',
    'The table plan put Sales next to Legal. Brave.',
  ],
  chair: [
    'A party chair, slightly sticky.',
    'Someone has saved this seat with a tinsel scarf.',
    'The chairs are rented. The vibe is borrowed.',
    'You sit down for a second. It feels like a holiday.',
    'A Santa hat on the seat. Finders keepers?',
  ],
  punchbowl: [
    'The punch is pink. The recipe is classified.',
    'A ladle, a punch bowl and a sticky note: "Synergy!"',
    'It smells of cinnamon and quarterly targets.',
    'Someone has floated a rubber duck in it.',
    'The label says "non-alcoholic". The label is lying.',
  ],
  xmastree: [
    'The tree is real. The presents under it are empty boxes.',
    'An ornament shaped like the company logo. Of course.',
    'The star on top is a little crooked. Like the quarter.',
    'Fairy lights, tinsel and a lanyard someone lost.',
    'Facilities approved the tree after three meetings.',
  ],
};
```

Then fill `PARTY_QUIPS` to at least 20 lines per type in the same voice (one line each, ASCII, ≤ ~70 characters, no repeats).
This list is content, not code; the test in Step 1 enforces the count.

- [ ] **Step 5: Run tests**

Run: `bun test tests/partyData.test.js tests/font.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/party.js src/data/music.js tests/partyData.test.js
git commit -m "Christmas party text and music: the party tune and three public-domain carols with their syllables"
```

---

### Task 5: Dance-Off mini-game

**Files:**
- Create: `src/minigames/dance.js`
- Modify: `src/minigames/index.js` (import and register in a new "Christmas party" group, not in `STATION_GAMES`)
- Test: `tests/partyGames.test.js` (create; later tasks append)

**Interfaces:**
- Consumes: `SONGS.xmasparty.bpm` (Task 4), mgkit helpers.
- Produces: `MINIGAMES.dance`; `inst.peek()` → `{ time, notes: [{ t, lane }] }` (lanes 0..3 = Left, Down, Up, Right).

- [ ] **Step 1: Write the failing test** (create `tests/partyGames.test.js`)

```js
// The Christmas party's mini-games: someone paying attention gets 3 stars, someone idle gets under 1 star.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');

const g = mockCanvas().getContext('2d');
const theme = { dept: 'party', title: 'Party', stats: { floor: 12, stars: 0, title: 'Manager' } };
const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];

/** Runs a game; bot(peek, t) returns { tap: [keys pressed this frame], hold: [keys held], press: bool }. */
export function play(id, bot, seed = 1) {
  const inst = MINIGAMES[id].create({ difficulty: 0.3, rng: createRng(seed), theme, sfx: () => {} });
  const input = createInput();
  const held = new Set();
  let t = 0;
  while (!inst.done && t < 150) {
    input.beginFrame();
    const want = bot ? bot(inst.peek(), t) : {};
    for (const k of KEYS) {
      const h = !!want.hold?.includes(k);
      if (h && !held.has(k)) (input.keyDown(k), held.add(k));
      if (!h && held.has(k)) (input.keyUp(k), held.delete(k));
    }
    for (const k of want.tap || []) (input.keyDown(k), input.keyUp(k));
    if (want.press) (input.keyDown(' '), input.keyUp(' '));
    inst.update(1 / 60, input);
    inst.render(g);
    input.endFrame();
    t += 1 / 60;
  }
  expect(inst.done).toBe(true);
  return inst.score;
}

test('Dance-Off: on the beat is 3 stars, standing still or mashing every key is nothing', () => {
  for (const seed of [1, 2, 3]) {
    const best = play('dance', (p) => ({ tap: p.notes.filter((n) => n.t <= p.time + 1 / 60 && n.t > p.time - 0.05).map((n) => KEYS[n.lane]) }), seed);
    expect(best).toBeGreaterThanOrEqual(0.85);
    expect(play('dance', null, seed)).toBeLessThan(0.35);
    expect(play('dance', () => ({ tap: KEYS }), seed)).toBeLessThan(0.35);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyGames.test.js`
Expected: FAIL (`MINIGAMES.dance` undefined).

- [ ] **Step 3: Implement `src/minigames/dance.js`**

```js
// Dance-Off (Christmas party, the DJ booth): arrows rise to the line on the beat of the party song; hit each with its
// arrow key (or tap its pad) as it crosses. Perfect and good windows; a stray press costs half a note. About 40 s.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONGS } from '../data/music.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const LANE_X = [180, 220, 260, 300];
const COLORS = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e'];
const LINE_Y = 52;
const SPEED = 120; // px per second
const PERFECT = 0.09;
const GOOD = 0.18;
const PAD = { y: 226, w: 36, h: 30 };
const SONG_S = 40;

/** A 15 px pixel arrow pointing along lane 0..3 (left, down, up, right), centred on x, y. */
function arrow(g, x, y, lane, col) {
  for (let i = 0; i < 7; i++) {
    const w = 1 + i * 2;
    if (lane === 2) rect(g, x - i, y - 7 + i, w, 1, col);
    if (lane === 1) rect(g, x - i, y + 7 - i, w, 1, col);
    if (lane === 0) rect(g, x - 7 + i, y - i, 1, w, col);
    if (lane === 3) rect(g, x + 7 - i, y - i, 1, w, col);
  }
  if (lane === 2) rect(g, x - 2, y, 5, 7, col);
  if (lane === 1) rect(g, x - 2, y - 7, 5, 7, col);
  if (lane === 0) rect(g, x, y - 2, 7, 5, col);
  if (lane === 3) rect(g, x - 7, y - 2, 7, 5, col);
}

export default {
  id: 'dance',
  name: 'Dance-Off',
  help: 'Hit each arrow as it crosses the line: arrow keys, or tap the pads. On the beat for a Perfect!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const beat = 60 / SONGS.xmasparty.bpm;
    const step = d >= 0.5 ? beat / 2 : beat;
    const notes = [];
    for (let t = 2; t < SONG_S; t += step) if (rng.chance(byDiff(d, 0.6, 0.8))) notes.push({ t, lane: rng.int(0, 3), hit: null });
    const total = new Countdown(SONG_S + 3);
    const fl = new Floaters();
    let time = 0;
    let points = 0;
    let strays = 0;
    let combo = 0;
    let best = 0;
    const flash = [0, 0, 0, 0];

    const judge = (lane) => {
      flash[lane] = 0.15;
      const n = notes.find((o) => o.lane === lane && o.hit === null && Math.abs(o.t - time) <= GOOD);
      if (!n) {
        strays++;
        combo = 0;
        return sfx('bad');
      }
      n.hit = Math.abs(n.t - time) <= PERFECT ? 'perfect' : 'good';
      points += n.hit === 'perfect' ? 1 : 0.6;
      combo++;
      best = Math.max(best, combo);
      sfx(n.hit === 'perfect' ? 'good' : 'click');
      fl.add(n.hit === 'perfect' ? 'Perfect!' : 'Good', LANE_X[lane], LINE_Y + 22, n.hit === 'perfect' ? '#f2e14e' : '#ffffff');
      if (combo % 10 === 0) fl.add(`${combo} combo!`, W / 2, 140, '#f29cd0');
    };
    const score = () => clamp((points - 0.5 * strays) / Math.max(1, notes.length), 0, 1);

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ time, notes: notes.filter((n) => n.hit === null).map((n) => ({ t: n.t, lane: n.lane })) }),
      update(dt, input) {
        fl.update(dt);
        for (let i = 0; i < 4; i++) flash[i] = Math.max(0, flash[i] - dt);
        if (inst.done) return;
        time += dt;
        for (const n of notes)
          if (n.hit === null && time - n.t > GOOD) {
            n.hit = 'miss';
            combo = 0;
          }
        if (total.update(dt) || time > SONG_S + 1) return finish(inst, score());
        KEYS.forEach((k, i) => input.pressed(k) && judge(i));
        if (input.pointer.clicked && input.pointer.y >= PAD.y - 4) {
          const i = LANE_X.findIndex((x) => Math.abs(input.pointer.x - x) <= PAD.w / 2 + 2);
          if (i >= 0) judge(i);
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#140f22');
        // The dance floor's lights behind the lanes, pulsing on the beat.
        const pulse = Math.floor(time / beat) % 4;
        for (let i = 0; i < 8; i++) rect(g, i * 60, 200, 60, 70, i % 4 === pulse ? '#3a2a5a' : '#241a38');
        for (let i = 0; i < 4; i++) {
          rect(g, LANE_X[i] - 18, 30, 36, 190, '#1d1630');
          arrow(g, LANE_X[i], LINE_Y, i, flash[i] > 0 ? '#ffffff' : '#5a5070');
        }
        for (const n of notes) {
          if (n.hit === 'perfect' || n.hit === 'good') continue;
          const y = LINE_Y + (n.t - time) * SPEED;
          if (y < 20 || y > 215) continue;
          arrow(g, LANE_X[n.lane], Math.round(y), n.lane, n.hit === 'miss' ? '#4a4458' : COLORS[n.lane]);
        }
        for (let i = 0; i < 4; i++) {
          rect(g, LANE_X[i] - PAD.w / 2, PAD.y, PAD.w, PAD.h, flash[i] > 0 ? COLORS[i] : '#2a2240');
          arrow(g, LANE_X[i], PAD.y + PAD.h / 2, i, '#f4f1e8');
        }
        // You and the DJ's rival, bouncing on the beat.
        const hop = Math.abs(Math.sin((time / beat) * Math.PI)) * 6;
        for (const [x, c] of [[70, '#d8343a'], [410, '#2f8a3a']]) {
          const y = Math.round(150 - hop);
          rect(g, x - 6, y, 12, 22, c);
          rect(g, x - 5, y - 12, 10, 11, '#f2c9a0');
          rect(g, x - 6, y - 16, 12, 4, '#d8343a');
          rect(g, x - 6, y - 13, 12, 1, '#f4f1e8');
          rect(g, x - 6, y + 22, 4, 10, '#2b2e38');
          rect(g, x + 2, y + 22, 4, 10, '#2b2e38');
        }
        drawText(g, 'YOU', 70, 196, { align: 'center', color: '#f4f1e8' });
        drawText(g, `Combo ${combo}  Best ${best}`, W / 2, 20, { align: 'center', color: '#f29cd0' });
        drawText(g, isTouch() ? 'Tap the pads' : 'Arrow keys', W / 2, 260, { align: 'center', color: '#8a80a0' });
        header(g, theme?.title || 'Dance-Off', `${Math.max(0, Math.ceil(SONG_S - time))} s`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
```

In `src/minigames/index.js`, after the chores' imports:

```js
// Christmas party activities (core/party.js): never assigned to office stations; buffet is the hotel's, with Christmas dishes.
import dance from './dance.js';
```

and add `dance` to the array (new last line `dance,`). Later tasks add `giftwrap`, `carols`, `photobooth` to the same group.

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyGames.test.js` and `MG=dance bun test tests/minigames.test.js`
Expected: PASS. If the attentive bot scores just under 0.85 (an eighth-note chart at d 0.3 should not occur, step is a beat),
check that `judge` uses `time` after `time += dt` (it does) and that the bot taps within one frame of `n.t`.

- [ ] **Step 5: Commit**

```bash
git add src/minigames/dance.js src/minigames/index.js tests/partyGames.test.js
git commit -m "Dance-Off: the Christmas party's rhythm game, arrows on the beat of the party tune"
```

---

### Task 6: Gift Wrapping mini-game

**Files:**
- Create: `src/minigames/giftwrap.js`
- Modify: `src/minigames/index.js`
- Test: `tests/partyGames.test.js` (append)

**Interfaces:**
- Produces: `MINIGAMES.giftwrap`; `inst.peek()` → `{ stage: 'cut'|'tape'|'bow'|'done', level, band: [a, b], paused }`.

- [ ] **Step 1: Write the failing test** (append)

```js
test('Gift Wrapping: pressing in the band is 3 stars, idle or early is nothing', () => {
  for (const seed of [1, 2, 3]) {
    expect(play('giftwrap', (p) => ({ press: !p.paused && p.stage !== 'done' && p.level >= (p.band[0] + p.band[1]) / 2 }), seed)).toBeGreaterThanOrEqual(0.85);
    expect(play('giftwrap', null, seed)).toBeLessThan(0.35);
    expect(play('giftwrap', () => ({ press: true }), seed)).toBeLessThan(0.35);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyGames.test.js`
Expected: FAIL (`MINIGAMES.giftwrap` undefined).

- [ ] **Step 3: Implement `src/minigames/giftwrap.js`**

```js
// Gift Wrapping (Christmas party, the Secret Santa table): three gifts; for each, cut the paper at the mark, tape the seam
// in the green band and tie the bow as the ring closes. Nine timed presses (SPACE or a click); going past the band misses.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';

const STEPS = ['cut', 'tape', 'bow'];
const RATE = { cut: 0.42, tape: 0.55, bow: 0.5 }; // of the gauge per second
const GIFTS = 3;
const PAPERS = ['#d8343a', '#2f8a3a', '#3a5fb6', '#b6973b', '#7a3bb6'];
const RIBBONS = ['#f2e14e', '#f4f1e8', '#f29cd0', '#e2504a'];
const TIPS = { cut: 'Cut the paper at the mark', tape: 'Tape the seam in the green band', bow: 'Tie the bow as the ring closes' };

export default {
  id: 'giftwrap',
  name: 'Gift Wrapping',
  help: 'Secret Santa! Press SPACE (or click) to cut the paper at the mark, tape the seam in the band and tie the bow as the ring closes.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const total = new Countdown(60);
    const fl = new Floaters();
    const gifts = Array.from({ length: GIFTS }, () => ({
      paper: rng.pick(PAPERS),
      ribbon: rng.pick(RIBBONS),
      w: rng.int(60, 90),
      h: rng.int(40, 56),
      bands: STEPS.map(() => {
        const w = byDiff(d, 0.16, 0.09);
        const a = rng.float(0.45, 0.85 - w);
        return [a, a + w];
      }),
      ok: [],
    }));
    let gi = 0;
    let si = 0;
    let level = 0;
    let pause = 0;
    let good = 0;
    const stage = () => (gi >= GIFTS ? 'done' : STEPS[si]);
    const band = () => (gi >= GIFTS ? [0, 0] : gifts[gi].bands[si]);

    const next = (ok, text) => {
      gifts[gi].ok.push(ok);
      if (ok) good++;
      sfx(ok ? 'good' : 'bad');
      fl.add(text, W / 2, 70, ok ? '#5fd068' : '#e2504a');
      level = 0;
      pause = 0.45;
      si++;
      if (si >= STEPS.length) {
        si = 0;
        gi++;
      }
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ stage: stage(), level, band: band(), paused: pause > 0 }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt) || gi >= GIFTS) return finish(inst, good / (GIFTS * STEPS.length));
        if (pause > 0) {
          pause -= dt;
          return;
        }
        const st = stage();
        const [a, b] = band();
        level += RATE[st] * dt;
        if (input.confirm() || input.pointer.clicked) {
          const ok = level >= a && level <= b;
          return next(ok, ok ? { cut: 'Clean cut!', tape: 'Neat!', bow: 'Lovely bow!' }[st] : level < a ? 'Too soon!' : 'Too late!');
        }
        if (level > 1) next(false, { cut: 'Paper everywhere!', tape: 'Tangled!', bow: 'Knotted!' }[st]);
      },
      render(g) {
        rect(g, 0, 0, W, H, '#2a1d18');
        rect(g, 0, 170, W, 100, '#6b4a32');
        rect(g, 0, 170, W, 2, '#8a6a4a');
        // Wrapped gifts so far, on the left; the one on the table in the middle.
        gifts.forEach((gf, i) => {
          if (i >= gi) return;
          const x = 30 + i * 46;
          const nice = gf.ok.filter(Boolean).length;
          rect(g, x, 150, 40, 30, nice >= 2 ? gf.paper : '#8a7a6a');
          rect(g, x + 18, 150, 4, 30, gf.ribbon);
          if (nice === 3) rect(g, x + 14, 144, 12, 6, gf.ribbon);
        });
        if (gi < GIFTS) {
          const gf = gifts[gi];
          const x = W / 2 - gf.w / 2;
          const y = 168 - gf.h;
          rect(g, x - 1, y - 1, gf.w + 2, gf.h + 2, '#1a1a22');
          rect(g, x, y, gf.w, gf.h, si > 0 ? gf.paper : '#c8a878');
          if (si > 1) rect(g, x + gf.w / 2 - 2, y, 4, gf.h, gf.ribbon);
          if (si > 1) rect(g, x, y + gf.h / 2 - 2, gf.w, 4, gf.ribbon);
          const st = stage();
          const [a, b] = band();
          if (st === 'bow') {
            // The closing ring: the band is where the bow sits snug.
            const r = Math.round((1 - level) * 40) + 4;
            const ra = Math.round((1 - b) * 40) + 4;
            const rb = Math.round((1 - a) * 40) + 4;
            const cx = W / 2;
            const cy = y - 30;
            for (let k = 0; k < 24; k++) {
              const ang = (k / 24) * Math.PI * 2;
              rect(g, Math.round(cx + Math.cos(ang) * rb) - 1, Math.round(cy + Math.sin(ang) * rb) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * ra) - 1, Math.round(cy + Math.sin(ang) * ra) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy + Math.sin(ang) * r) - 1, 3, 3, gf.ribbon);
            }
          } else {
            const gx = 120;
            const gy = 214;
            const gw = 240;
            rect(g, gx - 1, gy - 1, gw + 2, 12, '#1a1a22');
            rect(g, gx, gy, gw, 10, st === 'cut' ? '#c8a878' : '#f4f6f8');
            rect(g, gx + gw * a, gy, gw * (b - a), 10, '#5fd068');
            rect(g, gx + Math.min(gw, gw * level) - 1, gy - 3, 3, 16, st === 'cut' ? '#9aa1ad' : '#e2504a');
          }
          drawText(g, TIPS[st], W / 2, 44, { align: 'center', color: '#f4f1e8' });
        }
        drawText(g, isTouch() ? 'Tap at the right moment' : 'SPACE at the right moment', W / 2, 256, { align: 'center', color: '#c8b8a8' });
        header(g, theme?.title || 'Gift Wrapping', `Gift ${Math.min(gi + 1, GIFTS)}/${GIFTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
```

Register in `src/minigames/index.js` (`import giftwrap from './giftwrap.js';`, add `giftwrap` to the array).

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyGames.test.js` and `MG=giftwrap bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/minigames/giftwrap.js src/minigames/index.js tests/partyGames.test.js
git commit -m "Gift Wrapping: the Secret Santa mini-game, cut, tape and bow on the beat"
```

---

### Task 7: Carol Karaoke mini-game, and the host playing a game's own song

**Files:**
- Create: `src/minigames/carols.js`
- Modify: `src/minigames/index.js`
- Modify: `src/scenes/minigameScene.js` (`update`: when play starts, `inst.song` plays)
- Test: `tests/partyGames.test.js` (append)

**Interfaces:**
- Consumes: `SONGS.jinglebells|deckhalls|wenceslas`, `CAROLS` (Task 4).
- Produces: `MINIGAMES.carols`; exports `midiOf(token)`, `melodyNotes(song)` → `[{ t, dur, midi }]`, `lanesFor(notes)` →
  `(midi) => 0|1|2`; `inst.song` (a SONGS key), `inst.peek()` → `{ time, voice, notes: [{ t, dur, lane }] }`.
  Host contract: a mini-game instance may set `song`; the host plays it when the countdown ends.

- [ ] **Step 1: Write the failing tests** (append)

```js
const { melodyNotes, lanesFor, midiOf } = await import('../src/minigames/carols.js');
const { SONGS } = await import('../src/data/music.js');
const { CAROLS } = await import('../src/data/party.js');

test('carol notes: tokens to times and lengths, three lanes over the pitches used', () => {
  expect(midiOf('C4')).toBe(60);
  expect(midiOf('F#5')).toBe(78);
  expect(midiOf('-')).toBe(null);
  const n = melodyNotes({ bpm: 120, melody: ['C5 - - - D5 - . . E5 - - - - - - -'] });
  expect(n.map((x) => [x.t, x.dur, x.midi])).toEqual([[0, 0.5, 72], [0.5, 0.25, 74], [1, 1, 76]]);
  for (const c of CAROLS) {
    const notes = melodyNotes(SONGS[c.id]);
    expect(notes.length).toBe(c.syllables.length);
    const lane = lanesFor(notes);
    expect(new Set(notes.map((x) => lane(x.midi))).size).toBe(3);
  }
});

test('Carol Karaoke: staying on the note is 3 stars, idle or random is nothing', () => {
  const target = (p) => {
    const soon = p.notes.find((n) => p.time + 1 / 30 >= n.t && p.time + 1 / 30 < n.t + n.dur) || p.notes.find((n) => n.t > p.time);
    return soon ? soon.lane : p.voice;
  };
  for (const seed of [1, 2, 3, 4]) {
    const best = play('carols', (p) => {
      const want = target(p);
      if (p.voice < 0) return { tap: ['ArrowUp'] };
      return { tap: want > p.voice ? ['ArrowUp'] : want < p.voice ? ['ArrowDown'] : [] };
    }, seed);
    expect(best).toBeGreaterThanOrEqual(0.85);
    expect(play('carols', null, seed)).toBeLessThan(0.35);
    let k = 0;
    expect(play('carols', () => ({ tap: [++k % 7 === 0 ? 'ArrowUp' : k % 5 === 0 ? 'ArrowDown' : null].filter(Boolean) }), seed)).toBeLessThan(0.35);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyGames.test.js`
Expected: FAIL (`Cannot find module '../src/minigames/carols.js'`).

- [ ] **Step 3: Implement `src/minigames/carols.js`**

```js
// Carol Karaoke (Christmas party, the stage): sing a carol in the public domain. Its melody runs in three pitch lanes
// (low, middle, high); keep your voice on the lane of the note being sung (Up/Down, or tap a lane) while the lyrics scroll.
// The host plays the carol (inst.song) from the start of play. Score: time on the right lane over the sung time, where
// a third (a voice parked on one lane) is nothing.
import { W, H, rect, drawText, measureText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONGS } from '../data/music.js';
import { CAROLS } from '../data/party.js';

const NOTE = /^([A-G])(#|b)?(\d)$/;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LANE_Y = [180, 140, 100]; // low at the bottom
const LANE_NAMES = ['LOW', 'MID', 'HIGH'];
const NOW_X = 110;
const PX = 70; // px per second

export function midiOf(tok) {
  const m = NOTE.exec(tok);
  if (!m) return null;
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** The sung notes of a tracker song: [{ t, dur, midi }] in seconds; '-' holds the note before it, '.' rests. */
export function melodyNotes(song) {
  const step = 60 / song.bpm / 4;
  const toks = song.melody.flatMap((bar) => bar.trim().split(/\s+/));
  const notes = [];
  let open = false; // the last token was the note (or its hold), so a '-' extends it
  toks.forEach((tok, i) => {
    const midi = midiOf(tok);
    if (midi != null) {
      notes.push({ t: i * step, dur: step, midi });
      open = true;
    } else if (tok === '-' && open) notes.at(-1).dur += step;
    else open = false;
  });
  return notes;
}

/** Three lanes over the distinct pitches a carol uses, low to high. */
export function lanesFor(notes) {
  const pitches = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b);
  return (midi) => Math.min(2, Math.floor((pitches.indexOf(midi) * 3) / pitches.length));
}

export default {
  id: 'carols',
  name: 'Carol Karaoke',
  help: 'Sing along: keep your voice on the lane of the note being sung. Up/Down, or tap a lane.',
  create({ rng, theme, sfx = () => {} }) {
    const carol = rng.pick(CAROLS);
    const notes = melodyNotes(SONGS[carol.id]);
    const lane = lanesFor(notes);
    notes.forEach((n, i) => Object.assign(n, { lane: lane(n.midi), word: carol.syllables[i] || '' }));
    const end = notes.at(-1).t + notes.at(-1).dur;
    const total = new Countdown(end + 3);
    const fl = new Floaters();
    let time = 0;
    let voice = -1; // not singing until the first press
    let sung = 0;
    let on = 0;
    let wasOn = false;

    const inst = {
      done: false,
      score: 0,
      song: carol.id,
      peek: () => ({ time, voice, notes: notes.map((n) => ({ t: n.t, dur: n.dur, lane: n.lane })) }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        time += dt;
        if (input.pressed('ArrowUp')) voice = voice < 0 ? 1 : Math.min(2, voice + 1);
        if (input.pressed('ArrowDown')) voice = voice < 0 ? 1 : Math.max(0, voice - 1);
        if (input.pointer.clicked) {
          const i = LANE_Y.findIndex((y) => Math.abs(input.pointer.y - (y + 8)) <= 18);
          if (i >= 0) voice = i;
        }
        const cur = notes.find((n) => time >= n.t && time < n.t + n.dur);
        if (cur) {
          sung += dt;
          const ok = voice === cur.lane;
          if (ok) on += dt;
          if (ok && !wasOn) sfx('click');
          wasOn = ok;
        }
        if (total.update(dt) || time >= end + 0.5) return finish(inst, clamp(((sung ? on / sung : 0) - 1 / 3) * 1.5, 0, 1));
      },
      render(g) {
        rect(g, 0, 0, W, H, '#1a1226');
        rect(g, 0, 214, W, 56, '#3a2416');
        for (let i = 0; i < 3; i++) {
          rect(g, 40, LANE_Y[i], W - 60, 16, '#241a34');
          drawText(g, LANE_NAMES[i], 6, LANE_Y[i] + 5, { color: '#8a80a0' });
        }
        for (const n of notes) {
          const x = NOW_X + (n.t - time) * PX;
          const w = Math.max(3, n.dur * PX - 2);
          if (x + w < 40 || x > W) continue;
          const live = time >= n.t && time < n.t + n.dur;
          rect(g, Math.round(Math.max(40, x)), LANE_Y[n.lane] + 3, Math.round(w - Math.max(0, 40 - x)), 10, live ? '#f2e14e' : '#c8343a');
        }
        rect(g, NOW_X, 92, 1, 112, '#f4f1e8');
        if (voice >= 0) {
          const y = LANE_Y[voice];
          rect(g, NOW_X - 7, y - 2, 14, 20, '#1a1a22');
          rect(g, NOW_X - 6, y - 1, 12, 18, '#f2c9a0');
          rect(g, NOW_X - 6, y - 4, 12, 4, '#d8343a');
          rect(g, NOW_X - 2, y + 10, 4, 3, '#7a3b3b');
        }
        // The lyrics: the current syllable bright, the next few dim.
        const i0 = Math.max(0, notes.findIndex((n) => n.t + n.dur > time));
        let x = 40;
        for (let i = i0; i < Math.min(notes.length, i0 + 8); i++) {
          const word = notes[i].word;
          drawText(g, word, x, 230, { color: i === i0 && time >= notes[i].t ? '#f2e14e' : '#c8b8a8' });
          x += measureText(word) + 6;
        }
        drawText(g, isTouch() ? 'Tap a lane to sing there' : 'Up/Down to change your note', W / 2, 252, { align: 'center', color: '#8a80a0' });
        header(g, theme?.title || 'Carol Karaoke', carol.title);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
```

Register in `src/minigames/index.js`.

In `src/scenes/minigameScene.js` `update`, where `this.phase = 'play';` is set after the countdown, add after `input.consumeClick();`:

```js
        if (this.inst.song) this.game.audio.play(this.inst.song); // a game with its own song (Carol Karaoke) starts it now
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyGames.test.js` and `MG=carols bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/minigames/carols.js src/minigames/index.js src/scenes/minigameScene.js tests/partyGames.test.js
git commit -m "Carol Karaoke: three public-domain carols in pitch lanes; the host plays a game's own song when play starts"
```

---

### Task 8: Photo Booth mini-game, and the Christmas buffet

**Files:**
- Create: `src/minigames/photobooth.js`
- Modify: `src/minigames/buffet.js` (Christmas dishes for `theme.dept === 'party'`; export `dishesFor`)
- Modify: `src/minigames/index.js`
- Test: `tests/partyGames.test.js` (append)

**Interfaces:**
- Produces: `MINIGAMES.photobooth`; `inst.peek()` → `{ pose: 0..3, phase: 'count'|'flash', left }`; buffet `dishesFor(theme)`.

- [ ] **Step 1: Write the failing tests** (append)

```js
const { dishesFor } = await import('../src/minigames/buffet.js');

test('Photo Booth: holding the pose is 3 stars, idle is nothing', () => {
  for (const seed of [1, 2, 3]) {
    expect(play('photobooth', (p) => ({ hold: [KEYS[p.pose]] }), seed)).toBeGreaterThanOrEqual(0.85);
    expect(play('photobooth', null, seed)).toBeLessThan(0.35);
    expect(play('photobooth', () => ({ tap: KEYS }), seed)).toBeLessThan(0.35);
  }
});

test('the buffet serves Christmas dishes at the party, the hotel\'s anywhere else', () => {
  const xmas = dishesFor({ dept: 'party' }).map((d) => d.name);
  expect(xmas).toContain('Turkey');
  expect(xmas).toContain('Mince pie');
  expect(dishesFor({ dept: 'exec' }).map((d) => d.name)).toContain('Lobster');
  expect(dishesFor(undefined).map((d) => d.name)).toContain('Lobster');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyGames.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/minigames/buffet.js`: after `const DISHES = [...]` add

```js
// The Christmas party's buffet (theme.dept 'party', scenes/party.js).
const XMAS_DISHES = [
  { name: 'Turkey', a: '#b8763a', b: '#f2d9a0' },
  { name: 'Mince pie', a: '#c89a5a', b: '#8a4a2a' },
  { name: 'Gingerbread', a: '#a0622e', b: '#f4f1e8' },
  { name: 'Pudding', a: '#5a2a1a', b: '#2f8a3a' },
  { name: 'Sprouts', a: '#5fa048', b: '#3a7a2a' },
  { name: 'Stollen', a: '#f4f1e8', b: '#d8343a' },
  { name: 'Candy cane', a: '#f4f1e8', b: '#d8343a' },
  { name: 'Roast potatoes', a: '#e2b85a', b: '#b8863a' },
];
export const dishesFor = (theme) => (theme?.dept === 'party' ? XMAS_DISHES : DISHES);
```

and in `create`, change `items.push({ x, y, d: rng.pick(DISHES), age: 0 });` to use `const dishes = dishesFor(theme);`
(declared once at the top of `create`) and `rng.pick(dishes)`.

`src/minigames/photobooth.js`:

```js
// Photo Booth (Christmas party): four shots. Each shows a pose card and counts down; hold that pose's arrow when the
// flash fires (or tap its pad before it). The strip of four photos is the result.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const POSES = ['Wave left', 'Crouch', 'Hands up', 'Wave right'];
const SHOTS = 4;
const PAD = { y: 228, w: 96, h: 26, x0: 36, gap: 8 };
const padX = (i) => PAD.x0 + i * (PAD.w + PAD.gap);

/** A 20x34 figure striking pose p (-1 = standing), at x, y (feet). */
function figure(g, x, y, p) {
  const crouch = p === 1 ? 8 : 0;
  rect(g, x - 5, y - 30 + crouch, 10, 14, '#d8343a');
  rect(g, x - 4, y - 41 + crouch, 8, 10, '#f2c9a0');
  rect(g, x - 5, y - 44 + crouch, 10, 4, '#d8343a');
  rect(g, x - 5, y - 41 + crouch, 10, 1, '#f4f1e8');
  rect(g, x - 5, y - 16 + crouch, 4, 16 - crouch, '#2b2e38');
  rect(g, x + 1, y - 16 + crouch, 4, 16 - crouch, '#2b2e38');
  const armUp = (side) => rect(g, x + side * 6 - (side < 0 ? 2 : 0), y - 44 + crouch, 2, 14, '#f2c9a0');
  const armDown = (side) => rect(g, x + side * 6 - (side < 0 ? 2 : 0), y - 30 + crouch, 2, 12, '#d8343a');
  if (p === 2) (armUp(-1), armUp(1));
  else if (p === 0) (armUp(-1), armDown(1));
  else if (p === 3) (armDown(-1), armUp(1));
  else (armDown(-1), armDown(1));
}

export default {
  id: 'photobooth',
  name: 'Photo Booth',
  help: 'Strike the pose on the card: hold its arrow key (or tap its pad) when the flash goes off. Four shots!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const wait = byDiff(d, 3, 2.2);
    const total = new Countdown(SHOTS * (wait + 1) + 4);
    const poses = Array.from({ length: SHOTS }, () => rng.int(0, 3));
    const fl = new Floaters();
    const strip = [];
    let shot = 0;
    let t = 0;
    let phase = 'count';
    let tap = -1;
    let good = 0;
    const holding = (input) => {
      const k = KEYS.findIndex((key) => input.down(key));
      return k >= 0 ? k : tap;
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ pose: poses[Math.min(shot, SHOTS - 1)], phase, left: wait - t }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / SHOTS);
        t += dt;
        if (input.pointer.clicked && input.pointer.y >= PAD.y) {
          const i = [0, 1, 2, 3].find((k) => input.pointer.x >= padX(k) && input.pointer.x < padX(k) + PAD.w);
          if (i != null) tap = i;
        }
        if (phase === 'count' && t >= wait) {
          const pose = holding(input);
          const ok = pose === poses[shot];
          if (ok) good++;
          strip.push(pose);
          sfx(ok ? 'good' : 'bad');
          fl.add(ok ? 'Perfect pose!' : 'Blinked!', W / 2, 60, ok ? '#5fd068' : '#e2504a');
          phase = 'flash';
          t = 0;
          tap = -1;
        } else if (phase === 'flash' && t >= 1) {
          shot++;
          t = 0;
          phase = 'count';
          if (shot >= SHOTS) return finish(inst, good / SHOTS);
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#2a1a2e');
        rect(g, 120, 30, 240, 180, '#d8343a');
        rect(g, 126, 36, 228, 168, '#f4f1e8');
        // The live view: you, holding whatever you hold right now; the pose card on the left.
        const held = KEYS.findIndex((k) => inst._input?.down?.(k));
        figure(g, W / 2, 190, held >= 0 ? held : tap);
        if (phase === 'count' && shot < SHOTS) {
          rect(g, 18, 60, 92, 70, '#1a1a22');
          rect(g, 20, 62, 88, 66, '#f2e14e');
          drawText(g, POSES[poses[shot]], 64, 70, { align: 'center', color: '#1a1a22' });
          figure(g, 64, 124, poses[shot]);
          drawText(g, String(Math.max(1, Math.ceil(wait - t))), W / 2, 44, { align: 'center', scale: 2, color: '#d8343a' });
        }
        if (phase === 'flash' && t < 0.25) rect(g, 0, 0, W, H, 'rgba(255,255,255,0.85)');
        // The strip so far, on the right.
        strip.forEach((p, i) => {
          rect(g, 380, 40 + i * 44, 40, 40, '#1a1a22');
          rect(g, 382, 42 + i * 44, 36, 36, p === poses[i] ? '#f4f1e8' : '#8a8a8a');
          figure(g, 400, 76 + i * 44, p);
        });
        for (let i = 0; i < 4; i++) {
          rect(g, padX(i), PAD.y, PAD.w, PAD.h, tap === i ? '#f2e14e' : '#3a2a4a');
          drawText(g, POSES[i], padX(i) + PAD.w / 2, PAD.y + 9, { align: 'center', color: tap === i ? '#1a1a22' : '#f4f1e8' });
        }
        drawText(g, isTouch() ? 'Tap the pose before the flash' : 'Hold the arrow key for the pose', W / 2, 218, { align: 'center', color: '#c8b8a8' });
        header(g, theme?.title || 'Photo Booth', `Shot ${Math.min(shot + 1, SHOTS)}/${SHOTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
```

The live figure reads the input in `render`; store it in `update` with `inst._input = input;` as its first line (render gets no
input). Register `photobooth` in `src/minigames/index.js`.

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyGames.test.js tests/holiday.test.js` and `MG=photobooth,buffet bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/minigames/photobooth.js src/minigames/buffet.js src/minigames/index.js tests/partyGames.test.js
git commit -m "Photo Booth for the Christmas party, and Christmas dishes on the buffet there"
```

---

### Task 9: The mini-game host's party mode (and reduced motion)

**Files:**
- Modify: `src/engine/platform.js` (add `reducedMotion()`)
- Modify: `src/scenes/minigameScene.js` (mode `'party'`: theme, music, completion, result card, sway, pause text)
- Test: `tests/partyHost.test.js`

**Interfaces:**
- Consumes: `completePartyActivity`, `partyLeft`, `sway`, `tipsyLevel` (Task 1).
- Produces: `new MinigameScene(game, task, onDone, { mode: 'party' })`: `theme.dept === 'party'`; `result` =
  `{ stars, sp, first, gift, score, playS }`; plays `'xmasparty'` (or the game's own song once play starts).

- [ ] **Step 1: Write the failing test**

```js
// tests/partyHost.test.js
// The mini-game host at the party: free, pays once, the Secret Santa gift on the result, the party theme for the buffet.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const PA = await import('../src/core/party.js');

const DEC10 = new Date(2026, 11, 10, 12).getTime();
const played = [];
const audio = { setMusic() {}, setSfx() {}, play: (n) => played.push(n), sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');

function party() {
  const game = createGame({ screen: {}, input: createInput(), audio });
  game.now = () => DEC10;
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor: 12, maxFloor: 12, level: 12 });
  s.flags.introSeen = true;
  game.newCareer(s);
  PA.startParty(s, 12, DEC10);
  return game;
}

test('party mode: the party theme, free, pays once, the gift on the result', () => {
  const game = party();
  const s = game.state;
  const coffee = s.coffee.value;
  const ms = new MinigameScene(game, { id: 'party-giftwrap', game: 'giftwrap', title: 'Secret Santa', difficulty: 0.3, seed: 5 }, null, { mode: 'party' });
  game.push(ms);
  expect(played.at(-1)).toBe('xmasparty');
  ms.complete(0.9);
  expect(ms.result).toMatchObject({ stars: 3, first: true, gift: 'xmas-2026', sp: PA.activityPay(s) });
  expect(s.coffee.value).toBe(coffee);
  ms.render(g);
  const again = new MinigameScene(game, { id: 'party-giftwrap', game: 'giftwrap', title: 'Secret Santa', difficulty: 0.3, seed: 6 }, null, { mode: 'party' });
  game.push(again);
  again.complete(0.9);
  expect(again.result).toMatchObject({ first: false, sp: 0, gift: null });
  const buffet = new MinigameScene(game, { id: 'party-buffet', game: 'buffet', title: 'Christmas Buffet', difficulty: 0.3, seed: 7 }, null, { mode: 'party' });
  expect(buffet.inst).toBeTruthy(); // created with theme.dept 'party' (dishes covered in partyGames.test.js)
});

test('tipsy: the host still renders a party game while swaying, and with the double image', () => {
  const game = party();
  for (let i = 0; i < 3; i++) PA.drink(game.state, 'punch');
  const ms = new MinigameScene(game, { id: 'party-dance', game: 'dance', title: 'Dance-Off', difficulty: 0.3, seed: 1 }, null, { mode: 'party' });
  game.push(ms);
  ms.phase = 'play';
  for (let i = 0; i < 30; i++) {
    ms.update(1 / 60);
    ms.render(g);
  }
  expect(ms.phase).toBe('play');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyHost.test.js`
Expected: FAIL (no `'party'` mode: `completeTask` path pays KPI stars and needs coffee bookkeeping; `result.gift` undefined).

- [ ] **Step 3: Implement**

`src/engine/platform.js`:

```js
/** The system asks for less motion (prefers-reduced-motion): no swaying views (the party's tipsy sway). */
export function reducedMotion() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
```

`src/scenes/minigameScene.js`:

1. Imports: `import { completePartyActivity, partyLeft, sway, tipsyLevel } from '../core/party.js';` and
   `import { reducedMotion } from '../engine/platform.js';`.
2. In the constructor doc comment, add: `or 'party' (an activity at the Christmas party: free, paperclips once per activity
   and party, the Secret Santa gift; no XP, KPI stars or coffee, see core/party.js)`.
3. Constructor: replace `const dept = departmentForFloor(this.floor).id;` with
   `const dept = this.mode === 'party' ? 'party' : departmentForFloor(this.floor).id;`.
4. `enter()`: `this.game.audio.play(this.mode === 'vacation' ? 'tropical' : this.mode === 'home' ? 'homeoffice' : this.mode === 'party' ? 'xmasparty' : 'minigame');`
5. `complete(score)`: add `if (this.mode === 'party') return this.completeParty(score);` next to the other modes.
6. New methods after `completeHome`/`renderHomeResult`:

```js
  completeParty(score) {
    const s = this.game.state;
    this.result = completePartyActivity(s, this.task.game, score);
    this.result.score = score;
    track('party_activity', { game: this.task.game, stars: this.result.stars });
    if (this.inst.song) this.game.audio.play('xmasparty'); // the carol is over: back to the party
    this.game.markDirty();
    this.game.saveNow();
    this.phase = 'result';
    this.t = 0;
    this.revealed = 0;
    this.game.sfx(this.result.stars > 0 ? 'good' : 'fail');
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 50, y: H / 2 + 58, w: 100, h: 18, label: 'Continue', onClick: () => this.finish() });
  }
  renderPartyResult(g) {
    const r = this.result;
    const s = this.game.state;
    dim(g, 0.65);
    const x = W / 2 - 120;
    const y = H / 2 - 82;
    const titles = ['Party pooper', 'Merry', 'Festive', 'Life of the party!'];
    panel(g, x, y, 240, 168, { title: titles[r.stars], titleColor: r.stars ? '#c8343a' : '#7a2b2b' });
    drawStarsLarge(g, this.revealed, W / 2, y + 18);
    drawText(g, `Score ${Math.round(r.score * 100)}%`, W / 2, y + 44, { align: 'center', color: C.dim });
    let yy = y + 60;
    if (r.first) {
      icon(g, 'sp', x + 40, yy);
      drawText(g, 'Christmas bonus', x + 52, yy, { color: C.dim });
      drawText(g, `+${formatNum(r.sp)}`, x + 200, yy, { align: 'right', color: C.gold });
      yy += 12;
    } else {
      drawText(g, r.stars ? 'Done tonight already: no bonus twice.' : 'Have another go: it pays at 1 star.', W / 2, yy, { align: 'center', color: r.stars ? C.dim : C.warn });
      yy += 12;
    }
    if (r.gift) drawText(g, 'Secret Santa: a little tree for your desk!', W / 2, yy + 2, { align: 'center', color: C.good });
    const left = partyLeft(s, this.game.now());
    drawText(g, left > 0 ? `${formatTime(left)} left at the party` : 'The party is winding down', W / 2, y + 140, { align: 'center', color: C.dim });
    this.buttons.render(g);
  }
```

7. `render(g)`: replace `this.inst.render(g);` with

```js
    // Tipsy at the party: the picture sways (not with reduced motion) and doubles at the third drink.
    const tipsy = this.mode === 'party' && this.phase === 'play' ? tipsyLevel(this.game.state) : 0;
    const o = tipsy && !reducedMotion() ? sway(tipsy, this.playT) : { x: 0, y: 0 };
    g.save();
    g.translate(o.x, o.y);
    this.inst.render(g);
    g.restore();
    if (tipsy >= 3) {
      g.save();
      g.globalAlpha = 0.22;
      g.drawImage(g.canvas, 2, 1);
      g.restore();
    }
```

8. Pause message: add `party: 'Give up? You can try again later.'` to the `msg` object (it appears twice in the file: in
   `render`; keep one lookup).
9. Result dispatch: `else if (this.mode === 'party') this.renderPartyResult(g);` next to `'home'`.

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyHost.test.js tests/homeScenes.test.js tests/vacationScenes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/platform.js src/scenes/minigameScene.js tests/partyHost.test.js
git commit -m "The mini-game host's party mode: free, a Christmas bonus once per activity, the Secret Santa gift, a tipsy sway"
```

---

### Task 10: The party hall, its furniture and its guests

**Files:**
- Create: `src/core/partyHall.js`
- Modify: `src/engine/art.js` (`FURNITURE`: 10 types; `drawFloorTile`: `dancefloor`)
- Modify: `src/core/curios.js` (`quipsOf` reads `PARTY_QUIPS` when `fl.party`; `'bar'` is gameplay)
- Test: `tests/partyHall.test.js`

**Interfaces:**
- Consumes: `createPlanner`, `buildWalkable`, `bfs`, `isItemReachable` (floorgen), `buildFloor` (tasks), `E.PARTY`, `createRng`,
  `PARTY_ACTIVITIES` (Task 4).
- Produces: `buildPartyHall()` → `fl` with `party: true, foreign: true, w: 44, h: 28, entrance {x:21,y:0,w:2}, arrive,
  activities (items with it.activity {id, game, title, difficulty, seed}), bar (item, interact 'bar'), receptionist (the
  bartender's spot), hrRep (spot {x, y}), disco {x, y} (tiles), tree (item), danceSpots [6 x {x,y}], mingleSpots [8 x {x,y}],
  npcs: []`; `partyGuests(s, year)` → `[{ seed, dept, x, y, dancer }]`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/partyHall.test.js
// The party hall (core/partyHall.js): every activity, the bar and the doors reachable; guests are colleagues you know.
import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import { buildFloor } from '../src/core/tasks.js';
import { isItemReachable } from '../src/core/floorgen.js';
import { buildPartyHall, partyGuests } from '../src/core/partyHall.js';
import { ACTIVITY_GAMES } from '../src/core/party.js';
import { PARTY_QUIPS } from '../src/data/party.js';
import { curioOf } from '../src/core/curios.js';

const hall = buildPartyHall();
const career = (maxFloor) => {
  const s = S.newGame({ corpName: 'Acme' }, 0);
  s.lobby = 'done';
  s.maxFloor = maxFloor;
  return s;
};

test('the hall: every activity and the bar reachable from the doors; spots free to stand on', () => {
  expect(hall).toMatchObject({ party: true, foreign: true, w: 44, h: 28 });
  expect(hall.activities.map((it) => it.activity.game).sort()).toEqual([...ACTIVITY_GAMES].sort());
  for (const it of [...hall.activities, hall.bar]) expect(isItemReachable(hall, hall.walk, hall.dist, it), it.type).toBe(true);
  expect(hall.danceSpots.length).toBe(6);
  expect(hall.mingleSpots.length).toBe(8);
  for (const p of [...hall.danceSpots, ...hall.mingleSpots, hall.arrive]) {
    const i = Math.floor(p.y) * hall.w + Math.floor(p.x);
    expect(hall.walk[i], `${p.x},${p.y}`).toBe(1);
    expect(hall.dist[i]).toBeGreaterThanOrEqual(0);
  }
  expect(buildPartyHall()).toBe(hall); // cached
});

test('every piece of non-gameplay furniture in the hall has party lines of its own', () => {
  for (const it of hall.items) {
    const c = curioOf(hall, it);
    if (!c) continue;
    const key = it.type === 'chairup' ? 'chair' : it.type;
    expect(PARTY_QUIPS[key]?.length || 0, it.type).toBeGreaterThanOrEqual(20);
  }
});

test('guests are colleagues from the floors you know, never one the CEO fired; 6 dance', () => {
  const s = career(12);
  const known = new Map();
  for (let f = 1; f <= 12; f++) for (const n of buildFloor(f).npcs) known.set(n.seed, buildFloor(f).dept);
  const fired = [...known.keys()].slice(0, 5);
  for (const seed of fired) s.fired[seed] = true;
  const guests = partyGuests(s, 2026);
  expect(guests.length).toBe(14);
  expect(new Set(guests.map((g) => g.seed)).size).toBe(14);
  for (const g of guests) {
    expect(known.get(g.seed)).toBe(g.dept);
    expect(fired).not.toContain(g.seed);
  }
  expect(guests.filter((g) => g.dancer).length).toBe(6);
  expect(partyGuests(s, 2026)).toEqual(guests); // the same party on every load
  expect(partyGuests(s, 2027)).not.toEqual(guests);
});

test('a new hire\'s party: no more guests than colleagues on floor 1', () => {
  const s = career(1);
  const pool = buildFloor(1).npcs.length;
  const guests = partyGuests(s, 2026);
  expect(guests.length).toBe(Math.min(14, pool));
  for (const seed of buildFloor(1).npcs.map((n) => n.seed)) s.fired[seed] = true;
  expect(partyGuests(s, 2026)).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyHall.test.js`
Expected: FAIL: `Cannot find module '../src/core/partyHall.js'`.

- [ ] **Step 3: Implement `src/core/partyHall.js`**

```js
// The Christmas party hall (spec 2026-10-15-christmas-party): one big room, the elevator doors in the top wall. The stage
// (Carol Karaoke) top left, the DJ booth (Dance-Off) over the dance floor in the middle, the bar along the right wall (the
// bartender behind it), the buffet on the left, the tree with the Secret Santa table bottom left, the photo booth bottom
// right, party tables along the bottom. Deterministic and cached; the guests come from partyGuests.
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs } from './floorgen.js';
import { buildFloor } from './tasks.js';
import * as E from './economy.js';
import { DEPARTMENTS } from '../data/departments.js';
import { PARTY_ACTIVITIES } from '../data/party.js';

export const HALL_W = 44;
export const HALL_H = 28;
const DOOR_X = 21;
const DANCE = { x0: 17, x1: 26, y0: 9, y1: 16 };

let cached = null;

export function buildPartyHall() {
  return (cached ||= generateHall());
}

function generateHall() {
  const W = HALL_W;
  const H = HALL_H;
  const dept = DEPARTMENTS.find((d) => d.id === 'exec');
  const P = createPlanner(W, H, createRng(1224), dept);
  const { tiles, idx, setWall, rooms, roomOf, items, place, decor } = P;
  const ground = new Array(W * H).fill('parquet');
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    setWall(0, y);
    setWall(W - 1, y);
  }
  for (const x of [DOOR_X, DOOR_X + 1]) tiles[idx(x, 0)] = 0;
  const entrance = { x: DOOR_X, y: 0, w: 2 };
  const room = { id: rooms.length, type: 'hall', x0: 1, x1: W - 2, y0: 1, y1: H - 2, doors: [] };
  rooms.push(room);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) roomOf[idx(x, y)] = room.id;
  for (let y = DANCE.y0; y <= DANCE.y1; y++) for (let x = DANCE.x0; x <= DANCE.x1; x++) ground[idx(x, y)] = 'dancefloor';

  const activity = (type, game, x, y, w = 1, h = 1) => {
    const a = PARTY_ACTIVITIES.find((v) => v.game === game);
    return place(room, type, x, y, w, h, { activity: { id: `party-${game}`, game, title: a.title, difficulty: E.PARTY.difficulty, seed: 9100 + items.length } });
  };

  // The stage with its microphone; the DJ booth over the dance floor.
  place(room, 'stage', 2, 1, 7, 2);
  activity('micstand', 'carols', 5, 4);
  activity('djbooth', 'dance', 20, 6, 4, 1);
  // The bar along the right wall, the bartender behind it; the punch bowl at its end.
  const bar = place(room, 'partybar', 39, 6, 1, 8, { interact: 'bar' });
  items.push({ id: items.length, type: 'receptionist', x: 40, y: 9, w: 2, h: 1, room: room.id, solid: true });
  const receptionist = items[items.length - 1];
  place(room, 'punchbowl', 36, 3, 2, 1);
  // The buffet on the left; the tree and the Secret Santa table bottom left; the photo booth bottom right.
  activity('buffet', 'buffet', 2, 10, 6, 1);
  const tree = place(room, 'xmastree', 2, 19, 3, 2);
  activity('santatable', 'giftwrap', 6, 21, 3, 1);
  activity('photobooth', 'photobooth', 38, 20, 3, 2);
  // Party tables with chairs, poinsettias in the corners.
  for (const x of [14, 20, 26, 32]) {
    if (!place(room, 'partytable', x, 22, 2, 1)) continue;
    for (let i = 0; i < 2; i++) {
      decor(room, 'chair', x + i, 21);
      decor(room, 'chairup', x + i, 23);
    }
  }
  for (const [x, y] of [[10, 1], [33, 1], [42, 1], [1, 26], [12, 26], [31, 26], [42, 26]]) place(room, 'poinsettia', x, y);

  const fl = {
    floor: 0, party: true, foreign: true, dept: dept.id, w: W, h: H, tiles, roomOf, rooms, items, entrance, ground,
    look: { carpet: ['#6a2433', '#5e202e'], wall: '#6a2433' },
  };
  fl.arrive = { x: DOOR_X + 1, y: 2.5 };
  Object.assign(fl, { elevator: null, hrDesk: null, turnstile: null, posters: [], myDesk: null, tasks: [], npcs: [] });
  fl.receptionist = receptionist; // the bartender's spot (PartyScene.frontDesk)
  fl.hrRep = { x: 36, y: 15 }; // HR keeps an eye on the bar
  fl.bar = bar;
  fl.tree = tree;
  fl.disco = { x: (DANCE.x0 + DANCE.x1 + 1) / 2, y: (DANCE.y0 + DANCE.y1 + 1) / 2 };
  fl.activities = items.filter((it) => it.activity);
  fl.danceSpots = [[19.5, 10.5], [24.5, 10.5], [18.5, 13.5], [25.5, 13.5], [20.5, 15.5], [23.5, 15.5]].map(([x, y]) => ({ x, y }));
  fl.mingleSpots = [[12.5, 8.5], [31.5, 8.5], [10.5, 17.5], [33.5, 17.5], [17.5, 25.5], [28.5, 25.5], [35.5, 12.5], [8.5, 7.5]].map(([x, y]) => ({ x, y }));
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, DOOR_X, 1);
  return fl;
}

/**
 * Who comes to the party in `year`: up to PARTY.guests colleagues from the floors you know (1..maxFloor), each with their
 * own department, never one the CEO fired; the first PARTY.dancers stand on the dance floor. The same on every load.
 */
export function partyGuests(s, year) {
  const hall = buildPartyHall();
  const fired = s.fired || {};
  const pool = [];
  for (let f = 1; f <= Math.min(s.maxFloor, E.FLOORS); f++) {
    const fl = buildFloor(f);
    for (const n of fl.npcs) if (!fired[n.seed]) pool.push({ seed: n.seed, dept: fl.dept });
  }
  const rng = createRng(year * 7919 + (s.cast || 0));
  const picked = rng.sample(pool, Math.min(E.PARTY.guests, pool.length));
  const dancers = Math.min(E.PARTY.dancers, hall.danceSpots.length);
  return picked.map((g, i) => {
    const dancer = i < dancers;
    const spot = dancer ? hall.danceSpots[i] : hall.mingleSpots[(i - dancers) % hall.mingleSpots.length];
    return { ...g, x: spot.x, y: spot.y, dancer };
  });
}
```

If `place` refuses a spot (returns null) because a footprint overlaps, move that item by a tile and re-run the test: every
activity must exist and be reachable.

`src/engine/art.js` `drawFloorTile`, add:

```js
    case 'dancefloor': {
      // Glossy panels; the colour comes from the party's disco lights (scenes/partyLights.js).
      r(x, y, 16, 16, '#14111c');
      r(x + 1, y + 1, 14, 14, (tx + ty) % 2 ? '#3a3050' : '#2a2238');
      r(x + 2, y + 2, 6, 1, '#4a4064');
      break;
    }
```

`FURNITURE` in `src/engine/art.js`, add (origin = the footprint's top-left in px; negative y rises above it; `lift` = height):

```js
  stage: { lift: 6, draw(p, w) {
    p.box(0, 4, w * 16, 28, 6, '#5a3a2a', '#3a2418');
    for (let x = 4; x < w * 16 - 4; x += 12) p.r(x, -2, 8, 2, '#f2e14e'); // footlights
  } },
  micstand: { lift: 18, draw(p) {
    p.r(7, -14, 2, 22, '#2b2e38');
    p.r(4, 7, 8, 2, '#2b2e38');
    p.r(6, -18, 4, 5, '#1a1a22');
    p.r(7, -17, 2, 3, '#9aa1ad');
  } },
  djbooth: { lift: 18, draw(p, w) {
    p.box(0, 2, w * 16, 12, 16, '#2a2238', '#1a1626');
    p.r(6, -12, 12, 4, '#3a3a48'); // the decks
    p.r(w * 16 - 18, -12, 12, 4, '#3a3a48');
    for (let i = 0; i < 6; i++) p.r(22 + i * 4, -6, 2, 2, ['#e2504a', '#5fd068', '#5b8def'][i % 3]);
  } },
  partybar: { lift: 14, draw(p, w, h = 8) {
    p.box(0, 0, 16, h * 16, 14, '#6b4a32', '#4a301e');
    for (let y = 6; y < h * 16; y += 22) p.r(4, y - 12, 3, 6, '#c8e4f4'), p.r(9, y - 10, 3, 4, '#d8343a');
  } },
  punchbowl: { lift: 12, draw(p, w) {
    p.box(0, 4, w * 16, 10, 8, '#f4f1e8', '#d8d2c4');
    p.r(9, -8, 14, 6, '#f29cd0');
    p.r(10, -9, 12, 2, '#ffd0e8');
  } },
  xmastree: { lift: 44, draw(p, w) {
    const cx = (w * 16) / 2;
    p.r(cx - 3, 14, 6, 8, '#6b4a32');
    for (let i = 0; i < 6; i++) p.r(cx - 4 - i * 3, -30 + i * 8, 8 + i * 6, 8, i % 2 ? '#2f8a3a' : '#267a30');
    p.r(cx - 2, -36, 4, 5, '#f2e14e');
    for (const [x, y, c] of [[-8, -20, '#e2504a'], [6, -14, '#5b8def'], [-12, -2, '#f2e14e'], [10, 4, '#e2504a'], [-2, -8, '#f29cd0'], [14, -4, '#f4f1e8']]) p.r(cx + x, y, 3, 3, c);
  } },
  santatable: { lift: 12, draw(p, w) {
    p.box(0, 4, w * 16, 10, 8, '#d8343a', '#a8242a');
    for (const [x, c] of [[6, '#2f8a3a'], [20, '#f2e14e'], [34, '#5b8def']]) p.r(x, -10, 8, 7, c), p.r(x + 3, -10, 2, 7, '#f4f1e8');
  } },
  photobooth: { lift: 34, draw(p, w) {
    p.box(0, 0, w * 16, 28, 34, '#3a2a4a', '#2a1d36');
    p.r(6, -30, w * 16 - 20, 40, '#d8343a'); // the curtain
    for (let x = 8; x < w * 16 - 16; x += 4) p.r(x, -30, 1, 40, '#a8242a');
    p.r(w * 16 - 12, -26, 8, 10, '#1a1a22');
    p.r(w * 16 - 10, -24, 4, 4, '#8fd3ff');
  } },
  partytable: { lift: 10, draw(p, w) {
    p.box(0, 4, w * 16, 10, 8, '#f4f1e8', '#d8343a');
    p.r(w * 8 - 3, -8, 6, 5, '#2f8a3a'); // the centrepiece
    p.r(w * 8 - 1, -10, 2, 2, '#e2504a');
  } },
  poinsettia: { lift: 12, draw(p) {
    p.r(4, 6, 8, 6, '#8a4a2a');
    p.r(2, -4, 12, 10, '#2f6a2a');
    for (const [x, y] of [[3, -6], [9, -6], [6, -9], [1, -1], [11, -1]]) p.r(x, y, 4, 4, '#d8343a');
    p.r(7, -4, 2, 2, '#f2e14e');
  } },
```

Check the `draw(p, w)` signature against an existing multi-tile item (e.g. `tikibar`); if the painter passes `h` too (the
partybar uses it), keep the default `h = 8` only as a fallback.

`src/core/curios.js`:
- Import `PARTY_QUIPS` from `'../data/party.js'`.
- `isGameplay`: add `'bar'` to `['elevator', 'coffee', 'hr', 'computer']`.
- `quipsOf`: `(fl.party ? PARTY_QUIPS[it.type === 'chairup' ? 'chair' : it.type] : fl.hotel ? ... )` (party first).

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyHall.test.js tests/curios.test.js tests/floors.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/partyHall.js src/engine/art.js src/core/curios.js tests/partyHall.test.js
git commit -m "The Christmas party hall: stage, DJ booth, dance floor, bar, buffet, tree, photo booth; guests are colleagues you know"
```

---

### Task 11: Party lighting and confetti

**Files:**
- Create: `src/scenes/partyLights.js`
- Create: `src/scenes/confetti.js`
- Test: `tests/partyLights.test.js`

**Interfaces:**
- Consumes: `Lighting`, `LIGHTING` (engine/lighting.js), `TILE`, `WALL_H`, `furnitureDef` (art.js), `T_WALL` (floorgen),
  `drawNight(g, lighting, { fade, cam, player, t })` (scenes/nightLights.js), `buildPartyHall()` (Task 10).
- Produces: `partyLighting(fl)` → `Lighting` with `.disco` (6 dynamic lights) and `.player`; `discoSpots(centre, t)` →
  `[{ x, y }]` in tiles; `moveDisco(lighting, centre, t)`; `class Confetti { burst(x, y, n, spread), update(dt), render(g), count }`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/partyLights.test.js
// The party's lights: six coloured disco spots circling the dance floor, and confetti that falls and fades.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { buildPartyHall } = await import('../src/core/partyHall.js');
const { partyLighting, discoSpots, moveDisco } = await import('../src/scenes/partyLights.js');
const { drawNight } = await import('../src/scenes/nightLights.js');
const { Confetti } = await import('../src/scenes/confetti.js');

const hall = buildPartyHall();

test('six disco spots circle the dance floor and move over time', () => {
  const a = discoSpots(hall.disco, 0);
  const b = discoSpots(hall.disco, 1);
  expect(a.length).toBe(6);
  for (let t = 0; t < 30; t += 0.7)
    for (const p of discoSpots(hall.disco, t)) {
      expect(Math.abs(p.x - hall.disco.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(p.y - hall.disco.y)).toBeLessThanOrEqual(3.5);
    }
  expect(a).not.toEqual(b);
  const lighting = partyLighting(hall);
  expect(lighting.disco.length).toBe(6);
  moveDisco(lighting, hall.disco, 2);
  expect(lighting.disco[0].x).toBeCloseTo(discoSpots(hall.disco, 2)[0].x * 16);
  const g = mockCanvas().getContext('2d');
  drawNight(g, lighting, { fade: 1, cam: { x: 0, y: 0 }, player: { x: 22, y: 3 }, t: 2 });
});

test('confetti bursts, falls and is gone after a few seconds', () => {
  let k = 0;
  const c = new Confetti(() => ((k = (k * 9301 + 49297) % 233280) / 233280));
  c.burst(240, 100, 50);
  expect(c.count).toBe(50);
  const g = mockCanvas().getContext('2d');
  for (let i = 0; i < 60; i++) (c.update(1 / 60), c.render(g));
  expect(c.count).toBeGreaterThan(0);
  for (let i = 0; i < 300; i++) c.update(1 / 60);
  expect(c.count).toBe(0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyLights.test.js`
Expected: FAIL: module not found.

- [ ] **Step 3: Implement**

`src/scenes/partyLights.js`:

```js
// The Christmas party's lights (engine/lighting.js): the hall dim and warm, string lights along the walls blinking in
// colours, the tree twinkling, a warm glow at the bar and six coloured disco spots (dynamic lights) circling the dance
// floor, moved each frame by moveDisco. Walls and tall furniture block light, as at night (darkLighting).
import { TILE, WALL_H, furnitureDef } from '../engine/art.js';
import { T_WALL } from '../core/floorgen.js';
import { Lighting, LIGHTING } from '../engine/lighting.js';

const TALL_LIFT = 24;
export const DISCO_COLORS = [[1, 0.3, 0.3], [0.3, 1, 0.4], [0.4, 0.5, 1], [1, 0.4, 1], [1, 0.9, 0.3], [0.3, 1, 1]];
const STRING = [[1, 0.35, 0.35], [0.35, 1, 0.45], [1, 0.85, 0.3], [0.45, 0.6, 1]];
/** A string light's level at t: two groups blink in turn. */
const blink = (i) => (t) => ((Math.floor(t * 1.5) + i) % 2 ? 1 : 0.35);

export function partyLighting(fl) {
  const n = fl.w * fl.h;
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = fl.tiles[i] === T_WALL ? 1 : 0;
  const opaque = wall.slice();
  for (const it of fl.items) {
    const def = furnitureDef(it.type);
    if (!def || def.solid === false || (def.lift || 0) < TALL_LIFT) continue;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) opaque[y * fl.w + x] = 1;
  }
  const lighting = new Lighting({ cols: fl.w, rows: fl.h, tile: TILE, opaque, wall, wallH: WALL_H, config: LIGHTING });
  lighting.setAmbient(0.38, [1, 0.85, 0.75]);
  let i = 0;
  const string = (x, y) => lighting.addLight({ x: x * TILE, y: y * TILE, r: 22, intensity: 1.3, tint: STRING[i % STRING.length], level: blink(i++) });
  for (let x = 2.5; x < fl.w - 2; x += 3) string(x, 1.3);
  for (let y = 4.5; y < fl.h - 2; y += 4) (string(1.3, y), string(fl.w - 1.3, y));
  const t = fl.tree;
  if (t) lighting.addLight({ x: (t.x + t.w / 2) * TILE, y: (t.y + 0.5) * TILE, r: 44, intensity: 1.5, tint: [1, 0.9, 0.6], flicker: { seed: 77, depth: 0.3, speed: 2 } });
  if (fl.bar) lighting.addLight({ x: (fl.bar.x - 0.5) * TILE, y: (fl.bar.y + fl.bar.h / 2) * TILE, r: 56, intensity: 1.2, tint: [1, 0.8, 0.55] });
  lighting.disco = DISCO_COLORS.map((tint) => lighting.addLight({ x: 0, y: 0, r: 30, intensity: 1.7, tint, dynamic: true }));
  lighting.player = lighting.addLight({ x: 0, y: 0, r: 26, intensity: 1.2, dynamic: true });
  return lighting;
}

/** Where the disco spots are at t seconds (tiles): two rings around the dance floor's centre, turning opposite ways. */
export function discoSpots(centre, t, n = DISCO_COLORS.length) {
  return Array.from({ length: n }, (_, i) => {
    const ring = i % 2 ? 2.2 : 3.6;
    const a = t * (i % 2 ? -0.9 : 0.6) + (i * Math.PI * 2) / n;
    return { x: centre.x + Math.cos(a) * ring * 1.3, y: centre.y + Math.sin(a) * ring * 0.8 };
  });
}

export function moveDisco(lighting, centre, t) {
  discoSpots(centre, t).forEach((p, i) => {
    lighting.disco[i].x = p.x * TILE;
    lighting.disco[i].y = p.y * TILE;
  });
}
```

`src/scenes/confetti.js`:

```js
// Confetti for the Christmas party (scenes/party.js): screen-space bits that burst upwards, flutter down and fade.
const COLORS = ['#e2504a', '#f2c14e', '#5fd068', '#5b8def', '#f29cd0', '#ffffff'];

export class Confetti {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.bits = [];
  }
  /** n bits from x, y (px), fanned upwards; spread 1 = a wide fan. */
  burst(x, y, n = 60, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * 2.2 * spread;
      const v = 90 + this.rng() * 140;
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 2 + this.rng() * 1.5, c: COLORS[Math.floor(this.rng() * COLORS.length)], w: this.rng() < 0.5 ? 2 : 1, spin: this.rng() * 6 });
    }
  }
  update(dt) {
    for (const b of this.bits) {
      b.vy = Math.min(b.vy + 160 * dt, 60);
      b.vx *= 1 - 1.5 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.spin += dt * 8;
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < 290);
  }
  render(g) {
    for (const b of this.bits) {
      g.fillStyle = b.c;
      g.fillRect(Math.round(b.x), Math.round(b.y), b.w, Math.sin(b.spin) > 0 ? 2 : 1);
    }
  }
  get count() {
    return this.bits.length;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyLights.test.js tests/lighting.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/partyLights.js src/scenes/confetti.js tests/partyLights.test.js
git commit -m "Party lights: string lights, the tree's twinkle and six disco spots circling the dance floor; confetti"
```

---

### Task 12: The bar (PartyBar)

**Files:**
- Create: `src/scenes/partyBar.js`
- Test: `tests/partyScenes.test.js` (create; Tasks 13–14 append)

**Interfaces:**
- Consumes: `Modal` (overlays.js), `drink`, `tipsyLevel`, `PARTY` (Task 1), `BARTENDER`, `DRINKS` (Task 4).
- Produces: `new PartyBar(game, { bartender })` (`bartender`: the Actor behind the bar, may be null); buttons labelled
  `'Mulled wine'`, `'Eggnog'`, `'Synergy Punch'`, `'Water'`, `'Back'`; drinks disabled at `maxTipsy`.

- [ ] **Step 1: Write the failing test** (create `tests/partyScenes.test.js` with the shared harness)

```js
// Headless walk through the Christmas party: the invitation, the elevator button, the hall, an activity, the bar, the
// clock running out, continuing a career mid-party.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const PA = await import('../src/core/party.js');
const { PartyBar } = await import('../src/scenes/partyBar.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');
export const DEC10 = new Date(2026, 11, 10, 12).getTime();
export const tick = async (game, n = 3) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(1 / 60);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0));
};
export function career(floor = 12, clock = { now: DEC10 }) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  game.now = () => clock.now;
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor });
  s.flags.introSeen = true;
  game.newCareer(s);
  return game;
}

test('the bar: three drinks, then only water; water sobers you up', async () => {
  const game = career();
  PA.startParty(game.state, 12, DEC10);
  const bar = new PartyBar(game, { bartender: null });
  game.push(bar);
  await tick(game, 1);
  const btn = (label) => bar.buttons.items.find((b) => b.label === label);
  for (const label of ['Mulled wine', 'Eggnog', 'Synergy Punch']) btn(label).onClick();
  expect(PA.tipsyLevel(game.state)).toBe(3);
  await tick(game, 1);
  expect(btn('Mulled wine').disabled).toBe(true);
  btn('Water').onClick();
  expect(PA.tipsyLevel(game.state)).toBe(0);
  await tick(game, 1);
  expect(btn('Eggnog').disabled).toBe(false);
  expect(game.state.party.drinks).toBe(3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyScenes.test.js`
Expected: FAIL: `Cannot find module '../src/scenes/partyBar.js'`.

- [ ] **Step 3: Implement `src/scenes/partyBar.js`**

```js
// The party's bar (core/party.js drink): mulled wine, eggnog and Synergy Punch raise how tipsy you are, up to three;
// then the bartender only pours water, which sobers you up at once. No reward: drinks only make things wobblier.
import { C, rect } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import * as PA from '../core/party.js';
import { BARTENDER, DRINKS } from '../data/party.js';
import { Modal } from './overlays.js';

export class PartyBar extends Modal {
  constructor(game, { bartender = null } = {}) {
    super(game, { w: 280, h: 150, title: `Bar · ${bartender?.who?.name || BARTENDER.name}` });
    this.bartender = bartender;
    this.line = 'What can I get you?';
  }
  build() {
    const s = this.game.state;
    const full = PA.tipsyLevel(s) >= PA.PARTY.maxTipsy;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    DRINKS.forEach((d, i) => b.add({ x: this.x + 10 + i * 88, y: this.y + 80, w: 84, h: 18, label: d.label, color: '#8a2a3a', disabled: full, onClick: () => this.order(d.kind) }));
    b.add({ x: this.x + 10, y: this.y + 104, w: 128, h: 18, label: 'Water', color: '#2f6f8a', onClick: () => this.order('water') });
    b.add({ x: this.x + this.w - 138, y: this.y + 104, w: 128, h: 18, label: 'Back', onClick: () => this.close() });
    b.columns = 3;
    b.focus = Math.min(f, b.items.length - 1);
  }
  order(kind) {
    const game = this.game;
    const r = PA.drink(game.state, kind);
    if (!r.ok) {
      this.line = BARTENDER.enough;
      return game.sfx('bad');
    }
    track('party_drink', { kind });
    game.markDirty();
    game.sfx(kind === 'water' ? 'click' : 'coin');
    this.line = kind === 'water' ? BARTENDER.water : r.tipsy >= PA.PARTY.maxTipsy ? BARTENDER.enough : BARTENDER.serve[(game.state.party?.drinks || 0) % BARTENDER.serve.length];
    this.bartender?.say(this.line, 3);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const t = PA.tipsyLevel(s);
    drawText(g, `"${this.line}"`, x + this.w / 2, y + 26, { align: 'center', color: C.text });
    drawText(g, 'Free drinks. They only make things wobblier.', x + this.w / 2, y + 42, { align: 'center', color: C.dim });
    drawText(g, 'Tipsy', x + 92, y + 58, { color: C.dim });
    for (let i = 0; i < PA.PARTY.maxTipsy; i++) rect(g, x + 126 + i * 12, y + 58, 9, 7, i < t ? '#f29cd0' : '#3a3d48');
  }
}
```

Check that `Modal` calls `build()`/`renderBody(g, x, y)` the way `ElevatorPanel` uses them (it does: `ElevatorPanel.build` and
`renderBody`); if `renderBody`'s y is the panel's top, the offsets above leave the title bar clear.

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyScenes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/partyBar.js tests/partyScenes.test.js
git commit -m "The party bar: three drinks at most, then water"
```

---

### Task 13: PartyScene (the hall in play)

**Files:**
- Create: `src/scenes/party.js`
- Modify: `src/scenes/floorScene.js` (constructor: per-NPC `dept`; option `partySummary`; method `showPartySummary`)
- Test: `tests/partyScenes.test.js` (append)

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 9, 10, 11, 12. `FloorScene` hooks: `frontDesk()`, `interactables()`, `interact(t)`, `nextLine()`,
  `drawDark(g)`, `drawMarkers(g, s, now)`, `drawPrompt(g, s, now)`, `drawTimer(g, y)`, `drawClockPanel(g, y, {...})`,
  `drawBanner(g)`, `get music()`, `taskMode`, `this.rng`, `this.time`, `this.cam`, `this.npcs` (`{ a, brain, seed, id }`),
  `this.receptionist`, `this.hrRep`.
- Produces: `new PartyScene(game)`; `scene.finish(result)` (`'done'|'early'`) → `game.set(new FloorScene(game, floor, { arrival: 'elevator', partySummary }))`;
  `DanceBrain` (exported).

- [ ] **Step 1: Write the failing tests** (append to `tests/partyScenes.test.js`)

```js
const { PartyScene, DanceBrain } = await import('../src/scenes/party.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog } = await import('../src/scenes/overlays.js');
const { npcIdentity } = await import('../src/scenes/floorWorld.js');
const { buildFloor } = await import('../src/core/tasks.js');
const E = await import('../src/core/economy.js');

function inHall(clock = { now: DEC10 }) {
  const game = career(12, clock);
  PA.startParty(game.state, 12, clock.now);
  const hall = new PartyScene(game);
  game.set(hall);
  return game;
}

test('the hall: Santa hats, guests you know (with their own roles), six dancers, the bartender and HR', async () => {
  const game = inHall();
  await tick(game, 2);
  expect(game.top).toBeInstanceOf(Dialog); // the CEO's speech on arrival
  game.top.close();
  await tick(game, 2);
  const p = game.top;
  expect(p).toBeInstanceOf(PartyScene);
  expect(p.player.look.hat).toBe('santa');
  expect(p.npcs.length).toBe(E.PARTY.guests);
  expect(p.npcs.filter((n) => n.brain instanceof DanceBrain).length).toBe(6);
  const depts = new Map();
  for (let f = 1; f <= 12; f++) for (const n of buildFloor(f).npcs) depts.set(n.seed, buildFloor(f).dept);
  for (const n of p.npcs) expect(n.a.who.name).toBe(npcIdentity(n.seed, depts.get(n.seed), game.state.cast).name);
  expect(p.receptionist.who.role).toBe('Bartender');
  expect(p.hrRep).toBeTruthy();
  expect(game.state.party.speech).toBe(true);
});

test('an activity: free, pays once; back in the hall its play time counts towards sobering up', async () => {
  const game = inHall();
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  const hall = game.top;
  PA.drink(game.state, 'punch');
  const booth = hall.fl.activities.find((it) => it.activity.game === 'photobooth');
  hall.interact({ kind: 'activity', it: booth });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('party');
  game.top.playT = 150; // a long photo session
  game.top.complete(0.9);
  expect(game.top.result.sp).toBe(PA.activityPay(game.state));
  game.top.finish();
  expect(game.top).toBe(hall);
  expect(PA.tipsyLevel(game.state)).toBe(0); // 150 s of play: the drink wore off
});

test('the bar opens from its counter; the elevator doors ask before leaving early', async () => {
  const game = inHall();
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  const hall = game.top;
  hall.interact({ kind: 'bar', it: hall.fl.bar });
  expect(game.top.constructor.name).toBe('PartyBar');
  game.top.close();
  hall.interact({ kind: 'exit', it: hall.exitItem });
  expect(game.top).toBeInstanceOf(Dialog);
  game.top.action.onClick();
  await tick(game, 2);
  expect(game.state.party).toBe(null);
  expect(game.top).toBeInstanceOf(Dialog); // the summary card on the floor
  expect(game.top.text).toContain('Activities');
});

test('when the time is up the party ends on the floor you came from', async () => {
  const clock = { now: DEC10 };
  const game = inHall(clock);
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  clock.now = DEC10 + E.PARTY.stayS * 1000 + 1;
  await tick(game, 3);
  expect(game.state.party).toBe(null);
  expect(game.state.floor).toBe(12);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyScenes.test.js`
Expected: FAIL: `Cannot find module '../src/scenes/party.js'`.

- [ ] **Step 3: FloorScene changes** (`src/scenes/floorScene.js`)

1. Constructor signature: add `partySummary = null` to the options and `this.partySummary = partySummary;` next to
   `this.homeSummary`.
2. In the NPC map: `npcLook(n.seed, n.dept || this.fl.dept, cast)` and `npcIdentity(n.seed, n.dept || this.fl.dept, cast)`
   (a party guest keeps their own department).
3. In `enter()`, after `if (this.homeSummary) this.showHomeSummary();`: `if (this.partySummary) this.showPartySummary();`.
4. Import `{ PARTY_SUMMARY, PARTY_SUMMARY_TITLE }` from `'../data/party.js'` and add, after `showHomeSummary`:

```js
  /** Back from the Christmas party: one card with how it went. */
  showPartySummary() {
    const sum = this.partySummary;
    this.partySummary = null;
    this.game.push(new Dialog(this.game, { title: PARTY_SUMMARY_TITLE[sum.result] || PARTY_SUMMARY_TITLE.done, w: 320, text: PARTY_SUMMARY(sum) }));
  }
```

- [ ] **Step 4: Implement `src/scenes/party.js`**

```js
// The Christmas party (core/party.js): a FloorScene in the party hall (core/partyHall.js) with a 10-minute wall clock. The
// CEO's speech on arrival (confetti!), guests who are colleagues you know (six dancing), the bar, five free activities
// (MinigameScene mode 'party'), disco lights. Tipsy, the view sways; the elevator doors at the top go back to the office.
import { W, H } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatTime, formatNum } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { isTouch, reducedMotion } from '../engine/platform.js';
import { createRng } from '../core/rng.js';
import * as PA from '../core/party.js';
import { buildPartyHall, partyGuests } from '../core/partyHall.js';
import { SONGS } from '../data/music.js';
import { PARTY_ACTIVITIES, PARTY_LINES, TIPSY_LINES, HR_WATCH_LINES, CEO_SPEECH, CEO_SPEECH_YOU, PARTY_LEAVE, FIRED_JOKE } from '../data/party.js';
import { FloorScene } from './floorScene.js';
import { NpcBrain } from './floorWorld.js';
import { MinigameScene } from './minigameScene.js';
import { Dialog } from './overlays.js';
import { PartyBar } from './partyBar.js';
import { partyLighting, moveDisco } from './partyLights.js';
import { drawNight } from './nightLights.js';
import { Confetti } from './confetti.js';

const PARTY_RED = '#d8343a';
const BARTENDER_SEED = 2412;
const BEAT = 60 / SONGS.xmasparty.bpm;
const TURNS = ['down', 'left', 'down', 'right'];

/** A guest on the dance floor: stays put, bounces on every beat, turns now and then. */
export class DanceBrain extends NpcBrain {
  constructor(actor, fl, seed) {
    super(actor, fl, seed);
    this.beatT = this.rng.float(0, BEAT);
  }
  update(dt) {
    if (this.talkPause > 0) this.talkPause -= dt;
    this.beatT += dt;
    const k = this.beatT / BEAT;
    this.a.moving = false;
    this.a.hop = Math.abs(Math.sin(k * Math.PI)) * 3;
    this.a.dir = TURNS[Math.floor(k / 2) % TURNS.length];
  }
}

export class PartyScene extends FloorScene {
  constructor(game) {
    const s = game.state;
    const year = s.party?.year ?? new Date(game.now()).getFullYear();
    const fl = { ...buildPartyHall(), npcs: partyGuests(s, year) };
    super(game, s.party?.floor ?? s.floor, { arrival: 'entrance', fl });
    this.taskMode = 'party';
    this.leaving = false;
    this.year = year;
    const e = this.fl.entrance;
    this.exitItem = { x: e.x, y: e.y, w: e.w, h: 1 };
    this.player.dir = 'down';
    this.player.setLook({ ...this.player.look, hat: 'santa' });
    // Santa hats for about 60% of the guests; the dancers dance.
    const rng = createRng(year * 31 + 7);
    const dancers = new Set(fl.npcs.filter((n) => n.dancer).map((n) => n.seed));
    for (const n of this.npcs) {
      if (rng.chance(0.6)) n.a.setLook({ ...n.a.look, hat: 'santa' });
      if (dancers.has(n.seed)) n.brain = new DanceBrain(n.a, this.fl, n.seed);
    }
    if (this.hrRep) this.hrRep.who.role = 'HR, watching';
    this.hud.floorLabel = 'Party';
    this.confetti = new Confetti();
    this.hrT = 12;
    this.puffT = 8;
  }

  /** Behind the bar: the bartender (not the receptionist). */
  frontDesk() {
    return { seed: BARTENDER_SEED, uniform: '#1a1a22', role: 'Bartender' };
  }

  get music() {
    return 'xmasparty';
  }

  enter() {
    const game = this.game;
    const s = game.state;
    s.floor = this.floorNo;
    game.audio.play(this.music);
    this.banner = 4;
    this.confetti.burst(W / 2, H / 2, 70);
    const fired = Object.keys(s.fired || {}).length;
    game.toast(fired ? FIRED_JOKE(fired) : `The ${s.corp.name} Christmas party! ${formatTime(PA.partyLeft(s, game.now()))} of fun.`, PARTY_RED);
    if (s.party && !s.party.speech) {
      s.party.speech = true;
      game.markDirty();
      const you = !!s.flags.ceo;
      game.push(new Dialog(game, { title: you ? 'Your speech' : 'The CEO\'s speech', w: 330, text: (you ? CEO_SPEECH_YOU : CEO_SPEECH)(s.corp.name), button: 'Cheers!', onClose: () => this.cheers() }));
    }
  }

  resume() {
    this.game.audio.play(this.music);
  }

  /** The confetti cannon: a big burst and a flash of light. */
  cheers() {
    this.game.sfx('levelup');
    this.confetti.burst(W / 2, H - 40, 120, 1.2);
    this.lighting?.flash?.(0.6, 0.8);
  }

  interactables() {
    return [...super.interactables(), ...this.fl.activities.map((it) => ({ kind: 'activity', it })), { kind: 'bar', it: this.fl.bar }, { kind: 'exit', it: this.exitItem }];
  }

  interact(t) {
    if (!['activity', 'bar', 'exit'].includes(t.kind)) return super.interact(t);
    this.pending = null;
    this.player.path = null;
    const p = this.player;
    if (t.kind === 'exit') return this.askLeave();
    p.faceTowards(t.it.x + t.it.w / 2 - p.x, t.it.y + t.it.h / 2 - p.y);
    if (t.kind === 'bar') {
      this.game.sfx('click');
      return this.game.push(new PartyBar(this.game, { bartender: this.receptionist }));
    }
    this.openActivity(t.it.activity);
  }

  /** Guests talk party; while you are tipsy, they talk about you. */
  nextLine() {
    return this.rng.pick(PA.tipsyLevel(this.game.state) ? TIPSY_LINES : PARTY_LINES);
  }

  openActivity(task) {
    const game = this.game;
    const s = game.state;
    const a = PARTY_ACTIVITIES.find((v) => v.game === task.game);
    const done = PA.activityDone(s, task.game);
    const pays = done ? 'Done tonight: play again just for fun.' : `Free. 1 star or more pays ${formatNum(PA.activityPay(s))} paperclips, once tonight.`;
    game.sfx('click');
    game.push(
      new Dialog(game, {
        title: `${a.where} · ${a.title}`,
        w: 300,
        text: `${a.blurb}\n${pays}`,
        button: 'Later',
        action: { label: done ? 'Again, for fun' : "Let's go", color: PARTY_RED, onClick: () => this.startActivity(task) },
      }),
    );
  }

  startActivity(task) {
    const game = this.game;
    if (!PA.partyActive(game.state, game.now())) return this.finish('done');
    game.push(new MinigameScene(game, task, (result) => this.activityDone(result), { mode: 'party' }));
  }

  /** Back from an activity: its play time counts towards sobering up; a star or more, confetti. */
  activityDone(result) {
    if (!result || this.leaving) return;
    PA.tickParty(this.game.state, result.playS || 0);
    if (result.stars > 0) this.confetti.burst(W / 2, H / 2, 50);
    if (result.gift) this.game.toast('Secret Santa brought you a little Christmas tree for your desk!', C.good);
  }

  update(dt) {
    super.update(dt);
    const game = this.game;
    this.confetti.update(dt);
    if (this.leaving || game.top !== this) return;
    const s = game.state;
    if (!PA.partyActive(s, game.now())) return this.finish('done');
    PA.tickParty(s, dt);
    if (game.input.down('ArrowUp') && this.atDoor()) this.askLeave();
    // Now and then: a puff of confetti over the dance floor, and a word from HR by the bar.
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = this.rng.float(6, 12);
      const d = this.fl.disco;
      this.confetti.burst(Math.round(d.x * TILE - this.cam.x), Math.round(d.y * TILE - this.cam.y), 25, 0.6);
    }
    this.hrT -= dt;
    if (this.hrT <= 0 && this.hrRep) {
      this.hrT = this.rng.float(18, 30);
      this.hrRep.say(this.rng.pick(HR_WATCH_LINES), 4);
    }
  }

  /** Walking up into the elevator doors (the top wall). */
  atDoor() {
    const e = this.fl.entrance;
    const p = this.player;
    return p.x > e.x && p.x < e.x + e.w && p.y < e.y + 1.7;
  }

  askLeave() {
    const game = this.game;
    if (this.leaving || game.top !== this) return;
    game.sfx('click');
    game.push(new Dialog(game, { title: 'Leave the party?', w: 300, text: PARTY_LEAVE(formatTime(PA.partyLeft(game.state, game.now()))), button: 'Stay', action: { label: 'Leave', onClick: () => this.finish('early') } }));
  }

  /** The party is over: back on the floor it started from, with the summary card. */
  finish(result) {
    if (this.leaving) return;
    this.leaving = true;
    const game = this.game;
    const floor = this.floorNo;
    const sum = PA.endParty(game.state, result) || { floor, year: this.year, result, activities: 0, total: PA.ACTIVITY_GAMES.length, sp: 0, drinks: 0, gift: null };
    track('party_end', { result: sum.result, activities: sum.activities, sp: sum.sp, drinks: sum.drinks });
    game.saveNow();
    game.sfx(result === 'early' ? 'door' : 'ding');
    game.set(new FloorScene(game, floor, { arrival: 'elevator', partySummary: sum }));
  }

  /** Tipsy, the world sways (the HUD does not): the camera moves for this frame only. */
  render(g) {
    const t = PA.tipsyLevel(this.game.state);
    const o = t && !reducedMotion() ? PA.sway(t, this.time) : { x: 0, y: 0 };
    this.cam.x += o.x;
    this.cam.y += o.y;
    super.render(g);
    this.cam.x -= o.x;
    this.cam.y -= o.y;
    this.confetti.render(g);
  }

  /** The lights (under markers and the HUD): disco spots, then the disco ball over them; tipsy at 3, a double image. */
  drawDark(g) {
    this.lighting ||= partyLighting(this.fl);
    moveDisco(this.lighting, this.fl.disco, this.time);
    this.lighting.update?.(0);
    drawNight(g, this.lighting, { fade: 1, cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y) }, player: this.player, t: this.time });
    this.drawDiscoBall(g);
    if (PA.tipsyLevel(this.game.state) >= 3) {
      g.save();
      g.globalAlpha = 0.2;
      g.drawImage(g.canvas, 2, 1);
      g.restore();
    }
  }

  drawDiscoBall(g) {
    const d = this.fl.disco;
    const cx = Math.round(d.x * TILE - this.cam.x);
    const cy = Math.round((d.y - 4) * TILE - this.cam.y);
    rect(g, cx, cy - 60, 1, 53, '#9aa1ad');
    const spin = Math.floor(this.time * 8);
    for (let y = -6; y <= 6; y += 2)
      for (let x = -6; x <= 6; x += 2) {
        if (x * x + y * y > 40) continue;
        const lit = ((((x + y) / 2 + spin) % 3) + 3) % 3 === 0;
        rect(g, cx + x, cy + y, 2, 2, lit ? '#ffffff' : '#8a90a0');
      }
    if (spin % 2) rect(g, cx + 5, cy - 5, 1, 1, '#fffbe0');
  }

  /** Activity markers (a gift to open, a tick once done) and the EXIT sign over the elevator doors. */
  drawMarkers(g, s, now) {
    super.drawMarkers(g, s, now);
    const e = this.fl.entrance;
    const ex = Math.round((e.x + e.w / 2) * TILE);
    const w = measureText('EXIT') + 6;
    rect(g, ex - w / 2, e.y * TILE + 2, w, 10, C.border);
    rect(g, ex - w / 2 + 1, e.y * TILE + 3, w - 2, 8, C.goodBtn);
    drawText(g, 'EXIT', ex, e.y * TILE + 3, { align: 'center', color: C.text });
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    for (const it of this.fl.activities) {
      const done = PA.activityDone(s, it.activity.game);
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const y = this.view.itemTop(it) - 16 + bob;
      rect(g, cx - 6, y, 13, 12, C.border);
      rect(g, cx - 5, y + 1, 11, 10, done ? C.goodBtn : PARTY_RED);
      rect(g, cx - 1, y + 12, 3, 2, C.border);
      icon(g, done ? 'check' : 'star', cx - 3, y + 3);
    }
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (!['activity', 'bar', 'exit'].includes(t?.kind)) return super.drawPrompt(g, s, now);
    const a = t.kind === 'activity' ? PARTY_ACTIVITIES.find((v) => v.game === t.it.activity.game) : null;
    const text = a ? a.title : t.kind === 'bar' ? 'Bar' : 'Elevator';
    const sub = a ? (PA.activityDone(s, a.game) ? 'done, play for fun' : 'free') : t.kind === 'bar' ? 'free drinks' : 'leave the party';
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, isTouch() ? 'TAP' : 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
  }

  drawTimer(g, y) {
    const s = this.game.state;
    const done = PA.ACTIVITY_GAMES.filter((k) => PA.activityDone(s, k)).length;
    this.drawClockPanel(g, y, { name: 'CHRISTMAS PARTY', color: PARTY_RED, left: PA.partyLeft(s, this.game.now()), total: PA.PARTY.stayS * 1000, info: `${done}/${PA.ACTIVITY_GAMES.length} done`, infoColor: C.dim });
    return true;
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 4 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, PARTY_RED);
    rect(g, 0, y + 33, W, 1, PARTY_RED);
    drawText(g, 'CHRISTMAS PARTY', W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `${PA.PARTY.stayS / 60} minutes · dance, sing, eat and wrap a gift`, W / 2, y + 23, { align: 'center', color: '#f29cd0' });
    g.globalAlpha = 1;
  }
}
```

Checks while implementing: `Lighting` has `flash(amount, seconds)` and `update(dt)` (engine/lighting.js lines ~150–160: "A
global flash"); call `this.lighting.update(dt)` from `update(dt)` if the flash needs it (the night shift calls
`this.lighting?.update(dt)` in FloorScene.update, which PartyScene inherits, so the `update?.(0)` line in `drawDark` can go).
The `·` in two strings is used elsewhere in the game (HomeScene's banner), so the font has it.

- [ ] **Step 5: Run tests**

Run: `bun test tests/partyScenes.test.js tests/homeScenes.test.js tests/vacationScenes.test.js tests/conduct.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/party.js src/scenes/floorScene.js tests/partyScenes.test.js
git commit -m "PartyScene: the hall in play, the CEO's speech and confetti, dancers, the bar, activities, disco lights, a tipsy sway"
```

---

### Task 14: The invitation, the elevator button, continuing mid-party

**Files:**
- Modify: `src/scenes/floorScene.js` (`enter()`: invitation; `inviteParty`, `startParty`; the `ElevatorPanel` call)
- Modify: `src/scenes/overlays.js` (`ElevatorPanel`: `onParty`)
- Modify: `src/scenes/title.js` (continue: a party under way)
- Test: `tests/partyScenes.test.js` (append)

**Interfaces:**
- Consumes: `inviteDue`, `markInvited`, `startParty`, `partyStatus`, `partyActive`, `endParty` (Task 1); `PARTY_INVITE`,
  `PARTY_REFUSALS` (Task 4); `PartyScene` (Task 13).
- Produces: `FloorScene#inviteParty({ force })`, `FloorScene#startParty({ force })` (async); `ElevatorPanel` option
  `onParty` with a button labelled `'P · Christmas party'`.

- [ ] **Step 1: Write the failing tests** (append)

```js
const { ElevatorPanel } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');

test('in the window, a tower floor opens the invitation once a year; Go now starts the party', async () => {
  const game = career();
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.action.label).toBe('Go now');
  game.top.close();
  game.set(new FloorScene(game, 11));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(FloorScene); // once a year
  const so = game.state.so;
  game.top.inviteParty();
  game.top.action.onClick();
  await tick(game, 2);
  expect(game.state.party).toBeTruthy();
  expect(game.state.so).toBe(so + 1);
  expect(game.top).toBeInstanceOf(Dialog); // the CEO's speech in the hall
});

test('outside the window: no invitation and no party button in the elevator', async () => {
  const game = career(12, { now: new Date(2026, 10, 30, 12).getTime() });
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(FloorScene);
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {}, onParty() {} });
  game.push(panel);
  await tick(game, 1);
  expect(panel.buttons.items.some((b) => b.label === 'P · Christmas party')).toBe(false);
});

test('in the window, after "Later": the elevator\'s party button starts it', async () => {
  const game = career();
  const fs = new FloorScene(game, 12);
  game.set(fs);
  await tick(game, 1);
  game.top.close(); // Later
  let went = false;
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {}, onParty: () => (went = true) });
  game.push(panel);
  await tick(game, 1);
  const b = panel.buttons.items.find((x) => x.label === 'P · Christmas party');
  expect(b).toBeTruthy();
  b.onClick();
  expect(went).toBe(true);
});

test('no invitation on hold, before check-in, or on a night shift', async () => {
  for (const prep of [(s) => (s.conduct.hold = { since: 0 }), (s) => (s.lobby = 'checkin'), (s) => (s.nightShift = { floor: 12, endsAt: DEC10 + 60000 })]) {
    const game = career();
    prep(game.state);
    game.set(new FloorScene(game, 12));
    await tick(game, 1);
    expect(game.top instanceof Dialog && game.top.action?.label === 'Go now').toBe(false);
  }
});

test('continuing a career mid-party: back to the hall while its clock runs (even after 23 December), else it ends', async () => {
  const clock = { now: new Date(2026, 11, 23, 23, 58).getTime() };
  const game = career(12, clock);
  PA.startParty(game.state, 12, clock.now);
  game.saveNow();
  clock.now = new Date(2026, 11, 24, 0, 3).getTime();
  const title = new TitleScene(game);
  game.set(title);
  await title.continueCareer?.();
  await tick(game, 2);
  expect(game.top instanceof PartyScene || game.top instanceof Dialog).toBe(true);
  clock.now += E.PARTY.stayS * 1000;
  const again = new TitleScene(game);
  game.set(again);
  await again.continueCareer?.();
  await tick(game, 2);
  expect(game.state.party).toBe(null);
});
```

Before running: open `src/scenes/title.js` and find the method that holds the "continue" chain (the one with the
`if (s.home) { ... }` block, ~line 100–150). If it is not called `continueCareer`, use its real name in the last test.

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/partyScenes.test.js`
Expected: FAIL (no invitation; `inviteParty` undefined; no party button).

- [ ] **Step 3: Implement**

`src/scenes/floorScene.js`:

1. Imports: `import * as PA from '../core/party.js';` and add `PARTY_INVITE, PARTY_REFUSALS` to the `../data/party.js` import.
2. End of `enter()`:

```js
    // The Christmas party (core/party.js): in December, the Fun Committee's invitation, once a year.
    if (!this.foreign && !this.night && !this.quest && !this.event && PA.inviteDue(s, this.game.now())) this.inviteParty();
```

3. Methods (after `showPartySummary`):

```js
  /** The Fun Committee's invitation (once a year; the elevator keeps a party button until you go). force: any date (dev). */
  inviteParty({ force = false } = {}) {
    const game = this.game;
    const s = game.state;
    PA.markInvited(s, game.now());
    game.markDirty();
    track('party_invite', { action: 'shown' });
    game.push(
      new Dialog(game, {
        title: 'Fun Committee · You are invited!',
        w: 330,
        text: PARTY_INVITE(s.corp.name, PA.PARTY.stayS / 60),
        button: 'Later',
        action: { label: 'Go now', color: '#d8343a', onClick: () => (track('party_invite', { action: 'go' }), this.startParty({ force })) },
      }),
    );
  }

  /** To the party hall (core/party.js startParty pays the year-end bonus). */
  async startParty({ force = false } = {}) {
    const game = this.game;
    if (this.quest || this.event) return game.toast('Finish what you are doing first.', C.warn);
    const r = PA.startParty(game.state, this.floorNo, game.now(), { force });
    if (!r.ok) return game.toast(PARTY_REFUSALS[r.reason] || PARTY_REFUSALS.away, C.warn);
    track('party_start', {});
    game.sfx('door');
    game.saveNow();
    const { PartyScene } = await import('./party.js');
    game.set(new PartyScene(game));
  }
```

4. The elevator: `new ElevatorPanel(game, { onPromote: ..., onTravel: ..., onArchive: ..., onParty: () => this.startParty() })`.

`src/scenes/overlays.js` `ElevatorPanel`:

```js
  /** onArchive: the A button down to the archive...; onParty: the Christmas party's button while this year's is on offer. */
  constructor(game, { onPromote, onTravel, onArchive = null, onParty = null }) {
    const archive = !!onArchive && archiveOpen(game.state);
    const party = !!onParty && PA.partyStatus(game.state, game.now()) === 'available';
    super(game, { w: 320, h: 208 + (archive ? 18 : 0) + (party ? 18 : 0), title: 'Elevator' });
    this.onPromote = onPromote;
    this.onTravel = onTravel;
    this.onArchive = archive ? onArchive : null;
    this.onParty = party ? onParty : null;
  }
```

and in `build()`, after the archive button:

```js
    if (this.onParty) {
      b.add({
        x: gx, y: this.y + 202 + (this.onArchive ? 18 : 0), w: cols * (bw + 2) - 2, h: 14, label: 'P · Christmas party', icon: 'star', color: '#a8242a',
        onClick: () => {
          this.game.pop();
          this.onParty();
        },
      });
    }
```

Import `* as PA from '../core/party.js'` in overlays.js. If the panel has a P hotkey pattern for A (archive), add `P` the same
way; if not, the button is enough.

`src/scenes/title.js`, first in the continue chain (before the archive block):

```js
    // The Christmas party under way: back to the hall while its clock runs (whatever the date), else it is over.
    if (s.party) {
      const PA = await import('../core/party.js');
      if (PA.partyActive(s, this.game.now())) {
        const { PartyScene } = await import('./party.js');
        return this.game.set(new PartyScene(this.game));
      }
      const sum = PA.endParty(s, 'done');
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, sum.floor));
      return this.game.toast(`The Christmas party is over: +${sum.sp} paperclips.`, C.gold);
    }
```

Note: `PartyScene.enter()` only shows the CEO's speech when `party.speech` is false, so continuing does not repeat it.

- [ ] **Step 4: Run tests**

Run: `bun test tests/partyScenes.test.js` then the full suite `bun test`
Expected: PASS; full suite green (fix any test that counted the elevator panel's buttons or height).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/floorScene.js src/scenes/overlays.js src/scenes/title.js tests/partyScenes.test.js
git commit -m "Christmas party trigger: the Fun Committee's invitation in December, the elevator's party button, continuing mid-party"
```

---

### Task 15: Dev helper, docs and screenshots

**Files:**
- Modify: `src/debug.js` (`window.__party`)
- Modify: `tests/devOnly.test.js` (add `__party` wherever `__trip`/`__mg` are listed)
- Modify: `CLAUDE.md`, `public/how-to-play/index.html` (+ `img/party-hall.png`, `img/mg-dance.png`), `public/llms.txt`,
  `src/index.html` (feature list and badge count), `mobile/README.md`

**Interfaces:**
- Consumes: `resetParty`, `drink`, `PARTY` (Task 1), `FloorScene#inviteParty`, `#startParty` (Task 14).

- [ ] **Step 1: Write the failing test**: in `tests/devOnly.test.js`, add `'__party'` to the list of helpers that must exist in
  `src/debug.js` and must be absent from the production bundle (follow how `__trip` is checked there).

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/devOnly.test.js`
Expected: FAIL (`__party` not found in debug.js).

- [ ] **Step 3: Implement `window.__party`** in `src/debug.js` (next to `__home`; import `* as PA from './core/party.js'`):

```js
  /**
   * Debug: the Christmas party, any day of the year, as often as you like. __party() resets this year's party and opens
   * the invitation on your floor; __party('hall') goes straight in; __party('tipsy') goes in with three drinks.
   */
  window.__party = async (mode) => {
    const s = game.state;
    if (!s) return 'no career loaded';
    PA.resetParty(s, game.now());
    if (PA.partyBlock(s)) return `no party: ${PA.partyBlock(s)}`;
    game.saveNow();
    const { FloorScene } = await import('./scenes/floorScene.js');
    const fs = new FloorScene(game, s.floor);
    game.set(fs);
    if (!mode) {
      if (!(game.top instanceof FloorScene)) game.pop(); // the floor's own invitation, if December already opened one
      fs.inviteParty({ force: true });
      return 'the party invitation';
    }
    await fs.startParty({ force: true });
    if (mode === 'tipsy') for (let i = 0; i < PA.PARTY.maxTipsy; i++) PA.drink(s, 'punch');
    return mode === 'tipsy' ? 'at the party, three drinks in' : 'at the party';
  };
```

- [ ] **Step 4: Docs**

- `CLAUDE.md`: a "Christmas party" bullet after "Office conduct" (spec link; window and once-a-year; trigger; `PartyScene`
  hooks; activities and their pay; the bar and sway; Secret Santa decor id `xmas-<year>`; badges; console `__party()`,
  `__party('hall')`, `__party('tipsy')`); add the analytics events (`party_invite {action: shown|go}`, `party_start`,
  `party_activity {game, stars}`, `party_drink {kind}`, `party_end {result, activities, sp, drinks}`) to the Analytics list;
  `TIMED` mention if any.
- `public/how-to-play/index.html`: a "Christmas party" section (when, how to get there, the five activities, the bar's
  wobble, the Secret Santa tree, the badges) with two screenshots taken from the dev server as the guide's other shots are
  (`canvas.toDataURL()` at 480×270, scaled 2× nearest-neighbour to 960×540): `img/party-hall.png` (`__party('hall')`, close
  the speech, stand near the dance floor) and `img/mg-dance.png` (`__mg('dance', 0.3)` on a party, mid-song). Update badge
  counts in the guide.
- `public/llms.txt`: one fact line for the party; the badge count.
- `src/index.html`: add the party to the features list and the `.sr-only` block; update "37 badges" to the new count.
- `mobile/README.md`: under the store release steps, "The game mentions alcohol (the hotel's cocktails, the Christmas party's
  bar): tick infrequent/mild alcohol references in the App Store and Google Play rating questionnaires."

- [ ] **Step 5: Verify**

Run: `bun test` (full suite) and `bun run build`
Expected: all green; the build succeeds. Then on the dev server (`bun run dev`, port 5317 is Martin's; use another port,
e.g. `PORT=5318 bun server.js`): `__party('hall')`, play Dance-Off, have three drinks, check the sway and the double image,
leave by the elevator and see the summary card.

- [ ] **Step 6: Commit**

```bash
git add src/debug.js tests/devOnly.test.js CLAUDE.md public/how-to-play/index.html public/how-to-play/img/party-hall.png public/how-to-play/img/mg-dance.png public/llms.txt src/index.html mobile/README.md
git commit -m "Christmas party: __party() dev helper, the player guide section with screenshots, llms.txt, page features, store rating note"
```

---

## Self-review notes

- Spec coverage: window/once a year (T1), invitation and elevator (T14), stay/leave/summary/continue (T13, T14), hall layout
  and furniture (T10), lighting/disco ball/confetti (T11, T13), Santa hats (T3), music (T4), guests/dancers/HR/speech/fired
  joke (T10, T13), activities and pay (T1, T5–T9), Secret Santa (T1, T2), bar and sway with reduced motion (T1, T9, T12, T13),
  badges (T2), debug (T15), analytics (T9, T12–T14), docs (T15). Not in `COUNTED_GAMES`: the new ids are never added to
  `tasks.js`, and `buffet` already counts.
- Ruling made while planning: the curio lines (`PARTY_QUIPS`, 20 per type) are specified by examples plus a count test
  rather than written out in full; they are content, and Task 4's test enforces them.
- Ruling: the third carol is Good King Wenceslas, not We Wish You a Merry Christmas (3/4 time; the tracker is 4/4 only). The
  spec was updated.
