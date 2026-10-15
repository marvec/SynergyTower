// The home office chores: a player who pays attention gets 3 stars, someone who does nothing gets under 1 star (no pay,
// no coffee from the coffee maker).
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { CHORES } = await import('../src/data/home.js');

const g = mockCanvas().getContext('2d');
const theme = { dept: 'marketing', title: 'Chore', stats: { floor: 8, stars: 0, title: 'Analyst' } };
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

/** Runs a game with `bot(peek, t)` deciding the input each frame (null = idle). */
function play(id, bot, seed = 1) {
  const inst = MINIGAMES[id].create({ difficulty: 0, rng: createRng(seed), theme, sfx: () => {} });
  const input = createInput();
  const held = new Set();
  let t = 0;
  while (!inst.done && t < 120) {
    input.beginFrame();
    const want = bot ? bot(inst.peek(), t) : {};
    for (const k of ARROWS) {
      if (want[k] && !held.has(k)) (input.keyDown(k), held.add(k));
      if (!want[k] && held.has(k)) (input.keyUp(k), held.delete(k));
    }
    if (want.press) {
      input.keyDown(' ');
      input.keyUp(' ');
    }
    inst.update(1 / 60, input);
    inst.render(g);
    input.endFrame();
    t += 1 / 60;
  }
  expect(inst.done).toBe(true);
  return inst.score;
}

const towards = (from, to, slack = 3) => ({
  ArrowLeft: to.x < from.x - slack,
  ArrowRight: to.x > from.x + slack,
  ArrowUp: to.y < from.y - slack,
  ArrowDown: to.y > from.y + slack,
});
const nearest = (from, list) => list.reduce((b, o) => (!b || Math.hypot(o.x - from.x, o.y - from.y) < Math.hypot(b.x - from.x, b.y - from.y) ? o : b), null);

let tick = 0;
const BOTS = {
  vacuum: (p) => (p.dust.length ? towards(p.vac, nearest(p.vac, p.dust)) : {}),
  dishes: (p) => {
    if (p.phase === 'scrub') return p.last === 'L' ? { ArrowRight: true } : { ArrowLeft: true };
    if (p.phase === 'rack') return { press: Math.abs(p.plateX - p.target) < p.tol / 2 };
    return {};
  },
  laundry: (p) => (p.item && tick++ % 2 === 0 ? { [p.keys[p.item.bin]]: true } : {}),
  ironing: (p) => (p.creases.length ? towards(p.iron, nearest(p.iron, p.creases), 2) : {}),
  bath: (p) => {
    const mid = (p.band[0] + p.band[1]) / 2;
    return { ArrowRight: p.temp < mid - 0.4, ArrowLeft: p.temp > mid + 0.4 };
  },
  brew: (p) => {
    if (p.paused) return {};
    if (p.stage === 'grind') return { press: tick++ % 2 === 0 };
    return { press: p.level >= (p.band[0] + p.band[1]) / 2 };
  },
};

test('every chore is a registered mini-game with a bot here', () => {
  expect(CHORES.map((c) => c.game).sort()).toEqual(Object.keys(BOTS).sort());
  for (const c of CHORES) expect(MINIGAMES[c.game]?.id).toBe(c.game);
});

for (const c of CHORES) {
  test(`chore ${c.game}: attentive player 3 stars, idle player under 1 star`, () => {
    for (const seed of [1, 2, 3]) {
      expect(play(c.game, BOTS[c.game], seed), `${c.game} seed ${seed}`).toBeGreaterThanOrEqual(0.85);
      expect(play(c.game, null, seed), `${c.game} idle seed ${seed}`).toBeLessThan(0.35);
    }
  });
}
