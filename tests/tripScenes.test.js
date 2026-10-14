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
  for (let n = 0; n < 400 && ds.phase !== 'result'; n++) await tick(game, 1); // the car parks first
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
  game.state.coffee = { value: 0, updatedAt: game.now() }; // room in the mug: a full one leaves the brewer ready
  const before = game.now(); // the real clock: it may tick between these reads
  co.interact({ kind: 'coffee', it: brewer });
  const until = game.state.cooldowns[T.BREWER_KEY] - E.TRIP_BREWER_S * 1000;
  expect(until).toBeGreaterThanOrEqual(before);
  expect(until).toBeLessThanOrEqual(game.now());
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

test('the motorway crash barrier is one unbroken rail on each side, not loose pieces', () => {
  const { RAIL } = require('../src/scenes/driveArt.js');
  const game = career();
  const ds = new DriveScene(game, 10);
  const mw = ds.track.stages.find((st) => st.id === 'motorway');
  ds.drive.d = (mw.start + 40) * SEG;
  ds.drive.stage = ds.track.stages.indexOf(mw);
  ds.drive.x = 0;
  ds.phase = 'drive';
  // A context that remembers which rows got barrier paint, left and right of the centre.
  const rows = { left: new Set(), right: new Set() };
  let fill = '';
  const ctx = new Proxy(
    { fillRect(x, y, w, h) {
      if (fill !== RAIL.beam) return;
      for (let r = Math.max(0, y); r < Math.min(270, y + h); r++) (x + w / 2 < 240 ? rows.left : rows.right).add(r);
    } },
    { get: (t, k) => (k in t ? t[k] : k === 'fillStyle' ? fill : k === 'measureText' ? (s) => ({ width: String(s).length * 5 }) : () => {}), set: (t, k, v) => (k === 'fillStyle' ? (fill = v) : (t[k] = v), true) },
  );
  ds.render(ctx);
  for (const side of ['left', 'right']) {
    const ys = [...rows[side]].sort((a, b) => a - b).filter((y) => y > 130);
    expect(ys.length, side).toBeGreaterThan(40);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1], `${side} gap at row ${ys[i - 1]}`).toBe(1);
  }
});

// The car radio and the electric motor's hum, with an audio stub that records what the scene asks for.
function radioCareer() {
  const calls = [];
  const spy = { ...audio, play: (n, after) => calls.push(['play', n, after]), setMusic: (on) => calls.push(['music', on]), hum: (l) => calls.push(['hum', l]) };
  const game = createGame({ screen: {}, input: createInput(), audio: spy });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor: 10, maxFloor: 10, level: 10 });
  s.flags.introSeen = true;
  game.newCareer(s);
  T.departTrip(game.state, 10);
  return { game, calls, plays: () => calls.filter((c) => c[0] === 'play').map((c) => c[1]) };
}
const press = async (game, key) => {
  game.input.keyDown(key);
  await tick(game, 1);
  game.input.keyUp(key);
};
const clickAt = async (game, x, y) => {
  game.input.pointerDown(x, y);
  await tick(game, 1);
  game.input.pointerUp(x, y);
  await tick(game, 1);
};

test('the car radio plays the six covers: T or a click tunes to the next one, round and round, and it is remembered', async () => {
  const { RADIO } = await import('../src/data/radio.js');
  const { game, plays } = radioCareer();
  const ds = new DriveScene(game, 10);
  game.set(ds);
  await tick(game);
  expect(plays().at(-1)).toBe('radio1');
  await press(game, 't');
  expect(plays().at(-1)).toBe('radio2');
  const r = ds.radioRect();
  expect(r.x).toBeLessThan(20); // bottom-left corner
  expect(r.y + r.h).toBeGreaterThan(250);
  await clickAt(game, r.x + r.w / 2, r.y + r.h / 2);
  expect(plays().at(-1)).toBe('radio3');
  for (let i = 0; i < 4; i++) await press(game, 't');
  expect(plays().at(-1)).toBe('radio1'); // after Track 6 comes Track 1 again
  expect(plays().filter((p) => p.startsWith('radio')).length).toBe(7);
  await press(game, 't');
  expect(game.state.settings.radio).toBe(1);
  // The next drive starts on the same station.
  const again = new DriveScene(game, 10);
  game.set(again);
  await tick(game);
  expect(plays().at(-1)).toBe(RADIO[1].song);
});

test('M switches the radio off (no music at all) and on again; T or a click while it is off switches it back on', async () => {
  const { game, calls, plays } = radioCareer();
  const ds = new DriveScene(game, 10);
  game.set(ds);
  await tick(game);
  ds.startLights();
  await tick(game, 160);
  await press(game, 'm');
  expect(game.state.settings.music).toBe(false);
  expect(calls.filter((c) => c[0] === 'music').at(-1)).toEqual(['music', false]);
  expect(ds.radioOn).toBe(false);
  await press(game, 'M');
  expect(game.state.settings.music).toBe(true);
  expect(calls.filter((c) => c[0] === 'music').at(-1)).toEqual(['music', true]);
  await press(game, 'm');
  const n = plays().length;
  await press(game, 't'); // off: T only switches it back on, on the same station
  expect(game.state.settings.music).toBe(true);
  expect(plays().length).toBe(n);
  await press(game, 'm');
  const r = ds.radioRect();
  await clickAt(game, r.x + 4, r.y + 4);
  expect(ds.radioOn).toBe(true);
});

test("the arrival card waits until the car has parked in front of the client's building", async () => {
  const game = career();
  T.departTrip(game.state, 10);
  const ds = new DriveScene(game, 10);
  game.set(ds);
  ds.phase = 'drive';
  ds.drive.cars.length = 0;
  ds.drive.d = ds.drive.finishD - 50;
  ds.drive.speed = 2000; // crawling over the line: the car still rolls up to the door
  await tick(game, 2);
  expect(ds.result).toBe('arrived');
  await tick(game, 150);
  expect(ds.phase).toBe('outro'); // still rolling
  for (let n = 0; n < 400 && ds.phase === 'outro'; n++) await tick(game, 1);
  expect(ds.phase).toBe('result');
  expect(ds.drive.speed).toBe(0);
  expect(ds.drive.d).toBe(ds.drive.parkD);
});

test('the radio buttons are labelled M and T: clicking M switches it off and on, T tunes, a key press pushes its button in', async () => {
  const { game, plays } = radioCareer();
  const ds = new DriveScene(game, 10);
  game.set(ds);
  await tick(game);
  const b = ds.radioButtons();
  expect(b.map((k) => k.key)).toEqual(['M', 'T']);
  const r = ds.radioRect();
  for (const k of b) {
    expect(k.x).toBeGreaterThanOrEqual(r.x); // on the faceplate
    expect(k.x + k.w).toBeLessThanOrEqual(r.x + r.w);
  }
  const [m, t] = b;
  await clickAt(game, m.x + m.w / 2, m.y + m.h / 2);
  expect(ds.radioOn).toBe(false);
  const n = plays().length;
  await clickAt(game, m.x + m.w / 2, m.y + m.h / 2);
  expect(ds.radioOn).toBe(true);
  expect(plays().length).toBe(n); // back on, same station
  await clickAt(game, t.x + t.w / 2, t.y + t.h / 2);
  expect(plays().at(-1)).toBe('radio2');
  game.input.keyDown('t');
  await tick(game, 1);
  expect(ds.radioPressed('T')).toBe(true);
  expect(ds.radioPressed('M')).toBe(false);
  game.input.keyUp('t');
  await tick(game, 30);
  expect(ds.radioPressed('T')).toBe(false);
});

test('pressing on the radio tunes it without driving off; the electric hum follows the speed and stops on the way out', async () => {
  const { game, calls } = radioCareer();
  const ds = new DriveScene(game, 10);
  game.set(ds);
  await tick(game);
  expect(calls.some((c) => c[0] === 'hum' && c[1] != null)).toBe(false); // engine off during the brief
  ds.startLights();
  await tick(game, 160);
  expect(ds.phase).toBe('drive');
  const r = ds.radioRect();
  game.input.pointerDown(r.x + r.w / 2, r.y + r.h / 2);
  await tick(game, 30);
  game.input.pointerUp(r.x + r.w / 2, r.y + r.h / 2);
  expect(ds.drive.speed).toBe(0);
  const hums = () => calls.filter((c) => c[0] === 'hum').map((c) => c[1]);
  expect(hums().at(-1)).toBe(0); // idling: a quiet hum
  game.input.keyDown('ArrowUp');
  await tick(game, 120);
  const fast = hums().at(-1);
  expect(fast).toBeGreaterThan(0.2);
  expect(fast).toBeLessThanOrEqual(1);
  game.input.keyUp('ArrowUp');
  ds.goHome();
  await tick(game);
  expect(game.top).not.toBe(ds);
  expect(hums().at(-1)).toBeNull();
});
