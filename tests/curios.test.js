import { test, expect } from 'bun:test';
import { buildFloor } from '../src/core/tasks.js';
import { newGame } from '../src/core/state.js';
import * as Q from '../src/core/curios.js';
import { QUIPS } from '../src/data/curios.js';
import { measureText } from '../src/engine/font.js';

const NOT_CURIOS = new Set(['hrrep', 'receptionist']);

test('most furniture is a curio; gameplay items are not', () => {
  let curios = 0;
  let total = 0;
  for (let f = 1; f <= 40; f++) {
    const fl = buildFloor(f);
    for (const it of fl.items) {
      const kind = Q.curioOf(fl, it);
      if (it.task || ['elevator', 'coffee', 'hr'].includes(it.interact) || it.terminal) expect(kind).toBeNull();
      else if (!NOT_CURIOS.has(it.type)) {
        total++;
        if (kind) curios++;
      }
    }
  }
  expect(curios).toBe(total); // every non-gameplay piece of furniture reacts
});

test('close-ups: fridge, plant, and filing cabinets in the HR office only', () => {
  const fl = buildFloor(9);
  const hrRoom = fl.rooms.find((r) => r.type === 'hr');
  for (const it of fl.items) {
    const c = Q.closeUpOf(fl, it);
    if (it.type === 'fridge') expect(c).toBe('fridge');
    else if (it.type === 'plant') expect(c).toBe('plant');
    else if (it.type === 'filing') expect(c).toBe(it.room === hrRoom.id ? 'files' : null);
    else expect(c).toBeNull();
  }
  expect(fl.items.some((it) => Q.closeUpOf(fl, it) === 'files')).toBe(true);
});

test('quips cycle through the list, starting at a per-object offset', () => {
  const fl = buildFloor(5);
  const chairs = fl.items.filter((it) => it.type === 'chair');
  const n = QUIPS.chair.length;
  const seen = new Set();
  for (let i = 0; i < n; i++) seen.add(Q.quipFor(fl, chairs[0], i));
  expect(seen.size).toBe(n);
  expect(Q.quipFor(fl, chairs[0], n)).toBe(Q.quipFor(fl, chairs[0], 0));
  const firsts = new Set(chairs.map((c) => Q.quipFor(fl, c, 0)));
  expect(firsts.size).toBeGreaterThan(1);
});

test('quips fit a small speech bubble', () => {
  for (const [type, lines] of Object.entries(QUIPS)) for (const l of lines) expect(measureText(l), `${type}: ${l}`).toBeLessThanOrEqual(560);
});

test('fridge: deterministic, labelled items and exactly one moving ancient container', () => {
  const a = Q.fridgeContents(123);
  expect(Q.fridgeContents(123)).toEqual(a);
  expect(a.items.length).toBeGreaterThanOrEqual(7);
  expect(a.items.filter((i) => i.ancient).length).toBe(1);
  expect(a.door.length).toBe(3);
  for (const i of a.items) {
    expect(i.label.length).toBeGreaterThan(0);
    expect(i.detail.length).toBeGreaterThan(0);
    expect([0, 1, 2]).toContain(i.shelf);
  }
  expect(Q.fridgeContents(124)).not.toEqual(a);
});

test('plants: some have worms, some hide things, some are plastic', () => {
  const infos = Array.from({ length: 200 }, (_, i) => Q.plantInfo(i));
  expect(infos.some((p) => p.worm)).toBe(true);
  expect(infos.some((p) => p.find)).toBe(true);
  expect(infos.some((p) => p.plastic)).toBe(true);
  expect(infos.some((p) => !p.worm && !p.find && !p.plastic)).toBe(true);
  for (const p of infos) {
    expect(p.tag).not.toContain('{name}');
    expect(p.log.length).toBe(4);
  }
  expect(Q.plantInfo(7)).toEqual(Q.plantInfo(7));
});

test('personnel files: drawers by surname, every person filed once, plus MISC', () => {
  const people = [
    { name: 'Ana Zimmer', role: 'Analyst', seed: 1 },
    { name: 'Bob Adams', role: 'Clerk', seed: 2 },
    { name: 'Cy Moss', role: 'Lead', seed: 3 },
    { name: 'Di Kahn', role: 'Intern', seed: 4 },
  ];
  const drawers = Q.fileDrawers(people);
  expect(drawers.map((d) => d.label)).toEqual(['A-H', 'I-Q', 'R-Z', 'MISC']);
  expect(drawers[0].files.map((f) => f.name)).toEqual(['Bob Adams']);
  expect(drawers[1].files.map((f) => f.name)).toEqual(['Di Kahn', 'Cy Moss']);
  expect(drawers[2].files.map((f) => f.name)).toEqual(['Ana Zimmer']);
  expect(drawers[3].files.length).toBeGreaterThan(0);
});

test('a personnel file is deterministic and full of unnecessary detail', () => {
  const p = { name: 'Bob Adams', role: 'Clerk', seed: 2 };
  const f = Q.personnelFile(p, { floor: 9 });
  expect(Q.personnelFile(p, { floor: 9 })).toEqual(f);
  expect(f.no).toMatch(/^\d{5}-[A-Z]$/);
  for (const k of ['desk', 'coffee', 'rating', 'incident', 'emergency']) expect(typeof f[k]).toBe('string');
  expect(f.shoe).toBeGreaterThan(30);
  expect(f.stars).toBeGreaterThanOrEqual(1);
  expect(f.strengths.length).toBe(2);
  expect(f.notes.length).toBe(2);
  expect(f.lines.length).toBeGreaterThan(8);
});

test('your own file uses your real career', () => {
  const s = newGame({ playerName: 'Pat' }, 0);
  s.maxFloor = 12;
  s.stats.tasksPlayed = 57;
  s.stats.fired = 0;
  const f = Q.playerFile(s);
  expect(f.name).toBe('Pat');
  expect(f.lines.join(' ')).toContain('57');
  expect(f.you).toBe(true);
});

test('names that do not start with a letter still get a drawer', () => {
  const drawers = Q.fileDrawers([{ name: 'Ann 42nd', role: 'x', seed: 1 }, { name: 'Zed', role: 'y', seed: 2 }]);
  expect(drawers.flatMap((d) => d.files).length).toBe(2 + drawers[3].files.length);
});

// ---------------------------------------------------------------- close-ups, headless
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createInput } = await import('../src/engine/input.js');
const { FridgeCloseUp, PlantCloseUp, FilesCloseUp } = await import('../src/scenes/closeUp.js');

/** A minimal game context: a scene stack, an input, no sound. */
function fakeGame() {
  const stack = [];
  return {
    input: createInput(),
    sfx: () => {},
    push: (s) => stack.push(s),
    pop: () => stack.pop(),
    get top() {
      return stack[stack.length - 1];
    },
    stack,
  };
}
function frame(game, keys = []) {
  const { input } = game;
  input.beginFrame();
  for (const k of keys) {
    input.keyDown(k);
    input.keyUp(k);
  }
  game.top?.update(1 / 60);
  game.top?.render(mockCanvas().getContext('2d'));
  input.endFrame();
}

test('fridge close-up: poking the ancient container shows its label and makes it blink', () => {
  const game = fakeGame();
  const fr = new FridgeCloseUp(game, { seed: 5 });
  game.push(fr);
  const i = fr.boxes.findIndex((b) => b.it.ancient);
  for (let k = 0; k < i; k++) frame(game, ['ArrowRight']);
  frame(game, [' ']);
  expect(fr.caption.ancient).toBe(true);
  expect(fr.blink).toBeGreaterThan(0);
  for (let k = 0; k < 120; k++) frame(game);
  let closed = false;
  fr.onClose = () => (closed = true);
  frame(game, ['Escape']);
  expect(game.top).toBeUndefined();
  expect(closed).toBe(true);
});

test('plant close-up: every hotspot gives a caption', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const game = fakeGame();
    const pl = new PlantCloseUp(game, { seed });
    game.push(pl);
    for (let k = 0; k < pl.spots().length; k++) {
      pl.caption = null;
      frame(game, [' ']);
      expect(typeof pl.caption).toBe('string');
      frame(game, ['ArrowRight']);
    }
  }
});

test('HR filing cabinet: drawer, folder, file, and Esc back out step by step', () => {
  const game = fakeGame();
  const people = [{ name: 'Bob Adams', role: 'Clerk', seed: 2 }, { name: 'Pat', role: 'You', you: true, file: Q.playerFile(newGame({ playerName: 'Pat' }, 0)) }];
  const fc = new FilesCloseUp(game, { people, floor: 3 });
  game.push(fc);
  frame(game, [' ']); // drawer A-H
  expect(fc.mode).toBe('drawer');
  frame(game, [' ']); // Bob's folder
  expect(fc.mode).toBe('file');
  expect(fc.file.name).toBe('Bob Adams');
  for (let k = 0; k < 5; k++) frame(game, ['ArrowDown']);
  frame(game, ['Escape']);
  expect(fc.mode).toBe('drawer');
  frame(game, ['Escape']);
  expect(fc.mode).toBe('cabinet');
  frame(game, ['ArrowDown', ' ']); // I-Q: Pat
  frame(game, [' ']);
  expect(fc.file.you).toBe(true);
  frame(game, ['Escape']);
  frame(game, ['Escape']);
  frame(game, ['Escape']);
  expect(game.top).toBeUndefined();
});

test('a drawer with many folders scrolls to keep the selection visible', () => {
  const game = fakeGame();
  const people = Array.from({ length: 20 }, (_, i) => ({ name: `P${i} Adams${i}`, role: 'Clerk', seed: i }));
  const fc = new FilesCloseUp(game, { people, floor: 3 });
  game.push(fc);
  frame(game, [' ']);
  for (let k = 0; k < 19; k++) frame(game, ['ArrowDown']);
  expect(fc.sel).toBe(19);
  const s = fc.spots()[19];
  expect(s.h).toBeGreaterThan(0);
  expect(fc.spots()[0].h).toBe(0);
  frame(game, [' ']);
  expect(fc.file.name).toBe(fc.drawers[0].files[19].name);
});

test('a station that is also a curio gets a Peek button on its task card', async () => {
  const { TaskCard } = await import('../src/scenes/overlays.js');
  let fl, it;
  for (let f = 1; f <= 40 && !it; f++) {
    fl = buildFloor(f);
    it = fl.items.find((i) => i.task && Q.closeUpOf(fl, i));
  }
  expect(it).toBeTruthy();
  const game = fakeGame();
  game.state = newGame({}, 0);
  game.state.floor = fl.floor;
  game.now = () => 0;
  let peeked = false;
  const card = new TaskCard(game, it.task, () => {}, { peek: () => (peeked = true) });
  game.push(card);
  card.build();
  const peek = card.buttons.items.find((b) => b.label === 'Peek');
  expect(peek).toBeTruthy();
  for (const b of card.buttons.items) expect(b.x + b.w).toBeLessThanOrEqual(card.x + card.w - 8);
  peek.onClick();
  expect(peeked).toBe(true);
  expect(game.top).toBeUndefined();
});
