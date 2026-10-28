// The mini-game art kit: flat bands, chunky ellipses, cell painters, baked backgrounds.
import { test, expect } from 'bun:test';
import { installMockDocument, recordingCanvas } from './mock-canvas.js';
installMockDocument();
const { bands, cblob, blob, cells, bake, mix, grad, rnd, glow, grains } = await import('../src/engine/mgart.js');

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

test('mix gives the colour halfway between two', () => {
  expect(mix('#000000', '#ffffff')).toBe('#808080');
  expect(mix('#102030', '#304050')).toBe('#203040');
});

test('grad makes two bands per stop: the stop, then the colour halfway to the next', () => {
  const { ctx, calls } = recordingCanvas();
  grad(ctx, 0, 0, 10, 40, ['#000000', '#ffffff', '#ff0000']);
  // 3 stops + 2 halfway colours = 5 bands of 8 rows.
  expect(calls.map((c) => c.fill)).toEqual(['#000000', '#808080', '#ffffff', '#ff8080', '#ff0000']);
  expect(calls.every((c) => c.h === 8)).toBe(true);
});

test('rnd repeats for a seed, stays in 0..1 and differs between seeds', () => {
  const a = rnd(5);
  const b = rnd(5);
  const run = [a(), a(), a()];
  expect(run).toEqual([b(), b(), b()]);
  expect(run.every((v) => v >= 0 && v < 1)).toBe(true);
  expect(rnd(6)()).not.toBe(run[0]);
  expect(rnd(0)()).toBe(rnd(1)()); // seed 0 is taken as 1
});

test('glow paints discs of one colour, fainter towards the rim', () => {
  const { ctx, calls } = recordingCanvas();
  const alphas = [];
  const g = new Proxy(ctx, { get: (t, k) => (k === 'fillRect' ? (...a) => (alphas.push(t.globalAlpha), t.fillRect(...a)) : t[k]), set: (t, k, v) => ((t[k] = v), true) });
  glow(g, 50, 50, 10, '#ff8030', 0.8);
  expect(calls.length).toBeGreaterThan(10);
  expect(calls.every((c) => c.fill === '#ff8030')).toBe(true);
  expect(Math.min(...alphas)).toBe(0); // the outer disc (r 10) is invisible, the core (r 2) the strongest
  expect(Math.max(...alphas)).toBeCloseTo(0.8 * (1 - 2 / 10) * 0.5, 5);
  // the widest row is the outer disc's diameter, centred on x 50
  const widest = calls.reduce((m, c) => (c.w > m.w ? c : m));
  expect(widest.x + widest.w / 2).toBe(50);
});

test('blob, line, shaded and grains draw on the grid they promise', async () => {
  const { blob, line, shaded, grains } = await import('../src/engine/mgart.js');
  const a = recordingCanvas();
  blob(a.ctx, 50, 50, 6, 4, '#123456');
  expect(a.calls.length).toBeGreaterThan(3);
  for (const c of a.calls) expect(c.h).toBe(1);
  const l = recordingCanvas();
  line(l.ctx, 0, 0, 10, 5, '#654321');
  expect(l.calls.length).toBe(11);
  const s = recordingCanvas();
  shaded(s.ctx, 40, 40, 6, 6, '#4f9a4a', { rim: '#2f6a2e', light: '#7aca6a' });
  expect(new Set(s.calls.map((c) => c.fill))).toEqual(new Set(['#2f6a2e', '#4f9a4a', '#7aca6a']));
  for (const c of s.calls) expect(c.h % 2).toBe(0); // 2 px cells
  const g = recordingCanvas();
  grains(g.ctx, 10, 20, 100, 40, ['#aaaaaa', '#bbbbbb'], 60, 5);
  expect(g.calls.length).toBe(10);
  for (const c of g.calls) expect([c.w, c.h, c.x % 2, c.y % 2]).toEqual([2, 2, 0, 0]);
  const again = recordingCanvas();
  grains(again.ctx, 10, 20, 100, 40, ['#aaaaaa', '#bbbbbb'], 60, 5);
  expect(again.calls).toEqual(g.calls);
});

test('blob is symmetric about its middle row (1 px rows, cy - ry to cy + ry); cblob(..., 1) is 2 * ry rows from cy - ry', () => {
  const a = recordingCanvas();
  blob(a.ctx, 50, 50, 8, 5, '#abcdef');
  expect(a.calls.map((c) => c.y)).toEqual([46, 47, 48, 49, 50, 51, 52, 53, 54]); // the tips (y = ±ry) are 0 px wide
  expect(a.calls.map((c) => c.w)).toEqual(a.calls.map((c) => c.w).reverse());
  expect(a.calls.every((c) => c.h === 1)).toBe(true);
  const b = recordingCanvas();
  cblob(b.ctx, 50, 50, 8, 5, '#abcdef', 1);
  expect(b.calls.map((c) => c.y)).toEqual([45, 46, 47, 48, 49, 50, 51, 52, 53, 54]);
});

test('grains land on the screen\'s 2 px grid, also from an odd origin', () => {
  for (const [x, y] of [[0, 0], [1, 3], [-13, 7]]) {
    const { ctx, calls } = recordingCanvas();
    grains(ctx, x, y, 40, 20, ['#111111'], 120, 5);
    expect(calls.length).toBe(20);
    for (const c of calls) {
      expect(Math.abs(c.x % 2)).toBe(0);
      expect(Math.abs(c.y % 2)).toBe(0);
      expect(c.x).toBeGreaterThanOrEqual(x - 1);
      expect(c.x + 2).toBeLessThanOrEqual(x + 40 + 1);
    }
  }
});
