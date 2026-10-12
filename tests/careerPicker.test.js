import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { createSlotStore, MAX_SLOTS } from '../src/core/slots.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const { createInput } = await import('../src/engine/input.js');
const { CareerPicker } = await import('../src/scenes/careerPicker.js');

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

/** A game context with n careers (the last created is the last played). */
function fakeGame(n) {
  const stack = [];
  let t = 1000;
  let id = 0;
  const store = createSlotStore(memStorage(), { now: () => t, newId: () => `c${++id}` });
  for (let i = 0; i < n; i++) {
    t += 1000;
    store.create(newGame({ corpName: 'Corp', playerName: `P${i}` }, 0));
  }
  return {
    input: createInput(),
    now: () => t,
    sfx: () => {},
    careers: () => store.list(),
    canCreateCareer: () => store.canCreate(),
    deleteCareer: (cid) => store.remove(cid),
    push: (s) => stack.push(s),
    pop: () => stack.pop(),
    get top() {
      return stack[stack.length - 1];
    },
  };
}
function frame(game, keys = []) {
  const { input } = game;
  input.beginFrame();
  for (const k of keys) {
    input.keyDown(k);
    input.keyUp(k);
  }
  game.top?.update(1 / 60);
  game.top?.render(mockCanvas().getContext('2d'));
  input.endFrame();
}
const open = (game, opts = {}) => {
  const calls = { pick: null, newCareer: 0 };
  const p = new CareerPicker(game, { onPick: (id) => (calls.pick = id), onNew: () => calls.newCareer++, ...opts });
  game.push(p);
  return { p, calls };
};

test('cards come last played first; arrows pick one and Enter plays it', () => {
  const game = fakeGame(3);
  const { p, calls } = open(game);
  expect(p.careers.map((c) => c.name)).toEqual(['P2', 'P1', 'P0']);
  frame(game, ['ArrowRight']);
  frame(game, ['Enter']);
  expect(calls.pick).toBe(p.careers[1].id);
});

test('clicking a card selects it, clicking it again plays it', () => {
  const game = fakeGame(3);
  const { p, calls } = open(game);
  const r = p.cardRect(2);
  const click = () => {
    game.input.pointerDown(r.x + 5, r.y + 5);
    game.input.pointerUp(r.x + 5, r.y + 5);
    frame(game);
  };
  click();
  expect(p.sel).toBe(2);
  expect(calls.pick).toBeNull();
  click();
  expect(calls.pick).toBe(p.careers[2].id);
});

test('delete asks once more, then removes the selected career', () => {
  const game = fakeGame(3);
  const { p } = open(game);
  frame(game, ['ArrowRight']);
  frame(game, ['Delete']);
  expect(p.careers.length).toBe(3);
  expect(p.buttons.items.find((b) => b.id === 'delete').label).toMatch(/Really/);
  frame(game, ['Delete']);
  expect(p.careers.map((c) => c.name)).toEqual(['P2', 'P0']);
});

test('moving to another card cancels a pending delete', () => {
  const game = fakeGame(3);
  const { p } = open(game);
  frame(game, ['Delete']);
  frame(game, ['ArrowRight']);
  frame(game, ['Delete']);
  expect(p.careers.length).toBe(3);
});

test('New career and Back', () => {
  const game = fakeGame(2);
  const { calls } = open(game);
  frame(game, ['n']);
  expect(calls.newCareer).toBe(1);
  frame(game, ['Escape']);
  expect(game.top).toBeUndefined();
});

test('with every slot taken, New career is disabled with a note until one is deleted', () => {
  const game = fakeGame(MAX_SLOTS);
  const { p, calls } = open(game);
  const btn = () => p.buttons.items.find((b) => b.id === 'new');
  frame(game);
  expect(btn().disabled).toBe(true);
  expect(p.note).toBe('Delete a character to create a new one');
  frame(game, ['n']);
  expect(calls.newCareer).toBe(0);
  frame(game, ['Delete']);
  frame(game, ['Delete']);
  expect(btn().disabled).toBeFalsy();
  expect(p.note).toBe('');
});

test('a long list scrolls so the selected card stays on screen', () => {
  const game = fakeGame(12);
  const { p } = open(game);
  for (let i = 0; i < 9; i++) frame(game, ['ArrowRight']);
  expect(p.sel).toBe(9);
  const r = p.cardRect(9);
  expect(r.x).toBeGreaterThanOrEqual(8);
  expect(r.x + r.w).toBeLessThanOrEqual(472);
  expect(p.cardRect(0).visible).toBe(false);
});

test('no careers: nothing to play or delete, New career still works', () => {
  const game = fakeGame(0);
  const { p, calls } = open(game);
  frame(game, ['Enter']);
  frame(game, ['Delete']);
  expect(calls.pick).toBeNull();
  expect(p.buttons.items.find((b) => b.id === 'play').disabled).toBe(true);
  frame(game, ['n']);
  expect(calls.newCareer).toBe(1);
});
