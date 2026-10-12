# SynergyTower

A pixel-art, 2.5D (C-Dogs-style oblique top-down) browser game in the spirit of FarmVille / Simpsons: Tapped Out.
You are a new hire climbing a 40-floor corporate tower: walk each floor, do office chores as mini-games, earn
currencies and get promoted floor by floor until you become CEO. Browser-first; a Flutter port may follow.

Design spec: `docs/superpowers/specs/2026-10-09-synergy-tower-design.md` (economy formulas, floors, mini-game list).

## Commands (Bun 1.3, no npm dependencies)

```bash
bun run dev      # dev server with hot reload → http://localhost:5317 (service worker disabled on this port)
bun run build    # static offline-capable build → dist/
bun run preview  # serve dist/ → http://localhost:4317 (service worker active)
bun test         # unit + headless smoke tests (MG=inbox,quiz bun test tests/minigames.test.js for a subset)
```

Port 3000 is taken on Martin's machine by another project (`~/SynologyDrive/work/corporate`). Don't use it, and
don't kill processes you didn't start.

## Architecture

Vanilla ES modules + Canvas 2D at a fixed logical 480×270, integer-scaled with `image-rendering: pixelated`.

| Layer | Path | Rule |
|---|---|---|
| Core logic | `src/core/` | **Pure, no DOM.** economy, state/actions, floor generator, tasks, A*, RNG. Keep it portable (Flutter). |
| Content | `src/data/` | Pure data: departments/titles/NPC lines, corp colours, task titles, music, `mg-*.js` mini-game content. |
| Engine | `src/engine/` | Browser glue: screen, input, audio synth, bitmap font, UI kit, pixel-art baking, mini-game kit. |
| Scenes | `src/scenes/` | title → setup → exterior → floor ⇄ (overlays, mini-game host, elevator ride) → ending. |
| Mini-games | `src/minigames/` | One file per mechanic (33 station games + `review`, the HR performance review), registered in `src/minigames/index.js`. |

- `src/game.js` holds the game context: state, the scene stack (`push`/`pop`/`set`; overlays set `opaque = false`),
  throttled autosave of the career being played (`game.slot`), toasts.
- Scenes import each other with dynamic `import()` where a cycle would otherwise form (floor ⇄ elevator ride ⇄ title).
- The soft currency is **paperclips** (state key and code name `sp`, a leftover from "Synergy Points").
- Promotion gate: stars + level + keycard paperclips make you `ready`; then the HR desk (an `hr` room on every floor) runs the
  `review` mini-game in `mode: 'review'`; `state.reviews[floor]` must be true before the elevator promotes.
- Floors are generated deterministically from the floor number (`buildFloor(n)` is cached). All floors are 40×28 tiles.
  Games are assigned tower-wide (least-used first), so the first `buildFloor` call plans all 40 floors (~20 ms) and changing
  one floor's stations reshuffles later floors; `tests/floors.test.js` checks the spread.
  The elevator lobby sits at a fixed top-centre position. Tests assert that every station is reachable.
- Rendering: the floor tiles are baked once, then walls (per row), furniture and actors are depth-sorted by their base y.
  Furniture art lives in `src/engine/art.js` as draw functions (footprint + `lift` = height above the footprint).

## Mini-game contract

```js
export default { id, name, help, create({ difficulty /*0..1*/, rng, theme: { dept, title }, sfx }) }
// instance: update(dt, input), render(g), done (bool), score (0..1)
```
- The score maps to stars as <0.35 → 0, <0.6 → 1, <0.85 → 2, else 3. A perfect player should reach ≥0.85, a random one ~0.
- Every game needs an overall time limit (≤ ~90 s) and must support keyboard **and** mouse.
- Theme content by `theme.dept`: lobby, support, sales, marketing, it, finance, legalhr, exec.
- Use the helpers in `src/engine/mgkit.js` (backdrop, header, timerBar, monitor, choiceBox, pickChoice, Floaters, Shake, byDiff, finish).
- The host (`src/scenes/minigameScene.js`) owns the countdown, pause/forfeit, coffee and rewards. Mini-games know
  nothing about the economy.
- **Floor quests** (`feedback`, `lostpw`): the module sets `quest: '<kind>'` and `deskHelp`. Starting the task creates a
  `FloorQuest` (`src/scenes/floorQuest.js`) on the FloorScene (find a colleague / search temporary whiteboards against a
  wall-clock timer, G gives up); back at the station the desk half runs in the normal host with `create({ ..., quest })`.
  `create()` must still work without `quest` (smoke tests). `inst.peek()` exposes answers for the perfect-player tests
  in `tests/quests.test.js`.

## C64 port (feature-frozen)

`c64/` is a Commodore 64 port built from the game's own modules (`bun c64/build.js`, see `c64/README.md`). It is
**feature-frozen** since 2026-10-12: new browser features, mini-games and balance changes are not ported to the C64
unless Martin explicitly asks for that. Rules in `c64/CLAUDE.md`.
Its download page is `synergytower.co.uk/c64/` (`src/c64/`, built like `/feedback/`); `bun c64/build.js --publish`
refreshes the committed ZIP of the 8 disk images in `public/c64/`.

## Conventions & gotchas

- **No external assets.** Art is drawn in code, music and SFX are synthesized with WebAudio (`src/data/music.js` tracker
  format). This is what makes the game offline-friendly and easy to port.
- **Text uses the bitmap font** (`src/engine/font.js`). Any new non-ASCII character in a string needs a glyph;
  `tests/font.test.js` fails otherwise. Text is ~5 px per char at scale 1, so check that strings fit.
- `input.down/pressed('ArrowUp')` also match WASD. Use `pressedExact` for letter hotkeys.
- Economy numbers live only in `src/core/economy.js`. `tests/economy.test.js` checks that an average 2★ player can
  always afford the next floor, and `tests/pacing.test.js` simulates a 40-floor career for coffee pacing. Re-run both after
  tuning. Coffee cost and cooldown come from the game's complexity tier (`GAME_TIER`); give every new mini-game a tier.
- Hallway posters: every floor has a "YOUR LOGO HERE" sponsorship spot and a fake ad (`FAKE_ADS`, invented brands) on the
  upper part of the corridor wall, each centred in a wall section (`placePosters` in `floorgen.js`, `posterContent` in
  `floorWorld.js`). Interacting shows `SPONSOR_PITCH` / `adPitch` from `src/data/sponsors.js`, with an "Advertise here"
  button that opens the feedback form on the `sponsor` topic.
- HUD stats are clickable: `Hud.hits` (rebuilt every render) opens `StatsDialog` (`src/scenes/statsDialog.js`) on the matching
  tab. "Games played" = distinct station mini-games in `state.played` (any result counts; `S.gamesPlayed`).
- Feedback form: `openFeedback(context)` in `src/engine/feedback.js` is a DOM overlay (title link, ☰ menu, posters) with
  topics (task idea, bug, sponsorship, other; email required for sponsorship). It lazy-loads
  reCAPTCHA v3 (the only external script) and POSTs to `api/feedback.js`, a Vercel Function (project `well-be/synergy-tower`,
  API only, see `vercel.json`/`.vercelignore`) that verifies the token and emails via Resend. Public keys/URL in `src/config.js`;
  secrets are Vercel env vars (`RECAPTCHA_SECRET`, `RESEND_API_KEY`, `FEEDBACK_TO`, optional `FEEDBACK_FROM`, `ALLOWED_ORIGINS`).
- SEO: meta/Open Graph/JSON-LD and a screen-reader/crawler text block (`.sr-only`) live in `src/index.html`; crawler files
  are `public/robots.txt`, `sitemap.xml` and `llms.txt` (update its facts and game list when content changes).
  `public/og-image.png` (1200×630) is the title screen at 2.5× with the bottom 18 px cropped, captured from the dev server.
- Player guide: `public/how-to-play/index.html`, a static page (no bundling) linked as "Read more..." from the How to play
  dialog (`howToDialog` in overlays.js). Keep its facts in step with economy.js and the features (numbers, controls, game
  list). Screenshots in `img/` are canvas grabs (`canvas.toDataURL()` at 480×270, scaled 2× nearest-neighbour to 960×540)
  from the dev server; mini-games via `__mg`-style pushes on a floor-9 (Customer Support) career, `mg-<id>.png`.
  The dev server serves `public/<dir>/index.html` for folder URLs, like GitHub Pages.
- Analytics: `src/engine/analytics.js` (cookieless, production domain only): Cloudflare Web Analytics for visits, Umami for
  visits + `track(name, data)` events (career_start, task_played, review, promotion, poster_view, feedback_open/sent,
  coffee_click, checkin {stars}, turnstile, trip_start, trip {result: arrived|crashed|late|quit, time, stage}, trip_end {sp, tasks, early}, standup {stars, streak}, office_event {kind, won}, desk_decor {item}, badge {id}, reminders_on, reminder_sent, shop_open, checkout_open, so_purchase {pack, so} from the fake checkout,
  so_spend {on: skip_task|skip_review|refill|perk:<id>, so}, store_click {store: c64|appstore|googleplay} (title-screen badges),
  c64_download / c64_coffee (on /c64/); all with `floor` = maxFloor). `track` is a no-op elsewhere, so tests and the dev server send nothing.
- Lobby check-in (`state.lobby`: `checkin` → `gate` → `done`; saves without it load as `done`): a new hire has 0 coffee and no
  refill. The floor-1 front desk task is always Jargon (`task.checkin`, pre-assigned in `planFloor`), free while checking in;
  completing it fills the pot and starts the refill. The `turnstile` item fills the lobby door: walkable in `fl.walk` so floor
  planning sees everything, closed in the floor scene via `gatedWalk(fl)` until `S.passTurnstile` takes the first cup.
  The receptionist (`fl.receptionist`) stands behind the desk and nudges with speech bubbles.
- Retention features (spec `docs/superpowers/specs/2026-10-12-retention-features-design.md`), each a pure core module
  plus scene code:
  - **Daily stand-up** (`src/core/daily.js`, `state.daily`): once per local day, after check-in, a colleague on the current
    floor (picked by day + floor) has a blue bubble; the favour is a free tier-1 game in `MinigameScene` `mode: 'standup'`
    (no KPI stars, no cooldown) paying double paperclips, +1 coffee and a Stock Option chance (sure on every 7th day in a row).
  - **Office events** (`src/core/events.js` rules, `src/scenes/officeEvent.js` run by the FloorScene like a quest): fire
    drill, printer meltdown, cake, surprise audit. `state.events.nextAt` spaces them 6-10 min apart, 40 s on a floor
    first; timers use scene dt. Force one from the console: `__game.top.startEvent('cake')`.
  - **Your desk** (`src/core/desk.js`, `state.desk`): `fl.myDesk` is picked in `planFloor` without the RNG (floors stay
    unchanged). One collection that moves with you; each floor's shop (`deskOffer`) sells 7 `DESK_DECOR` items (≥3
    stationery) plus its "Nth Floor's Best Employee" trophy (`trophy-N`, needs the quota); prices scale with the floor.
    Old per-floor `desks` saves merge on load. `DeskOverlay` (Shop / Collection tabs); `drawDeskDecor` in art.js.
  - **Badges** (`src/core/achievements.js`, `state.badges`): predicates over the state only; `game.checkBadges()` runs
    every 0.5 s while a FloorScene is on the stack (`inTower`, so never on the title screen). `stats.soSpent` = -1 for saves from before it was counted (never earns "Bootstrapped"). `BadgeWall`
    opens from the HUD medal button and B (not from the menu).
- **Save slots** (spec `docs/superpowers/specs/2026-10-12-save-slots-design.md`): up to `MAX_SLOTS` = 100 careers per
  browser. `src/core/slots.js` (pure, any getItem/setItem storage) keeps each career under `synergytower.slot.<id>` plus an
  index of summaries (`synergytower.slots.v1`) so the picker never parses every save; the old single save
  (`synergytower.save.v1`) moves into the first slot the first time the index is read. `game.careers/loadCareer/newCareer/
  deleteCareer`; Reset career deletes only the career being played. The title loads the last played career (colours,
  music settings); "Continue career" opens `CareerPicker` (`src/scenes/careerPicker.js`, ID badges in a row, last played
  first; Play / Delete (asks twice) / New career / Back). With all slots taken, New career leads to the picker with the
  button disabled. Switching careers mid-game means quitting to the title. Dev servers on other ports are other
  localStorage origins: the save Martin tests with lives on :5317.
- **Office curiosities** (spec `docs/superpowers/specs/2026-10-12-office-curiosities-design.md`): non-gameplay furniture
  reacts to Space/click without focus brackets or prompt (gameplay targets always win; walk-through decor only answers a
  click within reach). `src/core/curios.js` decides (`curioOf`, `closeUpOf`, deterministic `fridgeContents`/`plantInfo`/
  `vendingContents`/`personnelFile`/`playerFile`), text lives in `src/data/curios.js` (quips per furniture type, at least
  20 each, ASCII), and `src/scenes/closeUp.js` draws the fridge, plant, vending machine and HR filing-cabinet close-ups.
  Lines are picked at random with `pickLine` (a shuffle bag per object: all lines before a repeat, never twice in a row);
  closing the fridge, a plant or the vending machine makes the player say one. Stations that are also a close-up get a
  Peek button on the TaskCard. Nothing is saved or paid. A new furniture type needs a `QUIPS` entry (`tests/curios.test.js`).
- **Business trip** (spec `docs/superpowers/specs/2026-10-12-business-trip-design.md`, a secret level): on floors 10 and
  30 the first colleague (`fl.npcs[0]`, `FloorScene.tripNpc`, "Account Manager") teases and offers a one-time trip
  (`state.trips[floor]`: `'missed'` as soon as the car leaves, `'done'` on arrival). `DriveScene` is a Lotus III-style
  pseudo-3D drive (~3 min, checkpoint clock; crash or time-out = missed) over the pure sim in `src/core/drive.js`
  (`buildTrack`, `createDrive`, plus an `autopilot` the tests use for timing). Arriving starts `state.trip` (15-minute
  wall clock) in `ClientOfficeScene` (a FloorScene subclass, `foreign`: no events, stand-up, firing) on the 64×46
  `buildClientFloor` (`src/core/clientFloor.js`, built with floorgen's `createPlanner`, which tower floors share
  byte-for-byte). Its tasks run MinigameScene mode `'trip'` (`completeTripTask`: double paperclips, no KPI stars), its
  brewers use `T.BREWER_KEY` with a 2-minute cooldown; the lobby EXIT leaves at any time. Text in `src/data/trip.js`.
  Console (repeatable, resets the one-time trip): `__trip()` on floor 10/30, `__trip(30)` rides there first,
  `__trip('client')` / `__trip(10, 'client')` skips the drive.
- Reminders: opt-in browser notifications ("Reminders" in Menu > Settings (`SettingsMenu`), offered once via `offerReminders` when a task card
  is closed for lack of coffee). `src/core/reminders.js` (pure, reusable by a native app) lists what finishes while away;
  `src/engine/reminders.js` schedules the soonest one when the tab is hidden and fires only if the tab is still hidden.
  Kept sparse on purpose: ≥5 min away, max 3/day (`localStorage['synergytower.reminders']`), quiet 22:00–08:00, each kind
  once per absence. Closed tabs get nothing (that would need Web Push and a server).
- Payments are **fake** (`FakeCheckout` in `src/scenes/overlays.js`, labelled DEMO). There is no real payment code.
- Service worker (`public/sw.js`): page navigations are network-first (cache only when offline), so another app later
  run on the same localhost port isn't hijacked. Bump `CACHE` when changing caching behaviour.
- `bun --hot` sometimes misses a change to a shared module (seen with `mgkit.js` on SynologyDrive), so the served bundle
  mixes old and new code (`x is not a function` in the browser). Restart `bun run dev` after editing shared engine files.
- Bun's HTML bundler resolves `<link href>` tags, so the manifest and icon links are injected at runtime in `src/main.js`.

## Debugging in the browser console

- `__game`: the game context (`__game.state`, `__game.top`, `__game.push(...)`).
- `__step(frames)`: advance the loop manually (rAF pauses in background tabs).
- `__mg('spreadsheet', 0.7)`: launch any mini-game at a given difficulty (needs a loaded career).
- `__trip()` / `__trip(30)` / `__trip('client')`: the business trip again (resets it), or straight into the client's office.
- In game: the `>_` desk on every floor opens the terminal; `systemctl isolate levelXX.target` jumps to floor XX.
  On floor 40 (CEO) talking to a colleague offers Fire/Keep (`state.fired`, keyed by NPC seed).
- The terminal reads `input.keySeq()` (ordered raw keys) rather than `typed()` + `pressed`, because characters and Enter
  can land in the same frame (fast typing, or a background tab where rAF is paused).
