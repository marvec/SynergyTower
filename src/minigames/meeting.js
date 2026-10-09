// Meeting Survival: stay awake through the boss's monologue (sip coffee, but don't get the jitters) and nod
// exactly when a buzzword sentence is said. Nodding at "Can everyone see my screen?" is a career-limiting move.
import { W, H, C, rect, panel, drawText, drawWrapped, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { BUZZ, FILLER, BOSS, BOARD, GOOD_NOD, BAD_NOD, ASLEEP } from '../data/mg-meeting.js';

const AWAKE_AT = 0.3; // eyelid level that still counts as "awake"
const GRACE = 0.35; // seconds after a line ends that a late nod still counts
const NOD_BTN = { x: 16, y: 212, w: 100, h: 30 };
const MUG = { x: 372, y: 206, w: 96, h: 42 };
const inBox = (p, b) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

export default {
  id: 'meeting',
  name: 'Meeting Survival',
  help: 'Stay awake: SPACE or click the mug to sip (not too often!). Nod with N / Up / NOD button ONLY at buzzwords.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(byDiff(d, 35, 45));
    const drain = byDiff(d, 0.055, 0.085);
    const sipGain = 0.27;
    const baseLife = byDiff(d, 1.6, 1.0);
    const bossName = BOSS[theme?.dept] || 'The Boss';
    const board = BOARD[theme?.dept] || ['SYNERGY', 'Q4 GOALS'];
    const buzzDeck = rng.shuffle(BUZZ);
    const fillDeck = rng.shuffle(FILLER);
    let bi = 0;
    let fi = 0;

    let eyes = 0.85;
    let jitter = 0;
    let jitters = 0; // > 0 while shaking
    let asleep = 0; // > 0 while snoring
    let sleeps = 0;
    let awakeTime = 0;
    let elapsed = 0;
    let buzzTotal = 0;
    let correct = 0;
    let wrong = 0;
    let line = null; // { text, buzz, life, age, nodded }
    let last = null; // previous line, for the late-nod grace window
    let lastEnd = -9;
    let gap = 1.0;
    let runBuzz = 0;
    let runFill = 0;
    let bossSays = null; // interjection { text, t }
    let nodAnim = 0;
    let sipAnim = 0;
    let anim = 0;

    const nextLine = () => {
      let buzz = rng.chance(0.5);
      if (runBuzz >= 3) buzz = false;
      if (runFill >= 3) buzz = true;
      runBuzz = buzz ? runBuzz + 1 : 0;
      runFill = buzz ? 0 : runFill + 1;
      const text = buzz ? buzzDeck[bi++ % buzzDeck.length] : fillDeck[fi++ % fillDeck.length];
      if (buzz) buzzTotal++;
      line = { text, buzz, life: baseLife + Math.min(0.9, text.length * 0.016), age: 0, nodded: 0 };
    };

    const score = () => {
      const acc = buzzTotal ? clamp((correct - 0.75 * wrong) / buzzTotal, 0, 1) : 0;
      const awake = elapsed ? awakeTime / elapsed : 0;
      // Being awake but never nodding right is only worth half: you have to look engaged.
      return 0.6 * acc + 0.4 * awake * (0.5 + 0.5 * Math.min(1, acc * 2)) - 0.15 * sleeps;
    };

    function nod() {
      nodAnim = 0.3;
      if (jitters > 0) {
        fl.add('Too twitchy!', 210, 150, C.warn);
        sfx('click');
        return;
      }
      let target = line;
      if ((!target || (!target.buzz && target.age < 0.25)) && last && last.buzz && !last.nodded && elapsed - lastEnd < GRACE) target = last;
      if (target && target.buzz && !target.nodded) {
        target.nodded = 1;
        correct++;
        sfx('good');
        fl.add(rng.pick(GOOD_NOD), 210, 150, C.good);
        return;
      }
      if (target && target.buzz && target.nodded) {
        target.nodded++;
        if (target.nodded <= 2) return; // one bonus bob is harmless
      }
      wrong++;
      sfx('bad');
      shake.hit(0.25);
      const txt = target && target.buzz ? 'Okay, we get it.' : rng.pick(BAD_NOD);
      bossSays = { text: txt, t: 1.3 };
      fl.add('-nod', 210, 150, C.bad);
    }

    function sip() {
      sipAnim = 0.4;
      if (jitters > 0) {
        fl.add('Hands shaking!', MUG.x + MUG.w / 2, MUG.y - 6, C.warn);
        sfx('click');
        return;
      }
      eyes = clamp(eyes + sipGain * (1 - 0.8 * jitter), 0, 1);
      jitter += 0.24;
      sfx('blip');
      if (jitter >= 1) {
        jitter = 1;
        jitters = byDiff(d, 3, 4);
        sfx('bad');
        shake.hit(0.4);
        fl.add('JITTERS!', W / 2, 120, C.bad);
      } else fl.add(jitter > 0.6 ? 'slurp...?' : 'slurp', MUG.x + MUG.w / 2, MUG.y - 6, jitter > 0.6 ? C.warn : C.coffee);
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        nodAnim = Math.max(0, nodAnim - dt);
        sipAnim = Math.max(0, sipAnim - dt);
        if (bossSays) {
          bossSays.t -= dt;
          if (bossSays.t <= 0) bossSays = null;
        }
        if (inst.done) return;
        elapsed += dt;
        if (total.update(dt)) return finish(inst, score());

        // The monologue goes on regardless.
        if (line) {
          line.age += dt;
          if (line.age >= line.life) {
            last = line;
            lastEnd = elapsed;
            line = null;
            gap = rng.float(0.25, 0.45);
          }
        } else {
          gap -= dt;
          if (gap <= 0 && total.left > 1.2) nextLine();
        }

        // Body chemistry.
        if (jitters > 0) {
          jitters -= dt;
          if (jitters <= 0) jitter = 0.55;
        } else jitter = Math.max(0, jitter - 0.11 * dt);
        if (asleep > 0) {
          asleep -= dt;
          if (asleep <= 0) {
            eyes = 0.45;
            sfx('door');
            fl.add('*snort* I was listening!', 210, 150, C.gold);
          }
          return;
        }
        eyes = Math.max(0, eyes - drain * dt);
        if (eyes > AWAKE_AT && jitters <= 0) awakeTime += dt;
        if (eyes <= 0) {
          asleep = 2;
          sleeps++;
          sfx('fail');
          shake.hit(0.3);
          bossSays = { text: rng.pick(ASLEEP), t: 2 };
          return;
        }

        // Input.
        const p = input.pointer;
        if (input.pressedExact('n') || input.pressed('ArrowUp') || (p.clicked && inBox(p, NOD_BTN))) nod();
        if (input.confirm() || (p.clicked && inBox(p, MUG))) sip();
      },
      render(g) {
        g.save();
        shake.apply(g);
        if (jitters > 0 || jitter > 0.75) g.translate(Math.round((Math.random() - 0.5) * (jitters > 0 ? 4 : 2)), Math.round((Math.random() - 0.5) * 2));
        drawRoom(g);
        drawBubble(g);
        drawTable(g);
        drawHud(g);
        fl.render(g);
        g.restore();
        drawLids(g);
        header(g, theme?.title || 'Meeting Survival', `Nods ${correct}/${buzzTotal}`);
        timerBar(g, total.left, total.total);
      },
    };

    // --- Rendering ---
    function drawRoom(g) {
      rect(g, 0, 0, W, H, '#3d4560');
      for (let x = 0; x < W; x += 30) rect(g, x, 18, 1, 132, 'rgba(0,0,0,0.08)');
      rect(g, 0, 146, W, 4, '#2a3048');
      // Whiteboard.
      const wx = 160;
      const wy = 62;
      rect(g, wx - 3, wy - 3, 186, 72, '#9aa0b0');
      rect(g, wx, wy, 180, 66, '#f4f6f8');
      rect(g, wx + 10, wy + 66, 160, 3, '#7a8090');
      drawText(g, board[0], wx + 8, wy + 6, { color: '#1f70c1' });
      drawText(g, board[1], wx + 8, wy + 18, { color: '#c03030' });
      // Chart going up and to the right (as all charts must).
      const pts = [[wx + 96, wy + 52], [wx + 112, wy + 44], [wx + 126, wy + 48], [wx + 142, wy + 30], [wx + 166, wy + 12]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let k = 0; k <= n; k++) rect(g, x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n, 2, 2, '#2e8540');
      }
      rect(g, wx + 92, wy + 8, 1, 48, '#555');
      rect(g, wx + 92, wy + 56, 80, 1, '#555');
      rect(g, wx + 160, wy + 10, 5, 1, '#2e8540');
      for (let i = 0; i < 4; i++) rect(g, wx + 10 + i * 18, wy + 36 + (i % 2) * 6, 12, 10, ['#f2c14e', '#7fb4ea', '#f29c38', '#9adf9a'][i]);
      // Clock: the hands move suspiciously slowly... no, fast.
      const cx = 400;
      const cy = 82;
      rect(g, cx - 13, cy - 13, 26, 26, C.border);
      rect(g, cx - 12, cy - 12, 24, 24, '#f4f1e8');
      rect(g, cx - 1, cy - 1, 2, 2, '#111');
      const a = anim * 0.6;
      for (let k = 1; k < 10; k++) rect(g, cx + Math.round(Math.sin(a) * k), cy - Math.round(Math.cos(a) * k), 1, 1, '#111');
      for (let k = 1; k < 7; k++) rect(g, cx + Math.round(Math.sin(a / 12) * k), cy - Math.round(Math.cos(a / 12) * k), 1, 1, '#c03030');
      // Plant in the corner.
      rect(g, 440, 128, 16, 18, '#b0603a');
      rect(g, 436, 108, 24, 20, '#2f8a3a');
      rect(g, 442, 100, 12, 10, '#3fae4f');
      drawBoss(g);
    }

    function drawBoss(g) {
      const x = 104;
      const feet = 146;
      const talk = line && Math.floor(anim * 9) % 2 === 0;
      const angry = bossSays && bossSays.t > 0;
      rect(g, x - 12, feet - 2, 26, 3, 'rgba(0,0,0,0.3)');
      rect(g, x - 8, feet - 20, 6, 20, '#22252e');
      rect(g, x + 2, feet - 20, 6, 20, '#22252e');
      rect(g, x - 9, feet - 2, 7, 2, '#111');
      rect(g, x + 2, feet - 2, 7, 2, '#111');
      rect(g, x - 11, feet - 46, 22, 27, '#2b2e3e');
      rect(g, x - 3, feet - 46, 6, 10, '#ffffff');
      rect(g, x - 1, feet - 45, 2, 14, '#e2304a');
      // Arm pointing at the whiteboard (waves while talking).
      const lift = line ? Math.floor(anim * 2) % 2 : 0;
      rect(g, x + 10, feet - 44 - lift * 2, 18, 5, '#2b2e3e');
      rect(g, x + 28, feet - 44 - lift * 2, 4, 4, '#f2c9a0');
      rect(g, x + 32, feet - 43 - lift * 2, 14, 1, '#6b4a32');
      rect(g, x - 14, feet - 44, 4, 18, '#2b2e3e');
      rect(g, x - 14, feet - 27, 4, 4, '#f2c9a0');
      // Head.
      rect(g, x - 7, feet - 62, 14, 16, '#f2c9a0');
      rect(g, x - 8, feet - 64, 16, 4, '#9a9aa0');
      rect(g, x - 8, feet - 60, 2, 6, '#9a9aa0');
      rect(g, x + 6, feet - 60, 2, 6, '#9a9aa0');
      rect(g, x - 4, feet - 56, 2, 2, '#111');
      rect(g, x + 2, feet - 56, 2, 2, '#111');
      if (angry) rect(g, x - 5, feet - 59, 3, 1, '#111'), rect(g, x + 2, feet - 59, 3, 1, '#111');
      rect(g, x - 2, feet - 51, 4, talk ? 3 : 1, '#7a3b3b');
      drawText(g, bossName, x, feet + 4, { align: 'center', color: C.gold, shadow: C.border });
    }

    function drawBubble(g) {
      const bx = 14;
      const by = 22;
      const bw = W - 28;
      const bh = 30;
      if (bossSays) {
        panel(g, bx, by, bw, bh, { fill: '#ffe8e0', light: '#ffffff', dark: '#d8b0a0' });
        rect(g, 100, by + bh, 8, 6, '#ffe8e0');
        drawText(g, bossSays.text, W / 2, by + 11, { align: 'center', color: '#a02020' });
        return;
      }
      if (!line) {
        panel(g, bx, by, bw, bh, { fill: '#dfe4ec', light: '#ffffff', dark: '#b8c0cc' });
        drawText(g, '...', W / 2, by + 11, { align: 'center', color: '#8a93a6' });
        return;
      }
      panel(g, bx, by, bw, bh, { fill: '#ffffff', light: '#ffffff', dark: '#c8cfdc' });
      rect(g, 100, by + bh, 8, 6, '#ffffff');
      rect(g, 102, by + bh + 6, 4, 2, '#ffffff');
      // Remaining life as a thin strip at the bubble's bottom.
      const f = clamp(1 - line.age / line.life, 0, 1);
      rect(g, bx + 2, by + bh - 4, Math.round((bw - 4) * f), 1, '#c8cfdc');
      const two = wrapText(line.text, bw - 16).length > 1;
      drawWrapped(g, line.text, bx + 8, by + (two ? 6 : 11), bw - 16, { color: C.ink });
      if (line.nodded) drawText(g, 'nodded', bx + bw - 6, by + 3, { align: 'right', color: C.good });
    }

    function drawTable(g) {
      rect(g, 0, 150, W, 54, '#5a4a3e');
      // Conference table (oblique trapezoid).
      for (let y = 0; y < 40; y++) {
        const inset = Math.round((40 - y) * 0.9);
        rect(g, 70 + inset, 156 + y, 340 - inset * 2, 1, y < 2 ? '#a07650' : '#7a5236');
      }
      rect(g, 70, 196, 340, 6, '#5a3a26');
      // Colleagues around the table.
      colleague(g, 60, 186, '#3bb66a', '#2b1d14', 'laptop');
      colleague(g, 120, 160, '#b63b3b', '#d9b25c', 'phone');
      colleague(g, 360, 160, '#7a3bb6', '#1a1a1a', 'sleep');
      colleague(g, 420, 186, '#b6973b', '#a33b20', 'doodle');
      // Your hands on the table (bob when you nod).
      const ny = nodAnim > 0 ? Math.round(Math.sin((0.3 - nodAnim) * 20) * 2) : 0;
      rect(g, 200, 190 + ny, 10, 6, '#f2c9a0');
      rect(g, 250, 190 + ny, 10, 6, '#f2c9a0');
      rect(g, 194, 194 + ny, 18, 8, C.accent);
      rect(g, 248, 194 + ny, 18, 8, C.accent);
      rect(g, 214, 186, 32, 10, '#efe9d9');
      for (let i = 0; i < 3; i++) rect(g, 217, 188 + i * 3, 20 - i * 5, 1, '#8a93a6');
    }

    function colleague(g, x, y, shirt, hair, what) {
      rect(g, x - 9, y - 6, 18, 12, shirt);
      rect(g, x - 6, y - 18, 12, 12, '#e0b090');
      rect(g, x - 6, y - 19, 12, 4, hair);
      if (what === 'sleep') {
        rect(g, x - 4, y - 12, 3, 1, '#111');
        rect(g, x + 1, y - 12, 3, 1, '#111');
        const z = Math.floor(anim * 2) % 3;
        drawText(g, 'z', x + 9, y - 22 - z * 3, { color: C.dim });
      } else {
        rect(g, x - 4, y - 13, 2, 2, '#111');
        rect(g, x + 2, y - 13, 2, 2, '#111');
      }
      if (what === 'laptop') {
        rect(g, x - 8, y - 2, 16, 8, '#c8c8d0');
        rect(g, x - 7, y - 1, 14, 6, Math.floor(anim * 2) % 2 ? '#7fb4ea' : '#9adf9a');
      } else if (what === 'phone') {
        rect(g, x - 2, y - 4, 5, 8, '#111');
        rect(g, x - 1, y - 3, 3, 5, '#7fb4ea');
      } else if (what === 'doodle') {
        rect(g, x - 7, y, 14, 6, '#efe9d9');
        rect(g, x - 4 + (Math.floor(anim * 4) % 6), y + 2, 2, 2, '#1f70c1');
      }
    }

    function drawHud(g) {
      rect(g, 0, 204, W, H - 204, '#20243a');
      rect(g, 0, 204, W, 1, C.panelLight);
      // NOD button.
      const nb = NOD_BTN;
      const pressedLook = nodAnim > 0.15;
      rect(g, nb.x, nb.y, nb.w, nb.h, C.border);
      rect(g, nb.x + 1, nb.y + 1 + (pressedLook ? 1 : 0), nb.w - 2, nb.h - 2, jitters > 0 ? '#4a4d5a' : C.goodBtn);
      rect(g, nb.x + 1, nb.y + 1, nb.w - 2, 1, 'rgba(255,255,255,0.3)');
      drawText(g, 'NOD', nb.x + nb.w / 2, nb.y + 7, { align: 'center', color: C.text, shadow: C.border, scale: 2 });
      drawText(g, 'N / Up', nb.x + nb.w / 2, nb.y + nb.h + 2, { align: 'center', color: C.dim });
      // Meters.
      const mx = 186;
      drawText(g, 'EYELIDS', 130, 213, { color: eyes > AWAKE_AT ? C.text : C.bad });
      meter(g, mx, 212, 168, eyes, eyes > 0.5 ? C.good : eyes > AWAKE_AT ? C.warn : C.bad, AWAKE_AT);
      drawText(g, 'JITTERS', 130, 229, { color: jitters > 0 ? C.bad : C.text });
      meter(g, mx, 228, 168, jitter, jitters > 0 ? C.bad : jitter > 0.6 ? C.warn : C.xp, -1);
      if (jitters > 0 && Math.floor(anim * 6) % 2) drawText(g, 'SHAKY!', mx + 84, 238, { align: 'center', color: C.bad });
      // Mug.
      const m = MUG;
      const lift = sipAnim > 0 ? -4 : 0;
      const mx2 = m.x + 30;
      const my2 = m.y + 8 + lift;
      rect(g, mx2, my2, 26, 26, C.border);
      rect(g, mx2 + 1, my2 + 1, 24, 24, '#f4f1e8');
      rect(g, mx2 + 3, my2 + 2, 20, 3, '#6b4428');
      rect(g, mx2 + 26, my2 + 6, 6, 3, C.border);
      rect(g, mx2 + 30, my2 + 8, 2, 10, C.border);
      rect(g, mx2 + 26, my2 + 16, 6, 3, C.border);
      drawText(g, '#1', mx2 + 13, my2 + 11, { align: 'center', color: C.accent });
      for (let i = 0; i < 3; i++) rect(g, mx2 + 6 + i * 7, my2 - 4 - ((Math.floor(anim * 4) + i) % 3), 1, 2, '#c8c8d0');
      drawText(g, 'SIP', m.x + 12, m.y + 14, { color: C.coffee, shadow: C.border });
      drawText(g, 'SPACE', m.x + 4, m.y + 26, { color: C.dim });
      drawText(g, 'Nod ONLY at buzzwords. Sip, but not too often.', W / 2, 256, { align: 'center', color: C.dim });
    }

    function meter(g, x, y, w, f, col, mark) {
      rect(g, x, y, w, 8, C.border);
      rect(g, x + 1, y + 1, w - 2, 6, C.panelDark);
      const fw = Math.round(clamp(f, 0, 1) * (w - 2));
      if (fw > 0) {
        rect(g, x + 1, y + 1, fw, 6, col);
        rect(g, x + 1, y + 1, fw, 1, 'rgba(255,255,255,0.35)');
      }
      if (mark >= 0) rect(g, x + 1 + Math.round(mark * (w - 2)), y - 1, 1, 10, C.text);
    }

    function drawLids(g) {
      if (asleep > 0) {
        rect(g, 0, 18, W, H - 18, '#0a0a10');
        const z = Math.floor(anim * 3) % 4;
        drawText(g, 'Z'.repeat(z + 1), W / 2, 110 - z * 4, { align: 'center', color: C.dim, scale: 3 });
        drawText(g, 'You fell asleep. The boss noticed.', W / 2, 160, { align: 'center', color: C.bad });
        return;
      }
      let l = clamp((0.5 - eyes) / 0.5, 0, 1);
      if (l <= 0) return;
      l = clamp(l + Math.sin(anim * 7) * 0.04, 0, 1);
      g.fillStyle = `rgba(8,10,18,${(l * 0.45).toFixed(3)})`;
      g.fillRect(0, 18, W, H - 18);
      const lh = Math.round(l * 128);
      rect(g, 0, 18, W, lh, '#c98a6a');
      rect(g, 0, 18 + lh - 2, W, 2, '#3a2420');
      for (let x = 6; x < W; x += 12) rect(g, x, 18 + lh, 1, 2, '#3a2420');
      rect(g, 0, H - lh, W, lh, '#c98a6a');
      rect(g, 0, H - lh, W, 2, '#3a2420');
      if (l > 0.5) drawText(g, 'So... sleepy... (SIP!)', W / 2, 130, { align: 'center', color: C.gold, shadow: C.border });
    }

    return inst;
  },
};
