// Expense Fraud Detective: receipts land on your desk one at a time. Stamp each APPROVE or REJECT before its timer
// runs out. Jet skis are not team-building. At high difficulty, already-reimbursed receipts come back for seconds.
import { W, H, C, rect, frame, panel, drawText, drawWrapped, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { RECEIPTS, SUBMITTERS, RIGHT_LINES, WRONG_LINES } from '../data/mg-expense.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RX = 152; // receipt left edge
const RW = 176;
const RY = 24;
const BTN = { reject: { x: 22, y: 52, w: 108, h: 100 }, approve: { x: 350, y: 52, w: 108, h: 100 } };
const INK = '#2a2a35';
const PEN = '#2f4aa0';

const money = (n) => {
  const [a, b] = n.toFixed(2).split('.');
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + b;
};
const inBox = (p, b) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

export default {
  id: 'expense',
  name: 'Expense Fraud Detective',
  help: 'Check each receipt: APPROVE (A / Right / click) the legit ones, REJECT (R / Left / click) the fraud. Watch for duplicates!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const dept = theme?.dept;
    const count = Math.round(byDiff(d, 8, 13));
    const perItem = byDiff(d, 8, 4.5);
    const READ_T = 0.45; // stamps unlock once you had a moment to read; mashing before that is penalised
    const dupCount = d > 0.85 ? 2 : d > 0.6 ? 1 : 0;
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(90); // safety cap; a round normally ends sooner

    // Department-weighted sampling without replacement.
    const weight = (r) => (r.dept === dept ? 3 : r.dept ? 0.7 : 1.2);
    const draw = (pool, n) => {
      const left = pool.slice();
      const out = [];
      while (out.length < n && left.length) {
        const sum = left.reduce((s, r) => s + weight(r), 0);
        let x = rng.float(0, sum);
        let k = 0;
        while (k < left.length - 1 && (x -= weight(left[k])) > 0) k++;
        out.push(left.splice(k, 1)[0]);
      }
      return out;
    };
    const main = count - dupCount;
    const fraudN = Math.round(count * rng.float(0.42, 0.58)) - dupCount;
    const picked = rng.shuffle([...draw(RECEIPTS.filter((r) => r.fraud), fraudN), ...draw(RECEIPTS.filter((r) => !r.fraud), main - fraudN)]);
    const queue = picked.map((r) => ({
      ...r,
      day: r.day || rng.pick(DAYS),
      date: rng.int(1, 28),
      month: rng.pick(MONTHS),
      time: `${rng.int(8, 21)}:${String(rng.int(0, 59)).padStart(2, '0')}`,
      no: String(rng.int(1000, 99999)).padStart(6, '0'),
      by: rng.pick(SUBMITTERS),
    }));
    // Duplicates: an earlier legit receipt shows up again, identical, a few receipts later.
    for (let k = 0; k < dupCount; k++) {
      const cands = queue.map((r, i) => (!r.fraud && !r.dup && i < queue.length - 1 ? i : -1)).filter((i) => i >= 0);
      if (!cands.length) break;
      const src = rng.pick(cands);
      const at = rng.int(src + 2, queue.length);
      queue.splice(at, 0, { ...queue[src], fraud: true, dup: true, tell: `Already reimbursed! Same receipt #${queue[src].no}.` });
    }
    const n = queue.length;
    const results = []; // true / false per receipt

    let i = 0;
    let phase = 'in'; // in → decide → stamp → result → in ...
    let pt = 0; // time in phase
    let left = perItem;
    let correct = 0;
    let wrong = 0;
    let call = null; // 'approve' | 'reject' | null (timeout)
    let verdict = null; // { ok, head, tell }
    let hover = null;
    let spam = 0;

    const score = () => clamp((correct - 0.5 * wrong) / n - 0.04 * spam, 0, 1);

    function decide(c) {
      call = c;
      phase = 'stamp';
      pt = 0;
      sfx('click');
    }
    function judge() {
      const r = queue[i];
      const ok = call !== null && (call === 'reject') === r.fraud;
      results.push(ok);
      if (ok) {
        correct++;
        sfx(r.fraud ? 'coin' : 'good');
        fl.add(r.fraud ? 'Fraud caught!' : 'Approved', RX + RW / 2, RY + 70, C.good);
      } else {
        wrong++;
        sfx('bad');
        shake.hit();
      }
      const head = call === null ? "Time's up!" : ok ? rng.pick(RIGHT_LINES) : rng.pick(WRONG_LINES);
      verdict = { ok, head: `${head} ${r.fraud ? 'It was FRAUD.' : 'It was legit.'}`, tell: r.tell };
      phase = 'result';
      pt = 0;
    }
    function next() {
      i++;
      call = null;
      verdict = null;
      left = perItem;
      phase = 'in';
      pt = 0;
      if (i >= n) finish(inst, score());
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (total.update(dt)) {
          wrong += n - results.length; // anything unprocessed counts as a miss
          return finish(inst, score());
        }
        pt += dt;
        const p = input.pointer;
        hover = inBox(p, BTN.approve) ? 'approve' : inBox(p, BTN.reject) ? 'reject' : null;
        let wantA = input.pressedExact('a') || input.pressedExact('ArrowRight') || (p.clicked && hover === 'approve');
        let wantR = input.pressedExact('r') || input.pressedExact('ArrowLeft') || (p.clicked && hover === 'reject');
        const locked = phase === 'in' || (phase === 'decide' && pt < READ_T);
        if (locked && (wantA || wantR)) {
          spam++;
          sfx('click');
          if (!fl.list.some((f) => f.text === 'Read it first!')) fl.add('Read it first!', RX + RW / 2, RY + 50, C.warn);
          wantA = wantR = false;
        }
        if (phase === 'in') {
          if (pt >= 0.3) {
            phase = 'decide';
            pt = 0;
            input.consumeKeys();
            input.consumeClick();
          }
          return;
        }
        if (phase === 'decide') {
          left -= dt;
          if (wantA) return decide('approve');
          if (wantR) return decide('reject');
          if (left <= 0) judge();
          return;
        }
        if (phase === 'stamp') {
          if (pt >= 0.3) judge();
          return;
        }
        if (phase === 'result') {
          const hold = verdict.ok ? 1.1 : call === null ? 1.4 : 2.0;
          if (pt >= hold || (pt > 0.45 && (input.confirm() || p.clicked))) {
            input.consumeKeys();
            input.consumeClick();
            next();
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        drawDesk(g);
        header(g, theme?.title || 'Expense Fraud Detective', `Receipt ${Math.min(i + 1, n)}/${n}`);
        timerBar(g, phase === 'decide' ? left : phase === 'in' ? perItem : 0, perItem);
        const active = phase === 'decide' && pt >= READ_T;
        drawButton(g, 'reject', hover === 'reject', active);
        drawButton(g, 'approve', hover === 'approve', active);
        if (i < n) {
          const r = queue[i];
          const dropY = phase === 'in' ? Math.round(-180 * (1 - pt / 0.3) ** 2) : 0;
          const rh = drawReceipt(g, r, RY + dropY);
          // Stamp flying in, then the ink.
          if (call && phase === 'stamp') {
            const f = clamp(pt / 0.22, 0, 1);
            const b = BTN[call];
            const sx = Math.round(b.x + b.w / 2 + (RX + RW / 2 - b.x - b.w / 2) * f);
            const sy = Math.round(b.y + 46 + (RY + rh / 2 - 20 - b.y - 46) * f);
            if (f >= 1) drawInk(g, call, RY + rh / 2);
            drawStamp(g, sx, sy - (f >= 1 ? 0 : 6), call);
          } else if (call && phase === 'result') drawInk(g, call, RY + rh / 2);
          else if (!call && phase === 'result') drawInk(g, 'late', RY + rh / 2);
        }
        // Tally of past calls.
        const tx = W / 2 - n * 4;
        for (let k = 0; k < n; k++) {
          const col = k < results.length ? (results[k] ? C.good : C.bad) : k === i ? C.gold : '#4a3524';
          rect(g, tx + k * 8, 186, 6, 6, C.border);
          rect(g, tx + k * 8 + 1, 187, 4, 4, col);
        }
        if (verdict) {
          panel(g, 70, 198, 340, 46, { fill: verdict.ok ? '#24502e' : '#5a2424' });
          drawText(g, verdict.head, W / 2, 203, { align: 'center', color: verdict.ok ? C.good : '#ff8a80', shadow: C.border });
          drawWrapped(g, verdict.tell, W / 2, 215, 320, { color: C.text, align: 'center' });
        } else {
          drawText(g, 'Legit = APPROVE, fraud = REJECT. Check the date, the amounts and the reason.', W / 2, 212, { align: 'center', color: '#e8d8c0', shadow: C.border });
          if (d > 0.6) drawText(g, 'Seen this exact receipt before? It was already reimbursed.', W / 2, 224, { align: 'center', color: C.gold, shadow: C.border });
        }
        drawText(g, 'R / Left = reject    A / Right = approve    or click a stamp', W / 2, 254, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};

function drawDesk(g) {
  rect(g, 0, 0, W, H, '#6b4a32');
  for (let y = 22; y < H; y += 28) {
    rect(g, 0, y, W, 1, '#5a3d28');
    rect(g, 0, y + 1, W, 1, '#7a573c');
  }
  for (let k = 0; k < 14; k++) rect(g, (k * 97) % W, 30 + ((k * 53) % 200), 18 + (k % 3) * 9, 1, '#5e412b');
  // Calculator (left) and mug (right).
  rect(g, 40, 162, 50, 32, C.border);
  rect(g, 41, 163, 48, 30, '#3d4150');
  rect(g, 44, 166, 42, 8, '#a8c8a0');
  drawText(g, '0.00', 84, 166, { align: 'right', color: '#2a3a2a' });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) rect(g, 44 + c * 9, 177 + r * 7, 6, 5, c === 4 ? C.warn : '#c8ccd8');
  rect(g, 398, 164, 22, 24, C.border);
  rect(g, 399, 165, 20, 22, '#e8e4dc');
  rect(g, 401, 166, 16, 4, '#4a2a18');
  rect(g, 419, 170, 5, 10, C.border);
  rect(g, 420, 172, 3, 6, '#6b4a32');
  drawText(g, 'WIN', 409, 175, { align: 'center', color: C.accent });
}

function drawButton(g, kind, hovered, active) {
  const b = BTN[kind];
  panel(g, b.x, b.y, b.w, b.h, { fill: hovered && active ? C.panelLight : C.panel });
  if (hovered && active) frame(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold);
  drawStamp(g, b.x + b.w / 2, b.y + 46, kind);
  drawText(g, kind === 'approve' ? 'APPROVE' : 'REJECT', b.x + b.w / 2, b.y + 56, { align: 'center', color: kind === 'approve' ? C.good : '#ff7a6a', shadow: C.border, scale: 2 });
  rect(g, b.x + 8, b.y + 78, b.w - 16, 1, C.panelLight);
  drawText(g, kind === 'approve' ? 'A  or  →' : 'R  or  ←', b.x + b.w / 2, b.y + 84, { align: 'center', color: active ? C.text : C.dim });
  if (!active) rect(g, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 'rgba(13,15,24,0.3)');
}

/** Rubber stamp; (x, y) = bottom centre of the rubber. */
function drawStamp(g, x, y, kind) {
  const rubber = kind === 'approve' ? '#2e8540' : '#b03a35';
  rect(g, x - 7, y - 34, 14, 9, C.border);
  rect(g, x - 6, y - 33, 12, 7, '#c0392b');
  rect(g, x - 5, y - 33, 4, 2, '#e8705f');
  rect(g, x - 3, y - 26, 6, 10, C.border);
  rect(g, x - 2, y - 26, 4, 10, '#8a8f9e');
  rect(g, x - 18, y - 17, 36, 12, C.border);
  rect(g, x - 17, y - 16, 34, 10, '#9a6b42');
  rect(g, x - 17, y - 16, 34, 2, '#b8875a');
  rect(g, x - 19, y - 6, 38, 5, C.border);
  rect(g, x - 18, y - 5, 36, 4, rubber);
}

function drawInk(g, kind, cy) {
  const col = kind === 'approve' ? 'rgba(46,133,64,0.85)' : kind === 'reject' ? 'rgba(200,50,45,0.85)' : 'rgba(120,120,130,0.85)';
  const text = kind === 'approve' ? 'APPROVED' : kind === 'reject' ? 'REJECTED' : 'EXPIRED';
  const w = 100;
  const x = RX + RW / 2 - w / 2 + 6;
  const y = Math.round(cy) - 14;
  frame(g, x, y, w, 26, col);
  frame(g, x + 2, y + 2, w - 4, 22, col);
  drawText(g, text, x + w / 2, y + 6, { align: 'center', color: col, scale: 2 });
}

/** Draws the receipt, returns its height. */
function drawReceipt(g, r, y) {
  const x = RX;
  const pad = 8;
  const reason = wrapText('Reason: ' + r.reason, RW - pad * 2).slice(0, 3);
  const h = 6 + 10 + 10 + 12 + 6 + r.lines.length * 10 + 6 + 10 + 6 + reason.length * 10 + 12 + 8;
  // Shadow, paper, torn bottom edge.
  rect(g, x + 3, y + 3, RW, h, 'rgba(0,0,0,0.3)');
  rect(g, x, y, RW, h, '#f7f4ea');
  rect(g, x, y, RW, 2, '#ffffff');
  for (let k = 0; k < RW; k += 6) {
    rect(g, x + k, y + h, 3, 2, '#f7f4ea');
    rect(g, x + k + 3, y + h - 1, 3, 1, '#d8d2c0');
  }
  let yy = y + 6;
  drawText(g, r.merchant, x + RW / 2, yy, { align: 'center', color: INK });
  yy += 10;
  drawText(g, `Receipt #${r.no}`, x + RW / 2, yy, { align: 'center', color: '#8a8a96' });
  yy += 10;
  const weekend = r.day === 'Sat' || r.day === 'Sun';
  drawText(g, `${r.day} ${r.date} ${r.month}`, x + pad, yy, { color: weekend ? '#a0302a' : INK });
  drawText(g, r.time, x + RW - pad, yy, { align: 'right', color: INK });
  yy += 12;
  dashes(g, x + pad, yy, RW - pad * 2);
  yy += 6;
  let sum = 0;
  for (const [text, amt] of r.lines) {
    drawText(g, text, x + pad, yy, { color: INK });
    drawText(g, money(amt), x + RW - pad, yy, { align: 'right', color: INK });
    sum += amt;
    yy += 10;
  }
  dashes(g, x + pad, yy, RW - pad * 2);
  yy += 6;
  drawText(g, 'TOTAL', x + pad, yy, { color: INK });
  drawText(g, money(sum), x + RW - pad, yy, { align: 'right', color: INK });
  rect(g, x + pad, yy + 9, RW - pad * 2, 1, '#cfc8b4');
  yy += 16;
  reason.forEach((line, k) => drawText(g, line, x + pad, yy + k * 10, { color: PEN }));
  yy += reason.length * 10 + 2;
  drawText(g, '- ' + r.by, x + RW - pad, yy, { align: 'right', color: PEN });
  return h;
}

function dashes(g, x, y, w) {
  for (let k = 0; k < w; k += 4) rect(g, x + k, y + 1, 2, 1, '#9a9488');
}
