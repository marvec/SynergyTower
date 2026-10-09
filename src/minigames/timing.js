// Perfect Timing: first mash to fill a draining bar (smash the printer!), then stop the swinging needle in the green zone.
// The mash phase is adapted from Printer Jam in ../corporate. Themed as printer jam, deal closing, deploys…
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, face, Floaters, Shake, Countdown, byDiff, finish } from '../engine/mgkit.js';

const THEMES = {
  default: { art: 'printer', verb: 'UNJAM', hit: 'Paper free!', miss: 'Still jammed...',
    mash: 'SMASH THE PRINTER!', mashed: 'Unjammed! Now align the paper.', hint: 'Percussive maintenance is a valid IT strategy.', smacks: ['BONK!', 'WHAM!', 'THUNK!', 'KA-CHUNK!'] },
  sales: { art: 'deal', verb: 'CLOSE', hit: 'Deal closed!', miss: 'They walked away',
    mash: 'PUMP UP THE PITCH!', mashed: 'Client is hooked! Now close it.', hint: 'Enthusiasm is a strategy too.', smacks: ['SYNERGY!', 'ROI!', 'WIN-WIN!', 'BOOM!'] },
  it: { art: 'deploy', verb: 'DEPLOY', hit: 'Shipped!', miss: 'Rollback!',
    mash: 'MASH TO COMPILE!', mashed: 'Build passed! Now hit the window.', hint: 'Faster typing = faster compiling. Science.', smacks: ['clack', 'CLACK!', 'tap', 'TAP!'] },
  finance: { art: 'bell', verb: 'RING', hit: 'Ding ding!', miss: 'Off-beat!',
    mash: 'CRANK THE TICKER!', mashed: 'Markets warming up! Now ring it.', hint: 'Line goes up if you crank hard enough.', smacks: ['CHING!', 'tick', 'TICK!', '$$$'] },
  marketing: { art: 'camera', verb: 'SNAP', hit: 'Perfect shot!', miss: 'Blurry...',
    mash: 'CHARGE THE FLASH!', mashed: 'Flash charged! Now snap it.', hint: 'More flash, more brand.', smacks: ['zzt', 'ZZT!', 'whirr', 'WHIRR!'] },
  exec: { art: 'sign', verb: 'SIGN', hit: 'Signed!', miss: 'Ink blot!',
    mash: 'SHAKE THE PEN!', mashed: 'Ink is flowing! Now sign it.', hint: 'A 400 EUR pen and it still will not write.', smacks: ['shake', 'SHAKE!', 'splat', 'CLICK!'] },
};

const BAR = { x: 60, y: 176, w: 360, h: 18 };

export default {
  id: 'timing',
  name: 'Perfect Timing',
  help: 'First MASH Space (or click) to fill the bar, then press it when the needle is in the green zone. Yellow = half.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const th = THEMES[theme?.dept] || THEMES.default;
    const rounds = Math.round(byDiff(d, 4, 7));
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(byDiff(d, 70, 62));
    // Mash phase: each press fills, the bar drains constantly. Par time = how fast a good masher finishes.
    // At ~7 presses/s: easy fills in ~2.4 s, hard in ~5 s.
    const perPress = byDiff(d, 0.09, 0.07);
    const drain = byDiff(d, 0.12, 0.28);
    const mashPar = byDiff(d, 3, 5);
    let fill = 0;
    let mashT = 0;
    let mashScore = 0;
    let bonk = 0; // art jolt after each press
    const results = [];
    let r = 0;
    let p = 0;
    let dir = 1;
    let speed = 0;
    let zc = 0.5;
    let zw = 0.2;
    let zv = 0;
    let roundT = 0;
    let phase = 'mash';
    let phaseT = 0;
    let anim = 0; // art animation clock

    function newRound() {
      speed = byDiff(d, 0.5, 1.1) * (1 + 0.05 * r);
      zw = Math.max(byDiff(d, 0.24, 0.12) * (1 - 0.05 * r), speed * 0.075);
      zc = rng.float(0.15 + zw / 2, 0.85 - zw / 2);
      zv = d > 0.45 ? rng.float(0.05, 0.12 + d * 0.15) * (rng.chance(0.5) ? 1 : -1) : 0;
      p = rng.chance(0.5) ? 0 : 1;
      dir = p === 0 ? 1 : -1;
      roundT = 0;
      phase = 'aim';
    }

    const sum = () => results.reduce((a, b) => a + b, 0);
    // 20% for mashing quickly, 80% for the needle rounds.
    const finalScore = () => 0.2 * mashScore + 0.8 * (sum() / rounds);

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        bonk = Math.max(0, bonk - dt * 6);
        if (total.update(dt)) return finish(inst, phase === 'mash' ? 0.2 * fill * 0.5 : finalScore());
        if (phase === 'mash') {
          mashT += dt;
          fill = Math.max(0, fill - drain * dt);
          if (input.confirm() || input.pointer.clicked) {
            fill = Math.min(1, fill + perPress);
            bonk = 1;
            sfx('click');
            if (rng.chance(0.35)) fl.add(rng.pick(th.smacks), 240 + rng.float(-70, 70), rng.float(70, 110), C.gold);
          }
          if (fill >= 1) {
            mashScore = Math.max(0.3, Math.min(1, 1 - Math.max(0, mashT - mashPar) / (mashPar * 2)));
            sfx('good');
            fl.add(th.mashed, W / 2, 150, C.good);
            newRound();
            phase = 'result'; // short breather before the first needle round
            phaseT = 1.2;
            r = -1;
            anim = 0;
          }
          return;
        }
        if (phase === 'aim') {
          p += dir * speed * dt;
          if (p > 1) (p = 2 - p), (dir = -1);
          if (p < 0) (p = -p), (dir = 1);
          if (zv) {
            zc += zv * dt;
            if (zc > 0.92 - zw / 2 || zc < 0.08 + zw / 2) zv = -zv;
          }
          roundT += dt;
          // Grace period: a player still mashing from the warm-up must not fire the needle by accident.
          const press = roundT > 0.35 && (input.confirm() || input.pointer.clicked);
          if (press || roundT > 6) {
            const dist = Math.abs(p - zc);
            let v = 0;
            if (press && dist <= zw / 2) v = 1;
            else if (press && dist <= zw) v = 0.5;
            results.push(v);
            if (v === 1) {
              sfx('good');
              fl.add(dist <= zw / 6 ? 'PERFECT!' : th.hit, W / 2, 150, C.good);
            } else if (v === 0.5) {
              sfx('blip');
              fl.add('Close enough', W / 2, 150, C.gold);
            } else {
              sfx('bad');
              shake.hit();
              fl.add(press ? th.miss : 'Too slow!', W / 2, 150, C.bad);
            }
            phase = 'result';
            phaseT = 0.8;
            anim = 0;
          }
        } else {
          phaseT -= dt;
          if (phaseT <= 0) {
            r++;
            if (r >= rounds) return finish(inst, finalScore());
            newRound();
          }
        }
      },
      renderMash(g) {
        panel(g, BAR.x - 6, BAR.y - 6, BAR.w + 12, BAR.h + 12, { fill: C.panelDark });
        rect(g, BAR.x, BAR.y, BAR.w, BAR.h, '#2a2f45');
        const col = fill > 0.75 ? C.good : fill > 0.4 ? C.gold : C.warn;
        rect(g, BAR.x, BAR.y, BAR.w * fill, BAR.h, col);
        rect(g, BAR.x, BAR.y, BAR.w * fill, 2, 'rgba(255,255,255,0.4)');
        const pulse = Math.floor(anim * 6) % 2 === 0;
        drawText(g, th.mash, W / 2, 150, { align: 'center', scale: 2, color: pulse ? C.gold : '#ffffff', shadow: C.border });
        drawText(g, 'Mash SPACE or click as fast as you can!', W / 2, 202, { align: 'center', color: C.text, shadow: C.border });
        drawText(g, th.hint, W / 2, 216, { align: 'center', color: C.dim });
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        header(g, theme?.title || 'Perfect Timing', phase === 'mash' ? 'Warm-up' : `Round ${Math.max(1, Math.min(r + 1, rounds))}/${rounds}`);
        timerBar(g, total.left, total.total);
        const last = results[results.length - 1];
        const state = phase === 'result' && r >= 0 ? (last === 1 ? 'hit' : last === 0.5 ? 'half' : 'miss') : r < 0 && phase === 'result' ? 'hit' : 'idle';
        g.save();
        if (bonk > 0) g.translate(Math.round(Math.sin(anim * 90) * 4 * bonk), Math.round(bonk * 3));
        ART[th.art](g, state, anim);
        g.restore();
        if (phase === 'mash') {
          this.renderMash(g);
          fl.render(g);
          g.restore();
          return;
        }
        // Bar.
        panel(g, BAR.x - 6, BAR.y - 6, BAR.w + 12, BAR.h + 12, { fill: C.panelDark });
        rect(g, BAR.x, BAR.y, BAR.w, BAR.h, '#4a2a2a');
        const yz0 = BAR.x + (zc - zw) * BAR.w;
        rect(g, Math.max(BAR.x, yz0), BAR.y, Math.min(BAR.w * zw * 2, BAR.x + BAR.w - Math.max(BAR.x, yz0)), BAR.h, '#b8962e');
        rect(g, BAR.x + (zc - zw / 2) * BAR.w, BAR.y, BAR.w * zw, BAR.h, '#3fae4f');
        rect(g, BAR.x + (zc - zw / 2) * BAR.w, BAR.y, BAR.w * zw, 2, '#8ff09a');
        for (let i = 1; i < 10; i++) rect(g, BAR.x + (BAR.w * i) / 10, BAR.y + BAR.h - 4, 1, 4, 'rgba(0,0,0,0.4)');
        const nx = Math.round(BAR.x + p * BAR.w);
        rect(g, nx - 1, BAR.y - 5, 3, BAR.h + 10, C.border);
        rect(g, nx, BAR.y - 4, 1, BAR.h + 8, '#ffffff');
        rect(g, nx - 3, BAR.y - 7, 7, 3, '#ffffff');
        frame(g, nx - 3, BAR.y - 7, 7, 3, C.border);
        drawText(g, `SPACE / click to ${th.verb}`, W / 2, 206, { align: 'center', color: C.text, shadow: C.border });
        // Round dots.
        for (let i = 0; i < rounds; i++) {
          const x = W / 2 - rounds * 7 + i * 14 + 2;
          const v = results[i];
          rect(g, x, 222, 10, 10, C.border);
          rect(g, x + 1, 223, 8, 8, v === undefined ? (i === r ? C.panelLight : C.panel) : v === 1 ? C.good : v === 0.5 ? C.gold : C.bad);
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};

// --- Illustrations. Each draws centred around x=240, y=30..150.
const ART = {
  printer(g, state, t) {
    const x = 180;
    const y = 70;
    // paper tray
    rect(g, x + 20, y - 18, 80, 20, '#d9d4c4');
    rect(g, x + 26, y - 26, 68, 10, '#f4f1e8');
    // body
    rect(g, x - 1, y - 1, 122, 62, C.border);
    rect(g, x, y, 120, 60, '#b9bcc6');
    rect(g, x, y, 120, 3, '#d8dbe3');
    rect(g, x + 8, y + 10, 70, 8, '#3a3d48');
    rect(g, x + 86, y + 8, 26, 14, '#2b2e38');
    const blink = state === 'miss' || (state === 'idle' && Math.floor(t * 4) % 2 === 0);
    rect(g, x + 90, y + 12, 6, 6, state === 'hit' ? '#5fd068' : blink ? '#e2504a' : '#5a2a2a');
    drawText(g, state === 'hit' ? 'OK' : 'JAM', x + 99, y + 12, { color: state === 'hit' ? '#5fd068' : '#e2504a' });
    rect(g, x + 10, y + 34, 100, 6, '#2b2e38');
    // paper
    if (state === 'hit') {
      const k = Math.min(1, t * 2.5);
      rect(g, x + 30 + k * 60, y + 30 - k * 60, 50, 34, '#ffffff');
      for (let i = 0; i < 4; i++) rect(g, x + 34 + k * 60, y + 36 - k * 60 + i * 6, 38, 1, '#9aa0b0');
    } else {
      const jig = state === 'idle' ? Math.round(Math.sin(t * 20)) : 0;
      rect(g, x + 32 + jig, y + 36, 56, 22, '#ffffff');
      rect(g, x + 40 + jig, y + 44, 30, 1, '#9aa0b0');
      rect(g, x + 50 + jig, y + 50, 20, 3, '#c8c0a8');
      if (state === 'miss') {
        for (let i = 0; i < 3; i++) {
          const k = (t * 1.5 + i * 0.33) % 1;
          g.globalAlpha = 1 - k;
          rect(g, x + 100 + i * 6, y - 10 - k * 30, 8, 8, '#8a8a8a');
          g.globalAlpha = 1;
        }
      }
    }
  },
  deal(g, state, t) {
    face(g, 120, 58, 37, 3);
    face(g, 324, 58, 90, 3);
    rect(g, 150, 110, 180, 10, '#5a3e2a');
    rect(g, 205, 92, 70, 20, '#ffffff');
    rect(g, 212, 98, 40, 1, '#9aa0b0');
    rect(g, 212, 104, 30, 1, '#9aa0b0');
    const k = state === 'hit' ? 1 : state === 'miss' ? -0.6 : 0.25 + Math.sin(t * 3) * 0.1;
    const lx = 168 + k * 50;
    const rx = 312 - k * 50;
    rect(g, 156, 82, lx - 156, 8, '#3b6fb6');
    rect(g, lx, 80, 12, 12, '#f2c9a0');
    rect(g, rx, 82, 324 - rx, 8, '#b6973b');
    rect(g, rx - 12, 80, 12, 12, '#d9a273');
    if (state === 'hit') {
      drawText(g, '$ $ $', 240, 50 - t * 10, { align: 'center', color: C.gold, scale: 2, shadow: C.border });
    }
  },
  deploy(g, state, t) {
    rect(g, 150, 30, 180, 108, C.border);
    rect(g, 152, 32, 176, 104, '#101418');
    const lines = ['$ git push prod', '> building...', '> running tests...', '> waiting for window'];
    lines.forEach((l, i) => drawText(g, l, 158, 38 + i * 11, { color: '#5fd068' }));
    if (state === 'hit') {
      rect(g, 160, 96, 160, 30, '#2f6b3a');
      drawText(g, 'DEPLOYED v2.0', 240, 106, { align: 'center', color: '#fff' });
      drawText(g, '^', 240 + Math.sin(t * 20) * 2, 82 - t * 40, { align: 'center', color: C.gold, scale: 2 });
    } else if (state === 'miss') {
      rect(g, 160, 96, 160, 30, '#7a2b2b');
      drawText(g, 'ROLLBACK!', 240, 106, { align: 'center', color: '#fff' });
    } else {
      drawText(g, Math.floor(t * 2) % 2 ? '_' : '', 158, 82, { color: '#5fd068' });
    }
  },
  bell(g, state, t) {
    rect(g, 236, 30, 8, 12, '#5a3e2a');
    const swing = state === 'hit' ? Math.sin(t * 25) * 6 * Math.max(0, 1 - t) : state === 'idle' ? Math.sin(t * 2) * 1 : 0;
    const x = 240 + swing;
    rect(g, x - 18, 42, 36, 10, '#c9962a');
    rect(g, x - 26, 52, 52, 30, '#e8b84a');
    rect(g, x - 32, 82, 64, 8, '#c9962a');
    rect(g, x - 20, 54, 6, 24, '#f7dd8a');
    rect(g, x - 5, 90, 10, 8, '#7a5c00');
    if (state === 'hit') {
      for (let i = 0; i < 3; i++) {
        rect(g, x - 50 - i * 8, 50 + i * 12, 10, 2, C.gold);
        rect(g, x + 40 + i * 8, 50 + i * 12, 10, 2, C.gold);
      }
    }
    drawText(g, 'MARKET OPEN', 240, 110, { align: 'center', color: state === 'hit' ? C.good : C.dim });
  },
  camera(g, state, t) {
    // product on pedestal
    rect(g, 300, 110, 50, 30, '#d9d4c4');
    rect(g, 310, 86, 30, 24, '#e2504a');
    rect(g, 316, 92, 18, 6, '#ffffff');
    // camera
    rect(g, 140, 70, 90, 54, C.border);
    rect(g, 141, 71, 88, 52, '#2b2e38');
    rect(g, 150, 62, 24, 10, '#2b2e38');
    rect(g, 175, 80, 36, 36, '#111');
    rect(g, 181, 86, 24, 24, '#3a5a8a');
    rect(g, 185, 90, 6, 6, '#9ac0f0');
    rect(g, 210, 74, 12, 6, '#e8e8f0');
    if (state === 'hit' && t < 0.25) {
      g.globalAlpha = 1 - t * 4;
      rect(g, 0, 18, W, 150, '#ffffff');
      g.globalAlpha = 1;
    }
    if (state === 'miss') drawText(g, '~blur~', 325, 70, { align: 'center', color: C.bad });
  },
  sign(g, state, t) {
    rect(g, 162, 34, 160, 110, 'rgba(0,0,0,0.3)');
    rect(g, 158, 30, 160, 110, C.paper);
    drawText(g, 'MERGER AGREEMENT', 238, 38, { align: 'center', color: C.ink });
    for (let i = 0; i < 5; i++) rect(g, 170, 54 + i * 9, 136, 1, '#b8b09a');
    rect(g, 190, 122, 100, 1, C.ink);
    drawText(g, 'x', 180, 115, { color: C.ink });
    if (state === 'hit') {
      const n = Math.min(40, Math.floor(t * 120));
      for (let i = 0; i < n; i++) rect(g, 196 + i * 2, 114 + Math.round(Math.sin(i * 0.9) * 4), 2, 2, '#1d2f6f');
    } else if (state === 'miss') {
      rect(g, 220, 106, 22, 16, '#1d2f6f');
      rect(g, 216, 110, 30, 8, '#1d2f6f');
    }
  },
};
