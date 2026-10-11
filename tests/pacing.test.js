// Simulates a whole career on the real floors to pin the coffee pacing: gentle start, steady climb, no cheap-game loophole.
import { test, expect } from 'bun:test';
import * as E from '../src/core/economy.js';
import { buildFloor } from '../src/core/tasks.js';

const PLAY_S = 105; // one task incl. walking and result screens
const STEP_S = 10;

/** pick(tasks, ready, t, f) → next task or null. Returns minutes and waiting minutes per floor. */
function career(pick) {
  let t = 0, cups = E.maxCoffee(1), acc = 0, f = 1;
  const machine = {};
  const floors = [];
  const step = (dt) => {
    t += dt;
    acc += dt;
    const max = E.maxCoffee(f), regen = E.coffeeRegenMs() / 1000;
    while (acc >= regen) { acc -= regen; if (cups < max) cups++; }
    if (cups >= max) acc = 0;
  };
  const useMachine = () => {
    if (!(machine[f] > t)) { cups += E.COFFEE_MACHINE_AMOUNT; machine[f] = t + E.COFFEE_MACHINE_COOLDOWN_S; }
  };
  const spend = (cost) => {
    let waited = 0;
    useMachine();
    while (cups < cost) { step(STEP_S); waited += STEP_S; useMachine(); }
    cups -= cost;
    return waited;
  };
  for (f = 1; f <= E.FLOORS; f++) {
    const tasks = buildFloor(f).tasks.map((it) => it.task);
    const ready = {};
    const t0 = t;
    let stars = 0, wait = 0;
    while (stars < E.starQuota(f)) {
      const task = pick(tasks, ready, t, f);
      if (!task) { step(STEP_S); wait += STEP_S; continue; }
      wait += spend(E.taskCoffeeCost(task.game));
      step(PLAY_S);
      stars += 2;
      ready[task.id] = t + E.stationCooldownMs(f, {}, task.game) / 1000;
    }
    wait += spend(E.REVIEW_COFFEE);
    step(PLAY_S + 30);
    floors[f] = { min: (t - t0) / 60, wait: wait / 60 };
  }
  return { hours: t / 3600, floors };
}

// Walks the floor in a fixed order, skipping stations on cooldown.
const rotation = () => {
  let i = 0;
  return (tasks, ready, t) => {
    for (let k = 0; k < tasks.length; k++) {
      const c = tasks[(i + k) % tasks.length];
      if (!(ready[c.id] > t)) { i = (i + k + 1) % tasks.length; return c; }
    }
    return null;
  };
};
// Always plays the cheapest task that is ready.
const cheapest = (tasks, ready, t) =>
  tasks.filter((c) => !(ready[c.id] > t)).sort((a, b) => E.taskCoffeeCost(a.game) - E.taskCoffeeCost(b.game))[0] || null;

const normal = career(rotation());

test('floor 1 needs no waiting; coffee starts to matter on floor 2-5', () => {
  expect(normal.floors[1].wait).toBe(0);
  expect(normal.floors[5].wait).toBeGreaterThan(5);
});

test('time per floor climbs steadily', () => {
  const m = (f) => normal.floors[f].min;
  expect(m(2)).toBeLessThan(m(10));
  expect(m(10)).toBeLessThan(m(30));
  expect(m(30)).toBeLessThan(m(40));
  expect(m(40)).toBeLessThan(240); // no 4-hour floors
});

test('a whole career stays in the intended range', () => {
  expect(normal.hours).toBeGreaterThan(40);
  expect(normal.hours).toBeLessThan(75);
});

test('farming the cheapest games is not a big shortcut', () => {
  expect(career(cheapest).hours / normal.hours).toBeGreaterThan(0.8);
});
