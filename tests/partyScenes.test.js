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

const { PartyScene, DanceBrain } = await import('../src/scenes/party.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog } = await import('../src/scenes/overlays.js');
const { npcIdentity } = await import('../src/scenes/floorWorld.js');
const { buildFloor } = await import('../src/core/tasks.js');
const E = await import('../src/core/economy.js');

function inHall(clock = { now: DEC10 }) {
  const game = career(12, clock);
  PA.startParty(game.state, 12, clock.now);
  const hall = new PartyScene(game);
  game.set(hall);
  return game;
}

test('the hall: Santa hats, guests you know (with their own roles), six dancers, the bartender and HR', async () => {
  const game = inHall();
  await tick(game, 2);
  expect(game.top).toBeInstanceOf(Dialog); // the CEO's speech on arrival
  game.top.close();
  await tick(game, 2);
  const p = game.top;
  expect(p).toBeInstanceOf(PartyScene);
  expect(p.player.look.hat).toBe('santa');
  expect(p.npcs.length).toBe(E.PARTY.guests);
  expect(p.npcs.filter((n) => n.brain instanceof DanceBrain).length).toBe(6);
  const depts = new Map();
  for (let f = 1; f <= 12; f++) for (const n of buildFloor(f).npcs) depts.set(n.seed, buildFloor(f).dept);
  for (const n of p.npcs) expect(n.a.who.name).toBe(npcIdentity(n.seed, depts.get(n.seed), game.state.cast).name);
  expect(p.receptionist.who.role).toBe('Bartender');
  expect(p.hrRep).toBeTruthy();
  expect(game.state.party.speech).toBe(true);
});

test('an activity: free, pays once; back in the hall its play time counts towards sobering up', async () => {
  const game = inHall();
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  const hall = game.top;
  PA.drink(game.state, 'punch');
  const booth = hall.fl.activities.find((it) => it.activity.game === 'photobooth');
  hall.interact({ kind: 'activity', it: booth });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('party');
  game.top.playT = 150; // a long photo session
  game.top.complete(0.9);
  expect(game.top.result.sp).toBe(PA.activityPay(game.state));
  game.top.finish();
  expect(game.top).toBe(hall);
  expect(PA.tipsyLevel(game.state)).toBe(0); // 150 s of play: the drink wore off
});

test('the bar opens from its counter; the elevator doors ask before leaving early', async () => {
  const game = inHall();
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  const hall = game.top;
  hall.interact({ kind: 'bar', it: hall.fl.bar });
  expect(game.top.constructor.name).toBe('PartyBar');
  game.top.close();
  hall.interact({ kind: 'exit', it: hall.exitItem });
  expect(game.top).toBeInstanceOf(Dialog);
  game.top.action.onClick();
  await tick(game, 2);
  expect(game.state.party).toBe(null);
  expect(game.top).toBeInstanceOf(Dialog); // the summary card on the floor
  expect(game.top.text).toContain('Activities');
});

test('when the time is up the party ends on the floor you came from', async () => {
  const clock = { now: DEC10 };
  const game = inHall(clock);
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  clock.now = DEC10 + E.PARTY.stayS * 1000 + 1;
  await tick(game, 3);
  expect(game.state.party).toBe(null);
  expect(game.state.floor).toBe(12);
});
