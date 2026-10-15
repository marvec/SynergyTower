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
const calls = []; // every play/stop with its arguments
const audio = { setMusic() {}, setSfx() {}, play: (...a) => (played.push(a[0]), calls.push(a)), stop: () => calls.push(['stop']), sfx() {}, unlock() {} };
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

const { MINIGAMES } = await import('../src/minigames/index.js');
const { SONGS } = await import('../src/data/music.js');
const { SONG_LEAD } = await import('../src/engine/audio.js');
const { createRng } = await import('../src/core/rng.js');

/** One frame of the host, with keys pressed this frame. */
function frame(game, ms, keys = []) {
  game.input.beginFrame();
  for (const k of keys) (game.input.keyDown(k), game.input.keyUp(k));
  ms.update(1 / 60);
  game.input.endFrame();
}
const startPlay = (game, ms) => {
  ms.t = 2;
  frame(game, ms);
  expect(ms.phase).toBe('play');
};

test('Dance-Off: the host restarts the party song when play starts, and the arrows sit on its beat', () => {
  const game = party();
  const ms = new MinigameScene(game, { id: 'party-dance', game: 'dance', title: 'Dance-Off', difficulty: 0.7, seed: 1 }, null, { mode: 'party' });
  game.push(ms);
  calls.length = 0;
  startPlay(game, ms);
  expect(calls).toEqual([['xmasparty', null, { restart: true, from: 0 }]]);
  // Beat 0 of the song is heard SONG_LEAD after play starts: every arrow reaches the line on a (half) beat of it.
  const inst = MINIGAMES.dance.create({ difficulty: 0.7, rng: createRng(3), theme: {}, sfx() {} });
  expect(inst.song).toBe('xmasparty');
  const half = 60 / SONGS.xmasparty.bpm / 2;
  for (const n of inst.peek().notes) {
    const k = (n.t - SONG_LEAD) / half;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
  }
});

test('a game without a song of its own leaves the music alone at play start and on pause', () => {
  const game = party();
  const ms = new MinigameScene(game, { id: 'party-giftwrap', game: 'giftwrap', title: 'Secret Santa', difficulty: 0.3, seed: 2 }, null, { mode: 'party' });
  game.push(ms);
  calls.length = 0;
  startPlay(game, ms);
  frame(game, ms, ['Escape']);
  expect(ms.phase).toBe('paused');
  frame(game, ms, ['Escape']);
  expect(ms.phase).toBe('play');
  expect(calls).toEqual([]);
});

test('Carol Karaoke: pausing silences the carol, resuming picks it up where the lyrics are', () => {
  const game = party();
  const ms = new MinigameScene(game, { id: 'party-carols', game: 'carols', title: 'Carol Karaoke', difficulty: 0.3, seed: 3 }, null, { mode: 'party' });
  game.push(ms);
  const song = ms.inst.song;
  calls.length = 0;
  startPlay(game, ms);
  expect(calls).toEqual([[song, null, { restart: true, from: 0 }]]);
  for (let i = 0; i < 180; i++) frame(game, ms);
  frame(game, ms, ['Escape']);
  expect(ms.phase).toBe('paused');
  expect(calls.at(-1)).toEqual(['stop']);
  for (let i = 0; i < 120; i++) frame(game, ms); // a long pause: the lyrics wait, and so does the carol
  frame(game, ms, ['Escape']);
  expect(ms.phase).toBe('play');
  const [name, after, opts] = calls.at(-1);
  expect([name, after]).toEqual([song, null]);
  expect(opts.restart).toBe(true);
  expect(opts.from).toBeCloseTo(ms.inst.peek().time, 6); // the song's clock = the game's clock
  expect(opts.from).toBeCloseTo(3, 1);
  // "Keep going" resumes the same way.
  frame(game, ms, ['Escape']);
  ms.buttons.items.find((b) => b.label === 'Keep going').onClick();
  expect(ms.phase).toBe('play');
  expect(calls.at(-1)[2]).toMatchObject({ restart: true });
});
