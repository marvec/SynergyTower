# Coffee Economy Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make coffee a gradual, felt constraint from the first floors instead of a wall at floor 14, by shrinking the pot,
slowing regeneration, charging 1-3 cups by mini-game complexity, and giving simple games longer cooldowns than complex ones.

**Architecture:** All numbers stay in `src/core/economy.js` (pure). A per-game complexity tier (1 simple, 2 medium, 3 complex)
drives both the coffee cost and a cooldown multiplier. `src/core/state.js` charges per task game instead of per floor. A new
pacing test simulates a full 40-floor career on the real generated floors and pins the intended curve. UI copy that quotes
coffee numbers is updated to read from the economy functions.

**Tech Stack:** Bun 1.3 (`bun test`), vanilla ES modules, no dependencies.

**Spec:** Martin's decisions in the conversation of 2026-10-11 (below) amend `docs/superpowers/specs/2026-10-09-synergy-tower-design.md`
§ Currencies/Formulas, which Task 4 updates.

## Global Constraints

- Starting / base coffee pot: **6** (`maxCoffee(f) = 6 + floor(f/5) + 2·mug`).
- Regeneration: **1 cup per 180 s** (Espresso perk still −10% per level).
- Coffee machine: unchanged, **per floor** (`coffee-machine-${floor}`), +3 cups, 15 min cooldown.
- **No coffee rewards** for playing well (no refunds, no bonus cups).
- Task coffee cost: **1-3 by mini-game complexity** (tier table in `economy.js`), independent of floor.
- Cooldowns: **simple games cool down longer, complex games faster.**
- Economy numbers live only in `src/core/economy.js` (CLAUDE.md rule). Core stays pure (no DOM).
- New UI strings must fit the bitmap font (~5 px per char) and use only existing glyphs (`tests/font.test.js`).

## Decisions taken in this plan (please confirm while reviewing)

1. **"Difficulty" = the game's complexity, not the floor.** Each of the 33 games gets a fixed tier. The per-task `difficulty`
   (0..1, rises with floor) keeps tuning the mini-game itself as today. Proposed tiers (11 / 13 / 9 games, average cost 1.94):
   - **1 cup, simple** (reflex or one choice per round): timing, stealth, whack, quiz, jargon, bingo, math, pitch, tailgate, inbox, calendar
   - **2 cups, medium**: typing, compose, memory, simon, order, replyall, meeting, stocks, frogger, karaoke, coffee, expense, plant
   - **3 cups, complex** (puzzles / multi-step / floor quests): spreadsheet, cables, orgchart, fridge, defender, chart, password, feedback, lostpw
2. **Cooldown multipliers 4× / 1.5× / 0.75×** of today's base (`60·1.08^(f-1)` s): floor 1 → 4 min / 1.5 min / 45 s;
   floor 40 → ~80 / ~30 / ~15 min. Simulation: with 2× / 1× / 0.5× a player who always picks the cheapest task needs only
   **44 h** instead of 57 h (cheap games are a loophole, since rewards don't depend on the tier); with 4× / 1.5× / 0.75× it is
   **50 h**, so the loophole shrinks to a mild preference.
3. **HR review costs a flat 2 cups** (was the floor cost); its retry cooldown stays 2× the *base* cooldown.
4. **Existing saves keep their extra coffee** (e.g. 13/7 after the update): no regen until it drops below the new max. No migration.
5. **No floor-based cost increase any more.** Late floors get relatively easier than today (floor 40: ~150 min per floor vs ~250 min),
   early floors harder (floor 5: ~32 min vs ~16 min). Total career length stays ~57 h of play. If late game should keep rising,
   a follow-up could add +1 cost above floor 26 (capped at 3).

Simulated pacing (rotation player, ~105 s per task incl. walking, 2★ average, machine used whenever ready):

| Floor | Today: minutes on floor (waiting) | Proposed: minutes on floor (waiting) |
|---|---|---|
| 1 | 9 (0) | 9 (0) |
| 2 | 11 (0) | 17 (6) |
| 5 | 16 (0) | 32 (16) |
| 10 | 25 (0) | 51 (26) |
| 15 | 51 (17) | 81 (47) |
| 30 | 140 (80) | 117 (57) |
| 40 | 247 (170) | 150 (73) |

## Review Focus

1. **Old save above the new max** (13 cups, max now 7): HUD shows `13/7`, tasks can be started, no negative or NaN values, regen resumes below max. → Task 2 test.
2. **A task without a `game`** (old tests, smoke paths): costs the default tier (2), never `undefined`/NaN. → Task 1 + Task 2 tests.
3. **Floor-quest games** (`feedback`, `lostpw`) charge their 3 cups once, at the TaskCard start, not again at the desk half. → Task 2 test (cost) + Task 3 manual check.
4. **Skipping a tier cooldown with Stock Options** still clears it regardless of length. → Task 2 test.
5. **Coffee-full reminders** use the new regen (pot of 6 refills in 18 min, still above the 5-min minimum). → covered by `tests/reminders.test.js` (uses `E.coffeeRegenMs`), re-run in Task 2.

---

### Task 1: Economy numbers (tiers, cost, cooldown, pot, regen)

**Files:**
- Modify: `src/core/economy.js` (constants block, `coffeeCost`, `stationCooldownMs`, `reviewCooldownMs`, `maxCoffee`, `coffeeRegenMs`)
- Test: `tests/economy.test.js`

**Interfaces:**
- Produces:
  - `GAME_TIER: Record<string, 1|2|3>` (all 33 ids of `ALL_GAMES`)
  - `gameTier(game?: string): 1|2|3` (unknown/undefined → 2)
  - `taskCoffeeCost(game?: string): number` (= tier)
  - `REVIEW_COFFEE = 2`
  - `COOLDOWN_TIER_MULT = { 1: 4, 2: 1.5, 3: 0.75 }`
  - `baseCooldownMs(floor, perks = {}): number` (today's `stationCooldownMs`)
  - `stationCooldownMs(floor, perks = {}, game?): number` (base × tier multiplier, rounded to whole seconds)
  - `reviewCooldownMs(floor, perks = {})` = `2 × baseCooldownMs`
  - `maxCoffee(floor, perks)` = `6 + floor(f/5) + 2·mug`; `coffeeRegenMs(perks)` = `round(180000·(1 − 0.1·espresso))`
  - **Removed:** `coffeeCost(floor)`

- [ ] **Step 1: Write the failing tests** (append to `tests/economy.test.js`; also change the cooldown line in `requirements grow every floor` to use `baseCooldownMs`)

```js
import { ALL_GAMES } from '../src/core/tasks.js';

test('every mini-game has a complexity tier of 1-3', () => {
  for (const g of ALL_GAMES) expect([1, 2, 3]).toContain(E.GAME_TIER[g]);
  expect(Object.keys(E.GAME_TIER).sort()).toEqual([...ALL_GAMES].sort());
  expect(E.gameTier(undefined)).toBe(2);
  expect(E.gameTier('nope')).toBe(2);
});

test('coffee cost follows the tier; simple games cool down longest', () => {
  expect(E.taskCoffeeCost('quiz')).toBe(1);
  expect(E.taskCoffeeCost('typing')).toBe(2);
  expect(E.taskCoffeeCost('spreadsheet')).toBe(3);
  expect(E.taskCoffeeCost(undefined)).toBe(2);
  for (const f of [1, 20, 40]) {
    const simple = E.stationCooldownMs(f, {}, 'quiz');
    const medium = E.stationCooldownMs(f, {}, 'typing');
    const complex = E.stationCooldownMs(f, {}, 'spreadsheet');
    expect(simple).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(complex);
  }
  expect(E.stationCooldownMs(1, {}, 'quiz')).toBe(240000);
  expect(E.stationCooldownMs(1, {}, 'spreadsheet')).toBe(45000);
  expect(E.reviewCooldownMs(1)).toBe(2 * E.baseCooldownMs(1));
});

test('smaller pot, slower regen', () => {
  expect(E.maxCoffee(1)).toBe(6);
  expect(E.maxCoffee(40)).toBe(14);
  expect(E.maxCoffee(1, { mug: 2 })).toBe(10);
  expect(E.coffeeRegenMs()).toBe(180000);
  expect(E.coffeeRegenMs({ espresso: 5 })).toBe(90000);
});
```

In `requirements grow every floor`, replace `E.stationCooldownMs(f)` / `E.stationCooldownMs(f - 1)` with `E.baseCooldownMs(f)` / `E.baseCooldownMs(f - 1)`.

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/economy.test.js`
Expected: FAIL (`E.GAME_TIER` undefined, `maxCoffee(1)` is 12, …)

- [ ] **Step 3: Implement in `src/core/economy.js`**

Replace `export const coffeeCost = (floor) => 1 + Math.floor((floor - 1) / 13);` with:

```js
/**
 * Mini-game complexity: 1 simple (reflex / one choice per round), 2 medium, 3 complex (puzzles, multi-step, floor quests).
 * It sets the coffee cost (1-3 cups) and the cooldown: simple games are cheap but come back slowly, complex ones the reverse.
 */
export const GAME_TIER = {
  timing: 1, stealth: 1, whack: 1, quiz: 1, jargon: 1, bingo: 1, math: 1, pitch: 1, tailgate: 1, inbox: 1, calendar: 1,
  typing: 2, compose: 2, memory: 2, simon: 2, order: 2, replyall: 2, meeting: 2, stocks: 2, frogger: 2, karaoke: 2, coffee: 2,
  expense: 2, plant: 2,
  spreadsheet: 3, cables: 3, orgchart: 3, fridge: 3, defender: 3, chart: 3, password: 3, feedback: 3, lostpw: 3,
};
export const gameTier = (game) => GAME_TIER[game] || 2;
export const taskCoffeeCost = (game) => gameTier(game);
export const REVIEW_COFFEE = 2;
export const COOLDOWN_TIER_MULT = { 1: 4, 2: 1.5, 3: 0.75 };
```

Replace `stationCooldownMs`, `reviewCooldownMs`, `maxCoffee`, `coffeeRegenMs` with:

```js
export function baseCooldownMs(floor, perks = {}) {
  const base = 60 * 1.08 ** (floor - 1);
  return Math.round(base * (perks.plant ? 0.85 : 1)) * 1000;
}

export function stationCooldownMs(floor, perks = {}, game) {
  return Math.round((baseCooldownMs(floor, perks) * COOLDOWN_TIER_MULT[gameTier(game)]) / 1000) * 1000;
}

export function reviewCooldownMs(floor, perks = {}) {
  return baseCooldownMs(floor, perks) * 2;
}

export function maxCoffee(floor, perks = {}) {
  return 6 + Math.floor(floor / 5) + 2 * (perks.mug || 0);
}

export function coffeeRegenMs(perks = {}) {
  return Math.round(180000 * (1 - 0.1 * (perks.espresso || 0)));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `bun test tests/economy.test.js`
Expected: PASS. (Other test files will fail until Task 2: `coffeeCost` no longer exists.)

- [ ] **Step 5: Commit**

```bash
git add src/core/economy.js tests/economy.test.js
git commit -m "Economy: coffee pot 6, 3-min regen, 1-3 cup cost and cooldown by game complexity"
```

### Task 2: State charges per game

**Files:**
- Modify: `src/core/state.js` (`canStartTask`, `completeTask`, `reviewStatus`)
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `E.taskCoffeeCost(game)`, `E.stationCooldownMs(floor, perks, game)`, `E.REVIEW_COFFEE` (Task 1)
- Produces: `S.canStartTask(s, task, floor, now)` returns `{ ok, reason?, cost }` with `cost = E.taskCoffeeCost(task.game)`;
  `S.reviewStatus(...).cost === E.REVIEW_COFFEE`

- [ ] **Step 1: Update and add tests in `tests/state.test.js`**

Change the shared fixture to a simple game and replace every `E.coffeeCost(1)` (lines 13 and 102):

```js
const task = { id: 'f1-3', game: 'quiz' };
```
- line 13: `expect(s.coffee.value).toBe(start - E.taskCoffeeCost('quiz'));`
- line 19: `expect(S.canStartTask(s, task, 1, E.stationCooldownMs(1, {}, 'quiz') + 1).ok).toBe(true);`
- line 102: `expect(s.coffee.value).toBe(coffee - E.REVIEW_COFFEE);`

Append:

```js
test('complex games cost more coffee and cool down faster', () => {
  const s = fresh();
  const big = { id: 'f1-9', game: 'spreadsheet' };
  expect(S.canStartTask(s, big, 1, 0).cost).toBe(3);
  expect(S.startTask(s, big, 1, 0).ok).toBe(true);
  expect(s.coffee.value).toBe(E.maxCoffee(1) - 3);
  S.completeTask(s, big, 1, 0.7, 0, () => 1);
  expect(S.cooldownLeft(s, big.id, 0)).toBe(E.stationCooldownMs(1, {}, 'spreadsheet'));
  expect(S.canStartTask(s, { id: 'q', game: 'lostpw' }, 1, 0).cost).toBe(3); // floor quests are complex
  expect(S.canStartTask(s, { id: 'x' }, 1, 0).cost).toBe(2); // no game: medium, never NaN
});

test('not enough coffee for a complex game, enough for a simple one', () => {
  const s = fresh();
  s.coffee = { value: 2, updatedAt: 0 };
  expect(S.canStartTask(s, { id: 'a', game: 'cables' }, 1, 0).reason).toBe('coffee');
  expect(S.canStartTask(s, { id: 'b', game: 'quiz' }, 1, 0).ok).toBe(true);
});

test('an old save above the new max keeps its coffee and can still play', () => {
  const s = fresh();
  s.coffee = { value: 13, updatedAt: 0 };
  S.tick(s, 10 * E.coffeeRegenMs());
  expect(s.coffee.value).toBe(13);
  expect(S.startTask(s, task, 1, 10 * E.coffeeRegenMs()).ok).toBe(true);
  expect(s.coffee.value).toBe(12);
});

test('Stock Options skip a long simple-game cooldown', () => {
  const s = fresh();
  S.startTask(s, task, 1, 0);
  S.completeTask(s, task, 1, 0.7, 0, () => 1);
  expect(S.cooldownLeft(s, task.id, 0)).toBe(240000);
  expect(S.skipCooldown(s, task.id, 0).ok).toBe(true);
  expect(S.canStartTask(s, task, 1, 0).ok).toBe(true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun test tests/state.test.js`
Expected: FAIL (`E.coffeeCost is not a function` from `state.js`)

- [ ] **Step 3: Implement in `src/core/state.js`**

```js
// canStartTask
  const cost = E.taskCoffeeCost(task.game);
// completeTask
  s.cooldowns[task.id] = now + E.stationCooldownMs(floor, s.perks, task.game);
// reviewStatus
  const cost = E.REVIEW_COFFEE;
```

(`canStartTask` keeps its `floor` parameter: callers pass it and it may be used again later; it is simply unused for cost now.)

- [ ] **Step 4: Run the whole suite**

Run: `bun test`
Expected: state, economy, reminders PASS. Any remaining failure must only be a UI/scene file still calling `E.coffeeCost` (fixed in Task 3); smoke tests don't load those scenes, so expect all PASS here.

- [ ] **Step 5: Commit**

```bash
git add src/core/state.js tests/state.test.js
git commit -m "State: charge coffee and set cooldowns by the task's game tier; review costs 2"
```

### Task 3: UI copy shows the new costs

**Files:**
- Modify: `src/scenes/floorScene.js:622`, `src/scenes/overlays.js:143`, `src/scenes/elevatorRide.js:116-118`, `src/scenes/statsDialog.js:44-45`, `src/scenes/hud.js:113`

**Interfaces:**
- Consumes: `E.taskCoffeeCost`, `E.stationCooldownMs(floor, perks, game)`, `E.baseCooldownMs`, `E.COOLDOWN_TIER_MULT`, `E.maxCoffee` (Task 1)

- [ ] **Step 1: Prove the leftovers**

Run: `grep -rn "coffeeCost(" src`
Expected: the 4 scene lines above (`floorScene.js`, `elevatorRide.js`, `statsDialog.js` ×2, `hud.js`).

- [ ] **Step 2: Edit**

`src/scenes/floorScene.js:622` (hint bar under the player):
```js
      sub = left > 0 ? `busy ${formatTime(left)}` : `-${E.taskCoffeeCost(t.it.task.game)} coffee`;
```

`src/scenes/overlays.js:143` (TaskCard):
```js
    drawText(g, `Cooldown after play: ${formatTime(E.stationCooldownMs(s.floor, s.perks, t.game))}`, x + 10, y + 100, { color: C.dim });
```

`src/scenes/elevatorRide.js:116-118` (this also fixes the hard-coded `12 + …`):
```js
      ['coffee', `Max coffee ${E.maxCoffee(this.to, s.perks)}, tasks cost 1-3`],
      …
      ['clock', `Task cooldowns: ${Math.max(1, Math.round((E.baseCooldownMs(this.to, s.perks) * E.COOLDOWN_TIER_MULT[3]) / 60000))}-${Math.round((E.baseCooldownMs(this.to, s.perks) * E.COOLDOWN_TIER_MULT[1]) / 60000)} min`],
```

`src/scenes/statsDialog.js:44-45`:
```js
      color: s.coffee.value < 1 ? C.bad : C.text,
      text: `Tasks cost 1-3 coffee: quick games 1, bigger ones 2, the most complex 3. Quick ones take longer to be ready again. Coffee refills by itself over time, and the coffee machine on every floor pours ${E.COFFEE_MACHINE_AMOUNT} free cups now and then.`,
```

`src/scenes/hud.js:113`:
```js
    item('coffee', 'coffee', `${s.coffee.value}/${cmax}`, s.coffee.value < 1 ? C.bad : C.text);
```

- [ ] **Step 3: Verify**

Run: `grep -rn "coffeeCost(" src` → no output. `bun test` → all PASS. `bun run build` → succeeds.

Manual (dev server `bun run dev`, port 5317; restart it after editing shared engine files):
- New career: HUD shows `6/6`; hint under player shows `-1/-2/-3 coffee` per station; TaskCard start button `Start (-N coffee)` and cooldown line differ per game.
- Play a 3-cup task (`__mg` doesn't charge coffee, so use a real station), check `3/6`, then the HUD coffee timer counts from `3:00`.
- Start a floor quest (360 Feedback / Lost Password): coffee drops by 3 once; returning to the desk does not charge again.
- Elevator ride card: "Max coffee 6, tasks cost 1-3" and "Task cooldowns: 1-4 min" on floor 2.
- Clicking the coffee stat: new explanation text fits the dialog.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/floorScene.js src/scenes/overlays.js src/scenes/elevatorRide.js src/scenes/statsDialog.js src/scenes/hud.js
git commit -m "UI: show per-game coffee cost and tiered cooldowns"
```

### Task 4: Pacing regression test + docs

**Files:**
- Create: `tests/pacing.test.js`
- Modify: `docs/superpowers/specs/2026-10-09-synergy-tower-design.md` (§ Coffee bullet, § Formulas), `CLAUDE.md` (Conventions: economy line)

**Interfaces:**
- Consumes: `buildFloor` (`src/core/tasks.js`), `E.maxCoffee`, `E.coffeeRegenMs`, `E.taskCoffeeCost`, `E.stationCooldownMs`, `E.REVIEW_COFFEE`, `E.starQuota`, `E.COFFEE_MACHINE_AMOUNT`, `E.COFFEE_MACHINE_COOLDOWN_S`

- [ ] **Step 1: Write the pacing test**

```js
// Simulates a whole career on the real floors to pin the coffee pacing: gentle start, steady climb, no cheap-game loophole.
import { test, expect } from 'bun:test';
import * as E from '../src/core/economy.js';
import { buildFloor } from '../src/core/tasks.js';

const PLAY_S = 105; // one task incl. walking and result screens
const STEP_S = 10;

/** pick(tasks, ready, t, f) → next task or null. Returns minutes and waiting minutes per floor. */
function career(pick) {
  let t = 0, cups = E.maxCoffee(1), acc = 0, f = 1;
  const machine = {};
  const floors = [];
  const step = (dt) => {
    t += dt;
    acc += dt;
    const max = E.maxCoffee(f), regen = E.coffeeRegenMs() / 1000;
    while (acc >= regen) { acc -= regen; if (cups < max) cups++; }
    if (cups >= max) acc = 0;
  };
  const useMachine = () => {
    if (!(machine[f] > t)) { cups += E.COFFEE_MACHINE_AMOUNT; machine[f] = t + E.COFFEE_MACHINE_COOLDOWN_S; }
  };
  const spend = (cost) => {
    let waited = 0;
    useMachine();
    while (cups < cost) { step(STEP_S); waited += STEP_S; useMachine(); }
    cups -= cost;
    return waited;
  };
  for (f = 1; f <= E.FLOORS; f++) {
    const tasks = buildFloor(f).tasks.map((it) => it.task);
    const ready = {};
    const t0 = t;
    let stars = 0, wait = 0;
    while (stars < E.starQuota(f)) {
      const task = pick(tasks, ready, t, f);
      if (!task) { step(STEP_S); wait += STEP_S; continue; }
      wait += spend(E.taskCoffeeCost(task.game));
      step(PLAY_S);
      stars += 2;
      ready[task.id] = t + E.stationCooldownMs(f, {}, task.game) / 1000;
    }
    wait += spend(E.REVIEW_COFFEE);
    step(PLAY_S + 30);
    floors[f] = { min: (t - t0) / 60, wait: wait / 60 };
  }
  return { hours: t / 3600, floors };
}

// Walks the floor in a fixed order, skipping stations on cooldown.
const rotation = () => {
  let i = 0;
  return (tasks, ready, t) => {
    for (let k = 0; k < tasks.length; k++) {
      const c = tasks[(i + k) % tasks.length];
      if (!(ready[c.id] > t)) { i = (i + k + 1) % tasks.length; return c; }
    }
    return null;
  };
};
// Always plays the cheapest task that is ready.
const cheapest = (tasks, ready, t) =>
  tasks.filter((c) => !(ready[c.id] > t)).sort((a, b) => E.taskCoffeeCost(a.game) - E.taskCoffeeCost(b.game))[0] || null;

const normal = career(rotation());

test('floor 1 needs no waiting; coffee starts to matter on floor 2-5', () => {
  expect(normal.floors[1].wait).toBe(0);
  expect(normal.floors[5].wait).toBeGreaterThan(5);
});

test('time per floor climbs steadily', () => {
  const m = (f) => normal.floors[f].min;
  expect(m(2)).toBeLessThan(m(10));
  expect(m(10)).toBeLessThan(m(30));
  expect(m(30)).toBeLessThan(m(40));
  expect(m(40)).toBeLessThan(240); // no 4-hour floors
});

test('a whole career stays in the intended range', () => {
  expect(normal.hours).toBeGreaterThan(40);
  expect(normal.hours).toBeLessThan(75);
});

test('farming the cheapest games is not a big shortcut', () => {
  expect(career(cheapest).hours / normal.hours).toBeGreaterThan(0.8);
});
```

- [ ] **Step 2: Run it**

Run: `bun test tests/pacing.test.js`
Expected: PASS (simulation before writing the plan: rotation ≈ 57 h, F1 wait 0, F5 ≈ 32 min with 16 waiting, F40 ≈ 150 min; cheapest-first ≈ 50 h → ratio ≈ 0.88). If a bound fails, report the measured numbers instead of loosening it silently.

- [ ] **Step 3: Update the design spec** (`docs/superpowers/specs/2026-10-09-synergy-tower-design.md`)

Coffee bullet:
```
- **Coffee ☕** — energy. Each task costs 1-3 cups by the game's complexity (`GAME_TIER`); it regenerates over real time
  (also while offline). The coffee machine on every floor gives +3 cups on a 15-minute cooldown. Playing well never refunds coffee.
```
Formulas, replace the station cooldown and coffee lines:
```
- Station cooldown: `round(60·1.08^(f-1))` s (1 min → ~20 min) × complexity: simple 4×, medium 1.5×, complex 0.75×.
  The HR review retry waits 2× the base.
- Coffee cost per task: 1 / 2 / 3 cups (simple / medium / complex game); HR review 2. Max coffee `6 + floor(f/5)` (+ perks).
  Regen 1 per 180 s (− perks). `tests/pacing.test.js` simulates a career to keep this curve.
```

- [ ] **Step 4: Update `CLAUDE.md`** (Conventions, the economy line)

```
- Economy numbers live only in `src/core/economy.js`. `tests/economy.test.js` checks that an average 2★ player can
  always afford the next floor, and `tests/pacing.test.js` simulates a 40-floor career for coffee pacing. Re-run both after
  tuning. Coffee cost and cooldown come from the game's complexity tier (`GAME_TIER`); give every new mini-game a tier.
```

- [ ] **Step 5: Full check and commit**

Run: `bun test && bun run build`
Expected: all PASS, build succeeds.

```bash
git add tests/pacing.test.js docs/superpowers/specs/2026-10-09-synergy-tower-design.md CLAUDE.md
git commit -m "Pacing test simulating a whole career; document the coffee rebalance"
```
