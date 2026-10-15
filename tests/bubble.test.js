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

test('a speaker off screen gets no bubble: it follows its speaker instead of waiting at the edge', () => {
  expect(placeBubble(view.x - 20, 200, 100, 40, view)).toBe(null); // left of the view
  expect(placeBubble(view.x + view.w + 20, 200, 100, 40, view)).toBe(null); // right
  expect(placeBubble(300, view.y + 10, 100, 40, view)).toBe(null); // above, under the HUD bar
  expect(placeBubble(300, view.y + view.h + 30, 100, 40, view)).toBe(null); // below
  expect(placeBubble(view.x + 4, 200, 100, 40, view)).not.toBe(null); // at the edge, still on screen
  expect(placeBubble(300, view.y + view.h + 10, 100, 40, view)).not.toBe(null); // feet just off the bottom, head showing
});

test('a bubble never sits under the clock panel (top right): it slides left of it, or goes below it', () => {
  const panel = { x: view.x + 300, y: view.y + 25, w: 176, h: 15 };
  const v = { ...view, panel };
  const clear = (b, bw, bh) => b.x + bw <= panel.x || b.x >= panel.x + panel.w || b.y + bh <= panel.y || b.y >= panel.y + panel.h;
  for (const [ax, ay] of [[view.x + 290, view.y + 95], [view.x + 380, view.y + 100], [view.x + 470, view.y + 105], [view.x + 400, view.y + 45], [view.x + 330, view.y + 108]]) {
    const b = placeBubble(ax, ay, 120, 40, v);
    expect(b).not.toBe(null);
    expect(`${ax},${ay} ${clear(b, 120, 40)}`).toBe(`${ax},${ay} true`);
    expect(b.tail).toBeGreaterThanOrEqual(b.x + 3);
    expect(b.tail).toBeLessThanOrEqual(b.x + 120 - 4);
    expect(b.y).toBeGreaterThanOrEqual(view.y + view.top);
  }
  // Away from the panel nothing changes.
  expect(placeBubble(400, 200, 100, 40, v)).toEqual(placeBubble(400, 200, 100, 40, view));
});
