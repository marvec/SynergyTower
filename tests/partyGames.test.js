// The Christmas party's mini-games: someone paying attention gets 3 stars, someone idle gets under 1 star.
import { test, expect } from 'bun:test';
import { installMockDocument, mockCanvas } from './mock-canvas.js';
installMockDocument();
const { createRng } = await import('../src/core/rng.js');
const { createInput } = await import('../src/engine/input.js');
const { MINIGAMES } = await import('../src/minigames/index.js');

const g = mockCanvas().getContext('2d');
const theme = { dept: 'party', title: 'Party', stats: { floor: 12, stars: 0, title: 'Manager' } };
const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];

/** Runs a game; bot(peek, t) returns { tap: [keys pressed this frame], hold: [keys held], press: bool }. */
export function play(id, bot, seed = 1) {
  const inst = MINIGAMES[id].create({ difficulty: 0.3, rng: createRng(seed), theme, sfx: () => {} });
  const input = createInput();
  const held = new Set();
  let t = 0;
  while (!inst.done && t < 150) {
    input.beginFrame();
    const want = bot ? bot(inst.peek(), t) : {};
    for (const k of KEYS) {
      const h = !!want.hold?.includes(k);
      if (h && !held.has(k)) (input.keyDown(k), held.add(k));
      if (!h && held.has(k)) (input.keyUp(k), held.delete(k));
    }
    for (const k of want.tap || []) (input.keyDown(k), input.keyUp(k));
    if (want.press) (input.keyDown(' '), input.keyUp(' '));
    inst.update(1 / 60, input);
    inst.render(g);
    input.endFrame();
    t += 1 / 60;
  }
  expect(inst.done).toBe(true);
  return inst.score;
}

test('Dance-Off: on the beat is 3 stars, standing still or mashing every key is nothing', () => {
  for (const seed of [1, 2, 3]) {
    const best = play('dance', (p) => ({ tap: p.notes.filter((n) => n.t <= p.time + 1 / 60 && n.t > p.time - 0.05).map((n) => KEYS[n.lane]) }), seed);
    expect(best).toBeGreaterThanOrEqual(0.85);
    expect(play('dance', null, seed)).toBeLessThan(0.35);
    expect(play('dance', () => ({ tap: KEYS }), seed)).toBeLessThan(0.35);
  }
});

test('Dance-Off: confetti at every 10-combo, none without one', () => {
  const inst = MINIGAMES.dance.create({ difficulty: 0.3, rng: createRng(1), theme, sfx: () => {} });
  const input = createInput();
  let combo = 0;
  let burst = 0;
  for (let t = 0; !inst.done && t < 60; t += 1 / 60) {
    input.beginFrame();
    const p = inst.peek();
    for (const n of p.notes.filter((n) => n.t <= p.time + 1 / 60 && n.t > p.time - 0.05)) (input.keyDown(KEYS[n.lane]), input.keyUp(KEYS[n.lane]));
    inst.update(1 / 60, input);
    inst.render(g);
    input.endFrame();
    const q = inst.peek();
    if (q.combo < 10) expect(q.confetti).toBe(0);
    if (q.combo % 10 === 0 && q.combo > combo) expect(q.confetti).toBeGreaterThan(burst);
    combo = q.combo;
    burst = q.confetti;
  }
  expect(combo).toBeGreaterThanOrEqual(10);
});

test('Gift Wrapping: pressing in the band is 3 stars, idle or early is nothing', () => {
  for (const seed of [1, 2, 3]) {
    expect(play('giftwrap', (p) => ({ press: !p.paused && p.stage !== 'done' && p.level >= (p.band[0] + p.band[1]) / 2 }), seed)).toBeGreaterThanOrEqual(0.85);
    expect(play('giftwrap', null, seed)).toBeLessThan(0.35);
    expect(play('giftwrap', () => ({ press: true }), seed)).toBeLessThan(0.35);
  }
});
const { dishesFor } = await import('../src/minigames/buffet.js');

test('Photo Booth: striking each pose is 3 stars; idle, mashing or holding one arrow throughout is nothing', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    // Attentive: strikes the pose on each card once it shows (and lets go while the flash fires).
    expect(play('photobooth', (p) => ({ hold: p.phase === 'count' ? [KEYS[p.pose]] : [] }), seed)).toBeGreaterThanOrEqual(0.85);
    expect(play('photobooth', null, seed)).toBeLessThan(0.35);
    expect(play('photobooth', () => ({ tap: KEYS }), seed)).toBeLessThan(0.35);
    for (const k of KEYS) expect(play('photobooth', () => ({ hold: [k] }), seed), `${k} held, seed ${seed}`).toBeLessThan(0.35);
  }
});

test('the buffet serves Christmas dishes at the party, the hotel\'s anywhere else', () => {
  const xmas = dishesFor({ dept: 'party' }).map((d) => d.name);
  expect(xmas).toContain('Turkey');
  expect(xmas).toContain('Mince pie');
  expect(dishesFor({ dept: 'exec' }).map((d) => d.name)).toContain('Lobster');
  expect(dishesFor(undefined).map((d) => d.name)).toContain('Lobster');
});

const { melodyNotes, lanesFor, midiOf } = await import('../src/minigames/carols.js');
const { SONGS } = await import('../src/data/music.js');
const { CAROLS } = await import('../src/data/party.js');

test('carol notes: tokens to times and lengths, three lanes over the pitches used', () => {
  expect(midiOf('C4')).toBe(60);
  expect(midiOf('F#5')).toBe(78);
  expect(midiOf('-')).toBe(null);
  const n = melodyNotes({ bpm: 120, melody: ['C5 - - - D5 - . . E5 - - - - - - -'] });
  expect(n.map((x) => [x.t, x.dur, x.midi])).toEqual([[0, 0.5, 72], [0.5, 0.25, 74], [1, 1, 76]]);
  for (const c of CAROLS) {
    const notes = melodyNotes(SONGS[c.id]);
    expect(notes.length).toBe(c.syllables.length);
    const lane = lanesFor(notes);
    expect(new Set(notes.map((x) => lane(x.midi))).size).toBe(3);
  }
});

test('Carol Karaoke: staying on the note is 3 stars, idle or random is nothing', () => {
  const target = (p) => {
    const soon = p.notes.find((n) => p.time + 1 / 30 >= n.t && p.time + 1 / 30 < n.t + n.dur) || p.notes.find((n) => n.t > p.time);
    return soon ? soon.lane : p.voice;
  };
  for (const seed of [1, 2, 3, 4]) {
    const best = play('carols', (p) => {
      const want = target(p);
      if (p.voice < 0) return { tap: ['ArrowUp'] };
      return { tap: want > p.voice ? ['ArrowUp'] : want < p.voice ? ['ArrowDown'] : [] };
    }, seed);
    expect(best).toBeGreaterThanOrEqual(0.85);
    expect(play('carols', null, seed)).toBeLessThan(0.35);
    let k = 0;
    expect(play('carols', () => ({ tap: [++k % 7 === 0 ? 'ArrowUp' : k % 5 === 0 ? 'ArrowDown' : null].filter(Boolean) }), seed)).toBeLessThan(0.35);
  }
});
