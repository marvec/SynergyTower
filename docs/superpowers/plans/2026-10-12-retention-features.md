# Retention Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily stand-up, random office events, a decoratable desk per floor, and badges with a badge wall.

**Architecture:** Four pure core modules (`daily.js`, `events.js`, `desk.js`, `achievements.js`) hold rules and rewards
and are unit-tested. Scene code wires them in: the FloorScene gets a stand-up colleague, an `OfficeEvent` (like
`FloorQuest`) and your desk; new modals `DeskOverlay` and `BadgeWall`; the mini-game host gets a `standup` mode; the game
context checks badges.

**Tech Stack:** Bun 1.3 tests, vanilla ES modules, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-12-retention-features-design.md`

## Global Constraints

- `src/core/` stays DOM-free; numbers in `src/core/economy.js`.
- Floor generation, game assignment, NPC positions unchanged (`tests/floors.test.js` must stay green).
- Strings ASCII only, fit the 480×270 screen at ~5 px/char.
- Old saves load (deserialize shallow merge); `c64/` untouched.

## Review Focus

- Old save without `daily`/`desks`/`badges`/`events`/`stats.soSpent`: loads, no crash, no wrong Bootstrapped badge.
- Stand-up across midnight / several days away: streak resets to 1, never negative.
- Event running when the player opens a mini-game or the elevator: timers pause; fire drill blocks tasks.
- Floor with all colleagues fired (CEO): stand-up and cake rival need an NPC; must degrade gracefully.
- Desk decoration bought on a floor below `maxFloor`: prices use that floor; trophy gate uses that floor's quota.

---

### Task 1: State fields + daily stand-up core

**Files:** Create `src/core/daily.js`, `tests/daily.test.js`; Modify `src/core/state.js`, `src/core/economy.js`.

**Produces:** `dayKey(now)`, `prevDay(key)`, `standupStatus(s, now)`, `standupGame(day)`, `completeStandup(s, game, score, now, rng)`
→ `{ stars, sp, xp, coffee, soGained, streak, levelsGained }`. New state: `daily`, `events`, `desks`, `badges`,
`stats.standups`, `stats.events`, `stats.soSpent`, `stats.coffeeMachine`.

- [ ] Tests first: once a day, streak continues yesterday / resets after a gap, reward amounts, 7th-day SO, locked before check-in.
- [ ] Implement; `bun test` green; commit.

### Task 2: Office events core

**Files:** Create `src/core/events.js`, `tests/events.test.js`; Modify `economy.js`.

**Produces:** `EVENT_KINDS`, `canStartEvent(s, now, ctx)`, `scheduleNext(s, now, rng)`, `availableEvents(fl)`,
`pickEvent(rng, list)`, `eventReward(kind, floor, perks)`, `applyEventResult(s, kind, won, floor)`, `fireExit(fl, px)`.

- [ ] Tests first: scheduling gates, availability per floor, rewards applied and counted, fire exit tiles walkable.
- [ ] Implement; tests green; commit.

### Task 3: Your desk core

**Files:** Create `src/core/desk.js`, `tests/desk.test.js`; Modify `src/core/tasks.js` (`fl.myDesk`), `economy.js` (`DESK_DECOR`, `decorCost`).

**Produces:** `hasDesk(s, floor)`, `deskOf(s, floor)`, `buyDecor(s, floor, id)`, `toggleDecor(s, floor, id)`, `canBuyDecor`.

- [ ] Tests first: myDesk on all 40 floors, reachable, no task/terminal; buy/afford/slot replace/toggle/trophy gate.
- [ ] Implement; tests green (floors test included); commit.

### Task 4: Achievements core

**Files:** Create `src/core/achievements.js`, `tests/achievements.test.js`; Modify `state.js` (soSpent, coffeeMachine counters, old-save soSpent -1).

**Produces:** `BADGES`, `checkBadges(s, now)`.

- [ ] Tests first: representative predicates, idempotence, old-save Bootstrapped, department mastery.
- [ ] Implement; tests green; commit.

### Task 5: Stand-up in the game

**Files:** Modify `floorScene.js`, `minigameScene.js`; Create `src/data/standup.js`.

- [ ] Stand-up colleague marker, dialog, `mode: 'standup'` result panel, enter toast, analytics.
- [ ] Verify in the browser; commit.

### Task 6: Office events in the game

**Files:** Create `src/scenes/officeEvent.js`; Modify `floorScene.js`, `src/engine/audio.js` if a new SFX is needed.

- [ ] Four events with markers/HUD panel, blocking rules, rewards, analytics.
- [ ] Verify each event in the browser (force via `__game.top.startEvent(kind)`); commit.

### Task 7: Desk in the game

**Files:** Create `src/scenes/deskOverlay.js`; Modify `art.js` (`mydesk` furniture, `drawDeskDecor`), `floorWorld.js`, `floorScene.js`.

- [ ] Tidy desk + nameplate + decorations on the floor, overlay with preview and catalogue, marker, analytics.
- [ ] Verify in the browser; commit.

### Task 8: Badge wall

**Files:** Create `src/scenes/badgeWall.js`; Modify `game.js` (checks + toasts), `hud.js` (medal button), `overlays.js` (menu entry), `ui.js` (medal icon).

- [ ] Wall grid, keyboard/mouse selection, toasts, analytics.
- [ ] Verify in the browser; commit.

### Task 9: Docs

**Files:** `CLAUDE.md`, `README.md`, `public/llms.txt`, `src/index.html` (sr-only text), design spec link.

- [ ] Document the features, state fields and analytics events; full `bun test`; commit.
