import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { nightLamps, nightLighting, lampLevel, drawNight } = await import('../src/scenes/nightLights.js');
const { buildFloor } = await import('../src/core/tasks.js');

test('every night floor gets the same lamps each visit, inside the floor, some of them flickering', () => {
  for (const f of [5, 15, 25, 35]) {
    const fl = buildFloor(f);
    const a = nightLamps(fl, f);
    expect(nightLamps(fl, f)).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(4);
    for (const l of a) {
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(fl.w);
      expect(l.y).toBeGreaterThan(0);
      expect(l.y).toBeLessThan(fl.h);
      expect(fl.tiles[Math.floor(l.y) * fl.w + Math.floor(l.x)]).not.toBe(1); // never inside a wall
    }
    const flicker = a.filter((l) => l.flicker).length;
    expect(flicker).toBeGreaterThanOrEqual(1);
    expect(flicker).toBeLessThan(a.length);
    const blink = a.filter((l) => l.flicker === 'blink').length;
    expect(blink).toBeGreaterThanOrEqual(flicker >= 2 ? 1 : 0);
    expect(blink).toBeLessThanOrEqual(2);
    if (flicker >= 2) expect(a.some((l) => l.flicker === 'waver')).toBe(true);
  }
});

test('a blinking lamp changes no more than twice a second and is mostly on', () => {
  const lamp = nightLamps(buildFloor(25), 25).find((l) => l.flicker === 'blink');
  let changes = 0, on = 0, prev = lampLevel(lamp, 0);
  const N = 1000; // 10 s in 10 ms steps
  for (let i = 1; i <= N; i++) {
    const v = lampLevel(lamp, i / 100);
    if (v !== prev) changes++;
    if (v > 0.8) on++;
    prev = v;
  }
  expect(changes).toBeLessThanOrEqual(20);
  expect(changes).toBeGreaterThan(0);
  expect(on / N).toBeGreaterThan(0.6);
  for (const l of nightLamps(buildFloor(25), 25).filter((l) => l.flicker !== 'blink')) expect(lampLevel(l, 3.7)).toBe(1);
});

test('drawing the dark floor, full or half faded, does not throw', () => {
  const fl = buildFloor(15);
  const lighting = nightLighting(fl, 15);
  const g = mockCanvas().getContext('2d');
  for (const fade of [0, 0.5, 1]) {
    expect(() => drawNight(g, lighting, { fade, cam: { x: 40, y: 20 }, player: { x: 19.5, y: 3 }, t: 2.3 })).not.toThrow();
  }
});

test('the night keeps every lamp where it was, with the same reach; tall furniture blocks light like the walls', () => {
  for (const f of [5, 15, 25, 35]) {
    const fl = buildFloor(f);
    const lamps = nightLamps(fl, f);
    const L = nightLighting(fl, f);
    const baked = L.lights.filter((l) => !l.dynamic);
    expect(baked.map((l) => [l.x, l.y, l.r])).toEqual(lamps.map((l) => [l.x * 16, l.y * 16, l.r]));
    expect(baked.filter((l) => typeof l.level === 'function').length).toBe(lamps.filter((l) => l.flicker === 'blink').length);
    expect(baked.filter((l) => l.flicker).length).toBe(lamps.filter((l) => l.flicker === 'waver').length);
    for (let i = 0; i < fl.tiles.length; i++) if (fl.tiles[i] === 1) expect(L.opaque[i]).toBe(1);
  }
  const fl = buildFloor(35);
  const L = nightLighting(fl, 35);
  const shelf = fl.items.find((it) => ['bookshelf', 'vending', 'fridge', 'serverrack', 'whiteboard'].includes(it.type));
  if (shelf) expect(L.opaque[shelf.y * fl.w + shelf.x]).toBe(1);
  const desk = fl.items.find((it) => it.type === 'desk');
  if (desk) expect(L.opaque[desk.y * fl.w + desk.x]).toBe(0);
});
