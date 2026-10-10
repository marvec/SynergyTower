import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { placeProps, speedBonus } = await import('../src/core/quests.js');
const { buildFloor } = await import('../src/core/tasks.js');
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { feedbackFacts } = await import('../src/minigames/feedback.js');
const { lostPassword } = await import('../src/minigames/lostpw.js');
const { measureText } = await import('../src/engine/font.js');
const { ACHIEVEMENTS, GROWTH_AREAS } = await import('../src/data/mg-feedback.js');
const { PETS } = await import('../src/data/mg-lostpw.js');

test('quest whiteboards land on reachable, spread-out tiles on every floor', () => {
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    const avoid = [{ x: fl.spawn.x, y: fl.spawn.y, r: 5 }];
    const spots = placeProps(fl, createRng(f), 6, avoid);
    expect(spots.length).toBe(6);
    for (const s of spots) {
      const i = s.y * fl.w + s.x;
      expect(fl.walk[i]).toBeTruthy();
      expect(fl.dist[i]).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(s.x - fl.spawn.x, s.y - fl.spawn.y)).toBeGreaterThanOrEqual(5);
    }
    const keys = new Set(spots.map((s) => `${s.x},${s.y}`));
    expect(keys.size).toBe(6);
  }
});

test('speed bonus is full with plenty of time left and zero at the buzzer', () => {
  expect(speedBonus(60, 60)).toBe(1);
  expect(speedBonus(0, 60)).toBe(0);
  expect(speedBonus(13.5, 60)).toBeCloseTo(0.5);
});

test('quest games declare a floor quest and desk help', () => {
  for (const id of ['feedback', 'lostpw']) {
    expect(MINIGAMES[id].quest).toBe(id);
    expect(typeof MINIGAMES[id].deskHelp).toBe('string');
  }
  expect(MINIGAMES.chart.quest).toBeUndefined();
});

test('pet pixel maps are 12 wide and floor-quest strings fit their boxes', () => {
  for (const p of Object.values(PETS)) for (const row of p.map) expect(row.length).toBe(12);
  for (const a of ACHIEVEMENTS) expect(measureText(a)).toBeLessThanOrEqual(170);
  for (const g of GROWTH_AREAS) expect(measureText(g)).toBeLessThanOrEqual(170);
});

function run(inst, keyFor) {
  const g = mockCanvas().getContext('2d');
  const input = createInput();
  for (let i = 0; i < 4000 && !inst.done; i++) {
    input.beginFrame();
    const k = keyFor(i);
    if (k) {
      input.keyDown(k);
      input.keyUp(k);
    }
    inst.update(1 / 30, input);
    inst.render(g);
    input.endFrame();
  }
}

const theme = (dept) => ({ dept, title: 'Test' });

test('360 feedback: a colleague who listened gets 3 stars, always picking "1" does not', () => {
  for (const d of [0, 0.5, 1]) {
    const quest = { ...feedbackFacts(createRng(5), 'sales'), speed: 1 };
    const good = MINIGAMES.feedback.create({ difficulty: d, rng: createRng(1), theme: theme('sales'), quest });
    run(good, (i) => {
      const q = good.peek();
      return i % 10 === 5 && q ? String(q.opts.indexOf(q.right) + 1) : null;
    });
    expect(good.score).toBeGreaterThanOrEqual(0.85);
    const lazy = MINIGAMES.feedback.create({ difficulty: d, rng: createRng(2), theme: theme('sales'), quest });
    run(lazy, (i) => (i % 10 === 5 ? '1' : null));
    expect(lazy.done).toBe(true);
    expect(lazy.score).toBeLessThan(0.85);
  }
});

test('lost password: knowing the pet logs in for 3 stars; the answer is always offered', () => {
  for (let k = 0; k < 20; k++) {
    const q = lostPassword(createRng(k), 3);
    expect(q.decoys.every((p) => p.name !== q.pet.name)).toBe(true);
    const inst = MINIGAMES.lostpw.create({ difficulty: 0.5, rng: createRng(k), theme: theme('it'), quest: { ...q, seen: true, speed: 1 } });
    const { options, answer } = inst.peek();
    expect(options).toContain(answer);
    expect(options.length).toBe(6);
    run(inst, (i) => (i === 5 ? String(options.indexOf(answer) + 1) : null));
    expect(inst.score).toBeGreaterThanOrEqual(0.85);
  }
});

test('magic chart: a player who finds the sweet spots clears all quarters; doing nothing scores 0', () => {
  for (const d of [0, 0.5, 1]) {
    const inst = MINIGAMES.chart.create({ difficulty: d, rng: createRng(7), theme: theme('finance') });
    run(inst, (i) => {
      if (i % 3) return null;
      const { controls, focus } = inst.peek();
      const c = controls[focus];
      if (c.value < c.target) return 'ArrowUp';
      if (c.value > c.target) return 'ArrowDown';
      const next = controls.findIndex((x) => x.value !== x.target);
      return next < 0 ? null : next > focus ? 'ArrowRight' : 'ArrowLeft';
    });
    expect(inst.score).toBeGreaterThanOrEqual(0.85);
    const idle = MINIGAMES.chart.create({ difficulty: d, rng: createRng(7), theme: theme('finance') });
    run(idle, () => null);
    expect(idle.score).toBe(0);
  }
});
