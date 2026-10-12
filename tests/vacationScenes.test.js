// Headless walk through the vacation: the boss's leave request on floor 20, the hotel, an activity paying its coffee,
// checking out early, the stay running out and continuing a career mid-holiday.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { HotelScene } = await import('../src/scenes/hotel.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');
const E = await import('../src/core/economy.js');
const V = await import('../src/core/vacation.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
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

function career(sp = 6000, floor = 20) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: game.now() };
  game.newCareer(s);
  return game;
}

test('floor 20: your manager offers vacation; going pays 5000 paperclips and opens the hotel', async () => {
  const game = career();
  const fs = new FloorScene(game, 20);
  game.set(fs);
  expect(fs.bossNpc).toBeTruthy();
  expect(fs.bossNpc.a.who.role).toBe('Your Manager');
  fs.interact({ kind: 'npc', n: fs.bossNpc });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  const go = game.top.buttons.items[0];
  expect(go.label).toContain('Go on vacation');
  expect(go.disabled).toBe(false);
  go.onClick();
  await tick(game);
  expect(game.top).toBeInstanceOf(HotelScene);
  expect(game.state.sp).toBe(1000);
  expect(V.vacationActive(game.state, game.now())).toBe(true);
  // Other floors have no manager with leave forms.
  expect(new FloorScene(game, 19).bossNpc).toBeNull();
});

test('without the paperclips the button is disabled; after a holiday the manager just chats', async () => {
  const game = career(1200);
  const fs = new FloorScene(game, 20);
  game.set(fs);
  fs.interact({ kind: 'npc', n: fs.bossNpc });
  await tick(game, 1);
  expect(game.top.text).toContain('3800 paperclips short');
  expect(game.top.buttons.items[0].disabled).toBe(true);
  game.pop();
  game.state.sp = 9000;
  V.requestVacation(game.state, 20, game.now());
  V.endVacation(game.state);
  fs.interact({ kind: 'npc', n: fs.bossNpc });
  expect(game.top).toBe(fs); // no second leave request today
});

test('the hotel: an activity is free and pays one coffee that stays above the maximum', async () => {
  const game = career();
  V.requestVacation(game.state, 20, game.now());
  const hotel = new HotelScene(game);
  game.set(hotel);
  await tick(game, 5);
  expect(hotel.fl.activities.length).toBe(8);
  expect(hotel.player.look.tie).toBeNull(); // holiday clothes
  game.state.coffee.value = 50;
  const bed = hotel.fl.activities.find((it) => it.activity.game === 'sleep');
  hotel.interact({ kind: 'activity', it: bed });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  game.top.buttons.items[0].onClick();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('vacation');
  expect(game.state.coffee.value).toBe(50); // free
  await tick(game, 3);
  game.top.complete(0.9);
  expect(game.top.result.coffee).toBe(E.VACATION_COFFEE);
  expect(game.state.coffee.value).toBe(51);
  await tick(game, 30); // the result card
  game.top.finish();
  expect(game.top).toBe(hotel);
  expect(V.activityDone(game.state, 'sleep')).toBe(true);
  // The stay keeps the extra cup: no regeneration takes it away.
  await tick(game, 5);
  expect(game.state.coffee.value).toBe(51);
});

test('the front door checks out at once, back to floor 20 with the coffee', async () => {
  const game = career();
  V.requestVacation(game.state, 20, game.now());
  const hotel = new HotelScene(game);
  game.set(hotel);
  await tick(game);
  expect(game.top).toBe(hotel); // arriving inside the door does not leave
  V.completeActivity(game.state, 'swim', 1);
  game.input.keyDown('ArrowUp');
  await tick(game, 40);
  game.input.keyUp('ArrowUp');
  await tick(game);
  expect(game.state.vacation).toBeNull();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(HotelScene);
  expect(game.top.floorNo).toBe(20);
  expect(game.state.coffee.value).toBe(5);
});

test('when the stay runs out a wrap-up card sends the player back to work', async () => {
  const game = career();
  V.requestVacation(game.state, 20, game.now());
  const hotel = new HotelScene(game);
  game.set(hotel);
  await tick(game);
  V.completeActivity(game.state, 'buffet', 0.7);
  game.state.vacation.endsAt = game.now() - 1;
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('1 extra coffee to take back');
  game.top.close();
  await tick(game);
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(HotelScene);
});

test('continuing a career mid-holiday goes back to the hotel; an expired stay ends on floor 20', async () => {
  const game = career();
  V.requestVacation(game.state, 20, game.now());
  game.saveNow();
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  expect(game.top).toBeInstanceOf(HotelScene);
  game.state.vacation.endsAt = game.now() - 1000;
  await title.continue();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(HotelScene);
  expect(game.top.floorNo).toBe(20);
  expect(game.state.vacation).toBeNull();
});

test('the hotel is a foreign floor: no stand-up, events, firing or boss offers there', async () => {
  const game = career();
  game.state.maxFloor = 40;
  V.requestVacation(game.state, 20, game.now());
  const hotel = new HotelScene(game);
  game.set(hotel);
  await tick(game, 5);
  expect(hotel.foreign).toBe(true);
  expect(hotel.standupNpc).toBeNull();
  expect(hotel.bossNpc).toBeNull();
  hotel.interact({ kind: 'npc', n: hotel.npcs[0] });
  expect(game.top).toBe(hotel); // no Fire/Keep dialog for hotel guests
});
