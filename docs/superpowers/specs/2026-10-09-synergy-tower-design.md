# SynergyTower — Design Spec (v0.1, first playable)

Date: 2026-10-09 · Status: written autonomously under `/goal`; the assumptions are marked so Martin can correct them.

## 1. Intent

A light, funny "corporate climb" game in the spirit of FarmVille and The Simpsons: Tapped Out. The player is a new
employee who walks into a 40-floor corporate tower, completes office chores as mini-games, earns currencies, and gets
promoted floor by floor until they become CEO. Progression is deliberately slow and gets steeper on each floor
(energy, cooldowns, rising requirements), with a premium currency to speed things up. The real-money purchases are fake for now.

**What Martin asked for**
- Browser first, Node/JS with **bun**. A Flutter mobile port may come later.
- Pixel art, 2.5D oblique top-down view like C-Dogs (walls show their front faces).
- The player starts outside, enters the tower at the ground floor and walks the floor plan.
- Controls: cursor keys + Space for action; mouse (click to walk / interact) too.
- Mini-games: attend a meeting, write an email, fix a spreadsheet, … "plenty", across **40 floors**, with all floors and challenges present in the first version.
- Several score types: generic points that convert into bigger points (XP), plus something that represents corporate standing.
- Music. Works offline. Fake real-money purchases ("click Pay").
- Moving up is tough and gets tougher.
- Floors have real office rooms (kitchen, meeting rooms, …); **every floor has the same dimensions**.
- At the start: choose a corporation name and a theme colour modelled on major corporations.

**My assumptions** (correct me if any are wrong)
- No external image or audio assets: all pixel art is defined in code as palette-mapped string sprites, and all music
  and SFX are synthesized with WebAudio. This keeps the game offline-friendly and easy to port.
- Single player, local save (localStorage). No accounts, no server.
- English UI.
- Theme colours are inspired by corporate palettes but use generic names, not trademarks.

## 2. Platform & architecture

- **Runtime/tooling:** Bun 1.3. `bun run dev` runs `server.js` (Bun.serve + HTML import, hot reload, port 5317).
  `bun run build` → static `dist/` (`bun build ./src/index.html` + copy `public/`). `bun run preview` serves `dist/`
  on port 4317. `bun test` runs the unit and smoke tests.
- **No framework.** Vanilla ES modules + Canvas 2D at a logical resolution of 480×270, integer-scaled, `image-rendering: pixelated`.
- **Offline:** the service worker (`public/sw.js`) caches the app shell. Navigations are network-first with a cache fallback,
  and assets are stale-while-revalidate. It is registered only outside the dev server. There is a web app manifest and an SVG icon.
- **Port-friendly layering** (keeps a Flutter port mechanical):
  - `src/core/` — pure logic, no DOM: economy formulas, progression, save state, RNG, floor generation, task assignment.
  - `src/data/` — pure content: departments, titles, quiz banks, phrases, NPC lines, sprite pixel maps, music patterns.
  - `src/engine/` — browser glue: canvas/renderer, input (keyboard + pointer), audio synth, sprite baking, UI kit.
  - `src/scenes/` — title, corp setup, exterior intro, floor, mini-game host, elevator, shop/perks overlays, ending.
  - `src/minigames/` — one module per mechanic, all implementing the same interface.

### Mini-game interface
```js
export default {
  id: 'inbox', name: 'Inbox Triage',
  create({ difficulty, rng, theme, corpColor }) → instance
}
instance.update(dt, input)   // input: { pressed(key), down(key), pointer:{x,y,clicked,down} }, coordinates in game px
instance.render(g)           // g = 2D context, game area 480×270 (host draws the frame/HUD)
instance.done                // boolean
instance.score               // 0..1 performance → stars: <0.35 → 0, <0.6 → 1, <0.85 → 2, else 3
instance.help                // one-line instructions (shown on intro card)
```
The host owns intro/result cards, the timer frame, coffee charge and rewards. Mini-games know nothing about the economy.

## 3. World

- **Exterior intro:** a street with the tall tower (40 window rows). The player walks right to the revolving door and presses Space.
- **Floors:** 1 (ground: Lobby & Mailroom) … 40 (CEO Penthouse). Fixed 40×28 tiles (16 px each).
- **Layout generator** (deterministic, seeded by floor): outer walls; a horizontal corridor across the middle; the top and bottom
  bands are split into rooms by seeded vertical walls, and each room has a door onto the corridor. The elevator lobby is at a
  fixed top-centre position on every floor. Room types: open-plan desks, kitchen, meeting room(s), manager office, copy room,
  restrooms, a department room (server room / trading desk / archive / studio …).
- **Departments** (5 floors each; carpet colour and decor per department): Lobby & Mailroom · Customer Support · Sales ·
  Marketing · IT · Finance · Legal & HR · Executive Suite.
- **Job titles:** one per floor, from "Unpaid Intern" (1) to "Chief Executive Officer" (40).
- **NPC colleagues** wander between rooms (random walk on walkable tiles) and say department-flavoured one-liners when the
  player talks to them (Space/click). Each has a deterministic name and role (from the NPC seed), shown on top of the bubble.
- **Workstation terminal:** on every floor one desk without a task (marked `>_`) opens a fake Linux shell
  (`src/core/terminal.js`: virtual file system, ~70 joke commands, history, Tab completion). Secret:
  `systemctl isolate levelXX.target` rides the elevator straight to floor XX (01-40); going above your highest floor makes it
  your new highest floor, with no fee and no review. Hints: `ls -a` → `.bash_history`, `/etc/motd`, `man systemctl`,
  `systemctl list-units --type=target`.
- **CEO powers:** once you reach floor 40 (highest floor = 40), talking to any colleague on any floor opens a Personnel
  Decision dialog: Fire or Keep. A fired colleague picks up a cardboard box, walks to the elevator (floor 1: out of the front
  door) and never returns (`state.fired[npcSeed]`); their desk stash of 5-60 paperclips goes to you.
- **Rendering:** a tile pass (floor, then wall tops/front faces), then y-sorted sprites (furniture, NPCs, player), then
  station markers ("!" when ready, a clock when cooling down), then the HUD.

## 4. Mini-games (33 mechanics, themed per department → hundreds of task variants)

| id | Name (default theme) | Mechanic |
|---|---|---|
| inbox | Inbox Triage | Emails slide in; sort to Reply / Archive / Spam (←↓→ or click bins). |
| compose | Write the Email | Fill blanks in an email with the right corporate phrase (1-3 / click). |
| typing | Rapid Reply | Type a corporate phrase against the clock (mouse: pick the next letter from tiles). |
| spreadsheet | Fix the Spreadsheet | Grid with row totals; click every wrong total. |
| bingo | Meeting Buzzword Bingo | Buzzwords float by in speech bubbles; catch the ones on your card to complete lines. |
| calendar | Schedule the Meeting | Several attendee calendars; pick the slot free for everyone. |
| timing | Printer Jam / Close the Deal | Warm-up: mash Space/click to fill a draining bar (smash the printer!), then stop the oscillating needle inside the shrinking green zone. |
| memory | Name Badge Memory | Flip pairs of colleague badges. |
| simon | Server Rack Sequence | Repeat the blinking light sequence. |
| math | Expense Report | Add up receipts; choose the correct total. |
| quiz | Small Talk / Compliance | Multiple-choice questions from department banks. |
| order | Slide Deck Order | Put slides/process steps in the right order. |
| whack | Whack-a-Bug | Bugs/notifications pop up; hit them before they escape. |
| stealth | Boss Alert | Alt-tab (Space) when the boss walks by, but not for colleagues. |
| stocks | Quarterly Ticker | Buy low, sell high on a moving chart to hit a profit target. |
| coffee | Coffee Run | Memorise colleagues' orders, then rebuild each one. |
| jargon | Jargon Decoder | The boss says a buzzword ("Let's pin that down"); pick what it really means. Ported from ../corporate. |
| replyall | Reply-All Apocalypse | A reply-all storm multiplies in the inbox; delete the replies before it overflows, keep the real mail. |
| password | Password Policy | Satisfy an ever-growing list of absurd IT password rules at once (typing, or click chunk tiles). |
| cables | Cable Spaghetti | Re-patch tangled colour-coded cables to the matching sockets; never touch PROD. |
| orgchart | Org Chart Shuffle | Place colleagues into the new org chart from logic clues ("Dana reports to the stapler owner"). |
| meeting | Meeting Survival | Keep your eyelids open with coffee, and nod only at the buzzword sentences. |
| pitch | Elevator Pitch | Stop slot-machine reels to build a pitch that matches the CEO's mood of the day. |
| fridge | Fridge Tetris | Pack falling lunch containers into the office fridge; clear shelves, beware the 2019 mystery box. |
| expense | Expense Fraud Detective | Approve or reject receipts; spot the jet ski "team-building". |
| frogger | Coffee Crossing | Frogger across office lanes with a full coffee; collisions spill it. |
| karaoke | PowerPoint Karaoke | An absurd chart appears; pick the narration that matches it before the slide advances. |
| tailgate | Badge Tailgate | Stop badge-less strangers sneaking through the turnstile, let employees pass. |
| defender | Calendar Defender | Lane tower defence: place Declines and Out-of-Office walls to stop meeting invites reaching Focus Time. |
| plant | Desk Plant Survival | Keep the desk plant alive through a compressed quarter: water, blinds, pests. |
| chart | Magic Chart | Mystery sliders, knobs and switches each have a hidden sweet spot; tune them so the chart climbs to the target, three quarters in a row (sweet spots drift on hard). |
| feedback | 360 Feedback | *Floor quest:* find the named colleague on the floor and chat (earlier chats don't count), then fill in their review form from what they said. |
| lostpw | Lost Password | *Floor quest:* mobile whiteboards roll in when the task starts; find the one with your pet's photo before the timer runs out, then log in with its name. |

**Floor quests** (`quest` on the mini-game module, `src/scenes/floorQuest.js`): starting the task keeps you on the floor with
an objective panel and a wall-clock timer (50-80 s by difficulty). Other stations, the HR desk, the terminal and the elevator are
blocked meanwhile; G gives up (0 stars, cooldown applies, coffee not refunded), and so does running out of time. Returning to the
station opens the desk half as a normal mini-game; what you found is passed in as `quest`, plus a speed bonus for time left.

Each task has a difficulty of 0..1 (rising with the floor, plus some per-task variance) that controls speed, count, time limit and
distractors. The department theme changes titles and word lists (e.g. `timing` = "Unjam the Printer" in the Lobby,
"Close the Deal" in Sales, "Deploy Window" in IT).

**Stations per floor:** 8 on floor 1, rising to 14 on floor 40 (`8 + floor((f-1)/6)` capped at 14). Which games a station can
host is set by room fit (meeting room → bingo/calendar/order, desks → most computer games, copy room → timing, kitchen
fridge/table → fridge/frogger/coffee, elevator directory → pitch/tailgate, plants → plant, …); every game has at least one
station type found on (almost) every floor. Assignment is planned tower-wide: each floor takes the games used least so far, so
all 33 games appear by floor 5 and then every ~3 floors, 12-14 floors each, never twice on one floor and at most one floor
quest per floor. No game is held back for later floors; floor-specific specialities can be added on top later.

## 5. Economy & progression

**Currencies / meters**
- **Paperclips** (state key `sp`) — the soft currency, earned from every task. Spent on the elevator keycard fee, perks and Training.
- **Experience (XP) → Seniority Level** — earned from tasks; **Training** (HR) converts paperclips into XP (the "generic points
  into bigger points" exchange). Each floor requires a minimum Seniority Level.
- **KPI Stars ★** — 0-3 per task play, counted per floor. Each floor's promotion needs a star quota. This is the main gate.
- **Stock Options (SO)** — the premium "corporate standing" currency. Start with 5; +1 per promotion, +1 per level-up,
  5% chance on a 3-star play. Bought with (fake) real money. Used to skip cooldowns, refill coffee and buy premium perks.
- **Coffee ☕** — energy. Each task costs 1-3 cups by the game's complexity (`GAME_TIER`); it regenerates over real time
  (also while offline). The coffee machine on every floor gives +3 cups on a 15-minute cooldown. Playing well never refunds coffee.

**Formulas** (f = floor, L = level; all live in `src/core/economy.js` and are unit-tested)
- Task reward: `SP = round(25·1.17^(f-1)·m)`, `XP = round(15·1.15^(f-1)·m)`, with m = [0.3, 1, 1.5, 2.2] for 0-3 stars.
- Star quota: `8 + 2·(f-1)` (floor 1: 8 ★ … floor 40: 86 ★).
- Level required for floor f: `f`. XP to next level: `round(18·1.15^(L-1)·(3+L))`.
- Keycard fee to leave floor f: `round(25·1.17^(f-1)·(2+f))` SP.
- Station cooldown: `round(60·1.08^(f-1))` s (1 min → ~20 min) × complexity: simple 4×, medium 1.5×, complex 0.75×.
  The HR review retry waits 2× the base.
- Coffee cost per task: 1 / 2 / 3 cups (simple / medium / complex game); HR review 2. Max coffee `6 + floor(f/5)` (+ perks).
  Regen 1 per 180 s (− perks). `tests/pacing.test.js` simulates a career to keep this curve.
- Training: 4 SP → 1 XP.
- Skip a cooldown: 1 SO. Refill coffee: 3 SO.

**Perks** (bought with SP, escalating cost, 5 levels each): Bigger Mug (+2 max coffee), Espresso Machine (−10% regen time),
Ergonomic Chair (+8% XP), Second Monitor (+8% SP). Premium (SO): Golden Stapler (+10% SP, single purchase), Corner Office
Plant (−15% cooldowns, single purchase).

**Fake shop:** SO packs (10 / 60 / 140 / 400 for €0.99 / 4.99 / 9.99 / 24.99) go through a fake checkout modal clearly
labelled "DEMO — no real payment". Clicking **Pay** credits the coins.

**HR performance review:** every floor has an HR office. Once stars ≥ quota, level ≥ required and SP ≥ fee, the HR desk
opens a Performance Review mini-game (corporate-answer quiz plus one question about your own stats; pass mark 60%, costs
coffee, a failed review locks for 2× the station cooldown, which Stock Options can skip). Passing is stored per floor.

**Promotion:** at the elevator panel, once stars ≥ quota, level ≥ required, SP ≥ fee and the HR review is passed → pay the fee, play the elevator ride
animation and a fanfare, unlock the next floor and the new title. Unlocked floors can be revisited (good for SP/XP, but stars only count for their own floor).
Clearing floor 40's quota triggers the CEO ending; free play continues after it.

## 6. Controls & UI

- Keyboard: arrows/WASD move, Space/Enter interact or confirm, Esc menu/back, M mute.
- Mouse: click a floor tile to walk there (A* path), click a station/NPC/elevator to walk up and interact, and click HUD buttons.
- HUD: corp name + title, floor, paperclips, Level + XP bar, Coffee (+ regen timer), SO, Stars x/quota, and buttons
  [Shop] [Perks] [Train] [Sound] [Menu].
- Text input (corp/player names) uses a DOM `<input>` overlay; everything else is drawn on the canvas.

## 7. Audio

A tiny WebAudio tracker plays square/triangle/noise channels from note-string patterns: a lobby "elevator bossa", an office groove
per department group, a mini-game tension loop and the promotion fanfare. SFX: blip, coin, good, bad, step, door, elevator ding. Music and
SFX volumes can be toggled; audio starts after the first user gesture (browser policy).

## 8. Save

`localStorage['synergytower.save.v1']`: corp {name, color}, player {name, skin, hair}, floor, maxFloor, sp, xp, level,
so, coffee {value, updatedAt}, starsByFloor, cooldowns {stationId: readyAt}, perks, settings, flags (intro seen, CEO ending).
It autosaves on change (throttled) and on `visibilitychange`. Loading migrates by version.

## 9. Testing

- `bun test`: economy curves (monotonic, positive, every floor reachable), floor generation (same size on every floor; every
  station and the elevator are reachable from the elevator via BFS), task assignment (every floor has the right count, all 17
  mechanics are used somewhere), mini-game smoke tests (every mechanic × several difficulties runs 60 simulated seconds
  with random input against a mock 2D context without throwing, and ends with a score in [0,1]), and save round-trip.
- Manual and browser check: title → setup → exterior → lobby → play a mini-game → promotion.

## 10. Out of scope for v0.1 (YAGNI)

Real payments, accounts/cloud save, multiplayer/visiting friends, building and decorating your own office layout, mobile touch-specific UI
(pointer events already work on touch), localisation, the Flutter port.

## 11. Build order

1. Scaffold: package.json, server, build/preview scripts, index.html, CLAUDE.md, git.
2. Core: rng, economy, save/state, departments/titles data, floor generator, task assignment + tests.
3. Engine: renderer/scaling, input, sprite baking from pixel maps, UI kit, audio synth + music.
4. Scenes: title, setup, exterior, floor (movement, A*, NPCs, stations, elevator), mini-game host, overlays, ending.
5. The 16 mini-games + smoke tests.
6. PWA (manifest, SW), production build, browser verification.
