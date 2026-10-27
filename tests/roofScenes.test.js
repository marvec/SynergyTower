// The roof's scenes (scenes/roof.js and friends): out of the window and up the fire escape, the guard, the smokers'
// tip, the telescope, the cradle and the ways back down; Continue on a save made up there.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { newGame } = await import('../src/core/state.js');
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { RoofScene, SmokersCard } = await import('../src/scenes/roof.js');
const { RoofClimb } = await import('../src/scenes/roofClimb.js');
const { CradleRide } = await import('../src/scenes/cradle.js');
const { TelescopeView, SIGHTS } = await import('../src/scenes/telescope.js');
const { MinigameScene } = await import('../src/scenes/minigameScene.js');
const { Dialog } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');
const { STUCK_LINES } = await import('../src/data/roof.js');
const RF = await import('../src/core/roof.js');
const A = await import('../src/core/archive.js');

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
async function until(game, test, frames = 600) {
  for (let i = 0; i < frames && !test(game.top); i++) await tick(game, 1, 0.1);
  return game.top;
}

function career(floor = 2) {
  const audio = { setMusic() {}, setSfx() {}, play() {}, stop() {}, sfx() {}, unlock() {} };
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: game.now() };
  // The test files share one storage (and its 100 career slots): leave none behind.
  for (const c of game.careers()) game.deleteCareer(c.id);
  game.newCareer(s);
  return game;
}
/** Straight onto the roof from `from`. */
async function onRoof(from = 2) {
  const game = career(from);
  RF.enterRoof(game.state, from, game.now());
  const rs = new RoofScene(game, from);
  game.set(rs);
  await tick(game);
  return { game, rs };
}

test('the fire-escape window: up the ladder (skippable) and onto the roof, saved as being up there', async () => {
  const game = career(2);
  const fs = new FloorScene(game, 2);
  game.set(fs);
  await tick(game);
  expect(fs.curioTargets()).toContain(fs.fireEscape);
  fs.interact(fs.fireEscape);
  const climb = await until(game, (t) => t instanceof RoofClimb);
  expect(climb).toBeInstanceOf(RoofClimb);
  expect(game.state.roof.on).toEqual({ floor: 2 });
  const rs = await until(game, (t) => t instanceof RoofScene);
  expect(rs).toBeInstanceOf(RoofScene);
  expect(rs.hud.floorLabel).toBe('Roof');
  expect(rs.npcs.length).toBeGreaterThanOrEqual(3);
  expect(rs.foreign).toBe(true);
});

test('the climb draws the windows right down to the bottom of the screen, both ways', () => {
  const game = career(12);
  for (const up of [true, false]) {
    const climb = new RoofClimb(game, 12, { up });
    climb.mode = 'day';
    for (const t of [0, 0.4, 0.9, 1.7, 2.6]) {
      climb.t = t;
      // A context that keeps the day glass's rectangles (the windows' panes).
      const panes = [];
      const ctx = new Proxy({}, {
        get: (o, k) => (k === 'fillRect' ? (x, y, w, h) => o.fillStyle === '#8ec5f0' && panes.push(y + h) : k in o ? o[k] : () => {}),
        set: (o, k, v) => ((o[k] = v), true),
      });
      climb.render(ctx);
      expect(Math.max(...panes)).toBeGreaterThan(270 - 44); // within a floor of the bottom edge
    }
  }
});

test('no fire escape on other floors; a stuck window says why and stays shut', async () => {
  const game = career(3);
  const fs3 = new FloorScene(game, 3);
  expect(fs3.fireEscape).toBeNull();
  const g2 = career(2);
  g2.state.roof = { closedDay: null };
  const fs = new FloorScene(g2, 2);
  g2.set(fs);
  RF.roof(g2.state).closedDay = (await import('../src/core/daily.js')).dayKey(g2.now());
  fs.interact(fs.fireEscape);
  await tick(g2);
  expect(g2.top).toBe(fs);
  expect(fs.player.bubble.text).toBe(STUCK_LINES.closed);
  expect(g2.state.roof.on).toBeNull();
});

test('a save made on the roof: Continue puts you back at the window it was reached from', async () => {
  const game = career(12);
  RF.enterRoof(game.state, 12, game.now());
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  await tick(game);
  const fs = game.top instanceof FloorScene ? game.top : game.scenes().find((sc) => sc instanceof FloorScene);
  expect(fs.floorNo).toBe(12);
  expect(game.state.roof.on).toBeNull();
  const fe = fs.fl.fireEscape;
  expect(Math.floor(fs.player.x)).toBe(fe.x);
  expect(Math.floor(fs.player.y)).toBe(1);
});

test('the guard: out of the roof door, he sees you in front of him, "?" and a moment later you are walked down', async () => {
  const { game, rs } = await onRoof(22);
  rs.spawnGuard();
  const gd = rs.guard;
  gd.wait = 99; // stand still at the door
  gd.fx = 0;
  gd.fy = 1;
  rs.player.x = gd.a.x;
  rs.player.y = gd.a.y + 2.5;
  await tick(game, 2);
  expect(rs.guard.alarmed).toBe(true);
  await tick(game, 70);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.state.roof.on).toBeNull();
  expect(RF.roofBlock(game.state, game.now())).toBe('closed');
  game.top.close();
  const fs = await until(game, (t) => t instanceof FloorScene && !(t instanceof RoofScene));
  expect(fs.floorNo).toBe(22);
});

test('out of his sight again in time: he shrugs it off (Not Today); hidden behind the shack he never sees you', async () => {
  const { game, rs } = await onRoof(2);
  rs.spawnGuard();
  const gd = rs.guard;
  gd.wait = 99;
  gd.fx = 0;
  gd.fy = 1;
  rs.player.x = gd.a.x + 0.3;
  rs.player.y = gd.a.y + 3;
  await tick(game, 20); // a third of a second: "?"
  expect(gd.alarmed).toBe(true);
  rs.player.x = 1.5; // round the corner of the shack
  rs.player.y = 8.5;
  await tick(game, 90);
  expect(rs.guard.alarmed).toBe(false);
  expect(game.state.roof.escapes).toBe(1);
  expect(game.top).toBe(rs);
});

test('the guard patrols and goes back in through the roof door', async () => {
  const { game, rs } = await onRoof(2);
  rs.player.x = 37.5; // well out of the way, behind the water tank's corner
  rs.player.y = 1.6;
  rs.spawnGuard();
  rs.guard.outS = 1;
  rs.guard.stops = [];
  for (let i = 0; i < 400 && rs.guard; i++) await tick(game, 1, 0.1);
  expect(rs.guard).toBeNull();
  expect(game.top).toBe(rs);
});

test('the smokers: "No thanks", then small talk, and one lets slip where the archive folder is', async () => {
  const { game, rs } = await onRoof(12);
  const n = rs.npcs[0];
  rs.interact({ kind: 'npc', n });
  const card = game.top;
  expect(card).toBeInstanceOf(SmokersCard);
  card.onDecline();
  expect(game.state.roof.declined).toBe(1);
  const line = card.onTalk();
  const hint = RF.archiveHint(game.state, 12);
  expect(line).toContain(hint.label);
  expect(game.state.roof.hints[13]).toBe(hint.label);
  expect(A.archiveDrawer(game.state, 13)).toBe(hint.drawer);
});

test('a cigarette: the mini-game in mode roof, counted, and afterwards the tip', async () => {
  const { game, rs } = await onRoof(32);
  const n = rs.npcs[1];
  rs.smoke(n);
  const mg = game.top;
  expect(mg).toBeInstanceOf(MinigameScene);
  expect(mg.mode).toBe('roof');
  mg.complete(0.5);
  expect(game.state.played.cigarette).toBe(1);
  mg.finish();
  expect(game.top).toBe(rs);
  expect(n.a.bubble.text).toContain(RF.archiveHint(game.state, 32).label);
});

test('a cigarette gets the roof\'s sky (the debug override included), not the clock', async () => {
  const { recordingCanvas } = await import('./mock-canvas.js');
  const { game, rs } = await onRoof(32);
  rs.mode = 'night';
  rs.smoke(rs.npcs[1]);
  const mg = game.top;
  expect(mg.task.sky).toBe('night');
  const { ctx, calls } = recordingCanvas();
  mg.inst.render(ctx);
  expect(calls.some((c) => c.fill === '#8a5a5a')).toBe(true); // the night hand
});

test('the pay telescope takes its paperclips; a sight centred and zoomed in is spotted', async () => {
  const { game, rs } = await onRoof(2);
  const sp = game.state.sp;
  await rs.lookThrough();
  expect(game.state.sp).toBe(sp - RF.ROOF.telescopeSp);
  const tv = game.top;
  expect(tv).toBeInstanceOf(TelescopeView);
  tv.zoom = 2.5;
  const s = SIGHTS.waver;
  tv.cx = (s.x + s.w / 2 - 0) / s.f; // the waver's middle to the middle of the view
  const r = tv.sightRect('waver');
  expect(tv.trySpot(r.x + r.w / 2, r.y + r.h / 2)).toBe(true);
  expect(game.state.roof.spotted.waver).toBe(true);
  tv.left = 0.01;
  await tick(game, 60);
  expect(game.top).toBe(rs);
  game.state.sp = 1;
  rs.useTelescope();
  game.top.build();
  expect(game.top.buttons.items[0].disabled).toBe(true);
});

test('the telescope by keyboard alone: turned until the crosshair is in line with a sight, Space spots it at any height', async () => {
  const { game, rs } = await onRoof(2);
  game.state.sp = 500;
  await rs.lookThrough();
  const tv = game.top;
  expect(tv).toBeInstanceOf(TelescopeView);
  for (const id of RF.EGGS) {
    const r = tv.sightRect(id);
    tv.cx += (r.x + r.w / 2 - 240) / (SIGHTS[id].f * tv.zoom); // the arrows' job: the sight's middle to the crosshair's x
    expect(tv.sightInLine()).toBe(id);
    game.input.keyDown(' ');
    await tick(game, 1);
    game.input.keyUp(' ');
    await tick(game, 1);
    expect(game.state.roof.spotted[id]).toBe(true);
  }
  expect(RF.allSpotted(game.state)).toBe(true);
});

test("the waver stands in one of the facade's windows, no bigger than it", () => {
  const s = SIGHTS.waver;
  // drawNear's grid: 16x14 frames from (572, 185), 24 and 22 px apart; their glass 1 px inside.
  const wx = 572 + Math.floor((s.x - 572) / 24) * 24;
  const wy = 185 + Math.floor((s.y - 185) / 22) * 22;
  expect(s.x).toBeGreaterThanOrEqual(wx + 1);
  expect(s.y).toBeGreaterThanOrEqual(wy + 1);
  expect(s.x + s.w).toBeLessThanOrEqual(wx + 15);
  expect(s.y + s.h).toBeLessThanOrEqual(wy + 13);
});

test("at night the roof's lighting knows its parapet is low: its top takes no light from the player, only the ambient", async () => {
  const { rs } = await onRoof(2);
  rs.mode = 'night';
  rs.render(g);
  expect(rs.lighting.top).toBe(12); // WALL_H, no outer rise
});

test('the cradle rides down the facade to the floor you came from, back in at the window', async () => {
  const { game, rs } = await onRoof(22);
  await rs.rideCradle();
  const ride = await until(game, (t) => t instanceof CradleRide);
  expect(ride).toBeInstanceOf(CradleRide);
  expect(game.state.roof.on).toBeNull();
  await tick(game, 30);
  game.input.keyDown(' ');
  await tick(game, 1);
  game.input.keyUp(' ');
  const fs = await until(game, (t) => t instanceof FloorScene);
  expect(fs.floorNo).toBe(22);
  expect(Math.floor(fs.player.x)).toBe(fs.fl.fireEscape.x);
});

test('the ladder back down; at night the roof is lit by its lamps and the sky keeps its stars', async () => {
  const { game, rs } = await onRoof(2);
  rs.mode = 'night';
  rs.render(g);
  expect(rs.lighting).toBeTruthy();
  rs.mode = 'dusk';
  rs.render(g);
  await rs.climbDown();
  const climb = await until(game, (t) => t instanceof RoofClimb);
  expect(climb.up).toBe(false);
  const fs = await until(game, (t) => t instanceof FloorScene, 200);
  expect(fs.floorNo).toBe(2);
});
