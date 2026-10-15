// Photo Booth (Christmas party): four shots. Each shows a pose card and counts down; hold that pose's arrow when the
// flash fires (or tap its pad before it). A pose counts only if struck after its card showed, so holding one arrow
// throughout is a stiff photo every time. The strip of four photos is the result.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const POSES = ['Wave left', 'Crouch', 'Hands up', 'Wave right'];
const SHOTS = 4;
const PAD = { y: 228, w: 96, h: 26, x0: 36, gap: 8 };
const padX = (i) => PAD.x0 + i * (PAD.w + PAD.gap);

/** A 20x34 figure striking pose p (-1 = standing), at x, y (feet). */
function figure(g, x, y, p) {
  const crouch = p === 1 ? 8 : 0;
  rect(g, x - 5, y - 30 + crouch, 10, 14, '#d8343a');
  rect(g, x - 4, y - 41 + crouch, 8, 10, '#f2c9a0');
  rect(g, x - 5, y - 44 + crouch, 10, 4, '#d8343a');
  rect(g, x - 5, y - 41 + crouch, 10, 1, '#f4f1e8');
  rect(g, x - 5, y - 16 + crouch, 4, 16 - crouch, '#2b2e38');
  rect(g, x + 1, y - 16 + crouch, 4, 16 - crouch, '#2b2e38');
  const armUp = (side) => rect(g, x + side * 6 - (side < 0 ? 2 : 0), y - 44 + crouch, 2, 14, '#f2c9a0');
  const armDown = (side) => rect(g, x + side * 6 - (side < 0 ? 2 : 0), y - 30 + crouch, 2, 12, '#d8343a');
  if (p === 2) (armUp(-1), armUp(1));
  else if (p === 0) (armUp(-1), armDown(1));
  else if (p === 3) (armDown(-1), armUp(1));
  else (armDown(-1), armDown(1));
}

export default {
  id: 'photobooth',
  name: 'Photo Booth',
  help: 'Strike the pose on each card: press its arrow key once the card shows and hold it (or tap its pad) till the flash. Four shots!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const wait = byDiff(d, 3, 2.2);
    const total = new Countdown(SHOTS * (wait + 1) + 4);
    const poses = Array.from({ length: SHOTS }, () => rng.int(0, 3));
    const fl = new Floaters();
    const strip = [];
    let shot = 0;
    let t = 0;
    let phase = 'count';
    let tap = -1;
    let good = 0;
    const struck = new Set(); // the poses struck (arrow pressed, pad tapped) since this card showed
    const holding = (input) => {
      const k = KEYS.findIndex((key) => input.down(key));
      return k >= 0 ? k : tap;
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ pose: poses[Math.min(shot, SHOTS - 1)], phase, left: wait - t }),
      update(dt, input) {
        inst._input = input;
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / SHOTS);
        t += dt;
        if (input.pointer.clicked && input.pointer.y >= PAD.y) {
          const i = [0, 1, 2, 3].find((k) => input.pointer.x >= padX(k) && input.pointer.x < padX(k) + PAD.w);
          if (i != null) (tap = i), phase === 'count' && struck.add(i);
        }
        if (phase === 'count') KEYS.forEach((k, i) => input.pressed(k) && struck.add(i));
        if (phase === 'count' && t >= wait) {
          const pose = holding(input);
          const stiff = pose === poses[shot] && !struck.has(pose);
          const ok = pose === poses[shot] && !stiff;
          if (ok) good++;
          strip.push(ok ? pose : stiff ? -1 : pose);
          sfx(ok ? 'good' : 'bad');
          fl.add(ok ? 'Perfect pose!' : stiff ? 'Too stiff! Strike it fresh' : 'Blinked!', W / 2, 60, ok ? '#5fd068' : '#e2504a');
          phase = 'flash';
          t = 0;
          tap = -1;
        } else if (phase === 'flash' && t >= 1) {
          shot++;
          t = 0;
          phase = 'count';
          tap = -1;
          struck.clear();
          if (shot >= SHOTS) return finish(inst, good / SHOTS);
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#2a1a2e');
        rect(g, 120, 30, 240, 180, '#d8343a');
        rect(g, 126, 36, 228, 168, '#f4f1e8');
        // The live view: you, holding whatever you hold right now; the pose card on the left.
        const held = KEYS.findIndex((k) => inst._input?.down?.(k));
        figure(g, W / 2, 190, held >= 0 ? held : tap);
        if (phase === 'count' && shot < SHOTS) {
          rect(g, 18, 60, 92, 70, '#1a1a22');
          rect(g, 20, 62, 88, 66, '#f2e14e');
          drawText(g, POSES[poses[shot]], 64, 70, { align: 'center', color: '#1a1a22' });
          figure(g, 64, 124, poses[shot]);
          drawText(g, String(Math.max(1, Math.ceil(wait - t))), W / 2, 44, { align: 'center', scale: 2, color: '#d8343a' });
        }
        if (phase === 'flash' && t < 0.25) rect(g, 0, 0, W, H, 'rgba(255,255,255,0.85)');
        // The strip so far, on the right.
        strip.forEach((p, i) => {
          rect(g, 380, 40 + i * 44, 40, 40, '#1a1a22');
          rect(g, 382, 42 + i * 44, 36, 36, p === poses[i] ? '#f4f1e8' : '#8a8a8a');
          figure(g, 400, 76 + i * 44, p);
        });
        for (let i = 0; i < 4; i++) {
          rect(g, padX(i), PAD.y, PAD.w, PAD.h, tap === i ? '#f2e14e' : '#3a2a4a');
          drawText(g, POSES[i], padX(i) + PAD.w / 2, PAD.y + 9, { align: 'center', color: tap === i ? '#1a1a22' : '#f4f1e8' });
        }
        drawText(g, isTouch() ? 'Tap the pose before the flash' : 'Hold the arrow key for the pose', W / 2, 218, { align: 'center', color: '#c8b8a8' });
        header(g, theme?.title || 'Photo Booth', `Shot ${Math.min(shot + 1, SHOTS)}/${SHOTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
