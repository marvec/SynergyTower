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

test('confetti fades out at the end of its life, and leaves the canvas alpha as it found it', () => {
  let k = 0;
  const c = new Confetti(() => ((k = (k * 9301 + 49297) % 233280) / 233280));
  c.burst(240, 60, 40);
  const alphas = [];
  const g = { globalAlpha: 1, fillStyle: '', fillRect() { alphas.push(this.globalAlpha); } };
  c.render(g);
  expect(Math.min(...alphas)).toBe(1); // fresh bits are solid
  for (let i = 0; i < 115; i++) c.update(1 / 60); // ~1.9 s: the shortest-lived bits (2 s) are in their last moments
  alphas.length = 0;
  c.render(g);
  expect(alphas.length).toBeGreaterThan(0);
  expect(Math.min(...alphas)).toBeLessThan(0.5);
  expect(Math.max(...alphas)).toBeLessThanOrEqual(1);
  expect(g.globalAlpha).toBe(1);
});

const { discoBall } = await import('../src/scenes/partyLights.js');
const { CHAR_H } = await import('../src/engine/art.js');

test('the disco ball and its string stay clear of the DJ booth, of whoever stands at it, and of anyone in front', () => {
  const b = discoBall(hall);
  const booth = hall.items.find((it) => it.type === 'djbooth');
  // Nothing of the ball over the booth's sprite, nor over someone standing on the row in front of it.
  const standY = (booth.y + booth.h + 1) * 16; // feet at the bottom of the row in front
  expect(b.top).toBeGreaterThan(standY);
  expect(b.top).toBeGreaterThan(booth.y * 16 + booth.h * 16);
  // Hanging over the dance floor's centre: whoever stands in front of that point (lower on screen) is drawn after the
  // world and the ball is not over them.
  expect(b.bottom).toBeLessThan(hall.disco.y * 16 - CHAR_H);
  expect(b.x).toBe(Math.round(hall.disco.x * 16));
  expect(b.top).toBeLessThan(b.ballY - 6); // a string, short
});
