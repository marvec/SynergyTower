import { test, expect } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const { Lighting, LIGHTING, flickerLevel } = await import('../src/engine/lighting.js');
const { W, H } = await import('../src/engine/screen.js');

// A 30x16-tile test floor: a wall along row 8 splits it into a north and a south room.
const COLS = 30;
const ROWS = 16;
const T = 16;
const cfg = (o = {}) => ({ ...LIGHTING, ambient: 0.1, view: 'final', ...o });
function floor(o = {}, { door = false } = {}) {
  const wall = new Uint8Array(COLS * ROWS);
  for (let x = 0; x < COLS; x++) wall[8 * COLS + x] = 1;
  if (door) wall[8 * COLS + 10] = 0;
  return new Lighting({ cols: COLS, rows: ROWS, tile: T, opaque: wall, wall, wallH: 12, config: cfg(o) });
}
const out = () => new Uint8ClampedArray(W * H * 4);
const px = (buf, x, y) => buf[(y * W + x) * 4]; // red channel at screen px (camera at 0, 0)

test('the light buffer holds only the configured shade levels', () => {
  for (const levels of [8, 10, 12]) {
    const L = floor({ levels });
    L.addLight({ x: 80, y: 40, r: 60, intensity: 1.4 });
    const b = L.compute(out(), 0, 0);
    const step = 255 / (levels - 1);
    const seen = new Set();
    for (let i = 0; i < b.length; i += 4) seen.add(b[i]);
    expect(seen.size).toBeLessThanOrEqual(levels);
    for (const v of seen) expect(Math.abs(v / step - Math.round(v / step))).toBeLessThan(0.02);
    expect(seen.size).toBeGreaterThan(3); // a stepped falloff, not on/off
  }
});

test('a light reaches as far as its radius and no further', () => {
  const L = floor({ dither: false, ambient: 0 });
  L.addLight({ x: 100.5, y: 60.5, r: 40, intensity: 1.4 });
  const b = L.compute(out(), 0, 0);
  expect(px(b, 100, 60)).toBe(255);
  expect(px(b, 100 + 30, 60)).toBeGreaterThan(0);
  expect(px(b, 100 + 42, 60)).toBe(0);
});

test('walls cast hard shadows: no light leaks into the next room, but it passes a door', () => {
  const north = { x: 160.5, y: 100.5, r: 80, intensity: 2 }; // tile (10, 6), the wall is row 8 (y 128..143)
  const L = floor({ dither: false, ambient: 0 });
  L.addLight({ ...north });
  const b = L.compute(out(), 0, 0);
  expect(px(b, 160, 120)).toBeGreaterThan(0); // north of the wall
  expect(px(b, 160, 150)).toBe(0); // south of it, in reach but behind the wall
  const D = floor({ dither: false, ambient: 0 }, { door: true });
  D.addLight({ ...north });
  expect(px(D.compute(out(), 0, 0), 168, 150)).toBeGreaterThan(0); // through the door gap
});

test('a wall seen at a shallow angle is lit along its top, not only straight across from the light', () => {
  const L = floor({ dither: false, ambient: 0 });
  L.addLight({ x: 160.5, y: 120, r: 60, intensity: 2 }); // tile row 7, just north of the wall
  const b = L.compute(out(), 0, 0);
  for (const x of [130, 160, 200]) expect(px(b, x, 8 * T)).toBeGreaterThan(0); // the wall's top surface, along the run
});

test('a wall\'s front face is lit from the room it faces, not from behind', () => {
  const faceY = 8 * T + 10; // the lower part of wall row 8 is its front, facing south
  const fromNorth = floor({ dither: false, ambient: 0 });
  fromNorth.addLight({ x: 160.5, y: 110, r: 60, intensity: 2 });
  expect(px(fromNorth.compute(out(), 0, 0), 160, faceY)).toBe(0);
  const fromSouth = floor({ dither: false, ambient: 0 });
  fromSouth.addLight({ x: 160.5, y: 170, r: 60, intensity: 2 });
  expect(px(fromSouth.compute(out(), 0, 0), 160, faceY)).toBeGreaterThan(0);
});

test('the dither mixes two neighbouring levels in a 4x4 pattern; without it a flat area is one level', () => {
  const on = floor({ ambient: 0.5, levels: 10 });
  const b = on.compute(out(), 0, 0);
  const vals = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) vals.add(px(b, 40 + x, 40 + y));
  expect(vals.size).toBe(2);
  const off = floor({ ambient: 0.5, levels: 10, dither: false });
  const c = off.compute(out(), 0, 0);
  const flat = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) flat.add(px(c, 40 + x, 40 + y));
  expect(flat.size).toBe(1);
});

test('tile mode gives every tile one light value', () => {
  const L = floor({ dither: false, ambient: 0, mode: 'tile' });
  L.addLight({ x: 100, y: 60, r: 60, intensity: 1.4 });
  const b = L.compute(out(), 0, 0);
  for (const [tx, ty] of [[5, 3], [6, 4], [4, 2]]) {
    const v = px(b, tx * T, ty * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) expect(px(b, tx * T + x, ty * T + y)).toBe(v);
  }
});

test('static lights are baked once; flickering and dynamic ones follow their level and position', () => {
  const L = floor({ dither: false, ambient: 0 });
  let level = 1;
  L.addLight({ x: 100, y: 60, r: 40, intensity: 1.4, level: () => level });
  const p = L.addLight({ x: 300, y: 60, r: 26, intensity: 1.6, dynamic: true });
  L.compute(out(), 0, 0);
  expect(L.dirty).toBe(false);
  level = 0;
  expect(px(L.compute(out(), 0, 0), 100, 60)).toBe(0); // the flickering lamp is out
  expect(L.dirty).toBe(false); // ...without a re-bake
  expect(px(L.compute(out(), 0, 0), 300, 60)).toBe(255);
  p.x = 400;
  const b = L.compute(out(), 0, 0);
  expect(px(b, 300, 60)).toBe(0);
  expect(px(b, 400, 60)).toBe(255);
  const s = L.addLight({ x: 40, y: 40, r: 20 });
  expect(L.dirty).toBe(true);
  L.removeLight(s);
  L.compute(out(), 0, 0);
  expect(L.dirty).toBe(false);
});

test('ambient, a flash that fades, and the fade-in from full light', () => {
  const L = floor({ dither: false, levels: 11 });
  L.setAmbient(0.1);
  expect(px(L.compute(out(), 0, 0), 200, 200)).toBe(Math.round(255 / 10));
  L.flash(0.5, 0.5);
  expect(px(L.compute(out(), 0, 0), 200, 200)).toBe(Math.round((255 * 6) / 10));
  L.update(0.6);
  expect(px(L.compute(out(), 0, 0), 200, 200)).toBe(Math.round(255 / 10));
  expect(px(L.compute(out(), 0, 0, { fade: 0 }), 200, 200)).toBe(255);
});

test('fog of war: unseen tiles are black, ones seen before stay dim', () => {
  const L = floor({ dither: false, fog: true, ambient: 0.5, fogLevel: 0.1, levels: 11 });
  L.setViewer(100, 60); // in the north room
  let b = L.compute(out(), 0, 0);
  expect(px(b, 100, 70)).toBeGreaterThan(100); // in sight: lit as usual
  expect(px(b, 100, 200)).toBe(0); // behind the wall, never seen
  L.setViewer(100, 200); // now in the south room
  b = L.compute(out(), 0, 0);
  expect(px(b, 100, 70)).toBe(Math.round(255 / 10)); // remembered
  expect(px(b, 100, 220)).toBeGreaterThan(100);
});

test('a flickering light wavers within its depth, dips now and then, never goes dark, and neighbours are out of sync', () => {
  const a = { seed: 1234 };
  const b = { seed: 98765 };
  let min = 1, max = 0, dips = 0, slots = 0, same = 0, n = 0;
  for (let t = 0; t < 600; t += 0.01, n++) {
    const f = flickerLevel(a, t);
    min = Math.min(min, f);
    max = Math.max(max, f);
    if (Math.abs(f - flickerLevel(b, t)) < 0.005) same++;
    expect(flickerLevel(a, t)).toBe(f); // a function of time, not random per frame
  }
  for (let slot = 0; slot < 4000; slot++, slots++) if (flickerLevel({ seed: 7, depth: 0 }, slot * 0.25 + 0.1) < 0.9) dips++;
  expect(min).toBeGreaterThanOrEqual(0.9 * 0.6 - 1e-9);
  expect(max).toBeLessThanOrEqual(1);
  expect(dips / slots).toBeGreaterThan(0.015);
  expect(dips / slots).toBeLessThan(0.045);
  expect(same / n).toBeLessThan(0.2);
  expect(flickerLevel({ seed: 7, depth: 0, dip: 0 }, 3.3)).toBe(1);
  expect(flickerLevel({ seed: 7, depth: 0.5, dip: 0 }, 3.3)).toBeGreaterThanOrEqual(0.5);
});

test('flicker scales the baked light without a re-bake: the middle holds, the edge shimmers pixel by pixel', () => {
  const L = floor({ ambient: 0 });
  L.addLight({ x: 160.5, y: 60.5, r: 50, intensity: 1.4, flicker: { seed: 3, depth: 0.3, dip: 0 } });
  const frames = [];
  for (const t of [0, 0.11, 0.23, 0.37, 0.52]) frames.push(L.compute(out(), 0, 0, { t }).slice());
  expect(L.dirty).toBe(false);
  let lit = 0, changed = 0;
  for (let y = 10; y < 112; y++) {
    for (let x = 110; x < 212; x++) {
      const v = frames.map((f) => px(f, x, y));
      if (Math.max(...v) > 0) lit++;
      if (new Set(v).size > 1) changed++;
    }
  }
  for (const f of frames) expect(px(f, 160, 60)).toBe(255); // the middle never moves
  expect(changed).toBeGreaterThan(0);
  expect(changed / lit).toBeLessThan(0.5); // scattered dither pixels at the edges, not whole rings
});
