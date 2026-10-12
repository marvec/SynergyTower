// Swim to the buoy (vacation hotel): tap for each stroke to swim out to the buoy and back to the jetty. Gentle waves,
// no rush: strokes come as fast as the arms do.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const STROKES = 10; // strokes per leg
const STROKE_S = 0.35; // an arm needs this long before the next stroke
const NEAR = 60;
const FAR = W - 70;
const SEA_Y = 120;

export default {
  id: 'swim',
  name: 'Swim to the Buoy',
  help: 'Press SPACE, an arrow key or click for each stroke. Swim out to the buoy, touch it and swim back to the jetty.',
  create({ theme, sfx = () => {} }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    let progress = 0; // 0..STROKES out, then STROKES..2*STROKES back
    let shown = 0;
    let arm = 0;
    let t = 0;

    const legX = () => {
      const k = clamp(shown / STROKES, 0, 2);
      return k <= 1 ? NEAR + (FAR - NEAR) * k : FAR - (FAR - NEAR) * (k - 1);
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ canStroke: arm <= 0 }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        arm = Math.max(0, arm - dt);
        shown += clamp(progress - shown, -dt * 4, dt * 4);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, progress / (2 * STROKES));
        const tap = input.confirm() || input.pointer.clicked || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some((k) => input.pressed(k));
        if (tap && arm <= 0) {
          arm = STROKE_S;
          progress++;
          sfx(progress === STROKES ? 'good' : 'step');
          if (progress === STROKES) fl.add('Buoy! Now back', FAR, SEA_Y - 30, C.gold);
          if (progress >= 2 * STROKES) {
            sfx('good');
            return finish(inst, 1);
          }
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#8fd0f0');
        rect(g, 300, 40, 20, 20, '#f6e8b8');
        rect(g, 0, SEA_Y - 40, W, 40, '#bfe6f8');
        // The jetty on the left, the buoy on the right.
        rect(g, 0, SEA_Y - 14, 50, 6, '#b98a5a');
        for (const x of [6, 40]) rect(g, x, SEA_Y - 8, 4, 50, '#8f6640');
        rect(g, 0, SEA_Y, W, H - SEA_Y, '#2a86c7');
        for (let i = 0; i < 24; i++) {
          const x = ((i * 47 + t * 18) % (W + 30)) - 15;
          rect(g, x, SEA_Y + 6 + (i % 6) * 22 + Math.round(Math.sin(t * 2 + i) * 2), 10, 1, '#6fc0ec');
        }
        const bob = Math.round(Math.sin(t * 2.4) * 2);
        rect(g, FAR + 18, SEA_Y - 16 + bob, 14, 16, '#1a1a22');
        rect(g, FAR + 19, SEA_Y - 15 + bob, 12, 7, '#e2504a');
        rect(g, FAR + 19, SEA_Y - 8 + bob, 12, 7, '#ffffff');
        // You, swimming (facing the way you go).
        const x = Math.round(legX());
        const back = progress >= STROKES;
        const y = SEA_Y - 4 + Math.round(Math.sin(t * 3) * 2);
        rect(g, x - 12, y + 2, 24, 6, '#f2c9a0');
        rect(g, x + (back ? -16 : 8), y - 4, 10, 10, '#f2c9a0');
        rect(g, x + (back ? -16 : 8), y - 4, 10, 3, '#5a3a22');
        const a = arm > STROKE_S / 2 ? -8 : 2;
        rect(g, x + (back ? -20 : 14) + (back ? -a : a), y - 6, 6, 3, '#f2c9a0');
        rect(g, x - 18, y + 7, 40, 2, '#e8f8ff');
        // Progress: out and back.
        const bw = 200;
        rect(g, W / 2 - bw / 2, 236, bw, 8, '#1a3a5a');
        rect(g, W / 2 - bw / 2, 236, Math.round((bw * progress) / (2 * STROKES)), 8, C.good);
        rect(g, W / 2, 234, 1, 12, '#ffffff');
        drawText(g, back ? 'Back to the jetty!' : 'Out to the buoy!', W / 2, 250, { align: 'center', color: '#ffffff' });
        header(g, theme?.title || 'Swim', `${Math.round((progress / (2 * STROKES)) * 100)}%`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
