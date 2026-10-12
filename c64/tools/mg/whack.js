// Whack-a-Bug content for the C64 overlay (src/mg_whack.s): the department's target / decoy names (the THEMES
// literal in src/minigames/whack.js, not exported) and their popup sprites, drawn here as 12 × 12 multicolour
// frames (target, target hit, decoy, decoy hit) with their colours.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dir, '../../../src/minigames/whack.js'), 'utf8');

/** The literal after `const NAME =` up to its closing `;` at the end of a line, evaluated. */
const constant = (name) => {
  const at = SRC.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`whack.js: no const ${name}`);
  return new Function(`return ${SRC.slice(at + name.length + 9, SRC.indexOf(';\n', at))}`)();
};

const str = (s) => {
  if (/[^\x20-\x7e]/.test(s)) throw new Error(`no C64 glyph in "${s}"`);
  return `"${s.replaceAll('"', '", 34, "')}", 0`;
};

// 12 × 12 multicolour sprites: '2' the sprite colour, '1' $d025, '3' $d026 (shared by the theme's sprites).
// Colours: C64 palette 0-15 (sprites may use all 16).
const SPRITES = {
  popup: {
    rows: ['......333...', '222222333...', '222222333...', '22222222....', '22221222....', '22221222....', '22221222....', '22221222....', '22222222....', '22221222....', '22222222....', '22222222....'],
    hit: ['......333...', '222222333...', '222222333...', '22222222....', '21222212....', '22122122....', '22211222....', '22211222....', '22122122....', '21222212....', '22222222....', '22222222....'],
    col: 2, hitCol: 9,
  },
  boss: {
    rows: ['............', '............', '222222222222', '211111111112', '212222222212', '221222222122', '222122221222', '222212212222', '222221122222', '222222222222', '222222222222', '222222222222'],
    hit: null, col: 6, hitCol: 11,
  },
  bug: {
    rows: ['..1......1..', '...1....1...', '...111111...', '...131131...', '.1.222222.1.', '..12222221..', '.1.222222.1.', '..12222221..', '.1.222222.1.', '...222222...', '...222222...', '....2222....'],
    hit: ['............', '............', '............', '............', '...3.3..3.3.', '....3....3..', '...3.3..3.3.', '............', '............', '.2222222222.', '222222222222', '.2222222222.'],
    col: 5, hitCol: 13,
  },
  feature: {
    rows: ['....3..3....', '.....33.....', '222223322222', '222223322222', '333333333333', '222223322222', '222223322222', '222223322222', '222223322222', '222223322222', '222223322222', '222223322222'],
    hit: null, col: 7, hitCol: 8,
  },
  troll: {
    rows: ['222222222222', '221212212222', '221212212222', '221212212222', '221212212222', '222222222222', '221212212222', '222222222222', '.222........', '.22.........', '.2..........', '............'],
    hit: ['222222222222', '222222222222', '222222222222', '222222222222', '222222222222', '212212212222', '222222222222', '222222222222', '.222........', '.22.........', '.2..........', '............'],
    col: 2, hitCol: 9,
  },
  fan: {
    rows: ['222222222222', '222332332222', '223333333222', '223333333222', '222333332222', '222233322222', '222223222222', '222222222222', '.222........', '.22.........', '.2..........', '............'],
    hit: null, col: 1, hitCol: 11,
  },
  ticket: {
    rows: ['............', '222222222222', '222223332222', '222232223222', '122222232221', '122222322221', '222223222222', '222222222222', '222223222222', '222222222222', '............', '............'],
    hit: ['............', '222222222222', '222222222232', '222222222322', '122222223221', '123222232221', '222322322222', '222232222222', '222222222222', '222222222222', '............', '............'],
    col: 8, hitCol: 9,
  },
  thanks: {
    rows: ['............', '222222222222', '222222222222', '222322223222', '222322223222', '222222222222', '223222222322', '222333333222', '222222222222', '222222222222', '............', '............'],
    hit: null, col: 5, hitCol: 11,
  },
};
// Shared colours per theme: $d025, $d026.
const SHARED = { popup: [1, 7], bug: [11, 2], troll: [1, 2], ticket: [1, 0] };

function frameBytes(rows) {
  if (rows.length !== 12 || rows.some((r) => r.length !== 12)) throw new Error('whack sprite: 12 × 12');
  const out = [];
  for (const r of rows) {
    for (let b = 0; b < 3; b++) {
      let v = 0;
      for (let i = 0; i < 4; i++) v = (v << 2) | '.123'.indexOf(r[b * 4 + i]);
      out.push(v);
    }
  }
  return out;
}

export function dataAsm({ dept = 'lobby' } = {}) {
  const THEMES = constant('THEMES');
  const th = THEMES[dept] || THEMES.default;
  const t = SPRITES[th.target];
  const d = SPRITES[th.decoy];
  const title = `Hit the ${th.tName}!`;
  if (title.length > 25) throw new Error(`whack: title too long: ${title}`);
  const spare = `Spare the ${th.dName}`;
  if (spare.length + 13 > 40) throw new Error(`whack: spare line too long: ${spare}`);
  const hex = (a) => a.map((v) => `$${v.toString(16).padStart(2, '0')}`).join(', ');
  const frames = [t.rows, t.hit || t.rows, d.rows, d.hit || d.rows].map(frameBytes);
  return [
    '; generated by c64/build.js (tools/mg/whack.js) from src/minigames/whack.js',
    `; theme: ${th.target} / ${th.decoy}`,
    `s_title: .byte ${str(title)}`,
    `s_spare: .byte ${str(spare)}`,
    `s_spare0: .byte ${str(spare + ' (none today)')}`,
    `pop_cols: .byte ${t.col}, ${t.hitCol}, ${d.col}, ${d.hitCol}   ; target, target hit, decoy, decoy hit`,
    `POP_MC1 = ${SHARED[th.target][0]}`,
    `POP_MC2 = ${SHARED[th.target][1]}`,
    `MON_CHAR = ${th.target === 'bug' ? 'MC_A' : 'MC_B'}   ; the monitor's screen: dark for bugs`,
    'pop_frames:',
    ...frames.map((f) => `        .byte ${hex(f)}`),
    'POP_BYTES = 36',
  ].join('\n') + '\n';
}
