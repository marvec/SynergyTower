# Retention features: daily stand-up, office events, your desk, badges

Date: 2026-10-12. Status: approved via the session goal (Martin set a `/goal` asking for these four features to be built
without pausing for questions; the decisions below were made by Claude and are open to change).

## Goal

Give players reasons to come back and long-term goals beyond the 40-floor climb:

1. **Daily stand-up**: once a day a colleague asks for a quick favour (a short mini-game) with a daily bonus.
2. **Random office events**: short floor-wide happenings that make floors feel alive and reuse the walking code.
3. **Your desk**: every floor you reach gives you a desk to decorate with paperclip-bought decorations.
4. **Badges**: achievements with a badge wall.

## Global constraints

- Core logic stays pure in `src/core/` (no DOM). Economy numbers go in `src/core/economy.js`.
- No external assets: all art drawn in code. New strings use the bitmap font (ASCII only, ~5 px per char).
- Floor generation must not change: game assignment, NPC positions and item ids stay as they are (saves keep working).
  Your desk is an existing desk picked without consuming the floor RNG.
- Old saves load: new state fields come from `newGame` through `deserialize`'s shallow merge.
- Analytics events (Umami via `track`): `standup {stars, streak}`, `office_event {kind, won}`, `desk_decor {item}`,
  `badge {id}`. Documented in CLAUDE.md and the README privacy list.
- The C64 port is feature-frozen: nothing in `c64/` changes.

## 1. Daily stand-up

- State: `daily: { day: 'YYYY-MM-DD' | null, streak: 0 }`, where `day` is the last local calendar day a stand-up was
  done. `dayKey(now)` uses the local date; `prevDay(key)` gives yesterday.
- Available once the lobby check-in is `done`, once per local day: `standupStatus(s, now)` → `'locked' | 'done' | 'pending'`.
- On the floor scene, one colleague (picked from the floor's NPCs with an RNG seeded by day and floor) carries a blue
  speech-bubble marker. Talking to them opens a dialog: "Got a minute before stand-up? Quick favour: <game name>."
  with "Sure" / "Later".
- The favour is a **tier-1 (quick) mini-game** chosen by the day (`standupGame(day)`), at the difficulty of your current
  floor. It is free: no coffee, no cooldown, no KPI stars, and it never touches a station.
- Any result completes the stand-up. `completeStandup(s, game, score, now, rng)`:
  - paperclips: 2 × the 1-3 star task reward at `maxFloor` (min 1 star, so 0 stars still pays the 1-star amount);
  - XP: the normal task XP for the stars;
  - +1 coffee (`STANDUP_COFFEE`, may exceed the pot like the coffee machine);
  - streak: +1 if the last stand-up was yesterday, else 1;
  - Stock Option: guaranteed on every 7th streak day (`STANDUP_STREAK_SO`), otherwise a 20% chance (`STANDUP_SO_CHANCE`);
  - counts towards `played` (games tried) and `stats.standups`.
- The mini-game host gets a `mode: 'standup'` with its own result panel (bonus list + streak).
- On entering a floor with a pending stand-up: toast "Daily stand-up: <name> is looking for you."

## 2. Random office events

- Pure scheduling in `src/core/events.js`: `state.events = { nextAt }` (wall-clock ms). An event can start when
  `now >= nextAt`, the player has been on the floor for at least `EVENT_MIN_ON_FLOOR_S` (40 s), there is no floor quest
  or event running, and the lobby check-in is done. After an event, `nextAt = now + random(6..10 min)`. A new career
  starts with `nextAt = createdAt + 5 min`.
- `availableEvents(fl, ctx)` filters by what the floor has; `pickEvent(rng, list)` chooses one (equal weights).
- Event timers run on scene `dt`, so they pause while an overlay or mini-game is open.
- Events (`src/scenes/officeEvent.js`, an `OfficeEvent` the floor scene owns, like `FloorQuest`):
  - **Fire drill** (every floor): alarm, red flash. "Fire drill! Get to the fire exit." The exit is the corridor end
    farther from the player (tiles x 1-2 or 37-38, corridor rows), marked with a green EXIT sign and floor chevrons.
    Time limit = walking time × 1.8 + 6 s. Colleagues walk there too. Tasks, the elevator and HR are blocked during the
    drill. In time: paperclips (1-star task reward) + XP; late: "HR noted your absence at the assembly point."
  - **Printer meltdown** (floors with a printer or copier): smoke over the machine, its task is blocked. Kick it 3 times
    (interact) within the limit (walking time × 1.6 + 15 s): paperclips + XP (1-star task reward). Else: "IT opened ticket
    #4711." No penalty.
  - **Cake in the kitchen** (every floor; on the kitchen table or else the counter): a cake appears and one colleague
    races for it. The rival's speed is set so they arrive after walking time × 1.5 + 3 s (minimum 6 s). Reach it first:
    +2 coffee (`EVENT_CAKE_COFFEE`, may exceed the pot). Otherwise "<name> got the last slice."
  - **Surprise audit** (floors with at least 3 tasks): up to 3 random task stations are locked for 90 s (lock marker,
    their task card cannot start). An auditor walks the floor; talking to them ("Cooperate") unlocks everything at once and
    pays XP (2-star task reward). Otherwise the stations unlock when time runs out.
- Rewards come from `eventReward(kind, floor, perks)` in `events.js` and are applied by `applyEventResult(s, kind, won, floor)`,
  which also counts wins in `stats.events[kind]`.

## 3. Your desk

- `planFloor` marks one desk per floor as `fl.myDesk`: the first reachable desk without a task or terminal, preferring
  `desk`, then `headsetdesk`, `tradingdesk`, `bossdesk` (lowest item id). It uses no RNG.
- You have a desk on a floor once you have reached it (`floor <= maxFloor`; floor 1 after check-in). The desk is drawn as a
  tidy desk with a nameplate (your name) once it is yours.
- Interacting opens the **Desk overlay**: a big preview of the decorated desk, and the decoration catalogue.
- Decorations (`DESK_DECOR` in economy.js) have a slot (`left`, `right`, `top`) and a base price that scales with the
  floor (`× 1.17^(floor-1)`, like task rewards):
  sticky notes 15 (top), coffee mug 20 (right), rubber duck 25 (top), desk plant 30 (left), family photo 40 (right),
  cactus 45 (left), desk lamp 75 (left), CEO bobblehead 100 (top), "World's Best Employee" trophy 200 (right; needs the
  floor's KPI star quota met).
- State: `desks: { [floor]: { owned: [ids], show: { left, right, top } } }`. Buying puts it on show in its slot. Owned
  items can be swapped in and out for free.
- Until a desk has a decoration it carries a small "YOUR DESK" marker.

## 4. Badges

- `state.badges = { [id]: unlockedAt }`. `BADGES` in `src/core/achievements.js`: `{ id, name, desc, icon, test(s) }`,
  checked from state alone by `checkBadges(s, now)` → newly unlocked list.
- The game context checks every 0.5 s while a career is loaded and toasts "Badge: <name>" (3+ at once: one summary toast,
  which also covers the first load of an old save).
- Badges (35): first task, check-in, a 3-star task, 25 three-star tasks, 100 tasks, every mini-game tried, floors 10/20/30,
  CEO, floor 10 without spending Stock Options, Lv20, 10 passed HR reviews, a terminal warp, 10 fired, the whole board
  (all floor-40 colleagues) fired, first stand-up, 7-day stand-up streak, 3 fire drills, 3 cakes, 3 printers, an audit,
  a decorated desk, every decoration on one desk, the trophy on show, 25 coffee-machine visits, 1,000,000 paperclips,
  and one per department: 3 stars on every task on its five floors.
- "Without spending Stock Options" needs `stats.soSpent`, counted in skip, refill and SO perks. Saves from before this
  feature load with `soSpent: -1` (unknown), which never earns that badge.
- **Badge wall**: a modal grid (7 × 5) of medals; locked ones are grey with "?". Arrow keys or the mouse select a badge and
  show its name, description and unlock date. Opened from a new HUD button (medal icon) and from the menu.

## Testing

- Unit tests per core module: daily (`dayKey`, streak, rewards, once a day), events (scheduling, availability, rewards),
  desk (`fl.myDesk` on every floor, buy/show/afford/trophy gate), achievements (each predicate family, old-save soSpent).
- Smoke: the existing minigame smoke tests cover the games; the new scenes are checked in the browser on the dev server.
