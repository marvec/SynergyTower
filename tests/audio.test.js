import { test, expect } from 'bun:test';
import { compileSong, noteToMidi, createAudio, SONG_LEAD } from '../src/engine/audio.js';
import { SONGS } from '../src/data/music.js';
import { DEPARTMENTS } from '../src/data/departments.js';
import { RADIO } from '../src/data/radio.js';

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

test('the night shift has its own darker track: minor and slower than the office', () => {
  const n = SONGS.nightshift;
  expect(n).toBeTruthy();
  expect(n.chords[0]).toMatch(/m$/);
  expect(n.bpm).toBeLessThan(SONGS.office.bpm);
  expect(n.bpm).toBeLessThan(SONGS.tech.bpm);
});

test('every department music track exists', () => {
  for (const d of DEPARTMENTS) expect(SONGS[d.music]).toBeTruthy();
});

// A bar of note tokens: 16 of them, each a note, '-' (hold) or '.' (rest), and no hold straight after a rest.
const checkLine = (where, line) => {
  const toks = line.split(/\s+/).filter(Boolean);
  expect(`${where}: ${toks.length}`).toBe(`${where}: 16`);
  toks.forEach((t, i) => {
    if (t !== '-' && t !== '.') expect(`${where} ${t}: ${noteToMidi(t)}`).not.toContain(': null');
    if (t === '-') expect(`${where} step ${i}: ${toks[i - 1] ?? 'start'}`).not.toBe(`${where} step ${i}: .`);
  });
};

test('every bar of every song part is 16 valid steps', () => {
  for (const [name, song] of Object.entries(SONGS)) {
    const bars = song.chords.length;
    song.melody.forEach((l, b) => checkLine(`${name} melody ${b}`, l));
    if (song.bassLine) {
      expect(song.bassLine.length).toBe(bars);
      song.bassLine.forEach((l, b) => checkLine(`${name} bass ${b}`, l));
    }
    for (const d of [song.drums, song.comp?.pattern].flat().filter(Boolean)) expect(`${name} ${d}: ${d.length}`).toBe(`${name} ${d}: 16`);
    if (Array.isArray(song.drums)) expect(`${name} drums ${song.drums.length}`).toBe(`${name} drums ${bars}`);
    if (Array.isArray(song.comp?.pattern)) expect(`${name} comp ${song.comp.pattern.length}`).toBe(`${name} comp ${bars}`);
    for (const d of [song.drums].flat().filter(Boolean)) expect(d).toMatch(/^[kshor.]{16}$/);
    for (const c of song.chords) if (c !== 'N') expect(`${name} ${c}`).toMatch(/^\S+ [A-G][#b]?(|m|7|maj7|m7|sus4)$/);
  }
});

test('the car radio: six covers, each a looping song with its own tempo, bass and drums', () => {
  expect(RADIO.length).toBe(6);
  expect(RADIO.map((r) => r.title)).toEqual(['Track 1', 'Track 2', 'Track 3', 'Track 4', 'Track 5', 'Track 6']);
  for (const r of RADIO) {
    const song = SONGS[r.song];
    expect(song).toBeTruthy();
    expect(song.once).toBeFalsy();
    const { events, steps } = compileSong(song);
    expect(steps).toBeGreaterThanOrEqual(16 * 16);
    for (const ch of ['lead', 'bass', 'drum']) expect(`${r.song} ${ch} ${events.some((e) => e.ch === ch)}`).toBe(`${r.song} ${ch} true`);
  }
  // Each cover keeps its original's tempo and lead (they are different tunes, not one arrangement six times).
  expect(new Set(RADIO.map((r) => SONGS[r.song].bpm)).size).toBeGreaterThanOrEqual(5);
});

test('per-bar parts: bass lines, chord rhythms, drum arrays, no-chord bars and the doubled lead', () => {
  const song = {
    bpm: 120, lead: 'square', leadVol: 0.1, leadDouble: -12, bassVol: 0.2,
    chords: ['C', 'N'],
    comp: { vol: 0.03, pattern: ['x---..x.........', 'x---------------'] },
    drums: ['k...............', '....s...........'],
    bassLine: ['C2 - - - . . . . G1 - . . . . . .', '. . . . . . . . . . . . . . . .'],
    melody: ['C5 - . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'],
  };
  const { events } = compileSong(song);
  const of = (ch) => events.filter((e) => e.ch === ch);
  expect(of('bass').map((e) => [e.step, e.midi, e.len, e.vol])).toEqual([[0, 36, 4, 0.2], [8, 31, 2, 0.2]]);
  // C major struck at 0 (held 4) and 6; the 'N' bar has no chord at all.
  expect(of('comp').map((e) => [e.step, e.len])).toEqual([[0, 4], [0, 4], [0, 4], [6, 1], [6, 1], [6, 1]]);
  expect(of('drum').map((e) => [e.step, e.drum])).toEqual([[0, 'k'], [20, 's']]);
  expect(of('lead').map((e) => [e.midi, e.len, e.vol])).toEqual([[72, 2, 0.1], [60, 2, 0.05]]);
});

// A WebAudio stand-in: every node takes any call; the clock is set by hand and the scheduler's interval is captured.
function fakeAudio() {
  const node = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'connect' ? (n) => n : k === 'then' ? undefined : ['gain', 'frequency'].includes(k) ? (o[k] = node()) : () => node()) });
  const ctx = { currentTime: 10, sampleRate: 64, state: 'running', destination: node(), resume() {}, createBuffer: () => ({ getChannelData: () => new Float32Array(64) }) };
  for (const k of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createPeriodicWave']) ctx[k] = () => node();
  const saved = [globalThis.AudioContext, globalThis.setInterval];
  let pump = null;
  globalThis.AudioContext = function () {
    return ctx;
  };
  globalThis.setInterval = (fn) => ((pump = fn), 0);
  const audio = createAudio();
  audio.unlock();
  [globalThis.AudioContext, globalThis.setInterval] = saved;
  const run = (s) => {
    ctx.currentTime += s;
    pump();
  };
  return { audio, ctx, run };
}

test('play keeps a song that is already playing, unless asked to restart it (from a given second)', () => {
  const { audio, run } = fakeAudio();
  const step = 60 / SONGS.xmasparty.bpm / 4;
  audio.play('xmasparty');
  expect(audio.position).toMatchObject({ name: 'xmasparty', step: 0 });
  expect(audio.position.at).toBeCloseTo(SONG_LEAD, 6); // beat 0 sounds SONG_LEAD after the call
  run(1);
  const on = audio.position.step;
  expect(on).toBeGreaterThan(4);
  audio.play('xmasparty'); // the hall asking again: the song plays on
  expect(audio.position.step).toBe(on);
  audio.play('xmasparty', null, { restart: true }); // from the top
  expect(audio.position).toMatchObject({ name: 'xmasparty', step: 0 });
  expect(audio.position.at).toBeCloseTo(SONG_LEAD, 6);
  audio.play('xmasparty', null, { restart: true, from: 1.06 }); // part-way in: 1.06 s of the song is heard SONG_LEAD from now
  const p = audio.position;
  expect(p.step).toBe(Math.ceil(1.06 / step));
  expect(p.at - (p.step * step - 1.06)).toBeCloseTo(SONG_LEAD, 6);
  const loop = compileSong(SONGS.xmasparty).steps * step;
  audio.play('xmasparty', null, { restart: true, from: loop + 1.06 }); // a looping song wraps around
  expect(audio.position.step).toBe(p.step);
  const jingle = compileSong(SONGS.fanfare).steps * (60 / SONGS.fanfare.bpm / 4);
  audio.play('fanfare', 'xmasparty', { from: jingle + 1 }); // a one-shot past its end: straight on to the song after it
  expect(audio.position).toMatchObject({ name: 'xmasparty', step: 0 });
});

test('wanted (the song to play once the music can) is the song after a one-shot, on every path play takes', () => {
  const steps = compileSong(SONGS.fanfare).steps;
  const past = steps * (60 / SONGS.fanfare.bpm / 4) + 1;
  // Before the first gesture (no AudioContext yet): the song after the jingle, or the one before it.
  const quiet = createAudio();
  quiet.play('office');
  expect(quiet.wanted).toBe('office');
  quiet.play('fanfare');
  expect(quiet.wanted).toBe('office');
  quiet.play('fanfare', 'xmasparty');
  expect(quiet.wanted).toBe('xmasparty');
  // Playing: the same, whether the jingle plays or is already over (`from` past its end).
  for (const from of [0, past]) {
    const { audio } = fakeAudio();
    audio.play('office');
    audio.play('fanfare', null, { from });
    expect(audio.wanted).toBe('office');
    audio.play('fanfare', 'xmasparty', { from });
    expect(audio.wanted).toBe('xmasparty');
    expect(audio.current).toBe(from ? 'xmasparty' : 'fanfare');
  }
});

test('a song asked for while a one-shot ends is not overridden by the one-shot\'s `after`', () => {
  const { audio, run } = fakeAudio();
  const timeouts = [];
  const saved = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => (timeouts.push(fn), 0);
  try {
    audio.play('fanfare', 'xmasparty');
    run(compileSong(SONGS.fanfare).steps * (60 / SONGS.fanfare.bpm / 4) + 1); // the jingle is over: `after` follows soon
    expect(audio.current).toBe(null);
    audio.play('office'); // meanwhile the scene asks for its song
    for (const fn of timeouts) fn();
    expect(audio.current).toBe('office');
    expect(audio.wanted).toBe('office');
  } finally {
    globalThis.setTimeout = saved;
  }
});
