// HR Performance Review: the gate before every promotion. Give HR the answers they want to hear;
// one question checks that you know your own numbers. Pass mark: REVIEW_PASS_SCORE.
// Not assigned to stations; FloorScene opens it from the HR desk.
import { C, rect, panel, paper, drawText, drawWrapped, backdrop, header, timerBar, face, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { REVIEW } from '../data/mg-review.js';
import { REVIEW_PASS_SCORE } from '../core/economy.js';
import { DEPARTMENTS, titleForFloor, departmentForFloor } from '../data/departments.js';

const inside = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** A question about the player's own career, so the review feels personal. */
function personalQuestion(stats, rng) {
  const kind = rng.pick(['stars', 'title', 'dept']);
  if (kind === 'stars') {
    const right = String(stats.stars);
    const wrong = new Set();
    while (wrong.size < 3) {
      const v = Math.max(0, stats.stars + rng.pick([-7, -5, -3, -2, 2, 3, 5, 8]));
      if (String(v) !== right) wrong.add(String(v));
    }
    return { q: `How many KPI stars did you earn on floor ${stats.floor}?`, a: right, w: [...wrong] };
  }
  if (kind === 'title') {
    const others = new Set();
    while (others.size < 3) {
      const t = titleForFloor(rng.int(1, 40));
      if (t !== stats.title) others.add(t);
    }
    return { q: 'Remind me, what is your job title?', a: stats.title, w: [...others] };
  }
  const dept = departmentForFloor(stats.floor).name;
  return { q: 'Which department are you in, again?', a: dept, w: rng.sample(DEPARTMENTS.map((d) => d.name).filter((n) => n !== dept), 3) };
}

export default {
  id: 'review',
  name: 'Performance Review',
  help: `Tell HR what they want to hear. Score ${Math.round(REVIEW_PASS_SCORE * 100)}% to pass. Keys 1-4, arrows + Space, or click.`,
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 5, 8));
    const perQ = byDiff(d, 13, 7);
    const optCount = d < 0.25 ? 3 : 4;
    const pool = rng.sample(REVIEW, count);
    if (theme?.stats) pool.splice(rng.int(1, count - 1), 1, personalQuestion(theme.stats, rng));
    const questions = pool.map((q) => {
      const opts = rng.shuffle([q.a, ...rng.sample(q.w, optCount - 1)]);
      return { q: q.q, opts, right: opts.indexOf(q.a), chosen: -1 };
    });
    const repSeed = rng.int(0, 255);
    const fl = new Floaters();
    const shake = new Shake();
    let focus = 0;
    let i = 0;
    let left = perQ;
    let correct = 0;
    let reveal = 0;
    const results = [];
    const rects = () => questions[0].opts.map((_, k) => ({ x: 16, y: 104 + k * 27, w: 300, h: 23 }));

    const answer = (k) => {
      const q = questions[i];
      q.chosen = k;
      const ok = k === q.right;
      results.push(ok);
      if (ok) {
        correct++;
        sfx('good');
        fl.add(rng.pick(['*scribbles*', 'Excellent.', 'Noted!', 'Very aligned.']), 166, 96, C.good);
      } else {
        sfx('bad');
        shake.hit();
        fl.add(k < 0 ? 'Silence noted.' : rng.pick(['Hmm...', 'Concerning.', '*frowns*']), 166, 96, C.bad);
      }
      reveal = 1.1;
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
            focus = 0;
            if (i >= questions.length) finish(inst, correct / questions.length);
          }
          return;
        }
        left -= dt;
        if (left <= 0) return answer(-1);
        const rs = rects();
        for (let k = 0; k < rs.length; k++) if (input.pressedExact(String(k + 1))) return answer(k);
        const p = input.pointer;
        for (let k = 0; k < rs.length; k++)
          if (inside(p, rs[k])) {
            if (p.moved) focus = k;
            if (p.clicked) return answer(k);
          }
        if (input.pressed('ArrowDown')) focus = (focus + 1) % rs.length;
        if (input.pressed('ArrowUp')) focus = (focus + rs.length - 1) % rs.length;
        if (input.confirm()) answer(focus);
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#4a4060', desk: '#8a6a4a' });
        header(g, theme?.title || 'Performance Review', `${Math.min(i + 1, questions.length)}/${questions.length}`);
        timerBar(g, reveal > 0 ? 0 : left, perQ);
        const q = questions[Math.min(i, questions.length - 1)];
        // HR rep + question bubble.
        rect(g, 16, 28, 44, 56, C.panelDark);
        face(g, 20, 34, repSeed, 3);
        drawText(g, 'HR', 38, 88, { align: 'center', color: C.gold, shadow: C.border });
        panel(g, 68, 26, 252, 60, { fill: '#ffffff', light: '#ffffff', dark: '#c8cfdc' });
        rect(g, 61, 46, 8, 7, '#ffffff');
        drawWrapped(g, q.q, 76, 34, 236, { color: C.ink });
        rects().forEach((r, k) => {
          let fill = focus === k ? C.panelLight : C.panel;
          if (reveal > 0) fill = k === q.right ? '#2f6b3a' : k === q.chosen ? '#7a2b2b' : C.panel;
          panel(g, r.x, r.y, r.w, r.h, { fill });
          if (focus === k && reveal <= 0) rect(g, r.x - 1, r.y - 1, 2, r.h + 2, C.gold);
          rect(g, r.x + 3, r.y + 5, 11, 11, C.accent);
          drawText(g, String(k + 1), r.x + 9, r.y + 7, { align: 'center' });
          drawText(g, q.opts[k], r.x + 20, r.y + 7, { color: C.text });
        });
        // The review form, filling up with ticks.
        paper(g, 334, 26, 132, 200);
        drawText(g, 'PERFORMANCE', 400, 32, { align: 'center', color: C.ink });
        drawText(g, 'REVIEW  F-27B', 400, 42, { align: 'center', color: '#6a6050' });
        rect(g, 342, 53, 116, 1, '#b8b09a');
        questions.forEach((_, k) => {
          const y = 60 + k * 16;
          drawText(g, `Q${k + 1}`, 344, y, { color: '#6a6050' });
          rect(g, 366, y + 1, 84, 1, '#d8d0bc');
          rect(g, 440, y - 2, 10, 10, '#6a6050');
          rect(g, 441, y - 1, 8, 8, C.paper);
          if (k < results.length) drawText(g, results[k] ? '+' : 'x', 445, y, { align: 'center', color: results[k] ? '#2a8a3a' : '#c0302a' });
        });
        const need = Math.ceil(questions.length * REVIEW_PASS_SCORE);
        drawText(g, `Pass: ${need}/${questions.length}`, 400, 194, { align: 'center', color: C.ink });
        drawText(g, `Yours: ${correct}`, 400, 206, { align: 'center', color: correct >= need ? '#2a8a3a' : '#6a6050' });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
