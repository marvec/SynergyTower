// Password Policy: IT forces a password change. Rules appear one at a time; each time the password passes every
// current rule and is submitted, a new (sillier) one is appended, until the whole policy is satisfied at once.
// Submitting a failing password costs one of 3 attempts (this is what keeps keyboard mashing from scoring).
import { W, C, rect, frame, panel, drawText, measureText, backdrop, header, timerBar, monitor, Floaters, Shake, byDiff, clamp, finish } from '../engine/mgkit.js';
import { icon } from '../engine/ui.js';
import { FRUITS, MONTHS, COFFEE, ANIMALS, VALUES, DEPT_WORDS, IT_QUIPS, DONE_LINES, SCREEN_TITLES } from '../data/mg-password.js';

const MAX_LEN = 24;
const SOLUTION_MAX = 19; // reference solutions leave slack under the opener's length cap (and MAX_LEN)
const SPECIALS = '!?#%&*';
const ROMANS = [[4, 'IV'], [6, 'VI'], [9, 'IX'], [11, 'XI'], [14, 'XIV'], [40, 'XL']];
const STRENGTH = ['Laughable', 'Weak', 'Meh', 'Okay', 'Decent', 'Corporate', 'Fortress', 'Unhackable'];
const MAX_STRIKES = 3;

const lc = (s) => s.toLowerCase();
const hasCI = (pw, list) => list.some((w) => lc(pw).includes(lc(w)));
const hasCS = (pw, list) => list.some((w) => pw.includes(w));
const digitSum = (pw) => [...pw].reduce((s, c) => (c >= '0' && c <= '9' ? s + Number(c) : s), 0);
const upperCount = (pw) => [...pw].filter((c) => c >= 'A' && c <= 'Z').length;
const isPrime = (n) => {
  if (n < 2) return false;
  for (let k = 2; k * k <= n; k++) if (n % k === 0) return false;
  return true;
};

/** All rule templates for one round. tier: 0 = opener, 1 = easy, 2 = mid, 3 = absurd. */
function rulePool({ floor, quarter, roman, deptWord, minLen }) {
  return [
    { id: 'len', tier: 0, text: `At least ${minLen} characters.`, check: (pw) => pw.length >= minLen, minLen },
    { id: 'digit', tier: 1, text: 'Must contain a digit.', check: (pw) => /[0-9]/.test(pw), need: 'digit' },
    { id: 'upper', tier: 1, text: 'Must contain an uppercase letter.', check: (pw) => /[A-Z]/.test(pw), needUpper: 1 },
    { id: 'special', tier: 1, text: 'Must contain a special character: ! ? # % & *', check: (pw) => [...SPECIALS].some((c) => pw.includes(c)), need: 'special' },
    { id: 'lower', tier: 1, text: 'Must contain a lowercase letter. Stop shouting.', check: (pw) => /[a-z]/.test(pw), need: 'lower' },
    { id: 'nopass', tier: 1, neg: true, text: "Must not contain the word 'password'.", check: (pw) => !lc(pw).includes('password') },
    { id: 'no123', tier: 1, neg: true, text: "Must not contain '123'. Hackers know that one.", check: (pw) => !pw.includes('123') },
    { id: 'sum', tier: 2, text: '', check: () => false }, // text and check are filled in once the target is known
    { id: 'month', tier: 2, text: 'Must include a month (jan, feb, mar...).', options: MONTHS, tileCount: 2, check: (pw) => hasCI(pw, MONTHS) },
    { id: 'fruit', tier: 2, text: 'Must contain a fruit. IT is on a diet.', options: FRUITS, tileCount: 3, check: (pw) => hasCI(pw, FRUITS) },
    { id: 'floor', tier: 2, text: `Must include our floor number (${floor}).`, options: [String(floor)], tileCount: 0, check: (pw) => pw.includes(String(floor)) },
    { id: 'quarter', tier: 2, text: `Must mention this quarter: ${quarter}.`, options: [quarter], check: (pw) => lc(pw).includes(lc(quarter)) },
    { id: 'bang', tier: 2, end: '!', text: "Must end with '!'. Enthusiasm is mandatory.", check: (pw) => pw.endsWith('!') },
    { id: 'start', tier: 2, start: true, text: 'Must start with a capital letter.', check: (pw) => /^[A-Z]/.test(pw) },
    { id: 'triple', tier: 2, neg: true, text: 'No 3 identical characters in a row.', check: (pw) => !/(.)\1\1/.test(pw) },
    { id: 'nozero', tier: 2, neg: true, text: 'No zeros. Gary keeps reading them as O.', check: (pw) => !pw.includes('0') },
    { id: 'even', tier: 2, group: 'len', lenOk: (n) => n % 2 === 0, text: 'Length must be an even number.', check: (pw) => pw.length % 2 === 0 },
    { id: 'coffee', tier: 2, text: 'Must include a coffee size (tall, grande, venti).', options: COFFEE, tileCount: 2, check: (pw) => hasCI(pw, COFFEE) },
    { id: 'dept', tier: 2, text: `Must contain ${deptWord[0]}. ${deptWord[1]}`, options: [deptWord[0]], check: (pw) => pw.includes(deptWord[0]) },
    { id: 'caps3', tier: 2, needUpper: 3, text: 'At least 3 capital letters. Be assertive.', check: (pw) => upperCount(pw) >= 3 },
    { id: 'value', tier: 3, text: 'Must contain a company value in CAPS: TRUST, BOLD or AGILE.', options: VALUES, tileCount: 2, check: (pw) => hasCS(pw, VALUES) },
    { id: 'synergy', tier: 3, text: 'Must contain SYNERGY. In caps. We mean it.', options: ['SYNERGY'], check: (pw) => pw.includes('SYNERGY') },
    { id: 'roman', tier: 3, text: `Must include the Roman numeral for ${roman[0]}.`, options: [roman[1]], tileCount: 0, check: (pw) => pw.includes(roman[1]) },
    { id: 'noe', tier: 3, neg: true, text: "The letter E is on vacation. Don't use it.", check: (pw) => !/e/i.test(pw) },
    { id: 'prime', tier: 3, group: 'len', lenOk: isPrime, text: 'Length must be a prime number.', check: (pw) => isPrime(pw.length) },
    { id: 'len14', tier: 3, minLen: 14, text: 'Actually, make that at least 14 characters.', check: (pw) => pw.length >= 14 },
    { id: 'animal', tier: 3, text: 'Must include an animal sound (moo, oink, baa...).', options: ANIMALS, tileCount: 2, check: (pw) => hasCI(pw, ANIMALS) },
  ];
}

/** Picks the round's rules (opener + easy + mid + absurd, each tier shuffled). */
function pickRules(pool, n, d, rng) {
  const nEasy = Math.min(2, n - 1);
  const nMid = Math.min(n - 1 - nEasy, Math.round(byDiff(d, 1, 3)));
  const nAbs = n - 1 - nEasy - nMid;
  const groups = new Set();
  const take = (tier, k) => {
    const out = [];
    for (const r of rng.shuffle(pool.filter((p) => p.tier === tier))) {
      if (out.length >= k) break;
      if (r.group && groups.has(r.group)) continue;
      if (r.group) groups.add(r.group);
      out.push(r);
    }
    return out;
  };
  return [pool.find((p) => p.id === 'len'), ...take(1, nEasy), ...take(2, nMid), ...take(3, nAbs)];
}

/** Builds a password that satisfies every rule at once, or null. Records the chunk chosen per rule. */
function construct(rules, rng) {
  const negs = rules.filter((r) => r.neg);
  const okChunk = (c) => negs.every((r) => r.check(c));
  const has = (id) => rules.some((r) => r.id === id);
  const choice = {};
  let pieces = [];
  for (const r of rules) {
    if (!r.options) continue;
    const opts = r.options.filter(okChunk);
    if (!opts.length) return null;
    choice[r.id] = rng.pick(opts);
    pieces.push(choice[r.id]);
  }
  const joined = () => pieces.join('');
  const needUpper = Math.max(0, ...rules.map((r) => r.needUpper || 0));
  for (let k = 0; upperCount(joined()) < needUpper; k++) pieces.push('KZQ'[k % 3]);
  if (has('sum')) {
    const sumRule = rules.find((r) => r.id === 'sum');
    let rem = sumRule.target - digitSum(joined());
    if (rem < 0 || (rem === 0 && !/[0-9]/.test(joined()))) return null;
    let digits = '';
    while (rem > 0) {
      let dg = Math.min(9, rem);
      if (digits.length >= 2 && digits.endsWith(String(dg).repeat(2))) dg--;
      digits += dg;
      rem -= dg;
    }
    if (digits) pieces.push(digits);
  } else if (has('digit') && !/[0-9]/.test(joined())) pieces.push(String(rng.int(4, 9)));
  if (has('special') && !has('bang') && ![...SPECIALS].some((c) => joined().includes(c))) pieces.push(rng.pick([...'#%&*?']));
  if (has('lower') && !/[a-z]/.test(joined())) pieces.push('k');
  pieces = rng.shuffle(pieces);
  let pw = joined();
  if (has('start') && !/^[A-Z]/.test(pw)) pw = 'K' + pw;
  const bang = has('bang');
  if (bang && !pw.endsWith('!')) pw += '!';
  let fi = rng.int(0, 2);
  const pad = () => {
    const ch = 'uzk'[fi++ % 3];
    pw = bang ? pw.slice(0, -1) + ch + '!' : pw + ch;
  };
  const minLen = Math.max(0, ...rules.map((r) => r.minLen || 0));
  while (pw.length < minLen) pad();
  const lenRule = rules.find((r) => r.lenOk);
  while (lenRule && !lenRule.lenOk(pw.length) && pw.length <= SOLUTION_MAX) pad();
  if (pw.length > SOLUTION_MAX || !rules.every((r) => r.check(pw))) return null;
  return { pw, choice };
}

/** Generates a satisfiable rule list (with a known solution). Exported for tests/scratch checks. */
export function generatePolicy({ d, rng, dept, floor }) {
  const n = Math.round(byDiff(d, 4, 8));
  const minLen = Math.round(byDiff(d, 6, 8));
  const ctx = {
    floor: floor || rng.int(2, 39),
    quarter: `Q${rng.int(1, 4)}`,
    roman: rng.pick(ROMANS),
    deptWord: DEPT_WORDS[dept] || DEPT_WORDS.it,
    minLen,
  };
  for (let attempt = 0; attempt < 300; attempt++) {
    const rules = pickRules(rulePool(ctx), n, d, rng);
    const sum = rules.find((r) => r.id === 'sum');
    if (sum) {
      let fixed = 0;
      if (rules.some((r) => r.id === 'floor')) fixed += digitSum(String(ctx.floor));
      if (rules.some((r) => r.id === 'quarter')) fixed += digitSum(ctx.quarter);
      sum.target = fixed + rng.int(5, 12);
      sum.text = `Digits must add up to ${sum.target}. Finance will check.`;
      sum.check = (pw) => digitSum(pw) === sum.target;
    }
    for (let k = 0; k < 12; k++) {
      const sol = construct(rules, rng);
      if (sol) {
        // The opener also caps the length: mashed garbage grows past it within seconds.
        const open = rules[0];
        const maxLen = Math.min(MAX_LEN - 2, Math.max(12, sol.pw.length + rng.int(3, 5)));
        open.text = `Between ${minLen} and ${maxLen} characters.`;
        open.check = (pw) => pw.length >= minLen && pw.length <= maxLen;
        return { rules, solution: sol.pw, choice: sol.choice };
      }
    }
  }
  // Fallback that is always satisfiable (never expected in practice).
  const pool = rulePool(ctx);
  const ids = ['len', 'digit', 'upper', 'special', 'lower', 'nopass', 'no123', 'triple'].slice(0, n);
  const rules = ids.map((id) => pool.find((p) => p.id === id));
  rules[0] = { ...rules[0], text: `Between ${minLen} and 16 characters.`, check: (pw) => pw.length >= minLen && pw.length <= 16 };
  return { rules, solution: 'Kiwi#7uzku'.padEnd(minLen, 'z'), choice: {} };
}

export default {
  id: 'password',
  name: 'Password Policy',
  help: 'IT forces a password change. When every rule is green, SUBMIT (Enter) - then a new rule appears. Type, or click the key tiles. 3 failed attempts lock you out!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const policy = generatePolicy({ d, rng, dept: theme?.dept, floor: theme?.stats?.floor });
    const rules = policy.rules;
    const N = rules.length;
    const total = byDiff(d, 75, 60);
    const screenTitle = rng.pick(SCREEN_TITLES);
    const quips = rng.shuffle(IT_QUIPS);
    const fl = new Floaters();
    const shake = new Shake();
    let left = total;
    let pw = '';
    let unlocked = 1;
    let strikes = 0;
    let lockedOut = false;
    let newT = 0;
    let completed = false;
    let completeT = 0;
    let finalScore = 0;
    let status = 'Rule 1 of the new policy. More may follow.';
    let statusBad = false;
    let anim = 0;
    let focus = 1; // tile 0 is SUBMIT; indices of existing tiles stay stable when chunk tiles are appended
    let keyFlash = -1;
    let keyFlashT = 0;
    let badT = 0;

    // Chunk tiles unlocked with the rules that use them (the reference solution's choice is always among them).
    const chunkTiles = [];
    const addChunks = (r) => {
      if (!r.options) return;
      const count = r.tileCount ?? 1;
      if (!count) return;
      const pick = policy.choice[r.id] || r.options[0];
      const others = rng.sample(r.options.filter((o) => o !== pick), count - 1);
      for (const t of rng.shuffle([pick, ...others])) if (!chunkTiles.includes(t)) chunkTiles.push(t);
    };
    addChunks(rules[0]);

    // --- Key tiles: two fixed rows + flowing chunk rows.
    const ROW1 = [...'1234567890', ...SPECIALS];
    const ROW2 = [...'aoukz', ...'KQZIVXL'];
    const KEY_H = 17;
    const ROW_Y = [170, 189, 208, 227];
    let tiles = [];
    const layout = () => {
      tiles = [{ label: 'SUBMIT', insert: null, action: 'SUBMIT', x: 380, y: 39, w: 80, h: 22, row: -1 }];
      const row = (labels, y, rowIdx, keyW) => {
        const widths = labels.map((l) => (l.length > 1 ? Math.max(keyW, measureText(l) + 10) : keyW));
        const tw = widths.reduce((s, w) => s + w, 0) + (labels.length - 1) * 3;
        let x = Math.round(W / 2 - tw / 2);
        labels.forEach((l, k) => {
          const special = l === 'DEL' || l === 'CLR';
          tiles.push({ label: l, insert: special ? null : l, action: special ? l : 'ins', x, y, w: widths[k], h: KEY_H, row: rowIdx });
          x += widths[k] + 3;
        });
      };
      row(ROW1, ROW_Y[0], 0, 24);
      row([...ROW2, 'DEL', 'CLR'], ROW_Y[1], 1, 24);
      // Chunks flow over up to two rows.
      const maxW = 452;
      let line = [];
      let lineW = 0;
      let r = 2;
      for (const c of chunkTiles) {
        const w = measureText(c) + 12;
        if (line.length && lineW + w + 3 > maxW && r < 3) {
          row(line, ROW_Y[r], r, 0);
          r++;
          line = [];
          lineW = 0;
        }
        line.push(c);
        lineW += w + 3;
      }
      if (line.length) row(line, ROW_Y[r], r, 0);
      if (focus >= tiles.length) focus = tiles.length - 1;
    };
    layout();

    const pass = (r) => r.check(pw);
    const cleared = () => (completed ? N : unlocked - 1);
    const partialScore = () => 0.82 * (cleared() / N) ** 1.15 - 0.12 * strikes;

    const edit = (fn) => {
      if (completed || inst.done) return;
      const next = fn(pw);
      if (next === pw) return;
      if (next.length > MAX_LEN) {
        sfx('bad');
        badT = 0.3;
        fl.add('Max 24 characters!', W / 2, 60, C.bad);
        return;
      }
      pw = next;
      sfx('type');
    };
    const activate = (k) => {
      const t = tiles[k];
      if (!t) return;
      keyFlash = k;
      keyFlashT = 0.12;
      if (t.action === 'SUBMIT') submit();
      else if (t.action === 'DEL') edit((s) => s.slice(0, -1));
      else if (t.action === 'CLR') edit(() => '');
      else edit((s) => s + t.insert);
    };
    const submit = () => {
      if (completed || inst.done) return;
      const failing = rules.slice(0, unlocked).findIndex((r) => !pass(r));
      if (failing >= 0) {
        strikes++;
        statusBad = true;
        sfx('bad');
        shake.hit();
        if (strikes >= MAX_STRIKES) {
          lockedOut = true;
          completeT = 1.4;
          status = 'ACCOUNT LOCKED. Please visit IT in person.';
          fl.add('LOCKED OUT', W / 2, 60, C.bad);
          return;
        }
        const leftTries = MAX_STRIKES - strikes;
        status = `Rejected: rule ${failing + 1} says no. ${leftTries} attempt${leftTries > 1 ? 's' : ''} left.`;
        fl.add('Rejected!', W / 2, 60, C.bad);
        return;
      }
      statusBad = false;
      if (unlocked >= N) {
        completed = true;
        completeT = 1.2;
        finalScore = 0.86 + 0.14 * clamp(left / total, 0, 1) - 0.05 * strikes;
        status = rng.pick(DONE_LINES);
        sfx('star');
        fl.add('ACCEPTED!', W / 2, 60, C.good);
        return;
      }
      const r = rules[unlocked];
      unlocked++;
      newT = 1.2;
      status = `Almost! ${quips[(unlocked - 2) % quips.length]}`;
      addChunks(r);
      layout();
      sfx('ding');
      fl.add('One more thing...', W / 2, 60, C.gold);
    };
    const moveVert = (dir) => {
      const cur = tiles[focus];
      const rows = [...new Set(tiles.map((t) => t.row))].sort((a, b) => a - b);
      const ri = rows.indexOf(cur.row) + dir;
      if (ri < 0 || ri >= rows.length) return;
      const cx = cur.x + cur.w / 2;
      let best = focus;
      let bd = Infinity;
      tiles.forEach((t, k) => {
        if (t.row !== rows[ri]) return;
        const dd = Math.abs(t.x + t.w / 2 - cx);
        if (dd < bd) (bd = dd), (best = k);
      });
      focus = best;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        newT = Math.max(0, newT - dt);
        keyFlashT = Math.max(0, keyFlashT - dt);
        badT = Math.max(0, badT - dt);
        if (inst.done) return;
        if (completed || lockedOut) {
          completeT -= dt;
          if (completeT <= 0) finish(inst, completed ? finalScore : partialScore());
          return;
        }
        left -= dt;
        if (left <= 0) return finish(inst, partialScore());

        // Typing (spaces are not allowed in passwords here; Space activates the focused tile instead).
        for (const ch of input.typed()) {
          if (ch === '\b') edit((s) => s.slice(0, -1));
          else if (ch.length === 1 && ch > ' ' && ch <= '~') edit((s) => s + ch);
        }
        // Tile focus: exact arrows only, since typed WASD would otherwise move the focus.
        const n = tiles.length;
        if (input.pressedExact('ArrowRight')) (focus = (focus + 1) % n), sfx('blip');
        if (input.pressedExact('ArrowLeft')) (focus = (focus + n - 1) % n), sfx('blip');
        if (input.pressedExact('ArrowDown')) moveVert(1);
        if (input.pressedExact('ArrowUp')) moveVert(-1);
        if (input.pressedExact('Enter')) submit();
        else if (input.pressedExact('Space')) activate(focus);
        const p = input.pointer;
        tiles.forEach((t, k) => {
          if (p.x >= t.x && p.y >= t.y && p.x < t.x + t.w && p.y < t.y + t.h) {
            if (p.moved) focus = k;
            if (p.clicked) {
              focus = k;
              activate(k);
            }
          }
        });
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#34405a' });
        header(g, theme?.title || 'Password Policy', `Rules ${cleared()}/${N}  Attempts ${MAX_STRIKES - strikes}`);
        timerBar(g, left, total);
        const s = monitor(g, 14, 24, 452, 128, '#e9eef5');
        rect(g, s.x, s.y, s.w, 11, completed ? C.goodBtn : lockedOut ? '#9a2b2b' : C.accent);
        drawText(g, completed ? 'IT SECURITY - Password accepted' : lockedOut ? 'IT SECURITY - Account locked' : screenTitle, s.x + 4, s.y + 2);
        icon(g, 'lock', s.x + s.w - 10, s.y + 2);

        // Password field with caret.
        drawText(g, 'New password:', s.x + 6, s.y + 20, { color: '#5a6070' });
        const fx = s.x + 74;
        const fw = 286;
        rect(g, fx, s.y + 15, fw, 22, badT > 0 ? '#ffd9d6' : '#ffffff');
        frame(g, fx, s.y + 15, fw, 22, completed ? C.good : '#8a93a6');
        const sc = measureText(pw, 2) <= fw - 12 ? 2 : 1;
        const tw = drawText(g, pw, fx + 5, s.y + (sc === 2 ? 18 : 22), { color: C.ink, scale: sc });
        if (!completed && Math.floor(anim * 2.5) % 2 === 0) rect(g, fx + 5 + tw + (pw ? sc : 0), s.y + 17, sc, 18, C.accent);
        drawText(g, `${pw.length}/${MAX_LEN} chars`, s.x + 6, s.y + 30, { color: '#9aa0b0' });

        // IT status line + strength meter (decorative, judged by policy progress).
        drawText(g, status, s.x + 6, s.y + 43, { color: completed ? '#2f8a3e' : statusBad || lockedOut ? '#b03a35' : '#7a4a9a' });
        const prog = cleared() / N;
        const word = STRENGTH[Math.min(7, Math.floor(prog * 7.99))];
        const bx = s.x + s.w - 46;
        rect(g, bx, s.y + 44, 40, 5, '#c8cfdc');
        rect(g, bx, s.y + 44, Math.round(40 * prog), 5, prog >= 1 ? C.good : prog > 0.5 ? C.warn : C.bad);
        drawText(g, word, bx - 4, s.y + 43, { color: C.ink, align: 'right' });
        rect(g, s.x + 4, s.y + 53, s.w - 8, 1, '#c8cfdc');

        // Rules, newest at the bottom.
        for (let i = 0; i < unlocked; i++) {
          const r = rules[i];
          const y = s.y + 57 + i * 9;
          const ok = pass(r);
          if (i === unlocked - 1 && newT > 0 && Math.floor(newT * 6) % 2 === 0) rect(g, s.x + 4, y - 1, s.w - 8, 9, '#fff3c4');
          if (ok) icon(g, 'check', s.x + 6, y);
          else {
            for (let k = 0; k < 5; k++) {
              rect(g, s.x + 7 + k, y + 1 + k, 1, 1, C.bad);
              rect(g, s.x + 11 - k, y + 1 + k, 1, 1, C.bad);
            }
          }
          drawText(g, `${i + 1}. ${r.text}`, s.x + 16, y, { color: ok ? '#2f7a3a' : '#a8332e' });
        }
        if (unlocked < N && !completed) drawText(g, `${N - unlocked} more rule${N - unlocked > 1 ? 's' : ''} pending...`, s.x + 16, s.y + 57 + unlocked * 9, { color: '#9aa0b0' });

        // Keyboard plate with tiles.
        panel(g, 10, 166, 460, 81, { fill: '#2b2e38', light: '#4a4f60', dark: '#1a1c24' });
        tiles.forEach((t, k) => {
          const pressed = k === keyFlash && keyFlashT > 0;
          if (t.action === 'SUBMIT') {
            const ready = rules.slice(0, unlocked).every(pass) && !completed && !lockedOut;
            panel(g, t.x, t.y + (pressed ? 1 : 0), t.w, t.h, ready ? { fill: C.goodBtn, light: '#5fb06a', dark: '#1d5a2a' } : {});
            drawText(g, 'SUBMIT', t.x + t.w / 2, t.y + 8 + (pressed ? 1 : 0), { align: 'center', color: ready ? C.text : C.dim, shadow: C.border });
            if (k === focus) frame(g, t.x - 1, t.y - 1, t.w + 2, t.h + 2, C.gold);
            return;
          }
          const special = t.action !== 'ins';
          const chunk = t.row >= 2;
          const top = special ? '#c9a24a' : chunk ? '#9fc3e8' : '#d8dce6';
          const y = t.y + (pressed ? 1 : 0);
          rect(g, t.x, t.y, t.w, t.h, C.border);
          rect(g, t.x + 1, y + 1, t.w - 2, t.h - (pressed ? 3 : 4), top);
          if (!pressed) rect(g, t.x + 1, t.y + t.h - 3, t.w - 2, 2, special ? '#8a6a24' : chunk ? '#5f88b2' : '#8f95a6');
          drawText(g, t.label, t.x + t.w / 2, y + 4, { color: C.ink, align: 'center' });
          if (k === focus) frame(g, t.x - 1, t.y - 1, t.w + 2, t.h + 2, C.gold);
        });
        drawText(g, 'Type or click keys. ENTER/SUBMIT when all rules are green. Arrows+SPACE: keys.', W / 2, 255, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
