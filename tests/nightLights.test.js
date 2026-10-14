import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { nightLamps, lampLevel, drawNight } = await import('../src/scenes/nightLights.js');
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
    }
    const flicker = a.filter((l) => l.flicker).length;
    expect(flicker).toBeGreaterThanOrEqual(1);
    expect(flicker).toBeLessThan(a.length);
  }
});

test('a flickering lamp changes no more than twice a second and is mostly on', () => {
  const lamp = nightLamps(buildFloor(25), 25).find((l) => l.flicker);
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
  const steady = nightLamps(buildFloor(25), 25).find((l) => !l.flicker);
  expect(lampLevel(steady, 3.7)).toBe(1);
});

test('drawing the dark floor, full or half faded, does not throw', () => {
  const fl = buildFloor(15);
  const lamps = nightLamps(fl, 15);
  const g = mockCanvas().getContext('2d');
  for (const fade of [0, 0.5, 1]) {
    expect(() => drawNight(g, { lamps, fade, cam: { x: 40, y: 20 }, player: { x: 19.5, y: 3 }, t: 2.3 })).not.toThrow();
  }
});
