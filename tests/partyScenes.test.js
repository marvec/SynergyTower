// Headless walk through the Christmas party: the invitation, the elevator button, the hall, an activity, the bar, the
// clock running out, continuing a career mid-party.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const PA = await import('../src/core/party.js');
const { PartyBar } = await import('../src/scenes/partyBar.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');
export const DEC10 = new Date(2026, 11, 10, 12).getTime();
export const tick = async (game, n = 3) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(1 / 60);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0));
};
export function career(floor = 12, clock = { now: DEC10 }) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  game.now = () => clock.now;
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor });
  s.flags.introSeen = true;
  game.newCareer(s);
  return game;
}

test('the bar: three drinks, then only water; water sobers you up', async () => {
  const game = career();
  PA.startParty(game.state, 12, DEC10);
  const bar = new PartyBar(game, { bartender: null });
  game.push(bar);
  await tick(game, 1);
  const btn = (label) => bar.buttons.items.find((b) => b.label === label);
  for (const label of ['Mulled wine', 'Eggnog', 'Synergy Punch']) btn(label).onClick();
  expect(PA.tipsyLevel(game.state)).toBe(3);
  await tick(game, 1);
  expect(btn('Mulled wine').disabled).toBe(true);
  btn('Water').onClick();
  expect(PA.tipsyLevel(game.state)).toBe(0);
  await tick(game, 1);
  expect(btn('Eggnog').disabled).toBe(false);
  expect(game.state.party.drinks).toBe(3);
});
