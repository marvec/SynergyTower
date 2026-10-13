// Conduct (core/conduct.js): asking a colleague out once is fine, every ask after their no is a strike, the 5th strike
// puts the career on compliance hold, and the training at HR either clears it or demotes the player one floor.
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
const { ChatCard, Dialog } = await import('../src/scenes/overlays.js');

const g = mockCanvas().getContext('2d');

test('the first ask is a fair question; every ask after the no is a strike; the 5th starts the hold', () => {
  const s = newGame({ playerName: 'Pat' }, 0);
  expect(CD.askState(s, 11)).toBe('ask');
  expect(CD.askOut(s, 11, 0)).toEqual({ kind: 'first' });
  expect(s.conduct.strikes).toBe(0);
  expect(CD.askState(s, 11)).toBe('again');
  // Another colleague's first answer is free too; strikes add up across colleagues and floors.
  expect(CD.askOut(s, 22, 0).kind).toBe('first');
  for (let k = 1; k < E.HOLD_STRIKES; k++) expect(CD.askOut(s, k % 2 ? 11 : 22, 0)).toEqual({ kind: 'repeat', strike: k, hold: false });
  expect(CD.onHold(s)).toBe(false);
  expect(CD.askOut(s, 11, 5)).toEqual({ kind: 'repeat', strike: 5, hold: true });
  expect(CD.onHold(s)).toBe(true);
  // On hold (and after the training) the question is not on offer any more.
  expect(CD.askState(s, 33)).toBeNull();
  expect(CD.askOut(s, 33, 6)).toBeNull();
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
  expect(CD.completeTraining(a, 0.9)).toEqual({ passed: true, demoted: false, from: 12, to: 12 });
  expect([a.maxFloor, a.conduct.strikes, CD.onHold(a), a.reviews[12]]).toEqual([12, 0, false, true]);
  expect(CD.askState(a, 1)).toBeNull(); // lesson learned: no more drinks

  const b = hold(12);
  expect(CD.completeTraining(b, 0.2)).toEqual({ passed: false, demoted: true, from: 12, to: 11 });
  expect([b.maxFloor, b.floor, CD.onHold(b), b.reviews[11], b.reviews[12], b.conduct.demotions]).toEqual([11, 11, false, undefined, undefined, 1]);

  const c = hold(12, 5); // on a lower floor: stays there
  CD.completeTraining(c, 0);
  expect([c.maxFloor, c.floor]).toEqual([11, 5]);

  const d = hold(1);
  expect(CD.completeTraining(d, 0).demoted).toBe(false); // nowhere lower than the ground floor
  expect([d.maxFloor, d.reviews[1]]).toEqual([1, undefined]);
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
  expect(game.state.conduct.strikes).toBe(0);
  await tick(game, 1);
  for (let k = 1; k <= E.HOLD_STRIKES; k++) {
    button(game, 'Ask again').onClick();
    await tick(game, 1);
  }
  expect(CD.onHold(game.state)).toBe(true);
  expect(game.top).toBe(fs); // the card closed itself
  // Stations and the elevator are on hold.
  fs.interact({ kind: 'task', it: fs.fl.items.find((it) => it.task) });
  fs.interact({ kind: 'elevator', it: fs.fl.items.find((it) => it.interact === 'elevator') });
  expect(game.top).toBe(fs);
  // The chat colleague has nothing more to say about drinks.
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
});
