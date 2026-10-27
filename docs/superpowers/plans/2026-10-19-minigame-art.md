# Mini-game Art Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the 20 placeholder-art mini-games up to the approved in-between style: the Elevator Pitch figure, flat bands, 2 px detail. Deep Tissue, Pool Ball, Sandcastle, Squeaky Clean, Smoke Break and Boss Alert come first, then the rest of the hotel, home office and party sets.

**Architecture:** Two shared engine modules come first:
- `src/engine/figure.js`: the Elevator Pitch figure, moved out of pitch.js and extended with poses, skirt, tie, back view, swimwear and a Santa hat, plus `figureLook()` to turn the career look into a figure look;
- `src/engine/mgart.js`: flat bands, chunky ellipses, cell painters, string-map sprites, and `bake()` for static backgrounds.

The mini-game host passes the player's look into `create()`. Each game then gets a new `render()` ported from its approved mockup in `docs/minigame-visuals/mockups/`. The static scenery is baked once in `create()`; only the moving parts are drawn per frame. Gameplay stays as it is, except for the few constants listed per task.

**Tech Stack:** Bun 1.3 (`bun test`), vanilla ES modules, Canvas 2D at 480x270, no dependencies.

**Spec:**
- `docs/minigame-visuals/README.md`, the approved second pass.
- The images: `docs/minigame-visuals/img/mid-*.png` is the target, `img/current/<id>.png` is today.
- The mockup code: `docs/minigame-visuals/mockups/`.

The review page with Martin's feedback rounds is https://claude.ai/artifact/A8jtkdbfoTJfQ21EainP76. Martin approved the `mid-*` images after three rounds of changes; the first-pass images (without `mid-`) were rejected as too detailed.

## Global Constraints

- **The look:**
  - The approved `mid-*.png` image for the game is the target.
  - People are the Elevator Pitch figure (12x30 cells, flat colours, big head), drawn at 2 px cells (3 px for the Photo Booth pose, 6 px for the Deep Tissue close-up).
  - No dithered gradients and no 1 px noise or speckle: skies, sea, sand and walls are flat bands (`bands()`); objects have 2 px detail and at most a light and a shadow tone.
- **The player's figure follows the career** (`create({ player })`, see Task 2): skin, hair, the trousers/skirt choice, the corporate colour.
  - Trousers: short hair, swim trunks.
  - Skirt: long hair, a swimsuit, or a skirt in the corporate colour.
  - Without `player` (tests, `__mg` before a career loads), use `DEFAULT_PLAYER`.
- **Gameplay:**
  - Hit areas, timings, scoring and `peek()` stay exactly as they are. The only exceptions are the constants a task names under "Gameplay change"; each of those gets a test.
  - The mini-game contract is unchanged (`src/engine/mgkit.js` header, CLAUDE.md "Mini-game contract"): every game still runs without `player` and without `quest`.
- **Performance:** static scenery is drawn once into an offscreen canvas with `bake()` in `create()`; `render()` draws that image plus the moving parts. No per-pixel loops in `render()`.
- **Code and text:**
  - No external assets: everything is drawn in code.
  - Text uses the bitmap font (`drawText`); a new non-ASCII character needs a glyph (`tests/font.test.js`).
  - Match the surrounding code: 2-space indent, single quotes, short comments in Martin's style, no new dependencies.
- **Git and the machine:**
  - Do not touch `src/minigames/karaoke.js`: it has another session's uncommitted edit.
  - Do not use port 3000, and do not kill processes you did not start. Martin's dev server is on :5317; use `PORT=5391 bun server.js` for your own.
  - Commit only when Martin asks, and never push without his "push" (pushing main deploys to production).
  - Commit trailers:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01JGTPKxS9GQXYGcwkHC4nFn
    ```
- **The C64 port is feature-frozen:** do not port any of this to `c64/`.

## Review Focus

1. **A game opened before a career is loaded** (`__mg`, tests, the title's demo paths) must render with `DEFAULT_PLAYER` and never throw on `player` being undefined. Every task's smoke test passes no `player` (`tests/minigames.test.js`).
2. **Moving a hit area** (Deep Tissue `BACK`, Pool Ball `WATER`/`HANDS`, Pressing Matters' crease spawns, Boss Alert `FEET_Y`) must keep the attentive and idle player bots honest: attentive gets 3 stars, idle gets under 1. The bots live in `tests/holiday.test.js`, `tests/chores.test.js` and `tests/roof.test.js` and are re-run in the owning task.
3. **The skirt look in every game that shows the player:** a skirt career must show the skirt or swimsuit colour and long hair, never trunks or a tie. A recorded-colours test in each such task pins this.
4. **Baked backgrounds versus state that changes the scenery:**
   - Sandcastle's built tiers and Squeaky Clean's racked plates must be drawn per frame, not baked.
   - Smoke Break's sky mode must come from `theme`, not wall-clock time.
5. **Text over new busy backgrounds:** every hint line (`drawText` at the bottom) stays readable, on a panel or a flat band. Check it in the per-task visual review against the mockup.

---

## File structure

| File | Responsibility |
|---|---|
| `src/engine/figure.js` (new) | `person()` (the Elevator Pitch figure with poses, views, swimwear, hat), `figureLook()`, `DEFAULT_PLAYER` |
| `src/engine/mgart.js` (new) | `bands`, `cblob`, `cells`, `sprite`, `shade` (re-export), `bake` |
| `src/engine/mgscenery.js` (new, grown by Tasks 5, 7, 12) | Shared scenery: hotel (`hotelFacade`, `palm`, `lounger`, `parasol`), the flat (`subway`, `counter`, `pottedPlant`), the party (`stringLights`, `discoBall`, `xmasTree`, `santaHat`) |
| `src/minigames/pitch.js` | Imports `person` from figure.js (drawing unchanged) |
| `src/scenes/minigameScene.js` | Passes `player` into `create()` |
| `src/minigames/<id>.js` x 20 | New `render()` per mockup; constants only where a task says so |
| `tests/mock-canvas.js` | New `recordingCanvas()` to assert the colours drawn |
| `tests/figure.test.js`, `tests/mgart.test.js`, `tests/minigameArt.test.js` (new) | Figure, kit and per-game art assertions |
| `CLAUDE.md`, `public/how-to-play/img/mg-*.png`, `public/how-to-play/index.html` | Docs, guide screenshots |

Mockup to game map. Port from these files; they draw exactly the approved images:

| Game id | Name | Mockup file (in `docs/minigame-visuals/mockups/`) | Approved image(s) |
|---|---|---|---|
| stealth | Boss Alert | `bossalert.js` (mid branch: `styleIs('mid')`) | `mid-bossalert.png` |
| cigarette | Smoke Break | `cigarette.js` (`handBack`, `handFront`, mid branches) | `mid-cigarette-dusk.png`, `mid-cigarette-night.png` |
| massage | Deep Tissue | `massage2.js` | `mid-massage-trousers.png`, `mid-massage-skirt.png` |
| beachball | Pool Ball | `poolball2.js` (+ `palm` from `poolball.js`) | `mid-poolball-trousers.png`, `mid-poolball-skirt.png` |
| sandcastle | Sandcastle | `sandcastle.js` under `mid()` | `mid-sandcastle.png`, `mid-sandcastle-done.png` |
| dishes | Squeaky Clean | `dishes.js` under `mid()` | `mid-dishes.png` |
| sleep | Counting Sheep | `hotel/sleep.js` | `mid-sleep.png`, `mid-sleep-skirt.png` |
| buffet | Lobster | `hotel/buffet.js` | `mid-buffet.png` |
| swim | Swim to the Buoy | `hotel/swim.js` | `mid-swim.png`, `mid-swim-skirt.png` |
| sunbathe | Golden Brown | `hotel/sunbathe.js` | `mid-sunbathe.png`, `mid-sunbathe-skirt.png` |
| cocktail | Pina Colada | `hotel/cocktail.js` | `mid-cocktail.png` |
| vacuum | Dust Buster | `home/vacuum.js` (cordless stick vacuum) | `mid-vacuum.png` |
| laundry | Separate Cycles | `home/laundry.js` | `mid-laundry.png` |
| ironing | Pressing Matters | `home/ironing.js` (cord from the top of the handle) | `mid-ironing.png` |
| bath | Just Right | `home/bath.js` | `mid-bath.png` |
| brew | Home Brew | `home/brew.js` | `mid-brew.png` |
| giftwrap | Gift Wrapping | `party/giftwrap.js` | `mid-giftwrap.png` |
| photobooth | Photo Booth | `party/photobooth.js` | `mid-photobooth.png`, `mid-photobooth-skirt.png` |
| dance | Dance-Off | `party/dance.js` | `mid-dance.png`, `mid-dance-skirt.png` |
| carols | Carol Karaoke | `party/carols.js` | `mid-carols.png` |

**How to port a mockup:**
1. Copy its drawing functions into the game file, below the `export default`, as the existing games do.
2. Swap the mockup's imports: `kit.js` and `person.js` become `../engine/mgart.js`, `../engine/figure.js` and `../engine/mgscenery.js`. Inside the `mid` style, the mockup's `gradient(...)` calls are `bands()` with the stops and their midpoints, so call `bands()` with the colour list the mockup ends up drawing.
3. Replace the mockup's hard-coded state (a fixed `t`, "3 layers built", `heat 0.6`, a fixed knot position) with the game's live variables, which the mockup was built from: the same names appear in the game's current `render()`.
4. Move everything that never changes into a `bake()` call in `create()`.

**Visual check (every game task, step "Compare with the mockup"):**
1. Run `PORT=5391 bun server.js` in the background and open http://localhost:5391 in a browser (Playwright or Chrome).
2. Continue a career (on a fresh origin, start a new career and check in), then run `__mg('<id>', 0.6)` in the console.
3. After about 4 s, grab the canvas with `document.getElementById('game').toDataURL()` and compare it side by side with the approved image(s).
4. Fix differences in layout, proportions, palette and pixel size. Text that is live game state may differ.
5. Stop the server afterwards.

---

### Task 1: Shared art kit and the figure

**Files:**
- Create: `src/engine/mgart.js`, `src/engine/figure.js`
- Modify: `src/minigames/pitch.js` (delete its local `person()`, import it)
- Modify: `tests/mock-canvas.js` (add `recordingCanvas`)
- Test: `tests/mgart.test.js`, `tests/figure.test.js`

**Interfaces:**
- Produces, in `src/engine/mgart.js`:
  - `bands(g, x, y, w, h, colors: string[])`
  - `cblob(g, cx, cy, rx, ry, color, s = 2)`
  - `cells(g, ox, oy, s) => (cx, cy, w, h, color) => void`
  - `sprite(g, map: string, pal: object, x, y, s = 1, flip = false)`
  - `shade(hex, amt)` (re-exported from art.js)
  - `bake(w, h, draw: (g) => void) => HTMLCanvasElement`
- Produces, in `src/engine/figure.js`:
  - `person(g, x, y, s, look, opts = {})`. opts:
    - `pose`: `'stand' | 'walkA' | 'walkB' | 'armsUp' | 'waveL' | 'waveR' | 'crouch' | 'danceA' | 'danceB'`
    - `view`: `'front' | 'back'`
    - `swim`: `null | 'trunks' | 'suit'`
    - `expr`: pitch's expressions `'neutral' | 'interested' | 'delighted' | 'bored' | 'annoyed' | 'talk' | 'nervous'`, plus `'smile' | 'sing' | 'sleep'`
  - `look`: `{ skin, hair, top, pants, skirt?, tie?, lapel?, collar?, long?, hat?: 'santa', ceo?, brow?, corp? }`
  - `figureLook(careerLook, corp)`: turns a floor/career look plus the corporate colour into a figure look
  - `DEFAULT_PLAYER`: a figure look for when no career is loaded
- Produces, in `tests/mock-canvas.js`: `recordingCanvas(w = 480, h = 270) => { canvas, ctx, calls: { x, y, w, h, fill }[] }`

- [ ] **Step 1: Write the failing tests**

`tests/mgart.test.js`:
```js
// The mini-game art kit: flat bands, chunky ellipses, cell painters, baked backgrounds.
import { test, expect } from 'bun:test';
import { installMockDocument, recordingCanvas } from './mock-canvas.js';
installMockDocument();
const { bands, cblob, cells, bake } = await import('../src/engine/mgart.js');

test('bands splits the height between the colours, top to bottom, no gaps', () => {
  const { ctx, calls } = recordingCanvas();
  bands(ctx, 0, 10, 100, 30, ['#111111', '#222222', '#333333']);
  expect(calls.map((c) => [c.y, c.h, c.fill])).toEqual([[10, 10, '#111111'], [20, 10, '#222222'], [30, 10, '#333333']]);
});

test('cblob paints whole s-pixel rows (chunky edges)', () => {
  const { ctx, calls } = recordingCanvas();
  cblob(ctx, 50, 50, 10, 6, '#abcdef', 2);
  expect(calls.length).toBeGreaterThan(0);
  for (const c of calls) {
    expect(c.h).toBe(2);
    expect(c.w % 4).toBe(0); // symmetric, in 2 px cells
  }
});

test('cells paints in s-pixel cells from an origin', () => {
  const { ctx, calls } = recordingCanvas();
  cells(ctx, 100, 20, 3)(2, 1, 4, 2, '#ff0000');
  expect(calls[0]).toMatchObject({ x: 106, y: 23, w: 12, h: 6, fill: '#ff0000' });
});

test('bake draws once into an offscreen canvas of the given size', () => {
  let n = 0;
  const c = bake(480, 270, () => n++);
  expect(n).toBe(1);
  expect(c.width).toBe(480);
  expect(c.height).toBe(270);
});
```

`tests/figure.test.js`:
```js
// The Elevator Pitch figure, shared by the mini-games: poses, skirt, swimwear, the back view, the career look.
import { test, expect } from 'bun:test';
import { recordingCanvas } from './mock-canvas.js';
const { person, figureLook, DEFAULT_PLAYER } = await import('../src/engine/figure.js');

const LOOK = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55' };
const fills = (calls) => new Set(calls.map((c) => c.fill));

test('the default figure is 12x30 cells: head on top, shoes at the bottom', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 1, LOOK);
  const ys = calls.map((c) => c.y);
  expect(Math.min(...ys)).toBe(0);
  expect(Math.max(...calls.map((c) => c.y + c.h))).toBe(30);
  expect(Math.max(...calls.map((c) => c.x + c.w))).toBe(12);
});

test('a skirt is drawn in its colour; trousers are not', () => {
  const a = recordingCanvas();
  person(a.ctx, 0, 0, 2, { ...LOOK, skirt: '#2f8f7f' });
  expect(fills(a.calls).has('#2f8f7f')).toBe(true);
  const b = recordingCanvas();
  person(b.ctx, 0, 0, 2, LOOK);
  expect(fills(b.calls).has('#2f8f7f')).toBe(false);
});

test('arms up puts the hands above the head', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 100, 2, LOOK, { pose: 'armsUp' });
  const skinTop = Math.min(...calls.filter((c) => c.fill === LOOK.skin).map((c) => c.y));
  expect(skinTop).toBeLessThan(100);
});

test('swimwear: trunks show bare skin on the chest, a suit shows the corporate colour', () => {
  const t = recordingCanvas();
  person(t.ctx, 0, 0, 2, { ...LOOK, corp: '#2f8f7f' }, { swim: 'trunks' });
  expect(fills(t.calls).has(LOOK.top)).toBe(false);
  expect(fills(t.calls).has('#2f8f7f')).toBe(true);
  const s = recordingCanvas();
  person(s.ctx, 0, 0, 2, { ...LOOK, corp: '#2f8f7f', long: true }, { swim: 'suit' });
  expect(fills(s.calls).has('#2f8f7f')).toBe(true);
});

test('the back view shows hair and no eyes', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 2, LOOK, { view: 'back' });
  expect(fills(calls).has('#222')).toBe(false);
  expect(fills(calls).has(LOOK.hair)).toBe(true);
});

test('a Santa hat is red with a white trim', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 2, { ...LOOK, hat: 'santa' });
  expect(fills(calls).has('#d8282e')).toBe(true);
  expect(fills(calls).has('#f4f1e8')).toBe(true);
});

test('figureLook: a skirt career gets long hair and the skirt; a jacket becomes the top with shirt lapels', () => {
  const skirt = figureLook({ skin: '#a86b42', hair: '#2b1d14', hairStyle: 0, shirt: '#dfe6ee', jacket: null, pants: '#3a3f55', tie: null, skirt: '#c03030' }, '#c03030');
  expect(skirt).toMatchObject({ skin: '#a86b42', hair: '#2b1d14', top: '#dfe6ee', skirt: '#c03030', long: true, corp: '#c03030' });
  const suit = figureLook({ skin: '#f2c9a0', hair: '#7a4a22', hairStyle: 1, shirt: '#f4f1e8', jacket: '#22242e', pants: '#1a1a22', tie: '#2a6ad1' }, '#2a6ad1');
  expect(suit).toMatchObject({ top: '#22242e', lapel: '#f4f1e8', tie: '#2a6ad1', long: false });
  expect(DEFAULT_PLAYER.skin).toBeTruthy();
});
```

Add to `tests/mock-canvas.js`:
```js
/** A mock canvas that records every fillRect with the fill colour at that moment: { canvas, ctx, calls }. */
export function recordingCanvas(w = 480, h = 270) {
  const calls = [];
  const c = { width: w, height: h, style: {} };
  const inner = mockContext(c);
  const ctx = new Proxy(inner, {
    get: (t, k) => (k === 'fillRect' ? (x, y, ww, hh) => calls.push({ x, y, w: ww, h: hh, fill: t.fillStyle }) : t[k]),
    set: (t, k, v) => ((t[k] = v), true),
  });
  c.getContext = () => ctx;
  return { canvas: c, ctx, calls };
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/mgart.test.js tests/figure.test.js`
Expected: FAIL, because the modules `../src/engine/mgart.js` and `../src/engine/figure.js` cannot be found.

- [ ] **Step 3: Write `src/engine/mgart.js`**

```js
// Art kit for the mini-games' in-between style (docs/minigame-visuals): flat bands, chunky shapes on a 2 px grid,
// string-map sprites, and baked backgrounds so render() only draws what moves.
import { rect } from './ui.js';
import { shade } from './art.js';

export { shade };

/** Flat horizontal bands through `colors`, top to bottom: a sky, a sea, a wall. No dither. */
export function bands(g, x, y, w, h, colors) {
  const n = colors.length;
  for (let i = 0; i < n; i++) {
    const y0 = y + Math.round((h * i) / n);
    const y1 = y + Math.round((h * (i + 1)) / n);
    rect(g, x, y0, w, y1 - y0, colors[i]);
  }
}

/** Ellipse on an s-pixel grid (chunky edges, like the 2x figures). */
export function cblob(g, cx, cy, rx, ry, c, s = 2) {
  for (let y = -ry; y < ry; y += s) {
    const yy = (y + s / 2) / ry;
    const hw = Math.round((rx * Math.sqrt(Math.max(0, 1 - yy * yy))) / s) * s;
    if (hw > 0) rect(g, Math.round(cx - hw), Math.round(cy + y), hw * 2, s, c);
  }
}

/** A cell painter: r(cx, cy, w, h, colour) in s-pixel cells from (ox, oy). */
export const cells = (g, ox, oy, s) => (cx, cy, w, h, col) => rect(g, ox + cx * s, oy + cy * s, w * s, h * s, col);

/** Sprite from a string map ('|' between rows, '.' transparent), each char a palette key, at scale s. */
export function sprite(g, map, pal, x, y, s = 1, flip = false) {
  map.split('|').forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      const col = pal[row[xx]];
      if (row[xx] === '.' || !col) continue;
      rect(g, x + (flip ? row.length - 1 - xx : xx) * s, y + yy * s, s, s, col);
    }
  });
}

/** Draws `draw(g)` once into an offscreen w x h canvas (a mini-game's static scenery); drawImage it every frame. */
export function bake(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
```

- [ ] **Step 4: Write `src/engine/figure.js`**

1. Move pitch.js's `person()` here **verbatim**: the body, arms, head and all seven `expr` cases.
2. Merge in the extensions from `docs/minigame-visuals/mockups/person.js` (`pose`, `view: 'back'`, `swim`, `skirt`, `tie`, `long`) and the party poses from `docs/minigame-visuals/mockups/party/common.js` `figure()` (`waveL`, `waveR`, `crouch`, `danceA`, `danceB`, the `smile`/`sing` expressions, `santaHat`).
3. Change the signature to `person(g, x, y, s, look, opts = {})` with `opts = { pose, view, swim, expr }`. When the 6th argument is a string, treat it as `expr`, so pitch.js's existing calls `person(g, x, y, s, look, expr)` keep working unchanged.
4. Add the `sleep` expression: closed eyes, two 2-cell lines at row 4.
5. Draw the Santa hat when `look.hat === 'santa'`: red `#d8282e`, a white `#f4f1e8` trim and bobble, as `santaHat()` in the party mockup.
6. Keep the pitch defaults (`look.ceo`, `lapel`, `brow`) intact.
7. Then add:

```js
/** A figure look for the career's look (game.playerLook()) and its corporate colour. */
export function figureLook(look, corp) {
  return {
    skin: look.skin,
    hair: look.hair,
    top: look.jacket || look.shirt,
    pants: look.pants,
    skirt: look.skirt || null,
    tie: look.tie || null,
    lapel: look.jacket ? look.shirt : null,
    collar: look.shirt,
    long: !!look.skirt || look.hairStyle === 2,
    brow: shade(look.hair, -0.2),
    corp,
  };
}

/** Whoever plays when no career is loaded (tests, __mg on the title). */
export const DEFAULT_PLAYER = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: null, tie: null, lapel: null, collar: '#dfe6ee', long: false, brow: '#3a2414', corp: '#1f70c1' };
```

With `swim: 'trunks'`, the chest and arms are bare skin and the trunks are `look.corp`. With `swim: 'suit'`, the torso is `look.corp`. Neither shows legs below the hips' cell row 21: the swimmers are waist-deep or lying.

- [ ] **Step 5: Point pitch.js at the shared figure**

In `src/minigames/pitch.js`, delete the local `function person(...)` with its JSDoc and add `import { person } from '../engine/figure.js';` to the imports. No call site changes.

- [ ] **Step 6: Run the tests**

Run: `bun test tests/mgart.test.js tests/figure.test.js && MG=pitch bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 7: Check Elevator Pitch is unchanged**

Do the visual check with `__mg('pitch', 0.6)`. The CEO and the pitcher must look exactly as in `docs/minigame-visuals/img/current/pitch.png`.

- [ ] **Step 8: Commit** (only when Martin has asked for commits)

```bash
git add src/engine/mgart.js src/engine/figure.js src/minigames/pitch.js tests/mock-canvas.js tests/mgart.test.js tests/figure.test.js
git commit -m "Mini-game art kit (engine/mgart.js: flat bands, chunky shapes, sprites, baked backgrounds) and the Elevator Pitch figure as a shared module (engine/figure.js) with poses, skirt, swimwear, back view and a Santa hat"
```

---

### Task 2: The player's look reaches the mini-games

**Files:**
- Modify: `src/scenes/minigameScene.js:48-54` (the `mod.create({...})` call)
- Modify: `src/engine/mgkit.js` (the contract comment at the top), `CLAUDE.md` ("Mini-game contract")
- Test: `tests/minigameArt.test.js` (new)

**Interfaces:**
- Consumes: `figureLook`, `DEFAULT_PLAYER` (Task 1); `game.playerLook()` and `game.corpColor()` (src/game.js).
- Produces: `create({ ..., player })`, where `player` is a figure look (`figureLook(...)` shape). Every later task reads `player || DEFAULT_PLAYER`.

- [ ] **Step 1: Write the failing test**

`tests/minigameArt.test.js`:
```js
// The mini-games' art: the host passes the player's figure look; games show the player as the career looks.
import { test, expect } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { newGame } = await import('../src/core/state.js');

function fakeGame(state) {
  return {
    state,
    sfx() {},
    audio: { play() {}, stop() {} },
    playerLook: () => ({ skin: '#a86b42', hair: '#2b1d14', hairStyle: 0, shirt: '#dfe6ee', jacket: null, pants: '#3a3f55', tie: null, skirt: '#c03030' }),
    corpColor: () => ({ color: '#c03030', dark: '#801010' }),
  };
}

test('the host hands the player figure look to create()', () => {
  const state = newGame();
  let got = null;
  const scene = new MinigameScene(fakeGame(state), { id: 't', game: 'beachball', title: 'Pool Ball', difficulty: 0, seed: 1 }, null);
  got = scene.player;
  expect(got).toMatchObject({ skirt: '#c03030', long: true, corp: '#c03030', skin: '#a86b42' });
});
```

Before writing this, read `newGame`'s signature in `src/core/state.js` and the scene's constructor: it may need `game.input` or other fields. Add only what the constructor touches to `fakeGame`.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/minigameArt.test.js`
Expected: FAIL, because `scene.player` is undefined.

- [ ] **Step 3: Pass the look**

In `src/scenes/minigameScene.js`, add `import { figureLook } from '../engine/figure.js';`. Before `this.inst = mod.create({`, add:
```js
    // The player's figure for games that show you (the pool, the massage table, the party): skin, hair, skirt or trousers.
    this.player = game.playerLook ? figureLook(game.playerLook(), game.corpColor().color) : null;
```
Then add `player: this.player,` to the `create({...})` argument.

In `src/engine/mgkit.js`'s header comment, document `player` next to `theme`: "the player's figure look (engine/figure.js), or undefined". In CLAUDE.md's "Mini-game contract" block, change `create({ difficulty /*0..1*/, rng, theme: { dept, title }, sfx })` to `create({ difficulty /*0..1*/, rng, theme: { dept, title }, sfx, player })`, and add a bullet: "Art: the in-between style (`docs/minigame-visuals/README.md`): `engine/figure.js` `person()` for people (`player || DEFAULT_PLAYER` for you), `engine/mgart.js` for flat bands and chunky shapes; bake static scenery once with `bake()`."

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/minigames.test.js tests/holiday.test.js tests/chores.test.js tests/partyGames.test.js tests/roof.test.js`
Expected: PASS.

- [ ] **Step 5: Commit** (only when Martin has asked)

```bash
git add src/scenes/minigameScene.js src/engine/mgkit.js CLAUDE.md tests/minigameArt.test.js
git commit -m "Mini-games get the player's figure look (create({ player })): skin, hair, skirt or trousers, the corporate colour"
```

---

### Task 3: Boss Alert

**Files:**
- Modify: `src/minigames/stealth.js` (`render`, `drawWalker`, `drawFun`, `drawWork`; `FEET_Y`)
- Test: `tests/minigameArt.test.js`

**Gameplay change:** `FEET_Y` goes from 104 to 112 (display only: the walkers' x and the timing logic are unchanged). The walkers are `person()` figures at 2x; the boss is the pitch CEO type (grey hair, dark suit, white lapels, red tie, **normal eyes**: no glasses, as Martin asked), and decoys are suits with other ties. A walker uses `pose: walkA/walkB` by step and the `down`-facing stand pose (`pose: 'stand'`, default view) while looking at your desk, with the "?" bubble for the boss.

- [ ] **Step 1: Write the failing test** (append to `tests/minigameArt.test.js`)

```js
const { recordingCanvas } = await import('./mock-canvas.js');
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');

/** Runs a game for `secs` with no input and returns the colours drawn in the last frame. */
function lastFrameFills(id, secs, extra = {}) {
  const inst = MINIGAMES[id].create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T', stats: { floor: 3, stars: 0, title: 'X' } }, sfx: () => {}, ...extra });
  const input = createInput();
  for (let t = 0; t < secs && !inst.done; t += 1 / 30) {
    input.beginFrame();
    inst.update(1 / 30, input);
    input.endFrame();
  }
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  return new Set(calls.map((c) => c.fill));
}

test('Boss Alert: the boss is a pitch figure with a red tie and no sunglasses', () => {
  // Run until a boss is on screen, then look for his red tie and that no glasses band (#15161c rows) is drawn.
  const fills = lastFrameFills('stealth', 6);
  expect(fills.has('#c0392b') || fills.has('#e2304a')).toBe(true);
});
```

If a boss may not be on screen at 6 s with seed 7, read the walker schedule in `stealth.js` (the `spawn` times) and pick the first `secs` at which a walker with `boss: true` is `active`. Assert at that time.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/minigameArt.test.js -t "Boss Alert"`
Expected: FAIL. Today's boss draws the tie `#e2304a`, but the walkers are not `person()` figures, so check that the assertion fails on the old code. If it passes already, tighten it to a colour only the new art draws, such as the boss's lapel `#f4f1e8` together with the jacket `#22242e`.

- [ ] **Step 3: Port the art**

Port from `docs/minigame-visuals/mockups/bossalert.js` (the `styleIs('mid')` branches):
1. Bake `hallway()` plus the cubicle partitions and desk once in `create()`.
2. Per frame, draw the walkers with `person()` (`pitchLook` → figure looks with `glasses: false`).
3. Draw your head from behind, the monitor glow, the mirror with a red tie in it, and the Solitaire window (`solitaire()`, animated by the game's `anim`) or the work spreadsheet (today's `drawWork`, restyled to the window chrome).
4. Draw the mugshot legend with the boss figure at 3x, clipped to the panel with `figure(g, BOSS, 74, 274, 'down', 0, 3)` geometry. Keep the STATUS panel text as it is.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js && MG=stealth bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockup** `mid-bossalert.png` (visual check).

- [ ] **Step 6: Commit** (when asked): "Boss Alert in the in-between style: a furnished hallway, colleagues and the boss as Elevator Pitch figures, your cubicle over your shoulder, a Solitaire window, a mugshot legend"

---

### Task 4: Smoke Break

**Files:**
- Modify: `src/minigames/cigarette.js` (`render`; the meters' `mx`; `FLICK_BTN` unchanged)
- Test: `tests/minigameArt.test.js`, `tests/roof.test.js` (re-run)

**Gameplay change:** none to timing or scoring. The heat and ash gauges move to the right (`mx` 18 → 420, `my` 40 → 36) because the arm takes the left. `CIG` stays `{ x: 150, y: 132, len: 250, h: 8 }`.

**Approved hand (Martin's last round):**
- The arm comes **straight in from the left edge**, horizontal, in the suit sleeve.
- The cuff is white with a gold cufflink.
- The **index finger is joined to the back of the hand** (no outline at the knuckle) and drawn after the cigarette, over the filter's top edge; the middle finger lies under the filter.
- The thumb and the curled fingers sit below.
- 3 px cells with a 2 px dark outline: mockup `handBack()`/`handFront()`.

**Sky:** dusk or night follows the roof's `skyMode` (passed as `theme.sky` by the roof; default dusk). A day sky uses the roof's day colours.

- [ ] **Step 1: Write the failing test**

```js
test('Smoke Break: the hand is drawn in front of and behind the cigarette, the gauges on the right', () => {
  const inst = MINIGAMES.cigarette.create({ difficulty: 0.3, rng: createRng(3), theme: { dept: 'lobby', title: 'Smoke Break' }, sfx: () => {} });
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  // The heat gauge's frame (#1a1a22, 16 px wide) now sits right of x 400.
  const gauge = calls.find((c) => c.fill === '#1a1a22' && c.w === 16 && c.h > 100);
  expect(gauge.x).toBeGreaterThan(400);
  // The index finger (skin) is drawn after the paper of the cigarette.
  const paper = calls.findIndex((c) => c.fill === '#f4f1e8' && c.w > 100);
  const lastSkin = calls.map((c) => c.fill).lastIndexOf('#e0a878');
  expect(lastSkin).toBeGreaterThan(paper);
});
```

The skin tone constant here is the mockup's dusk `PAL.dusk.skin[2]`. If the port names the hand palette differently, use the actual constant from the port, and keep the ordering assertion.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tests/minigameArt.test.js -t "Smoke Break"`
Expected: FAIL, because the gauge is at x 17.

- [ ] **Step 3: Port the art**

Port from `docs/minigame-visuals/mockups/cigarette.js` (mid branches only):
1. Bake `sky()`, `skyline()` (drop the blinking antenna light from the bake and draw it per frame) and `parapet()`.
2. Per frame, draw:
   - `handBack()`;
   - the cigarette (`cigarette()` with the game's `len`, `heat`, `ash`, `lit`, `relight` and lighter; keep today's lighter and the "Stub it out!" text);
   - `handFront()`;
   - the smoke particles from the game's `smoke` array (as today, chunky 2 px);
   - gusts;
   - the meters at the right;
   - the flick button and the hint.
3. Map `mood` from `theme.sky || 'dusk'`. In `src/scenes/roof.js` (or wherever the roof creates the `cigarette` MinigameScene), pass `sky: skyMode(...)` in the task's theme. Find the call with `grep -n "'cigarette'" src/scenes/*.js`, and follow how the theme is built in minigameScene (`theme: { dept, title, stats }`). If the theme cannot carry it without changing the host, read the sky from `new Date().getHours()` with the same hours as `skyMode` (day; dusk 18-20; night 20-6), imported from where `skyMode` is defined.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/roof.test.js tests/roofScenes.test.js && MG=cigarette bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockup:** `mid-cigarette-dusk.png` and `mid-cigarette-night.png` (`__roof('night')` then a cigarette, or `__mg('cigarette')`).

- [ ] **Step 6: Commit** (when asked): "Smoke Break in the in-between style: the roof's skyline by sky mode, the arm straight in from the left with the cigarette between two fingers, the gauges on the right"

---

### Task 5: Deep Tissue

**Files:**
- Modify: `src/minigames/massage.js` (`BACK`, `REACH`, `render`)
- Create: `src/engine/mgscenery.js` (starts with nothing massage-specific; create it here only if a helper is shared, otherwise in Task 6)
- Test: `tests/minigameArt.test.js`, `tests/holiday.test.js` (re-run; adjust the massage bot only if it hard-codes positions)

**Gameplay change:**
- `BACK = { x: 196, y: 124, w: 88, h: 104 }`: the guest's back on the zoomed table. It was `{ x: 150, y: 60, w: 180, h: 160 }`, which included the head.
- `REACH` 16 → 22 for the bigger hands.

The hand still clamps to `BACK`, and knots spawn inside it with today's 20 px margin. With the smaller back that margin leaves 48x64 for spawns, so use a 12 px margin (`rng.int(BACK.x + 12, BACK.x + BACK.w - 12)`).

**Art:**
- You lie face down on a 6 px grid (mockup `massage2.js`, `S = 6`), zoomed in so the back fills the screen down to the towel at row 33. Skin and hair come from `player`; long hair in a bun when `player.long`.
- The masseur's hands are the 11x12 `HAND` sprite at 3 px cells with an outline.
- The knots are chunky red patches that pulse.
- The props (towels, stones with a candle, a bowl, an orchid, oil, a teal towel stack) and the plank floor are baked.

- [ ] **Step 1: Write the failing test**

```js
test('Deep Tissue: knots spawn on the back only (below the head, above the towel)', () => {
  const inst = MINIGAMES.massage.create({ difficulty: 0, rng: createRng(11), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  for (let t = 0; t < 10; t += 1 / 30) {
    input.beginFrame();
    inst.update(1 / 30, input);
    input.endFrame();
    for (const k of inst.peek().knots) {
      expect(k.x).toBeGreaterThanOrEqual(196);
      expect(k.x).toBeLessThanOrEqual(284);
      expect(k.y).toBeGreaterThanOrEqual(124);
      expect(k.y).toBeLessThanOrEqual(228);
    }
  }
});

test('Deep Tissue: the guest has the player\'s skin and long hair with a skirt', () => {
  const player = { skin: '#6b4228', hair: '#d9b25c', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  const fills = lastFrameFills('massage', 0.1, { player });
  expect(fills.has('#6b4228')).toBe(true);
  expect(fills.has('#d9b25c')).toBe(true);
});
```

The guest has to be drawn per frame (not baked) for the second test to see it. That is right anyway: skin and hair depend on `player`, which is known in `create()`, so baking would also be possible. Draw the guest per frame so the test can check it; it is about 40 rects.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Deep Tissue"`
Expected: FAIL, because knots appear at y < 124 and the skin is `#f2c9a0`.

- [ ] **Step 3: Port the art and the constants**

Port from `docs/minigame-visuals/mockups/massage2.js`:
1. Bake `floor`, `table`, the towel and the props.
2. Per frame, draw `guest()` with `player || DEFAULT_PLAYER` (`SKIN = player.skin`, `SKIN_D = shade(player.skin, -0.15)`, `HAIR = player.hair`, bun and long hair when `player.long`).
3. Draw `knot()` for each live knot, then `hands()` at `hand.x, hand.y`, squeezed by `press` as today: a 2 px offset.
4. Keep the header, timer, floaters and hint.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/holiday.test.js && MG=massage bun test tests/minigames.test.js`
Expected: PASS. The attentive massage bot must still get 3 stars and the idle one under 1. If the bot steers to fixed coordinates, change it to steer to `peek().knots`.

- [ ] **Step 5: Compare with the mockups:** `mid-massage-trousers.png` and `mid-massage-skirt.png`. Check with a trousers career and a skirt career.

- [ ] **Step 6: Commit** (when asked): "Deep Tissue in the in-between style: you face down on the table as an Elevator Pitch figure, zoomed to your back, the masseur's hands, spa props; knots spawn on the back only"

---

### Task 6: Pool Ball and the hotel scenery

**Files:**
- Create: `src/engine/mgscenery.js` (hotel: `hotelFacade(g)`, `palm(g, x, y, h, lean)`, `lounger(g, x, y, flip)`, `parasol(g, x, y)`, `cloud(g, x, y)`)
- Modify: `src/minigames/beachball.js` (`WATER`, `HANDS`, `render`)
- Test: `tests/minigameArt.test.js`, `tests/holiday.test.js`

**Interfaces:**
- Produces, in `src/engine/mgscenery.js`:
  - `hotelFacade(g)`: the HOTEL PARADISO block at x 70-410, y 30-154
  - `palm(g, x, y, h, lean)`
  - `lounger(g, x, y, flip)`
  - `parasol(g, x, y)`
  - `cloud(g, x, y)`

  Tasks 9-11 reuse them.

**Gameplay change:** `WATER` 200 → 214 and `HANDS` = `WATER - 54` (160). The swimmer is the figure at 2x, waist-deep, arms up; the ball meets the raised hands. Add the ball's shadow on the water under `ball.x` (a 16x2 dark strip at 35% alpha).

- [ ] **Step 1: Write the failing tests**

```js
test('Pool Ball: the ball bounces off the raised hands at y 160', () => {
  const inst = MINIGAMES.beachball.create({ difficulty: 0, rng: createRng(5), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let lowest = 0;
  for (let t = 0; t < 8; t += 1 / 60) {
    input.beginFrame();
    const p = inst.peek();
    // Stay under the ball.
    if (p.ball.x < p.you.x - 4) input.keyDown('ArrowLeft'); else input.keyUp('ArrowLeft');
    if (p.ball.x > p.you.x + 4) input.keyDown('ArrowRight'); else input.keyUp('ArrowRight');
    inst.update(1 / 60, input);
    input.endFrame();
    if (!inst.peek().ball.wet) lowest = Math.max(lowest, inst.peek().ball.y);
  }
  expect(lowest).toBeLessThanOrEqual(162);
});

test('Pool Ball: a skirt career swims in a suit in the corporate colour, trousers in trunks', () => {
  const skirt = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  expect(lastFrameFills('beachball', 0.1, { player: skirt }).has('#c03030')).toBe(true);
  const trousers = { ...skirt, skirt: null, long: false, corp: '#2a6ad1' };
  expect(lastFrameFills('beachball', 0.1, { player: trousers }).has('#2a6ad1')).toBe(true);
});
```

Check `peek()`'s field names in `beachball.js` (`you`, `ball`, `ball.wet`) and adjust to the real ones.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Pool Ball"`
Expected: FAIL, because the lowest y is 182.

- [ ] **Step 3: Port the art and the constants**

1. Create `mgscenery.js` from `docs/minigame-visuals/mockups/poolball2.js` (`hotel`, `lounger`, `umbrella` renamed `parasol`, the clouds) and `poolball.js` (`palm`).
2. In `beachball.js`:
   - set `WATER = 214` and `HANDS = WATER - 54`;
   - bake the sky bands, clouds, facade, palms, deck, loungers, parasols and coping;
   - per frame, draw `person(g, you.x - 12, WATER - 38, 2, look, { pose: 'armsUp', swim: look.skirt ? 'suit' : 'trunks' })`;
   - then the water bands, ripples and lane line (`water()`), the faint legs, the ripple dashes, the shadow, and the chunky `ball()` (or the wet ball as today, restyled to 2 px).

   `look` is `player || DEFAULT_PLAYER`.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/holiday.test.js tests/vacationScenes.test.js && MG=beachball bun test tests/minigames.test.js`
Expected: PASS, with the attentive bot at 3 stars and idle under 1.

- [ ] **Step 5: Compare with the mockups:** `mid-poolball-trousers.png` and `mid-poolball-skirt.png`.

- [ ] **Step 6: Commit** (when asked): "Pool Ball in the in-between style: the hotel pool, you waist-deep with arms up in trunks or a swimsuit, the ball's shadow on the water; shared hotel scenery in engine/mgscenery.js"

---

### Task 7: Sandcastle and Squeaky Clean

**Files:**
- Modify: `src/minigames/sandcastle.js` (`render`), `src/minigames/dishes.js` (`render`)
- Modify: `src/engine/mgscenery.js` (add the flat: `subway(g, x, y, w, h)`, `counter(g, y)`, `pottedPlant(g, x, y)`, from `mockups/home/common.js`)
- Test: `tests/minigameArt.test.js`, `tests/holiday.test.js`, `tests/chores.test.js`

**Gameplay change:** none. For Squeaky Clean, the rack's free slot is wherever the game puts it today (`RACK.x`). Port the rack so the free slot is drawn at `RACK.x` with the green arrow over it.

- [ ] **Step 1: Write the failing tests**

```js
test('Sandcastle: the built tiers are drawn every frame with crenellations (not baked)', () => {
  const inst = MINIGAMES.sandcastle.create({ difficulty: 0, rng: createRng(1), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  // The pail is drawn per frame, tapered: rows of decreasing width in its blue.
  const pail = calls.filter((c) => c.fill === '#3b6fb6').map((c) => c.w);
  expect(new Set(pail).size).toBeGreaterThan(2);
});

test('Squeaky Clean: the plate has a blue patterned rim', () => {
  const fills = lastFrameFills('dishes', 0.1);
  expect(fills.has('#3b6fb6')).toBe(true);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Sandcastle|Squeaky"`
Expected: FAIL. Today's bucket is a single 30 px rect, and the plate has no blue.

- [ ] **Step 3: Port the art**

1. **Sandcastle**, from `mockups/sandcastle.js` with the mid style: `gradient` becomes `bands` with the stops and their midpoints, `speckle` becomes sparse 2x2 grains (a fixed list baked once), and `shaded` becomes `cblob` rim, base and light.
   - Bake: sky, gulls, island, sail, sea, wet and dry sand, parasol and towel, spade, shells, starfish, footprints.
   - Per frame: the surf line (it moves with `t`), the mound, `tier()` for `i < built`, the falling layer (`drop`) as a tier, the pennants, the flag when `built >= LAYERS`, the kid's `arm()` and the `pail()` at `cx + (drop ? drop.x : offset())`, tipped as today.
2. **Squeaky Clean**, from `mockups/dishes.js` with the mid style. Add `subway`, `counter` and `pottedPlant` to `mgscenery.js`.
   - Bake: the wall, the window, the shelf with mugs, the counter, the cabinets, the tea towel, the sink basin, the soap and the tap.
   - Per frame: the foam (it bobs), the rack with `good` plates racked and the free slot at `RACK.x`, the plate (`plate()` at the scrub or swing position, with `spots` scaled by `1 - strokes / STROKES` as today), the sponge on the side of `last` with bubbles, the shake and the hint.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/holiday.test.js tests/chores.test.js && MG=sandcastle,dishes bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-sandcastle.png`, `mid-sandcastle-done.png` and `mid-dishes.png`.

- [ ] **Step 6: Commit** (when asked): "Sandcastle and Squeaky Clean in the in-between style: the beach with a real pail and castle tiers; a kitchen with a sink of suds, a patterned plate and a drying rack"

---

### Task 8: Counting Sheep and Lobster

**Files:**
- Modify: `src/minigames/sleep.js`, `src/minigames/buffet.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/holiday.test.js`

**Gameplay change:** none. For Counting Sheep, `FENCE_X`, `GROUND` and `JUMP` stay; the sleeper in bed is you (`player`), with long hair on the pillow when `player.long`. For Lobster, `AREA` and the dish positions stay; the eight dishes are the mockup's food sprites.

- [ ] **Step 1: Write the failing tests**

```js
test('Counting Sheep: you sleep in the bed with your hair colour', () => {
  const player = { skin: '#f2c9a0', hair: '#a33b20', top: '#dfe6ee', pants: '#3a3f55', skirt: null, long: false, corp: '#2a6ad1' };
  expect(lastFrameFills('sleep', 0.1, { player }).has('#a33b20')).toBe(true);
});

test('Lobster: the buffet shows food sprites (the lobster red)', () => {
  expect(lastFrameFills('buffet', 0.1).has('#d8402a')).toBe(true);
});
```

Use the lobster red the port actually uses, from `mockups/hotel/buffet.js` `FOOD.lobster`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Counting Sheep|Lobster"`
Expected: FAIL.

- [ ] **Step 3: Port the art**

1. **Counting Sheep**, from `mockups/hotel/sleep.js`.
   - Bake: sky bands, stars, moon, hills, meadow, fence, bed frame.
   - Per frame: sheep at their live x/y (yellow once counted, as the game marks them), the sleeper's head and hair from `player`, and the z's.
2. **Lobster**, from `mockups/hotel/buffet.js`.
   - Bake: room, lanterns, table cloth, runner.
   - Per frame: a platter with its food at each live dish position (eaten dishes as today), and your plate at the live pointer or hand position.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/holiday.test.js && MG=sleep,buffet bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-sleep.png`, `mid-sleep-skirt.png` and `mid-buffet.png`.

- [ ] **Step 6: Commit** (when asked): "Counting Sheep and Lobster in the in-between style"

---

### Task 9: Swim to the Buoy, Golden Brown, Pina Colada

**Files:**
- Modify: `src/minigames/swim.js`, `src/minigames/sunbathe.js`, `src/minigames/cocktail.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/holiday.test.js`

**Gameplay change:** none.
- **Swim:** `SEA_Y` and `FAR` stay. You swim the crawl with an arm up mid-stroke (alternating by the game's stroke timing), in trunks or a swimsuit with long hair.
- **Golden Brown:**
  - The meter keeps `mx` 60, `my` 70, `mh` 140 and the towel stays at 150-330 x 110-180.
  - You lie on the towel: face up with sunglasses, or face down showing hair, by the game's side flag.
  - Your skin lerps from `player.skin` towards a tan as today's tan value grows.
- **Pina Colada:** `FLOOR_Y` stays; the catcher is a hurricane glass filling with each fruit caught.

- [ ] **Step 1: Write the failing tests**

```js
for (const id of ['swim', 'sunbathe']) {
  test(`${id}: a skirt career wears a swimsuit in the corporate colour`, () => {
    const player = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
    expect(lastFrameFills(id, 0.1, { player }).has('#c03030')).toBe(true);
  });
}

test('Pina Colada: the catcher is a glass with pina colada in it', () => {
  expect(lastFrameFills('cocktail', 0.1).has('#f4ecc8')).toBe(true);
});
```

Use the pina colada cream the port actually uses, from `mockups/hotel/cocktail.js`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "swim|sunbathe|Pina"`
Expected: FAIL.

- [ ] **Step 3: Port the art**

1. **Swim**, from `mockups/hotel/swim.js`.
   - Bake: the far beach with `hotelFacade` (scaled-down strip) and `palm` from mgscenery, the sea bands, the jetty.
   - Per frame: ripples, the buoy (bobbing), the swimmer at the live x, and the progress bar as today in a frame.
2. **Golden Brown**, from `mockups/hotel/sunbathe.js`.
   - Bake: sand, footprints, shell, towel, props.
   - Per frame: the sun's rays (turning), you (side and tan from the game state), and the thermometer meter with the live tan.
3. **Pina Colada**, from `mockups/hotel/cocktail.js`.
   - Bake: sky bands, the sun and reflection, palm silhouettes, the thatch and the counter.
   - Per frame: falling fruit sprites by kind, and the glass at the live catcher x with its fill.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/holiday.test.js && MG=swim,sunbathe,cocktail bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-swim.png`, `mid-swim-skirt.png`, `mid-sunbathe.png`, `mid-sunbathe-skirt.png` and `mid-cocktail.png`.

- [ ] **Step 6: Commit** (when asked): "Swim to the Buoy, Golden Brown and Pina Colada in the in-between style: you in trunks or a swimsuit, the hotel beach, a beach bar at sunset"

---

### Task 10: Dust Buster and Separate Cycles

**Files:**
- Modify: `src/minigames/vacuum.js`, `src/minigames/laundry.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/chores.test.js`

**Gameplay change:** none.
- **Dust Buster:**
  - The vacuum is a **cordless stick vacuum**, as Martin asked: the brush head at `vac`, a stick rising up-right to the motor with a clear dust cup, a handle and a battery. No hose and no canister.
  - The room's furniture sits on the wall tops outside `ROOM`, so bunnies never spawn under it.
- **Separate Cycles:**
  - The machines keep `BIN_Y` 180, `BIN_W` 100 and their x positions.
  - The falling piece is drawn as its garment type: hoodie, T-shirt, socks, jeans, shirt, towel. Map the game's item names to the six shapes; unknown names draw the T-shirt.

- [ ] **Step 1: Write the failing tests**

```js
test('Dust Buster: dust bunnies have eyes (white pixels on grey fluff)', () => {
  const fills = lastFrameFills('vacuum', 0.1);
  expect(fills.has('#9aa1ad') || fills.has('#8a909a')).toBe(true);
  expect(fills.has('#ffffff')).toBe(true);
});

test('Separate Cycles: front-loaders with round glass doors', () => {
  expect(lastFrameFills('laundry', 0.1).has('#9ad0e0')).toBe(true);
});
```

Use the actual grey, white and glass colours of the ported `bunny()` and `machine()`, from `mockups/home/vacuum.js` and `laundry.js`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Dust Buster|Separate Cycles"`
Expected: FAIL.

- [ ] **Step 3: Port the art**

1. **Dust Buster**, from `mockups/home/vacuum.js` (the stick vacuum version).
   - Bake: the room (planks, rug, walls, furniture).
   - Per frame: bunnies at their live positions (a `seed` per bunny for the wobble), and the vacuum at `vac.x, vac.y`.
2. **Separate Cycles**, from `mockups/home/laundry.js`.
   - Bake: the tiled wall (`subway` from mgscenery), the shelf and the basket.
   - Per frame: `machine()` per bin with its sorted count tumbling, the falling garment at its live position with its label, and the counters.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/chores.test.js tests/homeScenes.test.js && MG=vacuum,laundry bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-vacuum.png` and `mid-laundry.png`.

- [ ] **Step 6: Commit** (when asked): "Dust Buster and Separate Cycles in the in-between style: a living room with dust bunnies and a cordless stick vacuum; a utility room with front-loaders and garments that look like garments"

---

### Task 11: Pressing Matters, Just Right, Home Brew

**Files:**
- Modify: `src/minigames/ironing.js` (crease spawning, `render`), `src/minigames/bath.js` (water colour, bubbles, `render`), `src/minigames/brew.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/chores.test.js`

**Gameplay change:**
- **Pressing Matters:**
  - Creases spawn on the shirt's shape, not its whole rect. That means the body (`x` 166-314) anywhere, and the sleeves only above y ≈ 118, which is the shirt's shape in `mockups/home/ironing.js` `shirt()`.
  - The **iron's cord leaves the top of the handle** at the heel and loops up and away (Martin's correction).
- **Just Right:**
  - The water colour runs from blue (cold) to soft pink (hot), never grey-brown.
  - Bubbles rise inside the oval tub (about 130-350 x 112-150).
  - The temperature logic is unchanged.
- **Home Brew:** none.

- [ ] **Step 1: Write the failing tests**

```js
test('Pressing Matters: every crease lies on the shirt (body, or a sleeve above its hem)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const inst = MINIGAMES.ironing.create({ difficulty: 0.5, rng: createRng(seed), theme: { dept: 'it', title: 'T' }, sfx: () => {} });
    for (const c of inst.peek().creases) {
      const onBody = c.x >= 166 && c.x <= 314;
      const onSleeve = c.y <= 118;
      expect(onBody || onSleeve).toBe(true);
    }
  }
});

test('Just Right: the water is never grey-brown at any temperature', async () => {
  const { bathWater } = await import('../src/minigames/bath.js');
  for (let temp = 10; temp <= 50; temp += 2) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(bathWater(temp).slice(i, i + 2), 16));
    // Grey-brown: red over blue with low saturation. Ours stays blue-ish or pink.
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    expect(sat).toBeGreaterThan(30);
  }
});
```

1. Check `ironing.js`'s `peek()` for the crease list's name and fields. If `peek()` does not expose creases, add `creases: creases.map((c) => ({ x: c.x, y: c.y }))` to it; this is a test hook like the other `peek()`s.
2. Export `bathWater(temp)` from `bath.js`, returning a `#rrggbb`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Pressing Matters|Just Right"`
Expected: FAIL. Creases appear in the bare corners, and `bathWater` is not exported.

- [ ] **Step 3: Port the art and the two changes**

1. **Pressing Matters**, from `mockups/home/ironing.js`.
   - Bake: the floor, the board and the shirt.
   - Per frame: creases (fading as pressed), scorch marks, and the iron at the live position with steam and the cord from the top.
   - Change the crease spawner to retry until a point satisfies the body/sleeve rule.
2. **Just Right**, from `mockups/home/bath.js`.
   - Bake: the tiled room, the towel rail, the plant and the tub shell.
   - Per frame: the water fill with `bathWater(temp)`, foam, bubbles inside the oval, the duck bobbing, the taps with their streams when on, and the thermometer.
3. **Home Brew**, from `mockups/home/brew.js`.
   - Bake: the kitchen from mgscenery, the shelf and the cabinets.
   - Per frame: the grinder's drawer filling with `grind`, the kettle's steam, the mugs' fill levels with the line, the step note and the gauge.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/chores.test.js && MG=ironing,bath,brew bun test tests/minigames.test.js`
Expected: PASS, with the attentive chore bots at 3 stars and idle under 1.

- [ ] **Step 5: Compare with the mockups:** `mid-ironing.png`, `mid-bath.png` and `mid-brew.png`.

- [ ] **Step 6: Commit** (when asked): "Pressing Matters, Just Right and Home Brew in the in-between style; creases only on the shirt, bath water from blue to pink"

---

### Task 12: Gift Wrapping and Photo Booth, with the party scenery

**Files:**
- Modify: `src/engine/mgscenery.js` (party: `stringLights(g, y, t, x0, x1)`, `discoBall(g, x, y, t, r)`, `xmasTree(g, x, base, h, t)`, from `mockups/party/common.js`; the Santa hat is in `figure.js` since Task 1)
- Modify: `src/minigames/giftwrap.js`, `src/minigames/photobooth.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/partyGames.test.js`

**Gameplay change:** none.
- **Gift Wrapping:** the gift sits on the table top at y 168, and the gauge stays at 120/214, 240 wide.
- **Photo Booth:** the pose card grows from 66 to 96 px tall (y 44-140) to fit a 2x figure. This is display only, so the pose card's hit area stays unless it is clickable; check `photobooth.js`. You pose at 3x in a Santa hat.

- [ ] **Step 1: Write the failing tests**

```js
test('Photo Booth: you pose in a Santa hat, in a skirt when the career wears one', () => {
  const player = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  const fills = lastFrameFills('photobooth', 0.1, { player });
  expect(fills.has('#d8282e')).toBe(true);
  expect(fills.has('#c03030')).toBe(true);
});

test('Gift Wrapping: the tape gauge is a strip of tape off its roll', () => {
  expect(lastFrameFills('giftwrap', 0.1).has('#e8f0f4')).toBe(true);
});
```

Use the tape colour the port actually uses, from `mockups/party/giftwrap.js` `tapeGauge()`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Photo Booth|Gift Wrapping"`
Expected: FAIL.

- [ ] **Step 3: Port the art**

1. **Gift Wrapping**, from `mockups/party/giftwrap.js`.
   - Bake: the hall wall, garland frame, window, tree, table, rolls and tools.
   - Per frame: the string lights twinkling, the gift being wrapped (live state), the wrapped gifts done so far, and the tape gauge with the live marker and band.
2. **Photo Booth**, from `mockups/party/photobooth.js`.
   - Bake: the curtains and the backdrop frame.
   - Per frame: the snowflakes, you at 3x in the live pose (`waveL`, `waveR`, `crouch`, `armsUp`, from the game's pose names), the pose card with its 2x figure, the photo strip with the shots taken so far (grey when missed), and the pose buttons as today.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/partyGames.test.js tests/partyScenes.test.js && MG=giftwrap,photobooth bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-giftwrap.png`, `mid-photobooth.png` and `mid-photobooth-skirt.png`.

- [ ] **Step 6: Commit** (when asked): "Gift Wrapping and Photo Booth in the in-between style: the Secret Santa table, the photo booth with you in a Santa hat; shared party scenery"

---

### Task 13: Dance-Off and Carol Karaoke

**Files:**
- Modify: `src/minigames/dance.js`, `src/minigames/carols.js` (`render`)
- Test: `tests/minigameArt.test.js`, `tests/partyGames.test.js`

**Gameplay change:** none.
- **Dance-Off:** the lanes stay at 180-300, the hit line at 52, the pads at 226 and the dancers' feet at 182. The floor tiles light up one row per beat from the song clock (`inst.song` timing as today).
- **Carol Karaoke:** the lanes stay at 180/140/100, the NOW line at 110 and the lyrics at y 229.

- [ ] **Step 1: Write the failing tests**

```js
test('Dance-Off: you dance in a Santa hat, in a skirt when the career wears one', () => {
  const player = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  const fills = lastFrameFills('dance', 0.5, { player });
  expect(fills.has('#d8282e')).toBe(true);
  expect(fills.has('#c03030')).toBe(true);
});

test('Carol Karaoke: the choir sings in Santa hats', () => {
  expect(lastFrameFills('carols', 0.5).has('#d8282e')).toBe(true);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test tests/minigameArt.test.js -t "Dance-Off|Carol"`
Expected: FAIL.

- [ ] **Step 3: Port the art**

1. **Dance-Off**, from `mockups/party/dance.js`.
   - Bake: the hall wall and the DJ booth.
   - Per frame: the disco ball and its spots (turning), the floor tiles lit by beat, you (`player`) and the rival colleague in `danceA`/`danceB` by beat (`stand` between), the lanes with chunky arrows at their live y, the pads (lit when pressed), and the combo text.
2. **Carol Karaoke**, from `mockups/party/carols.js`.
   - Bake: the drapes and fringe, the riser and the tree.
   - Per frame: the string lights, the choir with `expr: 'sing'` on the beat, the staves and live notes (the current one gold), your head in a Santa hat on the NOW line at your lane, and the lyrics screen.

- [ ] **Step 4: Run the tests**

Run: `bun test tests/minigameArt.test.js tests/partyGames.test.js tests/partyScenes.test.js && MG=dance,carols bun test tests/minigames.test.js`
Expected: PASS.

- [ ] **Step 5: Compare with the mockups:** `mid-dance.png`, `mid-dance-skirt.png` and `mid-carols.png`.

- [ ] **Step 6: Commit** (when asked): "Dance-Off and Carol Karaoke in the in-between style: a lit dance floor with the DJ booth and disco ball; a choir in Santa hats on stage"

---

### Task 14: Guide screenshots and docs

**Files:**
- Modify: `public/how-to-play/img/mg-<id>.png` for the 20 games, `public/how-to-play/index.html` (only where it describes a game's look), `CLAUDE.md`, `docs/minigame-visuals/README.md`

- [ ] **Step 1: Re-take the guide screenshots**

The guide's convention (CLAUDE.md, "Player guide"):
1. On the dev server (`PORT=5391`), take a floor-9 Customer Support career.
2. For each of the 20 ids, run `__mg('<id>', 0.6)`, wait about 4 s, and save `canvas.toDataURL()` at 480x270, scaled 2x nearest-neighbour to 960x540, as `public/how-to-play/img/mg-<id>.png`.

The 20 ids: stealth, cigarette, massage, beachball, sandcastle, dishes, sleep, buffet, swim, sunbathe, cocktail, vacuum, laundry, ironing, bath, brew, giftwrap, photobooth, dance, carols.

- [ ] **Step 2: Update the docs**

1. In `CLAUDE.md`, the Architecture table's Engine row: add "mini-game art kit (`mgart.js`), the shared Elevator Pitch figure (`figure.js`), shared scenery (`mgscenery.js`)".
2. In `docs/minigame-visuals/README.md`: add a line at the top saying the second pass is implemented, with the date, and that `mockups/` is kept as the reference.

- [ ] **Step 3: Run the whole suite**

Run: `bun test`
Expected: all pass. The count is today's 502 plus the new tests.

- [ ] **Step 4: Commit** (when asked): "Guide screenshots of the 20 restyled mini-games; CLAUDE.md on the art kit"

---

## Self-review notes

- **Spec coverage:**
  - All 20 games are covered: 6 in Tasks 3-7 and 14 in Tasks 8-13.
  - Martin's last corrections are each pinned in a task's text:
    - Deep Tissue zoom (Task 5);
    - the boss's normal eyes (Task 3);
    - the straight arm and the joined index finger (Task 4);
    - the cordless stick vacuum (Task 10);
    - the iron's cord from the top (Task 11).
  - The skirt/trousers rule has tests in Tasks 5, 6, 8, 9, 12 and 13.
- **Gameplay changes:** each has a test:
  - Deep Tissue `BACK` (Task 5);
  - Pool Ball `HANDS` (Task 6);
  - ironing creases (Task 11);
  - bath water (Task 11);
  - the Smoke Break gauge position (Task 4).

  Boss Alert `FEET_Y` is display only.
- **Colour constants in the tests** that depend on the port (food red, cream, tape, bunny grey) carry an explicit instruction to use the port's actual constant. Each test still pins a colour the old art never draws.
