// Corporate Jargon Decoder: the boss drops a buzzword; pick what it REALLY means.
// Ported from the Corporate Jargon Quiz in ../corporate (DOM version) to the canvas mini-game contract.
import { W, C, rect, panel, drawText, measureText, backdrop, header, timerBar, choiceBox, face, Floaters, Shake, byDiff, finish, pickChoice } from '../engine/mgkit.js';
import { JARGON } from '../data/mg-jargon.js';

const SPEAKERS = { lobby: 'Office Manager', support: 'Team Lead', sales: 'Sales VP', marketing: 'Brand Director', it: 'Architect', finance: 'CFO', legalhr: 'HR Partner', exec: 'The CEO' };

export default {
  id: 'jargon',
  name: 'Jargon Decoder',
  help: 'The boss says a buzzword. Pick what it REALLY means. Keys 1-4 or arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 5, 8));
    const perQ = byDiff(d, 11, 6);
    const optCount = d < 0.3 ? 3 : 4;
    const speaker = SPEAKERS[theme?.dept] || 'The Boss';
    const bossSeed = rng.int(0, 255);
    const questions = rng.sample(JARGON, count).map((j) => {
      const opts = rng.shuffle([j.a, ...rng.sample(j.w, optCount - 1)]);
      return { p: j.p, a: j.a, opts, right: opts.indexOf(j.a), chosen: -1 };
    });
    const fl = new Floaters();
    const shake = new Shake();
    const st = { focus: 0 };
    let i = 0;
    let left = perQ;
    let correct = 0;
    let streak = 0;
    let reveal = 0;
    let talk = 0;

    const optRects = () => {
      const r = [];
      for (let k = 0; k < optCount; k++) r.push({ x: 20 + (k % 2) * 225, y: 128 + Math.floor(k / 2) * 34, w: 215, h: 28 });
      return r;
    };

    const answer = (k) => {
      const q = questions[i];
      q.chosen = k;
      if (k === q.right) {
        correct++;
        streak++;
        sfx('good');
        fl.add(streak >= 3 ? `Fluent in corporate x${streak}!` : 'Synergised!', W / 2, 118, C.good);
      } else {
        streak = 0;
        sfx('bad');
        shake.hit();
        fl.add(k < 0 ? "Time's up!" : 'Needs more buzzwords', W / 2, 118, C.bad);
      }
      reveal = 1.4;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        talk += dt;
        if (inst.done) return;
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0 || (reveal < 1.1 && (input.confirm() || input.pointer.clicked))) {
            reveal = 0;
            i++;
            left = perQ;
            st.focus = 0;
            talk = 0;
            input.consumeKeys();
            input.consumeClick();
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
        backdrop(g, { wall: '#3d4a5e' });
        header(g, theme?.title || 'Jargon Decoder', `${Math.min(i + 1, questions.length)}/${questions.length}`);
        timerBar(g, reveal > 0 ? 0 : left, perQ);
        const q = questions[Math.min(i, questions.length - 1)];

        // Speaker with a talking mouth, then the buzzword in a big speech bubble.
        rect(g, 16, 28, 44, 56, C.panelDark);
        face(g, 20, 34, bossSeed, 3);
        if (reveal <= 0 && Math.floor(talk * 8) % 2 === 0 && talk < 1.5) rect(g, 35, 55, 6, 3, '#3a1a1a');
        drawText(g, speaker, 38, 88, { align: 'center', color: C.gold, shadow: C.border });
        panel(g, 70, 26, 394, 58, { fill: '#ffffff', light: '#ffffff', dark: '#c8cfdc' });
        rect(g, 63, 48, 8, 7, '#ffffff');
        const scale = measureText(`"${q.p}"`, 2) <= 376 ? 2 : 1;
        drawText(g, `"${q.p}"`, 267, scale === 2 ? 46 : 50, { align: 'center', color: C.ink, scale });

        drawText(g, 'What it REALLY means:', 20, 104, { color: C.text, shadow: C.border });
        optRects().forEach((r, k) => {
          let state = st.focus === k ? 'focus' : 'idle';
          if (reveal > 0) state = k === q.right ? 'right' : k === q.chosen ? 'wrong' : 'idle';
          choiceBox(g, r.x, r.y, r.w, r.h, String(k + 1), q.opts[k], state);
        });
        if (reveal > 0) {
          panel(g, 20, 202, 440, 18, { fill: '#2f6b3a' });
          drawText(g, `Translation: ${q.a}`, W / 2, 207, { align: 'center', color: '#ffffff' });
        }
        drawText(g, `Decoded: ${correct}`, 20, 236, { color: C.text, shadow: C.border });
        if (streak >= 2) drawText(g, `Streak x${streak}`, W - 20, 236, { color: C.gold, align: 'right', shadow: C.border });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
