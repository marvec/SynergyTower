// The mini-game host at the party: free, pays once, the Secret Santa gift on the result, the party theme for the buffet.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const PA = await import('../src/core/party.js');

const DEC10 = new Date(2026, 11, 10, 12).getTime();
const played = [];
const audio = { setMusic() {}, setSfx() {}, play: (n) => played.push(n), sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');

function party() {
  const game = createGame({ screen: {}, input: createInput(), audio });
  game.now = () => DEC10;
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor: 12, maxFloor: 12, level: 12 });
  s.flags.introSeen = true;
  game.newCareer(s);
  PA.startParty(s, 12, DEC10);
  return game;
}

test('party mode: the party theme, free, pays once, the gift on the result', () => {
  const game = party();
  const s = game.state;
  const coffee = s.coffee.value;
  const ms = new MinigameScene(game, { id: 'party-giftwrap', game: 'giftwrap', title: 'Secret Santa', difficulty: 0.3, seed: 5 }, null, { mode: 'party' });
  game.push(ms);
  expect(played.at(-1)).toBe('xmasparty');
  ms.complete(0.9);
  expect(ms.result).toMatchObject({ stars: 3, first: true, gift: 'xmas-2026', sp: PA.activityPay(s) });
  expect(s.coffee.value).toBe(coffee);
  ms.render(g);
  const again = new MinigameScene(game, { id: 'party-giftwrap', game: 'giftwrap', title: 'Secret Santa', difficulty: 0.3, seed: 6 }, null, { mode: 'party' });
  game.push(again);
  again.complete(0.9);
  expect(again.result).toMatchObject({ first: false, sp: 0, gift: null });
  again.render(g);
  const buffet = new MinigameScene(game, { id: 'party-buffet', game: 'buffet', title: 'Christmas Buffet', difficulty: 0.3, seed: 7 }, null, { mode: 'party' });
  expect(buffet.inst).toBeTruthy(); // created with theme.dept 'party' (dishes covered in partyGames.test.js)
});

test('tipsy: the host still renders a party game while swaying, and with the double image', () => {
  const game = party();
  for (let i = 0; i < 3; i++) PA.drink(game.state, 'punch');
  const ms = new MinigameScene(game, { id: 'party-dance', game: 'dance', title: 'Dance-Off', difficulty: 0.3, seed: 1 }, null, { mode: 'party' });
  game.push(ms);
  ms.phase = 'play';
  for (let i = 0; i < 30; i++) {
    ms.update(1 / 60);
    ms.render(g);
  }
  expect(ms.phase).toBe('play');
});
