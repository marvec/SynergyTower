// Compliance & Ethics training: the way off compliance hold (core/conduct.js). An e-learning module on the HR
// laptop, one multiple-choice question per slide; the certificate on the right fills up. Pass mark:
// COMPLIANCE_PASS_SCORE (failing demotes, see completeTraining). Never assigned to stations; FloorScene opens it
// from the HR desk while the career is on hold.
import { C, rect, paper, drawText, drawWrapped, backdrop, header, timerBar, monitor, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { COMPLIANCE } from '../data/conduct.js';
import { COMPLIANCE_PASS_SCORE } from '../core/economy.js';

const inside = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
const MODULES = ['Boundaries 101', 'No Means No', 'Respect at Work', 'Speaking Up', 'Gifts & Bribes', 'Data & Devices', 'Kitchen Law'];

export default {
  id: 'compliance',
  name: 'Compliance & Ethics Training',
  help: `Mandatory training. Pick the right answer; ${Math.round(COMPLIANCE_PASS_SCORE * 100)}% to pass. Keys 1-4, arrows + Space, or click.`,
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 6, 8));
    const perQ = byDiff(d, 14, 8);
    const optCount = d < 0.25 ? 3 : 4;
    // The first three questions are always about the reason you are here.
    const core = rng.sample(COMPLIANCE.slice(0, 5), 3);
    const rest = rng.sample(COMPLIANCE.filter((q) => !core.includes(q)), count - 3);
    const questions = [...core, ...rest].map((q, k) => {
      const opts = rng.shuffle([q.a, ...rng.sample(q.w, optCount - 1)]);
      return { q: q.q, opts, right: opts.indexOf(q.a), chosen: -1, module: MODULES[k % MODULES.length] };
    });
    const fl = new Floaters();
    const shake = new Shake();
    let focus = 0;
    let i = 0;
    let left = perQ;
    let correct = 0;
    let reveal = 0;
    const results = [];
    const rects = () => questions[0].opts.map((_, k) => ({ x: 16, y: 106 + k * 27, w: 300, h: 23 }));

    const answer = (k) => {
      const q = questions[i];
      q.chosen = k;
      const ok = k === q.right;
      results.push(ok);
      if (ok) {
        correct++;
        sfx('good');
        fl.add(rng.pick(['Correct!', 'Compliant.', 'Exactly.', 'Well done.']), 166, 96, C.good);
      } else {
        sfx('bad');
        shake.hit();
        fl.add(k < 0 ? 'Time is up.' : rng.pick(['Incorrect.', 'Please review.', 'No.', '*HR sighs*']), 166, 96, C.bad);
      }
      reveal = 1.2;
    };

    const inst = {
      done: false,
      score: 0,
      /** For tests: the right answer of the current question. */
      peek: () => questions[Math.min(i, questions.length - 1)].right,
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
        backdrop(g, { wall: '#3a4a5a', desk: '#7a6a5a' });
        header(g, theme?.title || 'Compliance Training', `${Math.min(i + 1, questions.length)}/${questions.length}`);
        timerBar(g, reveal > 0 ? 0 : left, perQ);
        const q = questions[Math.min(i, questions.length - 1)];
        // The e-learning slide on the HR laptop.
        const sc = monitor(g, 20, 28, 292, 62, '#f4f7fb');
        rect(g, sc.x, sc.y, sc.w, 10, '#2f5d8a');
        drawText(g, `MODULE ${Math.min(i + 1, questions.length)}: ${q.module.toUpperCase()}`, sc.x + 4, sc.y + 2, { color: '#ffffff' });
        drawWrapped(g, q.q, sc.x + 6, sc.y + 16, sc.w - 12, { color: C.ink });
        rects().forEach((r, k) => {
          let fill = focus === k ? C.panelLight : C.panel;
          if (reveal > 0) fill = k === q.right ? '#2f6b3a' : k === q.chosen ? '#7a2b2b' : C.panel;
          rect(g, r.x, r.y, r.w, r.h, C.border);
          rect(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, fill);
          if (focus === k && reveal <= 0) rect(g, r.x - 1, r.y - 1, 2, r.h + 2, C.gold);
          rect(g, r.x + 3, r.y + 5, 11, 11, '#2f5d8a');
          drawText(g, String(k + 1), r.x + 9, r.y + 7, { align: 'center' });
          drawText(g, q.opts[k], r.x + 20, r.y + 7, { color: C.text });
        });
        // The certificate, one tick per module.
        paper(g, 334, 26, 132, 200);
        drawText(g, 'CERTIFICATE', 400, 32, { align: 'center', color: C.ink });
        drawText(g, 'OF COMPLETION', 400, 42, { align: 'center', color: '#6a6050' });
        rect(g, 342, 53, 116, 1, '#b8b09a');
        questions.forEach((qq, k) => {
          const y = 60 + k * 15;
          drawText(g, qq.module.length > 15 ? `${qq.module.slice(0, 14)}.` : qq.module, 344, y, { color: '#6a6050' });
          rect(g, 440, y - 2, 10, 10, '#6a6050');
          rect(g, 441, y - 1, 8, 8, C.paper);
          if (k < results.length) drawText(g, results[k] ? '+' : 'x', 445, y, { align: 'center', color: results[k] ? '#2a8a3a' : '#c0302a' });
        });
        const need = Math.ceil(questions.length * COMPLIANCE_PASS_SCORE);
        drawText(g, `Pass: ${need}/${questions.length}`, 400, 186, { align: 'center', color: C.ink });
        drawText(g, `Yours: ${correct}`, 400, 198, { align: 'center', color: correct >= need ? '#2a8a3a' : '#6a6050' });
        // The seal, once the pass mark is reached.
        if (correct >= need) {
          rect(g, 444, 204, 14, 14, '#b8302a');
          rect(g, 446, 206, 10, 10, '#d8483a');
          drawText(g, 'OK', 451, 208, { align: 'center', color: '#ffe8a0' });
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
