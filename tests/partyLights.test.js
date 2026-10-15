// The party's lights: six coloured disco spots circling the dance floor, and confetti that falls and fades.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { buildPartyHall } = await import('../src/core/partyHall.js');
const { partyLighting, discoSpots, moveDisco } = await import('../src/scenes/partyLights.js');
const { drawNight } = await import('../src/scenes/nightLights.js');
const { Confetti } = await import('../src/scenes/confetti.js');

const hall = buildPartyHall();

test('six disco spots circle the dance floor and move over time', () => {
  const a = discoSpots(hall.disco, 0);
  const b = discoSpots(hall.disco, 1);
  expect(a.length).toBe(6);
  for (let t = 0; t < 30; t += 0.7)
    for (const p of discoSpots(hall.disco, t)) {
      expect(Math.abs(p.x - hall.disco.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(p.y - hall.disco.y)).toBeLessThanOrEqual(3.5);
    }
  expect(a).not.toEqual(b);
  const lighting = partyLighting(hall);
  expect(lighting.disco.length).toBe(6);
  moveDisco(lighting, hall.disco, 2);
  expect(lighting.disco[0].x).toBeCloseTo(discoSpots(hall.disco, 2)[0].x * 16);
  const g = mockCanvas().getContext('2d');
  drawNight(g, lighting, { fade: 1, cam: { x: 0, y: 0 }, player: { x: 22, y: 3 }, t: 2 });
});

test('confetti bursts, falls and is gone after a few seconds', () => {
  let k = 0;
  const c = new Confetti(() => ((k = (k * 9301 + 49297) % 233280) / 233280));
  c.burst(240, 100, 50);
  expect(c.count).toBe(50);
  const g = mockCanvas().getContext('2d');
  for (let i = 0; i < 60; i++) (c.update(1 / 60), c.render(g));
  expect(c.count).toBeGreaterThan(0);
  for (let i = 0; i < 300; i++) c.update(1 / 60);
  expect(c.count).toBe(0);
});
