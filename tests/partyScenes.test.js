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

test('the bar reopened after three drinks: the bartender refuses straight away', async () => {
  const game = career();
  PA.startParty(game.state, 12, DEC10);
  for (let i = 0; i < 3; i++) PA.drink(game.state, 'punch');
  const { BARTENDER } = await import('../src/data/party.js');
  expect(new PartyBar(game, { bartender: null }).line).toBe(BARTENDER.enough);
  PA.drink(game.state, 'water');
  expect(new PartyBar(game, { bartender: null }).line).toBe('What can I get you?');
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

// ---------------------------------------------------------------- the invitation, the elevator button, continuing
const { ElevatorPanel } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');

test('in the window, a tower floor opens the invitation once a year; Go now starts the party', async () => {
  const game = career();
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.action.label).toBe('Go now');
  game.top.close();
  game.set(new FloorScene(game, 11));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(FloorScene); // once a year
  const so = game.state.so;
  game.top.inviteParty();
  game.top.action.onClick();
  await tick(game, 2);
  expect(game.state.party).toBeTruthy();
  expect(game.state.so).toBe(so + 1);
  expect(game.top).toBeInstanceOf(Dialog); // the CEO's speech in the hall
});

test('"Later" closes the invitation with a toast about the elevator\'s party button; "Go now" does not', async () => {
  const spy = (game) => {
    const said = [];
    const toast = game.toast;
    game.toast = (text, c) => (said.push(text), toast(text, c));
    return said;
  };
  const game = career();
  const said = spy(game);
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  game.top.close(); // Later
  expect(said.filter((t) => /elevator/i.test(t) && /party/i.test(t)).length).toBe(1);
  const other = career(11);
  const heard = spy(other);
  other.set(new FloorScene(other, 11));
  await tick(other, 1);
  other.top.buttons.items.find((b) => b.label === 'Go now').onClick();
  expect(heard.some((t) => /elevator/i.test(t))).toBe(false);
});

test('outside the window: no invitation and no party button in the elevator', async () => {
  const game = career(12, { now: new Date(2026, 10, 30, 12).getTime() });
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(FloorScene);
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {}, onParty() {} });
  game.push(panel);
  await tick(game, 1);
  expect(panel.buttons.items.some((b) => b.label === 'P · Christmas party')).toBe(false);
});

test('in the window, after "Later": the elevator\'s party button starts it', async () => {
  const game = career();
  const fs = new FloorScene(game, 12);
  game.set(fs);
  await tick(game, 1);
  game.top.close(); // Later
  let went = false;
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {}, onParty: () => (went = true) });
  game.push(panel);
  await tick(game, 1);
  const b = panel.buttons.items.find((x) => x.label === 'P · Christmas party');
  expect(b).toBeTruthy();
  b.onClick();
  expect(went).toBe(true);
});

test('no invitation on hold, before check-in, or on a night shift', async () => {
  for (const prep of [(s) => (s.conduct.hold = { since: 0 }), (s) => (s.lobby = 'checkin'), (s) => (s.nightShift = { floor: 12, endsAt: DEC10 + 60000 })]) {
    const game = career();
    prep(game.state);
    game.set(new FloorScene(game, 12));
    await tick(game, 1);
    expect(game.top instanceof Dialog && game.top.action?.label === 'Go now').toBe(false);
  }
});

test('continuing a career mid-party: back to the hall while its clock runs (even after 23 December), else it ends', async () => {
  const clock = { now: new Date(2026, 11, 23, 23, 58).getTime() };
  const game = career(12, clock);
  PA.startParty(game.state, 12, clock.now);
  game.saveNow();
  clock.now = new Date(2026, 11, 24, 0, 3).getTime(); // the window is closed, the party's 10 minutes are not
  expect(PA.partyWindow(clock.now)).toBe(false);
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  await tick(game, 2);
  expect(game.scenes().some((sc) => sc instanceof PartyScene)).toBe(true); // the hall (its speech may be on top)
  expect(game.state.party).toBeTruthy();
  clock.now += E.PARTY.stayS * 1000;
  const again = new TitleScene(game);
  game.set(again);
  await again.continue();
  await tick(game, 2);
  expect(game.state.party).toBe(null);
  expect(game.top).toBeInstanceOf(FloorScene);
});
