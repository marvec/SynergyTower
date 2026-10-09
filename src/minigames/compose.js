// Write the Email: fill each blank in the email with the right corporate phrase.
import { W, C, rect, drawText, measureText, backdrop, header, timerBar, monitor, choiceBox, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { COMPOSE, SUBJECTS } from '../data/mg-compose.js';

const inside = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** Number keys, arrows (2-column grid) + confirm, or click. Returns picked index or -1. */
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
  id: 'compose',
  name: 'Write the Email',
  help: 'Fill each blank with the right phrase. Keys 1-4 or arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const dept = theme?.dept;
    const count = Math.round(byDiff(d, 5, 9));
    const optCount = d < 0.4 ? 3 : 4;
    const total = byDiff(d, 60, 42);
    const deptPool = COMPOSE[dept] || [];
    const fromDept = rng.sample(deptPool, Math.min(deptPool.length, Math.ceil(count / 2)));
    const fromGen = rng.sample(COMPOSE.general, count - fromDept.length);
    const items = rng.shuffle([...fromDept, ...fromGen]).map((it) => {
      const opts = rng.shuffle([it.a, ...rng.sample(it.w, optCount - 1)]);
      return { ...it, opts, right: opts.indexOf(it.a), chosen: -1 };
    });
    const subject = SUBJECTS[dept] || SUBJECTS.default;
    const fl = new Floaters();
    const shake = new Shake();
    const st = { focus: 0 };
    let i = 0;
    let left = total;
    let correct = 0;
    let reveal = 0;

    const optRects = () => {
      const r = [];
      for (let k = 0; k < optCount; k++) r.push({ x: 30 + (k % 2) * 215, y: 150 + Math.floor(k / 2) * 30, w: 205, h: 25 });
      return r;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        left -= dt;
        if (left <= 0) return finish(inst, correct / count);
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            i++;
            st.focus = 0;
            if (i >= items.length) finish(inst, correct / count);
          }
          return;
        }
        const k = pickChoice(input, optRects(), st);
        if (k < 0) return;
        const item = items[i];
        item.chosen = k;
        if (k === item.right) {
          correct++;
          sfx('good');
          fl.add('Nice!', W / 2, 140, C.good);
        } else {
          sfx('bad');
          shake.hit();
          fl.add('Unprofessional!', W / 2, 140, C.bad);
        }
        reveal = 0.6;
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        header(g, theme?.title || 'Write the Email', `${Math.min(i + 1, count)}/${count}`);
        timerBar(g, left, total);
        const s = monitor(g, 40, 28, 400, 104, '#f7f9fc');
        rect(g, s.x, s.y, s.w, 11, C.accent);
        drawText(g, 'New Message', s.x + 4, s.y + 2);
        drawText(g, 'Send', s.x + s.w - 4, s.y + 2, { align: 'right', color: C.gold });
        drawText(g, 'To: team@synergy.corp', s.x + 4, s.y + 14, { color: '#6a7080' });
        drawText(g, 'Subject: ' + subject, s.x + 4, s.y + 24, { color: '#6a7080' });
        rect(g, s.x + 4, s.y + 33, s.w - 8, 1, '#d5dce8');
        // Body: up to 5 previous sentences + current one.
        const first = Math.max(0, Math.min(i, items.length - 1) - 5);
        let y = s.y + 37;
        for (let k = first; k <= Math.min(i, items.length - 1); k++) {
          const it = items[k];
          const [pre, post] = it.t.split('___');
          const current = k === i;
          let fill;
          let col;
          if (it.chosen >= 0) {
            fill = it.opts[it.chosen];
            col = it.chosen === it.right ? '#2f8a3e' : C.bad;
          } else {
            fill = '_____';
            col = C.accent;
          }
          let x = s.x + 6;
          const base = current ? C.ink : '#8a90a0';
          x += drawText(g, pre, x, y, { color: base }) + 1;
          if (current && it.chosen < 0) rect(g, x - 1, y - 1, measureText(fill) + 2, 9, '#fff3c4');
          x += drawText(g, fill, x, y, { color: col }) + 1;
          drawText(g, post, x, y, { color: base });
          y += 11;
        }
        if (i < items.length) {
          optRects().forEach((r, k) => {
            const it = items[i];
            let state = st.focus === k ? 'focus' : 'idle';
            if (reveal > 0) state = k === it.right ? 'right' : k === it.chosen ? 'wrong' : 'idle';
            choiceBox(g, r.x, r.y, r.w, r.h, String(k + 1), it.opts[k], state);
          });
        }
        drawText(g, `Correct: ${correct}`, 30, 240, { color: C.text, shadow: C.border });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
