// Headless walk through a home office day: the manager's offer on floor 8, the flat (centred on screen), the computer,
// a chore in MinigameScene mode 'home' draining the presence meter, video calls, three lapses sending you back, the
// front door, the time running out and continuing a career mid-day.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { HomeScene } = await import('../src/scenes/home.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog, PauseMenu } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');
const { W, H } = await import('../src/engine/screen.js');
const { HUD_H } = await import('../src/scenes/hud.js');
const HO = await import('../src/core/home.js');
const { buildFloor } = await import('../src/core/tasks.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');
const tick = async (game, n = 3, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(dt);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0));
};

function career(floor = 8) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: game.now() };
  game.newCareer(s);
  return game;
}
function atHome(floor = 8) {
  const game = career(floor);
  HO.startHome(game.state, floor, game.now());
  game.state.home.calls = []; // no surprises unless a test plans one
  const home = new HomeScene(game);
  game.set(home);
  return { game, home };
}

test('floor 8: your manager offers the home office; accepting takes you home', async () => {
  const game = career();
  const fs = new FloorScene(game, 8);
  game.set(fs);
  expect(fs.homeBoss).toBeTruthy();
  expect(fs.homeBoss.a.who.role).toBe('Your Manager');
  fs.interact({ kind: 'npc', n: fs.homeBoss });
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('Finish it from home today');
  await tick(game, 1);
  const go = game.top.buttons.items[0];
  expect(go.label).toBe('Work from home');
  go.onClick();
  await tick(game);
  expect(game.top).toBeInstanceOf(HomeScene);
  expect(HO.homeActive(game.state, game.now())).toBe(true);
  expect(game.state.home.floor).toBe(8);
  // Not on other floors; after today's day at home the manager just chats.
  expect(new FloorScene(game, 9).homeBoss).toBeNull();
  HO.endHome(game.state, 'early');
  const again = new FloorScene(game, 18);
  game.set(again);
  again.interact({ kind: 'npc', n: again.homeBoss });
  expect(game.top).toBe(again);
});

test('a compliance hold: the manager says no', async () => {
  const game = career();
  game.state.conduct = { strikes: 5, refused: {}, reported: {}, hold: { at: game.now(), floor: 8 } };
  const fs = new FloorScene(game, 8);
  game.set(fs);
  fs.interact({ kind: 'npc', n: fs.homeBoss });
  expect(game.top).toBe(fs);
  expect(fs.homeBoss.a.bubble?.text || '').toContain('compliance hold');
});

test('the flat is centred below the HUD, and you are in your home clothes', async () => {
  const { game, home } = atHome();
  await tick(game, 5);
  const fl = home.fl;
  expect(home.cam.x).toBe(Math.round((fl.w * 16 - W) / 2));
  expect(home.cam.y).toBe(-HUD_H - Math.round((H - HUD_H - fl.h * 16) / 2));
  // Walking about does not scroll a map that fits.
  home.player.x = 2;
  home.snapCamera();
  expect(home.cam.x).toBe(Math.round((fl.w * 16 - W) / 2));
  expect(home.player.look.tie).toBeNull();
  expect(home.hud.floorLabel).toBe('Home');
});

test('a chore: a cup, MinigameScene mode home, pays once; its play time drains the presence meter', async () => {
  const { game, home } = atHome();
  await tick(game, 2);
  const s = game.state;
  const sink = home.fl.chores.find((it) => it.chore.game === 'dishes');
  home.interact({ kind: 'chore', it: sink });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('home');
  expect(s.coffee.value).toBe(3);
  const before = s.home.presence;
  await tick(game, 3);
  game.top.playT = 60;
  game.top.complete(0.9);
  expect(game.top.result.first).toBe(true);
  expect(game.top.result.sp).toBeGreaterThan(0);
  await tick(game, 30);
  game.top.finish();
  expect(game.top).toBe(home);
  expect(s.home.presence).toBeCloseTo(before - 60, 0);
  expect(HO.choreDone(s, 'dishes')).toBe(true);
  // The computer fills it up again.
  home.interact({ kind: 'computer', it: home.fl.computer });
  expect(s.home.presence).toBe(HO.HOME.presenceS);
});

test('the coffee maker is free and pours up to the maximum', async () => {
  const { game, home } = atHome();
  const s = game.state;
  s.coffee.value = 1;
  const brewer = home.fl.chores.find((it) => it.chore.game === 'brew');
  home.interact({ kind: 'chore', it: brewer });
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(s.coffee.value).toBe(1);
  game.top.complete(1);
  expect(s.coffee.value).toBe(4);
  game.top.finish();
  // Brewing again waits for the cooldown: the card's button is disabled.
  home.interact({ kind: 'chore', it: brewer });
  await tick(game, 1);
  expect(game.top.buttons.items[0].disabled).toBe(true);
});

test('a video call rings: chores wait, the computer answers it', async () => {
  const { game, home } = atHome();
  const s = game.state;
  s.home.calls = [{ at: s.home.t + 0.05, state: 'pending', left: 0 }];
  await tick(game, 10);
  expect(HO.ringingCall(s)).toBeTruthy();
  const tub = home.fl.chores.find((it) => it.chore.game === 'bath');
  home.interact({ kind: 'chore', it: tub });
  expect(game.top).toBe(home); // no chore card while the boss is calling
  home.interact({ kind: 'computer', it: home.fl.computer });
  expect(s.home.calls[0].state).toBe('answered');
});

test('the game paused: the presence meter and the stay\'s clock wait', async () => {
  const { game, home } = atHome();
  const s = game.state;
  game.push(new PauseMenu(game, { onQuit() {} }));
  const p = s.home.presence;
  const left = HO.homeLeft(s, game.now());
  await tick(game, 120, 0.5); // a minute in the menu
  expect(s.home.presence).toBe(p);
  expect(HO.homeLeft(s, game.now())).toBeGreaterThanOrEqual(left - 50); // the stay's clock stood still too
  game.pop();
  await tick(game, 60);
  expect(s.home.presence).toBeLessThan(p);
  expect(game.top).toBe(home);
});

test("three lapses: called back in, the floor's cooldowns stay", async () => {
  const { game } = atHome();
  const s = game.state;
  const id = buildFloor(8).tasks[0].task.id;
  s.cooldowns[id] = game.now() + 600000;
  s.home.lapses = 2;
  s.home.presence = 0.01;
  await tick(game, 3);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('Come back to the office');
  expect(s.home).toBeNull();
  game.top.close();
  await tick(game, 3);
  expect(game.top).toBeInstanceOf(Dialog); // the summary card on the office floor
  expect(game.top.text).toContain('No fresh start');
  game.pop();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top.floorNo).toBe(8);
  expect(s.cooldowns[id]).toBeGreaterThan(game.now());
});

test('the front door: back to the office early, the cooldowns cleared', async () => {
  const { game, home } = atHome();
  const s = game.state;
  const id = buildFloor(8).tasks[0].task.id;
  s.cooldowns[id] = game.now() + 600000;
  await tick(game, 3);
  expect(game.top).toBe(home); // arriving inside the door does not leave
  home.interact({ kind: 'exit', it: home.exitItem });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  await tick(game, 3);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toBe('Back early');
  game.pop();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(s.cooldowns[id]).toBeUndefined();
  expect(s.home).toBeNull();
});

test('the time runs out: back at the office with the summary', async () => {
  const { game } = atHome();
  game.state.home.endsAt = game.now() - 1;
  await tick(game, 3);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toBe('Back from home');
  game.pop();
  expect(game.top).toBeInstanceOf(FloorScene);
});

test('Continue: back home while the day lasts, else it ends on the floor', async () => {
  const game = career();
  HO.startHome(game.state, 8, game.now());
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  expect(game.top).toBeInstanceOf(HomeScene);
  game.state.home.endsAt = game.now() - 1000;
  await title.continue();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(HomeScene);
  expect(game.top.floorNo).toBe(8);
  expect(game.state.home).toBeNull();
});

test('a paused chore holds the stay\'s clock too', async () => {
  const { game, home } = atHome();
  const s = game.state;
  const sink = home.fl.chores.find((it) => it.chore.game === 'dishes');
  home.interact({ kind: 'chore', it: sink });
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  const mg = game.top;
  mg.phase = 'paused';
  mg.buildPause();
  // A fake wall clock that moves with the frames.
  let clock = Date.now();
  game.now = () => clock;
  const run = async (n, dt) => {
    for (let i = 0; i < n; i++) {
      clock += dt * 1000;
      await tick(game, 1, dt);
    }
  };
  const left = HO.homeLeft(s, game.now());
  await run(60, 0.5); // half a minute paused
  expect(HO.homeLeft(s, game.now())).toBeGreaterThanOrEqual(left - 600);
  mg.phase = 'play';
  await run(20, 0.5); // ten seconds playing
  expect(HO.homeLeft(s, game.now())).toBeLessThan(left - 9000);
});
