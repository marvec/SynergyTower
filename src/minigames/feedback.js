// 360 Feedback, desk part: fill in the review form for the colleague you just tracked down and talked to.
// The floor part (find them, chat) lives in src/scenes/floorQuest.js and hands over `quest`.
import { W, C, rect, drawText, backdrop, header, timerBar, paper, choiceBox, pickChoice, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { ACHIEVEMENTS, GROWTH_AREAS } from '../data/mg-feedback.js';
import { ROLES, FIRST_NAMES, LAST_NAMES } from '../data/people.js';

const BOXES = [0, 1, 2, 3].map((k) => ({ x: 40 + (k % 2) * 206, y: 150 + Math.floor(k / 2) * 34, w: 194, h: 28 }));

/** Facts a colleague shares in the hallway chat; also used when the game runs without a floor (tests). */
export function feedbackFacts(rng, deptId) {
  return {
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    role: rng.pick(ROLES[deptId] || ROLES.lobby),
    years: rng.int(1, 24),
    achievement: rng.pick(ACHIEVEMENTS),
    growth: rng.pick(GROWTH_AREAS),
    speed: 0.5,
  };
}

export default {
  id: 'feedback',
  name: '360 Feedback',
  quest: 'feedback',
  deskHelp: 'Fill in the 360 form from what your colleague told you. Pick answers with 1-4, arrows + Enter, or the mouse.',
  help: 'Track down the colleague on this floor and chat with them, then come back here and fill in their review from what they said.',
  create({ difficulty: d, rng, theme, sfx = () => {}, quest }) {
    const dept = theme?.dept || 'lobby';
    const q = quest || feedbackFacts(rng, dept);
    const first = q.name.split(' ')[0];
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(byDiff(d, 45, 32));
    const options = (right, pool, n = 4) => {
      const out = new Set([right]);
      for (const x of rng.shuffle([...pool])) if (out.size < n && x !== right) out.add(x);
      return rng.shuffle([...out]);
    };
    const years = (y) => `${y} year${y === 1 ? '' : 's'}`;
    const yearPool = [...new Set([q.years + 1, q.years + 2, Math.max(1, q.years - 1), Math.max(1, q.years - 3), q.years + 5])].filter((y) => y !== q.years).map(years);
    const rolePool = (ROLES[dept] || ROLES.lobby).filter((r) => r !== q.role);
    const all = [
      { text: `What did ${first} achieve this quarter?`, right: q.achievement, opts: options(q.achievement, ACHIEVEMENTS) },
      { text: `What should ${first} work on?`, right: q.growth, opts: options(q.growth, GROWTH_AREAS) },
      { text: `${first}'s job title (for the form)?`, right: q.role, opts: options(q.role, rolePool) },
      { text: `How long has ${first} been with us?`, right: years(q.years), opts: options(years(q.years), yearPool) },
    ];
    const n = Math.round(byDiff(d, 2, 4));
    const questions = all.slice(0, n);
    let idx = 0;
    let correct = 0;
    let answered = null; // { pick, t }
    const st = { focus: 0 };
    const log = [];

    const score = () => clamp((correct / questions.length) * (0.8 + 0.2 * (q.speed ?? 0.5)), 0, 1);

    const inst = {
      done: false,
      score: 0,
      peek: () => questions[idx], // tests: the current question
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        const qq = questions[idx];
        if (answered) {
          answered.t -= dt;
          if (answered.t <= 0) {
            answered = null;
            idx++;
            st.focus = 0;
            if (idx >= questions.length) finish(inst, score());
          }
          return;
        }
        const pick = pickChoice(input, BOXES, st);
        if (pick < 0) return;
        const ok = qq.opts[pick] === qq.right;
        if (ok) {
          correct++;
          sfx('good');
          fl.add('Accurate!', W / 2, 140, C.good);
        } else {
          sfx('bad');
          shake.hit();
          fl.add('That was someone else...', W / 2, 140, C.bad);
        }
        log.push({ q: qq, ok, pick: qq.opts[pick] });
        answered = { pick, t: 0.8 };
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3a3550', desk: '#6b4a32' });
        header(g, theme?.title || '360 Feedback', `Question ${Math.min(idx + 1, questions.length)}/${questions.length}`);
        timerBar(g, total.left, total.total);
        paper(g, 30, 24, W - 60, 112);
        drawText(g, '360 FEEDBACK FORM', 40, 30, { color: C.accentDark });
        drawText(g, `Subject: ${q.name}`, W - 40, 30, { align: 'right', color: '#5a5446' });
        rect(g, 40, 40, W - 80, 1, '#cfc7b2');
        log.forEach((e, i) => {
          drawText(g, e.q.text, 40, 46 + i * 20, { color: '#7a7466' });
          drawText(g, e.pick, 52, 55 + i * 20, { color: e.ok ? '#2f6b3a' : '#a33b30' });
        });
        const qq = questions[idx];
        if (qq) {
          drawText(g, qq.text, W / 2, 124, { align: 'center', color: C.ink });
          qq.opts.forEach((o, k) => {
            let state = st.focus === k ? 'focus' : 'idle';
            if (answered) state = o === qq.right ? 'right' : k === answered.pick ? 'wrong' : 'idle';
            choiceBox(g, BOXES[k].x, BOXES[k].y, BOXES[k].w, BOXES[k].h, String(k + 1), o, state);
          });
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
