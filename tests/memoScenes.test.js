// Headless Daily Memo: the host's 'memo' mode (fixed seed and theme, one attempt, the result panel), the lobby
// noticeboard on tower floors, its card and the attempt flow.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas, recordingCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const M = await import('../src/core/memo.js');
const E = await import('../src/core/economy.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { hasGlyph } = await import('../src/engine/font.js');

const g = mockCanvas().getContext('2d');
const tick = async (game, n = 3) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(1 / 60);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0));
};
const [EY, EM, ED] = M.MEMO_EPOCH.split('-').map(Number);
const memoDay = (n, h = 12, min = 0) => new Date(EY, EM - 1, ED + n - 1, h, min).getTime();

function career(floor = 9, now = memoDay(40)) {
  const audio = { setMusic() {}, setSfx() {}, play() {}, stop() {}, sfx() {}, unlock() {} };
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: now };
  game.newCareer(s);
  let t = now;
  game.now = () => t;
  game.setNow = (v) => (t = v);
  return game;
}

/** Starts Memo n's attempt and pushes its host, as the card's Play does. */
function hostFor(game, n) {
  const memo = M.startMemo(game.state, memoDay(n));
  const mg = new MinigameScene(game, memo, null, { mode: 'memo' });
  game.push(mg);
  return mg;
}
const playTo = (mg, score) => {
  mg.phase = 'play';
  mg.complete(score);
};

test('the same Memo makes the same game, whatever the clock', () => {
  const quizDays = [...Array(90).keys()].map((i) => i + 1).filter((i) => M.memoFor(i).game === 'quiz');
  /** The first frame of Memo n's game, drawn: the question and answers are its content. */
  const frame = (n, now) => {
    const real = Date.now;
    Date.now = () => now;
    try {
      const { inst } = new MinigameScene(career(), M.memoFor(n), null, { mode: 'memo' });
      const rec = recordingCanvas();
      inst.render(rec.ctx);
      return JSON.stringify(rec.calls);
    } finally {
      Date.now = real;
    }
  };
  expect(frame(quizDays[0], 1e12)).toBe(frame(quizDays[0], 2e12));
  expect(frame(quizDays[0], 1e12)).not.toBe(frame(quizDays[1], 1e12)); // another Memo, other questions
});

test('the host gives the game the Memo\'s difficulty and theme, not the career\'s floor', () => {
  const game = career(23);
  const memo = M.memoFor(40);
  let seen;
  const real = MINIGAMES[memo.game].create;
  MINIGAMES[memo.game].create = (o) => ((seen = o), real(o));
  try {
    new MinigameScene(game, memo, null, { mode: 'memo' });
  } finally {
    MINIGAMES[memo.game].create = real;
  }
  expect(seen.difficulty).toBe(memo.difficulty);
  expect(seen.theme).toEqual(M.memoTheme(memo));
  expect(seen.player).toBeTruthy();
});

test('a finished Memo records its stars and paperclips, nothing else', async () => {
  const game = career(9);
  const s = game.state;
  const before = { sp: s.sp, coffee: s.coffee.value, xp: s.xp };
  const mg = hostFor(game, 40);
  playTo(mg, 0.9);
  expect(mg.phase).toBe('result');
  expect(s.memo.history[0]).toMatchObject({ n: 40, stars: 3, score: 0.9 });
  expect(s.sp).toBe(before.sp + Math.round(E.MEMO * E.taskReward(9, 3).sp));
  expect(s.coffee.value).toBe(before.coffee);
  expect(s.xp).toBe(before.xp);
  expect(s.played).toEqual({});
  expect(s.bestByTask).toEqual({});
  expect(s.memo.open).toBe(null);
  await tick(game, 40);
  const labels = mg.buttons.items.map((b) => b.label);
  expect(labels).toEqual(['Share', 'Done']);
});

test('giving up is a 0 and uses the attempt', () => {
  const game = career();
  const mg = hostFor(game, 40);
  mg.phase = 'play';
  mg.pause();
  mg.giveUp();
  expect(game.state.memo.history[0]).toMatchObject({ n: 40, score: 0, stars: 0 });
  expect(M.memoStatus(game.state, memoDay(40, 18))).toBe('done');
});

test('a Memo started before midnight counts for its own number', () => {
  const game = career(9, memoDay(40, 23, 59));
  const mg = hostFor(game, 40);
  game.setNow(memoDay(41, 0, 1));
  playTo(mg, 0.7);
  expect(game.state.memo.history[0].n).toBe(40);
  expect(M.memoStatus(game.state, game.now())).toBe('pending');
});

test('the Memo result panel renders, its text fits the bitmap font', async () => {
  const game = career();
  const mg = hostFor(game, 40);
  playTo(mg, 0.62);
  await tick(game, 30);
  mg.renderMemoResult(g);
  const lines = mg.memoLines();
  for (const t of lines) for (const ch of t) expect(hasGlyph(ch)).toBe(true);
  expect(lines.join(' ')).toContain('0.62');
});
