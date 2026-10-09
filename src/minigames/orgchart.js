// Org Chart Shuffle: a surprise reorg. Drag the employee badges into the org chart so that every clue on the
// leaked HR memo holds. Puzzles are generated from a random target chart with clues added until the reporting
// structure is unique (checked by brute force over all placements), then pruned to a minimal set.
import { W, C, rect, frame, panel, drawText, backdrop, header, timerBar, face, Floaters, Shake, byDiff, clamp, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { icon } from '../engine/ui.js';
import { NAMES, QUIRKS, CHART_TITLES, VERDICT_PERFECT, VERDICT_OK, VERDICT_BAD } from '../data/mg-orgchart.js';

// Org chart shapes as parent arrays (slot 0 = the boss), max 3 levels and max 4 boxes per level.
const SHAPES = {
  4: [[-1, 0, 0, 1], [-1, 0, 1, 1], [-1, 0, 0, 0]],
  5: [[-1, 0, 0, 1, 2], [-1, 0, 0, 1, 1], [-1, 0, 0, 0, 1]],
  6: [[-1, 0, 0, 1, 1, 2], [-1, 0, 0, 0, 1, 2], [-1, 0, 0, 1, 1, 1]],
  7: [[-1, 0, 0, 1, 1, 2, 2], [-1, 0, 0, 0, 1, 2, 3], [-1, 0, 0, 1, 1, 1, 2]],
};
const SLOT_W = 60;
const SLOT_H = 20;
const BOARD = { x: 6, y: 21, w: 292, h: 104 };
const NOTES = { x: 304, y: 21, w: 170, h: 229 };
const NOTE_TEXT_W = 144;
const NOTE_LH = 9;
const NOTE_COLORS = ['#f7e48a', '#f6b8c8', '#bfe8a8', '#a8d8f0'];

const permCache = new Map();
function permutations(n) {
  if (permCache.has(n)) return permCache.get(n);
  const out = [];
  const a = [...Array(n).keys()];
  const rec = (k) => {
    if (k === n) return out.push(a.slice());
    for (let i = k; i < n; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      rec(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  rec(0);
  permCache.set(n, out);
  return out;
}

function shapeInfo(par) {
  const n = par.length;
  const kids = Array(n).fill(0);
  const depth = Array(n).fill(0);
  for (let s = 1; s < n; s++) {
    kids[par[s]]++;
    depth[s] = depth[par[s]] + 1;
  }
  return { kids, depth };
}

/** Per-person facts for a placement occ[slot] = person (or -1). Unknown facts are null. */
function viewOf(par, info, occ, n) {
  const mgr = Array(n).fill(null);
  const kids = Array(n).fill(null);
  const depth = Array(n).fill(null);
  occ.forEach((p, s) => {
    if (p < 0) return;
    kids[p] = info.kids[s];
    depth[p] = info.depth[s];
    mgr[p] = par[s] < 0 ? -1 : occ[par[s]] >= 0 ? occ[par[s]] : null;
  });
  return { mgr, kids, depth };
}

/** Every clue that is true for the target view T. w = how much we like it (indirect clues are more fun). */
function candidateClues(T, people, rng) {
  const n = people.length;
  const N = (i) => people[i].name;
  const Q = (i) => people[i].quirk;
  const out = [];
  const add = (w, text, check, key) => out.push({ w, text, check, key });
  for (let X = 0; X < n; X++) {
    if (T.depth[X] === 0) add(0.3, `${N(X)} is the boss.`, (v) => v.depth[X] === 0, `boss${X}`);
    else add(0.15, rng.pick([`${N(X)} is not the boss.`, `${N(X)} is not the boss (yet).`]), (v) => v.depth[X] != null && v.depth[X] > 0, `boss${X}`);
    if (T.depth[X] === 1) add(0.7, `${N(X)} reports directly to the boss.`, (v) => v.depth[X] === 1, `depth${X}`);
    if (T.kids[X] === 0) {
      add(1, rng.pick([`${N(X)} manages nobody anymore.`, `${N(X)} has no direct reports.`, `Nobody reports to ${N(X)}. By choice.`]), (v) => v.kids[X] === 0, `kids${X}`);
      add(0.9, rng.pick([`Whoever ${Q(X)} is not a manager.`, `Whoever ${Q(X)} manages nobody.`]), (v) => v.kids[X] === 0, `kids${X}`);
    } else {
      const k = T.kids[X];
      add(0.7, rng.pick([`${N(X)} has direct reports.`, `${N(X)} manages a team now.`]), (v) => v.kids[X] > 0, `kids${X}`);
      add(0.8, `${N(X)} manages exactly ${k} ${k === 1 ? 'person' : 'people'}.`, (v) => v.kids[X] === k, `kids${X}`);
      add(0.8, `Whoever ${Q(X)} is now a manager.`, (v) => v.kids[X] > 0, `kids${X}`);
    }
    const Y = T.mgr[X];
    if (Y >= 0) {
      add(0.5, `${N(X)} reports to ${N(Y)}.`, (v) => v.mgr[X] === Y, `mgr${X}`);
      add(1, `${N(X)} reports to whoever ${Q(Y)}.`, (v) => v.mgr[X] === Y, `mgr${X}`);
      add(0.9, `Whoever ${Q(X)} reports to ${N(Y)}.`, (v) => v.mgr[X] === Y, `mgr${X}`);
      const m2 = T.mgr[Y];
      if (m2 >= 0) add(0.9, `${N(m2)} is ${N(X)}'s skip-level boss.`, (v) => v.mgr[X] != null && v.mgr[X] >= 0 && v.mgr[v.mgr[X]] === m2, `skip${X}`);
    }
    for (let Z = 0; Z < n; Z++) {
      if (Z === X || T.mgr[X] < 0 || T.mgr[X] === Z || T.kids[Z] === 0) continue;
      add(0.55, `${N(X)} does not report to ${N(Z)}.`, (v) => v.mgr[X] != null && v.depth[Z] != null && v.mgr[X] !== Z, `not${X}_${Z}`);
    }
  }
  for (let X = 0; X < n; X++) {
    for (let Y = X + 1; Y < n; Y++) {
      if (T.mgr[X] >= 0 && T.mgr[X] === T.mgr[Y]) add(1, `${N(X)} and ${N(Y)} share a manager.`, (v) => v.mgr[X] != null && v.mgr[X] >= 0 && v.mgr[X] === v.mgr[Y], `pair${X}_${Y}`);
      else if (T.depth[X] === T.depth[Y]) add(0.6, `${N(X)} and ${N(Y)} are on the same level.`, (v) => v.depth[X] != null && v.depth[X] === v.depth[Y], `pair${X}_${Y}`);
    }
  }
  return out;
}

const notesHeight = (clues) => clues.reduce((h, c) => h + wrapText(`${c.no}. ${c.text}`, NOTE_TEXT_W).length * NOTE_LH + 6, 0);

/** Builds one puzzle with a unique (up to symmetric slots) solution. Exported for scratch checks. */
export function makePuzzle(n, rng, avoidNames = []) {
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const par = rng.pick(SHAPES[n]);
    const info = shapeInfo(par);
    const names = rng.sample(NAMES.filter((x) => !avoidNames.includes(x)), n);
    const quirks = rng.sample(QUIRKS, n);
    const people = names.map((name, i) => ({ name, quirk: quirks[i], seed: rng.int(0, 4095) }));
    const target = rng.shuffle([...Array(n).keys()]); // slot -> person
    const T = viewOf(par, info, target, n);
    // Distinct reporting structures over all placements.
    const seen = new Set();
    const classes = [];
    for (const perm of permutations(n)) {
      const v = viewOf(par, info, perm, n);
      const key = v.mgr.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      classes.push(v);
    }
    const cands = candidateClues(T, people, rng);
    const unique = (set) => classes.reduce((c, v) => c + (set.every((cl) => cl.check(v)) ? 1 : 0), 0) === 1;
    let clues = null;
    for (let tries = 0; tries < 20; tries++) {
      const order = cands.map((c) => ({ c, k: rng.next() ** (1 / c.w) })).sort((a, b) => b.k - a.k).map((o) => o.c);
      let rem = classes;
      const chosen = [];
      for (const c of order) {
        const f = rem.filter((v) => c.check(v));
        if (f.length < rem.length) {
          chosen.push(c);
          rem = f;
          if (rem.length === 1) break;
        }
      }
      for (const c of rng.shuffle(chosen.slice())) {
        const others = chosen.filter((o) => o !== c);
        if (unique(others)) chosen.splice(chosen.indexOf(c), 1);
      }
      if (!clues || chosen.length < clues.length) clues = chosen;
      if (clues.length <= n) break;
    }
    // Pad the minimal set with a few redundant (but true) facts: friendlier deduction, finer partial credit.
    const used = new Set(clues.map((c) => c.key));
    const extra = cands.map((c) => ({ c, k: rng.next() ** (1 / c.w) })).sort((x, y) => y.k - x.k).map((o) => o.c);
    for (const c of extra) {
      if (clues.length >= n) break;
      if (c.w < 0.3 || used.has(c.key)) continue;
      clues.push(c);
      used.add(c.key);
    }
    clues = rng.shuffle(clues).map((c, i) => ({ ...c, no: i + 1 }));
    // Expected clue satisfaction of a random full placement: the score baseline.
    const base = classes.reduce((s, v) => s + clues.filter((c) => c.check(v)).length / clues.length, 0) / classes.length;
    const puzzle = { n, par, info, people, target, clues, base, height: notesHeight(clues) };
    if (!best || puzzle.height < best.height) best = puzzle;
    if (puzzle.height <= NOTES.h - 18) break;
  }
  return best;
}

/** Slot rectangles for a shape: leaves spread evenly, parents centred over their children. */
export function layoutTree(par) {
  const n = par.length;
  const children = par.map(() => []);
  for (let s = 1; s < n; s++) children[par[s]].push(s);
  const xs = [];
  let leaf = 0;
  const dfs = (s) => {
    if (!children[s].length) return (xs[s] = leaf++);
    children[s].forEach(dfs);
    xs[s] = (xs[children[s][0]] + xs[children[s][children[s].length - 1]]) / 2;
  };
  dfs(0);
  const spacing = Math.min(72, Math.floor((BOARD.w - 12) / leaf));
  const cx = BOARD.x + BOARD.w / 2;
  const { depth } = shapeInfo(par);
  return xs.map((x, s) => ({ x: Math.round(cx + (x - (leaf - 1) / 2) * spacing - SLOT_W / 2), y: BOARD.y + 17 + depth[s] * 31, w: SLOT_W, h: SLOT_H }));
}

const inR = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export default {
  id: 'orgchart',
  name: 'Org Chart Shuffle',
  help: 'Surprise reorg! Drag each badge into the chart so every clue holds (or click a badge, then a box). Keys: arrows + SPACE to pick/drop. SUBMIT REORG when done.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = d < 0.45 ? 2 : 1;
    const size = d < 0.45 ? (d < 0.2 ? 4 : 5) : d < 0.75 ? 6 : 7;
    const total = byDiff(d, 80, 70);
    const titles = CHART_TITLES[theme?.dept] || CHART_TITLES.default;
    const titleList = rng.shuffle(titles);
    const puzzles = [];
    for (let k = 0; k < count; k++) puzzles.push(makePuzzle(size, rng, puzzles.flatMap((p) => p.people.map((x) => x.name))));
    const fl = new Floaters();
    const shake = new Shake();
    const scores = [];
    let left = total;
    let pi = 0;
    let pz;
    let slots;
    let occ; // slot -> person or -1
    let slotOf; // person -> slot or -1
    let held = null; // { p, from }
    let drag = null; // { x, y } press position while the mouse button is down after a pick
    let focus = 0;
    let phase = 'play';
    let reviewT = 0;
    let result = null; // { sat: [bool], frac, score, verdict }
    let usingMouse = false;
    let anim = 0;
    const ptr = { x: -1, y: -1, inside: false }; // last pointer position, for drawing the dragged badge

    const cardRect = (k) => ({ x: 6 + (k % 3) * 98, y: 130 + Math.floor(k / 3) * 32, w: 94, h: 30 });
    const submitRect = { x: 6, y: 231, w: 120, h: 18 };
    const elements = () => [...slots, ...pz.people.map((_, k) => cardRect(k)), submitRect];

    const startPuzzle = () => {
      pz = puzzles[pi];
      slots = layoutTree(pz.par);
      occ = Array(pz.n).fill(-1);
      slotOf = Array(pz.n).fill(-1);
      held = null;
      drag = null;
      focus = pz.n; // first badge
      phase = 'play';
      result = null;
    };
    startPuzzle();

    const place = (p, s) => {
      occ[s] = p;
      slotOf[p] = s;
    };
    const lift = (p) => {
      if (slotOf[p] >= 0) occ[slotOf[p]] = -1;
      slotOf[p] = -1;
    };
    const pick = (p) => {
      held = { p, from: slotOf[p] };
      lift(p);
      sfx('click');
    };
    const putBack = () => {
      if (!held) return;
      if (held.from >= 0 && occ[held.from] < 0) place(held.p, held.from);
      held = null;
    };
    const dropOn = (s) => {
      const q = occ[s];
      place(held.p, s);
      if (q >= 0 && q !== held.p) {
        slotOf[q] = -1;
        if (held.from >= 0 && held.from !== s && occ[held.from] < 0) place(q, held.from);
      }
      held = null;
      sfx('step');
    };

    const evaluate = () => {
      const v = viewOf(pz.par, pz.info, occ, pz.n);
      const sat = pz.clues.map((c) => c.check(v));
      const frac = sat.filter(Boolean).length / sat.length;
      const b = Math.min(pz.base, 0.6) * 0.8;
      return { sat, frac, score: clamp((frac - b) / (1 - b), 0, 1) };
    };

    const submit = () => {
      putBack();
      if (occ.some((p) => p < 0)) {
        sfx('bad');
        fl.add('Fill every box first!', submitRect.x + 60, submitRect.y - 4, C.warn);
        return;
      }
      result = evaluate();
      const allOk = result.sat.every(Boolean);
      result.verdict = rng.pick(allOk ? VERDICT_PERFECT : result.score >= 0.5 ? VERDICT_OK : VERDICT_BAD);
      scores.push(result.score);
      phase = 'review';
      reviewT = 3.2;
      if (allOk) sfx('star');
      else {
        sfx(result.score >= 0.5 ? 'blip' : 'bad');
        shake.hit();
      }
    };

    const endAll = () => finish(inst, scores.reduce((s, x) => s + x, 0) / count);

    // Activate an element (keyboard confirm or mouse click). Returns true if a card was picked up.
    const activate = (e) => {
      const n = pz.n;
      if (e < n) {
        if (held) dropOn(e);
        else if (occ[e] >= 0) {
          pick(occ[e]);
          return true;
        }
      } else if (e < 2 * n) {
        const p = e - n;
        if (held) {
          const was = held.p;
          held = null; // back to the tray
          sfx('click');
          if (was !== p) {
            pick(p);
            return true;
          }
        } else {
          pick(p);
          return true;
        }
      } else submit();
      return false;
    };

    const nav = (dir) => {
      const els = elements();
      const cur = els[focus];
      const cx = cur.x + cur.w / 2;
      const cy = cur.y + cur.h / 2;
      let best = -1;
      let bs = Infinity;
      els.forEach((r, i) => {
        if (i === focus) return;
        const dx = r.x + r.w / 2 - cx;
        const dy = r.y + r.h / 2 - cy;
        const [prim, sec] = dir === 'R' ? [dx, dy] : dir === 'L' ? [-dx, dy] : dir === 'D' ? [dy, dx] : [-dy, dx];
        if (prim <= 2) return;
        const sc = prim + Math.abs(sec) * 2;
        if (sc < bs) (bs = sc), (best = i);
      });
      if (best >= 0) {
        focus = best;
        sfx('blip');
      }
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        const p = input.pointer;
        ptr.x = p.x;
        ptr.y = p.y;
        ptr.inside = p.inside && p.x >= 0;
        if (phase === 'review') {
          reviewT -= dt;
          if (reviewT <= 0 || (reviewT < 2.4 && (input.confirm() || p.clicked))) {
            input.consumeClick();
            pi++;
            if (pi >= count) return endAll();
            startPuzzle();
          }
          return;
        }
        left -= dt;
        if (left <= 0) {
          putBack();
          scores.push(evaluate().score);
          return endAll();
        }
        // Keyboard.
        if (input.pressed('ArrowRight')) nav('R');
        if (input.pressed('ArrowLeft')) nav('L');
        if (input.pressed('ArrowDown')) nav('D');
        if (input.pressed('ArrowUp')) nav('U');
        if (input.confirm()) {
          usingMouse = false;
          activate(focus);
          if (phase !== 'play') return;
        }
        // Mouse: click to pick / drop, or drag and release over a box.
        const els = elements();
        const under = els.findIndex((r) => inR(p, r));
        if (p.moved && under >= 0) focus = under;
        if (p.moved) usingMouse = true;
        if (p.clicked) {
          usingMouse = true;
          if (under >= 0) {
            focus = under;
            const picked = activate(under);
            if (phase !== 'play') return;
            drag = picked ? { x: p.x, y: p.y } : null;
          } else if (held) {
            putBack();
            sfx('click');
          }
        }
        if (p.released && drag) {
          const moved = Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y) > 6;
          drag = null;
          if (moved && held) {
            if (under >= 0 && under < pz.n) dropOn(under);
            else if (under >= pz.n && under < 2 * pz.n) {
              held = null; // dropped back on the tray
              sfx('click');
            } else putBack();
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3b4560' });
        header(g, theme?.title || 'Org Chart Shuffle', count > 1 ? `Reorg ${Math.min(pi + 1, count)}/${count}` : 'Reorg');
        timerBar(g, left, total);
        const review = phase === 'review';

        // Whiteboard with the chart.
        rect(g, BOARD.x - 2, BOARD.y - 2, BOARD.w + 4, BOARD.h + 4, '#8d93a3');
        rect(g, BOARD.x - 1, BOARD.y - 1, BOARD.w + 2, BOARD.h + 2, '#c9ced8');
        rect(g, BOARD.x, BOARD.y, BOARD.w, BOARD.h, '#f4f6f9');
        rect(g, BOARD.x + 4, BOARD.y + BOARD.h - 4, 40, 2, 'rgba(60,90,160,0.15)');
        drawText(g, titleList[pi % titleList.length], BOARD.x + 6, BOARD.y + 3, { color: '#2c4d9a' });
        rect(g, BOARD.x + BOARD.w - 22, BOARD.y + BOARD.h + 2, 16, 3, '#e2504a'); // marker on the tray
        rect(g, BOARD.x + BOARD.w - 40, BOARD.y + BOARD.h + 2, 16, 3, '#3b6fb6');
        // Connector lines.
        for (let s = 1; s < pz.n; s++) {
          const a = slots[pz.par[s]];
          const b = slots[s];
          const ax = a.x + SLOT_W / 2;
          const midY = a.y + SLOT_H + 5;
          const bx = b.x + SLOT_W / 2;
          rect(g, ax, a.y + SLOT_H, 1, midY - a.y - SLOT_H, '#4a5a7a');
          rect(g, Math.min(ax, bx), midY, Math.abs(bx - ax) + 1, 1, '#4a5a7a');
          rect(g, bx, midY, 1, b.y - midY, '#4a5a7a');
        }
        // Boss crown.
        const bs = slots[0];
        const kx = bs.x + SLOT_W / 2 - 5;
        rect(g, kx, bs.y - 4, 11, 3, C.gold);
        rect(g, kx, bs.y - 7, 1, 3, C.gold);
        rect(g, kx + 5, bs.y - 7, 1, 3, C.gold);
        rect(g, kx + 10, bs.y - 7, 1, 3, C.gold);
        // Slots.
        slots.forEach((r, s) => {
          const who = occ[s];
          if (who < 0) {
            rect(g, r.x, r.y, r.w, r.h, '#e6eaf0');
            for (let x = r.x; x < r.x + r.w; x += 4) rect(g, x, r.y, 2, 1, '#9aa3b5'), rect(g, x, r.y + r.h - 1, 2, 1, '#9aa3b5');
            for (let y = r.y; y < r.y + r.h; y += 4) rect(g, r.x, y, 1, 2, '#9aa3b5'), rect(g, r.x + r.w - 1, y, 1, 2, '#9aa3b5');
            drawText(g, '?', r.x + r.w / 2, r.y + 7, { align: 'center', color: '#9aa3b5' });
          } else miniBadge(g, r.x, r.y, pz.people[who]);
          if (focus === s && !review) frame(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, C.gold);
        });

        // Badge tray (a staff directory: placed badges stay listed, dimmed).
        pz.people.forEach((person, k) => {
          const r = cardRect(k);
          const placed = slotOf[k] >= 0;
          const isHeld = held && held.p === k;
          rect(g, r.x + 1, r.y + 2, r.w, r.h, 'rgba(0,0,0,0.3)');
          rect(g, r.x, r.y, r.w, r.h, C.border);
          rect(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, placed || isHeld ? '#b9b4a6' : C.paper);
          rect(g, r.x + 1, r.y + 1, 15, r.h - 2, placed || isHeld ? '#6a7286' : C.accent);
          face(g, r.x + 2, r.y + 8, person.seed);
          drawText(g, person.name, r.x + 19, r.y + 3, { color: C.ink });
          const lines = wrapText(person.quirk, r.w - 22);
          lines.slice(0, 2).forEach((l, i) => drawText(g, l, r.x + 19, r.y + 12 + i * 8, { color: placed ? '#6a6a72' : '#5a4a3a' }));
          if (placed) {
            rect(g, r.x + r.w - 11, r.y + 2, 9, 9, C.border);
            icon(g, 'check', r.x + r.w - 10, r.y + 3);
          }
          if (focus === pz.n + k && !review) frame(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, C.gold);
        });

        // Submit button + status.
        const filled = occ.every((x) => x >= 0);
        panel(g, submitRect.x, submitRect.y, submitRect.w, submitRect.h, filled ? { fill: C.goodBtn, light: '#5fb06a', dark: '#1d5a2a' } : {});
        drawText(g, 'SUBMIT REORG', submitRect.x + submitRect.w / 2, submitRect.y + 5, { align: 'center', color: filled ? C.text : C.dim, shadow: C.border });
        if (focus === 2 * pz.n && !review) frame(g, submitRect.x - 2, submitRect.y - 2, submitRect.w + 4, submitRect.h + 4, C.gold);
        drawText(g, `Placed ${occ.filter((x) => x >= 0).length}/${pz.n}`, 134, submitRect.y + 5, { color: C.text, shadow: C.border });

        // Clue memo (sticky notes on a cork board).
        panel(g, NOTES.x, NOTES.y, NOTES.w, NOTES.h, { fill: '#9a7550', light: '#b8916a', dark: '#6e5236' });
        drawText(g, 'LEAKED HR MEMO', NOTES.x + NOTES.w / 2, NOTES.y + 4, { align: 'center', color: C.text, shadow: C.border });
        let y = NOTES.y + 15;
        const compact = pz.height > NOTES.h - 18;
        pz.clues.forEach((c, i) => {
          const lines = wrapText(`${c.no}. ${c.text}`, NOTE_TEXT_W);
          const lh = compact ? 8 : NOTE_LH;
          const h = lines.length * lh + (compact ? 3 : 6);
          const nx = NOTES.x + 5 + (i % 2);
          rect(g, nx + 1, y + 1, NOTES.w - 10, h, 'rgba(0,0,0,0.25)');
          let fill = NOTE_COLORS[i % NOTE_COLORS.length];
          if (review) fill = result.sat[i] ? '#bfe8a8' : '#f2a8a0';
          rect(g, nx, y, NOTES.w - 10, h, fill);
          rect(g, nx + (NOTES.w - 10) / 2 - 1, y - 1, 3, 2, '#c0392b'); // pin
          lines.forEach((l, j) => drawText(g, l, nx + 3, y + (compact ? 2 : 3) + j * lh, { color: C.ink }));
          if (review) {
            if (result.sat[i]) icon(g, 'check', nx + NOTES.w - 19, y + 1);
            else drawText(g, 'x', nx + NOTES.w - 16, y + 1, { color: '#a8332e' });
          }
          y += h + (compact ? 2 : 3);
        });

        // Held badge follows the pointer (or hovers near the keyboard focus).
        if (held) {
          const els = elements();
          const f = els[focus];
          const followMouse = usingMouse && ptr.inside;
          const hx = Math.round(followMouse ? ptr.x - SLOT_W / 2 : f.x + 6);
          const hy = Math.round(followMouse ? ptr.y - SLOT_H / 2 : f.y - 12 + Math.sin(anim * 6));
          rect(g, hx + 2, hy + 3, SLOT_W, SLOT_H, 'rgba(0,0,0,0.35)');
          miniBadge(g, hx, hy, pz.people[held.p]);
          frame(g, hx - 1, hy - 1, SLOT_W + 2, SLOT_H + 2, C.gold);
        }

        if (review) {
          const okN = result.sat.filter(Boolean).length;
          panel(g, 20, 104, 264, 40, { fill: result.sat.every(Boolean) ? '#2f6b3a' : result.score >= 0.5 ? '#6b5a2f' : '#7a2b2b' });
          drawText(g, result.verdict, 152, 112, { align: 'center', color: C.text, shadow: C.border });
          drawText(g, `${okN}/${result.sat.length} clues hold`, 152, 126, { align: 'center', color: C.gold, shadow: C.border });
        }
        drawText(g, 'Drag badges (or click, then click a box). Arrows + SPACE: pick/drop.', W / 2, 256, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};

/** Badge as shown inside a chart box. */
function miniBadge(g, x, y, person) {
  rect(g, x, y, SLOT_W, SLOT_H, C.border);
  rect(g, x + 1, y + 1, SLOT_W - 2, SLOT_H - 2, C.paper);
  rect(g, x + 1, y + 1, 14, SLOT_H - 2, C.accent);
  face(g, x + 2, y + 4, person.seed);
  drawText(g, person.name, x + 18, y + 7, { color: C.ink });
}
