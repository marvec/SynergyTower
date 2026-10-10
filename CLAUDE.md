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
  throttled autosave to `localStorage['synergytower.save.v1']`, toasts.
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

## Conventions & gotchas

- **No external assets.** Art is drawn in code, music and SFX are synthesized with WebAudio (`src/data/music.js` tracker
  format). This is what makes the game offline-friendly and easy to port.
- **Text uses the bitmap font** (`src/engine/font.js`). Any new non-ASCII character in a string needs a glyph;
  `tests/font.test.js` fails otherwise. Text is ~5 px per char at scale 1, so check that strings fit.
- `input.down/pressed('ArrowUp')` also match WASD. Use `pressedExact` for letter hotkeys.
- Economy numbers live only in `src/core/economy.js`. `tests/economy.test.js` checks that an average 2★ player can
  always afford the next floor. Re-run it after tuning.
- Hallway posters ("YOUR LOGO HERE", `fl.posters` from `placePosters` in `floorgen.js`, drawn into the baked wall rows) are
  sponsorship ad space; interacting shows `SPONSOR_PITCH` from `src/data/sponsors.js`, a placeholder until the contact form exists.
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
- In game: the `>_` desk on every floor opens the terminal; `systemctl isolate levelXX.target` jumps to floor XX.
  On floor 40 (CEO) talking to a colleague offers Fire/Keep (`state.fired`, keyed by NPC seed).
- The terminal reads `input.keySeq()` (ordered raw keys) rather than `typed()` + `pressed`, because characters and Enter
  can land in the same frame (fast typing, or a background tab where rAF is paused).
