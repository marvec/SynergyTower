// Carol Karaoke (Christmas party, the stage): sing a carol in the public domain. Its melody runs in three pitch lanes
// (low, middle, high); keep your voice on the lane of the note being sung (Up/Down, or tap a lane) while the lyrics scroll.
// The host plays the carol (inst.song) from the start of play. Score: time on the right lane over the sung time, where
// a third (a voice parked on one lane) is nothing.
import { W, H, rect, drawText, measureText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONGS } from '../data/music.js';
import { CAROLS } from '../data/party.js';
import { bake, cblob } from '../engine/mgart.js';
import { person, DEFAULT_PLAYER } from '../engine/figure.js';
import { stringWire, stringBulbs, xmasTreeBody, xmasTreeBaubles } from '../engine/mgscenery.js';

const NOTE = /^([A-G])(#|b)?(\d)$/;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LANE_Y = [180, 140, 100]; // low at the bottom
const LANE_NAMES = ['LOW', 'MID', 'HIGH'];
const NOW_X = 110;
const PX = 70; // px per second
const NOTE_COL = ['#c8343a', '#8a2028']; // a note to come: its face and its underside
const LIVE_COL = ['#f2e14e', '#b8a020']; // the note being sung
// The choir: six colleagues in Santa hats on the riser.
const CHOIR = [
  { skin: '#d9a273', hair: '#2b1d14', top: '#b63b3b', pants: '#2b2e38' },
  { skin: '#a86b42', hair: '#1a1a1a', top: '#e8d8d8', pants: '#3a3f55', skirt: '#2f6f5f', long: true },
  { skin: '#f2c9a0', hair: '#d9b25c', top: '#3b6fb6', pants: '#22242e', tie: '#c9a227' },
  { skin: '#6b4228', hair: '#1a1a1a', top: '#2f8a3a', pants: '#2b2e38', skirt: '#7a3b4a', long: true },
  { skin: '#f2c9a0', hair: '#a33b20', top: '#7a3bb6', pants: '#3a3f55' },
  { skin: '#d9a273', hair: '#c8c8c8', top: '#22242e', pants: '#22242e', tie: '#c0392b', lapel: '#f4f1e8' },
].map((l) => ({ ...l, hat: 'santa' }));

/** The stage behind the lanes: drapes with a gold fringe, the staves, the tree and the riser. */
function stage(g) {
  rect(g, 0, 0, W, H, '#1a1226');
  for (const [x0, w] of [[0, 34], [446, 34]])
    for (let k = 0; k < w; k += 8) {
      rect(g, x0 + k, 18, 8, 196, '#7a1a2a');
      rect(g, x0 + k, 18, 4, 196, '#982838');
    }
  rect(g, 0, 18, W, 10, '#982838');
  for (let x = 0; x < W; x += 12) rect(g, x, 28, 8, 4, '#c8a040');
  stringWire(g, 34, 40, 440);
  rect(g, 120, 94, 312, 6, '#5a3a22'); // the riser
  rect(g, 120, 94, 312, 2, '#7a5232');
}

/** The tree, drawn over the garland's bulbs. */
function tree(g) {
  xmasTreeBody(g, 438, 96, 54);
}

/** The staves under the notes, with their names (drawn after the choir, which stands behind them). */
function staves(g) {
  for (let i = 0; i < 3; i++) {
    rect(g, 40, LANE_Y[i], W - 60, 16, '#241a34');
    rect(g, 40, LANE_Y[i] + 4, W - 60, 2, '#30244a');
    rect(g, 40, LANE_Y[i] + 10, W - 60, 2, '#30244a');
    drawText(g, LANE_NAMES[i], 6, LANE_Y[i] + 5, { color: '#c8b8e8', shadow: '#1a1226' });
  }
}

/** The karaoke screen: a shelf and a dark panel for the lyrics. */
function screen(g) {
  rect(g, 0, 204, W, 10, '#5a3a22');
  rect(g, 0, 204, W, 2, '#7a5232');
  rect(g, 0, 214, W, H - 214, '#120c1c');
  rect(g, 30, 222, 420, 22, '#0a0612');
  rect(g, 30, 222, 420, 2, '#2a1e3a');
}

/** A rounded note bar from x0 to x1 on the stave at y. */
function note(g, x0, x1, y, [face, dark]) {
  const w = x1 - x0;
  if (w < 6) return rect(g, x0, y + 3, w, 10, face);
  rect(g, x0 + 2, y + 3, w - 4, 10, face);
  rect(g, x0, y + 5, w, 6, face);
  rect(g, x0 + 2, y + 11, w - 4, 2, dark);
  rect(g, x0 + 2, y + 3, w - 4, 2, '#ffffff44');
}

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
  create({ rng, theme, player, sfx = () => {} }) {
    const look = { ...(player || DEFAULT_PLAYER), hat: 'santa' }; // your head wears a Santa hat too
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
    const beat = 60 / SONGS[carol.id].bpm;
    const back = bake(W, H, stage);
    const treeImg = bake(W, 100, tree);
    const lower = bake(W, H, (a) => (staves(a), screen(a)));
    // The choir, baked once per singer with the mouth shut or open (24 x 66 px, the hat reaching 6 px above the head).
    const choir = CHOIR.map((l) => ['smile', 'sing'].map((expr) => bake(26, 66, (a) => person(a, 0, 6, 2, l, { expr }))));

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
        g.drawImage(back, 0, 0);
        stringBulbs(g, 34, time, 40, 440);
        g.drawImage(treeImg, 0, 0);
        xmasTreeBaubles(g, 438, 96, 54, time);
        // The choir sings on the beat, every other one with an open mouth.
        const bt = Math.floor(time / beat);
        choir.forEach((imgs, i) => g.drawImage(imgs[(i + bt) % 2 === 0 ? 1 : 0], 132 + i * 48, 32));
        g.drawImage(lower, 0, 0);
        const cur = notes.find((n) => time >= n.t && time < n.t + n.dur);
        for (const n of notes) {
          const x = NOW_X + (n.t - time) * PX;
          const w = Math.max(3, n.dur * PX - 2);
          const x0 = Math.max(40, x);
          const x1 = Math.min(W - 20, x + w); // inside the lane
          if (x1 <= x0) continue;
          note(g, Math.round(x0), Math.round(x1), LANE_Y[n.lane], n === cur ? LIVE_COL : NOTE_COL);
        }
        rect(g, NOW_X, 92, 2, 112, '#f4f1e8');
        if (voice >= 0) {
          // Your head in a Santa hat on the lane you sing at, mouth open on a note.
          g.save();
          g.beginPath();
          g.rect(NOW_X - 14, LANE_Y[voice] - 10, 30, 28);
          g.clip();
          person(g, NOW_X - 11, LANE_Y[voice] - 4, 2, look, { expr: cur ? 'sing' : 'smile' });
          g.restore();
        }
        // The lyrics: the current syllable bright, the next few dim.
        const i0 = Math.max(0, notes.findIndex((n) => n.t + n.dur > time));
        let x = 40;
        for (let i = i0; i < Math.min(notes.length, i0 + 8); i++) {
          const word = notes[i].word;
          if (x + measureText(word) > 446) break; // stay on the screen
          drawText(g, word, x, 229, { color: i === i0 && time >= notes[i].t ? '#f2e14e' : '#c8b8a8' });
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
