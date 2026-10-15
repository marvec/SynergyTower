// Carol Karaoke (Christmas party, the stage): sing a carol in the public domain. Its melody runs in three pitch lanes
// (low, middle, high); keep your voice on the lane of the note being sung (Up/Down, or tap a lane) while the lyrics scroll.
// The host plays the carol (inst.song) from the start of play. Score: time on the right lane over the sung time, where
// a third (a voice parked on one lane) is nothing.
import { W, H, rect, drawText, measureText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONGS } from '../data/music.js';
import { CAROLS } from '../data/party.js';

const NOTE = /^([A-G])(#|b)?(\d)$/;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LANE_Y = [180, 140, 100]; // low at the bottom
const LANE_NAMES = ['LOW', 'MID', 'HIGH'];
const NOW_X = 110;
const PX = 70; // px per second

export function midiOf(tok) {
  const m = NOTE.exec(tok);
  if (!m) return null;
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** The sung notes of a tracker song: [{ t, dur, midi }] in seconds; '-' holds the note before it, '.' rests. */
export function melodyNotes(song) {
  const step = 60 / song.bpm / 4;
  const toks = song.melody.flatMap((bar) => bar.trim().split(/\s+/));
  const notes = [];
  let open = false; // the last token was the note (or its hold), so a '-' extends it
  toks.forEach((tok, i) => {
    const midi = midiOf(tok);
    if (midi != null) {
      notes.push({ t: i * step, dur: step, midi });
      open = true;
    } else if (tok === '-' && open) notes.at(-1).dur += step;
    else open = false;
  });
  return notes;
}

/** Three lanes over the distinct pitches a carol uses, low to high. */
export function lanesFor(notes) {
  const pitches = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b);
  return (midi) => Math.min(2, Math.floor((pitches.indexOf(midi) * 3) / pitches.length));
}

export default {
  id: 'carols',
  name: 'Carol Karaoke',
  help: 'Sing along: keep your voice on the lane of the note being sung. Up/Down, or tap a lane.',
  create({ rng, theme, sfx = () => {} }) {
    const carol = rng.pick(CAROLS);
    const notes = melodyNotes(SONGS[carol.id]);
    const lane = lanesFor(notes);
    notes.forEach((n, i) => Object.assign(n, { lane: lane(n.midi), word: carol.syllables[i] || '' }));
    const end = notes.at(-1).t + notes.at(-1).dur;
    const total = new Countdown(end + 3);
    const fl = new Floaters();
    let time = 0;
    let voice = -1; // not singing until the first press
    let sung = 0;
    let on = 0;
    let wasOn = false;

    const inst = {
      done: false,
      score: 0,
      song: carol.id,
      peek: () => ({ time, voice, notes: notes.map((n) => ({ t: n.t, dur: n.dur, lane: n.lane })) }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        time += dt;
        if (input.pressed('ArrowUp')) voice = voice < 0 ? 1 : Math.min(2, voice + 1);
        if (input.pressed('ArrowDown')) voice = voice < 0 ? 1 : Math.max(0, voice - 1);
        if (input.pointer.clicked) {
          const i = LANE_Y.findIndex((y) => Math.abs(input.pointer.y - (y + 8)) <= 18);
          if (i >= 0) voice = i;
        }
        const cur = notes.find((n) => time >= n.t && time < n.t + n.dur);
        if (cur) {
          sung += dt;
          const ok = voice === cur.lane;
          if (ok) on += dt;
          if (ok && !wasOn) sfx('click');
          wasOn = ok;
        }
        if (total.update(dt) || time >= end + 0.5) return finish(inst, clamp(((sung ? on / sung : 0) - 1 / 3) * 1.5, 0, 1));
      },
      render(g) {
        rect(g, 0, 0, W, H, '#1a1226');
        rect(g, 0, 214, W, 56, '#3a2416');
        for (let i = 0; i < 3; i++) {
          rect(g, 40, LANE_Y[i], W - 60, 16, '#241a34');
          drawText(g, LANE_NAMES[i], 6, LANE_Y[i] + 5, { color: '#8a80a0' });
        }
        for (const n of notes) {
          const x = NOW_X + (n.t - time) * PX;
          const w = Math.max(3, n.dur * PX - 2);
          const x0 = Math.max(40, x);
          const x1 = Math.min(W - 20, x + w); // inside the lane
          if (x1 <= x0) continue;
          const live = time >= n.t && time < n.t + n.dur;
          rect(g, Math.round(x0), LANE_Y[n.lane] + 3, Math.round(x1) - Math.round(x0), 10, live ? '#f2e14e' : '#c8343a');
        }
        rect(g, NOW_X, 92, 1, 112, '#f4f1e8');
        if (voice >= 0) {
          const y = LANE_Y[voice];
          rect(g, NOW_X - 7, y - 2, 14, 20, '#1a1a22');
          rect(g, NOW_X - 6, y - 1, 12, 18, '#f2c9a0');
          rect(g, NOW_X - 6, y - 4, 12, 4, '#d8343a');
          rect(g, NOW_X - 2, y + 10, 4, 3, '#7a3b3b');
        }
        // The lyrics: the current syllable bright, the next few dim.
        const i0 = Math.max(0, notes.findIndex((n) => n.t + n.dur > time));
        let x = 40;
        for (let i = i0; i < Math.min(notes.length, i0 + 8); i++) {
          const word = notes[i].word;
          drawText(g, word, x, 230, { color: i === i0 && time >= notes[i].t ? '#f2e14e' : '#c8b8a8' });
          x += measureText(word) + (word.endsWith('-') ? 1 : 6); // Jin-gle, not Jin gle
        }
        drawText(g, isTouch() ? 'Tap a lane to sing there' : 'Up/Down to change your note', W / 2, 252, { align: 'center', color: '#8a80a0' });
        header(g, theme?.title || 'Carol Karaoke', carol.title);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
