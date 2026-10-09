// Boss Alert: alt-tab to your spreadsheet just before the boss walks past your cubicle, but don't panic for colleagues.
import { W, H, C, rect, frame, panel, drawText, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';

const DESK_X = 240;
const FEET_Y = 104;
const SHIRTS = ['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#c86a9a', '#4a9aa0'];
const HAIRS = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#1a1a1a'];
const SKINS = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];

export default {
  id: 'stealth',
  name: 'Boss Alert',
  help: 'Press SPACE (or click) to alt-tab right before the BOSS (red tie) passes your desk. False alarms cost you.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
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
        // Hallway.
        rect(g, 0, 0, W, H, '#2a2f45');
        rect(g, 0, 18, W, 82, '#5a6078');
        for (let x = 20; x < W; x += 110) {
          rect(g, x, 36, 30, 64, '#3d3a48');
          rect(g, x + 2, 38, 26, 62, '#6b4a32');
          rect(g, x + 22, 68, 3, 3, C.gold);
          rect(g, x + 50, 34, 40, 26, '#8ab4ff');
          frame(g, x + 50, 34, 40, 26, '#3d4150');
        }
        rect(g, 0, 100, W, 50, '#6a6f5a');
        for (let x = 0; x < W; x += 16) rect(g, x, 100, 1, 50, 'rgba(0,0,0,0.08)');
        // Walkers (behind the cubicle).
        for (const w of walkers) if (w.active) drawWalker(g, w, anim, Math.abs(w.x - DESK_X) < 45);
        // Cubicle with the player seen from behind.
        rect(g, DESK_X - 40, 112, 80, 38, '#8a8f9e');
        rect(g, DESK_X - 40, 112, 80, 3, '#b0b5c4');
        rect(g, DESK_X - 12, 104, 24, 14, '#2b2e38');
        rect(g, DESK_X - 10, 106, 20, 10, workT > 0 ? '#e9eef5' : '#3a8a4a');
        rect(g, DESK_X - 7, 116, 14, 12, C.accent);
        rect(g, DESK_X - 5, 108, 10, 9, '#2b1d14');
        drawText(g, 'YOU', DESK_X, 132, { align: 'center', color: C.ink });
        header(g, theme?.title || 'Boss Alert', `Dodged ${dodged}/${bossCount}`);
        timerBar(g, total.left, total.total);
        // Your screen inset.
        rect(g, 0, 150, W, H - 150, '#3a3020');
        rect(g, 0, 150, W, 2, 'rgba(255,255,255,0.15)');
        const s = monitor(g, 160, 162, 160, 84, '#000');
        if (workT > 0) drawWork(g, s);
        else drawFun(g, s, anim);
        // Legend.
        panel(g, 14, 164, 120, 82, { title: 'THE BOSS' });
        drawWalker(g, { x: 74, dir: 1, suit: true, boss: true, tie: '#e2304a', hair: '#9a9aa0', skin: '#f2c9a0', shirt: '#fff' }, 0, false, 236);
        drawText(g, 'red tie', 74, 182, { align: 'center', color: C.gold });
        panel(g, 346, 164, 120, 82, { title: 'STATUS' });
        drawText(g, `Caught: ${caught}`, 356, 184, { color: caught ? C.bad : C.text });
        drawText(g, `False alarms: ${falseAlarms}`, 356, 198, { color: falseAlarms ? C.warn : C.text });
        drawText(g, workT > 0 ? 'Screen: WORK' : 'Screen: FUN', 356, 212, { color: workT > 0 ? C.good : C.gold });
        drawText(g, 'SPACE = alt-tab', 356, 228, { color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};

function drawWalker(g, w, t, looking, feet = FEET_Y) {
  const x = Math.round(w.x);
  const tall = w.boss ? 3 : 0;
  const step = Math.floor(t * 8 + x) % 2;
  const top = feet - 34 - tall;
  rect(g, x - 5, feet - 10, 4, 10 - step * 2, '#2b2e38');
  rect(g, x + 1, feet - 10, 4, 8 + step * 2, '#2b2e38');
  rect(g, x - 7, top + 10, 14, 15 + tall, w.suit ? '#22252e' : w.shirt);
  if (w.suit) {
    rect(g, x - 2, top + 10, 4, 8, '#ffffff');
    rect(g, x - 1, top + 11, 2, 9, w.tie);
  }
  rect(g, x - 4, top, 8, 10, w.skin);
  rect(g, x - 4, top - 1, 8, 3, w.hair);
  if (looking) {
    // Turned toward your desk: both eyes visible, plus a "?" bubble for the boss.
    rect(g, x - 3, top + 4, 1, 1, '#111');
    rect(g, x + 2, top + 4, 1, 1, '#111');
    if (w.boss) {
      rect(g, x - 3, top + 2, 2, 1, '#111');
      rect(g, x + 1, top + 2, 2, 1, '#111');
      rect(g, x + 6, top - 14, 12, 11, '#ffffff');
      drawText(g, '?', x + 12, top - 12, { align: 'center', color: '#e2304a' });
    }
  } else {
    rect(g, x + (w.dir > 0 ? 2 : -3), top + 4, 1, 1, '#111');
  }
}

function drawFun(g, s, t) {
  rect(g, s.x, s.y, s.w, s.h, '#2f7a3a');
  drawText(g, 'SOLITAIRE PRO', s.x + 4, s.y + 3, { color: '#d8f0d0' });
  for (let i = 0; i < 6; i++) {
    const cx = s.x + 8 + i * 25;
    rect(g, cx, s.y + 16, 18, 24, '#ffffff');
    frame(g, cx, s.y + 16, 18, 24, '#222');
    drawText(g, 'A23456'[i], cx + 3, s.y + 18, { color: i % 2 ? '#e2304a' : '#222' });
  }
  const bx = s.x + 20 + ((t * 60) % (s.w - 40));
  const by = s.y + 48 + Math.abs(Math.sin(t * 5)) * -18 + 18;
  rect(g, bx, by, 14, 18, '#ffffff');
  frame(g, bx, by, 14, 18, '#222');
}

function drawWork(g, s) {
  rect(g, s.x, s.y, s.w, s.h, '#ffffff');
  rect(g, s.x, s.y, s.w, 10, '#1f7a44');
  drawText(g, 'Q3_FINAL_v7.xlsx', s.x + 3, s.y + 1, { color: '#fff' });
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      frame(g, s.x + 2 + c * 39, s.y + 13 + r * 10, 40, 11, '#c8cfdc');
      drawText(g, String((r * 37 + c * 53) % 900 + 100), s.x + 6 + c * 39, s.y + 15 + r * 10, { color: '#2a2a35' });
    }
  }
}
