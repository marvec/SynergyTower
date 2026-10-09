// Expense Report: add up the receipts (or work out the remaining budget) and pick the right total.
import { W, C, rect, frame, panel, drawText, backdrop, header, timerBar, paper, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';

const ITEMS = {
  default: ['Coffee', 'Snacks', 'Pens', 'Taxi', 'Lunch', 'Cake', 'Sticky notes', 'Batteries', 'Parking', 'Printer ink'],
  finance: ['Taxi', 'Hotel', 'Dinner', 'Flight', 'Coffee', 'Printer ink', 'Client lunch', 'Parking', 'Software', 'Train'],
  sales: ['Golf', 'Steak dinner', 'Gift basket', 'Demo kit', 'Mileage', 'Booth fee', 'Client drinks', 'Swag'],
  marketing: ['Ad spend', 'Stickers', 'Photo shoot', 'Influencer', 'Banner', 'T-shirts', 'Balloons'],
  it: ['Cables', 'Mouse', 'Keyboard', 'License', 'Adapter', 'RAM', 'Pizza (late)'],
  exec: ['Yacht fuel', 'Caviar', 'Helicopter', 'Golf club', 'Spa day', 'Truffles', 'Limo'],
};

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
  id: 'math',
  name: 'Expense Report',
  help: 'Add up the receipts and pick the right amount. Keys 1-4 or arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const names = ITEMS[theme?.dept] || ITEMS.default;
    const count = Math.round(byDiff(d, 5, 9));
    const optCount = d < 0.4 ? 3 : 4;
    const total = byDiff(d, 65, 50);

    const makeReport = () => {
      const n = Math.round(byDiff(d, 2, 4.6));
      const maxV = Math.round(byDiff(d, 12, 60));
      const receipts = rng.sample(names, n).map((name) => ({ name, v: rng.int(1, maxV), tilt: rng.int(-3, 3) }));
      const sum = receipts.reduce((a, r) => a + r.v, 0);
      let budget = 0;
      let answer = sum;
      if (d > 0.4 && rng.chance(0.3)) {
        budget = Math.ceil((sum + rng.int(5, 40)) / 10) * 10;
        answer = budget - sum;
      }
      const opts = new Set([answer]);
      const deltas = [1, -1, 2, -2, 10, -10, 5, -5, 3, -3];
      const swapped = Number(String(answer).split('').reverse().join(''));
      if (swapped !== answer && swapped > 0 && rng.chance(0.5)) opts.add(swapped);
      for (const dl of rng.shuffle(deltas)) {
        if (opts.size >= optCount) break;
        if (answer + dl > 0) opts.add(answer + dl);
      }
      for (let m = 1; opts.size < optCount; m++) opts.add(answer + m * 7);
      const list = rng.shuffle([...opts].slice(0, optCount));
      if (!list.includes(answer)) list[0] = answer;
      return { receipts, budget, answer, opts: list, right: list.indexOf(answer), chosen: -1 };
    };
    const reports = Array.from({ length: count }, makeReport);
    const fl = new Floaters();
    const shake = new Shake();
    const st = { focus: 0 };
    let i = 0;
    let left = total;
    let correct = 0;
    let reveal = 0;

    const optRects = () => {
      const r = [];
      for (let k = 0; k < optCount; k++) r.push({ x: 80 + (k % 2) * 165, y: 128 + Math.floor(k / 2) * 34, w: 155, h: 28 });
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
            if (i >= reports.length) finish(inst, correct / count);
          }
          return;
        }
        const k = pickChoice(input, optRects(), st);
        if (k < 0) return;
        const rep = reports[i];
        rep.chosen = k;
        if (k === rep.right) {
          correct++;
          sfx('coin');
          fl.add('Approved!', W / 2, 118, C.good);
        } else {
          sfx('bad');
          shake.hit();
          fl.add('Audit flag!', W / 2, 118, C.bad);
        }
        reveal = 0.7;
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3d4a5a' });
        header(g, theme?.title || 'Expense Report', `${Math.min(i + 1, count)}/${count}  ok ${correct}`);
        timerBar(g, left, total);
        const rep = reports[Math.min(i, reports.length - 1)];
        const cards = rep.receipts.length + (rep.budget ? 1 : 0);
        const gap = 6;
        const cw = Math.min(78, Math.floor((464 - (cards - 1) * gap) / cards));
        let x = W / 2 - (cards * cw + (cards - 1) * gap) / 2;
        const y = 26;
        if (rep.budget) {
          rect(g, x + 2, y + 2, cw, 62, 'rgba(0,0,0,0.3)');
          rect(g, x, y, cw, 62, '#cfe8d4');
          frame(g, x, y, cw, 62, '#5a8a62');
          drawText(g, 'BUDGET', x + cw / 2, y + 6, { align: 'center', color: '#2f6b3a' });
          drawText(g, `$${rep.budget}`, x + cw / 2, y + 28, { align: 'center', color: C.ink, scale: 2 });
          x += cw + gap;
        }
        for (const r of rep.receipts) {
          const ry = y + r.tilt;
          paper(g, x, ry, cw, 62);
          drawText(g, 'RECEIPT', x + cw / 2, ry + 5, { align: 'center', color: '#8a8270' });
          rect(g, x + 6, ry + 14, cw - 12, 1, '#c8c0aa');
          drawText(g, r.name.slice(0, cw < 78 ? 12 : 14), x + cw / 2, ry + 19, { align: 'center', color: C.ink });
          drawText(g, `$${r.v}`, x + cw / 2, ry + 36, { align: 'center', color: C.ink, scale: 2 });
          for (let zx = x; zx < x + cw; zx += 4) rect(g, zx, ry + 60, 2, 2, '#b8b09a');
          x += cw + gap;
        }
        const q = rep.budget ? 'How much budget is left?' : 'What is the total?';
        drawText(g, q, W / 2, 104, { align: 'center', color: C.text, shadow: C.border });
        optRects().forEach((r, k) => {
          let fill = st.focus === k ? C.panelLight : C.panel;
          if (reveal > 0) fill = k === rep.right ? '#2f6b3a' : k === rep.chosen ? '#7a2b2b' : C.panel;
          panel(g, r.x, r.y, r.w, r.h, { fill });
          if (st.focus === k && reveal <= 0) frame(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, C.gold);
          rect(g, r.x + 4, r.y + 8, 11, 11, C.accent);
          drawText(g, String(k + 1), r.x + 10, r.y + 10, { align: 'center' });
          drawText(g, `$${rep.opts[k]}`, r.x + r.w / 2 + 6, r.y + 7, { align: 'center', scale: 2 });
        });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
