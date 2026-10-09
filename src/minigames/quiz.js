// Small Talk / Compliance quiz: multiple-choice questions from department banks plus water-cooler small talk.
import { W, C, rect, panel, drawText, drawWrapped, backdrop, header, timerBar, choiceBox, face, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { QUIZ } from '../data/mg-quiz.js';

const inside = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

function pickChoice(input, rects, st) {
  const n = rects.length;
  for (let k = 0; k < n; k++) if (input.pressedExact(String(k + 1))) return k;
  const p = input.pointer;
  let hit = -1;
  rects.forEach((r, k) => {
    if (inside(p, r)) {
      if (p.moved) st.focus = k;
      if (p.clicked) hit = k;
    }
  });
  if (hit >= 0) return hit;
  if (input.pressed('ArrowRight')) st.focus = (st.focus + 1) % n;
  if (input.pressed('ArrowLeft')) st.focus = (st.focus + n - 1) % n;
  if (input.pressed('ArrowDown') && st.focus + 2 < n) st.focus += 2;
  if (input.pressed('ArrowUp') && st.focus - 2 >= 0) st.focus -= 2;
  if (input.confirm()) return st.focus;
  return -1;
}

export default {
  id: 'quiz',
  name: 'Corporate Quiz',
  help: 'Pick the best answer before time runs out. Keys 1-4 or arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 5, 8));
    const perQ = byDiff(d, 12, 6);
    const optCount = d < 0.3 ? 3 : 4;
    const deptBank = QUIZ[theme?.dept] || [];
    const nDept = Math.min(deptBank.length, Math.round(count * 0.65));
    const picked = rng.shuffle([...rng.sample(deptBank, nDept), ...rng.sample(QUIZ.general, count - nDept)]);
    const questions = picked.map((q) => {
      const opts = rng.shuffle([q.a, ...rng.sample(q.w, optCount - 1)]);
      return { q: q.q, opts, right: opts.indexOf(q.a), chosen: -1, seed: rng.int(0, 255) };
    });
    const fl = new Floaters();
    const shake = new Shake();
    const st = { focus: 0 };
    let i = 0;
    let left = perQ;
    let correct = 0;
    let streak = 0;
    let reveal = 0;

    const optRects = () => {
      const r = [];
      for (let k = 0; k < optCount; k++) r.push({ x: 20 + (k % 2) * 225, y: 100 + Math.floor(k / 2) * 34, w: 215, h: 28 });
      return r;
    };

    const answer = (k) => {
      const q = questions[i];
      q.chosen = k;
      if (k === q.right) {
        correct++;
        streak++;
        sfx('good');
        fl.add(streak >= 3 ? `Streak x${streak}!` : 'Correct!', W / 2, 92, C.good);
      } else {
        streak = 0;
        sfx('bad');
        shake.hit();
        fl.add(k < 0 ? 'Out of time!' : 'Awkward...', W / 2, 92, C.bad);
      }
      reveal = 0.9;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            i++;
            left = perQ;
            st.focus = 0;
            if (i >= questions.length) finish(inst, correct / questions.length);
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
        backdrop(g, { wall: '#45405a' });
        header(g, theme?.title || 'Corporate Quiz', `${Math.min(i + 1, questions.length)}/${questions.length}`);
        timerBar(g, reveal > 0 ? 0 : left, perQ);
        const q = questions[Math.min(i, questions.length - 1)];
        // Colleague + speech bubble.
        rect(g, 22, 30, 32, 40, C.panelDark);
        face(g, 26, 36, q.seed, 2);
        panel(g, 62, 26, 398, 50, { fill: '#ffffff', light: '#ffffff', dark: '#c8cfdc' });
        rect(g, 56, 44, 7, 6, '#ffffff');
        drawWrapped(g, q.q, 70, 33, 382, { color: C.ink });
        optRects().forEach((r, k) => {
          let state = st.focus === k ? 'focus' : 'idle';
          if (reveal > 0) state = k === q.right ? 'right' : k === q.chosen ? 'wrong' : 'idle';
          choiceBox(g, r.x, r.y, r.w, r.h, String(k + 1), q.opts[k], state);
        });
        drawText(g, `Correct: ${correct}`, 20, 236, { color: C.text, shadow: C.border });
        if (streak >= 2) drawText(g, `Streak x${streak}`, W - 20, 236, { color: C.gold, align: 'right', shadow: C.border });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
