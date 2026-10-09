import { test, expect } from 'bun:test';
import { compileSong, noteToMidi } from '../src/engine/audio.js';
import { SONGS } from '../src/data/music.js';
import { DEPARTMENTS } from '../src/data/departments.js';

test('note parsing', () => {
  expect(noteToMidi('A4')).toBe(69);
  expect(noteToMidi('C4')).toBe(60);
  expect(noteToMidi('F#5')).toBe(78);
  expect(noteToMidi('-')).toBe(null);
});

test('every song compiles to in-range events with a melody', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    const { events, steps } = compileSong(song);
    expect(steps).toBe(song.chords.length * 16);
    expect(events.some((e) => e.ch === 'lead')).toBe(true);
    for (const e of events) {
      expect(e.step).toBeGreaterThanOrEqual(0);
      expect(e.step).toBeLessThan(steps);
      if (e.midi != null) expect(e.midi).toBeGreaterThan(20);
    }
    expect(song.melody.length).toBe(song.chords.length);
    for (const bar of song.melody) expect(bar.split(/\s+/).length).toBe(16);
    expect(name.length).toBeGreaterThan(0);
  }
});

test('every department music track exists', () => {
  for (const d of DEPARTMENTS) expect(SONGS[d.music]).toBeTruthy();
});
