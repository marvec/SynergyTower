// Org Chart Shuffle content for the C64 overlay (src/minigames/orgchart.js, src/data/mg-orgchart.js).
// The JS game builds each puzzle at run time with a brute force over every placement (up to 7! = 5040), which
// is too slow for a 6502, so the puzzles are built here with the JS generator itself (makePuzzle) and stored
// as data: the chart shape, the target placement, every person's quirk, the score baseline and the clues as
// (template, X, Y). The overlay picks puzzles at random and gives the people fresh names (names are free:
// no clue depends on what someone is called), so the same puzzle rarely looks the same twice.
// The clue memo is a 19-column panel of NOTE_ROWS rows: puzzles whose clues would not fit are skipped. Heights
// are measured with 4-letter placeholder names: the overlay only uses names of up to 4 letters, and a greedy
// word wrap never needs fewer lines for longer words.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makePuzzle } from '../../../src/minigames/orgchart.js';
import { NAMES, QUIRKS, CHART_TITLES, VERDICT_PERFECT, VERDICT_OK, VERDICT_BAD } from '../../../src/data/mg-orgchart.js';
import { createRng } from '../../../src/core/rng.js';
import { wrap } from '../mgdata.js';

const PER_SIZE = 12; // puzzles per chart size (4-7 boxes)
const NOTE_W = 19;
const NOTE_ROWS = 21;
const QUIRK_W = 15; // tray: a quirk in two lines next to the name
const NAME_MAX = 4; // chart boxes are 4 columns
const CHART_W = 20; // columns 0-19
const TITLE_MAX = 30; // header row, left of "Reorg 1/2"
const VERDICT_W = 18;

const SRC = readFileSync(join(import.meta.dir, '../../../src/minigames/orgchart.js'), 'utf8');
const SHAPES = (() => {
  const at = SRC.indexOf('const SHAPES = ');
  return new Function(`return ${SRC.slice(at + 15, SRC.indexOf('};', at) + 1)}`)();
})();

// Clue templates, in the words of candidateClues() in the JS. Codes in the C64 strings: 1 name of X, 2 quirk of
// X, 3 name of Y, 4 quirk of Y, 5 the number Y, 6 "person" / "people" by Y. `check` picks the rule in the overlay.
const CHECK = { boss: 0, notboss: 1, depth1: 2, kids0: 3, kidspos: 4, kidseq: 5, mgr: 6, skip: 7, notmgr: 8, share: 9, level: 10 };
const TEMPLATES = [
  ['{N} is the boss.', 'boss'],
  ['{N} is not the boss.', 'notboss'],
  ['{N} is not the boss (yet).', 'notboss'],
  ['{N} reports directly to the boss.', 'depth1'],
  ['{N} manages nobody anymore.', 'kids0'],
  ['{N} has no direct reports.', 'kids0'],
  ['Nobody reports to {N}. By choice.', 'kids0'],
  ['Whoever {Q} is not a manager.', 'kids0'],
  ['Whoever {Q} manages nobody.', 'kids0'],
  ['{N} has direct reports.', 'kidspos'],
  ['{N} manages a team now.', 'kidspos'],
  ['{N} manages exactly {K} {PP}.', 'kidseq'],
  ['Whoever {Q} is now a manager.', 'kidspos'],
  ['{N} reports to {N2}.', 'mgr'],
  ['{N} reports to whoever {Q2}.', 'mgr'],
  ['Whoever {Q} reports to {N2}.', 'mgr'],
  ["{N2} is {N}'s skip-level boss.", 'skip'],
  ['{N} does not report to {N2}.', 'notmgr'],
  ['{N} and {N2} share a manager.', 'share'],
  ['{N} and {N2} are on the same level.', 'level'],
];

const expand = (t, nx, qx, ny, qy, k) =>
  t.replace('{N2}', ny).replace('{Q2}', qy).replace('{N}', nx).replace('{Q}', qx).replace('{K}', String(k)).replace('{PP}', k === 1 ? 'person' : 'people');

/** (template, X, Y) of a clue text of puzzle `pz`. */
function encodeClue(text, pz) {
  const P = pz.people;
  for (let t = 0; t < TEMPLATES.length; t++) {
    for (let x = 0; x < pz.n; x++) {
      const ys = TEMPLATES[t][1] === 'kidseq' ? [1, 2, 3] : [...Array(pz.n).keys()];
      for (const y of ys) {
        const py = P[y] || P[0];
        if (expand(TEMPLATES[t][0], P[x].name, P[x].quirk, py.name, py.quirk, y) === text) return [t, x, y];
      }
    }
  }
  throw new Error(`orgchart: no template for clue "${text}"`);
}

/** Memo rows of a puzzle's clues with placeholder names, as the overlay wraps them. */
function noteRows(pz, clues) {
  return clues.reduce((h, [t, x, y], i) => {
    const text = `${i + 1}. ${expand(TEMPLATES[t][0], 'MMMM', pz.people[x].quirk, 'MMMM', pz.people[y]?.quirk ?? '', y)}`;
    const lines = wrap(text, NOTE_W);
    if (lines.some((l) => l.endsWith('-'))) throw new Error(`orgchart: word too long in "${text}"`);
    return h + lines.length;
  }, 0);
}

/** Chart geometry for the C64 (cf. layoutTree): box column per slot, the connectors under each parent. */
function layout(par) {
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
  const sp = Math.min(7, Math.floor(CHART_W / leaf));
  const x0 = Math.floor((CHART_W - ((leaf - 1) * sp + NAME_MAX)) / 2);
  const col = xs.map((x) => x0 + Math.floor(x * sp));
  const depth = par.map(() => 0);
  for (let s = 1; s < n; s++) depth[s] = depth[par[s]] + 1;
  const kids = children.map((c) => c.length);
  // connector row under parent p: from its leftmost to its rightmost child's centre (box column + 1)
  const conn = [];
  children.forEach((c, p) => c.length && conn.push([depth[p], col[c[0]] + 1, col[c[c.length - 1]] + 1, col[p] + 1]));
  return { n, par, col, depth, kids, conn };
}

const str = (s) => {
  if (/[^\x20-\x7e]/.test(s)) throw new Error(`no C64 glyph in "${s}"`);
  return `"${s.replaceAll('"', '", 34, "')}", 0`;
};
const coded = (t) =>
  t
    .split(/(\{N2\}|\{Q2\}|\{N\}|\{Q\}|\{K\}|\{PP\})/)
    .filter(Boolean)
    .map((p) => ({ '{N}': '1', '{Q}': '2', '{N2}': '3', '{Q2}': '4', '{K}': '5', '{PP}': '6' })[p] ?? str(p).slice(0, -3))
    .join(', ') + ', 0';
const table = (out, label, items, enc = str) => {
  out.push(`${label}_lo: .byte ${items.map((_, i) => `<${label}${i}`).join(', ')}`);
  out.push(`${label}_hi: .byte ${items.map((_, i) => `>${label}${i}`).join(', ')}`);
  items.forEach((s, i) => out.push(`${label}${i}: .byte ${enc(s)}`));
};

let cache = null;
/** The puzzles (the same for every department): PER_SIZE per size, from a fixed seed. */
function puzzles() {
  if (cache) return cache;
  const shapes = Object.values(SHAPES).flat().map(layout);
  const shapeIndex = (par) => shapes.findIndex((s) => s.par.join() === par.join());
  const rng = createRng(0x0c64);
  const out = [];
  for (let n = 4; n <= 7; n++) {
    let got = 0;
    for (let tries = 0; got < PER_SIZE; tries++) {
      if (tries > 500) throw new Error(`orgchart: too few size-${n} puzzles fit the memo`);
      const pz = makePuzzle(n, rng);
      const clues = pz.clues.map((c) => encodeClue(c.text, pz));
      if (noteRows(pz, clues) > NOTE_ROWS) continue;
      const b = Math.round(Math.min(pz.base, 0.6) * 0.8 * 255);
      out.push({ n, shape: shapeIndex(pz.par), b, target: pz.target, quirks: pz.people.map((p) => QUIRKS.indexOf(p.quirk)), clues });
      got++;
    }
  }
  return (cache = { shapes, list: out });
}

export function dataAsm({ dept = 'lobby' } = {}) {
  const { shapes, list } = puzzles();
  const out = ['; generated by c64/build.js (tools/mg/orgchart.js) from src/minigames/orgchart.js, src/data/mg-orgchart.js'];
  // names (up to 4 letters) and quirks (the full text, and its two tray lines)
  const names = NAMES.filter((x) => x.length <= NAME_MAX);
  out.push(`NM_COUNT = ${names.length}`);
  table(out, 'nm', names);
  const qlines = QUIRKS.map((q) => {
    const l = wrap(q, QUIRK_W);
    if (l.length > 2 || l.some((s) => s.endsWith('-'))) throw new Error(`orgchart: quirk does not fit the tray: ${q}`);
    return [l[0], l[1] || ''];
  });
  table(out, 'qk', qlines, ([a, b]) => `${str(a)}, ${str(b)}`);
  // clue templates and their rules
  out.push(...Object.entries(CHECK).map(([k, v]) => `CK_${k.toUpperCase()} = ${v}`));
  table(out, 'tm', TEMPLATES.map(([t]) => t), coded);
  out.push(`tm_check: .byte ${TEMPLATES.map(([, c]) => `CK_${c.toUpperCase()}`).join(', ')}`);
  // chart shapes: slot columns, depths, direct reports, parents; connectors (depth, left, right, parent column)
  out.push(`shape_n: .byte ${shapes.map((s) => s.n).join(', ')}`);
  for (const [k, f] of [['col', (s) => s.col], ['depth', (s) => s.depth], ['kids', (s) => s.kids], ['par', (s) => s.par.map((p) => p & 0xff)]]) {
    out.push(`sh_${k}_lo: .byte ${shapes.map((_, i) => `<sh${i}_${k}`).join(', ')}`);
    out.push(`sh_${k}_hi: .byte ${shapes.map((_, i) => `>sh${i}_${k}`).join(', ')}`);
    shapes.forEach((s, i) => out.push(`sh${i}_${k}: .byte ${f(s).join(', ')}`));
  }
  out.push(`sh_conn_lo: .byte ${shapes.map((_, i) => `<sh${i}_conn`).join(', ')}`);
  out.push(`sh_conn_hi: .byte ${shapes.map((_, i) => `>sh${i}_conn`).join(', ')}`);
  shapes.forEach((s, i) => out.push(`sh${i}_conn: .byte ${s.conn.length}, ${s.conn.flat().join(', ')}`));
  // puzzles by size: shape, baseline, clue count, target[n] (slot -> person), quirk[n], clues × (template, X, Y)
  out.push(`PZ_PER_SIZE = ${PER_SIZE}`);
  out.push(`pz_lo: .byte ${list.map((_, i) => `<pz${i}`).join(', ')}`);
  out.push(`pz_hi: .byte ${list.map((_, i) => `>pz${i}`).join(', ')}`);
  list.forEach((p, i) => out.push(`pz${i}: .byte ${[p.shape, p.b, p.clues.length, ...p.target, ...p.quirks, ...p.clues.flat()].join(', ')}`));
  out.push(`MAX_CLUES = ${Math.max(...list.map((p) => p.clues.length))}`);
  // the department's chart titles and HR's verdicts (three lines of up to 18)
  const titles = CHART_TITLES[dept] || CHART_TITLES.default;
  for (const t of titles) if (t.length > TITLE_MAX) throw new Error(`orgchart: chart title too long: ${t}`);
  out.push(`TI_COUNT = ${titles.length}`);
  table(out, 'ti', titles);
  const verdicts = [VERDICT_PERFECT, VERDICT_OK, VERDICT_BAD]; // all clues hold / score >= 0.5 / worse
  table(out, 'vd', verdicts.flat(), (v) => {
    const l = wrap(v, VERDICT_W);
    if (l.length > 3 || l.some((x) => x.endsWith('-'))) throw new Error(`orgchart: verdict does not fit: ${v}`);
    return [0, 1, 2].map((k) => str(l[k] || '')).join(', ');
  });
  out.push(`vd_first: .byte ${verdicts.map((_, k) => verdicts.slice(0, k).flat().length).join(', ')}`);
  out.push(`vd_count: .byte ${verdicts.map((v) => v.length).join(', ')}`);
  return out.join('\n') + '\n';
}
