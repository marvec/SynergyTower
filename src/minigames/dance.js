// Dance-Off (Christmas party, the DJ booth): arrows rise to the line on the beat of the party song; hit each with its
// arrow key (or tap its pad) as it crosses. Perfect and good windows; a stray press costs half a note; confetti on every
// 10-combo. About 40 s. The host restarts the song (inst.song) when play starts, so beat 0 sounds SONG_LEAD into the game.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONG_LEAD } from '../engine/audio.js';
import { SONGS } from '../data/music.js';
import { Confetti } from '../scenes/confetti.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const LANE_X = [180, 220, 260, 300];
const COLORS = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e'];
const LINE_Y = 52;
const SPEED = 120; // px per second
const PERFECT = 0.09;
const GOOD = 0.18;
const PAD = { y: 226, w: 36, h: 30 };
const SONG_S = 40;

/** A 15 px pixel arrow pointing along lane 0..3 (left, down, up, right), centred on x, y. */
function arrow(g, x, y, lane, col) {
  for (let i = 0; i < 7; i++) {
    const w = 1 + i * 2;
    if (lane === 2) rect(g, x - i, y - 7 + i, w, 1, col);
    if (lane === 1) rect(g, x - i, y + 7 - i, w, 1, col);
    if (lane === 0) rect(g, x - 7 + i, y - i, 1, w, col);
    if (lane === 3) rect(g, x + 7 - i, y - i, 1, w, col);
  }
  if (lane === 2) rect(g, x - 2, y, 5, 7, col);
  if (lane === 1) rect(g, x - 2, y - 7, 5, 7, col);
  if (lane === 0) rect(g, x, y - 2, 7, 5, col);
  if (lane === 3) rect(g, x - 7, y - 2, 7, 5, col);
}

export default {
  id: 'dance',
  name: 'Dance-Off',
  help: 'Hit each arrow as it crosses the line: arrow keys, or tap the pads. On the beat for a Perfect!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const beat = 60 / SONGS.xmasparty.bpm;
    const step = d >= 0.5 ? beat / 2 : beat;
    const notes = [];
    for (let k = 0; 2 + k * step < SONG_S; k++) if (rng.chance(byDiff(d, 0.6, 0.8))) notes.push({ t: 2 + k * step + SONG_LEAD, lane: rng.int(0, 3), hit: null });
    const total = new Countdown(SONG_S + 3);
    const fl = new Floaters();
    const confetti = new Confetti(() => rng.next());
    let time = 0;
    let points = 0;
    let strays = 0;
    let combo = 0;
    let best = 0;
    const flash = [0, 0, 0, 0];

    const judge = (lane) => {
      flash[lane] = 0.15;
      const n = notes.find((o) => o.lane === lane && o.hit === null && Math.abs(o.t - time) <= GOOD);
      if (!n) {
        strays++;
        combo = 0;
        return sfx('bad');
      }
      n.hit = Math.abs(n.t - time) <= PERFECT ? 'perfect' : 'good';
      points += n.hit === 'perfect' ? 1 : 0.6;
      combo++;
      best = Math.max(best, combo);
      sfx(n.hit === 'perfect' ? 'good' : 'click');
      fl.add(n.hit === 'perfect' ? 'Perfect!' : 'Good', LANE_X[lane], LINE_Y + 22, n.hit === 'perfect' ? '#f2e14e' : '#ffffff');
      if (combo % 10 === 0) {
        fl.add(`${combo} combo!`, W / 2, 140, '#f29cd0');
        confetti.burst(W / 2, 150, 30, 0.8);
      }
    };
    const score = () => clamp((points - 0.5 * strays) / Math.max(1, notes.length), 0, 1);

    const inst = {
      done: false,
      score: 0,
      song: 'xmasparty',
      peek: () => ({ time, combo, confetti: confetti.count, notes: notes.filter((n) => n.hit === null).map((n) => ({ t: n.t, lane: n.lane })) }),
      update(dt, input) {
        fl.update(dt);
        confetti.update(dt);
        for (let i = 0; i < 4; i++) flash[i] = Math.max(0, flash[i] - dt);
        if (inst.done) return;
        time += dt;
        for (const n of notes)
          if (n.hit === null && time - n.t > GOOD) {
            n.hit = 'miss';
            combo = 0;
          }
        if (total.update(dt) || time > SONG_S + 1) return finish(inst, score());
        KEYS.forEach((k, i) => input.pressed(k) && judge(i));
        if (input.pointer.clicked && input.pointer.y >= PAD.y - 4) {
          const i = LANE_X.findIndex((x) => Math.abs(input.pointer.x - x) <= PAD.w / 2 + 2);
          if (i >= 0) judge(i);
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#140f22');
        // The dance floor's lights behind the lanes, pulsing on the beat.
        const beats = Math.max(0, time - SONG_LEAD) / beat;
        const pulse = Math.floor(beats) % 4;
        for (let i = 0; i < 8; i++) rect(g, i * 60, 200, 60, 70, i % 4 === pulse ? '#3a2a5a' : '#241a38');
        for (let i = 0; i < 4; i++) {
          rect(g, LANE_X[i] - 18, 30, 36, 190, '#1d1630');
          arrow(g, LANE_X[i], LINE_Y, i, flash[i] > 0 ? '#ffffff' : '#5a5070');
        }
        for (const n of notes) {
          if (n.hit === 'perfect' || n.hit === 'good') continue;
          const y = LINE_Y + (n.t - time) * SPEED;
          if (y < 20 || y > 215) continue;
          arrow(g, LANE_X[n.lane], Math.round(y), n.lane, n.hit === 'miss' ? '#4a4458' : COLORS[n.lane]);
        }
        for (let i = 0; i < 4; i++) {
          rect(g, LANE_X[i] - PAD.w / 2, PAD.y, PAD.w, PAD.h, flash[i] > 0 ? COLORS[i] : '#2a2240');
          arrow(g, LANE_X[i], PAD.y + PAD.h / 2, i, '#f4f1e8');
        }
        // You and the DJ's rival, bouncing on the beat.
        const hop = Math.abs(Math.sin(beats * Math.PI)) * 6;
        for (const [x, c] of [[70, '#d8343a'], [410, '#2f8a3a']]) {
          const y = Math.round(150 - hop);
          rect(g, x - 6, y, 12, 22, c);
          rect(g, x - 5, y - 12, 10, 11, '#f2c9a0');
          rect(g, x - 6, y - 16, 12, 4, '#d8343a');
          rect(g, x - 6, y - 13, 12, 1, '#f4f1e8');
          rect(g, x - 6, y + 22, 4, 10, '#2b2e38');
          rect(g, x + 2, y + 22, 4, 10, '#2b2e38');
        }
        drawText(g, 'YOU', 70, 196, { align: 'center', color: '#f4f1e8' });
        drawText(g, `Combo ${combo}  Best ${best}`, W / 2, 20, { align: 'center', color: '#f29cd0' });
        drawText(g, isTouch() ? 'Tap the pads' : 'Arrow keys', W / 2, 260, { align: 'center', color: '#8a80a0' });
        header(g, theme?.title || 'Dance-Off', `${Math.max(0, Math.ceil(SONG_S - time))} s`);
        timerBar(g, total.left, total.total);
        confetti.render(g);
        fl.render(g);
      },
    };
    return inst;
  },
};
