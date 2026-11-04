// Headless Daily Memo: the host's 'memo' mode (fixed seed and theme, one attempt, the result panel), the lobby
// noticeboard on tower floors, its card and the attempt flow.
import { test, expect, afterEach } from 'bun:test';
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

// Careers here are played on Memo dates (in the future): delete them, or the title test elsewhere would load one.
const games = [];
afterEach(() => {
  for (const game of games.splice(0)) if (game.slot) game.deleteCareer(game.slot);
});

function career(floor = 9, now = memoDay(40)) {
  const audio = { setMusic() {}, setSfx() {}, play() {}, stop() {}, sfx() {}, unlock() {} };
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  s.flags.introSeen = true;
  s.partyInvite = new Date(now).getFullYear(); // Memo #40 falls in December: no Christmas party invitation here
  s.coffee = { value: 4, updatedAt: now };
  game.newCareer(s);
  games.push(game);
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

// ------------------------------------------------------------ the lobby noticeboard and its card
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { MemoCard } = await import('../src/scenes/memoCard.js');
const { ELEVATOR_ROOM } = await import('../src/core/floorgen.js');
const { buildArchive } = await import('../src/core/archive.js');
const { buildClientFloor } = await import('../src/core/clientFloor.js');
const { buildHome } = await import('../src/core/home.js');
const { buildHotel } = await import('../src/core/hotel.js');
const { buildPartyHall } = await import('../src/core/partyHall.js');
const { buildRoof } = await import('../src/core/roof.js');
const N = await import('../src/core/nightShift.js');

function onFloor(floor = 9, now = memoDay(40)) {
  const game = career(floor, now);
  const fs = new FloorScene(game, floor);
  game.set(fs);
  return { game, fs, s: game.state };
}
/** Stand below the plant beside the directory and press Space. */
const standAtBoard = (fs) => Object.assign(fs.player, { x: 22.5, y: 2.2 });

test('every tower floor has the Memo board on the lobby\'s outer wall, above the plant', () => {
  for (const f of [1, 9, 40]) {
    const { fs } = onFloor(f);
    expect(fs.memoBoard.it).toMatchObject({ x: ELEVATOR_ROOM.x1, y: 0, w: 1, h: 2 });
    expect(fs.interactables().some((t) => t.kind === 'memo')).toBe(true);
    standAtBoard(fs);
    expect(fs.nearest().kind).toBe('memo'); // not the directory station next to it
  }
});

test('foreign maps have no Memo board', () => {
  const game = career(10);
  for (const fl of [buildArchive(), buildClientFloor(10), buildHome(), buildHotel(), buildPartyHall(), buildRoof()]) {
    const fs = new FloorScene(game, 10, { fl });
    expect(fs.memoBoard).toBeNull();
    expect(fs.interactables().some((t) => t.kind === 'memo')).toBe(false);
  }
});

test('the board opens the card; Play saves the attempt before the game starts (AE2)', async () => {
  const { game, fs, s } = onFloor();
  fs.interact(fs.memoBoard);
  expect(game.top).toBeInstanceOf(MemoCard);
  await tick(game, 1);
  expect(game.top.buttons.items.map((b) => b.label)).toEqual(['Play', 'Close']);
  let saved = null;
  const save = game.saveNow;
  game.saveNow = () => {
    save();
    saved = JSON.parse(localStorage.getItem(`synergytower.slot.${game.slot}`)).memo.open;
  };
  game.top.buttons.items[0].onClick();
  expect(saved).toEqual({ n: 40, game: M.memoFor(40).game });
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('memo');
  // The tab closes mid-game: loading the career settles the attempt to 0.
  expect(game.loadCareer(game.slot)).toBe(true);
  expect(game.state.memo.open).toBe(null);
  expect(game.state.memo.history[0]).toMatchObject({ n: 40, score: 0, stars: 0 });
  const again = new FloorScene(game, 9);
  game.set(again);
  again.interact(again.memoBoard);
  await tick(game, 1);
  expect(game.top.buttons.items.map((b) => b.label)).toEqual(['Share', 'Close']);
});

test('after a result the card shows it with Share, and no Play', async () => {
  const { game, fs } = onFloor();
  fs.interact(fs.memoBoard);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  playTo(game.top, 0.9);
  game.top.finish();
  expect(game.top).toBe(fs);
  fs.interact(fs.memoBoard);
  await tick(game, 1);
  const card = game.top;
  expect(card.buttons.items.map((b) => b.label)).toEqual(['Share', 'Close']);
  card.render(g);
});

test('a card open at midnight turns to the next Memo, and Play starts that one', async () => {
  const { game, fs, s } = onFloor(9, memoDay(40, 23, 59));
  M.startMemo(s, game.now());
  M.completeMemo(s, 40, 0.5);
  fs.interact(fs.memoBoard);
  await tick(game, 1);
  expect(game.top.n).toBe(40);
  expect(game.top.buttons.items[0].label).toBe('Share');
  game.setNow(memoDay(41, 0, 0));
  await tick(game, 1);
  expect(game.top.n).toBe(41);
  expect(game.top.buttons.items[0].label).toBe('Play');
  game.top.buttons.items[0].onClick();
  expect(game.top.task.n).toBe(41);
});

test('no card before the check-in, on a night shift or during a hold', () => {
  {
    const { game, fs, s } = onFloor(1);
    s.lobby = 'checkin';
    fs.interact(fs.memoBoard);
    expect(game.top).toBe(fs);
    expect(fs.player.bubble).toBeTruthy();
  }
  {
    const { game, s } = onFloor(15);
    expect(N.startNightShift(s, 15, game.now()).ok).toBe(true);
    const fs = new FloorScene(game, 15);
    game.set(fs);
    fs.interact(fs.memoBoard);
    expect(game.top).toBe(fs);
    expect(fs.player.bubble).toBeTruthy();
  }
  {
    const { game, fs, s } = onFloor();
    s.conduct.hold = { since: 0 };
    fs.interact(fs.memoBoard);
    expect(game.top).toBe(fs);
  }
});

test('the Memo toast shows once a day, not again on the next floor', () => {
  const { game, s } = onFloor(9);
  expect(s.memo.toastDay).toBeTruthy(); // set by the first floor of the day
  const toasts = [];
  const real = game.toast.bind(game);
  game.toast = (t, c) => (toasts.push(t), real(t, c));
  const memoToasts = () => toasts.filter((t) => t.includes('Memo #'));
  game.set(new FloorScene(game, 8));
  game.set(new FloorScene(game, 9));
  expect(memoToasts()).toEqual([]);
  game.setNow(memoDay(41, 9));
  game.set(new FloorScene(game, 8));
  game.set(new FloorScene(game, 9));
  expect(memoToasts()).toEqual(['Memo #41 is on the lobby noticeboard']);
});

test('the stand-up and the Memo on the same day keep their own streaks', async () => {
  const { game, s } = onFloor(9);
  const D = await import('../src/core/daily.js');
  expect(D.completeStandup(s, 'quiz', 0.9, game.now(), () => 1)).toBeTruthy();
  M.startMemo(s, game.now());
  M.completeMemo(s, 40, 0.2);
  expect(s.daily.streak).toBe(1);
  expect(s.memo.streak).toBe(1);
  expect(M.memoStatus(s, game.now())).toBe('done');
  expect(D.standupStatus(s, game.now())).toBe('done');
});
