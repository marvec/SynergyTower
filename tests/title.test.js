import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { TitleScene } = await import('../src/scenes/title.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const g = () => mockCanvas().getContext('2d');

test('the title loads the last played career and survives it being deleted from the picker', () => {
  const game = createGame({ screen: {}, input: createInput(), audio });
  game.newCareer(newGame({ corpName: 'A Corp', playerName: 'Ann' }, 0));
  game.newCareer(newGame({ corpName: 'B Corp', playerName: 'Bob' }, 0));
  const title = new TitleScene(game);
  game.set(title);
  expect(game.state.player.name).toBe('Bob');
  game.deleteCareer(game.slot); // what the picker does, while the title is drawn underneath it
  expect(game.state).toBeNull();
  expect(() => title.render(g())).not.toThrow();
  title.resume(); // back from the picker
  expect(game.state.player.name).toBe('Ann');
  title.render(g());
});
