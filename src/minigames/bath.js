// Bath (home office chore): two taps, one bath. The water cools by itself; keep it inside the comfort band (which
// shifts as you relax) by opening the hot or the cold tap. Time spent just right is time relaxed.
import { W, H, rect, drawText, header, timerBar, Countdown, clamp, finish } from '../engine/mgkit.js';

const TIME = 40;
const TAP = 3.2; // degrees per second from a tap
const COOL = 0.35;
const START = 28;
const SHIFT_S = 10;

export default {
  id: 'bath',
  name: 'Just Right',
  help: 'Hold LEFT for the cold tap, RIGHT for the hot one (or hold the mouse on a tap). Keep the water inside the comfort band.',
  create({ rng, theme }) {
    const total = new Countdown(TIME);
    let temp = START;
    let band = [37, 40];
    let inBand = 0;
    let shiftT = SHIFT_S;
    let t = 0;
    let hot = false;
    let cold = false;
    const bubbles = [];

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ temp, band: [...band] }),
      update(dt, input) {
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, inBand / (TIME * 0.8));
        const p = input.pointer;
        const mouseTap = p.down && p.y > 30 ? (p.x < W / 2 ? 'cold' : 'hot') : null;
        hot = input.down('ArrowRight') || mouseTap === 'hot';
        cold = input.down('ArrowLeft') || mouseTap === 'cold';
        temp += ((hot ? TAP : 0) - (cold ? TAP : 0) - COOL + Math.sin(t * 0.9) * 0.3) * dt;
        temp = clamp(temp, 15, 50);
        shiftT -= dt;
        if (shiftT <= 0) {
          shiftT = SHIFT_S;
          const mid = clamp((band[0] + band[1]) / 2 + rng.pick([-2, -1.5, 1.5, 2]), 36, 41);
          band = [mid - 1.5, mid + 1.5];
        }
        const good = temp >= band[0] && temp <= band[1];
        if (good) {
          inBand += dt;
          if (rng.chance(dt * 6)) bubbles.push({ x: rng.int(150, 330), y: 170, s: rng.int(4, 9) });
        }
        for (const b of bubbles) b.y -= dt * 18;
        while (bubbles.length && bubbles[0].y < 70) bubbles.shift();
      },
      render(g) {
        rect(g, 0, 0, W, H, '#cfdde6');
        for (let x = 0; x < W; x += 20) for (let y = 20; y < H; y += 20) rect(g, x, y, 1, 1, '#aab9c4');
        // The bath, the water's colour following its temperature.
        const k = clamp((temp - 20) / 25, 0, 1);
        const water = `rgb(${Math.round(90 + 130 * k)},${Math.round(170 - 40 * k)},${Math.round(220 - 120 * k)})`;
        rect(g, 120, 110, 240, 100, '#1a1a22');
        rect(g, 123, 113, 234, 94, '#f4f6f8');
        rect(g, 130, 124, 220, 76, water);
        for (const b of bubbles) rect(g, b.x, b.y, b.s, b.s, '#ffffff');
        // A rubber duck bobbing.
        const dy = Math.round(Math.sin(t * 2) * 2);
        rect(g, 300, 128 + dy, 14, 9, '#f2d22e');
        rect(g, 308, 122 + dy, 8, 7, '#f2d22e');
        rect(g, 316, 125 + dy, 4, 2, '#f29c38');
        // The taps: cold (left), hot (right).
        for (const [x, col, on, label] of [[150, '#2a6ad1', cold, 'COLD'], [330, '#e2504a', hot, 'HOT']]) {
          rect(g, x - 10, 86, 20, 8, '#9aa1ad');
          rect(g, x - 4, 76, 8, 10, col);
          if (on) for (let i = 0; i < 5; i++) rect(g, x - 1, 96 + i * 5, 2, 3, '#bfe4f2');
          drawText(g, label, x, 64, { align: 'center', color: col });
        }
        // The thermometer with the comfort band.
        const tx = 420;
        const ty = 60;
        const th = 150;
        const yOf = (v) => ty + th - ((v - 15) / 35) * th;
        rect(g, tx - 1, ty - 1, 18, th + 2, '#1a1a22');
        rect(g, tx, ty, 16, th, '#f4f6f8');
        rect(g, tx, yOf(band[1]), 16, yOf(band[0]) - yOf(band[1]), '#5fd068');
        rect(g, tx - 4, yOf(temp) - 1, 24, 3, '#e2504a');
        drawText(g, `${Math.round(temp)}C`, tx + 8, ty + th + 6, { align: 'center', color: '#1a1a22' });
        const good = temp >= band[0] && temp <= band[1];
        drawText(g, good ? 'Just right...' : temp < band[0] ? 'Brr! Too cold' : 'Ouch! Too hot', 240, 222, { align: 'center', color: good ? '#2f8a3a' : '#a33b3b' });
        header(g, theme?.title || 'Bath', `Relaxed ${Math.round(Math.min(1, inBand / (TIME * 0.8)) * 100)}%`);
        timerBar(g, total.left, total.total);
      },
    };
    return inst;
  },
};
