// Boss Alert: alt-tab to your spreadsheet just before the boss walks past your cubicle, but don't panic for colleagues.
import { W, H, C, rect, frame, panel, drawText, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { sprite, bake, grad, glow, grains, shaded, line, shade } from '../engine/mgart.js';
import { person, DEFAULT_PLAYER } from '../engine/figure.js';

const DESK_X = 240;
const FEET_Y = 112;
const SCREEN = { x: 160, y: 162, w: 160, h: 84 }; // your monitor's picture
const CUBICLE = { x: 150, y: 78, w: 182, h: 72 }; // the cubicle layer's place over the hallway
const SKIRTS = ['#2f6f5f', '#6a3f7a', '#8a4a3a'];
const SHIRTS = ['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#c86a9a', '#4a9aa0'];
const HAIRS = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#1a1a1a'];
const SKINS = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];

export default {
  id: 'stealth',
  name: 'Boss Alert',
  help: 'Press SPACE (or click) to alt-tab right before the BOSS (red tie) passes your desk. False alarms cost you.',
  create({ difficulty: d, rng, theme, sfx = () => {}, player }) {
    const fl = new Floaters();
    const shake = new Shake();
    const n = Math.round(byDiff(d, 8, 15));
    const interval = byDiff(d, 3.2, 2.3);
    const workDur = byDiff(d, 1.6, 0.9);
    const decoySuit = byDiff(d, 0, 0.6);
    const bossCount = Math.max(3, Math.round(n * 0.4));
    const bossIdx = new Set(rng.sample([...Array(n).keys()], bossCount));
    const walkers = [];
    let t0 = 1.2;
    for (let i = 0; i < n; i++) {
      const dir = rng.chance(0.5) ? 1 : -1;
      const boss = bossIdx.has(i);
      walkers.push({
        i,
        spawn: t0,
        dir,
        x: dir > 0 ? -20 : W + 20,
        speed: byDiff(d, 70, 130) * rng.float(0.85, 1.15),
        boss,
        suit: boss || rng.chance(decoySuit),
        tie: boss ? '#e2304a' : rng.pick(['#3b6fb6', '#3bb66a', '#b6973b', '#555a66']),
        shirt: rng.pick(SHIRTS),
        hair: boss ? '#9a9aa0' : d > 0.75 && rng.chance(0.4) ? '#9a9aa0' : rng.pick(HAIRS),
        skin: rng.pick(SKINS),
        active: false,
        gone: false,
        checked: false,
      });
      walkers[i].look = walkerLook(walkers[i], i);
      t0 += interval * rng.float(0.7, 1.3);
    }
    const lastCross = Math.max(...walkers.map((w) => w.spawn + (W + 40) / w.speed));
    const total = new Countdown(Math.min(60, lastCross + 1));
    let time = 0;
    let workT = 0;
    let dodged = 0;
    let caught = 0;
    let falseAlarms = 0;
    let anim = 0;
    const me = player || DEFAULT_PLAYER;
    // The scenery never changes: the hallway, the desk surface, the monitor frame, the legend. Your cubicle and screen have a work and a fun look.
    const scene = bake(W, H, (g) => {
      hallway(g);
      desktop(g);
      mugshot(g);
      panel(g, 346, 164, 120, 82, { title: 'STATUS' });
    });
    const deskLayers = [true, false].map((work) => bake(CUBICLE.w, CUBICLE.h, (g) => {
      g.translate(-CUBICLE.x, -CUBICLE.y);
      cubicle(g, me, !work);
    }));
    const screens = [true, false].map((work) => bake(SCREEN.w, SCREEN.h, (g) => (work ? drawWork : solitaire)(g, { x: 0, y: 0, w: SCREEN.w, h: SCREEN.h })));

    const score = () => clamp((dodged - 0.5 * falseAlarms) / bossCount, 0, 1);

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        time += dt;
        workT = Math.max(0, workT - dt);
        if (total.update(dt)) return finish(inst, score());
        for (const w of walkers) {
          if (!w.active && !w.gone && time >= w.spawn) w.active = true;
          if (!w.active) continue;
          const before = w.x;
          w.x += w.dir * w.speed * dt;
          if (w.boss && !w.checked && (before - DESK_X) * (w.x - DESK_X) <= 0) {
            w.checked = true;
            if (workT > 0) {
              dodged++;
              sfx('good');
              fl.add('Looking busy!', DESK_X, 60, C.good);
            } else {
              caught++;
              sfx('bad');
              shake.hit(0.4);
              fl.add('CAUGHT!', DESK_X, 60, C.bad);
            }
          }
          if (w.x < -30 || w.x > W + 30) {
            w.active = false;
            w.gone = true;
          }
        }
        if (input.confirm() || input.pointer.clicked) {
          const bossNear = walkers.some((w) => w.active && w.boss && !w.checked && Math.abs(w.x - DESK_X) < 150);
          if (!bossNear) {
            falseAlarms++;
            sfx('bad');
            fl.add('False alarm!', DESK_X, 150, C.warn);
          } else sfx('click');
          workT = workDur;
        }
        if (walkers.every((w) => w.gone)) finish(inst, score());
      },
      render(g) {
        g.save();
        shake.apply(g);
        g.drawImage(scene, 0, 0);
        // Walkers (behind the cubicle).
        for (const w of walkers) if (w.active) drawWalker(g, w, anim, Math.abs(w.x - DESK_X) < 45);
        const working = workT > 0;
        g.drawImage(deskLayers[working ? 0 : 1], CUBICLE.x, CUBICLE.y);
        header(g, theme?.title || 'Boss Alert', `Dodged ${dodged}/${bossCount}`);
        timerBar(g, total.left, total.total);
        // Your screen.
        g.drawImage(screens[working ? 0 : 1], SCREEN.x, SCREEN.y);
        if (!working) bounceCard(g, anim);
        drawText(g, `Caught: ${caught}`, 356, 184, { color: caught ? C.bad : C.text });
        drawText(g, `False alarms: ${falseAlarms}`, 356, 198, { color: falseAlarms ? C.warn : C.text });
        drawText(g, working ? 'Screen: WORK' : 'Screen: FUN', 356, 212, { color: working ? C.good : C.gold });
        drawText(g, 'SPACE = alt-tab', 356, 228, { color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};


/** The Elevator Pitch figure for a walker: the boss (grey hair, dark suit, white lapels, red tie), a decoy in a suit with another tie, or a colleague in a shirt (every third in a skirt). */
export function walkerLook(w, i) {
  if (w.suit) {
    const look = { skin: w.skin, hair: w.hair, top: '#22242e', pants: '#22242e', tie: w.tie, lapel: '#ffffff', collar: '#ffffff', long: false };
    return w.boss ? look : { ...look, top: '#2b3550', lapel: '#d8dfe8', collar: '#d8dfe8' };
  }
  const skirted = i % 3 === 1;
  // The approved art has the shirt over the skirt's top two rows (longTop).
  return { skin: w.skin, hair: w.hair, top: w.shirt, pants: '#3a3f55', skirt: skirted ? SKIRTS[Math.floor(i / 3) % SKIRTS.length] : null, longTop: skirted, collar: w.shirt, long: skirted };
}

/** A colleague (or the boss) walking by; turned to your desk (front view, standing) when near it, the boss with a "?" bubble. */
function drawWalker(g, w, t, looking) {
  const x = Math.round(w.x);
  rect(g, x - 10, FEET_Y - 1, 20, 1, 'rgba(0,0,0,0.25)');
  rect(g, x - 12, FEET_Y, 24, 1, 'rgba(0,0,0,0.25)');
  rect(g, x - 10, FEET_Y + 1, 20, 1, 'rgba(0,0,0,0.25)');
  const pose = looking ? 'stand' : (Math.floor(t * 6) + w.i) % 2 ? 'walkA' : 'walkB';
  person(g, x - 12, FEET_Y - 60, 2, w.look, { pose });
  if (looking && w.boss) {
    rect(g, x + 10, FEET_Y - 60, 14, 13, '#1a1a22');
    rect(g, x + 11, FEET_Y - 59, 12, 11, '#ffffff');
    rect(g, x + 13, FEET_Y - 48, 3, 3, '#ffffff');
    drawText(g, '?', x + 17, FEET_Y - 57, { align: 'center', color: '#e2304a' });
  }
}

// Scenery, drawn once into baked canvases. Flat bands and 2 px cells, no dither or 1 px noise.

/** The hallway: ceiling lights, pinstriped wall, chair rail, wainscot, carpet tiles; doors, a poster, a window, a water cooler, a clock and a plant. */
function hallway(g) {
  rect(g, 0, 0, W, 18, '#1a1d2e');
  rect(g, 0, 18, W, 8, '#d8dce4');
  for (let x = 30; x < W; x += 110) {
    rect(g, x, 20, 44, 4, '#ffffff');
    rect(g, x, 24, 44, 1, '#b8c0cc');
  }
  rect(g, 0, 26, W, 1, '#8a90a0');
  rect(g, 0, 27, W, 54, '#7a8098');
  for (let x = 0; x < W; x += 6) rect(g, x, 27, 1, 54, '#727890');
  for (let x = 30; x < W; x += 110) grad(g, x - 6, 27, 56, 24, ['#9aa0b8', '#7a8098']);
  rect(g, 0, 80, W, 3, '#8a6038');
  rect(g, 0, 80, W, 1, '#b8885a');
  rect(g, 0, 83, W, 17, '#5a6078');
  for (let x = 6; x < W; x += 40) frame(g, x, 86, 32, 11, '#4a5068');
  rect(g, 0, 100, W, 2, '#3a3d48');
  rect(g, 0, 102, W, 48, '#5a6050');
  for (let y = 102; y < 150; y += 12) for (let x = (y / 12) % 2 ? 0 : 12; x < W; x += 24) rect(g, x, y, 12, 12, '#545a4a');
  grains(g, 0, 102, W, 48, ['#646a58', '#4e5444'], 500, 13);
  // Doors with name plates.
  for (const [x, name] of [[18, 'HR'], [344, 'CEO']]) {
    rect(g, x - 3, 36, 40, 64, '#3d3a48');
    rect(g, x, 39, 34, 61, '#7a5232');
    rect(g, x + 3, 42, 28, 24, '#8a6040');
    rect(g, x + 3, 70, 28, 26, '#8a6040');
    rect(g, x + 28, 68, 3, 3, C.gold);
    rect(g, x + 7, 30, 20, 8, '#c8a040');
    drawText(g, name, x + 17, 30, { align: 'center', color: '#3a2a1a' });
  }
  // Motivational poster.
  rect(g, 84, 34, 44, 40, '#1a1a22');
  grad(g, 86, 36, 40, 28, ['#2a3a6a', '#6a7ab0', '#e8a070']);
  for (let k = 0; k < 14; k++) rect(g, 92 + k, 64 - k, 28 - k * 2, 1, '#3a3a4a');
  rect(g, 104, 50, 4, 2, '#ffffff');
  rect(g, 86, 64, 40, 8, '#1a1a22');
  drawText(g, 'SYNERGY', 106, 64, { align: 'center', color: '#f4f1e8' });
  // A window onto the city.
  rect(g, 150, 32, 76, 46, '#d8dce4');
  grad(g, 153, 35, 70, 40, ['#5a90c8', '#a8d0ec']);
  for (const [x, h] of [[156, 22], [168, 30], [182, 18], [192, 34], [206, 24], [214, 14]]) {
    rect(g, x, 75 - h, 10, h, '#6a7a90');
    for (let y = 75 - h + 3; y < 74; y += 4) rect(g, x + 2, y, 2, 2, '#c8d8e8'), rect(g, x + 6, y, 2, 2, '#c8d8e8');
  }
  rect(g, 187, 35, 2, 40, '#d8dce4');
  // Water cooler.
  rect(g, 268, 70, 22, 30, '#e8ecf0');
  rect(g, 268, 70, 22, 2, '#ffffff');
  rect(g, 272, 78, 4, 3, '#3a7ad1');
  rect(g, 282, 78, 4, 3, '#e2504a');
  shaded(g, 279, 58, 10, 13, '#8ac8f0', { rim: '#4a90c8', light: '#d0ecff' });
  rect(g, 276, 44, 6, 4, '#3a7ad1');
  // Clock and a tall plant.
  shaded(g, 420, 44, 9, 9, '#f4f1e8', { rim: '#3a3d48' });
  line(g, 420, 44, 420, 38, '#1a1a22');
  line(g, 420, 44, 424, 46, '#1a1a22');
  rect(g, 440, 84, 18, 16, '#b0603a');
  rect(g, 439, 84, 20, 3, '#c8784a');
  for (const [dx, dy, rx, ry] of [[-6, -14, 5, 10], [6, -18, 5, 12], [0, -28, 4, 10], [-8, -30, 4, 8], [8, -32, 4, 8]]) shaded(g, 449 + dx, 84 + dy, rx, ry, '#2f8a3a', { rim: '#1f5a26', light: '#4fba5a' });
}

/** The desk in front of you with your monitor's frame. */
function desktop(g) {
  rect(g, 0, 150, W, H - 150, '#5a4030');
  for (let y = 154; y < H; y += 9) rect(g, 0, y, W, 1, 'rgba(0,0,0,0.12)');
  rect(g, 0, 150, W, 2, 'rgba(255,255,255,0.15)');
  monitor(g, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, '#000');
}

/** The legend: the boss on a height chart, cropped to the panel. */
function mugshot(g) {
  panel(g, 14, 164, 120, 82, { title: 'THE BOSS' });
  rect(g, 20, 179, 108, 50, '#c8ccd4');
  for (let y = 181; y < 229; y += 6) rect(g, 20, y, 108, 1, '#a8acb4');
  drawText(g, '6ft', 24, 181, { color: '#6a6e78' });
  g.save();
  g.beginPath();
  g.rect(20, 179, 108, 50);
  g.clip();
  person(g, 74 - 18, 274 - 90, 3, { skin: '#f2c9a0', hair: '#9a9aa0', top: '#22242e', pants: '#22242e', tie: '#e2304a', lapel: '#ffffff', collar: '#ffffff', long: false }, { pose: 'stand' });
  g.restore();
  drawText(g, 'red tie, grey hair', 74, 232, { align: 'center', color: C.gold });
}

/** Your cubicle seen over your shoulder: partitions with notes, the desk, your monitor (a mirror stuck on it) and you from behind. */
function cubicle(g, me, fun) {
  for (const [x0, w] of [[150, 46], [286, 46]]) {
    rect(g, x0, 112, w, 38, '#6d7486');
    grains(g, x0, 114, w, 36, ['#7d8496', '#5d6476'], 200, x0);
    rect(g, x0, 110, w, 3, '#c4c8d0');
    rect(g, x0, 113, w, 1, '#8a8e98');
  }
  rect(g, 158, 118, 10, 10, '#f2e27a');
  rect(g, 172, 122, 12, 9, '#f4f1e8');
  rect(g, 173, 123, 10, 5, '#7ab0d8');
  rect(g, 312, 118, 12, 10, '#f2a0c0');
  rect(g, 196, 120, 90, 30, '#8a6a4a');
  rect(g, 196, 120, 90, 2, '#a88660');
  rect(g, 270, 112, 8, 9, '#f4f1e8');
  rect(g, 270, 112, 8, 2, '#3a2a1a');
  // Monitor: its screen faces you; in the mirror on its corner, a red tie.
  rect(g, 232, 92, 46, 30, '#1a1a22');
  rect(g, 234, 94, 42, 25, fun ? '#2f7a3a' : '#e9eef5');
  if (fun) for (let i = 0; i < 6; i++) rect(g, 236 + i * 7, 97, 5, 7, '#ffffff');
  else for (let r = 0; r < 4; r++) rect(g, 236, 97 + r * 5, 38, 1, '#c8cfdc');
  glow(g, 255, 106, 26, fun ? '#6aff8a' : '#c8e0ff', 0.25);
  rect(g, 251, 122, 8, 4, '#2b2e38');
  rect(g, 226, 88, 12, 8, '#1a1a22');
  rect(g, 227, 89, 10, 6, '#a8c0d8');
  rect(g, 228, 90, 3, 2, '#e2304a');
  // You: chair back, shoulders, the back of your head with headphones.
  rect(g, 226, 128, 40, 22, '#1a1a22');
  grains(g, 228, 130, 36, 20, ['#2a2a32'], 60, 4);
  rect(g, 224, 124, 44, 6, '#2a2a32');
  rect(g, 222, 118, 48, 12, me.top);
  rect(g, 222, 118, 48, 2, shade(me.top, 0.2));
  rect(g, 241, 112, 10, 8, me.skin);
  if (me.long) rect(g, 236, 108, 20, 14, me.hair);
  shaded(g, 246, 106, 10, 11, me.hair);
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.08) rect(g, Math.round(246 + Math.cos(a) * 12), Math.round(106 + Math.sin(a) * 12), 2, 2, '#3a3d48');
  rect(g, 233, 103, 4, 8, '#e2504a');
  rect(g, 255, 103, 4, 8, '#e2504a');
}

/** A Solitaire window: title bar, green felt, the stock, foundations and seven tableau columns. */
function solitaire(g, s) {
  rect(g, s.x, s.y, s.w, s.h, '#1e5a2a');
  grains(g, s.x, s.y + 10, s.w, s.h - 10, ['#246a32', '#1a4e24'], 300, 2);
  windowBar(g, s, '#1f70c1', 'Solitaire Pro');
  const card = (x, y, up, suit, rank) => {
    rect(g, x, y, 16, 21, '#1a1a22');
    rect(g, x + 1, y + 1, 14, 19, up ? '#ffffff' : '#3b6fb6');
    if (!up) {
      for (let k = 0; k < 6; k++) rect(g, x + 2 + ((k * 3) % 11), y + 3 + k * 3, 2, 2, '#7fb4ea');
      return;
    }
    const red = suit === 'h' || suit === 'd';
    drawText(g, rank, x + 2, y + 1, { color: red ? '#e2304a' : '#1a1a22' });
    const SUITS = { h: '.r.r.|rrrrr|.rrr.|..r..', d: '..r..|.rrr.|rrrrr|.rrr.|..r..', s: '..r..|.rrr.|rrrrr|..r..|.rrr.', c: '.rrr.|.rrr.|rrrrr|..r..|.rrr.' };
    sprite(g, SUITS[suit], { r: red ? '#e2304a' : '#1a1a22' }, x + 5, y + 11, 1);
  };
  for (let i = 0; i < 4; i++) card(s.x + 66 + i * 22, s.y + 12, i < 2, ['h', 's'][i % 2], ['A', '2'][i]);
  card(s.x + 4, s.y + 12, false);
  card(s.x + 24, s.y + 12, true, 'd', '7');
  const ranks = ['K', 'Q', 'J', '10', '9', '8', '5'];
  for (let col = 0; col < 7; col++) {
    const x = s.x + 4 + col * 22;
    for (let k = 0; k < Math.min(col, 3); k++) card(x, s.y + 36 + k * 4, false);
    card(x, s.y + 36 + Math.min(col, 3) * 4, true, ['s', 'h', 'c', 'd'][col % 4], ranks[col]);
  }
}

/** The title bar of a window on your screen: a colour, a name and three buttons. */
function windowBar(g, s, color, name) {
  rect(g, s.x, s.y, s.w, 9, color);
  drawText(g, name, s.x + 3, s.y, { color: '#ffffff' });
  for (const [k, c] of [[0, '#e2504a'], [1, '#f2c14e'], [2, '#5fd068']]) rect(g, s.x + s.w - 8 - k * 7, s.y + 2, 5, 5, c);
}

/** The work spreadsheet you alt-tab to. */
function drawWork(g, s) {
  rect(g, s.x, s.y, s.w, s.h, '#ffffff');
  windowBar(g, s, '#1f7a44', 'Q3_FINAL_v7.xlsx');
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      frame(g, s.x + 2 + c * 39, s.y + 13 + r * 10, 40, 11, '#c8cfdc');
      drawText(g, String((r * 37 + c * 53) % 900 + 100), s.x + 6 + c * 39, s.y + 15 + r * 10, { color: '#2a2a35' });
    }
  }
}

/** The Solitaire win cascade: a card bouncing across the felt. */
function bounceCard(g, t) {
  const x = Math.round(SCREEN.x + 20 + ((t * 60) % (SCREEN.w - 40)));
  const y = Math.round(SCREEN.y + 63 - Math.abs(Math.sin(t * 5)) * 18);
  rect(g, x, y, 16, 21, '#1a1a22');
  rect(g, x + 1, y + 1, 14, 19, '#ffffff');
  rect(g, x + 5, y + 8, 6, 6, '#e2304a');
}
