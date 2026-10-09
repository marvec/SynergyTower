import { test, expect } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const { JARGON } = await import('../src/data/mg-jargon.js');
const { measureText, wrapText } = await import('../src/engine/font.js');
const { buildFloor } = await import('../src/core/tasks.js');

test('jargon bank: 60 unique phrases, each with one answer and 3 distinct decoys', () => {
  expect(JARGON.length).toBeGreaterThanOrEqual(60);
  expect(new Set(JARGON.map((j) => j.p)).size).toBe(JARGON.length);
  for (const j of JARGON) {
    expect(j.w.length).toBe(3);
    expect(new Set([j.a, ...j.w]).size).toBe(4);
  }
  expect(JARGON.some((j) => /pin that down/i.test(j.p))).toBe(true);
});

test('jargon text fits: phrase in the bubble, options in two lines of a choice box', () => {
  for (const j of JARGON) {
    expect(measureText(`"${j.p}"`)).toBeLessThanOrEqual(376);
    for (const o of [j.a, ...j.w]) expect(wrapText(o, 191).length).toBeLessThanOrEqual(2);
    expect(measureText(`Translation: ${j.a}`)).toBeLessThanOrEqual(430);
  }
});

test('jargon shows up regularly in the tower', () => {
  let n = 0;
  for (let f = 1; f <= 40; f++) n += buildFloor(f).tasks.filter((t) => t.task.game === 'jargon').length;
  expect(n).toBeGreaterThanOrEqual(15);
  console.log(`jargon stations across 40 floors: ${n}`);
});
