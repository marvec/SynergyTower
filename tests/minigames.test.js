// Smoke tests: every mini-game, at several difficulties and themes, survives 90 s of random input
// (keys + clicks) against a mock canvas and ends with a score in [0, 1].
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { ALL_GAMES } = await import('../src/core/tasks.js');
const { DEPARTMENTS } = await import('../src/data/departments.js');

const ids = process.env.MG ? process.env.MG.split(',') : ALL_GAMES;
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', '1', '2', '3', '4', 'a', 'e', 's', 't'];

for (const id of ids) {
  test(`mini-game ${id} runs headless and finishes`, async () => {
    const mod = (await import(`../src/minigames/${id}.js`)).default;
    expect(mod.id).toBe(id);
    expect(typeof mod.name).toBe('string');
    expect(typeof mod.help).toBe('string');
    const g = mockCanvas().getContext('2d');
    for (const [k, d] of [0, 0.35, 0.7, 1].entries()) {
      const dept = DEPARTMENTS[(k * 3) % DEPARTMENTS.length];
      const rng = createRng(1234 + k);
      const inst = mod.create({ difficulty: d, rng, theme: { dept: dept.id, title: 'Test' }, sfx: () => {} });
      const input = createInput();
      const r = createRng(99 + k);
      let t = 0;
      while (!inst.done && t < 300) {
        input.beginFrame();
        if (r.chance(0.3)) {
          const key = r.pick(KEYS);
          input.keyDown(key === 'Space' ? ' ' : key);
          if (key.length === 1) input.typeChar(key);
          input.keyUp(key === 'Space' ? ' ' : key);
        }
        if (r.chance(0.2)) {
          input.pointerDown(r.float(0, 480), r.float(0, 270));
          input.beginFrame();
          input.pointerUp(input.pointer.x, input.pointer.y);
        }
        inst.update(1 / 30, input);
        inst.render(g);
        input.endFrame();
        t += 1 / 30;
      }
      expect(inst.done).toBe(true);
      expect(inst.score).toBeGreaterThanOrEqual(0);
      expect(inst.score).toBeLessThanOrEqual(1);
    }
  });
}
