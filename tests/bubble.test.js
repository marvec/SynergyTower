// Speech bubbles stay on screen: clamped into the camera view, flipped below the speaker under the HUD bar.
import { test, expect } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const { placeBubble } = await import('../src/scenes/floorWorld.js');

const view = { x: 100, y: 50, w: 480, h: 270, top: 22 };

test('a bubble above a speaker in the middle of the screen is centred on them', () => {
  const b = placeBubble(400, 200, 100, 40, view);
  expect(b.x).toBe(350);
  expect(b.y + 40).toBeLessThan(200);
  expect(b.below).toBe(false);
  expect(b.tail).toBe(400);
});

test('near the left or right edge the bubble slides into view, its tail still on the speaker', () => {
  const l = placeBubble(110, 200, 140, 40, view);
  expect(l.x).toBeGreaterThanOrEqual(view.x + 2);
  expect(l.tail).toBe(110);
  const r = placeBubble(view.x + view.w - 4, 200, 140, 40, view);
  expect(r.x + 140).toBeLessThanOrEqual(view.x + view.w - 2);
  expect(r.tail).toBeLessThanOrEqual(r.x + 140 - 4);
  expect(r.tail).toBeGreaterThanOrEqual(r.x + 3);
});

test('a speaker near the top gets the bubble below them, clear of the HUD bar', () => {
  const b = placeBubble(400, view.y + 40, 100, 40, view);
  expect(b.below).toBe(true);
  expect(b.y).toBeGreaterThan(view.y + 40);
});
