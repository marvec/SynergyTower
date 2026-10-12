// PowerPoint Karaoke content for the C64 overlay (mg_karaoke.s), from src/data/mg-karaoke.js: the department's
// metrics and slide titles + the common pools, the narration templates (placeholders as bytes 1-13, filled in at
// run time), the chart geometry the overlay cannot afford to compute (pie cells and their angles, the Venn
// circles), a sine table for the laser pointer, and the sprites (the presenter's four faces, the laser pointer).
import * as K from '../../../src/data/mg-karaoke.js';
import { wrap } from '../mgdata.js';
import { trainBpe, encodeBpe } from '../bpe.js';

const OPT_W = 37; // a narration: 2 lines of 37 columns (cols 3-39)
const TITLE_MAX = 30; // slide title, cols 8-37
const LABEL_MAX = 13; // pie legend label, cols 21-33 (the percentage at 36-38)
const STAGE_MAX = 11; // funnel stage, right-aligned to col 17
const AXIS_MAX = 10; // matrix axis words ("^ " + word right-aligned to col 18)
const VENN_MAX = 11; // Venn set names (left: right-aligned to col 21, right: from col 25)
const VENN_C_MAX = 20; // the overlap, centred under the circles
const METRIC_MAX = 28; // "^ " + metric on row 4
const REACT_MAX = 13; // a cheer / cricket in a 13-column slot of row 23
// Deterministic subsets (the first ones of each pool) so the overlay fits its 8 KB: the JS has more of each.
const KEEP = { metrics: 11, nonsense: 8, trend: 3, wrongType: 1, pies: 5, funnels: 4, venns: 6, matrices: 7, cheers: 5, crickets: 3, titles: 4 };

// placeholder codes (1 = {Y}: the metric with a capital letter, the overlay capitalises slot 2)
const CODES = { Y: 1, y: 2, unit: 3, prep: 4, X: 5, L: 6, a: 7, b: 8, A: 9, B: 10, S1: 11, S2: 12, C: 13 };
const SHAPES = ['rising', 'falling', 'peak', 'dip', 'flat']; // the overlay's shape numbers
const TYPES = ['bar', 'line', 'pie', 'matrix', 'funnel', 'venn'];

// short x labels for the bar/line chart, made by the overlay (shorten): a slot is 7 / 5 / 4 columns for 4 / 5 / 6
// points, the label at most slot - 1: spaces dropped, then cut to fit, keeping a last digit ("Sprint 3" -> "Spr3")
const SLOT_LABEL = { 4: 6, 5: 4, 6: 3 };
const shortX = (l, n) => {
  const m = SLOT_LABEL[n];
  let s = l.replaceAll(' ', '');
  if (s.length > m) s = /[0-9]$/.test(s) ? s.slice(0, m - 1) + s.slice(-1) : s.slice(0, m);
  if (s.length > m) throw new Error(`karaoke: x label ${l} too long for ${n} points`);
  return s;
};

const ascii = (s) => {
  if (/[^\x20-\x7e]/.test(s)) throw new Error(`no C64 glyph in "${s}"`);
  return s;
};
const max = (s, n, what) => {
  if (s.length > n) throw new Error(`karaoke: ${what} too long (${s.length} > ${n}): ${s}`);
  return s;
};
// texts as byte values: plain characters, or a template with {name} placeholders as code bytes
const bytes = (s) => [...ascii(s)].map((c) => c.charCodeAt(0));
function tmpl(t) {
  const out = [];
  for (const part of t.split(/(\{\w+\})/)) {
    const m = part.match(/^\{(\w+)\}$/);
    if (m) {
      if (!CODES[m[1]]) throw new Error(`karaoke: unknown placeholder ${part} in ${t}`);
      out.push(CODES[m[1]]);
    } else out.push(...bytes(part));
  }
  return out;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fillT = (t, m) => t.replace(/\{(\w+)\}/g, (all, k) => (k in m ? m[k] : all));

/** Every narration the department's slides can produce must fit 2 lines of OPT_W. */
function checkNarrations(metrics) {
  const fits = (s) => {
    if (wrap(s, OPT_W).length > 2) throw new Error(`karaoke: narration longer than 2 lines: ${s}`);
  };
  for (const sh of SHAPES) for (const t of K.TREND[sh]) for (const y of metrics) for (const xs of K.X_SETS) for (const X of xs.labels) fits(fillT(t, { Y: cap(y), y, unit: xs.unit, prep: xs.prep, X }));
  for (const p of K.PIES) for (const L of p.labels) for (const t of K.PIE_T) fits(fillT(t, { L }));
  for (const [A, B] of K.MATRICES) for (const t of K.MATRIX_T) for (const a of ['high', 'low']) for (const b of ['high', 'low']) fits(fillT(t, { a, b, A, B }));
  for (const f of K.FUNNELS) for (let i = 0; i < 3; i++) for (const t of K.FUNNEL_T) fits(fillT(t, { S1: f.stages[i], S2: f.stages[i + 1] }));
  for (const v of K.VENNS) for (const t of K.VENN_T) for (const c of K.VENNS) fits(fillT(t, { A: v.a, B: v.b, C: c.c }));
  for (const k of TYPES) for (const t of K.WRONG_TYPE[k]) fits(t);
  for (const t of K.NONSENSE) fits(t);
}

// ---- chart geometry (quarter-block pixels: 2 × 2 per cell)
const QB = 240;
/** Pie: 8 × 8 cells, a circle of radius 7.6 px; per cell its quarter-block char (0 = empty) and the angle of its
 * centre clockwise from 12 o'clock (0-255). */
function pieCells() {
  const chars = [];
  const angles = [];
  const R = 7.6;
  for (let cy = 0; cy < 8; cy++)
    for (let cx = 0; cx < 8; cx++) {
      let bits = 0;
      [[0, 0, 1], [1, 0, 2], [0, 1, 4], [1, 1, 8]].forEach(([dx, dy, b]) => {
        const px = cx * 2 + dx + 0.5 - 8;
        const py = cy * 2 + dy + 0.5 - 8;
        if (px * px + py * py <= R * R) bits |= b;
      });
      chars.push(bits ? QB + bits : 0);
      const ax = cx * 2 + 1 - 8;
      const ay = cy * 2 + 1 - 8;
      const a = ((Math.atan2(ax, -ay) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      angles.push(Math.min(255, Math.floor(a * 256)));
    }
  return { chars, angles };
}
/** Venn: 11 × 7 cells, circles of radius 6.6 px around (7, 7) and (15, 7); per cell its char (0 = empty) and its
 * region: 1 left only, 2 right only, 3 both (the most pixels; the overlap wins ties). */
function vennCells() {
  const chars = [];
  const regions = [];
  const R = 6.6;
  for (let cy = 0; cy < 7; cy++)
    for (let cx = 0; cx < 11; cx++) {
      let bits = 0;
      const n = [0, 0, 0, 0];
      [[0, 0, 1], [1, 0, 2], [0, 1, 4], [1, 1, 8]].forEach(([dx, dy, b]) => {
        const px = cx * 2 + dx + 0.5;
        const py = cy * 2 + dy + 0.5;
        const inA = (px - 7) ** 2 + (py - 7) ** 2 <= R * R;
        const inB = (px - 15) ** 2 + (py - 7) ** 2 <= R * R;
        const r = (inA ? 1 : 0) | (inB ? 2 : 0);
        if (r) bits |= b;
        n[r]++;
      });
      chars.push(bits ? QB + bits : 0);
      regions.push(n[3] && n[3] >= n[1] && n[3] >= n[2] ? 3 : n[1] >= n[2] ? 1 : 2);
    }
  return { chars, regions };
}

// ---- sprites: 12 fat px × 21 rows, '1' = $d025 black, '2' = sprite colour (shirt), '3' = $d026 skin
const HEAD = ['...111111...', '..11111111..', '..13333331..'];
const FACES = {
  idle: ['.3331331333.', '..33333333..', '..33111133..', '...333333...'],
  talk: ['.3331331333.', '..33333333..', '..33311333..', '...331133...'],
  happy: ['.3313333133.', '..31333313..', '..33111133..', '...333333...'],
  sweat: ['23331331333.', '2.33333333.2', '..33311333.2', '...313313...'],
};
const BODY = [
  '..22233222.3', '.222222222.3', '.22222222223', '.2222222222.', '.2222222222.', '.2222222222.', '.3222222222.',
  '..11111111..', '..111..111..', '..111..111..', '..111..111..', '..111..111..', '.1111..1111.',
  '............', '............',
];
// hires frames: 24 px × 21, '#' set
const LASER = ['.##.....................', '####....................', '####....................', '.##.....................'];

function mcSprite(rows) {
  if (rows.length !== 21 || rows.some((r) => r.length !== 12)) throw new Error('karaoke: sprite must be 12 × 21');
  const out = new Array(64).fill(0);
  rows.forEach((r, y) => {
    for (let x = 0; x < 12; x++) out[y * 3 + (x >> 2)] |= { '.': 0, 1: 1, 2: 2, 3: 3 }[r[x]] << (6 - (x & 3) * 2);
  });
  return out;
}
function hiresSprite(rows) {
  const out = new Array(64).fill(0);
  rows.forEach((r, y) => {
    for (let x = 0; x < 24; x++) if (r[x] === '#') out[y * 3 + (x >> 3)] |= 0x80 >> (x & 7);
  });
  return out;
}
export function sprites() {
  const faces = ['idle', 'talk', 'happy', 'sweat'].map((f) => mcSprite([...HEAD, ...FACES[f], ...BODY.slice(0, 14)]));
  return [...faces, hiresSprite(LASER)];
}

export function dataAsm({ dept = 'lobby' } = {}) {
  const out = ['; generated by c64/build.js from src/data/mg-karaoke.js (tools/mg/karaoke.js)'];
  const deptMetrics = K.DEPT_METRICS[dept] || [];
  const common = K.METRICS.slice(0, KEEP.metrics);
  const metrics = [...common, ...deptMetrics];
  checkNarrations([...K.METRICS, ...deptMetrics]);
  const lists = []; // [name, [byte arrays]]: strings one after the other, found by skipping (no pointer tables)
  const list = (name, items) => lists.push([name, items]);

  // metrics: the common ones, then the department's
  out.push(`M_GEN = ${common.length}`, `M_DEPT = ${deptMetrics.length}`);
  list('met', metrics.map((m) => bytes(max(m, METRIC_MAX, 'metric'))));
  // x axes: unit, preposition, the full labels (narrations), the short ones (chart); points and first string
  out.push(`XS_COUNT = ${K.X_SETS.length}`);
  const xs = [];
  const xsSkip = [];
  for (const x of K.X_SETS) {
    xsSkip.push(xs.length);
    x.labels.forEach((l) => shortX(l, x.labels.length));
    xs.push(...[x.unit, x.prep, ...x.labels].map(bytes));
  }
  out.push(`xs_n: .byte ${K.X_SETS.map((x) => x.labels.length).join(', ')}`, `xs_skip: .byte ${xsSkip.join(', ')}`);
  list('xs', xs);

  // narration templates per shape, and per chart type
  let first = 0;
  const trend = Object.fromEntries(SHAPES.map((sh) => [sh, K.TREND[sh].slice(0, KEEP.trend)]));
  out.push(`tr_first: .byte ${SHAPES.map((sh) => ((first += trend[sh].length), first - trend[sh].length)).join(', ')}`);
  out.push(`tr_count: .byte ${SHAPES.map((sh) => trend[sh].length).join(', ')}`);
  list('tr', SHAPES.flatMap((sh) => trend[sh]).map(tmpl));
  out.push(`PIE_T_N = ${K.PIE_T.length}`, `MATRIX_T_N = ${K.MATRIX_T.length}`, `FUNNEL_T_N = ${K.FUNNEL_T.length}`, `VENN_T_N = ${K.VENN_T.length}`);
  list('pt', K.PIE_T.map(tmpl));
  list('mt', K.MATRIX_T.map(tmpl));
  list('ft', K.FUNNEL_T.map(tmpl));
  list('vt', K.VENN_T.map(tmpl));
  // the wrong kind of chart: KEEP.wrongType per type, in TYPES order
  out.push(`WT_PER = ${KEEP.wrongType}`);
  list('wt', TYPES.flatMap((k) => K.WRONG_TYPE[k].slice(0, KEEP.wrongType)).map(bytes));
  const nonsense = K.NONSENSE.slice(0, KEEP.nonsense);
  out.push(`NONS_N = ${nonsense.length}`);
  list('ns', nonsense.map(bytes));

  // slide titles: the department's, then the generic ones
  const tDept = K.TITLES[dept] || [];
  out.push(`T_DEPT = ${tDept.length}`, `T_GEN = ${Math.min(KEEP.titles, K.TITLES.generic.length)}`);
  list('ti', [...tDept, ...K.TITLES.generic.slice(0, KEEP.titles)].map((t) => bytes(max(t, TITLE_MAX, 'title'))));
  // pies: title + labels; label count and first string per pie
  const pies = K.PIES.slice(0, KEEP.pies);
  out.push(`PIES_N = ${pies.length}`);
  const pi = [];
  const piSkip = [];
  for (const p of pies) {
    piSkip.push(pi.length);
    pi.push(bytes(max(p.title, TITLE_MAX, 'pie title')), ...p.labels.map((l) => bytes(max(l, LABEL_MAX, 'pie label'))));
  }
  out.push(`pi_nlab: .byte ${pies.map((p) => p.labels.length).join(', ')}`, `pi_skip: .byte ${piSkip.join(', ')}`);
  list('pi', pi);
  const mats = K.MATRICES.slice(0, KEEP.matrices);
  out.push(`MATS_N = ${mats.length}`);
  list('ma', mats.flatMap(([a, b]) => [max(a, AXIS_MAX, 'axis'), max(b, AXIS_MAX, 'axis')]).map(bytes));
  out.push(`MTIT_N = ${K.MATRIX_TITLES.length}`);
  list('mx', K.MATRIX_TITLES.map((t) => bytes(max(t, TITLE_MAX, 'title'))));
  const funs = K.FUNNELS.slice(0, KEEP.funnels);
  out.push(`FUNS_N = ${funs.length}`);
  list('fu', funs.flatMap((f) => [max(f.title, TITLE_MAX, 'title'), ...f.stages.map((st) => max(st, STAGE_MAX, 'stage'))]).map(bytes));
  const venns = K.VENNS.slice(0, KEEP.venns);
  out.push(`VENNS_N = ${venns.length}`);
  list('ve', venns.flatMap((v) => [max(v.a, VENN_MAX, 'venn'), max(v.b, VENN_MAX, 'venn'), max(v.c, VENN_C_MAX, 'venn')]).map(bytes));
  out.push(`VTIT_N = ${K.VENN_TITLES.length}`);
  list('vx', K.VENN_TITLES.map((t) => bytes(max(t, TITLE_MAX, 'title'))));
  // the audience
  const cheers = K.CHEERS.slice(0, KEEP.cheers);
  const crickets = K.CRICKETS.slice(0, KEEP.crickets);
  out.push(`CHEERS_N = ${cheers.length}`, `CRICKETS_N = ${crickets.length}`);
  list('ch', [...cheers, ...crickets].map((t) => bytes(max(t, REACT_MAX, 'reaction'))));

  // byte-pair encode every text with one table (tools/bpe.js; 128-255 = pairs, placeholders stay 1-13)
  const all = lists.flatMap(([, items]) => items);
  const pairs = trainBpe(all);
  out.push(`bpe_a: .byte ${pairs.map((p) => p[0]).join(', ')}`, `bpe_b: .byte ${pairs.map((p) => p[1]).join(', ')}`);
  out.push(...lists.map(([name], i) => `L_${name.toUpperCase()} = ${i}`));
  out.push(`list_lo: .byte ${lists.map(([name]) => `<${name}_strs`).join(', ')}`, `list_hi: .byte ${lists.map(([name]) => `>${name}_strs`).join(', ')}`);
  for (const [name, items] of lists) {
    out.push(`${name}_strs:`);
    for (const it of items) out.push(`  .byte ${[...encodeBpe(it, pairs), 0].join(', ')}`);
  }

  // geometry, sine, sprites (the presenter as shared rows: head, 4 faces, body; the cricket and laser rows)
  // pie cells: angle / 16 in the high nibble, the quarter-block bits in the low one (0 = empty)
  const pie = pieCells();
  out.push(`pie_cell: .byte ${pie.chars.map((c, i) => (c ? ((pie.angles[i] >> 4) << 4) | (c - QB) : 0)).join(', ')}`);
  // Venn cells: region (1 left, 2 right, 3 both) in bits 4-5, the quarter-block bits in the low nibble
  const venn = vennCells();
  out.push(`venn_cell: .byte ${venn.chars.map((c, i) => (c ? (venn.regions[i] << 4) | (c - QB) : 0)).join(', ')}`);
  // laser pointer: a wobbly figure-eight over the slide (sprite x - 100, sprite y), 32 points
  const lp = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return [Math.round(200 - 100 + Math.sin(a) * 74 + Math.sin(a * 7) * 2), Math.round(112 + Math.sin(a * 2) * 18 + Math.cos(a * 9) * 2)];
  });
  out.push(`laser_x: .byte ${lp.map((p) => p[0]).join(', ')}`, `laser_y: .byte ${lp.map((p) => p[1]).join(', ')}`);
  const mc = (rows) => mcSprite([...rows, ...Array(21 - rows.length).fill('............')]).slice(0, rows.length * 3);
  out.push(`spr_head: .byte ${mc(HEAD).join(', ')}`);
  out.push(`spr_faces: .byte ${['idle', 'talk', 'happy', 'sweat'].flatMap((f) => mc(FACES[f])).join(', ')}`);
  out.push(`spr_body: .byte ${mc(BODY.slice(0, 14)).join(', ')}`);
  out.push(`spr_laser: .byte ${hiresSprite(LASER).slice(0, 12).join(', ')}`);
  return out.join('\n') + '\n';
}
