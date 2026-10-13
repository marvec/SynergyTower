// Conduct (core/conduct.js): every ask for a drink is a strike, the 5th puts the career on compliance hold, and the
// training at HR either clears it or demotes the player one floor; then it can all happen again.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame, deserialize, serialize } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const CD = await import('../src/core/conduct.js');
const E = await import('../src/core/economy.js');
const { buildFloor } = await import('../src/core/tasks.js');
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { FIRST_NO, REPEAT_NO, COMPLIANCE, GOSSIP_LINES, FROSTY_LINES } = await import('../src/data/conduct.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { ElevatorRide } = await import('../src/scenes/elevatorRide.js');
const { FiredScene } = await import('../src/scenes/fired.js');
const { TitleScene } = await import('../src/scenes/title.js');
const { ChatCard, Dialog } = await import('../src/scenes/overlays.js');

const g = mockCanvas().getContext('2d');

test('every ask is a strike, the first one too; strikes add up across colleagues; the 5th starts the hold', () => {
  const s = newGame({ playerName: 'Pat' }, 0);
  expect(CD.askState(s, 11)).toBe('ask');
  expect(CD.askOut(s, 11, 0)).toEqual({ kind: 'first', strike: 1, hold: false });
  expect(CD.askState(s, 11)).toBe('again');
  expect(CD.askOut(s, 22, 0)).toEqual({ kind: 'first', strike: 2, hold: false });
  expect(CD.askOut(s, 11, 0)).toEqual({ kind: 'repeat', strike: 3, hold: false });
  expect(CD.askOut(s, 22, 0)).toEqual({ kind: 'repeat', strike: 4, hold: false });
  expect(CD.onHold(s)).toBe(false);
  expect(CD.askOut(s, 33, 5)).toEqual({ kind: 'first', strike: 5, hold: true });
  expect(CD.onHold(s)).toBe(true);
  // On hold the question is not on offer.
  expect(CD.askState(s, 44)).toBeNull();
  expect(CD.askOut(s, 44, 6)).toBeNull();
  // After the training it is back, from zero strikes, for everyone but the colleague who reported you.
  CD.completeTraining(s, 1);
  expect([CD.askState(s, 11), CD.askState(s, 44), CD.askState(s, 33)]).toEqual(['again', 'ask', null]);
  expect(CD.askOut(s, 33, 7)).toBeNull();
  expect(CD.askOut(s, 11, 7)).toEqual({ kind: 'repeat', strike: 1, hold: false });
});

test('passing the training clears the record; failing demotes one floor and the review there is due again', () => {
  const hold = (floor, at = floor) => {
    const s = newGame({ playerName: 'Pat' }, 0);
    Object.assign(s, { maxFloor: floor, floor: at, reviews: { [floor - 1]: true, [floor]: true } });
    s.conduct.hold = { at: 0, floor };
    s.conduct.strikes = 5;
    return s;
  };
  const a = hold(12);
  expect(CD.completeTraining(a, 0.9)).toEqual({ passed: true, demoted: false, fired: false, from: 12, to: 12 });
  expect([a.maxFloor, a.conduct.strikes, CD.onHold(a), a.reviews[12]]).toEqual([12, 0, false, true]);

  const b = hold(12);
  expect(CD.completeTraining(b, 0.2)).toEqual({ passed: false, demoted: true, fired: false, from: 12, to: 11 });
  expect([b.maxFloor, b.floor, CD.onHold(b), b.reviews[11], b.reviews[12], b.conduct.demotions]).toEqual([11, 11, false, undefined, undefined, 1]);

  const c = hold(12, 5); // on a lower floor: stays there
  CD.completeTraining(c, 0);
  expect([c.maxFloor, c.floor]).toEqual([11, 5]);

  const d = hold(1);
  expect(CD.completeTraining(d, 0)).toEqual({ passed: false, demoted: false, fired: true, from: 1, to: 1 }); // nowhere lower
  expect([d.maxFloor, d.conduct.fired, d.conduct.demotions]).toEqual([1, true, 0]);
});

test('every tower floor has a chat colleague (not the first: trip and leave offers); old saves get a clean record', () => {
  for (let f = 1; f <= E.FLOORS; f++) {
    const fl = buildFloor(f);
    const seed = CD.chatSeed(fl, f);
    expect(fl.npcs.some((n) => n.seed === seed)).toBe(true);
    expect(seed).not.toBe(fl.npcs[0].seed);
  }
  const old = JSON.parse(serialize(newGame({ playerName: 'Pat' }, 0)));
  delete old.conduct;
  expect(deserialize(JSON.stringify(old), 0).conduct).toMatchObject({ strikes: 0, hold: null, trained: false });
});

test('the answers are plenty and different; the quiz has enough questions', () => {
  expect(FIRST_NO.length).toBeGreaterThanOrEqual(12);
  expect(REPEAT_NO.length).toBe(E.HOLD_STRIKES);
  for (const list of REPEAT_NO) expect(list.length).toBeGreaterThanOrEqual(4);
  const all = [...FIRST_NO, ...REPEAT_NO.flat(), ...GOSSIP_LINES, ...FROSTY_LINES];
  expect(new Set(all).size).toBe(all.length);
  expect(COMPLIANCE.length).toBeGreaterThanOrEqual(16);
  for (const q of COMPLIANCE) expect(q.w.length).toBe(3);
});

/** The training with a player who answers `pick(right)` each question. */
function training(pick, d = 0.5, seed = 3) {
  const inst = MINIGAMES.compliance.create({ difficulty: d, rng: createRng(seed), theme: { dept: 'legalhr', title: 'T' }, sfx: () => {} });
  const input = createInput();
  let t = 0;
  let asked = -1;
  while (!inst.done && t < 200) {
    input.beginFrame();
    const right = inst.peek();
    if (t - asked > 1.5) {
      const k = pick(right);
      if (k != null) input.keyDown(String(k + 1)), input.keyUp(String(k + 1));
      asked = t;
    }
    inst.update(1 / 30, input);
    inst.render(g);
    input.endFrame();
    t += 1 / 30;
  }
  expect(inst.done).toBe(true);
  return inst.score;
}

test('the training: a careful player passes with full marks, an idle one fails', () => {
  for (const d of [0, 0.5, 1]) expect(training((r) => r, d)).toBe(1);
  expect(training(() => null)).toBe(0);
  expect(training((r) => (r + 1) % 3)).toBeLessThan(E.COMPLIANCE_PASS_SCORE);
});

// ---- the whole flow on a floor, headless
const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const tick = async (game, n = 3) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(1 / 60);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0));
};
function career(floor = 12) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, reviews: { [floor]: true } });
  s.flags.introSeen = true;
  s.coffee = { value: 10, updatedAt: game.now() };
  game.newCareer(s);
  return game;
}
const button = (game, label) => game.top.buttons.items.find((b) => b.label.startsWith(label));

test('on a floor: the chat card, five strikes, the hold, the training and the demotion ride', async () => {
  const game = career(12);
  const fs = new FloorScene(game, 12);
  game.set(fs);
  const n = fs.chatNpc;
  expect(n).toBeTruthy();
  expect(fs.standupNpc).not.toBe(n);
  fs.interact({ kind: 'npc', n });
  expect(game.top).toBeInstanceOf(ChatCard);
  await tick(game, 1);
  button(game, 'Small talk').onClick();
  button(game, 'Ask for a drink').onClick();
  expect(game.state.conduct.strikes).toBe(1);
  await tick(game, 1);
  for (let k = 2; k <= E.HOLD_STRIKES; k++) {
    button(game, 'Ask again').onClick();
    await tick(game, 1);
  }
  expect(CD.onHold(game.state)).toBe(true);
  expect(game.top).toBe(fs); // the card closed itself
  // Stations and the elevator are on hold.
  fs.interact({ kind: 'task', it: fs.fl.items.find((it) => it.task) });
  fs.interact({ kind: 'elevator', it: fs.fl.items.find((it) => it.interact === 'elevator') });
  expect(game.top).toBe(fs);
  // On hold the chat colleague has nothing more to say about drinks.
  fs.interact({ kind: 'npc', n });
  await tick(game, 1);
  expect(button(game, 'Ask')).toBeUndefined();
  game.top.close();
  // HR: the training, failed on purpose.
  fs.interact({ kind: 'hr', it: fs.fl.items.find((it) => it.interact === 'hr') });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  button(game, 'Start the training').onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  game.top.complete(0);
  expect(game.state.maxFloor).toBe(11);
  game.top.finish();
  await tick(game);
  expect(game.top).toBeInstanceOf(ElevatorRide);
  expect(game.top.to).toBe(11);
  expect(CD.onHold(game.state)).toBe(false);
  // On the new floor the drink question is on offer again.
  const fs2 = new FloorScene(game, 11);
  game.set(fs2);
  fs2.interact({ kind: 'npc', n: fs2.chatNpc });
  await tick(game, 1);
  expect(button(game, 'Ask for a drink')).toBeTruthy();
});

test('failing the training on floor 1 gets you fired: the career is deleted at once, then the walk out and the title', async () => {
  const game = career(1);
  const id = game.slot;
  const fs = new FloorScene(game, 1);
  game.set(fs);
  game.state.conduct.hold = { at: 0, floor: 1 };
  game.state.conduct.strikes = E.HOLD_STRIKES;
  fs.interact({ kind: 'hr', it: fs.fl.items.find((it) => it.interact === 'hr') });
  expect(game.top.text).toContain('fired');
  await tick(game, 1);
  button(game, 'Start the training').onClick();
  game.top.complete(0);
  expect(game.state).toBeNull();
  expect(game.careers().some((c) => c.id === id)).toBe(false);
  await tick(game, 2); // the result screen still draws without a career
  expect(button(game, 'Clear my desk')).toBeTruthy();
  await game.top.finish();
  expect(game.top).toBeInstanceOf(FiredScene);
  for (let i = 0; i < 120; i++) await tick(game, 1);
  button(game, 'Back to the title').onClick();
  await tick(game);
  expect(game.top).toBeInstanceOf(TitleScene);
});

test('on compliance hold before checking in (no badge, HR out of reach): reception calls security, the career ends', async () => {
  const game = career(1);
  game.state.lobby = 'checkin';
  const id = game.slot;
  const fs = new FloorScene(game, 1);
  game.set(fs);
  fs.interact({ kind: 'npc', n: fs.chatNpc });
  await tick(game, 1);
  for (let k = 1; k <= E.HOLD_STRIKES; k++) {
    button(game, 'Ask').onClick();
    await tick(game, 1);
  }
  expect(CD.lockedOut(game.state)).toBe(true);
  expect(game.top).toBe(fs);
  for (let i = 0; i < 4 * 60 && !(game.top instanceof FiredScene); i++) await tick(game, 1);
  expect(game.top).toBeInstanceOf(FiredScene);
  expect(game.top.career.reason).toBe('checkin');
  expect(game.state).toBeNull();
  expect(game.careers().some((c) => c.id === id)).toBe(false);
});

test('a career saved in that state (reloaded mid-lockout) is fired on entering the floor', async () => {
  const game = career(1);
  Object.assign(game.state, { lobby: 'checkin' });
  game.state.conduct.hold = { at: 0, floor: 1 };
  game.set(new FloorScene(game, 1));
  for (let i = 0; i < 4 * 60 && !(game.top instanceof FiredScene); i++) await tick(game, 1);
  expect(game.top).toBeInstanceOf(FiredScene);
});
