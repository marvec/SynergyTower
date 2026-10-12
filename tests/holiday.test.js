// The vacation hotel's activities are super easy: a player who pays attention gets 3 stars, someone who does nothing
// gets no coffee (under 1 star).
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { ACTIVITIES } = await import('../src/data/vacation.js');

const g = mockCanvas().getContext('2d');
const theme = { dept: 'exec', title: 'Holiday', stats: { floor: 20, stars: 0, title: 'VP' } };

/** Runs a game with `bot(peek, input)` deciding the input each frame (null = idle). */
function play(id, bot, seed = 1) {
  const inst = MINIGAMES[id].create({ difficulty: 0, rng: createRng(seed), theme, sfx: () => {} });
  const input = createInput();
  const held = new Set();
  let t = 0;
  while (!inst.done && t < 120) {
    input.beginFrame();
    const want = bot ? bot(inst.peek(), t) : {};
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
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

/** Steer towards a target with the arrow keys. */
const towards = (from, to, slack = 4) => ({
  ArrowLeft: to.x < from.x - slack,
  ArrowRight: to.x > from.x + slack,
  ArrowUp: to.y != null && to.y < from.y - slack,
  ArrowDown: to.y != null && to.y > from.y + slack,
});
const nearest = (from, list) => list.reduce((b, o) => (!b || Math.hypot(o.x - from.x, o.y - from.y) < Math.hypot(b.x - from.x, b.y - from.y) ? o : b), null);

let tick = 0;
const BOTS = {
  sleep: (p) => ({ press: p.airborne }),
  buffet: (p) => (p.items.length ? towards(p.plate, nearest(p.plate, p.items)) : {}),
  beachball: (p) => towards(p.you, { x: p.ball.x }),
  swim: (p) => ({ press: p.canStroke }),
  sunbathe: (p) => ({ press: p.tan > (p.gold[0] + p.gold[1]) / 2 }),
  cocktail: (p) => {
    const low = p.fruit.reduce((b, f) => (!b || f.y > b.y ? f : b), null);
    return low ? towards(p.glass, { x: low.x }) : {};
  },
  massage: (p) => {
    if (!p.knots.length) return {};
    const k = nearest(p.hand, p.knots);
    const near = Math.hypot(k.x - p.hand.x, k.y - p.hand.y) < 6;
    return near ? { press: (tick++ % 2) === 0 } : towards(p.hand, k, 3);
  },
  sandcastle: (p) => ({ press: !p.falling && Math.abs(p.offset) < 8 }),
};

for (const a of ACTIVITIES) {
  test(`holiday game ${a.game}: attentive player 3 stars, idle player no coffee`, () => {
    for (const seed of [1, 2, 3]) {
      expect(play(a.game, BOTS[a.game], seed), `${a.game} seed ${seed}`).toBeGreaterThanOrEqual(0.85);
      expect(play(a.game, null, seed), `${a.game} idle seed ${seed}`).toBeLessThan(0.35);
    }
  });
}
