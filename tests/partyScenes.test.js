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
const { measureText } = await import('../src/engine/font.js');
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

test('the elevator panel fits the 270 px screen with both the archive A and the party P buttons', async () => {
  const game = career();
  game.set(new FloorScene(game, 12));
  await tick(game, 1);
  game.top.close(); // Later
  game.state.archive = { ...game.state.archive, task: { floor: 12 } }; // the folder is down there
  const panel = new ElevatorPanel(game, { onPromote() {}, onTravel() {}, onArchive() {}, onParty() {} });
  game.push(panel);
  await tick(game, 1);
  const items = panel.buttons.items;
  expect(items.some((b) => b.label.startsWith('A '))).toBe(true);
  expect(items.some((b) => b.label === 'P · Christmas party')).toBe(true);
  expect(items.filter((b) => /^\d+$/.test(b.label)).length).toBe(40);
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.y + panel.h).toBeLessThanOrEqual(270);
  for (const b of items) {
    expect(b.x).toBeGreaterThanOrEqual(panel.x);
    expect(b.x + b.w).toBeLessThanOrEqual(panel.x + panel.w);
    expect(b.y).toBeGreaterThanOrEqual(panel.y + 14); // under the title bar
    expect(`${b.label} ${b.y + b.h <= panel.y + panel.h - 4}`).toBe(`${b.label} true`);
  }
  for (const a of items)
    for (const b of items) {
      if (a === b) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(`${a.label}/${b.label} ${overlap}`).toBe(`${a.label}/${b.label} false`);
    }
});

test('toasts keep clear of the clock panel of a timed stay; without one they stay centred at the top', async () => {
  const game = inHall();
  await tick(game, 2);
  game.top.close?.();
  await tick(game, 1);
  const hall = game.top;
  game.toast('Short one.');
  game.toast('A much longer toast that runs all the way across the top of the screen, past the clock.');
  game.toast('Another.');
  await tick(game, 1);
  const p = hall.hudPanel;
  expect(p).toBeTruthy();
  const boxes = game.toastBoxes();
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  for (const b of boxes) {
    const clear = b.x + b.w <= p.x || b.x >= p.x + p.w || b.y + b.h <= p.y || b.y >= p.y + p.h;
    expect(`${b.text} ${clear}`).toBe(`${b.text} true`);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(480);
    expect(b.w).toBeGreaterThanOrEqual(measureText(b.text)); // the whole line inside its box
  }
  const office = career(11);
  office.set(new FloorScene(office, 11));
  await tick(office, 1);
  while (office.top !== office.scenes()[0]) office.pop();
  office.toast('Hello.');
  await tick(office, 1);
  const [b] = office.toastBoxes();
  expect(b.y).toBe(22);
  expect(Math.abs(b.x + b.w / 2 - 240)).toBeLessThanOrEqual(0.5);
});

test('the arrival confetti flies over the CEO\'s speech, not hidden behind it', async () => {
  const game = inHall();
  const hall = game.scenes()[0];
  const speech = game.top;
  expect(speech).toBeInstanceOf(Dialog);
  expect(hall.confetti.count).toBeGreaterThan(0);
  const log = [];
  const [dr, cr] = [speech.render.bind(speech), hall.confetti.render.bind(hall.confetti)];
  speech.render = (g) => (log.push('speech'), dr(g));
  hall.confetti.render = (g) => (log.push('confetti'), cr(g));
  const before = hall.confetti.bits.map((b) => b.y).join();
  await tick(game, 5);
  expect(game.top).toBe(speech);
  expect(log.lastIndexOf('confetti')).toBeGreaterThan(log.lastIndexOf('speech')); // drawn over the dialog
  expect(hall.confetti.bits.map((b) => b.y).join()).not.toBe(before); // and flying meanwhile
});
