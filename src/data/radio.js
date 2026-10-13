// The car radio on the business-trip drive: six cover versions, transcribed from Martin's tunes.mp3 (tempo, key, chords,
// bass lines, drum grooves and the main riffs and melodies, cut down to their best sections and looped) and played by
// the WebAudio tracker like every other song. T or a click on the radio tunes to the next station; M switches it off.
// Song format: see music.js; covers use the per-bar parts (bassLine, drums arrays, comp.pattern, leadDouble).

export const RADIO = [
  { song: 'radio1', freq: '88.1', title: 'Track 1' },
  { song: 'radio2', freq: '91.4', title: 'Track 2' },
  { song: 'radio3', freq: '95.8', title: 'Track 3' },
  { song: 'radio4', freq: '99.2', title: 'Track 4' },
  { song: 'radio5', freq: '102.7', title: 'Track 5' },
  { song: 'radio6', freq: '106.3', title: 'Track 6' },
];

const rep = (n, ...bars) => Array.from({ length: n }, () => bars).flat();
const REST = '. . . . . . . . . . . . . . . .';

export const RADIO_SONGS = {
  // Track 1: F minor funk at 140, a Fm7 / Bb vamp over a chromatic bass riff. Groove, licks, a high lead, the breakdown
  // on an F pedal, then the falling F-Eb-D line.
  radio1: {
    bpm: 140, swing: 0, lead: 'pulse25', leadVol: 0.12, bassWave: 'pulse25', bassVol: 0.1,
    // The groove and the licks stay on Fm; the lead, the falling line and the breakdown swing between Fm7 and Bb.
    chords: [...rep(12, 'Fm7'), ...rep(2, 'Fm7', 'Fm7', 'Bb', 'Bb'), 'Fm7', 'Fm7', 'Bb', 'Fm7', 'Fm7', 'Fm7', 'Bb', 'Bb', ...rep(4, 'Fm7')],
    // Funky stabs; long pads under the high lead (bars 13-20) and in the breakdown (bars 25-28).
    comp: {
      vol: 0.03,
      pattern: [...rep(12, 'x-.x-.x.x-.x-.x.'), ...rep(8, 'x---------------'), ...rep(4, 'x-.x-.x.x-.x-.x.'), ...rep(4, 'x---------------'), ...rep(4, 'x-.x-.x.x-.x-.x.')],
    },
    drums: [
      ...rep(24, 'k.h.s.hhk.hks.kh'),
      'h.h.h.h.h.h.h.h.', 'h.h.h.h.h.h.h.h.', 'h.h.h.h.h.h.h.h.', 'h.h.h.hhk.k.s.ss',
      'k.h.s.hhk.hks.kh', 'k.h.s.hhk.hks.kh', 'k.h.s.hhk.hks.kh', 'k.h.s.hhk.k.s.ss',
    ],
    bassLine: [
      ...rep(6, 'F2 . F2 . . G#2 . F2 F2 . F2 . F2 . D#2 E2', 'F2 - F2 - - G#2 G#2 G#2 G#2 A#2 - . . D#2 E2 E2'),
      ...rep(2, 'F2 - - - - - - - F2 - - - - - D#2 E2', 'F2 - - - - - - - F2 - - - - - - -', 'A#1 - - - - - - - A#1 - - - - - - -', 'A#1 - - - - - - - A#1 - - - - - D#2 E2'),
      ...rep(2, 'F2 . F2 . . G#2 . F2 F2 . F2 . F2 . D#2 E2', 'F2 - F2 - - G#2 G#2 G#2 G#2 A#2 - . . D#2 E2 E2'),
      ...rep(4, 'F2 - - - - - - - - - - - - - - -'),
      ...rep(2, 'F2 . F2 . . G#2 . F2 F2 . F2 . F2 . D#2 E2', 'F2 - F2 - - G#2 G#2 G#2 G#2 A#2 - . . D#2 E2 E2'),
    ],
    melody: [
      // The groove, then the licks.
      REST, REST, REST, '. . . . . . . . . . . . C5 - D#5 -',
      'F5 - F5 F5 - F5 F5 . G#5 - F5 - C5 C5 D#5 -', 'F5 - F5 C5 . . F5 D#5 C5 - C5 D#5 C5 F4 G#4 G4',
      'F5 - D5 D5 . G#4 - G#4 A#4 - G#4 - C5 A#4 G#4 .', '. . D#5 - F5 - F5 - D#5 C5 A#4 - C5 D#5 C5 G5',
      'F5 - F5 D#5 - D#5 - D#5 . . C5 - F4 G4 - -', 'F5 - F5 F5 - F5 F5 F5 - . A#5 - A#5 G5 G#5 -',
      'G5 - G5 F5 - F5 F5 F5 - F5 G#5 - G5 F5 F5 -', 'D#5 - - D#5 F5 - D#5 D#5 G#5 - F5 - A#5 - C6 -',
      // The high lead.
      '. . . . C5 . G4 G#4 - - C5 - D#5 - F5 -', 'G5 - - - . . . . . . . . . . C6 -',
      'C6 - - - C6 - A#5 - G5 - - - F5 - - -', 'D5 - F5 - - - F5 - D5 - - - . . . .',
      '. . . . C6 - - - C6 - A#5 - C6 - D#6 -', 'C6 - - - A#5 - G5 - F5 - - - G5 - G#5 -',
      'A#5 - - - - - G5 - F5 - D5 - F5 - - -', 'F5 - - - - - - - . . . . . . . .',
      // F, E flat, D.
      'F5 - - - - - - - - - - - - - - -', 'F5 - F5 D#5 - D#5 - D#5 F4 - D#4 F4 - - - D#4',
      'D5 - D5 - - D5 - D5 D5 - D5 D5 - D5 D5 D5', 'F4 - - F4 F4 F4 F4 F5 - - - - - - - F5',
      // The breakdown.
      REST, '. . . . . . . . . . . . F5 - D#5 -', 'D5 - - - - - - - . . . . . . . .', '. . . . . . . . . . . . C5 - D#5 -',
      // Back in with the licks.
      'F5 - F5 F5 - F5 F5 . G#5 - F5 - C5 C5 D#5 -', 'F5 - F5 C5 . . F5 D#5 C5 - C5 D#5 C5 F4 G#4 G4',
      'F5 - D5 D5 . G#4 - G#4 A#4 - G#4 - C5 A#4 G#4 .', '. . D#5 - F5 - F5 - D#5 C5 A#4 - C5 D#5 C5 G5',
    ],
  },

  // Track 2: B flat minor at 96, slow and moody. A drone intro, the rising theme in octaves (D flat, E flat, G flat,
  // A flat, B flat), then the riff that turns to F sharp minor.
  radio2: {
    bpm: 96, swing: 0, lead: 'triangle', leadVol: 0.2, leadDouble: -12, bassVol: 0.18,
    chords: [
      'Bbm', 'Bbm', 'Bbm', 'Bbm',
      'Ebm7', 'Ebm', 'Bbm', 'Bbm', 'Ebm7', 'Ebm', 'Bbm', 'Bbm',
      'F#m', 'E', 'F#m', 'E', 'F#m', 'E', 'F#m', 'E',
    ],
    comp: { vol: 0.025, pattern: [...rep(4, 'x---------------'), ...rep(8, 'x-------x-------'), ...rep(8, 'x-----x-----x---')] },
    drums: [
      '................', '................', 'h...h...h...h...', 'h...h...h...h.hh',
      ...rep(16, 'h.k.s.k.hk.ks.k.'),
    ],
    bassLine: [
      ...rep(4, 'A#1 - - - - - - - - - - - - - - -'),
      ...rep(2,
        'C#2 - - - - - D#2 - - - - - - - F#2 -',
        '- - - - - - G#2 - - - - - A#2 - - -',
        'A#2 - A#2 - A#2 - A#2 - A#2 - C#3 - G#2 - A#2 -',
        'A#2 - A#2 - A#2 - A#2 - A#2 - C#3 - G#2 - C#3 -',
      ),
      ...rep(4,
        'F#2 - F#2 F#2 F#2 - C#2 - C#2 - C#2 C#2 C#2 C#2 E2 -',
        'E2 - E2 E2 E2 E2 B1 - B1 - B1 - B1 B1 F#2 -',
      ),
    ],
    melody: [
      '. . . . . . . . . . C#5 - G#4 - . .', '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . C#5 - G#4 - . .', '. . . . . . . . A#4 - - - . . . .',
      'C#5 - - - - - D#5 - - - - - - - F#5 -', '- - - - - - G#5 - - - - - A#5 - - -',
      '- - - - - - - A#5 . . . A#5 A#5 - . .', '. . . . . . . A#5 - . C#6 G#5 - - C#6 -',
      'C#5 - - - - - D#5 - - - - - D#6 - F#5 -', '- - - F#6 . . G#5 - - - - - A#5 - - -',
      'A#5 - A#5 - . . . . . . . . G#5 . A#5 -', '. . . . . . . A#5 - . C#6 G#5 - - A#5 -',
      'F#4 - F#4 F#4 F#4 - F#4 . C#5 - - - . . E4 -', 'E4 - E4 E4 E4 - . . . B4 - . . E4 F#4 -',
      'F#4 - F#4 F#4 F#4 - - . C#5 - - - . . E4 -', 'E4 - E4 E4 E4 - . . B4 - - - . B4 F#4 -',
      'F#5 - F#5 F#5 F#5 - C#6 - C#6 C#6 C#6 C#6 C#6 - E6 -', '- - E6 E6 E6 - D#6 C#6 B5 - C#6 - F#5 - F#5 -',
      'F#5 - F#5 F#5 F#5 F#5 C#6 - - C#6 C#6 C#6 C#6 - E6 -', 'E6 - E6 E6 E6 - D#6 C#6 B5 - C#6 - F#5 - - -',
    ],
  },

  // Track 3: C minor at 156, a bouncing octave bass under a singing square lead. Three sections of eight bars.
  radio3: {
    bpm: 156, swing: 0, lead: 'square', leadVol: 0.1,
    chords: [
      'Eb', 'F', 'Cm', 'Cm', 'Eb', 'F', 'Cm', 'Cm',
      'Cm', 'Bb', 'Gm', 'Gm', 'Cm', 'Bb', 'Gm', 'Cm',
      'Gm', 'Cm', 'Bb', 'Gm', 'Gm', 'Cm', 'Bb', 'Gm',
    ],
    arp: { steps: [0, 2, 4, 6, 8, 10, 12, 14], tones: [0, 1, 2, 1, 0, 1, 2, 1], vol: 0.02 },
    drums: [...rep(23, 'k.khs.hhk.hhs.hh'), 'k.khs.hhk.k.s.ss'],
    bassLine: [
      'D#2 - D#2 D#3 - D#2 D#3 - D#2 - D#2 D#3 F2 - F2 F3',
      'F1 - - - F2 - F1 - F1 - - F2 C2 - - C3',
      'C2 C3 C2 C3 - A#1 C3 C2 - C3 - C3 C2 - C3 -',
      'C2 C3 - C3 - A#1 C3 A#1 A#1 C3 - C3 C#2 C#2 D#2 -',
      'D#2 - D#2 D#3 - D#2 D#3 - D#2 - D#2 D#3 F2 - F2 F3',
      'F1 - - - F2 - F1 - F1 - - F2 C2 - - C3',
      'C2 C3 C2 C3 - A#1 C3 C2 - C3 - C3 C2 - C3 -',
      'C2 C3 - C3 - A#1 C3 A#1 A#1 C3 - C3 D#2 - D#2 -',
      'C2 C3 C2 C3 - A#1 C2 C3 C2 - C3 - C2 - A#1 -',
      'A#1 - A#2 - D2 - D2 - A#1 - A2 - . F2 G2 F2',
      'G1 - G2 - F2 G2 - G2 F2 - G2 G2 - F2 G2 G2',
      'G1 - G2 G2 F2 - G2 F2 F2 G2 G2 G2 . A#1 - -',
      'C2 C3 C2 C3 - A#1 C2 C3 C2 - C3 - C2 - A#1 -',
      'A#1 - A#2 - D2 - D2 - A#1 - A2 - C3 C2 C2 A#1',
      'G1 - G1 - G2 - A#1 - A#1 - C2 - C3 - . C2',
      'C2 C3 C2 C3 - A#1 C2 C3 C2 - C3 - C2 - A#1 -',
      'G1 G2 G1 G2 - F2 G2 - F2 G2 G2 G2 - A#2 C3 -',
      'C2 C3 C2 C3 C2 A#1 C3 C2 - C3 - C3 C2 - C3 .',
      'A#1 C2 - C2 . D2 D2 . . . . . G1 - G1 .',
      'F1 G1 - G1 F1 F1 G1 - - - G1 - - - - G1',
      'G1 - G1 - - F2 - F2 F2 G2 - G2 C3 A#2 - C3',
      'C2 C3 C2 C3 C2 - C2 C2 - C2 C2 C2 C2 - C2 C2',
      'A#1 - C2 - . D2 D2 - A#1 A#1 A#1 - G1 G1 - -',
      'A#1 A#1 - - C2 - A#2 . D2 . A#2 . . F2 G2 G1',
    ],
    melody: [
      '. . A#4 - - - - - - - - - - - - -', 'C5 - - - - - A#4 - - - - - C5 - - -',
      'D#5 - - - G5 - F5 - A#4 - C5 - - - - -', 'G5 - - - F5 - D#5 - D5 - D#5 - - - - -',
      'D#5 - - - - - - - - - - - G5 - - -', 'A5 - - - F5 - D#5 - C5 - - - A#4 - C5 -',
      'C5 - - - - - - - . . . . . . . .', '. . . . . . . C5 . G5 A#5 C6 - - G5 -',
      'C5 - - - - - . . . G4 A#4 C5 - - - -', '- - C5 - D5 - D5 - A#4 - - - . G4 - -',
      'A#4 - A#4 - D5 C5 A#4 G4 - F4 G4 F4 G4 - - .', 'A#4 - A#4 - D5 C5 A#4 G4 - G4 A#4 G4 C5 - - -',
      '- - - - - . . . . G4 A#4 G4 C5 - - -', 'C5 - C5 . D5 - D5 - A#4 - - - C5 - - A#4',
      '- G4 - F4 - F4 D#4 - A#4 B4 C5 - - - - -', 'D#5 - - - G5 - F5 - A#4 - C5 - - - - -',
      'G4 - - - A#4 - - - G4 - G4 - C5 - - -', 'G4 - - - - - - G4 F4 - G4 - - - - -',
      '- - - . D5 - - - A#4 - - - G4 - - G4', 'G4 - G4 - - G4 - - F4 - G4 - - - - -',
      'C5 D5 - D5 A#4 - G4 - C5 - F4 - G4 - - G4', '- - - - - - . . F4 - G4 - - - - -',
      '- - G4 . D5 - D5 - A#4 - - - . G4 . .', '. . . . . . . . . . . G4 G4 - - G4',
    ],
  },

  // Track 4: F major at 100 with a C mixolydian groove. A fast 16th-note lead riff over a walking bass, then the
  // E flat / F section with its arpeggios.
  radio4: {
    bpm: 100, swing: 0, lead: 'pulse12', leadVol: 0.11,
    chords: [...rep(8, 'Gsus4'), ...rep(4, 'Eb', 'F7')],
    arp: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], tones: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 1], vol: 0.018 },
    drums: [...rep(7, 'k.khskkhk.kks.kh'), 'k.khskkhk.k.s.ss', ...rep(7, 'k.khskkhk.kks.kh'), 'k.khskkhs.s.s.ss'],
    bassLine: [
      ...rep(8, 'G2 - A#2 C3 D3 C3 - C3 - C3 D3 - F2 - G2 -'),
      ...rep(4,
        'D#2 - D#2 D#2 G2 - A#2 - A#2 - A#2 A#2 A#2 - F2 F2',
        'F2 - F2 F2 - F2 F2 F2 - F2 F2 F2 - F2 D#2 D#2',
      ),
    ],
    melody: [
      'F5 C5 D5 A#4 G4 C5 G4 A#4 C5 D5 C5 D5 F5 G5 - F5', 'G5 F5 A#5 - A5 G5 - - . . . . . . G4 G5',
      'D5 C5 D5 A#4 G4 C5 G4 A#4 . D5 C5 D5 F5 G5 - F5', 'G5 F5 A#5 - A5 G5 - - . . . . . . G5 -',
      'F#5 G5 - G5 F#5 G5 - - F#5 G5 - G5 F#5 G5 G4 .', '. . . . . . . . . . . D5 F5 - G5 -',
      'F#5 G5 - - F#5 G5 - G5 F#5 G5 - G5 F#5 G5 G4 .', '. . . . . . . . . . . D5 F5 - G5 G4',
      '. . . . . . D5 - A#4 - . . D5 - F5 -', '- . . . F5 - - - . . . . . . . D#5',
      '. . . . . . D5 - D5 . . . . D5 . F5', '- . . . . F5 - - . . . . . . . .',
      'G4 - . A#4 D#5 - A#4 - A#4 - . . . A#4 . .', 'A4 - . C5 F5 - C6 - A5 . F5 - D#5 C5 . .',
      'G4 - . A#4 . . . D5 A#4 - . . . . . .', 'A4 - C5 . F5 - . C6 A5 - F5 - . C5 - -',
    ],
  },

  // Track 5: C minor (dorian) at 156 with a half-time feel: a pulsing C ostinato, then the long sung melody falling
  // from E flat to G over Gm, Cm and F7.
  radio5: {
    bpm: 156, swing: 0, lead: 'pulse25', leadVol: 0.12,
    chords: [
      'Cm', 'Cm', 'Cm', 'Cm',
      'Gm', 'Gm', 'Cm', 'Gm', 'Gm', 'C', 'Cm', 'F7', 'F', 'F', 'Cm', 'F7', 'F', 'C', 'Cm', 'Cm',
    ],
    bass: { steps: [0, 4, 7, 10, 12, 15], tones: [0, 0, 0, 0, 0, 0], len: 2 },
    comp: { vol: 0.025, pattern: [...rep(4, '................'), ...rep(16, 'x-------x-------')] },
    drums: ['................', '................', 'k...k...k...k...', 'k...k...k...s.ss', ...rep(15, 'k..hs.k.k..hs...'), 'k..hs.k.k.s.s.ss'],
    melody: [
      'D#4 C4 C4 C4 A#3 C4 C4 G4 C4 C4 D#4 C4 C4 C4 F4 C4', 'D#4 C4 C4 C4 A#3 C4 C4 G4 C4 C4 D#4 C4 C4 C4 F4 C4',
      'D#4 C4 C4 C4 A#3 C4 C4 G4 C4 C4 D#4 C4 C4 C4 F4 C4', 'D#4 C4 C4 C4 A#3 C4 C4 G4 C4 C4 D#4 C4 C5 A#4 A4 -',
      '. . C5 - A#4 - A4 - G4 - - - - - - -', '- - - - - - - - - - - - - - A#4 -',
      'C5 - - - - - - - . . . . . . G4 -', 'D#5 - D5 - C5 - A#4 - - - - - - - - -',
      'D5 - C5 - A#4 - G4 - - - - - - - - -', '- - - - - - - - C5 - - - - - - -',
      'D#5 - D5 - C5 - A#4 - - - - - - - - -', 'D#5 - D5 - C5 - A4 - - - - - - - - -',
      'A4 - - - - - - - A#4 - - - - - - -', 'C5 - - - - - - - - - - - - - G4 -',
      'D#5 - D5 - C5 - A#4 - - - - - - - G4 -', 'D#5 - D5 - C5 - A4 - - - - - - - - -',
      'A4 - - - - - - - A#4 - - - - - - -', 'C5 - - - - - - - . . . . . . . .',
      '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . C5 A#4 A4 -',
    ],
  },

  // Track 6: A minor (dorian) at 127. The bare riff (A, D, C, B, A, high A), then the hook over Am, C, G and D, then the
  // A / D7 vamp.
  radio6: {
    bpm: 127, swing: 0, lead: 'square', leadVol: 0.1,
    chords: [
      'N', 'N', 'N', 'N',
      'Am', 'C', 'G', 'D', 'Am', 'C', 'G', 'D',
      'Am', 'D7', 'Am', 'D7', 'Am', 'D7', 'Am', 'D7',
    ],
    bass: { steps: [0, 2, 3, 6, 7, 9, 11, 14], tones: [0, 0, 0, 0, 0, 0, 0, 0], len: 1 },
    comp: { vol: 0.025, pattern: 'x-----x-----x---' },
    drums: ['................', '................', '................', '........k...s.ss', ...rep(15, 'k.hhs.hhk.hhs.hk'), 'k.hhs.hhk.k.s.ss'],
    melody: [
      'A3 - - - - - - D4 - - - - - - - C4', '- - - - D4 C4 B3 - - A3 - - A4 - - -',
      'A3 - - - - - - D4 - - - - - - - C4', '- - - - D4 C4 B3 - - A3 - - A4 - - -',
      '. . . . A4 - C5 - C5 B4 A4 B4 - A4 - G4', '- - A4 . . . . . A4 - - B4 - B4 - G4',
      '- E4 - E4 G4 - - - G4 - - . E4 . . A4', '- A4 - A4 G4 - E4 - - . A4 . D4 . . A4',
      'A4 - - - A4 - - A4 - A4 C5 - C5 - C5 -', 'A4 - . . A4 - - A4 - A4 C5 - A4 - G4 -',
      'A4 - - - A4 - - A4 - A4 C5 - D5 . C5 -', 'A4 - - - A4 - - A4 - A4 C5 - A4 - G4 -',
      'A4 - A4 E4 - E4 G4 A4 - G4 D5 A4 - - - -', 'A4 - A4 - A4 - - A4 G4 - - G4 - G4 - -',
      'A4 - A4 - G4 - G4 E4 - G4 C5 A4 - - - G4', 'A4 - - - A4 - A4 - - G4 - - G4 - G4 -',
      'A4 - E4 - G4 A4 - C5 A4 G4 E4 - - G4 - -', 'A4 - - - . . . . D5 - C5 - A4 - G4 -',
      'A4 - - - - - - - . . . . . . . .', '. . . . . . . . . . . . G4 - A4 -',
    ],
  },
};
