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
  const state = newGame({}, 0);
  const scene = new MinigameScene(fakeGame(state), { id: 't', game: 'beachball', title: 'Pool Ball', difficulty: 0, seed: 1 }, null);
  const got = scene.player;
  expect(got).toMatchObject({ skirt: '#c03030', long: true, corp: '#c03030', skin: '#a86b42' });
});

const { recordingCanvas } = await import('./mock-canvas.js');
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { DEFAULT_PLAYER } = await import('../src/engine/figure.js');

/** Runs a game for `secs` with no input; returns what the last frame drew: { fills, calls, baked } (baked = what create() drew into its offscreen canvases). */
function lastFrame(id, secs, extra = {}) {
  const { bot, ...rest } = extra; // bot(frame, input): optional key presses per frame
  extra = rest;
  const baked = [];
  const realCreate = document.createElement;
  document.createElement = () => {
    const rc = recordingCanvas(16, 16);
    baked.push(rc.calls);
    return rc.canvas;
  };
  let inst;
  try {
    inst = MINIGAMES[id].create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T', stats: { floor: 3, stars: 0, title: 'X' } }, sfx: () => {}, ...extra });
  } finally {
    document.createElement = realCreate;
  }
  const input = createInput();
  for (let t = 0, n = 0; t < secs && !inst.done; t += 1 / 30, n++) {
    input.beginFrame();
    bot?.(inst, input, n);
    inst.update(1 / 30, input);
    input.endFrame();
  }
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  return { fills: new Set(calls.map((c) => c.fill)), calls, baked: new Set(baked.flat().map((c) => c.fill)) };
}

/** Renders `inst` into a recording canvas that also logs the images it draws: { calls, images: [{ w, h, x, y }] }. */
function frameWithImages(inst) {
  const rc = recordingCanvas();
  const images = [];
  const spy = new Proxy(rc.ctx, { get: (t, k) => (k === 'drawImage' ? (img, ...a) => (img == null && (() => { throw new TypeError('drawImage of ' + img); })(), images.push({ w: img?.width, h: img?.height, x: a.length >= 8 ? a[4] : a[0], y: a.length >= 8 ? a[5] : a[1] })) : t[k]), set: (t, k, v) => ((t[k] = v), true) });
  inst.render(spy);
  return { calls: rc.calls, images };
}

/** Plays a game with `bot(inst, input, frame)` at 60 fps and returns the most fills any (every 4th) frame took, and the images drawn then. */
function peakFrame(id, bot, { difficulty = 0.6, secs = 80 } = {}) {
  const inst = MINIGAMES[id].create({ difficulty, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let peak = { calls: [], images: [] };
  for (let i = 0; i < secs * 60; i++) {
    input.beginFrame();
    bot?.(inst, input, i);
    inst.update(1 / 60, input);
    input.endFrame();
    if (i % 4 === 0 || inst.done) {
      const f = frameWithImages(inst);
      if (f.calls.length > peak.calls.length) peak = f;
    }
    if (inst.done) break;
  }
  return peak;
}

const dishesBot = (inst, input) => {
  const p = inst.peek();
  input.keyUp('ArrowLeft'), input.keyUp('ArrowRight');
  if (p.phase === 'scrub') input.keyDown(p.last === 'L' ? 'ArrowRight' : 'ArrowLeft');
  if (p.phase === 'rack' && Math.abs(p.plateX - p.target) < p.tol / 2) input.pointer.clicked = true;
};
const sandBot = (inst, input) => {
  const p = inst.peek();
  if (!p.falling && Math.abs(p.offset) < 8) input.pointer.clicked = true;
};

test('Boss Alert: the boss is a pitch figure (dark suit, red tie) with his feet at y 112', () => {
  const { fills, calls } = lastFrame('stealth', 6);
  expect(fills.has('#22242e') && fills.has('#e2304a')).toBe(true);
  // A walker's shadow (3 rows centred on its feet) sits at the new floor line.
  expect(calls.some((c) => c.fill === 'rgba(0,0,0,0.25)' && c.y === 111)).toBe(true);
});

test('Boss Alert: only the moving parts are drawn per frame (the scenery is baked)', () => {
  const { calls } = lastFrame('stealth', 6);
  expect(calls.length).toBeLessThan(900);
});

test('Boss Alert: you are seen from behind with your own hair colour', () => {
  const player = { skin: '#aa7755', hair: '#12ab34', top: '#dfe6ee', pants: '#3a3f55', skirt: null, tie: null, lapel: null, collar: '#dfe6ee', long: false, brow: '#0a5a1a', corp: '#1f70c1' };
  expect(lastFrame('stealth', 1, { player }).baked.has('#12ab34')).toBe(true);
  expect(lastFrame('stealth', 1).baked.has('#12ab34')).toBe(false);
});

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

test('Smoke Break: the ash on the cigarette darkens near the limit, like the ash gauge', async () => {
  const { shade } = await import('../src/engine/mgart.js');
  const LIGHT = '#b4b8c0'; // the ash's top row
  const DARK = shade(LIGHT, -0.3);
  const inst = MINIGAMES.cigarette.create({ difficulty: 0.3, rng: createRng(3), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const seen = { early: null, late: null };
  for (let i = 0; i < 30 * 20 && !(seen.early && seen.late); i++) {
    input.beginFrame();
    const p = inst.peek();
    if (p.lit && p.heat < 0.6) input.keyDown('Space');
    else input.keyUp('Space');
    inst.update(1 / 30, input);
    input.endFrame();
    const q = inst.peek();
    const k = q.ash / q.ashMax;
    const slot = k > 0.2 && k < 0.6 ? 'early' : k > 0.8 && k < 1 ? 'late' : null;
    if (slot && !seen[slot]) {
      const rec = recordingCanvas();
      inst.render(rec.ctx);
      seen[slot] = new Set(rec.calls.map((c) => c.fill));
    }
  }
  expect(seen.early.has(LIGHT) && !seen.early.has(DARK)).toBe(true);
  expect(seen.late.has(DARK) && !seen.late.has(LIGHT)).toBe(true);
});

test('Smoke Break: the sky comes from the theme (dusk by default), never from the clock', () => {
  const dusk = lastFrame('cigarette', 0);
  expect(dusk.baked.has('#2e2350') && dusk.calls.some((c) => c.fill === '#e0a878')).toBe(true);
  const night = lastFrame('cigarette', 0, { theme: { dept: 'lobby', title: 'T', sky: 'night' } });
  expect(night.baked.has('#05060f')).toBe(true);
  expect(night.baked.has('#2e2350')).toBe(false);
  expect(night.calls.some((c) => c.fill === '#8a5a5a')).toBe(true);
  const day = lastFrame('cigarette', 0, { theme: { dept: 'lobby', title: 'T', sky: 'day' } });
  expect(day.baked.has('#5fa8e8')).toBe(true);
});

test('Smoke Break: the scenery is baked; the antenna light blinks per frame and is not in the bake', () => {
  const { calls, baked } = lastFrame('cigarette', 0);
  expect(calls.length).toBeLessThan(500);
  expect(baked.has('#ff5050')).toBe(false);
  const lights = new Set();
  const inst = MINIGAMES.cigarette.create({ difficulty: 0.3, rng: createRng(3), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  for (let i = 0; i < 40; i++) {
    input.beginFrame();
    inst.update(1 / 30, input);
    input.endFrame();
    const rec = recordingCanvas();
    inst.render(rec.ctx);
    lights.add(rec.calls.some((c) => c.fill === '#ff5050'));
  }
  expect(lights.size).toBe(2);
});

test('Deep Tissue: knots spawn on the back only (below the head, above the towel)', () => {
  const inst = MINIGAMES.massage.create({ difficulty: 0, rng: createRng(1), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let seen = 0;
  for (let t = 0; t < 10; t += 1 / 30) {
    input.beginFrame();
    inst.update(1 / 30, input);
    input.endFrame();
    for (const k of inst.peek().knots) {
      seen++;
      expect(k.x).toBeGreaterThanOrEqual(196 + 12);
      expect(k.x).toBeLessThanOrEqual(284 - 12);
      expect(k.y).toBeGreaterThanOrEqual(124 + 12);
      expect(k.y).toBeLessThanOrEqual(228 - 12);
    }
  }
  expect(seen).toBeGreaterThan(0);
});

test('Deep Tissue: the hand clamps to the back and the mouse reaches all of it', () => {
  const inst = MINIGAMES.massage.create({ difficulty: 0, rng: createRng(5), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const moveTo = (x, y) => {
    input.beginFrame();
    Object.assign(input.pointer, { inside: true, moved: true, x, y });
    inst.update(1 / 30, input);
    input.endFrame();
    return inst.peek().hand;
  };
  expect(moveTo(0, 270)).toMatchObject({ x: 196, y: 228 });
  expect(moveTo(480, 30)).toMatchObject({ x: 284, y: 124 });
  expect(moveTo(240, 176)).toMatchObject({ x: 240, y: 176 });
});

test('Deep Tissue: the guest has the player\'s skin and long hair with a skirt', () => {
  const player = { skin: '#6b4228', hair: '#d9b25c', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  const { fills, baked } = lastFrame('massage', 0.1, { player });
  expect(fills.has('#6b4228')).toBe(true);
  expect(fills.has('#d9b25c')).toBe(true);
  expect(lastFrame('massage', 0.1).fills.has('#6b4228')).toBe(false);
  // The floor, table, towel and props are baked, not redrawn every frame.
  expect(baked.size).toBeGreaterThan(5);
  expect(lastFrame('massage', 0.1, { player }).calls.length).toBeLessThan(400);
});

test('Deep Tissue: with the hand left where it starts, the first knot appears within 2 s (seeds 1-12)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const inst = MINIGAMES.massage.create({ difficulty: 0, rng: createRng(seed), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
    const input = createInput();
    let first = -1;
    for (let t = 0; t < 2 && first < 0; t += 1 / 30) {
      input.beginFrame();
      inst.update(1 / 30, input);
      input.endFrame();
      if (inst.peek().knots.length) first = t;
    }
    expect(first, `seed ${seed}`).toBeGreaterThanOrEqual(0);
  }
});

test('Deep Tissue: a second knot follows the first 0.8 s later (later only when a spot by the hands is retried)', () => {
  const gaps = [];
  for (let seed = 1; seed <= 12; seed++) {
    const inst = MINIGAMES.massage.create({ difficulty: 0, rng: createRng(seed), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
    const input = createInput();
    const at = [];
    for (let n = 1; n <= 60 * 5 && at.length < 2; n++) {
      input.beginFrame();
      inst.update(1 / 60, input);
      input.endFrame();
      if (inst.peek().knots.length > at.length) at.push(n / 60);
    }
    expect(at.length, `seed ${seed}`).toBe(2);
    gaps.push(at[1] - at[0]);
  }
  for (const gap of gaps) expect(gap).toBeGreaterThan(0.8 - 1 / 60);
  expect(gaps.some((gap) => Math.abs(gap - 0.8) <= 1 / 60)).toBe(true);
});

test('Pool Ball: the ball bounces where its bottom meets your raised hands (centre y 148), never drawn over them', () => {
  const inst = MINIGAMES.beachball.create({ difficulty: 0, rng: createRng(5), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let lowest = 0;
  let checked = 0;
  for (let t = 0; t < 8; t += 1 / 60) {
    input.beginFrame();
    const p = inst.peek();
    // Stay under the ball.
    const dx = p.ball.x - p.you.x;
    Object.assign(input.pointer, { inside: false });
    if (dx < -4) input.keyDown('ArrowLeft'); else input.keyUp('ArrowLeft');
    if (dx > 4) input.keyDown('ArrowRight'); else input.keyUp('ArrowRight');
    const vy = p.ball.vy;
    inst.update(1 / 60, input);
    input.endFrame();
    const q = inst.peek();
    if (!q.ball.wet) lowest = Math.max(lowest, q.ball.y);
    if (vy > 0 && q.ball.vy < 0) {
      // The bounce frame: the ball image (28 px, centred) ends at or above the hands' top (skin rows from y 162).
      const f = frameWithImages(inst);
      const ballImg = f.images.find((im) => im.w === 28 && im.h === 28);
      const handsTop = Math.min(...f.calls.filter((c) => c.fill === DEFAULT_PLAYER.skin && c.w === 6 && c.h === 6).map((c) => c.y));
      expect(handsTop).toBe(162);
      expect(ballImg.y + 28).toBeLessThanOrEqual(handsTop);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
  expect(lowest).toBeLessThanOrEqual(150);
  expect(lowest).toBeGreaterThan(140);
});

test('mgscenery: hotelFacade draws at its default spot (x 70, y 30) or moved as a whole', async () => {
  const { hotelFacade } = await import('../src/engine/mgscenery.js');
  const at = (...xy) => {
    const { ctx, calls } = recordingCanvas();
    hotelFacade(ctx, ...xy);
    return calls;
  };
  const home = at();
  expect(home[0]).toMatchObject({ x: 70, y: 34, w: 340, h: 120, fill: '#e8d6b4' });
  expect(at(70, 30)).toEqual(home);
  const moved = at(100, 10);
  expect(moved).toEqual(home.map((c) => ({ ...c, x: c.x + 30, y: c.y - 20 })));
});

test('Pool Ball: a skirt career swims in a suit in the corporate colour, trousers in trunks', () => {
  const skirt = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  expect(lastFrame('beachball', 0.1, { player: skirt }).fills.has('#c03030')).toBe(true);
  const trousers = { ...skirt, skirt: null, long: false, corp: '#2a6ad1' };
  expect(lastFrame('beachball', 0.1, { player: trousers }).fills.has('#2a6ad1')).toBe(true);
  expect(lastFrame('beachball', 0.1, { player: trousers }).fills.has('#c03030')).toBe(false);
});

test('Pool Ball: the scenery is baked and a frame stays cheap; the ball has a see-through shadow on the water', () => {
  const { calls, baked } = lastFrame('beachball', 0.1);
  expect(baked.has('#e8d6b4')).toBe(true); // the hotel facade
  expect(calls.length).toBeLessThan(150);
  const shadow = calls.filter((c) => c.fill === '#0a3a5a' && c.w === 16 && c.h === 2 && c.y === 216);
  expect(shadow).toHaveLength(1);
  expect(shadow[0].alpha).toBeGreaterThan(0);
  expect(shadow[0].alpha).toBeLessThan(1);
  expect(calls.at(-1).alpha).toBe(1); // restored after the water's see-through layer
});

test('Pool Ball: no shadow while the ball is in the water', () => {
  const inst = MINIGAMES.beachball.create({ difficulty: 0, rng: createRng(5), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  input.keyDown('ArrowLeft'); // walk away from the ball and let it drop
  for (let n = 0; n < 60 * 10 && !inst.peek().ball.wet; n++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
  }
  expect(inst.peek().ball.wet).toBeGreaterThan(0);
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  expect(calls.some((c) => c.fill === '#0a3a5a')).toBe(false);
});

test('Sandcastle: the pail is baked tapered and drawn every frame, the castle tiers too (images from `built`, not baked into the beach)', () => {
  const bakes = [];
  const real = document.createElement;
  document.createElement = () => {
    const rc = recordingCanvas(16, 16);
    bakes.push(rc);
    return rc.canvas;
  };
  let inst;
  try {
    inst = MINIGAMES.sandcastle.create({ difficulty: 0, rng: createRng(1), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  } finally {
    document.createElement = real;
  }
  // The pail, baked once: rows of decreasing width in its blue.
  const pailBake = bakes.find((b) => b.canvas.width === 34 && b.canvas.height === 40);
  expect(new Set(pailBake.calls.filter((c) => c.fill === '#3b6fb6').map((c) => c.w)).size).toBeGreaterThan(2);
  const first = frameWithImages(inst);
  expect(first.calls.some((c) => c.fill === '#3b6fb6')).toBe(false); // no rects drawn turned (they would come out blurred)
  expect(first.images.filter((im) => im.w === 34 && im.h === 40)).toHaveLength(1);
  const tierImages = (f) => f.images.filter((im) => im.h === 20 && im.w >= 46 && im.w <= 96 && im.w % 10 === 6);
  // Nothing is built yet: no tier image in the frame.
  expect(tierImages(first)).toHaveLength(0);
  // Let a bot build a few layers: one tier image per layer built appears in the frame itself, every frame.
  const input = createInput();
  for (let i = 0; i < 8 * 60; i++) {
    input.beginFrame();
    sandBot(inst, input);
    inst.update(1 / 60, input);
    input.endFrame();
  }
  const built = inst.peek().built;
  expect(built).toBeGreaterThanOrEqual(2);
  expect(tierImages(frameWithImages(inst)).length).toBeGreaterThanOrEqual(built); // plus the falling one, if any
  // Widest at the bottom: the layers taper (96, 86, ...).
  const widths = tierImages(frameWithImages(inst)).map((im) => im.w).sort((a, b) => b - a);
  expect(widths[0]).toBe(96);
});

test('Sandcastle: the tipped pail is a turned image drawn without smoothing (hard pixel edges)', () => {
  const inst = MINIGAMES.sandcastle.create({ difficulty: 0, rng: createRng(1), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let seen = 0;
  for (let i = 0; i < 4 * 60; i++) {
    input.beginFrame();
    sandBot(inst, input);
    inst.update(1 / 60, input);
    input.endFrame();
    const rc = recordingCanvas();
    rc.ctx.imageSmoothingEnabled = true; // as if the host had left it on
    let rotated = false;
    const spy = new Proxy(rc.ctx, {
      get: (t, k) =>
        k === 'rotate' ? (a) => (rotated = a !== 0)
        : k === 'drawImage' ? (img) => {
          if (img.width === 34 && img.height === 40) {
            expect(t.imageSmoothingEnabled).toBe(false);
            if (rotated) seen++;
          }
        }
        : t[k],
      set: (t, k, v) => ((t[k] = v), true),
    });
    inst.render(spy);
  }
  expect(seen).toBeGreaterThan(0);
});

test('Sandcastle: the beach is baked (sea, sand, parasol) and a frame stays cheap', () => {
  const { calls, baked } = lastFrame('sandcastle', 0.1);
  expect(baked.has('#8fd0f0') || baked.has('#5aa8e0')).toBe(true); // the sky bands
  expect(baked.has('#f2c14e')).toBe(true); // the parasol stripes
  expect(calls.length).toBeLessThan(900);
});

test('Squeaky Clean: the plate has a blue patterned rim (baked once, drawn as an image)', () => {
  expect(lastFrame('dishes', 0.1).baked.has('#3b6fb6')).toBe(true);
});

test('Squeaky Clean: the kitchen is baked, a frame stays cheap, the free slot has its arrow at RACK.x', () => {
  const { calls, baked } = lastFrame('dishes', 0.1);
  expect(baked.has('#eef2ee')).toBe(true); // the subway tiles
  expect(calls.length).toBeLessThan(1500);
  // The green arrow's rows are centred on the free slot, x 340 (the game's RACK.x).
  const arrow = calls.filter((c) => c.fill === '#5fd068' && c.h === 1);
  expect(arrow.length).toBeGreaterThan(3);
  for (const c of arrow) expect(c.x + c.w / 2).toBeCloseTo(340.5, 0);
});

test('Squeaky Clean: racked plates are drawn per frame, one per plate that landed', () => {
  const inst = MINIGAMES.dishes.create({ difficulty: 0, rng: createRng(2), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  // A racked plate is one baked image drawn once per plate that landed, centred on the rack's slots from the left
  // (RACK.x 340 + slot * 12: 280, 292, ...). Found by what changes between frames, not by its size or colours.
  const draws = () => {
    const rc = recordingCanvas();
    const by = new Map();
    const spy = new Proxy(rc.ctx, {
      get: (t, k) => (k === 'drawImage' ? (img, x, y) => by.set(img, [...(by.get(img) || []), { x, y, w: img.width }]) : t[k]),
      set: (t, k, v) => ((t[k] = v), true),
    });
    inst.render(spy);
    return by;
  };
  const before = draws();
  const input = createInput();
  let landed = 0;
  for (let i = 0; i < 40 * 60 && landed < 2; i++) {
    input.beginFrame();
    const p = inst.peek();
    if (p.phase === 'scrub') input.keyDown(p.last === 'L' ? 'ArrowRight' : 'ArrowLeft');
    else input.keyUp('ArrowLeft'), input.keyUp('ArrowRight');
    if (p.phase === 'rack' && Math.abs(p.plateX - p.target) < p.tol / 2) {
      input.pointer.clicked = true;
      landed++;
    }
    inst.update(1 / 60, input);
    input.endFrame();
    input.keyUp('ArrowLeft'), input.keyUp('ArrowRight');
  }
  const after = draws();
  const grew = [...after].filter(([img, at]) => at.length === (before.get(img)?.length || 0) + 2);
  expect(grew).toHaveLength(1);
  expect(grew[0][1].map((d) => d.x + d.w / 2)).toEqual([280, 292]);
});

test('mgscenery: the flat (subway tiles, worktop with cabinets, a potted plant)', async () => {
  const { subway, counter, pottedPlant } = await import('../src/engine/mgscenery.js');
  const a = recordingCanvas();
  subway(a.ctx, 0, 18, 480, 140);
  expect(new Set(a.calls.map((c) => c.fill)).has('#eef2ee')).toBe(true);
  const b = recordingCanvas();
  counter(b.ctx, 176);
  expect(b.calls.some((c) => c.fill === '#d4ae7c')).toBe(true);
  const c = recordingCanvas();
  pottedPlant(c.ctx, 60, 238);
  expect(c.calls.some((q) => q.fill === '#b0603a')).toBe(true);
  expect(c.calls.some((q) => q.fill === '#2f8a3a')).toBe(true);
});

const SLEEPER = { skin: '#f2c9a0', hair: '#a33b20', top: '#dfe6ee', pants: '#3a3f55', skirt: null, long: false, corp: '#2a6ad1' };

test('Counting Sheep: you sleep in the bed with your hair colour, long hair on the pillow with a skirt', () => {
  expect(lastFrame('sleep', 0.1, { player: SLEEPER }).fills.has('#a33b20')).toBe(true);
  expect(lastFrame('sleep', 0.1).fills.has('#a33b20')).toBe(false);
  const hair = (p) => lastFrame('sleep', 0.1, { player: p }).calls.filter((c) => c.fill === '#a33b20').length;
  expect(hair({ ...SLEEPER, skirt: '#2a6ad1', long: true })).toBeGreaterThan(hair(SLEEPER));
});

test('Counting Sheep: the meadow is baked, the sheep and sleeper are drawn per frame, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('sleep', 3);
  expect(baked.has('#0e1430')).toBe(true); // the sky bands
  expect(baked.has('#a8864c')).toBe(true); // the fence rails
  expect(baked.has('#2fa39a')).toBe(true); // the blanket
  expect(calls.length).toBeLessThan(500);
});

test('Counting Sheep: a counted sheep turns yellow (the game marks it, the art follows)', () => {
  const inst = MINIGAMES.sleep.create({ difficulty: 0, rng: createRng(1), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const wool = () => {
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    return new Set(calls.map((c) => c.fill));
  };
  for (let i = 0; i < 6 * 60 && !inst.peek().airborne; i++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
  }
  expect(inst.peek().airborne).toBe(true);
  expect(wool().has('#fff3b8')).toBe(false);
  input.beginFrame();
  input.keyDown(' ');
  inst.update(1 / 60, input);
  input.endFrame();
  expect(wool().has('#fff3b8')).toBe(true);
});

const { dishesFor, foodFor } = await import('../src/minigames/buffet.js');
/** A seeded rng that always serves the dish called `name` (the lists' order does not matter). */
const dishOf = (dept, name) => ({ ...createRng(7), pick: () => dishesFor({ dept }).find((d) => d.name === name) });

test('Lobster: the buffet shows food sprites (the lobster red) on a teal runner', () => {
  const { fills, baked } = lastFrame('buffet', 2, { rng: dishOf('exec', 'Lobster') });
  expect(fills.has('#e2504a')).toBe(true);
  expect(baked.has('#5fd0c8')).toBe(true);
  expect(baked.has('#d8343a')).toBe(false);
});

test('Christmas buffet: the party gets its own food sprites on a red runner', () => {
  const { fills, baked } = lastFrame('buffet', 2, { rng: dishOf('party', 'Turkey'), theme: { dept: 'party', title: 'Christmas Buffet' } });
  expect(fills.has('#b8763a')).toBe(true); // the turkey
  expect(fills.has('#e2504a')).toBe(false); // no lobster
  expect(baked.has('#d8343a')).toBe(true); // the red runner
  expect(baked.has('#5fd0c8')).toBe(false);
});

test('Lobster: every dish of both lists has a food sprite, by name; the Christmas ones use their own colour', () => {
  for (const dept of ['exec', 'party']) {
    for (const d of dishesFor({ dept })) {
      const f = foodFor(d.name);
      expect(f, d.name).toBeTruthy();
      expect(f.map.split('|').length).toBeLessThanOrEqual(10);
      if (dept === 'party') expect(Object.values(f.pal), d.name).toContain(d.a);
    }
  }
});

test('Christmas buffet: the candy cane has a dark outline all round, so it stands out on the pale platter', () => {
  const f = foodFor('Candy cane');
  const rows = f.map.split('|');
  const at = (x, y) => (rows[y] && rows[y][x]) || '.';
  const edge = new Set();
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === '.')) edge.add(ch);
  }));
  expect(edge.size).toBe(1);
  const outline = f.pal[[...edge][0]];
  const lum = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).reduce((a, v) => a + v, 0) / 765;
  expect(lum(outline)).toBeLessThan(0.3);
  expect(Object.values(f.pal)).toContain('#f4f1e8');
  expect(Object.values(f.pal)).toContain('#d8343a');
});

test('Christmas buffet: the holly wreath is a ring (the runner shows through its middle) with red berries', () => {
  const { baked } = (() => {
    const all = [];
    const real = document.createElement;
    document.createElement = () => {
      const rc = recordingCanvas(16, 16);
      all.push(rc.calls);
      return rc.canvas;
    };
    try {
      MINIGAMES.buffet.create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'party', title: 'T' }, sfx: () => {} });
    } finally {
      document.createElement = real;
    }
    return { baked: all[0] };
  })();
  const mid = 145; // the runner's middle row (AREA.y + AREA.h / 2)
  const lastAt = (x, y) => baked.filter((c) => c.x <= x && x < c.x + c.w && c.y <= y && y < c.y + c.h).at(-1)?.fill;
  expect(lastAt(240, mid)).toBe('#d8343a'); // the runner, through the hole
  const greens = new Set(['#2f8a3a', '#1f6a2a']);
  expect([[228, mid], [252, mid], [240, mid - 7], [240, mid + 7]].every(([x, y]) => greens.has(lastAt(x, y)) || lastAt(x, y) === '#e83a40')).toBe(true);
  expect(baked.some((c) => c.fill === '#e83a40')).toBe(true); // berries
});

test('All You Can Eat: a new dish shows its food from its first frame, rising onto the platter', () => {
  const inst = MINIGAMES.buffet.create({ difficulty: 0.5, rng: dishOf('exec', 'Lobster'), theme: { dept: 'exec', title: 'T' }, sfx: () => {} });
  const input = createInput();
  for (let n = 0; n < 60 && !inst.peek().items.length; n++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
  }
  expect(inst.peek().items).toHaveLength(1);
  const { ctx, calls } = recordingCanvas();
  inst.render(ctx);
  expect(calls.some((c) => c.fill === '#e2504a')).toBe(true);
});

test('Lobster: the room is baked and a frame with four dishes stays cheap', () => {
  const { calls, baked } = lastFrame('buffet', 4);
  expect(baked.has('#f4f1e8')).toBe(true); // the tablecloth
  expect(baked.has('#6e4529')).toBe(true); // the floor
  expect(calls.length).toBeLessThan(900);
});

const SWIMMER = { skin: '#f2c9a0', hair: '#a33b20', top: '#dfe6ee', pants: '#3a3f55', skirt: null, long: false, corp: '#2a6ad1' };
const SWIMSUIT = { ...SWIMMER, skirt: '#c03030', long: true, corp: '#c03030' };
const hairRects = (id, p, secs = 0.1) => lastFrame(id, secs, { player: p }).calls.filter((c) => c.fill === '#a33b20').length;

for (const id of ['swim', 'sunbathe']) {
  test(`${id}: a skirt career wears a swimsuit in the corporate colour with long hair, trousers trunks and short hair`, () => {
    expect(lastFrame(id, 0.1, { player: SWIMSUIT }).fills.has('#c03030')).toBe(true);
    expect(lastFrame(id, 0.1, { player: SWIMMER }).fills.has('#2a6ad1')).toBe(true);
    expect(lastFrame(id, 0.1, { player: SWIMMER }).fills.has('#c03030')).toBe(false);
    expect(hairRects(id, SWIMMER)).toBeGreaterThan(0);
    expect(hairRects(id, SWIMSUIT)).toBeGreaterThan(hairRects(id, SWIMMER));
  });
}

test('Swim to the Buoy: the beach and sea are baked, the swimmer and ripples are drawn per frame, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('swim', 0.1);
  expect(baked.has('#e8d6b4')).toBe(true); // the hotel on the far beach
  expect(baked.has('#b98a5a')).toBe(true); // the jetty
  expect(baked.has('#3a9ad4')).toBe(true); // the sea bands
  expect(calls.length).toBeLessThan(250);
});

test('Swim to the Buoy: an arm is up out of the water during a stroke and reaches ahead between strokes', () => {
  const armUp = (c) => c.fill === '#f2c9a0' && c.w === 6 && c.h === 18;
  expect(lastFrame('swim', 0.1, { player: SWIMMER }).calls.some(armUp)).toBe(false);
  const stroke = (inst, input, n) => n === 0 && input.keyDown(' ');
  expect(lastFrame('swim', 0.05, { player: SWIMMER, bot: stroke }).calls.some(armUp)).toBe(true);
});

test('Swim to the Buoy: on the way back the swimmer is drawn mirrored, facing the jetty', async () => {
  const { swimmer } = await import('../src/minigames/swim.js');
  const draw = (back) => {
    const { ctx, calls } = recordingCanvas();
    swimmer(ctx, 200, 100, false, back, SWIMSUIT);
    return calls.map(({ x, y, w, h, fill, alpha }) => ({ x, y, w, h, fill, alpha }));
  };
  const key = (c) => [c.x, c.y, c.w, c.h, c.fill, c.alpha].join();
  const axis2 = 2 * 200 + 27; // twice the mirror axis (x + 13.5)
  const out = draw(false);
  const mirrored = out.map((c) => ({ ...c, x: axis2 - c.x - c.w }));
  expect(draw(true).map(key).sort()).toEqual(mirrored.map(key).sort());
  // In the game: the goggle is right of the suit on the way out, left of it on the way back.
  const inst = MINIGAMES.swim.create({ difficulty: 0.5, rng: createRng(1), theme: { dept: 'exec', title: 'T' }, sfx: () => {}, player: SWIMMER });
  const input = createInput();
  const facing = () => {
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    const goggle = calls.find((c) => c.fill === '#1a1a22' && c.w === 6 && c.h === 3);
    const trunks = calls.find((c) => c.fill === SWIMMER.corp && c.w === 12);
    return Math.sign(goggle.x - trunks.x);
  };
  expect(facing()).toBe(1);
  for (let n = 0; n < 60 * 8 && !inst.peek().back; n++) {
    input.beginFrame();
    if (inst.peek().canStroke) input.keyDown(' ');
    else input.keyUp(' ');
    inst.update(1 / 60, input);
    input.endFrame();
  }
  expect(inst.peek().back).toBe(true);
  expect(facing()).toBe(-1);
});

test('Golden Brown: the skin starts as your own and tans warmer and darker, on every skin tone', async () => {
  const { SKIN_TONES } = await import('../src/data/corpColors.js');
  const { skinAt } = await import('../src/minigames/sunbathe.js');
  const lum = (h) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16);
  const torso = (p, secs) => lastFrame('sunbathe', secs, { player: p }).calls.find((c) => c.w === 60 && c.h === 42 && c.fill !== '#2fa39a').fill;
  const dark = { ...SWIMMER, skin: '#6b4228' };
  expect(torso(dark, 0)).toBe('#6b4228'); // tan 0: exactly your own skin
  expect(torso(dark, 3)).not.toBe('#6b4228');
  expect(lum(torso(dark, 3))).toBeLessThan(lum('#6b4228'));
  for (const skin of SKIN_TONES) {
    let last = lum(skin);
    for (let tan = 0.05; tan <= 0.7001; tan += 0.05) {
      const l = lum(skinAt(skin, tan));
      expect(l, `${skin} at tan ${tan.toFixed(2)}`).toBeLessThanOrEqual(last);
      last = l;
    }
    expect(lum(skinAt(skin, 0.7)), skin).toBeLessThan(lum(skin) - 5);
    expect(skinAt(skin, 0)).toBe(skin);
  }
});

test('Golden Brown: the skin is golden through the whole golden window and only burns red past it, to lobster at 1', async () => {
  const { SKIN_TONES } = await import('../src/data/corpColors.js');
  const { skinAt, GOLD } = await import('../src/minigames/sunbathe.js');
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const LOBSTER = '#e2504a';
  const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  for (const skin of SKIN_TONES) {
    // Inside the window it only gets darker: no channel rises (no red creeping in).
    let prev = rgb(skinAt(skin, GOLD[0]));
    for (let tan = GOLD[0] + 0.02; tan <= GOLD[1] + 1e-9; tan += 0.02) {
      const now = rgb(skinAt(skin, tan));
      now.forEach((v, i) => expect(v, `${skin} at ${tan.toFixed(2)}`).toBeLessThanOrEqual(prev[i]));
      prev = now;
    }
    // Past it, every step is closer to the lobster red, which it reaches at 1.
    let d = dist(skinAt(skin, GOLD[1]), LOBSTER);
    for (let tan = GOLD[1] + 0.02; tan < 1; tan += 0.02) {
      const now = dist(skinAt(skin, tan), LOBSTER);
      expect(now, `${skin} at ${tan.toFixed(2)}`).toBeLessThan(d);
      d = now;
    }
    expect(skinAt(skin, 1)).toBe(LOBSTER);
  }
});

test('Golden Brown: face up with sunglasses, face down after a turn (all hair)', () => {
  const glasses = (c) => c.fill === '#1a1a22' && c.w === 6 && c.h === 9;
  expect(lastFrame('sunbathe', 0.1, { player: SWIMMER }).calls.some(glasses)).toBe(true);
  const turn = (inst, input, n) => n === 3 && input.keyDown(' ');
  expect(lastFrame('sunbathe', 1, { player: SWIMMER, bot: turn }).calls.some(glasses)).toBe(false);
});

test('Golden Brown: sand, towel and beach things are baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('sunbathe', 0.1);
  expect(baked.has('#ecd9a0')).toBe(true); // sand
  expect(baked.has('#24877e')).toBe(true); // towel
  expect(baked.has('#f29c38')).toBe(true); // sun, sunscreen
  expect(calls.length).toBeLessThan(200);
});

test('Pina Colada: the sunset, palms, thatch and bar are baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('cocktail', 0.1);
  for (const c of ['#e85d75', '#fff6c8', '#3a2440', '#c9a14a', '#c8a050']) expect(baked.has(c), c).toBe(true);
  expect(calls.length).toBeLessThan(250);
});

test('Pina Colada: the catcher is a hurricane glass that fills with pina colada as fruit lands in it', () => {
  const cream = '#f6e8b8';
  expect(lastFrame('cocktail', 0.1).fills.has(cream)).toBe(false); // empty to begin with
  const chase = (inst, input) => {
    const p = inst.peek();
    const low = p.fruit.reduce((b, f) => (!b || f.y > b.y ? f : b), null);
    if (!low || Math.abs(low.x - p.glass.x) < 4) return;
    input.keyDown(low.x < p.glass.x ? 'ArrowLeft' : 'ArrowRight');
    input.keyUp(low.x < p.glass.x ? 'ArrowRight' : 'ArrowLeft');
  };
  const { calls } = lastFrame('cocktail', 12, { bot: chase });
  expect(calls.some((c) => c.fill === cream)).toBe(true);
});

test('Pina Colada: every fruit caught raises the drink, up to a full glass at the goal', () => {
  const cream = '#f6e8b8';
  const inst = MINIGAMES.cocktail.create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const rowsOf = () => {
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    return calls.filter((c) => c.fill === cream).length;
  };
  const levels = [rowsOf()];
  for (let n = 0; n < 60 * 30 && !inst.done; n++) {
    input.beginFrame();
    const p = inst.peek();
    const low = p.fruit.reduce((b, f) => (!b || f.y > b.y ? f : b), null);
    input.keyUp('ArrowLeft'), input.keyUp('ArrowRight');
    if (low && Math.abs(low.x - p.glass.x) >= 4) input.keyDown(low.x < p.glass.x ? 'ArrowLeft' : 'ArrowRight');
    inst.update(1 / 60, input);
    input.endFrame();
    if (inst.peek().caught > levels.length - 1) levels.push(rowsOf());
  }
  expect(levels).toHaveLength(11); // empty, then after each of the 10 fruit
  expect(levels[0]).toBe(0);
  for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
  expect(levels[10]).toBe(15); // every row the drink can fill (LIQUID 1..15)
});

test('Pina Colada: every kind of fruit has its own sprite (baked)', () => {
  const { baked } = lastFrame('cocktail', 0.1);
  for (const c of ['#f2e14e', '#f29c38', '#c8302a', '#6a4228', '#3a9a3a']) expect(baked.has(c), c).toBe(true); // pineapple, orange, cherry, coconut, lime
});

test('Dust Buster: dust bunnies have eyes (white pixels on grey fluff, baked once)', () => {
  const fills = lastFrame('vacuum', 0.1).baked;
  expect(fills.has('#8a8a92') && fills.has('#b0b0b8')).toBe(true);
  expect(fills.has('#ffffff')).toBe(true);
});

test('Dust Buster: a cordless stick vacuum (brush head, stick, clear dust cup, battery), no hose', () => {
  const { fills, calls } = lastFrame('vacuum', 0.1);
  for (const c of ['#e2504a', '#9ad0e0', '#5fd068', '#3a3d48', '#f2c14e']) expect(fills.has(c), c).toBe(true);
  expect(calls.some((c) => c.fill === '#6a707c' && c.w === 3 && c.h === 12)).toBe(false); // the old hose
});

test('Dust Buster: the vacuum stays on screen along the right wall: its stick turns to lean left there', () => {
  const inst = MINIGAMES.vacuum.create({ difficulty: 0.5, rng: createRng(3), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const handleSide = (calls) => {
    const head = calls.find((c) => c.fill === '#1a1a22' && c.w === 28 && c.h === 12); // the brush head's outline
    const motor = calls.find((c) => c.fill === '#e2504a' && c.w === 6 && c.h === 4);
    return Math.sign(motor.x + 3 - (head.x + 14));
  };
  const frame = () => {
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    for (const c of calls) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(480);
    }
    return calls;
  };
  expect(handleSide(frame())).toBe(1); // from the start (by the left wall): leaning right
  input.keyDown('ArrowRight');
  for (let n = 0; n < 60 * 4; n++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
    frame();
  }
  expect(inst.peek().vac.x).toBe(442); // against the right wall
  expect(handleSide(frame())).toBe(-1);
});

test('Dust Buster: the living room is baked, a frame draws only the bunnies and the vacuum', () => {
  const { calls, baked } = lastFrame('vacuum', 0.1);
  for (const c of ['#c09060', '#8a3a2a', '#e8dcc8', '#4fba5a', '#3a6a8a']) expect(baked.has(c), c).toBe(true); // planks, rug, wall tops, plant, sofa
  expect(calls.length).toBeLessThan(1000);
});

test('Dust Buster: no bunny starts under the sofa, the TV bench or the armchair', async () => {
  const furniture = [[120, 20, 120, 24], [300, 18, 90, 20], [444, 160, 26, 40]];
  for (let seed = 1; seed <= 20; seed++) {
    const inst = MINIGAMES.vacuum.create({ difficulty: 0.5, rng: createRng(seed), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
    for (const b of inst.peek().dust) for (const [x, y, w, h] of furniture) expect(b.x >= x && b.x < x + w && b.y >= y && b.y < y + h, `seed ${seed}`).toBe(false);
  }
});

test('Separate Cycles: front-loaders with round glass doors', () => {
  const { fills, baked } = lastFrame('laundry', 0.1);
  expect(fills.has('#5a7a98') || baked.has('#5a7a98')).toBe(true);
  for (const c of ['#9aa1ad', '#c8ccd2', '#3a4a5a']) expect(baked.has(c), c).toBe(true); // door rings, glass
});

test('Separate Cycles: the utility room is baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('laundry', 0.1);
  for (const c of ['#e4ecf0', '#b8c8d2', '#8a6038', '#9aa8b4', '#b98a5a']) expect(baked.has(c), c).toBe(true); // tiles, grout, shelf, floor, basket
  expect(calls.length).toBeLessThan(250);
});

test('Separate Cycles: the drum fills with the sorted wash and its colour', () => {
  const sortAll = (inst, input) => {
    const p = inst.peek();
    if (p.item && p.item.y > 40) input.keyDown(p.keys[p.item.bin]), input.keyUp(p.keys[p.item.bin]);
  };
  const orange = (calls) => calls.filter((c) => c.fill === '#f29c38').length;
  const before = orange(lastFrame('laundry', 0.1).calls);
  const after = orange(lastFrame('laundry', 20, { bot: sortAll }).calls);
  expect(after).toBeGreaterThan(before);
});

test('Separate Cycles: every item the game drops has a garment shape, unknown names get the T-shirt', async () => {
  const { ITEM_NAMES, GARMENTS, GARMENT_OF, garmentOf } = await import('../src/minigames/laundry.js');
  expect([...GARMENTS].sort()).toEqual(['hoodie', 'jeans', 'shirt', 'socks', 'towel', 'tshirt']);
  expect(ITEM_NAMES.length).toBeGreaterThanOrEqual(16);
  // Every item is in the map by name (not caught by the T-shirt fallback), with one of the six shapes.
  for (const n of ITEM_NAMES) expect(Object.hasOwn(GARMENT_OF, n), n).toBe(true);
  for (const n of ITEM_NAMES) expect(GARMENTS.includes(garmentOf(n)), n).toBe(true);
  expect(garmentOf('Green hoodie')).toBe('hoodie');
  expect(garmentOf('Blue jeans')).toBe('jeans');
  expect(garmentOf('White socks')).toBe('socks');
  expect(garmentOf('Yellow towel')).toBe('towel');
  expect(garmentOf('Red T-shirt')).toBe('tshirt');
  expect(garmentOf('White shirt')).toBe('shirt');
  expect(garmentOf('Something odd')).toBe('tshirt');
});

test('Separate Cycles: a falling piece is drawn from under the header down to just above the machines', async () => {
  const { shade } = await import('../src/engine/mgart.js');
  const inst = MINIGAMES.laundry.create({ difficulty: 0.5, rng: createRng(4), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const outline = (calls) => calls.filter((c) => inst.peek().item && c.fill === shade(inst.peek().item.color, -0.55)); // the piece's edge
  let lowest = -1;
  let first = null;
  for (let n = 0; n < 60 * 12; n++) {
    input.beginFrame();
    inst.update(1 / 60, input); // nobody sorts: every piece falls to the floor
    input.endFrame();
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    const piece = outline(calls).filter((c) => c.y > 20 && c.y < 260 && c.x > 180 && c.x + c.w < 300);
    if (!piece.length) continue;
    const bottom = Math.max(...piece.map((c) => c.y + c.h));
    first ??= Math.min(...piece.map((c) => c.y));
    lowest = Math.max(lowest, bottom);
  }
  expect(first).toBeGreaterThan(18); // below the header
  expect(lowest).toBeGreaterThan(150);
  expect(lowest).toBeLessThanOrEqual(180); // the machines' tops (BIN_Y): it never sinks into them
});

test('Separate Cycles: the six garments look different and stay inside their box', async () => {
  const { GARMENTS, drawGarment } = await import('../src/minigames/laundry.js');
  const sigs = new Set();
  for (const k of GARMENTS) {
    const { ctx, calls } = recordingCanvas();
    drawGarment(ctx, k, 240, 100, '#2f8a3a');
    expect(calls.length, k).toBeGreaterThan(6);
    for (const c of calls) expect(c.x >= 240 - 34 && c.x + c.w <= 240 + 34 && c.y >= 100 - 28 && c.y + c.h <= 100 + 30, `${k} ${JSON.stringify(c)}`).toBe(true);
    sigs.add(JSON.stringify(calls.map((c) => [c.x, c.y, c.w, c.h])));
  }
  expect(sigs.size).toBe(6);
});

// Task 11: Pressing Matters, Just Right, Home Brew.
test('Pressing Matters: every crease lies on the shirt (body, or a sleeve above its hem), also while it plays', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const inst = MINIGAMES.ironing.create({ difficulty: 0.5, rng: createRng(seed), theme: { dept: 'it', title: 'T' }, sfx: () => {} });
    const seen = new Map();
    const input = createInput();
    for (let n = 0; n < 150; n++) {
      input.beginFrame();
      inst.update(1 / 30, input);
      input.endFrame();
      for (const c of inst.peek().creases) seen.set(`${c.x},${c.y}`, c);
    }
    expect(seen.size, `seed ${seed}`).toBe(10);
    for (const c of seen.values()) {
      const onBody = c.x >= 166 && c.x <= 314;
      const onSleeve = c.y <= 118;
      expect(onBody || onSleeve, `seed ${seed} ${c.x},${c.y}`).toBe(true);
    }
  }
});

test('Pressing Matters: the crease spawner is deterministic for a rng and always ends', () => {
  const make = (seed) => MINIGAMES.ironing.create({ difficulty: 0.5, rng: createRng(seed), theme: { dept: 'it', title: 'T' }, sfx: () => {} }).peek().creases;
  expect(make(3)).toEqual(make(3));
  const never = { ...createRng(1), int: (a) => a, chance: () => false, pick: (l) => l[0] }; // a rng that always answers the same corner
  const inst = MINIGAMES.ironing.create({ difficulty: 0.5, rng: never, theme: { dept: 'it', title: 'T' }, sfx: () => {} });
  expect(inst.peek().creases.length).toBe(10);
  for (const c of inst.peek().creases) expect(c.x >= 166 && c.x <= 314 || c.y <= 118).toBe(true);
});

test('Pressing Matters: the iron\'s cord leaves the top of the handle at the heel, none hangs below', () => {
  const { calls } = lastFrame('ironing', 0.01);
  const ix = 420;
  const iy = 135;
  const handleTop = iy - 8;
  const cord = calls.filter((c) => c.fill === '#1a1a22' && c.w === 2 && c.h === 2 && c.x >= ix + 18 && c.x < ix + 70 && c.y > iy - 80 && c.y < iy + 20);
  expect(cord.length).toBeGreaterThan(10);
  expect(Math.min(...cord.map((c) => c.y))).toBeLessThan(handleTop - 10); // loops up
  expect(Math.max(...cord.map((c) => c.y + c.h))).toBeLessThanOrEqual(handleTop); // the first segment is above the handle's top
  const stub = calls.find((c) => c.fill === '#1a1a22' && c.x === ix + 14 && c.w === 4 && c.h === 2);
  expect(stub.y + stub.h).toBeLessThanOrEqual(handleTop + 2);
});

test('Pressing Matters: board, shirt and floor are baked, a frame draws only creases, iron and text', () => {
  const { calls, baked } = lastFrame('ironing', 0.1);
  for (const c of ['#c09060', '#9fd3f0', '#f4f6f8', '#b8bcc8']) expect(baked.has(c), c).toBe(true); // planks, cover, shirt, buttons
  expect(calls.length).toBeLessThan(250);
});

test('Pressing Matters: the iron shows its heat at a glance, each stage with a colour the others lack', () => {
  const walkThenStand = (inst, input) => {
    if (inst.peek().iron.x > 300) input.keyDown('ArrowLeft');
    else input.keyUp('ArrowLeft');
  };
  // 120 px at 150 px/s takes 0.8 s, then it stands still: heat 0.3 at about 1.3 s, 0.6 at about 1.8 s, a scorch at 2.4 s.
  const stages = [lastFrame('ironing', 0.1).fills, lastFrame('ironing', 1.55, { bot: walkThenStand }).fills, lastFrame('ironing', 2.1, { bot: walkThenStand }).fills];
  stages.forEach((own, i) => {
    const others = new Set(stages.filter((_, j) => j !== i).flatMap((f) => [...f]));
    const unique = [...own].filter((c) => !others.has(c));
    expect(unique.length, `stage ${i}`).toBeGreaterThan(0);
  });
  expect(stages[0].has('#f29c38')).toBe(true); // cool: the approved rim
  expect(stages[1].has('#ff7a1a')).toBe(true); // warm: orange soleplate
  expect(stages[2].has('#ff3020')).toBe(true); // hot: red soleplate
  expect(stages[0].has('#ff7a1a') || stages[0].has('#ff3020')).toBe(false);
});

test('Pressing Matters: the warm and hot glows are baked (orange, red), drawn as one image; a hot frame stays as cheap as a cool one', () => {
  const bakes = [];
  const real = document.createElement;
  document.createElement = () => {
    const rc = recordingCanvas(16, 16);
    bakes.push(rc);
    return rc.canvas;
  };
  let inst;
  try {
    inst = MINIGAMES.ironing.create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  } finally {
    document.createElement = real;
  }
  const glowOf = (colour) => new Set(bakes.filter((b) => b.calls.length && b.calls.every((c) => c.fill === colour)).map((b) => b.canvas));
  const warm = glowOf('#ff9a3a');
  const hot = glowOf('#ff2a1a');
  expect(warm.size).toBe(1);
  expect(hot.size).toBeGreaterThan(1); // the hot glow pulses: one image per size
  const input = createInput();
  const seen = { 0: 0, 1: 0, 2: 0 };
  for (let n = 0; n < 60 * 2.2; n++) {
    input.beginFrame();
    if (inst.peek().iron.x > 300) input.keyDown('ArrowLeft');
    else input.keyUp('ArrowLeft');
    inst.update(1 / 60, input);
    input.endFrame();
    const heat = inst.peek().heat;
    const stage = heat > 0.6 ? 2 : heat > 0.3 ? 1 : 0;
    const rc = recordingCanvas();
    const imgs = [];
    const spy = new Proxy(rc.ctx, { get: (t, k) => (k === 'drawImage' ? (img) => imgs.push(img) : t[k]), set: (t, k, v) => ((t[k] = v), true) });
    inst.render(spy);
    expect(imgs.filter((im) => warm.has(im)).length).toBe(stage === 1 ? 1 : 0);
    expect(imgs.filter((im) => hot.has(im)).length).toBe(stage === 2 ? 1 : 0);
    expect(rc.calls.length, `stage ${stage}`).toBeLessThan(250);
    seen[stage]++;
  }
  expect(seen[1] > 0 && seen[2] > 0).toBe(true);
});

test('Just Right: the water is never grey-brown at any temperature', async () => {
  const { bathWater } = await import('../src/minigames/bath.js');
  for (let temp = 10; temp <= 50; temp += 2) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(bathWater(temp).slice(i, i + 2), 16));
    expect(bathWater(temp)).toMatch(/^#[0-9a-f]{6}$/);
    // Grey-brown: red over blue with low saturation. Ours stays blue-ish or pink: blue always well over green (never
    // brown) and clearly coloured (the least saturated, where red meets blue, is 48; grey would be under 30).
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    expect(sat, `${temp}`).toBeGreaterThanOrEqual(45);
    expect(b - g, `${temp}`).toBeGreaterThanOrEqual(45);
  }
  const [hr, , hb] = [1, 3, 5].map((i) => parseInt(bathWater(50).slice(i, i + 2), 16));
  expect(hr).toBeGreaterThan(hb); // hot is pink (red over blue)
  const [cr, , cb] = [1, 3, 5].map((i) => parseInt(bathWater(15).slice(i, i + 2), 16));
  expect(cb).toBeGreaterThan(cr); // cold is blue
});

test('Just Right: the duck bobs smoothly, a pixel at a time, 2 px up and down', () => {
  const inst = MINIGAMES.bath.create({ difficulty: 0.5, rng: createRng(1), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const ys = [];
  for (let n = 0; n < 60 * 4; n++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    ys.push(calls.find((c) => c.fill === '#1a1a22' && c.w === 2 && c.h === 2 && c.x === 288).y); // the duck's eye
  }
  expect([...new Set(ys)].sort((a, b) => a - b)).toEqual([116, 117, 118, 119, 120]);
  for (let i = 1; i < ys.length; i++) expect(Math.abs(ys[i] - ys[i - 1])).toBeLessThanOrEqual(1);
});

test('Just Right: bubbles rise inside the oval of the water', () => {
  const inst = MINIGAMES.bath.create({ difficulty: 0.5, rng: createRng(5), theme: { dept: 'it', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let seen = 0;
  for (let n = 0; n < 900 && !inst.done; n++) {
    input.beginFrame();
    const p = inst.peek();
    const mid = (p.band[0] + p.band[1]) / 2;
    if (p.temp < mid - 0.4) input.keyDown('ArrowRight'); else input.keyUp('ArrowRight');
    if (p.temp > mid + 0.4) input.keyDown('ArrowLeft'); else input.keyUp('ArrowLeft');
    inst.update(1 / 30, input);
    input.endFrame();
    for (const b of inst.peek().bubbles) {
      seen++;
      for (const [cx, cy] of [[b.x, b.y], [b.x + b.s, b.y], [b.x, b.y + b.s], [b.x + b.s, b.y + b.s]]) {
        expect(((cx - 240) / 112) ** 2 + ((cy - 132) / 20) ** 2, `${cx},${cy}`).toBeLessThanOrEqual(1);
      }
    }
  }
  expect(seen).toBeGreaterThan(20);
});

test('Just Right: the water is baked around, drawn per frame in the temperature colour; a frame stays cheap', async () => {
  const { bathWater } = await import('../src/minigames/bath.js');
  const { calls, baked, fills } = lastFrame('bath', 0.1);
  for (const c of ['#d8eef0', '#b0ccd4', '#e2504a', '#f4f6f8', '#c8a040', '#9aa4b0']) expect(baked.has(c), c).toBe(true); // tiles, grout, towel, enamel, feet, rim
  expect([27.5, 27.7, 27.9, 28].some((tp) => fills.has(bathWater(tp)))).toBe(true); // the start temperature (28) less a little cooling
  expect(calls.length).toBeLessThan(250);
});

test('Home Brew: the kitchen is baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('brew', 0.1);
  for (const c of ['#eef2ee', '#c8d0cc', '#8a6038', '#8a5a32', '#d8dee6', '#9aa0a8', '#fff4c0']) expect(baked.has(c), c).toBe(true); // tiles, grout, shelf, grinder, kettle, worktop, note
  expect(calls.length).toBeLessThan(150);
});

test('Home Brew: the grinder drawer fills with grounds as you grind, the mugs fill as you pour', () => {
  const grounds = (calls) => calls.filter((c) => c.fill === '#5a3a22').reduce((s, c) => s + c.h, 0);
  const mash = (inst, input, n) => (n % 2 ? (input.keyDown(' '), input.keyUp(' ')) : 0);
  const before = grounds(lastFrame('brew', 0.1).calls);
  const after = grounds(lastFrame('brew', 0.3, { bot: mash }).calls);
  expect(after).toBeGreaterThan(before);
  const coffee = (calls) => calls.filter((c) => c.fill === '#6b4a32').reduce((s, c) => s + c.h, 0);
  expect(coffee(lastFrame('brew', 0.1).calls)).toBe(0);
});

test('Photo Booth: you pose in a Santa hat, in a skirt when the career wears one', () => {
  const player = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
  const { fills, calls } = lastFrame('photobooth', 0.1, { player });
  expect(fills.has('#e85a5e')).toBe(true); // the Santa hat's highlight, drawn by nothing else
  expect(fills.has('#c03030')).toBe(true); // the skirt
  expect(calls.some((c) => c.fill === '#5a3620' && c.h >= 15 && c.w <= 3)).toBe(true); // long hair down the sides
});

test('Photo Booth: in trousers, short hair and no skirt colour', () => {
  const player = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: null, long: false, corp: '#c03030' };
  const { fills, calls } = lastFrame('photobooth', 0.1, { player });
  expect(fills.has('#e85a5e')).toBe(true); // still the hat
  expect(fills.has('#3a3f55')).toBe(true); // trousers
  expect(fills.has('#c03030')).toBe(false);
  expect(calls.some((c) => c.fill === '#5a3620' && c.h >= 15 && c.w <= 3)).toBe(false);
});

test('Photo Booth: the curtains and the backdrop are baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('photobooth', 0.1);
  for (const c of ['#8a1a2a', '#a8283a', '#c8e0f0', '#f4f8fc']) expect(baked.has(c), c).toBe(true);
  expect(calls.length).toBeLessThan(450);
});

test('Gift Wrapping: the tape gauge is a strip of tape off its roll', () => {
  expect(lastFrame('giftwrap', 0.1).baked.has('#e8eef4')).toBe(true); // baked once, drawn as an image
});

test('Gift Wrapping: the gauge shows the live band in green and the red mark at the live level', () => {
  const inst = MINIGAMES.giftwrap.create({ difficulty: 0.3, rng: createRng(5), theme: { dept: 'party', title: 'T' }, sfx: () => {} });
  const input = createInput();
  const G = { x: 120, y: 214, w: 240 }; // GAUGE
  let checked = 0;
  for (let n = 0; n < 60 * 3; n++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
    const p = inst.peek();
    if (p.stage === 'bow' || p.stage === 'done') continue;
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    const band = calls.find((c) => c.fill === '#5fd068' && c.h === 10);
    expect(band.x).toBe(Math.round(G.x + G.w * p.band[0]));
    expect(band.w).toBe(Math.round(G.w * (p.band[1] - p.band[0])));
    expect(calls.some((c) => c.fill === '#9af0a0' && c.x === band.x && c.w === band.w && c.h === 2)).toBe(true); // its light edge
    const mark = calls.find((c) => c.fill === '#e2504a' && c.w === 4 && c.h === 18);
    expect(mark.x + 2).toBe(Math.round(G.x + Math.min(G.w, G.w * p.level)));
    checked++;
  }
  expect(checked).toBeGreaterThan(30);
});

test('Gift Wrapping: the Secret Santa table is baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('giftwrap', 0.1);
  for (const c of ['#c8343a', '#2a2038', '#2f8a3a', '#3a5fb6']) expect(baked.has(c), c).toBe(true); // cloth, wall, paper rolls
  expect(calls.length).toBeLessThan(450);
});

test('party scenery: string lights twinkle, the disco ball turns, the tree has its star', async () => {
  const { stringLights, discoBall, xmasTree } = await import('../src/engine/mgscenery.js');
  const draw = (fn, t) => {
    const { ctx, calls } = recordingCanvas();
    fn(ctx, t);
    return calls.map((c) => `${c.x},${c.y},${c.w},${c.h},${c.fill}`).join('|');
  };
  expect(draw((g, t) => stringLights(g, 24, t), 0)).not.toBe(draw((g, t) => stringLights(g, 24, t), 0.6));
  expect(draw((g, t) => discoBall(g, 240, 60, t, 12), 0)).not.toBe(draw((g, t) => discoBall(g, 240, 60, t, 12), 0.3));
  const { ctx, calls } = recordingCanvas();
  xmasTree(ctx, 100, 200, 90, 0);
  expect(calls.filter((c) => c.fill === '#f2c14e').length).toBeGreaterThanOrEqual(2); // the star
});

const PARTY_SKIRT = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: '#c03030', long: true, corp: '#c03030' };
const PARTY_TROUSERS = { ...PARTY_SKIRT, skirt: null, long: false };

test('Dance-Off: you dance in a Santa hat, in a skirt when the career wears one', () => {
  const { fills } = lastFrame('dance', 0.5, { player: PARTY_SKIRT });
  expect(fills.has('#e85a5e')).toBe(true); // the Santa hat's highlight, drawn by nothing else
  expect(fills.has('#c03030')).toBe(true); // the skirt
});

test('Dance-Off: in trousers, the hat and the trousers and no skirt colour', () => {
  const { fills } = lastFrame('dance', 0.5, { player: PARTY_TROUSERS });
  expect(fills.has('#e85a5e')).toBe(true);
  expect(fills.has('#3a3f55')).toBe(true);
  expect(fills.has('#c03030')).toBe(false);
});

test('Dance-Off: the hall wall, the DJ booth and the dark floor are baked, a frame stays cheap', () => {
  const { calls, baked } = lastFrame('dance', 3);
  for (const c of ['#1e1630', '#21183a', '#1a1426', '#141020', '#120c1e']) expect(baked.has(c), c).toBe(true);
  expect(calls.length).toBeLessThan(500);
});

test('Dance-Off: the lit floor tiles move on with the beat', () => {
  const lit = (secs) => lastFrame('dance', secs).calls.filter((c) => c.fill === '#ffffff33').map((c) => `${c.x},${c.y}`).join('|');
  expect(lit(2.2)).not.toBe('');
  expect(lit(2.2)).not.toBe(lit(3.2));
});

test('Carol Karaoke: the choir sings in Santa hats, baked once', () => {
  const { baked, calls } = lastFrame('carols', 0.5);
  expect(baked.has('#e85a5e')).toBe(true);
  for (const c of ['#7a1a2a', '#982838', '#5a3a22', '#2f8a3a']) expect(baked.has(c), c).toBe(true); // drapes, riser, tree
  expect(calls.length).toBeLessThan(500);
});

test('Carol Karaoke: your head sings in a Santa hat once you pick a lane, in the career\'s look', () => {
  const press = (inst, input, n) => (n === 1 ? input.keyDown('ArrowUp') : n === 2 ? input.keyUp('ArrowUp') : 0);
  const hat = (f) => f.calls.filter((c) => c.fill === '#e85a5e'); // your hat's highlight (the choir is baked)
  expect(hat(lastFrame('carols', 0.5))[0].alpha).toBeLessThan(1); // waiting, faded
  const sk = lastFrame('carols', 0.5, { player: PARTY_SKIRT, bot: press });
  expect(hat(sk)[0].alpha).toBe(1); // singing
  const tr = lastFrame('carols', 0.5, { player: PARTY_TROUSERS, bot: press });
  expect(hat(tr)[0].alpha).toBe(1);
  expect(tr.fills.has('#c03030')).toBe(false);
});

test('Dance-Off: over several beats no lit floor tile is drawn inside a lane', () => {
  const lanes = [180, 220, 260, 300].map((x) => ({ x0: x - 18, x1: x + 18, y0: 30, y1: 220 }));
  const tileFills = new Set(['#5a2a6a', '#2a3a7a', '#2a6a5a', '#7a5a2a', '#ffffff33']);
  let seen = 0;
  for (const secs of [2.2, 2.7, 3.2, 3.7, 4.2, 4.7, 5.2, 6]) {
    for (const c of lastFrame('dance', secs).calls) {
      if (!tileFills.has(c.fill) || c.y < 190 || c.w > 36) continue; // the floor's lit tiles (36 x 14) and their highlights
      seen++;
      for (const l of lanes) expect(c.x < l.x1 && c.x + c.w > l.x0 && c.y < l.y1 && c.y + c.h > l.y0, `${c.x},${c.y}`).toBe(false);
    }
  }
  expect(seen).toBeGreaterThan(0);
});

test('Carol Karaoke: the tree is a baked layer drawn after the garland bulbs', () => {
  const { baked } = lastFrame('carols', 0.5);
  expect(baked.has('#24702e')).toBe(true);
  const inst = MINIGAMES.carols.create({ difficulty: 0.3, rng: createRng(7), theme: { dept: 'party', title: 'T' }, sfx: () => {} });
  const rc = recordingCanvas();
  const log = [];
  const spy = new Proxy(rc.ctx, {
    get: (t, k) =>
      k === 'fillRect' ? (x, y, w, h) => (log.push({ bulb: w === 2 && h === 2 && t.fillStyle === '#8a8a8a' }), t.fillRect(x, y, w, h)) // a bulb's cap
      : k === 'drawImage' ? (img) => log.push({ tree: img.width === 480 && img.height === 100 })
      : t[k],
    set: (t, k, v) => ((t[k] = v), true),
  });
  inst.render(spy);
  const lastBulb = log.findLastIndex((e) => e.bulb);
  const tree = log.findIndex((e) => e.tree);
  expect(lastBulb).toBeGreaterThan(0);
  expect(tree).toBeGreaterThan(lastBulb);
});

test('Carol Karaoke: before your first press your head waits on the middle lane, faded with its mouth shut', () => {
  const inst = MINIGAMES.carols.create({ difficulty: 0.3, rng: createRng(7), theme: { dept: 'party', title: 'T' }, sfx: () => {}, player: PARTY_TROUSERS });
  const input = createInput();
  const head = () => {
    const { ctx, calls } = recordingCanvas();
    inst.render(ctx);
    return calls.filter((c) => c.fill === '#e85a5e'); // the hat's highlight: your head (the choir is baked)
  };
  const before = head();
  expect(before).toHaveLength(1);
  expect(before[0].alpha).toBeLessThan(1);
  expect(before[0].y).toBe(140 - 4 - 2); // LANE_Y[1] - 4, the hat a cell above
  expect(inst.peek().voice).toBe(-1); // still not singing
  input.beginFrame();
  input.keyDown('ArrowUp');
  inst.update(1 / 60, input);
  input.endFrame();
  const after = head();
  expect(inst.peek().voice).toBe(1); // the first press picks the middle lane, where the head waited
  expect(after[0].alpha).toBe(1);
  expect(after[0].y).toBe(before[0].y);
});

test('Carol Karaoke: the notes and the choir keep the song\'s clock (beat 0 sounds SONG_LEAD into play)', async () => {
  const { SONG_LEAD } = await import('../src/engine/audio.js');
  const { SONGS } = await import('../src/data/music.js');
  const bakes = [];
  const real = document.createElement;
  document.createElement = () => {
    const rc = recordingCanvas(16, 16);
    bakes.push(rc.canvas);
    return rc.canvas;
  };
  let inst;
  try {
    inst = MINIGAMES.carols.create({ difficulty: 0.3, rng: createRng(7), theme: { dept: 'party', title: 'T' }, sfx: () => {} });
  } finally {
    document.createElement = real;
  }
  const notes = inst.peek().notes;
  const song = SONGS[inst.song];
  const step = 60 / song.bpm / 4;
  expect(notes[0].t).toBeCloseTo(SONG_LEAD + step * song.melody.flatMap((b) => b.trim().split(/\s+/)).findIndex((tok) => /^[A-G]/.test(tok)), 6);
  const choir = bakes.filter((c) => c.width === 26 && c.height === 66); // [smile, sing] per singer
  const beat = 60 / song.bpm;
  const input = createInput();
  const singerZero = () => {
    const imgs = [];
    const rc = recordingCanvas();
    const spy = new Proxy(rc.ctx, { get: (t, k) => (k === 'drawImage' ? (img) => imgs.push(img) : t[k]), set: (t, k, v) => ((t[k] = v), true) });
    inst.render(spy);
    return imgs.find((im) => im === choir[0] || im === choir[1]) === choir[1] ? 'sing' : 'smile';
  };
  let time = 0;
  for (const k of [1, 2, 3, 4]) {
    // Just after the game clock's beat k but before the song's: still the song's beat k - 1.
    const dt = k * beat + SONG_LEAD / 2 - time;
    input.beginFrame();
    inst.update(dt, input);
    input.endFrame();
    time += dt;
    expect(singerZero(), `beat ${k}`).toBe((k - 1) % 2 === 0 ? 'sing' : 'smile');
  }
});

test('Dance-Off: you and the rival strike opposite moves on each beat of the song, standing in between', async () => {
  const { danceMoves } = await import('../src/minigames/dance.js');
  const { SONG_LEAD } = await import('../src/engine/audio.js');
  const beat = 0.5; // xmasparty at 120 bpm
  expect(danceMoves(0, beat)).toEqual({ you: 'stand', rival: 'stand', hop: 0 });
  for (let k = 0; k < 8; k++) {
    const on = danceMoves(SONG_LEAD + (k + 0.3) * beat, beat);
    expect(on).toEqual(k % 2 ? { you: 'danceB', rival: 'danceA', hop: 2 } : { you: 'danceA', rival: 'danceB', hop: 2 });
    expect(danceMoves(SONG_LEAD + (k + 0.8) * beat, beat)).toEqual({ you: 'stand', rival: 'stand', hop: 0 });
  }
  // In the frame: your hands (6 px tall skin blocks: 6 wide raised, 4 wide held out) where the move puts them (danceA:
  // left up, right out; danceB: the other way).
  const player = { ...PARTY_TROUSERS, skin: '#123456' };
  const hands = (secs) => lastFrame('dance', secs, { player }).calls.filter((c) => c.fill === '#123456' && c.h === 6 && (c.w === 6 || c.w === 4)).map((c) => c.x).sort((a, b) => a - b);
  expect(hands(SONG_LEAD + 4.3 * beat)).toEqual([56, 92]); // beat 4: danceA
  expect(hands(SONG_LEAD + 5.3 * beat)).toEqual([46, 78]); // beat 5: danceB
});

test('Dance-Off: the row of floor tiles just under the lanes lights below the glass', () => {
  const lit = new Set(['#5a2a6a', '#2a3a7a', '#2a6a5a', '#7a5a2a']);
  const seen = new Set();
  for (const secs of [2.2, 2.7, 3.2, 3.7]) {
    for (const c of lastFrame('dance', secs).calls) if (lit.has(c.fill) && c.y === 220 && c.h === 10 && c.x >= 160 && c.x < 320) seen.add(c.x);
  }
  expect([...seen].sort((a, b) => a - b)).toEqual([162, 202, 242, 282]); // one per lane column, beat by beat
});

// ---- Final fix pass ----

test('Photo Booth: a missed shot greys a tie and a skirt only when the look has them', () => {
  const base = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', long: false, corp: '#c03030' };
  const inStrip = (calls, pred) => calls.filter((c) => c.x >= 380 && c.fill === '#7a7a7a' && pred(c));
  // Nobody presses anything: the first shot (after ~2.6 s) is missed, its grey bust is in the strip.
  const skirtLook = { ...base, skirt: '#c03030', tie: null };
  const a = lastFrame('photobooth', 3, { player: skirtLook }).calls;
  expect(a.some((c) => c.x >= 380 && c.fill === '#9a9a9a')).toBe(true); // the grey bust is there
  expect(inStrip(a, (c) => c.w === 4 && c.h === 14)).toHaveLength(0); // no tie on a skirt career
  expect(inStrip(a, (c) => c.w === 16 && c.h === 10).length).toBeGreaterThan(0); // the grey skirt
  const trousers = { ...base, skirt: null, tie: null };
  const b = lastFrame('photobooth', 3, { player: trousers }).calls;
  expect(b.some((c) => c.x >= 380 && c.fill === '#9a9a9a')).toBe(true);
  expect(inStrip(b, (c) => c.w === 16 && c.h === 10)).toHaveLength(0); // no skirt on trousers
  expect(inStrip(b, (c) => c.w === 4 && c.h === 14)).toHaveLength(0);
  const tied = { ...base, skirt: null, tie: '#b8282e' };
  const c = lastFrame('photobooth', 3, { player: tied }).calls;
  expect(inStrip(c, (c) => c.w === 4 && c.h === 14).length).toBeGreaterThan(0); // a tie is greyed
});

// The hand holding the cigarette is the player's: its skin tones follow the career's skin in every mood.
const OLD_HAND = {
  dusk: ['#9a5a3a', '#c8865c', '#e0a878', '#f0c498'],
  night: ['#4a3040', '#6a4450', '#8a5a5a', '#a87068'],
  day: ['#9a5a3a', '#c8865c', '#e0a878', '#f0c498'],
};
const lum = (c) => [1, 3, 5].reduce((s, i) => s + parseInt(c.slice(i, i + 2), 16), 0);

for (const mood of ['dusk', 'night', 'day']) {
  test(`Smoke Break (${mood}): the default skin keeps the hand's old tones exactly`, () => {
    const theme = { dept: 'lobby', title: 'T', sky: mood };
    for (const extra of [{}, { player: DEFAULT_PLAYER }]) {
      const { fills } = lastFrame('cigarette', 0, { theme, ...extra });
      for (const c of OLD_HAND[mood].slice(1)) expect(fills.has(c), c).toBe(true);
    }
  });

  test(`Smoke Break (${mood}): a dark skin gives the hand other, darker tones`, () => {
    const theme = { dept: 'lobby', title: 'T', sky: mood };
    const base = lastFrame('cigarette', 0, { theme }).fills;
    const dark = lastFrame('cigarette', 0, { theme, player: { ...DEFAULT_PLAYER, skin: '#6b4228' } }).fills;
    for (const c of OLD_HAND[mood].slice(1)) expect(dark.has(c), c).toBe(false);
    const fresh = [...dark].filter((c) => !base.has(c) && typeof c === 'string' && c[0] === '#');
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    // each old tone has a darker stand-in (the same sky and sleeve are unchanged, so only the skin differs)
    for (const old of OLD_HAND[mood].slice(1)) expect(fresh.some((c) => lum(c) < lum(old)), old).toBe(true);
  });
}

test('Smoke Break: handTones gives every tone of every mood back for the default skin', async () => {
  const { handTones } = await import('../src/minigames/cigarette.js');
  for (const tones of Object.values(OLD_HAND)) expect(handTones(tones, DEFAULT_PLAYER.skin)).toEqual(tones);
});

test('Boss Alert: the skirted colleagues wear more than one skirt colour over the walker schedule', async () => {
  const { walkerLook } = await import('../src/minigames/stealth.js');
  const w = { skin: '#f2c9a0', hair: '#2b1d14', shirt: '#3b6fb6', suit: false };
  const skirts = new Set();
  for (let i = 0; i < 15; i++) {
    const look = walkerLook(w, i);
    if (look.skirt) skirts.add(look.skirt);
  }
  expect(skirts.size).toBeGreaterThanOrEqual(2);
  expect(skirts.has('#2f6f5f')).toBe(true); // the approved image's green
  // every third colleague is still the one in a skirt, the shirt over the skirt's waistband (the figure's longTop)
  expect([0, 1, 2, 3, 4].map((i) => !!walkerLook(w, i).skirt)).toEqual([false, true, false, false, true]);
  expect([0, 1, 2, 3, 4].map((i) => !!walkerLook(w, i).longTop)).toEqual([false, true, false, false, true]);
});

test('Boss Alert: your shoulders (from behind) are your career\'s top, with a lighter edge', () => {
  const player = { ...DEFAULT_PLAYER, top: '#a04080' };
  const baked = [];
  const real = document.createElement;
  document.createElement = () => {
    const rc = recordingCanvas(16, 16);
    baked.push(rc.calls);
    return rc.canvas;
  };
  try {
    MINIGAMES.stealth.create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {}, player });
  } finally {
    document.createElement = real;
  }
  const at = (x, y, w, h) => baked.flat().filter((c) => c.x === x && c.y === y && c.w === w && c.h === h).map((c) => c.fill);
  expect(at(222, 118, 48, 12)).toEqual(['#a04080', '#a04080']); // both cubicle layers
  const edge = at(222, 118, 48, 2);
  expect(edge).toHaveLength(2);
  expect(edge[0]).not.toBe('#a04080');
  expect(edge[0]).not.toBe('#5a8ad6');
});

test('Pressing Matters: the crease fallback (every try refused) still draws x inside the shirt body, from rng.int alone', () => {
  const base = createRng(3);
  const drawn = [];
  // int() always answers its minimum: the creases pile up on one point, so the rejection sampler gives up and falls back.
  const rng = new Proxy(base, { get: (t, k) => (k === 'int' ? (a, b) => (drawn.push([a, b]), a) : t[k]) });
  const inst = MINIGAMES.ironing.create({ difficulty: 0.5, rng, theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const { ctx } = recordingCanvas();
  expect(() => inst.render(ctx)).not.toThrow();
  expect(drawn.filter(([a, b]) => a === 175 && b === 305).length).toBeGreaterThan(0); // the fallback ran (BODY.x0, BODY.x1)
});

/** The glyph blits (text is drawn from colour atlases): { color, x, y } for every drawImage of a one-colour atlas. */
function textBlits(id, secs, extra = {}) {
  const inst = MINIGAMES[id].create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {}, ...extra });
  const input = createInput();
  for (let t = 0; t < secs; t += 1 / 30) {
    input.beginFrame();
    inst.update(1 / 30, input);
    input.endFrame();
  }
  const { ctx } = recordingCanvas();
  const blits = [];
  const spy = new Proxy(ctx, { get: (t, k) => (k === 'drawImage' ? (img, ...a) => (img == null && (() => { throw new TypeError('drawImage of ' + img); })(), blits.push({ color: img?.getContext?.('2d')?.fillStyle, x: a[4], y: a[5] })) : t[k]), set: (t, k, v) => ((t[k] = v), true) });
  inst.render(spy);
  return blits;
}

test('Photo Booth: the snow drifts down below the banner, and stands still when the system asks for less motion', () => {
  const flakesAt = (secs, reduce) => {
    const real = globalThis.matchMedia;
    globalThis.matchMedia = (q) => ({ matches: reduce && q.includes('reduce') });
    try {
      const inst = MINIGAMES.photobooth.create({ difficulty: 0.3, rng: createRng(2), theme: { dept: 'party', title: 'T' }, sfx: () => {} });
      const input = createInput();
      for (let n = 0; n < secs * 60; n++) {
        input.beginFrame();
        inst.update(1 / 60, input);
        input.endFrame();
      }
      const { ctx, calls } = recordingCanvas();
      inst.render(ctx);
      return calls.filter((c) => c.fill === '#e8f4fc').map((c) => [c.x, c.y]); // the flakes' glints
    } finally {
      globalThis.matchMedia = real;
    }
  };
  const still = flakesAt(0, false);
  expect(still.length).toBe(16); // 8 flakes, 2 glints each
  expect(still.every(([, y]) => y >= 54)).toBe(true); // under the banner (y 40-54)
  expect(flakesAt(1.5, false)).not.toEqual(still);
  expect(flakesAt(1.5, true)).toEqual(still);
});

test('Dance-Off: the combo line has a shadow like the hints', () => {
  const blits = textBlits('dance', 0.5);
  const at = (color, y) => blits.filter((b) => b.color === color && b.y === y);
  expect(at('#f29cd0', 20).length).toBeGreaterThan(0); // the combo text itself
  expect(at('#120c1e', 21).length).toBe(at('#f29cd0', 20).length); // one dark glyph one pixel right and down for each
  expect(at('#120c1e', 261).length).toBeGreaterThan(0); // the hint line's shadow, for comparison
});

test('Boss Alert: your long hair hangs behind the head for a skirt career, short hair otherwise', () => {
  const bakedRects = (player) => {
    const all = [];
    const real = document.createElement;
    document.createElement = () => {
      const rc = recordingCanvas(16, 16);
      all.push(rc.calls);
      return rc.canvas;
    };
    try {
      MINIGAMES.stealth.create({ difficulty: 0.5, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {}, player });
    } finally {
      document.createElement = real;
    }
    return all.flat();
  };
  const look = { ...DEFAULT_PLAYER, hair: '#12ab34' };
  const longHair = (calls) => calls.filter((c) => c.fill === '#12ab34' && c.x === 236 && c.y === 108 && c.w === 20 && c.h === 14);
  expect(longHair(bakedRects({ ...look, skirt: '#c03030', long: true })).length).toBeGreaterThan(0); // in both cubicle layers
  expect(longHair(bakedRects({ ...look, skirt: null, long: false }))).toHaveLength(0);
  expect(longHair(bakedRects(undefined))).toHaveLength(0);
});

test('the host without a player look (a bare game) passes player: null, and every game renders with player: null', () => {
  const { playerLook, corpColor, ...bare } = fakeGame(newGame({}, 0));
  const scene = new MinigameScene(bare, { id: 't', game: 'beachball', title: 'Pool Ball', difficulty: 0, seed: 1 }, null);
  expect(scene.player).toBeNull();
  const { ctx } = recordingCanvas();
  expect(() => scene.inst.render(ctx)).not.toThrow();
  for (const [id, mod] of Object.entries(MINIGAMES)) {
    const inst = mod.create({ difficulty: 0.5, rng: createRng(5), theme: { dept: 'lobby', title: 'T', stats: { floor: 3, stars: 0, title: 'X' } }, sfx: () => {}, player: null });
    const rc = recordingCanvas();
    expect(() => inst.render(rc.ctx), id).not.toThrow();
  }
});

test('frame budgets: the repeated parts are baked images, so the busiest frame of a whole game stays cheap', () => {
  // Squeaky Clean (was 1211 fills a frame), Sandcastle (was ~1270 with tiers), Dust Buster (was 764), at difficulty 0.6.
  const dishes = peakFrame('dishes', dishesBot);
  const sand = peakFrame('sandcastle', sandBot);
  const vac = peakFrame('vacuum', null, { secs: 1 });
  expect(dishes.calls.length, 'dishes').toBeLessThan(250);
  expect(sand.calls.length, 'sandcastle').toBeLessThan(320);
  expect(vac.calls.length, 'vacuum').toBeLessThan(120);
  // ... and they are images: 46 bubbles of foam, a bunny each, the surf and the tiers.
  expect(dishes.images.filter((im) => im.w >= 14 && im.w <= 24 && im.h === im.w).length).toBeGreaterThanOrEqual(46);
  expect(vac.images.filter((im) => im.w === 20 && im.h === 20).length).toBe(28);
  expect(sand.images.some((im) => im.w === 480 && im.h === 9)).toBe(true);
});

test('Sandcastle: finishing the castle (3 stars) still renders: no image is missing in the result phase', () => {
  const inst = MINIGAMES.sandcastle.create({ difficulty: 0.6, rng: createRng(7), theme: { dept: 'lobby', title: 'T' }, sfx: () => {} });
  const input = createInput();
  for (let i = 0; i < 60 * 60 && !inst.done; i++) {
    input.beginFrame();
    sandBot(inst, input);
    inst.update(1 / 60, input);
    input.endFrame();
  }
  expect(inst.done).toBe(true);
  expect(inst.peek().built).toBe(6);
  expect(inst.score).toBe(1);
  // The host keeps rendering the game under the result card: every frame, with a canvas that rejects a missing image.
  for (let k = 0; k < 5; k++) {
    input.beginFrame();
    inst.update(1 / 60, input);
    input.endFrame();
    const rc = recordingCanvas();
    expect(() => inst.render(rc.ctx)).not.toThrow();
  }
});
