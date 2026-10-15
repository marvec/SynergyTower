// The archive challenge (core/archive.js, scenes/archive.js): HR's offer on floors 3, 13, 23 and 33, the A button, the
// basement archive with its two-minute clock, the folder and the hand-in that makes the player exactly promotion-ready.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const m = new Map();
globalThis.localStorage ??= { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
const { createInput } = await import('../src/engine/input.js');
const { createGame } = await import('../src/game.js');
const { FloorScene } = await import('../src/scenes/floorScene.js');
const { ArchiveScene } = await import('../src/scenes/archive.js');
const { ElevatorRide } = await import('../src/scenes/elevatorRide.js');
const { Dialog, ElevatorPanel, ReviewCard } = await import('../src/scenes/overlays.js');
const { TitleScene } = await import('../src/scenes/title.js');
const { furnitureDef } = await import('../src/engine/art.js');
const { T_WALL, FLOOR_W, FLOOR_H, isItemReachable } = await import('../src/core/floorgen.js');
const { buildFloor } = await import('../src/core/tasks.js');
const A = await import('../src/core/archive.js');
const S = await import('../src/core/state.js');
const E = await import('../src/core/economy.js');
const N = await import('../src/core/nightShift.js');

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

/** A career on `floor`, its highest: level `floor` (one short of the promotion), no KPI stars, 500 paperclips. */
function career(floor = 3) {
  const audio = { setMusic() {}, setSfx() {}, play() {}, sfx() {}, unlock() {} };
  const game = createGame({ screen: {}, input: createInput(), audio });
  const s = newGame({ corpName: 'Acme', playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  s.flags.introSeen = true;
  s.coffee = { value: 4, updatedAt: game.now() };
  game.newCareer(s);
  return game;
}

const fresh = (floor = 3) => {
  const s = newGame({}, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 10 });
  return s;
};

/** Waits for the scene the ride (or anything else) sets: dynamic imports resolve on a later tick. */
async function until(game, cls, frames = 600) {
  const hit = () => game.top instanceof cls && (cls === ArchiveScene || !(game.top instanceof ArchiveScene));
  for (let i = 0; i < frames && !hit(); i++) await tick(game, 1, 0.1);
  return game.top;
}

test('HR offers the task only on floors 3, 13, 23 and 33, your highest, before you are promotion-ready', () => {
  for (const f of [3, 13, 23, 33]) expect(A.archiveOffer(fresh(f), f)).toBe(true);
  for (const f of [1, 2, 4, 5, 10, 20, 30, 40]) expect(A.archiveOffer(fresh(f), f)).toBe(false);
  const lower = fresh(13);
  lower.floor = 3;
  expect(A.archiveOffer(lower, 3)).toBe(false); // floor 3 is not your highest any more
  const ready = fresh(3);
  Object.assign(ready, { level: 4, sp: E.keycardFee(3) });
  ready.starsByFloor[3] = E.starQuota(3);
  expect(S.promotionStatus(ready).ready).toBe(true);
  expect(A.archiveOffer(ready, 3)).toBe(false);
  const hold = fresh(3);
  hold.conduct.hold = { at: 0, floor: 3 };
  expect(A.archiveOffer(hold, 3)).toBe(false);
  const night = fresh(3);
  night.nightShift = { floor: 5 };
  expect(A.archiveOffer(night, 3)).toBe(false);
});

test('the archive fills a floor plan: walls round it, the elevator where every floor has it, rows of tall cabinets', () => {
  const fl = A.buildArchive();
  expect([fl.w, fl.h]).toEqual([FLOOR_W, FLOOR_H]);
  const tower = buildFloor(13).elevator;
  expect([fl.elevator.x, fl.elevator.y, fl.elevator.w]).toEqual([tower.x, tower.y, tower.w]);
  for (let x = 0; x < fl.w; x++) expect(fl.tiles[x]).toBe(T_WALL);
  // One room, no inner walls.
  for (let y = 1; y < fl.h - 1; y++) for (let x = 1; x < fl.w - 1; x++) expect(fl.tiles[y * fl.w + x]).not.toBe(T_WALL);
  expect(fl.drawers.length).toBeGreaterThan(100);
  expect(furnitureDef('archivecab').lift).toBeGreaterThanOrEqual(24); // they block the light
  for (const it of fl.drawers) expect(isItemReachable(fl, fl.walk, fl.dist, it), `drawer ${it.x},${it.y}`).toBe(true);
  expect(fl.npcs).toEqual([]);
  // Nothing on it to use but the drawers and the elevator.
  expect(fl.items.filter((it) => it.task || it.interact || it.terminal).map((it) => it.interact)).toEqual(['elevator']);
});

test('the folder is always far from the elevator (60% of the longest side), in a random drawer', () => {
  const fl = A.buildArchive();
  const far = A.folderDrawers(fl);
  expect(far.length).toBeGreaterThan(5);
  const min = 0.6 * Math.max(fl.w, fl.h);
  for (const it of far) expect(A.elevatorDistance(fl, it)).toBeGreaterThanOrEqual(min);
  const picked = new Set();
  for (let i = 0; i < 40; i++) {
    const s = fresh(3);
    expect(A.acceptArchive(s, 3).ok).toBe(true);
    const it = fl.items[s.archive.task.drawer];
    expect(it.drawer).toBe(true);
    expect(A.elevatorDistance(fl, it)).toBeGreaterThanOrEqual(min);
    picked.add(it.id);
  }
  expect(picked.size).toBeGreaterThan(5);
});

test('the task: accept, down, find, up; a failure takes it away for good on that floor', () => {
  const s = fresh(3);
  expect(A.archiveOpen(s)).toBe(false);
  A.acceptArchive(s, 3, () => 0);
  expect(A.archiveOpen(s)).toBe(true);
  expect(A.archiveOffer(s, 3)).toBe(false); // one at a time
  expect(A.enterArchive(s)).toBe(true);
  const id = s.archive.task.drawer;
  expect(A.takeFolder(s, id + 1)).toBe(false);
  expect(A.leaveWithFolder(s)).toBe(false); // no folder yet
  expect(A.takeFolder(s, id)).toBe(true);
  expect(A.carryingFolder(s)).toBe(true);
  expect(A.archiveOpen(s)).toBe(true); // still down there
  expect(A.leaveWithFolder(s)).toBe(true);
  expect(A.archiveOpen(s)).toBe(false); // the A button goes
  expect(A.carryingFolder(s)).toBe(true);
  // Failing instead: nothing else changes, and the offer does not come back.
  const f = fresh(3);
  const before = JSON.stringify({ ...f, archive: undefined });
  A.acceptArchive(f, 3);
  A.enterArchive(f);
  A.failArchive(f);
  expect(f.archive.task).toBeNull();
  expect(JSON.stringify({ ...f, archive: undefined })).toBe(before);
  expect(A.archiveOffer(f, 3)).toBe(false);
});

test('a save made in the archive counts as failing on load', () => {
  const s = fresh(13);
  A.acceptArchive(s, 13);
  expect(A.resumeArchive(s)).toBeNull(); // not down there yet: nothing to fail
  expect(A.archiveOpen(s)).toBe(true);
  A.enterArchive(s);
  const saved = JSON.parse(JSON.stringify(s));
  expect(A.resumeArchive(saved)).toBe(13);
  expect(saved.archive.task).toBeNull();
  expect(A.archiveOffer(saved, 13)).toBe(false);
  // Carrying it upstairs survives a reload.
  A.takeFolder(s, s.archive.task.drawer);
  A.leaveWithFolder(s);
  const up = JSON.parse(JSON.stringify(s));
  expect(A.resumeArchive(up)).toBeNull();
  expect(A.carryingFolder(up)).toBe(true);
});

test('handing the folder in grants exactly what is missing: promotion-ready, nothing more, and never again on that floor', () => {
  for (const setup of [
    (s) => s, // stars, a level and paperclips missing
    (s) => Object.assign(s, { level: 9, sp: 99999 }), // only stars missing
    (s) => ((s.starsByFloor[3] = 11), s), // one star short
  ]) {
    const s = setup(fresh(3));
    s.xp = E.xpToNext(s.level) - 1; // one XP short of the next level: the grant must not tip it over
    const before = S.promotionStatus(s);
    const want = A.missingForPromotion(s);
    A.acceptArchive(s, 3);
    A.enterArchive(s);
    A.takeFolder(s, s.archive.task.drawer);
    A.leaveWithFolder(s);
    expect(A.handInFolder(s, 4).ok).toBe(false); // HR on the task's floor only
    const r = A.handInFolder(s, 3);
    expect(r.ok).toBe(true);
    expect(r.granted).toEqual(want);
    const st = S.promotionStatus(s);
    expect(st.ready).toBe(true);
    expect(st.stars).toBe(Math.max(before.stars, st.quota));
    expect(st.level).toBe(Math.max(before.level, st.levelReq));
    expect(s.sp).toBe(Math.max(before.sp, st.fee));
    expect(s.xp).toBeLessThan(E.xpToNext(s.level));
    expect(st.checks.review).toBe(false); // the review is still HR's to do
    expect(A.carryingFolder(s)).toBe(false);
    expect(s.archive.done[3]).toBe(true);
    // Not ready again later (paid the fee elsewhere): still no second offer here.
    s.sp = 0;
    expect(A.archiveOffer(s, 3)).toBe(false);
  }
});

test('floor 3: HR shows the usual note, then the offer; floor 4 only the note', async () => {
  const game = career(3);
  const fs = new FloorScene(game, 3);
  game.set(fs);
  const hr = { kind: 'hr', it: fs.fl.hrDesk };
  fs.interact(hr);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toBe('HR Office');
  expect(game.top.text).toContain('promotion-ready');
  game.top.close();
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toContain('A favour');
  expect(game.top.text).toContain('5 minutes');
  await tick(game, 1);
  expect(game.top.buttons.items.map((b) => b.label)).toEqual(['Fetch the folder', 'No, thanks']);
  // Declining is final: HR asks once per floor, then only the usual note.
  game.top.buttons.items[1].onClick();
  expect(game.top).toBe(fs);
  expect(game.state.archive?.task ?? null).toBeNull();
  fs.interact(hr);
  game.top.close();
  expect(game.top).toBe(fs);
  expect(A.archiveOffer(game.state, 3)).toBe(false);
  // On floor 13, accepting; while it is on, HR only reminds.
  const g13 = career(13);
  const fs13 = new FloorScene(g13, 13);
  g13.set(fs13);
  const hr13 = { kind: 'hr', it: fs13.fl.hrDesk };
  fs13.interact(hr13);
  g13.top.close();
  await tick(g13, 1);
  g13.top.buttons.items[0].onClick();
  expect(A.archiveOpen(g13.state)).toBe(true);
  fs13.interact(hr13);
  g13.top.close();
  expect(g13.top).toBe(fs13);

  const four = career(4);
  const fs4 = new FloorScene(four, 4);
  four.set(fs4);
  fs4.interact({ kind: 'hr', it: fs4.fl.hrDesk });
  four.top.close();
  expect(four.top).toBe(fs4);
});

test('the elevator shows A only while the folder is down there', async () => {
  const game = career(3);
  const fs = new FloorScene(game, 3);
  game.set(fs);
  const labels = () => {
    fs.interact({ kind: 'elevator', it: fs.fl.elevator });
    const p = game.top;
    expect(p).toBeInstanceOf(ElevatorPanel);
    p.build();
    const out = p.buttons.items.map((b) => b.label);
    p.close();
    return out;
  };
  const hasA = (l) => l.some((x) => x.startsWith('A '));
  expect(hasA(labels())).toBe(false);
  A.acceptArchive(game.state, 3);
  expect(hasA(labels())).toBe(true);
  A.enterArchive(game.state);
  A.takeFolder(game.state, game.state.archive.task.drawer);
  A.leaveWithFolder(game.state);
  expect(hasA(labels())).toBe(false);
});

test('down to A: dark, its clock runs on scene time; with the folder in the elevator it succeeds', async () => {
  const game = career(13);
  const fs = new FloorScene(game, 13);
  game.set(fs);
  A.acceptArchive(game.state, 13);
  fs.goToArchive();
  const ar = await until(game, ArchiveScene);
  expect(ar).toBeInstanceOf(ArchiveScene);
  expect(game.state.archive.task.inside).toBe(true);
  expect(game.state.floor).toBe(13); // a reload lands upstairs
  expect(ar.npcs).toEqual([]);
  const night = new FloorScene(career(15), 15);
  night.game.state.nightShift = { floor: 15 };
  night.lighting = null;
  night.drawDark(g);
  expect(ar.lighting.ambient).toEqual(night.lighting.ambient); // as bright as the night shift
  expect(ar.lighting.lights.length).toBeGreaterThan(6);
  expect(ar.interactables().every((t) => t.kind === 'drawer' || t.kind === 'elevator')).toBe(true);
  // A wrong drawer: about a second standing still, then it is marked as checked.
  const id = game.state.archive.task.drawer;
  const wrong = ar.fl.drawers.find((it) => it.id !== id);
  ar.player.x = wrong.x + 0.5;
  ar.player.y = wrong.y + 1.6;
  ar.interact({ kind: 'drawer', it: wrong });
  await tick(game, 30); // half a second
  expect(wrong.opened).toBe(false);
  await tick(game, 40);
  expect(wrong.opened).toBe(true);
  expect(A.carryingFolder(game.state)).toBe(false);
  // The right one.
  const it = ar.fl.items[id];
  ar.player.x = it.x + 0.5;
  ar.player.y = it.y + 1.6;
  ar.interact({ kind: 'drawer', it });
  await tick(game, 70);
  expect(A.carryingFolder(game.state)).toBe(true);
  const left = ar.left;
  const limit = A.ARCHIVE.timeLimitS;
  expect(left).toBeLessThan(limit);
  expect(left).toBeGreaterThan(limit - 5);
  ar.interact({ kind: 'elevator', it: ar.fl.elevator });
  expect(ar.over).toBe(true);
  await tick(game, 1);
  expect(game.top).toBeInstanceOf(ElevatorRide);
  expect(ar.left).toBe(left); // the clock stopped
  expect(game.state.archive.task.folder).toBe(true);
  const back = await until(game, FloorScene);
  expect(back.floorNo).toBe(13);
  expect(back).not.toBeInstanceOf(ArchiveScene);
});

test('the clock runs out on A: a short message, back upstairs, no task, nothing else lost', async () => {
  const game = career(23);
  const s = game.state;
  A.acceptArchive(s, 23);
  const before = { sp: s.sp, level: s.level, coffee: s.coffee.value, so: s.so };
  const ar = new ArchiveScene(game, 23);
  game.set(ar);
  await tick(game, 1);
  // The timer pauses with the game (a menu on top) and runs on frame time, not wall-clock time.
  ar.openMenu();
  await tick(game, 100, 1);
  game.pop();
  const limit = A.ARCHIVE.timeLimitS;
  expect(ar.left).toBeGreaterThan(limit - 1);
  await tick(game, limit - 20, 1); // all but 20 s
  expect(ar.left).toBeGreaterThan(19);
  expect(ar.left).toBeLessThan(21);
  await tick(game, 6, 1);
  expect(ar.urgent).toBe(true); // last 15 s: the dark turns red
  await tick(game, 20, 1);
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.title).toBe('Out of time');
  expect(s.archive.task).toBeNull();
  game.top.close();
  const up = await until(game, FloorScene);
  expect(up.floorNo).toBe(23);
  expect({ sp: s.sp, level: s.level, coffee: s.coffee.value, so: s.so }).toEqual(before);
  expect(A.archiveOffer(s, 23)).toBe(false); // gone for this floor
});

test('giving up at the elevator without the folder ends the task cleanly', async () => {
  const game = career(3);
  A.acceptArchive(game.state, 3);
  const ar = new ArchiveScene(game, 3);
  game.set(ar);
  ar.interact({ kind: 'elevator', it: ar.fl.elevator });
  expect(game.top).toBeInstanceOf(Dialog);
  await tick(game, 1);
  expect(game.top.buttons.items[0].label).toBe('Go back up');
  game.top.buttons.items[0].onClick();
  expect(game.state.archive.task).toBeNull();
  expect(await until(game, FloorScene)).not.toBeInstanceOf(ArchiveScene);
});

test('back on floor 3, HR takes the folder: promotion-ready, then the review as usual', async () => {
  const game = career(3);
  const s = game.state;
  A.acceptArchive(s, 3);
  A.enterArchive(s);
  A.takeFolder(s, s.archive.task.drawer);
  A.leaveWithFolder(s);
  const fs = new FloorScene(game, 3);
  game.set(fs);
  fs.interact({ kind: 'hr', it: fs.fl.hrDesk });
  expect(game.top).toBeInstanceOf(Dialog);
  expect(game.top.text).toContain('found it');
  expect(S.promotionStatus(s).ready).toBe(true);
  game.top.close();
  expect(game.top).toBeInstanceOf(ReviewCard);
  expect(s.archive.done[3]).toBe(true);
});

test('continuing a career saved in the archive: back upstairs with a toast, the task off', async () => {
  const game = career(33);
  A.acceptArchive(game.state, 33);
  A.enterArchive(game.state);
  game.saveNow();
  const title = new TitleScene(game);
  game.set(title);
  await title.continue();
  expect(game.top).toBeInstanceOf(FloorScene);
  expect(game.top).not.toBeInstanceOf(ArchiveScene);
  expect(game.top.floorNo).toBe(33);
  expect(game.state.archive.task).toBeNull();
});

test('the night shift clock still draws through the shared clock panel', () => {
  const game = career(15);
  N.startNightShift(game.state, 15, game.now());
  const fs = new FloorScene(game, 15);
  game.set(fs);
  const names = [];
  const oc = fs.drawClockPanel.bind(fs);
  fs.drawClockPanel = (gg, y, o) => (names.push(o.name), oc(gg, y, o));
  fs.render(g);
  expect(names).toEqual(['NIGHT SHIFT']);
});
