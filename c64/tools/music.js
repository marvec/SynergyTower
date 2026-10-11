// Converts the game's WebAudio tracker songs (src/data/music.js) into a 3-voice SID stream:
// voice 1 = lead, voice 2 = bass, voice 3 = drums (+ sound effects). Arp/comp parts are dropped.
// Per step 3 bytes: lead, bass, drum. Note bytes: 0 = hold, 1 = gate off, n >= 2 = note (midi - NOTE_BASE).
import { compileSong } from '../../src/engine/audio.js';

const NOTE_BASE = 22; // note byte 2 = midi 24 (C1)
const PAL_CLOCK = 985248;
const DRUM_ID = { k: 1, s: 2, h: 3, o: 4, r: 5 };

const LEAD = {
  triangle: { wave: 0x10, pw: 0x08 },
  pulse25: { wave: 0x40, pw: 0x04 },
  pulse12: { wave: 0x40, pw: 0x02 },
  square: { wave: 0x40, pw: 0x08 },
};

/** Frequency tables for note bytes 0..95 (lo, hi). */
export function freqTables() {
  const lo = [];
  const hi = [];
  for (let n = 0; n < 96; n++) {
    const midi = n + NOTE_BASE;
    const hz = 440 * 2 ** ((midi - 69) / 12);
    const v = n < 2 ? 0 : Math.min(0xffff, Math.round((hz * 16777216) / PAL_CLOCK));
    lo.push(v & 0xff);
    hi.push(v >> 8);
  }
  return { lo, hi };
}

export function songAsm(label, song) {
  const { events, steps } = compileSong(song);
  const lead = new Array(steps).fill(0);
  const bass = new Array(steps).fill(0);
  const drum = new Array(steps).fill(0);
  const place = (arr, ev) => {
    const n = ev.midi - NOTE_BASE;
    if (n < 2 || n > 95) throw new Error(`note out of range in ${label}: ${ev.midi}`);
    arr[ev.step] = n;
    const off = ev.step + ev.len;
    if (off < steps && arr[off] === 0) arr[off] = 1;
  };
  for (const ev of events) {
    if (ev.ch === 'lead') place(lead, ev);
    else if (ev.ch === 'bass') place(bass, ev);
    else if (ev.ch === 'drum') drum[ev.step] = DRUM_ID[ev.drum] || 0;
  }
  // Note-offs placed before the note that follows them would be overwritten above; re-run so notes win.
  for (const ev of events) {
    if (ev.ch === 'lead') lead[ev.step] = ev.midi - NOTE_BASE;
    if (ev.ch === 'bass') bass[ev.step] = ev.midi - NOTE_BASE;
  }
  const frames = (50 * 60) / song.bpm / 4;
  const even = Math.max(2, Math.round(frames * (1 + (song.swing || 0))));
  const odd = Math.max(2, Math.round(frames * 2) - even);
  const L = LEAD[song.lead] || LEAD.pulse25;
  const lines = [
    `${label}:`,
    `  .byte ${even}, ${odd}           ; frames per even / odd step (swing)`,
    `  .byte ${steps}                 ; steps`,
    `  .byte $${L.wave.toString(16)}, $09, $a4, $${L.pw.toString(16)}   ; lead: wave, AD, SR, pulse width hi`,
    `  .byte $40, $0a, $40, $03   ; bass`,
  ];
  for (let s = 0; s < steps; s += 8) {
    const row = [];
    for (let k = s; k < Math.min(steps, s + 8); k++) row.push(lead[k], bass[k], drum[k]);
    lines.push(`  .byte ${row.join(', ')}`);
  }
  return { asm: lines.join('\n'), bytes: 9 + steps * 3 };
}
