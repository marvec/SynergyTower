// PowerPoint Karaoke: present slides you have never seen. Each slide shows a procedurally generated chart;
// pick the one narration that actually matches it (the right answer is derived from the generated data).
import { W, H, C, rect, frame, drawText, measureText, header, timerBar, choiceBox, Floaters, Shake, byDiff, clamp, finish, pickChoice } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import * as K from '../data/mg-karaoke.js';

const TYPES = ['bar', 'line', 'pie', 'matrix', 'funnel', 'venn'];
const SHAPES = ['rising', 'falling', 'peak', 'dip', 'flat'];
const SCREEN = { x: 84, y: 21, w: 312, h: 120 };
const AX = 118; // chart y-axis x
const BY = 122; // chart baseline y
const PLOT_R = 382;
const UNIT = 7; // px per value unit (values 0..10)
const OPT = { x: 16, y: 146, w: 222, h: 28, dx: 226, dy: 31 };
const PIE_COLS = ['#e2504a', '#f2c14e', '#5fd068', '#5b8def', '#b15cff'];
const FUNNEL_COLS = ['#5b8def', '#4cbf56', '#f2c14e', '#e2504a'];
const INK = '#2a2a35';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fillT = (t, m) => t.replace(/\{(\w+)\}/g, (all, k) => (k in m ? m[k] : all));
const argMax = (v) => v.indexOf(Math.max(...v));
const argMin = (v) => v.indexOf(Math.min(...v));

/** Thick pixel line between two points. */
function pline(g, x0, y0, x1, y1, col) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) rect(g, Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 2, 2, col);
}

/** Collapse a per-pixel colour function over a box into horizontal runs (drawn each frame cheaply). */
function toRuns(x0, y0, w, h, colorAt) {
  const runs = [];
  for (let y = 0; y < h; y++) {
    let start = -1;
    let col = null;
    for (let x = 0; x <= w; x++) {
      const c = x < w ? colorAt(x, y) : null;
      if (c !== col) {
        if (col) runs.push([x0 + start, y0 + y, x - start, col]);
        start = x;
        col = c;
      }
    }
  }
  return runs;
}

/** 14×13 audience member seen from behind. pose: idle | clap | phone. */
function backPerson(g, x, y, s, look, pose, t) {
  const r = (cx, cy, w, h, col) => rect(g, x + cx * s, y + cy * s, w * s, h * s, col);
  const beat = Math.floor(t * 8 + look.seed) % 2;
  if (pose === 'clap') {
    y -= beat * s; // bouncing in their seat
    if (look.eager < 0.3) {
      // Fist pump.
      r(12, 1 + beat, 2, 8 - beat, look.shirt);
      r(12, -1 + beat, 2, 2, look.skin);
    }
    if (beat) {
      rect(g, x - 2 * s, y + 2 * s, s, s, '#fff6c8');
      rect(g, x - 3 * s, y + 4 * s, s, s, '#fff6c8');
      rect(g, x + 15 * s, y + 3 * s, s, s, '#fff6c8');
    }
  }
  r(0, 8, 14, 5, look.shirt);
  r(0, 8, 14, 1, 'rgba(255,255,255,0.15)');
  r(5, 7, 4, 1, look.skin);
  r(2, 3, 1, 2, look.skin);
  r(11, 3, 1, 2, look.skin);
  const tilt = pose === 'phone' ? 1 : 0;
  r(3 + tilt, 0, 8, 7, look.hair);
  r(4 + tilt, 0, 6, 1, 'rgba(255,255,255,0.12)');
  if (pose === 'phone') {
    // Checking their phone: a bright screen held up next to the head.
    r(10, 3, 5, 6, 'rgba(160,215,255,0.25)');
    r(11, 4, 3, 4, '#1a1a1a');
    r(11, 4, 3, 3, '#bfe4ff');
  }
}

/** 12×30 presenter at scale s. */
function presenter(g, x, y, s, look, expr) {
  const r = (cx, cy, w, h, col) => rect(g, x + cx * s, y + cy * s, w * s, h * s, col);
  r(3, 21, 2, 8, '#2b2e38');
  r(7, 21, 2, 8, '#2b2e38');
  r(2, 29, 3, 1, '#15161c');
  r(7, 29, 3, 1, '#15161c');
  r(2, 10, 8, 11, look.top);
  r(0, 11, 2, 9, look.top);
  r(10, 11, 2, 5, look.top);
  r(11, 9, 2, 3, look.top); // arm raised with the clicker
  r(11, 7, 2, 2, look.skin);
  r(12, 6, 1, 1, '#22252e');
  r(0, 20, 2, 1, look.skin);
  r(4, 10, 1, 4, '#e2504a');
  r(7, 10, 1, 4, '#e2504a');
  r(4, 14, 4, 3, '#f4f1e8');
  r(5, 9, 2, 1, look.skin);
  r(2, 1, 8, 8, look.skin);
  r(2, 0, 8, 2, look.hair);
  r(2, 2, 1, 2, look.hair);
  r(9, 2, 1, 2, look.hair);
  r(4, 4, 1, 1, '#222');
  r(7, 4, 1, 1, '#222');
  if (expr === 'happy') {
    r(4, 6, 4, 1, '#7a3b3b');
    r(3, 5, 1, 1, '#7a3b3b');
    r(8, 5, 1, 1, '#7a3b3b');
  } else if (expr === 'sweat') {
    r(5, 6, 2, 2, '#3a1a1a');
    r(9, 2, 1, 2, '#8ad0ff');
    r(1, 3, 1, 2, '#8ad0ff');
  } else if (expr === 'talk') {
    r(5, 6, 2, 2, '#3a1a1a');
  } else {
    r(4, 6, 4, 1, '#7a3b3b');
  }
}

export default {
  id: 'karaoke',
  name: 'PowerPoint Karaoke',
  help: 'Present slides you have never seen: pick the narration that matches the chart. Keys 1-4, arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 6, 9));
    const perSlide = byDiff(d, 10, 6);
    const nOpt = d < 0.3 ? 3 : 4;
    const dept = theme?.dept;
    const fl = new Floaters();
    const shake = new Shake();
    const st = { focus: 0 };
    const you = { skin: rng.pick(['#f2c9a0', '#d9a273', '#a86b42', '#6b4228']), hair: rng.pick(['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20']), top: C.accent };
    const crowdLook = () => ({
      seed: rng.int(0, 7),
      skin: rng.pick(['#f2c9a0', '#d9a273', '#a86b42', '#6b4228']),
      hair: rng.pick(['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#c8c8c8', '#1a1a1a', '#5a3a8a']),
      shirt: rng.pick(['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#555a66', '#2b2e38']),
      eager: rng.float(0, 1),
    });
    const back = Array.from({ length: 10 }, crowdLook);
    const front = Array.from({ length: 9 }, crowdLook);

    // Draw content from per-game shuffled decks so a deck of slides never repeats itself.
    const decks = new Map();
    const deal = (arr) => {
      let deck = decks.get(arr);
      if (!deck || !deck.length) decks.set(arr, (deck = rng.shuffle(arr)));
      return deck.pop();
    };
    const pickMetric = () => (dept && K.DEPT_METRICS[dept] && rng.chance(0.5) ? deal(K.DEPT_METRICS[dept]) : deal(K.METRICS));
    const pickTitle = () => deal(dept && K.TITLES[dept] && rng.chance(0.65) ? K.TITLES[dept] : K.TITLES.generic);

    function series(shape, n) {
      if (shape === 'flat') return Array(n).fill(rng.float(4.5, 6.5));
      if (shape === 'rising' || shape === 'falling') {
        const lo = rng.float(1, 2.5);
        const step = (rng.float(8.5, 10) - lo) / (n - 1);
        const v = Array.from({ length: n }, (_, i) => lo + i * step + (i > 0 && i < n - 1 ? rng.float(-0.2, 0.2) * step : 0));
        return shape === 'rising' ? v : v.reverse();
      }
      const key = rng.int(1, n - 2);
      const maxD = Math.max(key, n - 1 - key);
      if (shape === 'peak') {
        const top = rng.float(8.5, 10);
        const step = (top - 1.5) / maxD;
        return Array.from({ length: n }, (_, i) => top - Math.abs(i - key) * step * (i === key ? 1 : rng.float(0.9, 1)));
      }
      const low = rng.float(1, 2);
      const step = (rng.float(8, 10) - low) / maxD;
      return Array.from({ length: n }, (_, i) => low + Math.abs(i - key) * step * (i === key ? 1 : rng.float(0.9, 1)));
    }

    function trendSlide(type) {
      const xs = rng.pick(K.X_SETS);
      const n = xs.labels.length;
      const y = pickMetric();
      const shape = rng.pick(SHAPES);
      const vals = series(shape, n);
      const hi = argMax(vals);
      const lo = argMin(vals);
      const say = (sh, X = '') => fillT(rng.pick(K.TREND[sh]), { Y: cap(y), y, unit: xs.unit, prep: xs.prep, X: X });
      const idx = [...Array(n).keys()];
      const interior = idx.filter((i) => i > 0 && i < n - 1);
      // An X for a peak/dip claim that is clearly false for this series.
      const falseX = (claim) => {
        if (shape === 'flat') return xs.labels[rng.pick(idx)];
        const key = claim === 'peak' ? hi : lo;
        const pool = shape === 'peak' || shape === 'dip' ? interior.filter((i) => i !== hi && i !== lo) : idx.filter((i) => i !== key);
        return xs.labels[rng.pick(pool.length ? pool : idx.filter((i) => i !== key))];
      };
      const correct = say(shape, shape === 'peak' ? xs.labels[hi] : shape === 'dip' ? xs.labels[lo] : '');
      const wrong = [];
      if (shape === 'peak' || shape === 'dip') wrong.push(say(shape, xs.labels[rng.pick(idx.filter((i) => i !== (shape === 'peak' ? hi : lo)))]));
      for (const sh of rng.shuffle(SHAPES.filter((s) => s !== shape))) wrong.push(say(sh, sh === 'peak' || sh === 'dip' ? falseX(sh) : ''));
      return { type, title: pickTitle(), y, xs, vals, correct, wrong: rng.chance(0.5) ? wrong : rng.shuffle(wrong) };
    }

    function pieSlide() {
      const set = deal(K.PIES);
      const n = d < 0.5 ? 3 : 4;
      const labels = rng.sample(set.labels, n);
      const big = rng.int(0, n - 1);
      let vals = null;
      for (let tries = 0; tries < 40 && !vals; tries++) {
        const bigV = rng.int(44, 58);
        const w = labels.map((_, i) => (i === big ? 0 : rng.float(0.4, 1)));
        const sum = w.reduce((a, b) => a + b, 0);
        const v = w.map((x, i) => (i === big ? bigV : Math.max(1, Math.round((x / sum) * (100 - bigV)))));
        v[big] += 100 - v.reduce((a, b) => a + b, 0);
        if (v.every((x, i) => i === big || (x >= 6 && x <= v[big] - 12))) vals = v;
      }
      if (!vals) vals = labels.map((_, i) => (i === big ? 100 - (n - 1) * 15 : 15));
      const say = (L) => fillT(rng.pick(K.PIE_T), { L });
      const cx = 166;
      const cy = 89;
      const R = 35;
      const cum = [];
      vals.reduce((a, v, i) => ((cum[i] = a + v / 100), a + v / 100), 0);
      const runs = toRuns(cx - R, cy - R, R * 2 + 1, R * 2 + 1, (x, y) => {
        const dx = x - R;
        const dy = y - R;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) return null;
        if (d2 > (R - 1.5) * (R - 1.5)) return INK;
        const a = ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
        const k = cum.findIndex((c) => a < c);
        return PIE_COLS[k < 0 ? n - 1 : k];
      });
      return { type: 'pie', title: set.title, labels, vals, runs, correct: say(labels[big]), wrong: rng.shuffle(labels.filter((_, i) => i !== big)).map(say) };
    }

    function matrixSlide() {
      const [A, B] = deal(K.MATRICES);
      const qa = rng.chance(0.5);
      const qb = rng.chance(0.5);
      const hl = (v) => (v ? 'high' : 'low');
      const say = (a, b) => fillT(rng.pick(K.MATRIX_T), { a: hl(a), b: hl(b), A, B });
      const spot = (a, b) => ({ x: 160 + Math.round((a ? rng.float(0.58, 0.85) : rng.float(0.12, 0.38)) * 200), y: 46 + Math.round((b ? rng.float(0.15, 0.38) : rng.float(0.6, 0.85)) * 76) });
      const others = rng.shuffle([[!qa, qb], [qa, !qb], [!qa, !qb]]);
      return {
        type: 'matrix', title: rng.pick(K.MATRIX_TITLES), A, B, us: spot(qa, qb), them: spot(...others[0]),
        correct: say(qa, qb), wrong: others.map(([a, b]) => say(a, b)),
      };
    }

    function funnelSlide() {
      const set = deal(K.FUNNELS);
      const j = rng.int(0, 2);
      let v = rng.pick([500, 800, 1000, 1200, 2000]);
      const vals = [v];
      for (let i = 0; i < 3; i++) vals.push((v = Math.round(v * (i === j ? rng.float(0.2, 0.35) : rng.float(0.8, 0.9)))));
      const say = (i) => fillT(rng.pick(K.FUNNEL_T), { S1: set.stages[i], S2: set.stages[i + 1] });
      return { type: 'funnel', title: set.title, stages: set.stages, vals, correct: say(j), wrong: rng.shuffle([0, 1, 2].filter((i) => i !== j)).map(say) };
    }

    function vennSlide() {
      const v = deal(K.VENNS);
      const say = (C2) => fillT(rng.pick(K.VENN_T), { A: v.a, B: v.b, C: C2 });
      const ax = 220;
      const bx = 260;
      const cy = 91;
      const R = 31;
      const runs = toRuns(ax - R, cy - R, bx - ax + R * 2 + 1, R * 2 + 1, (x, y) => {
        const px = ax - R + x;
        const py = cy - R + y;
        const da = (px - ax) ** 2 + (py - cy) ** 2;
        const db = (px - bx) ** 2 + (py - cy) ** 2;
        const inA = da <= R * R;
        const inB = db <= R * R;
        if ((inA && da > (R - 1.5) ** 2) || (inB && db > (R - 1.5) ** 2)) return INK;
        if (inA && inB) return '#b08ad8';
        if (inA) return '#9cc3f0';
        if (inB) return '#f4a7a0';
        return null;
      });
      const other = rng.pick(K.VENNS.filter((o) => o !== v)).c;
      return { type: 'venn', title: rng.pick(K.VENN_TITLES), a: v.a, b: v.b, c: v.c, runs, correct: say(v.c), wrong: rng.shuffle([say(v.a), say(v.b), say(other)]) };
    }

    function buildOptions(s) {
      const list = [s.correct];
      const add = (t) => t && !list.includes(t) && list.push(t);
      for (const w of s.wrong) if (list.length < nOpt - 1) add(w);
      const trendLike = s.type === 'bar' || s.type === 'line';
      const wrongTypes = Object.keys(K.WRONG_TYPE).filter((k) => k !== s.type && !(trendLike && (k === 'bar' || k === 'line')));
      if (rng.chance(0.5)) add(fillT(rng.pick(K.WRONG_TYPE[rng.pick(wrongTypes)]), { Y: cap(s.y || 'it') }));
      while (list.length < nOpt) add(deal(K.NONSENSE));
      const opts = rng.shuffle(list);
      s.opts = opts;
      s.right = opts.indexOf(s.correct);
      s.chosen = -1;
      return s;
    }

    const typeSeq = [];
    while (typeSeq.length < count) typeSeq.push(...rng.shuffle(TYPES));
    const slides = typeSeq.slice(0, count).map((t) => buildOptions(t === 'bar' || t === 'line' ? trendSlide(t) : t === 'pie' ? pieSlide() : t === 'matrix' ? matrixSlide() : t === 'funnel' ? funnelSlide() : vennSlide()));

    let i = 0;
    let phase = 'next'; // next (slide wipe-in) → show → reveal → next …
    let phaseT = 0;
    let left = perSlide;
    let correct = 0;
    let wrongPicks = 0;
    let streak = 0;
    let anim = 0;
    let crowd = 'idle';
    let crowdT = 0;
    let mood = 'idle';
    sfx('click');

    const optRects = () => Array.from({ length: nOpt }, (_, k) => ({ x: OPT.x + (k % 2) * OPT.dx, y: OPT.y + Math.floor(k / 2) * OPT.dy, w: OPT.w, h: OPT.h }));

    function answer(k) {
      const s = slides[i];
      s.chosen = k;
      if (k === s.right) {
        correct++;
        streak++;
        sfx('good');
        crowd = 'clap';
        mood = 'happy';
        if (streak >= 3) fl.add(`Streak x${streak}!`, 439, 92, C.gold);
        for (let n = 0; n < 3; n++) fl.add(rng.pick(K.CHEERS), rng.int(40, 440), rng.int(214, 232), C.gold);
      } else {
        if (k >= 0) wrongPicks++;
        streak = 0;
        sfx('bad');
        shake.hit();
        crowd = 'phone';
        mood = 'sweat';
        for (let n = 0; n < 2; n++) fl.add(rng.pick(K.CRICKETS), rng.int(40, 440), rng.int(214, 232), C.dim);
      }
      crowdT = 1.6;
      phase = 'reveal';
      phaseT = 0;
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        anim += dt;
        fl.update(dt);
        shake.update(dt);
        if (crowdT > 0 && (crowdT -= dt) <= 0) crowd = 'idle';
        if (inst.done) return;
        phaseT += dt;
        if (phase === 'next') {
          if (phaseT >= 0.4) {
            phase = 'show';
            phaseT = 0;
            left = perSlide;
            st.focus = 0;
            mood = 'talk';
            input.consumeKeys();
            input.consumeClick();
          }
          return;
        }
        if (phase === 'reveal') {
          if (phaseT >= 1.4 || (phaseT > 0.45 && (input.confirm() || input.pointer.clicked))) {
            input.consumeKeys();
            input.consumeClick();
            i++;
            if (i >= slides.length) return finish(inst, clamp((correct - 0.25 * wrongPicks) / slides.length, 0, 1));
            phase = 'next';
            phaseT = 0;
            mood = 'idle';
            sfx('click');
            fl.add('Next slide!', 46, 70, C.text);
          }
          return;
        }
        left -= dt;
        if (left <= 0) return answer(-1);
        const k = pickChoice(input, optRects(), st);
        if (k >= 0) answer(k);
      },
      render(g) {
        g.save();
        shake.apply(g);
        // Dim conference room.
        rect(g, 0, 0, W, H, '#23283a');
        for (let x = 0; x < W; x += 32) rect(g, x, 18, 1, 124, 'rgba(0,0,0,0.12)');
        rect(g, 0, 142, W, 128, '#1a1d2b');
        header(g, theme?.title || 'PowerPoint Karaoke', `Slide ${Math.min(i + 1, slides.length)}/${slides.length}`);
        timerBar(g, phase === 'show' ? left : phase === 'next' ? perSlide : 0, perSlide);

        const s = slides[Math.min(i, slides.length - 1)];
        // Projector screen.
        rect(g, SCREEN.x - 4, SCREEN.y - 2, SCREEN.w + 8, 4, '#3b4048');
        rect(g, SCREEN.x - 1, SCREEN.y + 1, SCREEN.w + 2, SCREEN.h + 1, '#0d0f18');
        rect(g, SCREEN.x, SCREEN.y + 2, SCREEN.w, SCREEN.h - 2, '#f6f5ef');
        rect(g, SCREEN.x + SCREEN.w / 2 - 2, SCREEN.y + SCREEN.h, 4, 3, '#3b4048');
        drawSlide(g, s, anim);
        if (phase === 'next') {
          const f = clamp(phaseT / 0.4, 0, 1);
          const cover = Math.round((1 - f) * SCREEN.w);
          rect(g, SCREEN.x + SCREEN.w - cover, SCREEN.y + 2, cover, SCREEN.h - 2, '#f6f5ef');
          if (cover > 2) rect(g, SCREEN.x + SCREEN.w - cover, SCREEN.y + 2, 2, SCREEN.h - 2, C.accent);
        }
        if (phase === 'reveal') {
          // Verdict stamp on the slide.
          const ok = s.chosen === s.right;
          const txt = ok ? 'NAILED IT!' : s.chosen < 0 ? 'AWKWARD SILENCE' : 'AWKWARD...';
          const tw = measureText(txt, 2) + 16;
          const sx = SCREEN.x + SCREEN.w - tw - 6;
          const col = ok ? '#2e8540' : '#b83a32';
          rect(g, sx, 24, tw, 22, col);
          frame(g, sx + 2, 26, tw - 4, 18, '#ffffff');
          drawText(g, txt, sx + tw / 2, 28, { align: 'center', color: '#ffffff', scale: 2 });
        }
        if (phase === 'show') {
          // Wobbly laser pointer.
          const lx = 240 + Math.round(Math.sin(anim * 1.3) * 90 + Math.sin(anim * 7) * 2);
          const ly = 86 + Math.round(Math.sin(anim * 2.1) * 26 + Math.cos(anim * 9) * 2);
          rect(g, lx - 1, ly - 1, 4, 4, 'rgba(255,60,60,0.35)');
          rect(g, lx, ly, 2, 2, '#ff3030');
        }

        // Presenter at the lectern.
        presenter(g, 30, 80, 2, you, phase === 'show' && Math.floor(anim * 6) % 3 === 0 ? 'talk' : mood === 'talk' ? 'idle' : mood);
        rect(g, 20, 112, 46, 30, '#5a3d28');
        rect(g, 20, 112, 46, 2, '#7a5538');
        rect(g, 24, 118, 38, 1, '#3e2a1b');
        rect(g, 28, 108, 26, 5, '#9aa0b8');
        rect(g, 29, 109, 24, 3, '#cfe6ff');
        if (crowd === 'phone') {
          // A cricket hops onto the lectern. Chirp.
          const hop = Math.floor(anim * 6) % 2;
          const cx = 23;
          const cy = 104 - hop;
          rect(g, cx, cy + 2, 8, 3, '#4a8a2a');
          rect(g, cx + 6, cy, 3, 3, '#4a8a2a');
          rect(g, cx + 7, cy, 1, 1, '#111');
          rect(g, cx + 8, cy - 3, 1, 3, '#2e5a1a');
          rect(g, cx - 1, cy + 1, 4, 1, '#2e5a1a');
          rect(g, cx + 1, cy + 5, 1, 3 + hop, '#2e5a1a');
          rect(g, cx + 5, cy + 5, 1, 3 + hop, '#2e5a1a');
          if (hop) drawText(g, 'cri', cx - 3, cy - 3, { align: 'right', color: C.dim });
        }

        // Sidebar: slide count, streak, applause.
        rect(g, 404, 24, 70, 114, C.border);
        rect(g, 405, 25, 68, 112, C.panel);
        rect(g, 405, 25, 68, 1, C.panelLight);
        drawText(g, 'SLIDE', 439, 30, { align: 'center', color: C.dim });
        drawText(g, `${Math.min(i + 1, slides.length)}/${slides.length}`, 439, 41, { align: 'center', color: C.text, scale: 2 });
        drawText(g, 'STREAK', 439, 66, { align: 'center', color: C.dim });
        drawText(g, `x${streak}`, 439, 77, { align: 'center', color: streak >= 2 ? C.gold : C.text, scale: 2 });
        drawText(g, 'NAILED', 439, 102, { align: 'center', color: C.dim });
        drawText(g, `${correct}`, 439, 113, { align: 'center', color: C.good, scale: 2 });

        // Narration options.
        optRects().forEach((r, k) => {
          let state = phase === 'show' && st.focus === k ? 'focus' : 'idle';
          if (phase === 'reveal') state = k === s.right ? 'right' : k === s.chosen ? 'wrong' : 'idle';
          choiceBox(g, r.x, r.y, r.w, r.h, String(k + 1), '', state);
          const lines = wrapText(s.opts[k], r.w - 24).slice(0, 2);
          const ty = r.y + Math.floor((r.h - lines.length * 10) / 2) + 1;
          const col = phase === 'next' ? C.dim : C.text;
          lines.forEach((l, n) => drawText(g, l, r.x + 18, ty + n * 10, { color: col }));
        });
        drawText(g, 'Say what the chart shows: keys 1-4, arrows + Space, or click.', W / 2, 209, { align: 'center', color: C.dim });

        // Audience (seen from behind).
        back.forEach((p, k) => backPerson(g, 12 + k * 47, 226, 2, p, poseFor(p), anim));
        front.forEach((p, k) => backPerson(g, -6 + k * 56, 243, 3, p, poseFor(p), anim));
        fl.render(g);
        g.restore();
      },
    };

    function poseFor(p) {
      if (crowd === 'clap' && p.eager < 0.75) return 'clap';
      if (crowd === 'phone' && p.eager < 0.45) return 'phone';
      return 'idle';
    }

    function drawSlide(g, s, t) {
      const x0 = SCREEN.x + 8;
      drawText(g, s.title, x0, SCREEN.y + 6, { color: C.accentDark });
      rect(g, x0, SCREEN.y + 15, SCREEN.w - 16, 1, C.accent);
      rect(g, x0, SCREEN.y + 16, 40, 1, C.accentLight);
      drawText(g, `${i + 1}`, SCREEN.x + SCREEN.w - 6, SCREEN.y + SCREEN.h - 9, { color: '#b0b4c0', align: 'right' });
      if (s.type === 'bar' || s.type === 'line') {
        const n = s.vals.length;
        const slot = (PLOT_R - AX - 4) / n;
        drawText(g, `↑ ${cap(s.y)}`, AX - 4, 40, { color: INK });
        for (let v = 2.5; v <= 10; v += 2.5) for (let x = AX + 2; x < PLOT_R; x += 4) rect(g, x, BY - Math.round(v * UNIT), 2, 1, '#dcdfe8');
        rect(g, AX, 50, 1, BY - 50 + 1, INK);
        rect(g, AX, BY, PLOT_R - AX, 1, INK);
        const pts = s.vals.map((v, k) => ({ x: Math.round(AX + 4 + k * slot + slot / 2), y: BY - Math.round(v * UNIT) }));
        s.xs.labels.forEach((l, k) => drawText(g, l, pts[k].x, BY + 3, { align: 'center', color: '#5d616e' }));
        if (s.type === 'bar') {
          const bw = Math.floor(slot * 0.55);
          pts.forEach((p) => {
            const bx = p.x - Math.floor(bw / 2);
            rect(g, bx, p.y, bw, BY - p.y, C.accent);
            rect(g, bx, p.y, 2, BY - p.y, C.accentLight);
            rect(g, bx + bw - 2, p.y, 2, BY - p.y, C.accentDark);
            rect(g, bx, p.y, bw, 1, INK);
          });
        } else {
          for (let k = 0; k + 1 < pts.length; k++) pline(g, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y, '#e2504a');
          pts.forEach((p) => {
            rect(g, p.x - 2, p.y - 2, 6, 6, INK);
            rect(g, p.x - 1, p.y - 1, 4, 4, '#ffffff');
          });
        }
      } else if (s.type === 'pie') {
        for (const [x, y, w, col] of s.runs) rect(g, x, y, w, 1, col);
        s.labels.forEach((l, k) => {
          const ly = 54 + k * 16;
          rect(g, 224, ly, 9, 9, INK);
          rect(g, 225, ly + 1, 7, 7, PIE_COLS[k]);
          drawText(g, l, 238, ly + 1, { color: INK });
          drawText(g, `${s.vals[k]}%`, 382, ly + 1, { color: '#5d616e', align: 'right' });
        });
      } else if (s.type === 'matrix') {
        const bx = 160;
        const by = 46;
        rect(g, bx, by, 100, 38, '#eef0f5');
        rect(g, bx + 100, by, 100, 38, '#dff3df');
        rect(g, bx, by + 38, 100, 38, '#f7e6e6');
        rect(g, bx + 100, by + 38, 100, 38, '#eef0f5');
        for (let x = bx; x < bx + 200; x += 4) rect(g, x, by + 38, 2, 1, '#9aa0b8');
        for (let y = by; y < by + 76; y += 4) rect(g, bx + 100, y, 1, 2, '#9aa0b8');
        frame(g, bx, by, 200, 76, INK);
        drawText(g, 'high', bx - 4, by + 1, { align: 'right', color: '#7a7d8d' });
        drawText(g, `↑ ${cap(s.B)}`, bx - 4, by + 34, { align: 'right', color: INK });
        drawText(g, 'low', bx - 4, by + 68, { align: 'right', color: '#7a7d8d' });
        drawText(g, 'low', bx, by + 79, { color: '#7a7d8d' });
        drawText(g, 'high', bx + 200, by + 79, { align: 'right', color: '#7a7d8d' });
        drawText(g, `${cap(s.A)} →`, bx + 100, by + 79, { align: 'center', color: INK });
        const dot = (p, col, label) => {
          rect(g, p.x - 3, p.y - 3, 7, 7, INK);
          rect(g, p.x - 2, p.y - 2, 5, 5, col);
          rect(g, p.x - 1, p.y - 1, 1, 1, '#ffffff');
          drawText(g, label, p.x + 6, p.y - 3, { color: INK });
        };
        dot(s.them, '#9aa0b8', 'THEM');
        dot(s.us, Math.floor(t * 3) % 2 ? '#e2504a' : '#ff7a6a', 'US');
      } else if (s.type === 'funnel') {
        const cx = 260;
        const ws = s.vals.map((v) => 30 + Math.round((120 * v) / s.vals[0]));
        ws.forEach((w, k) => {
          const y = 46 + k * 20;
          const wNext = k + 1 < ws.length ? ws[k + 1] : Math.round(w * 0.75);
          for (let r = 0; r < 18; r++) {
            const ww = Math.round(w + ((wNext - w) * r) / 18);
            rect(g, cx - Math.floor(ww / 2), y + r, ww, 1, r === 0 ? 'rgba(255,255,255,0.55)' : FUNNEL_COLS[k]);
          }
          rect(g, cx - Math.floor(w / 2), y, w, 1, FUNNEL_COLS[k]);
          drawText(g, s.stages[k], 180, y + 5, { align: 'right', color: INK });
          drawText(g, String(s.vals[k]), 342, y + 5, { color: '#5d616e' });
        });
      } else if (s.type === 'venn') {
        for (const [x, y, w, col] of s.runs) rect(g, x, y, w, 1, col);
        drawText(g, s.a, 204, 47, { align: 'center', color: INK });
        drawText(g, s.b, 276, 47, { align: 'center', color: INK });
        rect(g, 240, 100, 1, 24, INK);
        rect(g, 239, 99, 3, 3, INK);
        drawText(g, s.c, 240, 125, { align: 'center', color: INK, shadow: null });
      }
    }

    return inst;
  },
};
