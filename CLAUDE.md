# SynergyTower

A pixel-art, 2.5D (C-Dogs-style oblique top-down) browser game in the spirit of FarmVille / Simpsons: Tapped Out.
You are a new hire climbing a 40-floor corporate tower: walk each floor, do office chores as mini-games, earn
currencies and get promoted floor by floor until you become CEO. Browser-first, also shipped as iOS/Android apps (Capacitor, `mobile/`) from the same code.

Design spec: `docs/superpowers/specs/2026-10-09-synergy-tower-design.md` (economy formulas, floors, mini-game list).

## Commands (Bun 1.3, no npm dependencies)

```bash
bun run dev      # dev server with hot reload → http://localhost:5317 (service worker disabled on this port)
bun run build    # static offline-capable build → dist/
bun run preview  # serve dist/ → http://localhost:4317 (service worker active)
bun test         # unit + headless smoke tests (MG=inbox,quiz bun test tests/minigames.test.js for a subset)
bun run build:app  # the store apps' bundle → mobile/www (then `cd mobile && npm run sync`, see mobile/README.md)
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
| Mini-games | `src/minigames/` | One file per mechanic (33 station games + `review`, the HR performance review, + `compliance`, the compliance training, + 8 holiday activities for the vacation hotel + 6 home office chores + 4 Christmas party activities: `dance`, `giftwrap`, `carols`, `photobooth`), registered in `src/minigames/index.js`. |

- `src/game.js` holds the game context: state, the scene stack (`push`/`pop`/`set`; overlays set `opaque = false`), the
  pause rule for timed stays (while a scene with `pausesClocks` is on the stack, the PauseMenu or a paused mini-game,
  `S.holdClocks` pushes back the `endsAt` of the trip, holiday, night shift and home office, so pausing costs no time),
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
  The outer wall (every map's top row) stands `OUTER_RISE` px taller than inner walls (`drawWallTile` `outer`): its windows sit
  above a sill, none in the elevator lobby (your flat: only where no furniture stands against it, `FloorView.hasWindow`);
  `drawFloorPlate` puts the floor number ("A" in the archive) left of the elevator. On a night shift `FloorView.setNight`
  re-bakes it with the night outside (title screen colours) and `glassOverlay()` is drawn over the lighting, so the city stays lit.
  Its row canvas grows upwards, so `Lighting` takes `outerRise` (its maps start above row 0) and small maps centre with it.
- Colleagues' figures follow their first name (`WOMEN_NAMES`/`MEN_NAMES` in `src/data/people.js`; other names are
  gender-neutral, either figure by seed): `npcLook` gives a woman a `skirt` (and maybe `tights`), which `bakeCharacter`
  draws as a woman's figure. Dress uniforms and suits with `suit(look, jacket)` (matching skirt, never a tie on a skirt).
  The player picks trousers or a skirt in setup (`state.player.skirt`, kept in the slot summary); `careerLook` gives the
  skirt the corporate colour, matching the jacket from floor 21.
- Every career has its own cast (`state.cast`, set by `newGame`; `S.castOf`): `npcIdentity`/`npcLook(seed, dept, cast)` mix it
  in, so the same seats hold other people per career. The NPC seed stays the key for `fired`/`conduct`; floors don't change.
  Saves from before it load with cast 0, the original colleagues. Pass the cast at every new call site.

## Platforms: website, PWA, iOS/Android apps

One bundle everywhere; `src/engine/platform.js` decides at runtime (`isNative()`, `os()`, `isTouch()`, `isStandalone()`,
`features.tips/shop/storeBadges/serviceWorker`). Never branch on build flags for platform behaviour.
- The apps (`mobile/`, Capacitor 8, see `mobile/README.md`) reach native plugins through `plugin(name)` (the injected
  `window.Capacitor` bridge, so the web bundle stays dependency-free); their npm packages live in `mobile/package.json`
  only. Native projects `mobile/ios`, `mobile/android` are committed; `mobile/www` is built by `scripts/build-app.js`.
- In the app: saves are mirrored to Preferences (`gameStorage()`, restored by `restoreStorage()` at start); reminders are
  local notifications scheduled on going to the background (`engine/reminders.js`, `isExactNotification: false`); the
  tip jar, demo checkout and store badges are hidden (store payment rules); feedback opens the website's /feedback/ page;
  links go through `openExternal()`; Android back = Escape. Use `openExternal`, not `window.open`.
- Phones: `isTouch()` swaps keyboard hints for tap hints (keep both when adding a hint); buttons forgive taps that miss
  by `TOUCH_SLOP` px (`ButtonSet`); the terminal opens the on-screen keyboard via `SoftKeyboard` (an invisible input over
  the canvas, edits diffed into key presses); the body pads for safe areas and `screen.fit` follows the visual viewport;
  portrait phones get a "turn sideways" card (`#rotate`) whose "Play upright" keeps portrait: the game sits at the top
  and `scenes/portraitDock.js` shows the HUD below it as DOM (stats via `dockStats`, the Hud's `actions`, Back = Escape).
  The store apps are landscape-only.
- Privacy policy: `public/privacy/index.html` (static, like the guide; linked from Menu > Settings and the store
  listings). Keep it in step when analytics, the feedback form or anything that leaves the device changes.
- PWA install (`engine/install.js`): the title's "Install app" link runs the browser's saved `beforeinstallprompt`, or on
  iPhone/iPad Safari shows the Add to Home Screen steps; hidden when installed or in the app.

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
  format; covers can use per-bar `bassLine`/`drums`/`comp.pattern`, `leadDouble`, chord `N`, see the header there). This is what makes the game offline-friendly and easy to port.
- **Text uses the bitmap font** (`src/engine/font.js`). Any new non-ASCII character in a string needs a glyph;
  `tests/font.test.js` fails otherwise. Text is ~5 px per char at scale 1, so check that strings fit.
- `input.down/pressed('ArrowUp')` also match WASD. Use `pressedExact` for letter hotkeys.
- Arrow keys in `ButtonSet` dialogs and close-ups move by screen position (`spatialStep`/`arrowStep` in `src/engine/ui.js`: nearest
  item that way, wrapping within the row or column), so any layout of buttons or spots works without a column count.
- Economy numbers live only in `src/core/economy.js`. `tests/economy.test.js` checks that an average 2★ player can
  always afford the next floor, and `tests/pacing.test.js` simulates a 40-floor career for coffee pacing. Re-run both after
  tuning. Coffee cost and cooldown come from the game's complexity tier (`GAME_TIER`); give every new mini-game a tier.
- Hallway posters: every floor has a "YOUR LOGO HERE" sponsorship spot and a fake ad (`FAKE_ADS`, invented brands) on the
  upper part of the corridor wall, each centred in a wall section (`placePosters` in `floorgen.js`, `posterContent` in
  `floorWorld.js`). Interacting shows `SPONSOR_PITCH` / `adPitch` from `src/data/sponsors.js`, with an "Advertise here"
  button that opens the feedback form on the `sponsor` topic.
- HUD stats are clickable: `Hud.hits` (rebuilt every render) opens `StatsDialog` (`src/scenes/statsDialog.js`) on the matching
  tab. "Games played" = distinct mini-games in `state.played` out of `COUNTED_GAMES` (tasks.js: the 33 station games plus the 8 holiday activities and the 6 home chores, ordinary games for the title's count of 47, the Generalist badge, the player guide, `llms.txt` and the page metadata; any result counts; `S.gamesPlayed`).
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
  coffee_click, checkin {stars}, turnstile, trip_start, trip {result: arrived|crashed|late|quit, time, stage, crashes}, trip_end {sp, tasks, early}, vacation_start, vacation_activity {game, stars}, vacation_end {coffee, activities, early}, standup {stars, streak}, office_event {kind, won}, desk_decor {item}, badge {id}, reminders_on, reminder_sent, shop_open, checkout_open, so_purchase {pack, so} from the fake checkout,
  so_spend {on: skip_task|skip_review|refill|perk:<id>, so}, store_click {store: c64|appstore|googleplay} (title-screen badges), ask_out {strike}, compliance_hold, compliance {passed, demoted, fired}, fired_career {reason: training|checkin}, night_start, night_end {sp, tasks, early}, archive_start, archive_enter, archive_end {result: found|timeout|gave_up, left}, archive_handin {stars, levels, sp}, home_start, home_chore {game, stars}, home_call {answered}, home_end {result: done|early|sent_back, lapses, chores}, party_invite {action: shown|go}, party_start, party_activity {game, stars}, party_drink {kind}, party_end {result: done|early, activities, sp, drinks}, install_click {how: prompt|ios}, pwa_prompt, pwa_choice {outcome}, pwa_installed,
  c64_download / c64_coffee (on /c64/); all with `floor` = maxFloor). `track` is a no-op elsewhere, so tests and the dev server send nothing. The apps send Umami events too, tagged `app-ios`/`app-android`.
- Lobby check-in (`state.lobby`: `checkin` → `gate` → `done`; saves without it load as `done`): a new hire has 0 coffee and no
  refill. The floor-1 front desk task is always Jargon (`task.checkin`, pre-assigned in `planFloor`), free while checking in;
  completing it fills the pot and starts the refill. The `turnstile` item fills the lobby door: walkable in `fl.walk` so floor
  planning sees everything, closed in the floor scene via `gatedWalk(fl)` until `S.passTurnstile` takes the first cup.
  The receptionist (`fl.receptionist`) stands behind the desk and nudges with speech bubbles.
- Retention features (spec `docs/superpowers/specs/2026-10-12-retention-features-design.md`), each a pure core module
  plus scene code:
  - **Daily stand-up** (`src/core/daily.js`, `state.daily`): once per local day, after check-in, a colleague on the current
    floor (picked by day + floor, never the trip or vacation colleague) has a blue bubble; the favour is a free tier-1 game in `MinigameScene` `mode: 'standup'`
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
  pseudo-3D drive (~3 min, checkpoint clock; a crash dents the car and spins it out, the 5th (`WRECK_AT`) wrecks it; wreck or time-out = missed) over the pure sim in `src/core/drive.js`
  (`buildTrack`, `createDrive`, plus an `autopilot` the tests use for timing). The car has a radio (bottom left) playing six
  cover versions (`RADIO`/`RADIO_SONGS` in `src/data/radio.js`, transcribed from Martin's `tunes.mp3`, which is not shipped):
  its buttons are labelled with their keys: T (or a click on the radio) tunes to the next (`settings.radio`), M (or its button) switches it off (the music setting); an electric hum (`audio.hum(level)`,
  on the SFX bus) follows the speed. Arriving starts `state.trip` (15-minute
  wall clock) in `ClientOfficeScene` (a FloorScene subclass, `foreign`: no events, stand-up, firing) on the 64×46
  `buildClientFloor` (`src/core/clientFloor.js`, built with floorgen's `createPlanner`, which tower floors share
  byte-for-byte). Its tasks run MinigameScene mode `'trip'` (`completeTripTask`: double paperclips, no KPI stars), its
  brewers use `T.BREWER_KEY` with a 2-minute cooldown; the lobby EXIT leaves at any time. Text in `src/data/trip.js`.
  Console on the dev server (repeatable, resets the one-time trip): `__trip()` on floor 10/30, `__trip(30)` rides there first,
  `__trip('client')` / `__trip(10, 'client')` skips the drive.
- **Vacation** (spec `docs/superpowers/specs/2026-10-13-vacation-design.md`, a secret level): on floor 20 (`VACATION_FLOOR`)
  the first colleague (`FloorScene.bossNpc`, "Your Manager") signs a leave request once per local day for `VACATION_COST`
  (5000) paperclips (`src/core/vacation.js`, `state.vacations.day`; `state.vacation = { endsAt, done, coffee }` during the
  15-minute stay). `HotelScene` (`src/scenes/hotel.js`, FloorScene subclass, `foreign`) runs on `buildHotel()`
  (`src/core/hotel.js`, 48×42): the building at the top (suite, lobby with the EXIT front door in the top wall, restaurant),
  garden with pool, tiki bar and spa cabana, beach, jetty. Water is tile `T_WATER` (not walkable), outdoor floor styles come
  from `fl.ground`, outdoor walls are hedges (`fl.hedgeFrom`), `fl.arrive` is the spawn (mid-lobby, clear of the front door).
  Guests walk `fl.npcWalk` (`NpcBrain` prefers it to `fl.walk`), which keeps them out of the suite. Hotel decor is a curio
  with its own lines (`HOTEL_QUIPS`, read instead of the office `QUIPS` when `fl.hotel`); the reception desk is the
  concierge's (`CONCIERGE_LINES`, a `concierge` target in `HotelScene`; her own person via `frontDesk()`, not the lobby receptionist). Activities are items with
  `it.activity` (not `it.task`) running MinigameScene mode `'vacation'`: free, no paperclips/XP/KPI, ≥1 star pays
  `VACATION_COFFEE` once per activity per stay, on top of the pot (the only coffee past the maximum: everything else pours
  through `S.addCoffee`, which stops at it; a full mug leaves the coffee machine ready, `reason: 'full'`). The 8 holiday games (`sleep`, `buffet`, `beachball`,
  `swim`, `sunbathe`, `cocktail`, `massage`, `sandcastle`) are in `MINIGAMES` but not `STATION_GAMES`/`GAME_TIER`; each has
  a `peek()` for the attentive/idle player tests in `tests/holiday.test.js`. Text in `src/data/vacation.js`, song `tropical`.
- **Night shift** (plan `docs/plans/2026-10-14-2102-feat-night-shift-plan.md`): on floors 5, 15, 25 and 35 (`NIGHT_FLOORS`)
  the first colleague (`FloorScene.nightBoss`, "Your Manager") offers a 10-minute shift once per local day for all four
  floors together (`src/core/nightShift.js`, `state.nightShifts.day`; `state.nightShift = { floor, endsAt, tasks, sp, stars,
  coffee }` while it runs; text in `src/data/nightShift.js`). It is a mode of the ordinary `FloorScene`, not a subclass:
  the live getter `night` (`state.nightShift.floor === floorNo`) makes any path onto that floor (reload, elevator ride,
  warp) the dark, empty floor. Accepting walks everyone (the HR rep too) to the elevator, one ding, the lights out after
  8 s at most (`nightFade`); `src/scenes/nightLights.js` lights it (lamps from `fl.rooms` and the corridor, a light
  around the player; of the ~third that flicker, 1-2 blink (`lampLevel`, at most twice a second) and the rest waver
  (`flickerLevel`: three sines plus rare dips, applied to a baked patch, more towards the edge; `LIGHTING.flicker`)) and the song is `nightshift`. The lighting is
  `src/engine/lighting.js`, DOS-style: the world is drawn unlit, then multiplied by a light buffer quantized to
  `LIGHTING.levels` shades with a 4x4 Bayer dither; static lights are baked once, walls and furniture with `lift` >= 24
  block light on the tile grid (a wall's front face is lit only from the south). Settings in the `LIGHTING` object. Station cooldowns
  are halved (`completeTask` option `cooldownMult`, MinigameScene mode `'night'` → `completeNightTask`; running ones are
  halved at the start) and the floor's machine brews every 2 minutes under its own key (`N.BREWER_KEY`). Closed at
  night: HR, the terminal, floor quests ("CLOSED" tape), stand-ups, events, the coffee break chat. The elevator offers
  "Go home early"; time up ends it once the floor is on top again; both lead to a new daytime `FloorScene` with a
  summary card (`nightSummary`). Not during a hold, trip or holiday, or before check-in. The title's Continue ends an
  expired shift (or one saved on another floor) with a toast.
- **Archive challenge** (`src/core/archive.js`, `state.archive = { done, task }`, text in `src/data/archive.js`, settings in
  `ARCHIVE`; `ambient: null` = the night shift's): on floors 3, 13, 23 and 33 (your highest, not promotion-ready, not asked there before, no hold/trip/holiday/night) HR's usual
  "not promotion-ready" note (`hrNotice`, then `FloorScene.hrDesk`) is followed by an offer to fetch a lost folder.
  Accepted, the `ElevatorPanel` shows an "A" button (`onArchive`, only while `archiveOpen`); `ElevatorRide` to floor 0 is
  `ArchiveScene` (`src/scenes/archive.js`, a FloorScene subclass on the 40x28 `buildArchive()`: one room, rows of tall
  `archivecab` cabinets that block light, the elevator at its usual spot). Lit by `darkLighting` (nightLights.js, the
  night shift's code) with `ARCHIVE.ambient`, optional fog (`ARCHIVE.fog`). The folder's drawer is picked on accepting,
  at least `minFolderDist` of the longest side from the elevator. Searching a drawer takes `searchS` standing still
  (`it.opened` bakes the open sprite, a tick is drawn over the dark). The 5:00 clock (`timeLimitS`) is scene time (pauses with the
  game, not wall-clock); time up or giving up at the elevator drops the task; HR asks once per floor (`asked`, set when the offer is shown, so
  declining or failing is final); leaving with the folder
  keeps it (`task.folder`, a HUD badge) until HR on that floor takes it (`handInFolder`: exactly the missing stars,
  levels, paperclips, then the review as usual; `done[floor]` for good). A save made in the archive (`task.inside`)
  fails on Continue (`resumeArchive`). The night shift and archive clocks share `FloorScene.drawClockPanel`.
- **Home office** (`src/core/home.js`, settings in `E.HOME` (economy.js), text in `src/data/home.js`): on floors 8, 18, 28 and 38
  the first colleague (`FloorScene.homeBoss`, "Your Manager") offers a home office day once per local day for all four floors
  (`state.homeDays.day`), free; not during a hold, before check-in, on a trip/holiday/night shift or in the archive (`homeBlock`).
  `state.home = { floor, endsAt, t, presence, lapses, paid, best, calls, coffee }`: the 10-minute stay (`HOME.stayS`) is wall clock (`endsAt`),
  but the presence meter and the boss's 1-2 video calls run on `t`, play time at home (`tickHome`: HomeScene's own dt, plus each
  chore's play time, `result.playS` from MinigameScene, added with `away` so a call falling due mid-chore rings afterwards with
  its full 20 s). A dry meter or a missed call is a lapse (the meter refills); the computer (`pokeComputer`) refills it and
  answers a ringing call; chores wait while one rings. `HOME.maxLapses` (3) end the day (`sent_back`). `HomeScene`
  (`src/scenes/home.js`, a `foreign` FloorScene subclass) runs on `buildHome()`, a 26x13 flat (kitchen and bathroom left, living
  room right, so no marker sits under the clock panel) smaller than the screen: `FloorScene.camTarget` centres any map that fits
  below the HUD. Chores are items with `it.chore` in MinigameScene mode `'home'` (`completeChore`): 1 coffee, XP and
  `choreSpMult` of a task's paperclips once per chore and stay at 1+ star, never KPI stars; `brew` (the coffee maker) is free,
  pours `brewCoffee` via `S.addCoffee` (capped) with its cooldown (`BREW_KEY`) by stars. The 6 chores (`vacuum`, `dishes`,
  `laundry`, `ironing`, `bath`, `brew`) are in `MINIGAMES` and `COUNTED_GAMES`, not `STATION_GAMES`/`GAME_TIER`; each has a
  `peek()` for `tests/chores.test.js`. Leaving (front door or time up) with fewer than 3 lapses clears the floor's station
  cooldowns (`endHome`); the office floor shows a summary card (`homeSummary`). Badges: Domestic Hero, Always Online, Camera
  Ready (`stats.homeHero/homeOnline/homeCamera`). Furniture quips: `HOME_QUIPS` (`fl.home`), own fridge (`HOME_FRIDGE`).
  Song `homeoffice`. Continue resumes the flat while the day lasts, else ends it.
- **Office conduct** (`src/core/conduct.js`, `state.conduct`, text in `src/data/conduct.js`): on every tower floor one
  colleague (`CD.chatSeed`, never `fl.npcs[0]`; `FloorScene.chatNpc`, kept out of the stand-up pool) opens a `ChatCard`
  (overlays.js: Small talk / Ask for a drink / Bye, HR notes) instead of a bubble. Every ask is a strike (a colleague's
  first answer is a polite no, then colder by strike count); `HOLD_STRIKES` (5, economy.js) start a compliance hold: tasks, the
  elevator, workstations and your desk are taped off (`drawHoldTape`), no events, stand-ups, trips or leave; the HR desk
  offers the `compliance` mini-game (MinigameScene mode `'compliance'`, never on stations, not counted). Passing
  (`COMPLIANCE_PASS_SCORE`) clears the strikes; failing also demotes one floor (`completeTraining`: `maxFloor - 1`, both
  floors' reviews due again, an elevator ride down if you stood on the lost floor). Failing on floor 1 gets you fired:
  `fired`, the career is deleted at once (`fireCareer()` in `src/scenes/fired.js`) and `FiredScene` (the walk out with a
  box) leads back to the title. So does a hold before checking in at reception (`CD.lockedOut`: no badge, HR is beyond
  the turnstiles): reception calls security and 3 s later the career is over (also on loading a career saved like that). Strikes start from zero after the
  training and the drink question stays, so the cycle can repeat on every floor, except with the colleague whose
  ask started the hold (`conduct.reported`): their button is gone for good. Console: `__conduct()` opens the card with a clean record, `__conduct(4)` one ask from the hold,
  `__conduct('hold')` straight to the hold.
- **Christmas party** (spec `docs/superpowers/specs/2026-10-15-christmas-party-design.md`, `src/core/party.js`, settings in
  `E.PARTY` (economy.js), text in `src/data/party.js`): once per career and calendar year, local dates 6-23 December
  (`partyWindow`; `state.parties[year] = 'done'` as soon as it starts). On the first tower FloorScene entered in the window
  (not foreign, not at night, no quest or event) the Fun Committee's invitation opens once a year (`state.partyInvite`,
  `FloorScene#inviteParty`); "Later" leaves a red P button in the `ElevatorPanel` (`onParty`) while it is `available`.
  Blocked (`partyBlock`: `hold`, `badge`, `away` = trip, holiday, night shift, home office, inside the archive).
  `FloorScene#startParty` pays the year-end bonus (1 Stock Option) and sets `state.party = { floor, year, endsAt, t, paid,
  best, sp, drinks, tipsy, soberT, gift, speech }`: 10 minutes of wall clock (`party` is in `TIMED`, so pauses hold it).
  `PartyScene` (`src/scenes/party.js`, a `foreign` FloorScene subclass) on the 44x28 `buildPartyHall()`
  (`src/core/partyHall.js`, floorgen's `createPlanner`): it overrides `interactables`/`interact` (activities, the bar,
  the elevator doors), `frontDesk`, `music` (`xmasparty`), `drawMarkers`/`drawPrompt`/`drawTimer`, `render`/`drawDark`
  (`partyLighting`/`moveDisco` in `src/scenes/partyLights.js`, the disco ball, `Confetti` from `src/scenes/confetti.js`).
  Guests are colleagues you know (`partyGuests`: tower NPCs of floors 1..maxFloor, by year and cast, never the fired, each
  with their own `dept`), the first 6 dance (`DanceBrain`, `Actor.hop`); Santa hats are the look field `hat: 'santa'`;
  the CEO's speech once per party (`party.speech`; yours if you are the CEO). Five activities (`ACTIVITY_GAMES`, MinigameScene
  mode `'party'`, difficulty 0.3, free): `dance` (DJ booth), `giftwrap` (Secret Santa table), `carols` (stage), `buffet` (Christmas dishes for `theme.dept === 'party'`), `photobooth`; each pays
  `activityPay` (twice a 3-star task's paperclips on your highest floor) once per party at 1+ star, never XP, KPI stars or
  coffee. A game timed to a song sets `inst.song` (`dance`: `xmasparty`, `carols`: the carol): the host restarts it with
  `audio.play(song, null, { restart, from: playT })` when play starts or resumes and stops it while paused, so the song
  and the game's clock agree (beat 0 sounds `SONG_LEAD` into play). The new games are not in `COUNTED_GAMES` or `GAME_TIER`. Gift wrapping at 1+ star gives the year's Secret Santa
  desk decoration `xmas-<year>` (`partyGiftId`, never in a shop, `needs: 'party'`). The bar (`PartyBar`, `src/scenes/partyBar.js`):
  three drinks raise `party.tipsy` to `maxTipsy` (3) (then the bartender refuses), water sobers at once, one level wears off per `soberS` (120 s) of
  party play time (`tickParty`); no reward: the hall and party mini-games sway (`sway`, not with `reducedMotion()`) and at 3
  show a double image. Leaving by the elevator doors or time up (`endParty`: `early`/`done`) goes back to the floor it
  started from with a summary card (`showPartySummary`); Continue resumes the hall while it lasts, else ends it with a toast.
  Badges: Party Animal, Tipsy, Designated Driver (`stats.parties/partyTipsy/partyDesignated`). Furniture quips: `PARTY_QUIPS`
  (`fl.party`). Console: `__party()` (this year's party again, the invitation on your floor, any date), `__party('hall')`
  straight in, `__party('tipsy')` in with three drinks.
- Reminders: opt-in browser notifications ("Reminders" in Menu > Settings (`SettingsMenu`), offered once via `offerReminders` when a task card
  is closed for lack of coffee). `src/core/reminders.js` (pure, reusable by a native app) lists what finishes while away;
  `src/engine/reminders.js` schedules the soonest one when the tab is hidden and fires only if the tab is still hidden.
  Kept sparse on purpose: ≥5 min away, max 3/day (`localStorage['synergytower.reminders']`), quiet 22:00–08:00, each kind
  once per absence. Closed tabs get nothing (that would need Web Push and a server).
- Payments are **fake** (`FakeCheckout` in `src/scenes/overlays.js`, labelled DEMO), website only (`features.shop`). There is no real payment code.
- Service worker (`public/sw.js`): page navigations are network-first (cache only when offline), so another app later
  run on the same localhost port isn't hijacked. Bump `CACHE` when changing caching behaviour.
- `bun --hot` sometimes misses a change to a shared module (seen with `mgkit.js` on SynologyDrive), so the served bundle
  mixes old and new code (`x is not a function` in the browser). Restart `bun run dev` after editing shared engine files.
- Bun's HTML bundler resolves `<link href>` tags, so the manifest and icon links are injected at runtime in `src/main.js`.

## Debugging in the browser console

- `__game`: the game context (`__game.state`, `__game.top`, `__game.push(...)`).
- `__step(frames)`: advance the loop manually (rAF pauses in background tabs).
- `__mg('spreadsheet', 0.7)`: launch any mini-game at a given difficulty (needs a loaded career). Dev server only.
- `__trip()` / `__trip(30)` / `__trip('client')`: the business trip again (resets it), or straight into the client's office.
- `__night()` / `__night(15)` / `__night('dark')` / `__night(15, 'dark')`: the night shift again (resets today's), the manager's
  offer on the nearest night floor at or below your highest one, or straight into the dark office.
- `__light()` / `__light('levels', 6)` / `__light('mode', 'tile')` / `__light('fog', true)` / `__light('flash')`: the night
  lighting's settings; the backslash key cycles its view (final, unlit, the light buffer alone).
- `__archive()` / `__archive(23)` / `__archive('down')` / `__archive(13, 'down')`: HR's archive offer again (forgets that
  floor's offer; off an archive floor it goes to the next one up and makes it your highest), or straight down to A.
- `__home()` / `__home(28)` / `__home('flat')` / `__home(18, 'flat')`: the home office again (resets today's), the manager's offer
  on the nearest home floor at or below your highest one, or straight into the flat.
- `__conduct()` / `__conduct(4)` / `__conduct('hold')`: the coffee break chat on this floor with a clean record, one ask away
  from the hold, or straight into the compliance hold.
- `__party()` / `__party('hall')` / `__party('tipsy')`: the Christmas party again on any date (resets this year's), the
  invitation on your floor, straight into the hall, or into the hall three drinks in.
- `__vacation()`: floor 20 with the leave request open, free (no paperclips) and repeatable (resets today's holiday);
  `__vacation('hotel')` goes straight to the hotel, also free.
  Dev server only: it lives in `src/debug.js`, which `main.js` imports unless `__DEV__` is false; the production build
  defines it so (`scripts/buildConfig.js`, checked by `tests/devOnly.test.js`). Put new cheat-like helpers there too.
- In game: the `>_` desk on every floor opens the terminal; `systemctl isolate levelXX.target` jumps to floor XX.
  On floor 40 (CEO) talking to a colleague offers Fire/Keep (`state.fired`, keyed by NPC seed).
- The terminal reads `input.keySeq()` (ordered raw keys) rather than `typed()` + `pressed`, because characters and Enter
  can land in the same frame (fast typing, or a background tab where rAF is paused).
