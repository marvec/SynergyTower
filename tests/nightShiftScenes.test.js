// Headless walk through the night shift: the manager's offer on floor 15, the walk-out, what closes at night, the
// faster machines, going home early, the clock running out during a mini-game and a dark floor built from elsewhere.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog } = await import('../src/scenes/overlays.js');
const { TerminalScene } = await import('../src/scenes/terminal.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const E = await import('../src/core/economy.js');
const N = await import('../src/core/nightShift.js');
const S = await import('../src/core/state.js');

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

function career(floor = 15) {
  const sfx = [];
  const audio = { setMusic() {}, setSfx() {}, play() {}, sfx: (n) => sfx.push(n), unlock() {} };
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: game.now() };
  game.newCareer(s);
  game.sfxLog = sfx;
  return game;
}

/** A dark floor 15 with the shift already under way (as the elevator ride or a reload builds it). */
function nightFloor(floor = 15) {
  const game = career(floor);
  expect(N.startNightShift(game.state, floor, game.now()).ok).toBe(true);
  const fs = new FloorScene(game, floor);
  game.set(fs);
  return { game, fs };
}

const station = (fs, quest = false) => fs.fl.items.find((it) => it.task && !!MINIGAMES[it.task.game].quest === quest);

test('floor 15: your manager offers the night shift; starting it saves the shift', async () => {
  const game = career();
  const fs = new FloorScene(game, 15);
  game.set(fs);
  expect(fs.night).toBe(false);
  expect(fs.nightBoss).toBeTruthy();
  expect(fs.nightBoss.seed).toBe(fs.fl.npcs[0].seed);
  expect(fs.nightBoss.a.who.role).toBe('Your Manager');
  expect(new FloorScene(game, 14).nightBoss).toBeNull();
  fs.interact({ kind: 'npc', n: fs.nightBoss });
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('10 minutes');
  await tick(game, 1);
  const go = game.top.buttons.items[0];
  expect(go.label).toBe('Start the shift');
  go.onClick();
  expect(game.top).toBe(fs);
  expect(game.state.nightShift?.floor).toBe(15);
  expect(fs.night).toBe(true);
  expect(fs.standupNpc).toBeNull();
});

test('everyone walks out with a single ding, then the lights go out (8 s at most)', async () => {
  const game = career();
  const fs = new FloorScene(game, 15);
  game.set(fs);
  expect(fs.npcs.length).toBeGreaterThan(0);
  expect(fs.hrRep).toBeTruthy();
  fs.startNight();
  expect(game.state.nightShift).toBeTruthy();
  game.sfxLog.length = 0;
  expect(fs.nightFade).toBeLessThan(1);
  await tick(game, 60 * 9);
  expect(fs.npcs.length).toBe(0);
  expect(fs.hrRep).toBeNull();
  expect(fs.nightFade).toBe(1);
  expect(game.sfxLog.filter((n) => n === 'ding').length).toBe(1);
});

test('the shift is refused during a quest or an office event, and on a compliance hold', async () => {
  const game = career();
  const fs = new FloorScene(game, 15);
  game.set(fs);
  fs.quest = { props: [], update() {}, renderWorld() {}, renderHud() {}, onTalk: () => false, hintLine: () => null };
  fs.startNight();
  expect(game.state.nightShift).toBeNull();
  fs.quest = null;
  fs.event = { over: false, update() {}, interactables: () => [], onInteract: () => false, blocks: () => null, renderWorld() {}, renderHud() {}, hidesMarker: () => false, isLocked: () => false, actors: [] };
  fs.startNight();
  expect(game.state.nightShift).toBeNull();
  fs.event = null;
  game.state.conduct = { ...game.state.conduct, hold: true };
  expect(N.nightStatus(game.state, 15, game.now())).toBe('blocked');
  fs.interact({ kind: 'npc', n: fs.nightBoss });
  expect(game.top).toBe(fs); // no offer
  expect(fs.nightBoss.a.bubble).toBeTruthy(); // a short reason instead
  fs.startNight();
  expect(game.state.nightShift).toBeNull();
});

test('at night HR has gone home, the terminal is locked, quest stations stay shut and no event starts', async () => {
  const { game, fs } = nightFloor();
  const s = game.state;
  const hr = fs.fl.items.find((it) => it.interact === 'hr');
  fs.interact({ kind: 'hr', it: hr });
  expect(game.top).toBe(fs);
  expect(s.reviews[15]).toBeFalsy();
  const term = fs.fl.items.find((it) => it.terminal);
  fs.interact({ kind: 'terminal', it: term });
  expect(game.top).not.toBeInstanceOf(TerminalScene);
  expect(game.top).toBe(fs);
  const q = station(fs, true);
  if (q) {
    fs.interact({ kind: 'task', it: q });
    expect(game.top).toBe(fs);
  }
  fs.startTask({ id: 'q-test', game: 'feedback', title: '360 Feedback', difficulty: 0.3, seed: 1 });
  expect(fs.quest).toBeNull();
  // A long time on the floor with an event overdue: still nothing at night.
  s.events = { ...s.events, nextAt: 0 };
  fs.onFloorS = 10000;
  await tick(game, 120);
  expect(fs.event).toBeNull();
  // The same on a daytime floor starts one (the check above is real).
  const day = new FloorScene(game, 14);
  game.set(day);
  s.events = { ...s.events, nextAt: 0 };
  day.onFloorS = 10000;
  await tick(game, 2);
  expect(day.event).toBeTruthy();
});

test('night tasks get half the cooldown; the night machine brews at once and again after 2 minutes', async () => {
  const { game, fs } = nightFloor();
  const s = game.state;
  const it = station(fs);
  fs.startTask(it.task);
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('night');
  await tick(game, 3);
  const now = game.now();
  game.top.complete(0.9);
  const full = E.stationCooldownMs(15, s.perks, it.task.game);
  const left = S.cooldownLeft(s, it.task.id, now);
  expect(Math.abs(left - full * E.NIGHT_COOLDOWN_MULT)).toBeLessThan(2000);
  expect(s.nightShift.tasks).toBe(1);
  game.top.finish();
  expect(game.top).toBe(fs);
  // Coffee: the night key, ready at once and again after NIGHT_BREWER_S.
  expect(fs.brewerKey).toBe(N.BREWER_KEY);
  const machine = fs.fl.items.find((x) => x.interact === 'coffee');
  s.coffee.value = 0;
  fs.interact({ kind: 'coffee', it: machine });
  const first = s.coffee.value;
  expect(first).toBeGreaterThan(0);
  fs.interact({ kind: 'coffee', it: machine });
  expect(s.coffee.value).toBe(first);
  const base = game.now();
  game.now = () => base + E.NIGHT_BREWER_S * 1000 + 1000;
  fs.interact({ kind: 'coffee', it: machine });
  expect(s.coffee.value).toBeGreaterThan(first);
  expect(s.nightShift.coffee).toBeGreaterThan(first - 1);
});

test('the elevator asks "Go home early?" and brings back the daytime floor with a summary', async () => {
  const { game, fs } = nightFloor();
  const lift = fs.fl.items.find((it) => it.interact === 'elevator');
  fs.interact({ kind: 'elevator', it: lift });
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toContain('Go home early');
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  await tick(game, 1);
  expect(game.state.nightShift).toBeNull();
  const day = game.scenes()[0];
  expect(day).toBeInstanceOf(FloorScene);
  expect(day).not.toBe(fs);
  expect(day.night).toBe(false);
  expect(day.npcs.length).toBeGreaterThan(0);
  expect(day.hrRep).toBeTruthy();
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('0 tasks');
  game.top.close();
  expect(game.top).toBe(day);
});

test('time running out during a mini-game ends nothing until it is over; the task still counts', async () => {
  const { game, fs } = nightFloor();
  const s = game.state;
  const it = station(fs);
  fs.startTask(it.task);
  const mg = game.top;
  expect(mg).toBeInstanceOf(MinigameScene);
  s.nightShift.endsAt = game.now() - 1;
  await tick(game, 30);
  expect(game.top).toBe(mg);
  expect(s.nightShift).toBeTruthy();
  mg.complete(0.9);
  await tick(game, 30);
  mg.finish();
  expect(game.top).toBe(fs);
  expect(s.nightShift).toBeTruthy();
  await tick(game, 1);
  expect(s.nightShift).toBeNull();
  expect(game.scenes()[0]).not.toBe(fs);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('1 task');
});

test('starting a task after the clock has run out ends the shift instead', async () => {
  const { game, fs } = nightFloor();
  game.state.nightShift.endsAt = game.now() - 1;
  fs.startTask(station(fs).task);
  await tick(game, 1);
  expect(game.state.nightShift).toBeNull();
  expect(game.scenes().some((sc) => sc instanceof MinigameScene)).toBe(false);
});

test('a FloorScene built for the night floor from elsewhere is the dark, empty floor', async () => {
  const { game, fs } = nightFloor();
  expect(fs.night).toBe(true);
  expect(fs.npcs).toEqual([]);
  expect(fs.hrRep).toBeNull();
  expect(fs.nightBoss).toBeNull();
  expect(fs.chatNpc).toBeNull();
  expect(fs.nightFade).toBe(1);
  await tick(game, 5);
  expect(fs.standupNpc).toBeNull();
  // Another floor's scene is not dark.
  expect(new FloorScene(game, 16).night).toBe(false);
});
