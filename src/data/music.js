// Songs for the WebAudio tracker. 16 steps per bar. Melody tokens: note ('C5', 'F#4'), '-' = hold, '.' = rest.
// Bass/comp/arp are generated from the chord list using the per-song templates (indexes into chord tones).
// Drum strings: k kick, s snare, h hat, o open hat, r rim, '.' rest (one char per step, per bar).
// Optional, for transcribed covers (the car radio, radio.js): `drums` as an array of per-bar strings (cycled),
// `bassLine` (per-bar note tokens replacing the bass template), `comp.pattern` (per-bar chord rhythm: 'x' strike,
// '-' hold, '.' rest), the chord 'N' (no harmony that bar), `bassWave`/`bassVol`, and `leadDouble` (the lead again
// that many semitones away, softer).
import { RADIO_SONGS } from './radio.js';

export const SONGS = {
  title: {
    bpm: 128, swing: 0, lead: 'pulse25', leadVol: 0.16,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    bass: { steps: [0, 4, 6, 8, 12, 14], tones: [0, 0, 2, 0, 0, 2], len: 2 },
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 1, 2, 4, 2, 1, 0, 1], vol: 0.05 },
    drums: 'k.h.s.h.k.k.s.ho',
    melody: [
      'C5 - - - E5 - G5 - - - C6 - - - G5 -', 'B4 - - - D5 - G5 - - - B5 - - - A5 -',
      'A5 - - - G5 - E5 - - - C5 - - - E5 -', 'F5 - - - - - - - A5 - - - G5 - F5 -',
      'E5 - - - G5 - C6 - - - E6 - - - D6 -', 'D6 - - - B5 - G5 - - - D5 - - - G5 -',
      'A5 - - - C6 - A5 - F5 - - - A5 - C6 -', 'B5 - - - - - - - D6 - - - - - . .',
    ],
  },
  lobby: {
    bpm: 104, swing: 0, lead: 'triangle', leadVol: 0.2,
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G7'],
    bass: { steps: [0, 3, 8, 11], tones: [0, 2, 0, 2], len: 3 },
    comp: { steps: [0, 3, 6, 10, 12], len: 2, vol: 0.035 },
    drums: 'k..r..r.k.r.r...',
    melody: [
      'E5 - - - D5 - E5 - G5 - - - - - . .', 'A5 - - - G5 - E5 - C5 - - - - - . .',
      'F5 - - - E5 - D5 - A4 - - - C5 - . .', 'B4 - - - - - D5 - F5 - - - E5 - D5 -',
      'E5 - - - B4 - E5 - G5 - - - F#5 - . .', 'E5 - - - C#5 - E5 - A5 - - - G5 - . .',
      'F5 - - - A5 - F5 - D5 - - - C5 - . .', 'B4 - - - D5 - - - G4 - - - - - . .',
    ],
  },
  office: {
    bpm: 116, swing: 0.18, lead: 'pulse25', leadVol: 0.13,
    chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7'],
    bass: { steps: [0, 3, 6, 8, 10, 14], tones: [0, 4, 2, 0, 1, 2], len: 2 },
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 1, 2, 3, 2, 1, 0, 1], vol: 0.035 },
    drums: 'k.h.s.hkk.h.s.ho',
    melody: [
      'A4 - C5 - . . E5 - - - D5 - C5 - . .', 'B4 - D5 - . . G5 - - - F#5 . E5 - . .',
      'A4 - C5 - . . F5 - - - E5 - D5 - . .', 'E5 - - - - - - - G4 - A4 - B4 - . .',
      'F5 - - - E5 - D5 - C5 - - - A4 - . .', 'G5 - - - F#5 - E5 - D5 - - - B4 - . .',
      'A5 - - - G5 - F5 - E5 - - - C5 - . .', 'D5 - - - B4 - - - G4 - - - . . . .',
    ],
  },
  tech: {
    bpm: 124, swing: 0, lead: 'square', leadVol: 0.1,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E7'],
    bass: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 0, 4, 0, 0, 0, 4, 0], len: 1 },
    arp: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], tones: [0, 1, 2, 4, 2, 1, 0, 1, 0, 1, 2, 4, 2, 1, 0, 2], vol: 0.03 },
    drums: 'k.h.s.h.k.hks.hh',
    melody: [
      'A4 - - - C5 - - - E5 - - - D5 - C5 -', 'A4 - - - - - - - F4 - G4 - A4 - . .',
      'G4 - - - C5 - - - E5 - - - G5 - E5 -', 'D5 - - - - - - - B4 - - - . . . .',
      'A5 - - - G5 - E5 - C5 - - - E5 - A5 -', 'C6 - - - A5 - F5 - A5 - - - . . . .',
      'B5 - - - G5 - D5 - B4 - - - D5 - . .', 'E5 - - - G#5 - - - B5 - - - . . . .',
    ],
  },
  exec: {
    bpm: 92, swing: 0.22, lead: 'triangle', leadVol: 0.2,
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Cmaj7'],
    bass: { steps: [0, 4, 8, 12], tones: [0, 1, 2, 1], len: 3 },
    comp: { steps: [4, 12], len: 2, vol: 0.04 },
    drums: 'k.h.r.h.k.h.r.hh',
    melody: [
      'F5 - - - A5 - - - C6 - - - A5 - - -', 'B5 - - - - - - - G5 - - - F5 - - -',
      'E5 - - - - - - - - - - - G5 - - -', 'C6 - - - B5 - A5 - G5 - - - E5 - - -',
      'D5 - F5 - A5 - C6 - - - - - B5 - A5 -', 'G5 - - - F5 - - - D5 - - - B4 - - -',
      'C5 - - - E5 - - - G5 - - - B5 - - -', 'C6 - - - - - - - - - - - . . . .',
    ],
  },
  minigame: {
    bpm: 144, swing: 0, lead: 'pulse12', leadVol: 0.1,
    chords: ['Em', 'C', 'D', 'B7'],
    bass: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 0, 0, 0, 0, 0, 2, 2], len: 1 },
    arp: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], tones: [0, 1, 2, 1, 0, 1, 2, 4, 0, 1, 2, 1, 0, 2, 4, 2], vol: 0.025 },
    drums: 'k.hhs.hhk.hks.hh',
    melody: [
      'E5 - . E5 - . G5 - . . F#5 - E5 - . .', 'C5 - . C5 - . E5 - . . D5 - C5 - . .',
      'D5 - . D5 - . F#5 - . . A5 - F#5 - . .', 'D#5 - . F#5 - . B5 - . . A5 - F#5 - D#5 -',
    ],
  },
  // The vacation hotel: a lazy calypso with a steel-drum-ish lead.
  tropical: {
    bpm: 112, swing: 0.12, lead: 'triangle', leadVol: 0.2,
    chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G7', 'C'],
    bass: { steps: [0, 3, 6, 8, 11, 14], tones: [0, 2, 1, 0, 2, 1], len: 2 },
    comp: { steps: [2, 6, 10, 14], len: 1, vol: 0.035 },
    drums: 'k..r..k.k.r...r.',
    melody: [
      'E5 - G5 - C6 - - - A5 - G5 - E5 - - -', 'F5 - A5 - C6 - A5 - G5 - F5 - - - . .',
      'D5 - G5 - B5 - - - A5 - G5 - D5 - . .', 'E5 - - - G5 - E5 - C5 - - - - - . .',
      'C5 - E5 - A5 - - - G5 - E5 - A5 - - -', 'F5 - - - A5 - C6 - - - A5 - F5 - . .',
      'G5 - B5 - D6 - - - B5 - G5 - F5 - D5 -', 'C5 - - - - - - - . . . . . . . .',
    ],
  },
  fanfare: {
    bpm: 132, swing: 0, lead: 'square', leadVol: 0.14, once: true,
    chords: ['C', 'G', 'C'],
    bass: { steps: [0, 8], tones: [0, 0], len: 6 },
    comp: { steps: [0, 8], len: 6, vol: 0.05 },
    drums: 'k...s...k.k.s.s.',
    melody: ['G4 - C5 - E5 - G5 - - - E5 - G5 - - -', 'B4 - D5 - G5 - B5 - - - A5 - B5 - - -', 'C6 - - - - - - - - - - - - - - -'],
  },
  ...RADIO_SONGS,
};

export const CHORD_QUALITIES = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
};
