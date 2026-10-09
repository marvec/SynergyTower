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

test('review questions fit the bubble and options fit their rows', async () => {
  const { REVIEW } = await import('../src/data/mg-review.js');
  expect(REVIEW.length).toBeGreaterThanOrEqual(25);
  for (const r of REVIEW) {
    expect(wrapText(r.q, 236).length).toBeLessThanOrEqual(4);
    expect(new Set([r.a, ...r.w]).size).toBe(4);
    for (const o of [r.a, ...r.w]) expect(measureText(o)).toBeLessThanOrEqual(276);
  }
});

test('colleague lines: 100 common ones, unique, short enough for a speech bubble', async () => {
  const { COMMON_NPC_LINES } = await import('../src/data/npcLines.js');
  const { DEPARTMENTS } = await import('../src/data/departments.js');
  expect(COMMON_NPC_LINES.length).toBeGreaterThanOrEqual(100);
  expect(new Set(COMMON_NPC_LINES).size).toBe(COMMON_NPC_LINES.length);
  for (const l of [...COMMON_NPC_LINES, ...DEPARTMENTS.flatMap((d) => d.npcLines)]) expect(wrapText(l, 120).length).toBeLessThanOrEqual(6);
});
