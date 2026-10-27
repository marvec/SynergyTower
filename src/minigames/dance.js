// Dance-Off (Christmas party, the DJ booth): arrows rise to the line on the beat of the party song; hit each with its
// arrow key (or tap its pad) as it crosses. Perfect and good windows; a stray press costs half a note; confetti on every
// 10-combo. About 40 s. The host restarts the song (inst.song) when play starts, so beat 0 sounds SONG_LEAD into the game.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { SONG_LEAD } from '../engine/audio.js';
import { SONGS } from '../data/music.js';
import { Confetti } from '../scenes/confetti.js';
import { bake, cblob } from '../engine/mgart.js';
import { person, DEFAULT_PLAYER } from '../engine/figure.js';
import { stringWire, stringBulbs, discoBall } from '../engine/mgscenery.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const LANE_X = [180, 220, 260, 300];
const COLORS = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e'];
const LINE_Y = 52;
const SPEED = 120; // px per second
const PERFECT = 0.09;
const GOOD = 0.18;
const PAD = { y: 226, w: 36, h: 30 };
const SONG_S = 40;

const ARROW = ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..', '..####..'];
const GREY = '#5a5070';
const MISS = '#4a4458';
const FLOOR_TILES = ['#5a2a6a', '#2a3a7a', '#2a6a5a', '#7a5a2a']; // the lit tile colour, one per beat
const SPOTS = ['#e2504a', '#5b8def', '#5fd068', '#f2c14e', '#f29cd0', '#7ee0c3'];
const RIVAL = { skin: '#d9a273', hair: '#2b1d14', top: '#b63b3b', pants: '#2b2e38', hat: 'santa' }; // a colleague in a Santa hat
const DJ = { skin: '#f2c9a0', hair: '#a33b20', top: '#7a3bb6', pants: '#3a3f55' };

/** A 16 px chunky arrow on a 2 px grid pointing along lane 0..3 (left, down, up, right), centred on x, y. */
function arrow(g, x, y, lane, col) {
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      if (ARROW[j][i] !== '#') continue;
      const [u, v] = lane === 2 ? [i, j] : lane === 1 ? [i, 7 - j] : lane === 0 ? [j, i] : [7 - j, i];
      rect(g, x - 8 + u * 2, y - 8 + v * 2, 2, 2, col);
    }
}

/** The hall's back wall: dark panels and the garland's wire. */
function hall(g) {
  rect(g, 0, 0, W, H, '#140f22');
  rect(g, 0, 18, W, 178, '#1e1630');
  for (let x = 0; x < W; x += 24) rect(g, x, 18, 12, 178, '#21183a');
  stringWire(g, 24);
}

/** Everything in front of the wall that never changes: the DJ booth, the dancers' shadows, the unlit floor, the lane glass. */
function front(g) {
  // The DJ behind the decks, at the back right.
  person(g, 434, 100, 2, DJ, { expr: 'smile' });
  rect(g, 436, 104, 24, 2, '#1a1a22');
  rect(g, 434, 108, 4, 8, '#1a1a22');
  rect(g, 458, 108, 4, 8, '#1a1a22');
  rect(g, 352, 118, 112, 54, '#1a1426');
  rect(g, 352, 118, 112, 4, '#3a2a5a');
  for (const sx of [334, 466]) {
    rect(g, sx, 120, 14, 52, '#141020');
    cblob(g, sx + 7, 134, 4, 4, '#3a3a4a');
    cblob(g, sx + 7, 156, 6, 6, '#3a3a4a');
  }
  cblob(g, 70, 184, 16, 4, '#00000066');
  cblob(g, 410, 184, 16, 4, '#00000066');
  for (let y = 196; y < H; y += 18)
    for (let x = 0; x < W; x += 40) {
      rect(g, x, y, 40, 18, '#120c1e');
      rect(g, x + 2, y + 2, 36, 14, '#1e1630');
    }
  // The lanes: dark glass panels.
  for (let i = 0; i < 4; i++) {
    rect(g, LANE_X[i] - 18, 30, 36, 190, '#0e0a18');
    rect(g, LANE_X[i] - 16, 32, 32, 186, '#1d1630');
    rect(g, LANE_X[i] - 16, 32, 2, 186, '#2a2244');
  }
}

export default {
  id: 'dance',
  name: 'Dance-Off',
  help: 'Hit each arrow as it crosses the line: arrow keys, or tap the pads. On the beat for a Perfect!',
  create({ difficulty: d, rng, theme, player, sfx = () => {} }) {
    const look = { ...(player || DEFAULT_PLAYER), hat: 'santa' }; // you dance in a Santa hat, in the career's trousers or skirt
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
    const wall = bake(W, H, hall);
    const stage = bake(W, H, front);
    // The 16 px arrows, one image per lane and colour (grey, white, missed, the lane's own, the pads' cream).
    const arrows = Array.from({ length: 4 }, (_, lane) => {
      const img = {};
      for (const c of [GREY, '#ffffff', MISS, COLORS[lane], '#f4f1e8']) img[c] = bake(16, 16, (a) => arrow(a, 8, 8, lane, c));
      return img;
    });
    const put = (g, x, y, lane, c) => g.drawImage(arrows[lane][c], x - 8, y - 8);

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
        const beats = Math.max(0, time - SONG_LEAD) / beat;
        const pulse = Math.floor(beats) % 4;
        g.drawImage(wall, 0, 0);
        // The ball's coloured spots turn over the back wall.
        g.save();
        g.globalAlpha = 0.5;
        for (let i = 0; i < 6; i++) {
          const a = time * 0.8 + i;
          cblob(g, Math.round((240 + Math.cos(a) * 200) / 2) * 2, Math.round((120 + Math.sin(a * 1.3) * 50) / 2) * 2, 8, 6, SPOTS[i]);
        }
        g.restore();
        stringBulbs(g, 24, time);
        g.drawImage(stage, 0, 0);
        for (let k = 0; k < 6; k++) rect(g, 360 + k * 16, 128, 8, 40, ['#e2504a', '#5b8def', '#5fd068'][(k + Math.floor(time * 4)) % 3]); // the booth's lights
        // The dance floor: the tiles whose turn it is light up, the pattern moving on with each beat.
        for (let y = 196, row = 0; y < H; y += 18, row++)
          for (let x = 0, i = row; x < W; x += 40, i++)
            if (i % 4 === pulse && !(x >= 160 && x < 320 && y + 2 < 220)) { // never over the lane glass
              rect(g, x + 2, y + 2, 36, 14, FLOOR_TILES[pulse]);
              rect(g, x + 2, y + 2, 36, 2, '#ffffff33');
            }
        discoBall(g, 92, 52, time, 12);
        rect(g, 162, LINE_Y - 1, 156, 2, '#f29cd044');
        for (let i = 0; i < 4; i++) put(g, LANE_X[i], LINE_Y, i, flash[i] > 0 ? '#ffffff' : GREY);
        for (const n of notes) {
          if (n.hit === 'perfect' || n.hit === 'good') continue;
          const y = LINE_Y + (n.t - time) * SPEED;
          if (y < 20 || y > 215) continue;
          put(g, LANE_X[n.lane], Math.round(y), n.lane, n.hit === 'miss' ? MISS : COLORS[n.lane]);
        }
        for (let i = 0; i < 4; i++) {
          const on = flash[i] > 0;
          const x = LANE_X[i] - PAD.w / 2;
          rect(g, x, PAD.y, PAD.w, PAD.h, '#0e0a18');
          rect(g, x + 1, PAD.y + 1, PAD.w - 2, PAD.h - 2, on ? COLORS[i] : '#2a2240');
          rect(g, x + 1, PAD.y + 1, PAD.w - 2, 2, on ? '#ffffff66' : '#3a3258');
          put(g, LANE_X[i], PAD.y + PAD.h / 2, i, '#f4f1e8');
        }
        // You and the DJ's rival, mid-move on the beat (a pose for the first half of each beat, standing between), feet at 182.
        const moving = time >= SONG_LEAD && beats % 1 < 0.6;
        const odd = Math.floor(beats) % 2 === 1;
        const hop = moving ? 2 : 0;
        person(g, 58, 122 - hop, 2, look, { pose: moving ? (odd ? 'danceB' : 'danceA') : 'stand', expr: 'smile' });
        person(g, 398, 122 - hop, 2, RIVAL, { pose: moving ? (odd ? 'danceA' : 'danceB') : 'stand', expr: 'smile' });
        drawText(g, 'YOU', 70, 196, { align: 'center', color: '#f4f1e8', shadow: '#120c1e' });
        drawText(g, `Combo ${combo}  Best ${best}`, W / 2, 20, { align: 'center', color: '#f29cd0', shadow: '#120c1e' });
        drawText(g, isTouch() ? 'Tap the pads' : 'Arrow keys', W / 2, 260, { align: 'center', color: '#c8b8e8', shadow: '#120c1e' });
        header(g, theme?.title || 'Dance-Off', `${Math.max(0, Math.ceil(SONG_S - time))} s`);
        timerBar(g, total.left, total.total);
        confetti.render(g);
        fl.render(g);
      },
    };
    return inst;
  },
};
