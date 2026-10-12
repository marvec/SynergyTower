// Perfect Timing content for the C64 overlay (src/mg_timing.s): the department's theme texts (read from the THEMES
// literal in src/minigames/timing.js, which isn't exported) and its illustration, drawn here in C64 chars as four
// 22 × 10 frames (idle, idle blink, hit, miss) that the overlay copies to the screen.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dir, '../../../src/minigames/timing.js'), 'utf8');

/** The literal after `const NAME =` up to its closing `;` at the end of a line, evaluated. */
const constant = (name) => {
  const at = SRC.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`timing.js: no const ${name}`);
  return new Function(`return ${SRC.slice(at + name.length + 9, SRC.indexOf(';\n', at))}`)();
};

const str = (s) => {
  if (/[^\x20-\x7e]/.test(s)) throw new Error(`no C64 glyph in "${s}"`);
  return `"${s.replaceAll('"', '", 34, "')}", 0`;
};

/** Word wrap to `w` columns. */
const wrap = (s, w) => {
  const lines = [''];
  for (const word of s.split(' ')) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = word;
    else if (cur.length + 1 + word.length <= w) lines[lines.length - 1] = `${cur} ${word}`;
    else lines.push(word);
  }
  return lines;
};

// ---- the illustrations: 22 × 10 cells at columns 9-30, rows 3-12
const AW = 22;
const AH = 10;
const C = { black: 0, white: 1, red: 2, cyan: 3, purple: 4, green: 5, blue: 6, yellow: 7 };
// cell kinds -> [char expression, colour RAM]
const BLOCK = (c) => ['CH_BLOCK', c];
const DARK = ['MC_A', 8]; // multicolour dark grey
const GREY = ['MC_B', 8]; // multicolour mid grey
const SOLID = (c) => ['MC_C', c | 8]; // multicolour, all colour-RAM colour
const Q = (p, c) => [String(240 + p), c]; // quarter blocks: 1 top left, 2 top right, 4 bottom left, 8 bottom right
const TOP = (c) => Q(3, c);
const BOT = (c) => Q(12, c);
const SPACE = ['32', 0];

class Art {
  constructor() {
    this.cells = Array.from({ length: AH }, () => Array.from({ length: AW }, () => SPACE));
  }
  rect(x, y, w, h, cell) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, cell);
    return this;
  }
  put(x, y, cell) {
    if (x < 0 || y < 0 || x >= AW || y >= AH) throw new Error(`timing art: cell ${x},${y} outside`);
    this.cells[y][x] = cell;
    return this;
  }
  text(x, y, s, c) {
    if (x === 'c') x = Math.floor((AW - s.length) / 2);
    if (x + s.length > AW) throw new Error(`timing art: "${s}" does not fit`);
    [...s].forEach((ch, i) => this.put(x + i, y, [String(ch.charCodeAt(0)), c]));
    return this;
  }
  face(x, y, hair) {
    return this.put(x, y, ['CH_HAIRL', hair]).put(x + 1, y, ['CH_HAIRR', hair]).put(x, y + 1, ['CH_FACEL', C.yellow]).put(x + 1, y + 1, ['CH_FACER', C.yellow]);
  }
}

/** Each art: (art, state) -> draws one frame; state 'idle' | 'blink' | 'hit' | 'miss'. */
const ART = {
  printer(a, st) {
    const hit = st === 'hit';
    a.rect(6, 0, 10, 1, BOT(C.white)).rect(6, 1, 10, 1, BLOCK(C.white)); // paper in the tray
    a.rect(4, 1, 2, 1, GREY).rect(16, 1, 2, 1, GREY);
    a.rect(3, 2, 16, 6, GREY); // body
    a.rect(5, 3, 8, 1, DARK); // display
    a.put(14, 3, BLOCK(hit ? C.green : st === 'idle' || st === 'miss' ? C.red : C.black));
    a.text(15, 3, hit ? 'OK ' : 'JAM', hit ? C.green : C.red);
    a.rect(4, 6, 14, 1, DARK); // output slot
    if (hit) {
      a.rect(15, 0, 6, 2, BLOCK(C.white)).put(15, 2, TOP(C.white)).put(16, 2, TOP(C.white)); // the freed page flies off
    } else {
      const jig = st === 'blink' ? 1 : 0;
      a.rect(6 + jig, 6, 7, 2, BLOCK(C.white)).rect(6 + jig, 8, 7, 1, TOP(C.white)); // the jammed page
      if (st === 'miss') a.put(19, 1, GREY).put(20, 0, GREY).put(21, 2, DARK).put(20, 2, GREY); // smoke
    }
  },
  deal(a, st) {
    const reach = { idle: 0, blink: 1, hit: 2, miss: -2 }[st];
    a.face(2, 1, C.red).rect(1, 3, 4, 3, BLOCK(C.blue)); // you
    a.face(18, 1, C.black).rect(17, 3, 4, 3, BLOCK(C.red)); // the client (black hair: just the face)
    a.rect(2, 6, 18, 1, DARK).rect(4, 7, 1, 3, DARK).rect(17, 7, 1, 3, DARK); // table
    a.rect(8, 5, 6, 1, BOT(C.white)); // the contract
    const lx = 8 + reach; // your hand
    a.rect(5, 4, lx - 5, 1, BLOCK(C.blue)).put(lx, 4, BLOCK(C.yellow));
    const rx = 13 - reach;
    a.rect(rx + 1, 4, 16 - rx, 1, BLOCK(C.red)).put(rx, 4, BLOCK(C.yellow));
    if (st === 'hit') a.text('c', 0, '$ $ $', C.yellow);
  },
  deploy(a, st) {
    a.rect(0, 0, AW, 1, DARK).rect(0, 8, AW, 1, DARK).rect(0, 1, 1, 7, DARK).rect(AW - 1, 1, 1, 7, DARK);
    ['$ git push prod', '> building...', '> running tests...', '> waiting for window'].forEach((l, i) => a.text(1, 1 + i, l, C.green));
    if (st === 'hit' || st === 'miss') {
      const c = st === 'hit' ? C.green : C.red;
      const t = st === 'hit' ? 'DEPLOYED v2.0' : 'ROLLBACK!';
      a.rect(3, 5, 16, 3, SOLID(c)).rect(4, 6, 14, 1, SPACE).text('c', 6, t, C.white);
    } else if (st === 'idle') a.text(1, 5, '_', C.green);
  },
  bell(a, st) {
    const s = st === 'blink' ? 1 : 0; // the bell sways
    a.rect(10, 0, 2, 1, DARK);
    a.rect(9 + s, 1, 4, 1, BLOCK(C.yellow)).rect(8 + s, 2, 6, 2, BLOCK(C.yellow)).rect(7 + s, 4, 8, 1, BLOCK(C.yellow));
    a.rect(6 + s, 5, 10, 1, TOP(C.yellow)).put(9 + s, 2, BLOCK(C.white)).put(9 + s, 3, Q(5, C.white));
    a.rect(10 + s, 6, 2, 1, DARK); // clapper
    a.text('c', 8, 'MARKET OPEN', st === 'hit' ? C.green : C.cyan);
    if (st === 'hit') for (let i = 0; i < 3; i++) a.text(4 - i, 2 + i, '-', C.yellow).text(17 + i, 2 + i, '-', C.yellow);
  },
  camera(a, st) {
    a.rect(3, 1, 3, 1, DARK).rect(2, 2, 11, 6, DARK); // body
    a.rect(11, 2, 2, 1, BLOCK(C.white)); // flash
    a.rect(6, 3, 5, 4, SPACE).rect(7, 4, 3, 2, SOLID(C.blue)).put(7, 4, SOLID(C.cyan)); // lens
    a.rect(15, 7, 5, 3, GREY).rect(16, 4, 3, 3, BLOCK(C.red)).put(17, 5, BLOCK(C.white)); // the product on its pedestal
    if (st === 'hit') a.put(13, 1, ['CH_STAR', C.yellow]).put(14, 0, ['CH_STAR', C.white]).put(14, 2, ['CH_STAR', C.yellow]).put(12, 0, ['CH_STAR', C.white]);
    if (st === 'miss') a.text(14, 3, '~blur~', C.red);
  },
  sign(a, st) {
    a.text('c', 0, 'MERGER AGREEMENT', C.white);
    a.rect(3, 1, 16, 8, SOLID(C.white)); // the page
    [12, 10, 12, 8].forEach((w, i) => a.rect(5, 2 + i, w, 1, GREY)); // its small print
    a.rect(5, 7, 10, 1, DARK); // the line to sign on
    if (st === 'hit') a.rect(6, 6, 2, 1, SOLID(C.blue)).rect(8, 6, 1, 1, SOLID(C.white)).rect(9, 6, 4, 1, SOLID(C.blue));
    if (st === 'miss') a.put(10, 5, SOLID(C.blue)).rect(9, 6, 3, 1, SOLID(C.blue));
  },
};

const STATES = ['idle', 'blink', 'hit', 'miss'];

export function dataAsm({ dept = 'lobby' } = {}) {
  const THEMES = constant('THEMES');
  const th = THEMES[dept] || THEMES.default;
  const out = ['; generated by c64/build.js (tools/mg/timing.js) from src/minigames/timing.js', `; theme: ${th.art}`, `ART_W = ${AW}`, `ART_H = ${AH}`];
  const one = (label, s, max) => {
    if (s.length > max) throw new Error(`timing: "${s}" longer than ${max}`);
    out.push(`${label}: .byte ${str(s)}`);
  };
  one('s_verb', `FIRE to ${th.verb}`, 38);
  one('s_thhit', th.hit, 38);
  one('s_thmiss', th.miss, 38);
  one('s_mash', th.mash, 38);
  one('s_mashed', th.mashed, 38);
  const hint = wrap(th.hint, 38);
  if (hint.length > 2) throw new Error(`timing: hint needs more than 2 lines: ${th.hint}`);
  one('s_hint1', hint[0], 38);
  one('s_hint2', hint[1] || '', 38);
  th.smacks.forEach((s, i) => one(`smack${i}`, s, 9));
  out.push(`SMACKS = ${th.smacks.length}`);
  out.push(`smack_lo: .byte ${th.smacks.map((_, i) => `<smack${i}`).join(', ')}`);
  out.push(`smack_hi: .byte ${th.smacks.map((_, i) => `>smack${i}`).join(', ')}`);
  out.push(`smack_len: .byte ${th.smacks.map((s) => s.length).join(', ')}`);
  STATES.forEach((st, f) => {
    const a = new Art();
    ART[th.art](a, st);
    const flat = a.cells.flat();
    out.push(`art_ch${f}: .byte ${flat.map((c) => c[0]).join(', ')}`);
    out.push(`art_co${f}: .byte ${flat.map((c) => c[1]).join(', ')}`);
  });
  out.push(`art_ch_lo: .byte ${STATES.map((_, f) => `<art_ch${f}`).join(', ')}`);
  out.push(`art_ch_hi: .byte ${STATES.map((_, f) => `>art_ch${f}`).join(', ')}`);
  out.push(`art_co_lo: .byte ${STATES.map((_, f) => `<art_co${f}`).join(', ')}`);
  out.push(`art_co_hi: .byte ${STATES.map((_, f) => `>art_co${f}`).join(', ')}`);
  return out.join('\n') + '\n';
}
