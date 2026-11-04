// Daily Memo pool: every game must make the same content from the same create() inputs, at any frame rate.
// A recording rng logs every public call (method, numeric args or array length, result, caller); the logs of runs at
// dt 1/60, 1/24 and a dt that changes each frame must be identical, once with no input and once with scripted input.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { STATION_GAMES } = await import('../src/core/floorgen.js');
const { GAME_TIER } = await import('../src/core/economy.js');
const { MEMO_POOLS, memoFor, memoTheme } = await import('../src/core/memo.js');

const POOL = MEMO_POOLS[0].games;
const MAX_T = 95;

/** The first stack frame past the recorder: `file:line` of the game code that drew. */
function caller() {
  // [0] "Error", [1] caller(), [2] the rng method, [3] the code that called it.
  const line = new Error().stack.split('\n')[3] || '';
  const m = line.match(/\(?([^\s()]+):(\d+):\d+\)?\s*$/);
  return m ? `${m[1].split('/').pop()}:${m[2]}` : line.trim();
}

/** An rng with createRng's API and stream that logs each outermost call. */
function recordingRng(seed) {
  const inner = createRng(seed);
  const log = [];
  const idx = (n) => Array.from({ length: n }, (_, i) => i);
  const rng = {
    next: () => {
      const v = inner.next();
      log.push(['next', v, caller()]);
      return v;
    },
    float: (min = 0, max = 1) => {
      const v = inner.float(min, max);
      log.push(['float', min, max, v, caller()]);
      return v;
    },
    int: (min, max) => {
      const v = inner.int(min, max);
      log.push(['int', min, max, v, caller()]);
      return v;
    },
    pick: (arr) => {
      const i = Math.floor(inner.next() * arr.length); // the same draw as createRng's pick
      log.push(['pick', arr.length, i, caller()]);
      return arr[i];
    },
    chance: (p) => {
      const v = inner.chance(p);
      log.push(['chance', p, v, caller()]);
      return v;
    },
    shuffle: (arr) => {
      const perm = inner.shuffle(idx(arr.length));
      log.push(['shuffle', arr.length, perm.join(','), caller()]);
      return perm.map((i) => arr[i]);
    },
    sample: (arr, n) => {
      const perm = inner.shuffle(idx(arr.length)).slice(0, n);
      log.push(['sample', arr.length, n, perm.join(','), caller()]);
      return perm.map((i) => arr[i]);
    },
  };
  return { rng, log };
}

// Frame rates. The varying one draws its dts from its own rng (0.004..0.05 s, the main loop's cap).
const RATES = {
  '60': () => () => 1 / 60,
  '24': () => () => 1 / 24,
  vary: () => {
    const r = createRng(4242);
    return () => 0.004 + r.next() * 0.046;
  },
};
// Scripted input runs in windows: one input frame of INPUT_DT (the same at every rate, so each press is handled at the
// same game time), then 0.25 s of frames: 15 × 1/60, 6 × 1/24, or a changing pattern that adds up to 0.25.
const INPUT_DT = 1 / 120;
const WINDOW = 0.25;
const PATTERN = [0.01, 0.03, 0.05, 0.04, 0.02, 0.05, 0.05];
const WINDOW_DTS = {
  '60': () => Array(15).fill(1 / 60),
  '24': () => Array(6).fill(1 / 24),
  vary: (k) => PATTERN.map((_, i) => PATTERN[(i + k) % PATTERN.length]),
};
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Backspace', '1', '2', '3', '4', 'a', 'e', 's', 't', 'o'];

/** The script: per window, maybe a key (held for the window) and maybe a click. The same for every rate. */
function script(seed) {
  const r = createRng(seed);
  return Array.from({ length: Math.ceil(MAX_T / (WINDOW + INPUT_DT)) }, () => ({
    key: r.chance(0.6) ? r.pick(KEYS) : null,
    click: r.chance(0.25) ? [Math.round(r.float(0, 480)), Math.round(r.float(0, 270))] : null,
  }));
}

function make(id, cfg, seed) {
  const mod = MINIGAMES[id];
  const { rng, log } = recordingRng(seed);
  const memo = { ...memoFor(cfg.n), game: id };
  const inst = mod.create({ difficulty: cfg.d, rng, theme: memoTheme(memo), sfx: () => {} });
  return { inst, log };
}

/** No input: runs to the end (or MAX_T) at a rate; returns the rng log and the result. */
function runIdle(id, cfg, rate) {
  const { inst, log } = make(id, cfg, memoFor(cfg.n).seed);
  const g = mockCanvas().getContext('2d');
  const input = createInput();
  const dt = RATES[rate]();
  let t = 0;
  inst.render(g);
  while (!inst.done && t < MAX_T) {
    const step = dt();
    input.beginFrame();
    inst.update(step, input);
    inst.render(g);
    input.endFrame();
    t += step;
  }
  return { log, done: inst.done, score: Math.round(inst.score * 1000) / 1000 };
}

/** Scripted input, applied at the start of each window. */
function runScripted(id, cfg, rate, steps) {
  const { inst, log } = make(id, cfg, memoFor(cfg.n).seed);
  const g = mockCanvas().getContext('2d');
  const input = createInput();
  let held = null;
  let pressing = false;
  inst.render(g);
  for (let k = 0; k < steps.length && !inst.done; k++) {
    const { key, click } = steps[k];
    if (held) input.keyUp(held === 'Space' ? ' ' : held);
    if (pressing) input.pointerUp(input.pointer.x, input.pointer.y);
    held = key;
    pressing = !!click;
    if (key) {
      const raw = key === 'Space' ? ' ' : key;
      input.keyDown(raw);
      input.queueKey(raw);
      if (key.length === 1) input.typeChar(key);
      if (key === 'Backspace') input.typeChar('\b');
    }
    if (click) input.pointerDown(click[0], click[1]);
    for (const step of [INPUT_DT, ...WINDOW_DTS[rate](k)]) {
      input.beginFrame();
      inst.update(step, input);
      inst.render(g);
      input.endFrame();
      if (inst.done) break;
    }
  }
  return { log, done: inst.done, score: Math.round(inst.score * 1000) / 1000 };
}

/** The first difference between two logs, for a readable failure. */
function firstDiff(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return { i, a: a[i], b: b[i], lenA: a.length, lenB: b.length };
  }
  return null;
}

const CONFIGS = [
  { n: 3, d: 0.3 },
  { n: 17, d: 0.8 },
];

/** Runs every rate; returns the first mismatch against the 1/60 run (null when all agree). */
function compareRates(run) {
  const base = run('60');
  for (const rate of ['24', 'vary']) {
    const other = run(rate);
    const d = firstDiff(base.log, other.log);
    if (d) return { rate, ...d };
    if (base.done !== other.done) return { rate, done: [base.done, other.done] };
  }
  return null;
}

for (const id of POOL) {
  test(`memo pool: ${id} is an ordinary station game`, () => {
    expect(MINIGAMES[id]?.id).toBe(id);
    expect(Object.values(STATION_GAMES).some((gs) => gs.includes(id))).toBe(true);
    expect(GAME_TIER[id]).toBeGreaterThan(0);
    expect(MINIGAMES[id].quest).toBeUndefined();
  });

  test(`memo pool: ${id} draws the same content at any frame rate`, () => {
    for (const [c, cfg] of CONFIGS.entries()) {
      const idle = compareRates((rate) => runIdle(id, cfg, rate));
      expect({ cfg, pass: 'idle', diff: idle }).toEqual({ cfg, pass: 'idle', diff: null });
      const steps = script(500 + c);
      const scripted = compareRates((rate) => runScripted(id, cfg, rate, steps));
      expect({ cfg, pass: 'scripted', diff: scripted }).toEqual({ cfg, pass: 'scripted', diff: null });
    }
  });
}

test('the pool keeps at least 15 games, no repeats', () => {
  expect(POOL.length).toBeGreaterThanOrEqual(15);
  expect(new Set(POOL).size).toBe(POOL.length);
});

// Controls: the harness must catch games that are not deterministic across frame rates.

test('control: whack (spawns on a timer into the free slots) differs across frame rates', () => {
  const cfg = { n: 3, d: 0.5 };
  const steps = script(500);
  const diff = compareRates((rate) => runScripted('whack', cfg, rate, steps));
  expect(diff).not.toBeNull();
});

test('control: two timers firing in one frame or in two give the same draw count but a different log', () => {
  // A fake game: timer A at 0.39 s draws with next(), timer B at 0.41 s with pick(). At dt 1/24 both fire in the
  // frame ending 0.4167 s and B is checked first; at dt 1/60 A fires first, B one frame later.
  const fake = (rng) => {
    let t = 0;
    let a = false;
    let b = false;
    return {
      done: false,
      update(dt) {
        t += dt;
        if (!b && t >= 0.41) {
          b = true;
          rng.pick([1, 2, 3]);
        }
        if (!a && t >= 0.39) {
          a = true;
          rng.next();
        }
        if (t >= 1) this.done = true;
      },
    };
  };
  const run = (dt) => {
    const { rng, log } = recordingRng(9);
    const inst = fake(rng);
    while (!inst.done) inst.update(dt);
    return log;
  };
  const fast = run(1 / 60);
  const slow = run(1 / 24);
  expect(fast.length).toBe(slow.length);
  expect(fast.map((e) => e[0])).toEqual(['next', 'pick']);
  expect(slow.map((e) => e[0])).toEqual(['pick', 'next']);
  expect(firstDiff(fast, slow)).not.toBeNull();
  // The caller is the line in the game that drew.
  expect(fast[0].at(-1)).toMatch(/^memoGames\.test\.js:\d+$/);
  expect(fast[0].at(-1)).not.toBe(slow[0].at(-1));
});

test('control: the varying rate really varies and the recorder matches createRng', () => {
  const dt = RATES.vary();
  const a = dt();
  expect(dt()).not.toBe(a);
  for (const k of [0, 3]) expect(WINDOW_DTS.vary(k).reduce((s, x) => s + x, 0)).toBeCloseTo(WINDOW, 9);
  const plain = createRng(77);
  const { rng } = recordingRng(77);
  const arr = ['a', 'b', 'c', 'd', 'e'];
  expect([rng.next(), rng.pick(arr), rng.shuffle(arr), rng.sample(arr, 2), rng.int(1, 6), rng.float(2, 3), rng.chance(0.5)])
    .toEqual([plain.next(), plain.pick(arr), plain.shuffle(arr), plain.sample(arr, 2), plain.int(1, 6), plain.float(2, 3), plain.chance(0.5)]);
});
