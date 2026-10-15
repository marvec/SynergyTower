// Gift Wrapping (Christmas party, the Secret Santa table): three gifts; for each, cut the paper at the mark, tape the seam
// in the green band and tie the bow as the ring closes. Nine timed presses (SPACE or a click); going past the band misses.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';

const STEPS = ['cut', 'tape', 'bow'];
const RATE = { cut: 0.42, tape: 0.55, bow: 0.5 }; // of the gauge per second
const GIFTS = 3;
const PAPERS = ['#d8343a', '#2f8a3a', '#3a5fb6', '#b6973b', '#7a3bb6'];
const RIBBONS = ['#f2e14e', '#f4f1e8', '#f29cd0', '#e2504a'];
const TIPS = { cut: 'Cut the paper at the mark', tape: 'Tape the seam in the green band', bow: 'Tie the bow as the ring closes' };

export default {
  id: 'giftwrap',
  name: 'Gift Wrapping',
  help: 'Secret Santa! Press SPACE (or click) to cut the paper at the mark, tape the seam in the band and tie the bow as the ring closes.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const total = new Countdown(60);
    const fl = new Floaters();
    const gifts = Array.from({ length: GIFTS }, () => ({
      paper: rng.pick(PAPERS),
      ribbon: rng.pick(RIBBONS),
      w: rng.int(60, 90),
      h: rng.int(40, 56),
      bands: STEPS.map(() => {
        const w = byDiff(d, 0.16, 0.09);
        const a = rng.float(0.45, 0.85 - w);
        return [a, a + w];
      }),
      ok: [],
    }));
    let gi = 0;
    let si = 0;
    let level = 0;
    let pause = 0;
    let good = 0;
    const stage = () => (gi >= GIFTS ? 'done' : STEPS[si]);
    const band = () => (gi >= GIFTS ? [0, 0] : gifts[gi].bands[si]);

    const next = (ok, text) => {
      gifts[gi].ok.push(ok);
      if (ok) good++;
      sfx(ok ? 'good' : 'bad');
      fl.add(text, W / 2, 70, ok ? '#5fd068' : '#e2504a');
      level = 0;
      pause = 0.45;
      si++;
      if (si >= STEPS.length) {
        si = 0;
        gi++;
      }
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ stage: stage(), level, band: band(), paused: pause > 0 }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt) || gi >= GIFTS) return finish(inst, good / (GIFTS * STEPS.length));
        if (pause > 0) {
          pause -= dt;
          return;
        }
        const st = stage();
        const [a, b] = band();
        level += RATE[st] * dt;
        if (input.confirm() || input.pointer.clicked) {
          const ok = level >= a && level <= b;
          return next(ok, ok ? { cut: 'Clean cut!', tape: 'Neat!', bow: 'Lovely bow!' }[st] : level < a ? 'Too soon!' : 'Too late!');
        }
        if (level > 1) next(false, { cut: 'Paper everywhere!', tape: 'Tangled!', bow: 'Knotted!' }[st]);
      },
      render(g) {
        rect(g, 0, 0, W, H, '#2a1d18');
        rect(g, 0, 170, W, 100, '#6b4a32');
        rect(g, 0, 170, W, 2, '#8a6a4a');
        // Wrapped gifts so far, on the left; the one on the table in the middle.
        gifts.forEach((gf, i) => {
          if (i >= gi) return;
          const x = 30 + i * 46;
          const nice = gf.ok.filter(Boolean).length;
          rect(g, x, 150, 40, 30, nice >= 2 ? gf.paper : '#8a7a6a');
          rect(g, x + 18, 150, 4, 30, gf.ribbon);
          if (nice === 3) rect(g, x + 14, 144, 12, 6, gf.ribbon);
        });
        if (gi < GIFTS) {
          const gf = gifts[gi];
          const x = W / 2 - gf.w / 2;
          const y = 168 - gf.h;
          rect(g, x - 1, y - 1, gf.w + 2, gf.h + 2, '#1a1a22');
          rect(g, x, y, gf.w, gf.h, si > 0 ? gf.paper : '#c8a878');
          if (si > 1) rect(g, x + gf.w / 2 - 2, y, 4, gf.h, gf.ribbon);
          if (si > 1) rect(g, x, y + gf.h / 2 - 2, gf.w, 4, gf.ribbon);
          const st = stage();
          const [a, b] = band();
          if (st === 'bow') {
            // The closing ring: the band is where the bow sits snug.
            const r = Math.round((1 - level) * 40) + 4;
            const ra = Math.round((1 - b) * 40) + 4;
            const rb = Math.round((1 - a) * 40) + 4;
            const cx = W / 2;
            const cy = y - 30;
            for (let k = 0; k < 24; k++) {
              const ang = (k / 24) * Math.PI * 2;
              rect(g, Math.round(cx + Math.cos(ang) * rb) - 1, Math.round(cy + Math.sin(ang) * rb) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * ra) - 1, Math.round(cy + Math.sin(ang) * ra) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy + Math.sin(ang) * r) - 1, 3, 3, gf.ribbon);
            }
          } else {
            const gx = 120;
            const gy = 214;
            const gw = 240;
            rect(g, gx - 1, gy - 1, gw + 2, 12, '#1a1a22');
            rect(g, gx, gy, gw, 10, st === 'cut' ? '#c8a878' : '#f4f6f8');
            rect(g, gx + gw * a, gy, gw * (b - a), 10, '#5fd068');
            rect(g, gx + Math.min(gw, gw * level) - 1, gy - 3, 3, 16, st === 'cut' ? '#9aa1ad' : '#e2504a');
          }
          drawText(g, TIPS[st], W / 2, 44, { align: 'center', color: '#f4f1e8' });
        }
        drawText(g, isTouch() ? 'Tap at the right moment' : 'SPACE at the right moment', W / 2, 256, { align: 'center', color: '#c8b8a8' });
        header(g, theme?.title || 'Gift Wrapping', `Gift ${Math.min(gi + 1, GIFTS)}/${GIFTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
