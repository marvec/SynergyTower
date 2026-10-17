// The roof (core/roof.js, docs/roof-prompt.md): the fire-escape windows, what keeps them shut, the archive tip, the
// guard's sight, the smokers, the props' lines and the cigarette mini-game.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { buildFloor, COUNTED_GAMES } = await import('../src/core/tasks.js');
const { newGame } = await import('../src/core/state.js');
const { hashString, createRng } = await import('../src/core/rng.js');
const { T_WALL } = await import('../src/core/floorgen.js');
const { dayKey } = await import('../src/core/daily.js');
const RF = await import('../src/core/roof.js');
const A = await import('../src/core/archive.js');
const Q = await import('../src/core/curios.js');
const { ROOF_QUIPS } = await import('../src/data/roof.js');
const { MINIGAMES } = await import('../src/minigames/index.js');
const { createInput } = await import('../src/engine/input.js');

const career = (floor = 2) => {
  const s = newGame({ playerName: 'Pat' }, 0);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor, sp: 500 });
  return s;
};
const NOW = new Date(2026, 9, 16, 12, 0).getTime();

test('a fire-escape window on floors 2, 12, 22 and 32 only: an outer window with a reachable tile in front', () => {
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    if (!RF.isRoofFloor(f)) {
      expect(fl.fireEscape).toBeNull();
      continue;
    }
    const { x, y } = fl.fireEscape;
    expect(y).toBe(0);
    expect(fl.tiles[x]).toBe(T_WALL);
    const below = fl.w + x;
    expect(fl.walk[below]).toBe(1);
    expect(fl.dist[below]).toBeGreaterThanOrEqual(0);
    expect(fl.rooms[fl.roomOf[below]].type).not.toBe('elevator'); // the lobby has no windows
  }
});

test('the floors are otherwise unchanged: the same tasks, colleagues, furniture and desks as before the roof', () => {
  let str = '';
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    str += `${f}:${fl.tasks.map((i) => i.task.id + i.task.game).join(',')}|${fl.npcs.map((n) => `${n.seed}@${n.x},${n.y}`).join(',')}|${fl.items.length}|${fl.myDesk?.id};`;
  }
  expect(hashString(str)).toBe(3781656975);
});

test('the window is stuck during a hold, before check-in, while away, and the rest of the day after being caught', () => {
  const s = career();
  expect(RF.roofBlock(s, NOW)).toBeNull();
  expect(RF.roofBlock({ ...career(), lobby: 'gate' }, NOW)).toBe('badge');
  const held = career();
  held.conduct.hold = { since: 0 };
  expect(RF.roofBlock(held, NOW)).toBe('hold');
  for (const k of ['trip', 'vacation', 'nightShift', 'home', 'party']) expect(RF.roofBlock({ ...career(), [k]: { endsAt: NOW + 1 } }, NOW), k).toBe('away');
  expect(RF.roofBlock({ ...career(), archive: { task: { inside: true } } }, NOW)).toBe('away');
  expect(RF.enterRoof(s, 3, NOW).ok).toBe(false); // not a roof floor
  expect(RF.enterRoof(s, 2, NOW).ok).toBe(true);
  expect(s.roof.on).toEqual({ floor: 2 });
  expect(RF.catchOnRoof(s, NOW)).toBe(2);
  expect(s.roof.on).toBeNull();
  expect(s.roof.closedDay).toBe(dayKey(NOW));
  expect(RF.roofBlock(s, NOW)).toBe('closed');
  expect(RF.enterRoof(s, 2, NOW).reason).toBe('closed');
  expect(RF.roofBlock(s, NOW + 24 * 3600 * 1000)).toBeNull(); // tomorrow it opens again
});

test('a save made on the roof resumes at the window it was reached from', () => {
  const s = career(12);
  RF.enterRoof(s, 12, NOW);
  expect(RF.resumeRoof(s)).toBe(12);
  expect(s.roof.on).toBeNull();
  expect(RF.resumeRoof(s)).toBeNull();
});

test('the archive tip names the very drawer the folder is in once HR asks on the floor above', () => {
  for (const from of RF.ROOF.floors) {
    const s = career(from);
    s.cast = from * 7;
    const hint = RF.archiveHint(s, from);
    expect(hint.floor).toBe(from + 1);
    expect(hint.label).toMatch(/^Row [A-F], cabinet \d+$/);
    expect(RF.noteHint(s, hint)).toBe(true);
    expect(RF.noteHint(s, hint)).toBe(false);
    // Up on the archive floor, HR's task puts the folder in exactly that drawer.
    Object.assign(s, { floor: from + 1, maxFloor: from + 1, level: from + 1 });
    expect(A.acceptArchive(s, from + 1).ok).toBe(true);
    expect(s.archive.task.drawer).toBe(hint.drawer);
    expect(A.drawerLabel(A.buildArchive().items[s.archive.task.drawer]).text).toBe(hint.label);
    expect(RF.archiveHint(s, from)).toEqual(hint); // still true while the task runs
    A.enterArchive(s);
    A.takeFolder(s, hint.drawer);
    expect(RF.archiveHint(s, from)).toBeNull(); // found: nothing left to tell
  }
});

test('no tip once the folder is handed in or out of reach; a task from an older save keeps its own drawer', () => {
  const s = career(2);
  s.archive = { asked: {}, done: { 3: true }, task: null };
  expect(RF.archiveHint(s, 2)).toBeNull();
  s.archive = { asked: { 3: true }, done: {}, task: null }; // declined or failed
  expect(RF.archiveHint(s, 2)).toBeNull();
  const other = A.folderDrawers(A.buildArchive()).find((d) => d.id !== A.archiveDrawer(s, 3));
  s.archive = { asked: { 3: true }, done: {}, task: { floor: 3, drawer: other.id, inside: false, found: false, folder: false } };
  expect(RF.archiveHint(s, 2).drawer).toBe(other.id);
});

test('every cabinet in the archive has its own row letter and number', () => {
  const fl = A.buildArchive();
  const labels = fl.drawers.map((d) => A.drawerLabel(d).text);
  expect(new Set(labels).size).toBe(fl.drawers.length);
  expect(A.drawerLabel(fl.drawers[0]).text).toBe('Row A, cabinet 1');
});

test('the guard sees ahead within range and all round up close, never through the water tank or the shack', () => {
  const fl = RF.buildRoof();
  const sees = (guard, player) => RF.guardSees(fl.opaque, fl.w, guard, player);
  const g = { x: 20.5, y: 13.5, fx: 1, fy: 0 };
  expect(sees(g, { x: 23.5, y: 13.5 })).toBe(true); // in front, 3 tiles
  expect(sees(g, { x: 26, y: 13.5 })).toBe(false); // too far
  expect(sees(g, { x: 17.5, y: 13.5 })).toBe(false); // behind him
  expect(sees(g, { x: 19.5, y: 13.6 })).toBe(true); // right behind him: he hears you
  // The shack (x 3..7, y 10..12) in between.
  expect(sees({ x: 5.5, y: 8.5, fx: 0, fy: 1 }, { x: 5.5, y: 13.5 })).toBe(false);
  expect(sees({ x: 1.5, y: 8.5, fx: 0, fy: 1 }, { x: 1.5, y: 12.5 })).toBe(true);
  // The water tank (x 32..34, y 5..7).
  expect(sees({ x: 31.5, y: 6.5, fx: 1, fy: 0 }, { x: 35.5, y: 6.5 })).toBe(false);
});

test('the roof is all reachable from the ladder: the smokers, the guard\'s door and his patrol', () => {
  const fl = RF.buildRoof();
  const ok = (p) => fl.walk[Math.floor(p.y) * fl.w + Math.floor(p.x)] && fl.dist[Math.floor(p.y) * fl.w + Math.floor(p.x)] >= 0;
  for (const p of [...fl.smokeSpots, ...fl.patrol, fl.door, fl.arrive]) expect(ok(p), JSON.stringify(p)).toBeTruthy();
  for (const it of [fl.ladder, fl.telescope, fl.cradle]) expect(it).toBeTruthy();
});

test('3 or 4 smokers from the floor below, the same every visit, never one the CEO fired', () => {
  const s = career(22);
  const a = RF.smokersFor(s, 22);
  expect(a.length).toBeGreaterThanOrEqual(3);
  expect(a.length).toBeLessThanOrEqual(4);
  expect(RF.smokersFor(s, 22)).toEqual(a);
  const floorSeeds = buildFloor(22).npcs.map((n) => n.seed);
  for (const n of a) expect(floorSeeds).toContain(n.seed);
  s.fired = { [a[0].seed]: true };
  expect(RF.smokersFor(s, 22).map((n) => n.seed)).not.toContain(a[0].seed);
});

test('the sky follows the local time: day, sunset from 18 h, night from 20 h to 6 h', () => {
  const at = (h) => RF.skyMode(new Date(2026, 9, 16, h, 30).getTime());
  expect(at(12)).toBe('day');
  expect(at(18)).toBe('dusk');
  expect(at(19)).toBe('dusk');
  expect(at(21)).toBe('night');
  expect(at(3)).toBe('night');
  expect(at(6)).toBe('day');
});

test('every roof prop has at least 20 things to say; the ladder, telescope and cradle are gameplay', () => {
  const fl = RF.buildRoof();
  for (const it of fl.items) {
    const kind = Q.curioOf(fl, it);
    if (['ladder', 'telescope', 'cradle'].includes(it.interact)) expect(kind).toBeNull();
    else {
      expect(kind, it.type).toBe('quip');
      expect(ROOF_QUIPS[it.type].length).toBeGreaterThanOrEqual(20);
    }
  }
  for (const [type, lines] of Object.entries(ROOF_QUIPS)) expect(lines.length, type).toBeGreaterThanOrEqual(20);
});

test('the telescope sights are spotted once each, and all of them is the Spotter badge', async () => {
  const { checkBadges } = await import('../src/core/achievements.js');
  const s = career();
  for (const e of RF.EGGS) {
    expect(RF.spot(s, e)).toBe(true);
    expect(RF.spot(s, e)).toBe(false);
  }
  expect(RF.spot(s, 'ufo')).toBe(false);
  expect(RF.allSpotted(s)).toBe(true);
  expect(checkBadges(s, 1).map((b) => b.id)).toContain('spotter');
});

test('the cigarette counts as a mini-game played (48 in all) and pays nothing', () => {
  expect(COUNTED_GAMES).toContain('cigarette');
  expect(COUNTED_GAMES.length).toBe(48);
  const s = career();
  const before = { sp: s.sp, xp: s.xp, coffee: s.coffee.value, stars: { ...s.starsByFloor } };
  const r = RF.completeSmoke(s, 'cigarette', 0.9);
  expect(r.stars).toBe(3);
  expect(s.played.cigarette).toBe(1);
  expect({ sp: s.sp, xp: s.xp, coffee: s.coffee.value, stars: s.starsByFloor }).toEqual(before);
});

// ------------------------------------------------------------------ the mini-game
const g = mockCanvas().getContext('2d');
function smoke(bot, seed) {
  const inst = MINIGAMES.cigarette.create({ difficulty: RF.ROOF.difficulty, rng: createRng(seed), theme: { dept: 'lobby', title: 'Smoke Break' }, sfx: () => {} });
  const input = createInput();
  let held = false;
  let t = 0;
  while (!inst.done && t < 100) {
    input.beginFrame();
    const want = bot ? bot(inst.peek()) : {};
    if (want.draw && !held) (input.keyDown(' '), (held = true));
    if (!want.draw && held) (input.keyUp(' '), (held = false));
    if (want.flick) (input.keyDown('f'), input.keyUp('f'));
    inst.update(1 / 60, input);
    inst.render(g);
    input.endFrame();
    t += 1 / 60;
  }
  expect(inst.done).toBe(true);
  return { score: inst.score, t };
}
const pro = (p) => ({
  draw: p.lit ? p.heat < (p.sweet[0] + p.sweet[1]) / 2 : true,
  flick: p.ash > p.ashMax * 0.6 || (p.lit && p.len - p.filter < p.stubAt * 0.8),
});

test('smoke break: a careful smoker gets 3 stars within a minute and a bit; an idle one gets nothing', () => {
  for (const seed of [1, 2, 3, 4]) {
    const good = smoke(pro, seed);
    expect(good.score, `seed ${seed}`).toBeGreaterThanOrEqual(0.85);
    expect(good.t).toBeGreaterThan(40);
    expect(good.t).toBeLessThan(70);
    expect(smoke(null, seed).score, `idle ${seed}`).toBeLessThan(0.35);
  }
});

test('smoke break: drawing all the time ends in a coughing fit, never drawing lets it go out', () => {
  expect(smoke(() => ({ draw: true }), 1).score).toBeLessThan(0.35);
  expect(smoke(() => ({ draw: false }), 1).score).toBeLessThan(0.35);
});
