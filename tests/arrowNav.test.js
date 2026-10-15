// Arrow keys move by where things are on screen (spatialStep): the elevator's floor grid, the fridge, the vending machine.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { spatialStep } = await import('../src/engine/ui.js');
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { ElevatorPanel } = await import('../src/scenes/overlays.js');
const { FridgeCloseUp, VendingCloseUp } = await import('../src/scenes/closeUp.js');

const R = [1, 0], L = [-1, 0], D = [0, 1], U = [0, -1];
// A wide button above a 3x2 grid: 0 = wide, 1-3 top row, 4-6 bottom row.
const grid = [{ x: 0, y: 0, w: 90, h: 10 }];
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) grid.push({ x: c * 30, y: 20 + r * 15, w: 28, h: 13 });

test('spatialStep: up and down keep the column, left and right the row', () => {
  expect(spatialStep(grid, 2, ...D)).toBe(5);
  expect(spatialStep(grid, 5, ...U)).toBe(2);
  expect(spatialStep(grid, 4, ...R)).toBe(5);
  expect(spatialStep(grid, 1, ...U)).toBe(0);
  expect(spatialStep(grid, 0, ...D)).toBe(2); // the middle of the row below
});

test('spatialStep: the end of a row or column wraps around within it', () => {
  expect(spatialStep(grid, 3, ...R)).toBe(1);
  expect(spatialStep(grid, 4, ...L)).toBe(6);
  expect(spatialStep(grid, 5, ...D)).toBe(0);
  expect(spatialStep(grid, 0, ...U)).toBe(5); // the bottom row, its middle
});

test('spatialStep: a lone button with nothing beside it stays put; a single row steps on up/down', () => {
  expect(spatialStep(grid, 0, ...R)).toBe(0);
  expect(spatialStep(grid, 0, ...L)).toBe(0);
  const row = [0, 1, 2].map((i) => ({ x: i * 40, y: 0, w: 36, h: 14 }));
  expect(spatialStep(row, 0, ...D)).toBe(1);
  expect(spatialStep(row, 0, ...U)).toBe(2);
});

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
function press(game, key) {
  game.input.beginFrame();
  if (key) {
    game.input.keyDown(key);
    game.input.keyUp(key);
  }
  game.update(1 / 60);
  game.render(mockCanvas().getContext('2d'));
  game.input.endFrame();
}

test('elevator panel: the arrows walk the floor grid like it looks', () => {
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor: 25, maxFloor: 25, level: 25 });
  s.flags.introSeen = true;
  game.newCareer(s);
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {} });
  game.push(panel);
  press(game);
  const b = panel.buttons;
  const label = () => b.items[b.focus].label;
  expect(b.focus).toBe(0); // the promotion button
  press(game, 'ArrowDown');
  expect(['5', '6']).toContain(label());
  const start = Number(label());
  press(game, 'ArrowDown');
  expect(label()).toBe(String(start + 10));
  press(game, 'ArrowRight');
  expect(label()).toBe(String(start + 11));
  press(game, 'ArrowUp');
  expect(label()).toBe(String(start + 1));
  press(game, 'ArrowUp');
  expect(b.focus).toBe(0);
  press(game, 'ArrowRight'); // nothing beside the promotion button
  expect(b.focus).toBe(0);
});

/** From the first spot, the four arrows reach every spot, and up/down really move up and down. */
function walkable(spots) {
  const seen = new Set([0]);
  const todo = [0];
  while (todo.length) {
    const i = todo.pop();
    for (const d of [R, L, D, U]) {
      const j = spatialStep(spots, i, ...d);
      if (d[1] && j !== i) {
        const dy = spots[j].y + spots[j].h / 2 - (spots[i].y + spots[i].h / 2);
        // either a step in that direction or a wrap to the far end
        expect(dy !== 0 || spots.every((r) => r.y < spots[i].y + spots[i].h && spots[i].y < r.y + r.h)).toBe(true);
      }
      if (!seen.has(j)) {
        seen.add(j);
        todo.push(j);
      }
    }
  }
  return seen.size;
}

test('fridge and vending machine: every item can be reached with the arrows, up and down included', () => {
  const game = { input: createInput(), sfx() {}, push() {}, pop() {}, top: null };
  for (let seed = 1; seed <= 30; seed++) {
    const fr = new FridgeCloseUp(game, { seed });
    expect(walkable(fr.spots())).toBe(fr.spots().length);
    const vm = new VendingCloseUp(game, { seed });
    expect(walkable(vm.spots())).toBe(vm.spots().length);
  }
});

test('fridge: Down from the top shelf goes to a lower shelf', () => {
  const game = { input: createInput(), sfx() {}, push() {}, pop() {}, top: null };
  const fr = new FridgeCloseUp(game, { seed: 5 });
  const sp = fr.spots();
  const j = spatialStep(sp, 0, ...D);
  expect(sp[j].y).toBeGreaterThan(sp[0].y);
});
