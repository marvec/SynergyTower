// Headless walk through the business trip: the offer on floor 10, the drive (crash and arrival), the client's office and
// the way home.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { DriveScene } = await import('../src/scenes/driveScene.js');
const { ClientOfficeScene } = await import('../src/scenes/clientOffice.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { TaskCard, Dialog } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');
const { SEG, MAX_SPEED, WRECK_AT } = await import('../src/core/drive.js');
const E = await import('../src/core/economy.js');
const T = await import('../src/core/trip.js');

const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
const g = mockCanvas().getContext('2d');
const tick = async (game, n = 3) => {
  for (let i = 0; i < n; i++) {
    game.input.beginFrame();
    game.update(1 / 60);
    game.render(g);
    game.input.endFrame();
  }
  await new Promise((r) => setTimeout(r, 0)); // dynamic imports in scene changes
};

function career(floor = 10) {
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor });
  s.flags.introSeen = true;
  s.coffee.value = 20;
  game.newCareer(s);
  return game;
}

test('floor 10: the account manager offers the trip; accepting starts the drive and uses up the chance', async () => {
  const game = career();
  const fs = new FloorScene(game, 10);
  game.set(fs);
  expect(fs.tripNpc).toBeTruthy();
  expect(fs.tripNpc.a.who.role).toBe('Account Manager');
  fs.interact({ kind: 'npc', n: fs.tripNpc });
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.action.label).toBe('Grab the keys');
  game.pop();
  await fs.startTrip();
  expect(game.top).toBeInstanceOf(DriveScene);
  expect(game.state.trips[10]).toBe('missed');
  // Floors without a trip have no account manager.
  expect(new FloorScene(game, 11).tripNpc).toBeNull();
});

test('the drive renders in every phase; a crash sends the player back to the floor with the trip missed', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  const ds = new DriveScene(game, 10);
  game.set(ds);
  await tick(game);
  ds.startLights();
  await tick(game, 160);
  expect(ds.phase).toBe('drive');
  game.input.keyDown('ArrowUp');
  await tick(game, 120);
  expect(ds.drive.speed).toBeGreaterThan(0);
  ds.drive.status = 'crashed';
  ds.end('crashed');
  await tick(game, 140);
  expect(ds.phase).toBe('result');
  ds.buttons.items[0].onClick();
  await tick(game);
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top.floorNo).toBe(10);
  expect(T.tripStatus(game.state, 10)).toBe('missed');
  expect(game.top.tripNpc).toBeTruthy(); // still there, but the offer is gone
});

test('a crash dents the car and the drive goes on; the fifth one wrecks it', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  const ds = new DriveScene(game, 10);
  game.set(ds);
  ds.phase = 'drive';
  const d = ds.drive;
  d.cars.length = 1;
  for (let k = 1; k <= WRECK_AT; k++) {
    Object.assign(d.cars[0], { d: d.d + 3 * SEG, x: d.x });
    d.speed = MAX_SPEED;
    d.grace = 0;
    await tick(game, 12); // into the car, then spinning (renders the spin-out and the damage gauge)
    expect(d.crashes).toBe(k);
    if (k < WRECK_AT) {
      expect(ds.phase).toBe('drive');
      expect(ds.message.text).toBe('CRASH!');
      await tick(game, 100); // spun out and back on the road
    }
  }
  expect(ds.phase).toBe('outro');
  expect(ds.result).toBe('crashed');
  expect(T.tripStatus(game.state, 10)).toBe('missed');
});

test('Esc pauses the drive; turning back misses the trip', async () => {
  const game = career(30);
  T.departTrip(game.state, 30);
  const ds = new DriveScene(game, 30);
  game.set(ds);
  ds.phase = 'drive';
  game.input.keyDown('Escape');
  await tick(game, 1);
  game.input.keyUp('Escape');
  expect(ds.phase).toBe('paused');
  ds.buttons.items.find((b) => b.label === 'Turn back').onClick();
  expect(ds.phase).toBe('result');
  expect(ds.result).toBe('quit');
});

test('arriving starts the 15-minute visit in the client office; tasks there pay double', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  const ds = new DriveScene(game, 10);
  game.set(ds);
  ds.phase = 'drive';
  ds.drive.cars.length = 0;
  ds.drive.d = ds.drive.finishD - 50;
  ds.drive.speed = 3000;
  await tick(game, 2);
  expect(ds.result).toBe('arrived');
  expect(T.tripStatus(game.state, 10)).toBe('done');
  expect(T.tripActive(game.state, game.now())).toBe(true);
  await tick(game, 160);
  ds.buttons.items[0].onClick();
  await tick(game);
  const co = game.top;
  expect(co).toBeInstanceOf(ClientOfficeScene);
  expect(co.fl.w).toBe(64);
  // A task card from a client station shows the doubled pay; the host runs in 'trip' mode.
  const station = co.fl.tasks[0];
  co.interact({ kind: 'task', it: station });
  expect(game.top).toBeInstanceOf(TaskCard);
  expect(game.top.trip).toBe(true);
  game.top.start();
  expect(game.top).toBeInstanceOf(MinigameScene);
  expect(game.top.mode).toBe('trip');
  const sp = game.state.sp;
  game.top.complete(0.9);
  const r = game.top.result;
  expect(r.sp).toBe(E.taskReward(10, 3, {}).sp * 2);
  expect(game.state.sp).toBe(sp + r.sp);
  expect(game.state.starsByFloor[10] || 0).toBe(0);
  game.top.finish();
  expect(game.top).toBe(co);
  // The brewer comes back after 2 minutes.
  const brewer = co.fl.items.find((it) => it.interact === 'coffee');
  co.interact({ kind: 'coffee', it: brewer });
  expect(game.state.cooldowns[T.BREWER_KEY]).toBe(game.now() + E.TRIP_BREWER_S * 1000);
  await tick(game);
});

test('when the clock runs out the visit wraps up and the player is back on the home floor', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  T.arriveTrip(game.state, 10, game.now());
  const co = new ClientOfficeScene(game, 10);
  game.set(co);
  await tick(game);
  game.state.trip.sp = 1234;
  game.state.trip.endsAt = game.now() - 1;
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('+1234 paperclips');
  expect(game.state.trip).toBeNull();
  game.top.close();
  await tick(game);
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(ClientOfficeScene);
  expect(game.top.floorNo).toBe(10);
});

test('the main entrance takes the player straight back to the office, at any time', async () => {
  const game = career(30);
  T.departTrip(game.state, 30);
  T.arriveTrip(game.state, 30, game.now());
  const co = new ClientOfficeScene(game, 30);
  game.set(co);
  game.state.trip.sp = 500;
  co.interact({ kind: 'exit', it: co.exitItem });
  await tick(game);
  expect(game.state.trip).toBeNull();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(ClientOfficeScene);
  expect(game.top.floorNo).toBe(30);
});

test('walking down into the lobby doors leaves too', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  T.arriveTrip(game.state, 10, game.now());
  const co = new ClientOfficeScene(game, 10);
  game.set(co);
  await tick(game);
  expect(game.top).toBe(co); // arriving next to the door does not send you back
  game.input.keyDown('ArrowDown');
  await tick(game, 40);
  game.input.keyUp('ArrowDown');
  await tick(game);
  expect(game.state.trip).toBeNull();
  expect(game.top).not.toBeInstanceOf(ClientOfficeScene);
});

test('continuing a career mid-visit goes back to the client; an expired visit ends at home', async () => {
  const game = career();
  T.departTrip(game.state, 10);
  T.arriveTrip(game.state, 10, game.now());
  game.saveNow();
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  expect(game.top).toBeInstanceOf(ClientOfficeScene);
  game.state.trip.endsAt = game.now() - 1000;
  game.state.trip.sp = 99;
  await title.continue();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(ClientOfficeScene);
  expect(game.state.trip).toBeNull();
});

test('the client office is a foreign floor: no stand-up, office events or firing there', async () => {
  const game = career();
  game.state.maxFloor = 40; // a CEO on a business trip
  T.departTrip(game.state, 10);
  T.arriveTrip(game.state, 10, game.now());
  const co = new ClientOfficeScene(game, 10);
  game.set(co);
  await tick(game, 5);
  expect(co.standupNpc).toBeNull();
  expect(co.tripNpc).toBeNull();
  co.interact({ kind: 'npc', n: co.npcs[0] });
  expect(game.top).toBe(co); // no Fire/Keep dialog
  expect(SEG).toBeGreaterThan(0);
});
