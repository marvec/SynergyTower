// Data for the title / setup / intro overlay (src/sys_title.s), from the JS game's own data.
import { asc } from './floor.js';

/** Corp colours (src/data/corpColors.js) on the C64 palette; same order as corp_c64 in src/main.s. */
export const CORP_C64 = [14, 3, 9, 6, 2, 5, 7, 10, 4, 8, 12, 13];
const SKIN_C64 = [10, 8, 9, 9]; // light, tan, brown, dark brown (the C64 has few skin tones)
const HAIR_C64 = [0, 9, 7, 2, 15]; // dark, brown, blond, red, grey
const CORP_NAMES = ['Synergex', 'Globodyne', 'MegaCorp Holdings', 'Initech Prime', 'Paradigm Dynamics', 'Leverage Unlimited', 'Omnicorp Solutions', 'Bluesky Ventures', 'Strategix', 'Consolidated Widgets'];

export const HOW_TO_C64 = [
  'Move: joystick in port 2, or WASD / cursor keys.',
  'Interact: FIRE, SPACE or RETURN next to a desk, a colleague, the elevator...',
  'Each task is a mini-game that costs coffee and earns paperclips (the office currency), XP and 0-3 KPI stars.',
  'Collect enough stars on a floor, reach the seniority level and the keycard fee, then pass the HR performance review. Only then does the elevator take you up (going down is always fine).',
  'Coffee refills over time. Tasks have cooldowns. Stock Options skip the waiting.',
  'RUN/STOP: menu/back  M: music  B: shop  P: perks  T: training  S: stats',
];

// Badge portraits, one per hair style (multicolour sprite, 12 fat px × 21): '1' hair ($d025), '3' skin ($d026),
// '2' the shirt in the corp colour (sprite colour). Eyes and mouth in the hair colour.
const FACE = ['...333333...', '..33333333..', '..31333313..', '..33333333..', '..33333333..', '...331133...', '....3333....', '.....33.....'];
const SHOULDERS = ['...222222...', '.2222222222.', '222222222222', '222222222222'];
const HAIR = [
  ['...111111...', '..11111111..', '.1111111111.', '.11......11.'], // A: short
  ['....111111..', '..11111111..', '.111111111..', '.1.......11.'], // B: side part
  ['...111111...', '..11111111..', '.1111111111.', '.11......11.', '.11......11.', '.1........1.'], // C: long
  ['....1111....', '....1111....', '...111111...', '..11111111..', '.11......11.'], // D: bun
];

function portrait(style) {
  const hair = HAIR[style];
  const rows = Array(21).fill('............');
  // hair from the top, face below the hair's crown (overlapping the sides), shoulders at the bottom
  const crown = hair.length - (style === 2 ? 3 : 1);
  FACE.forEach((r, i) => (rows[crown + i] = r));
  hair.forEach((r, i) => {
    const base = rows[i];
    rows[i] = [...r].map((c, x) => (c === '1' ? '1' : base[x])).join('');
  });
  SHOULDERS.forEach((r, i) => (rows[17 + i] = r));
  const out = new Uint8Array(64);
  rows.forEach((r, y) => {
    for (let x = 0; x < 12; x++) out[y * 3 + (x >> 2)] |= { '.': 0, 1: 1, 2: 2, 3: 3 }[r[x]] << (6 - (x & 3) * 2);
  });
  return out;
}

// The player's hair on the floor: an overlay sprite over the person sprite (tools/art.js personSprites: the head is
// fat columns 3-8, rows 5-10), in the sprite's own colour ('2'). One frame per facing (down, up, left, right) per
// style; drawn one row higher, because the multiplexer sorts it one line below the player (so it is in front).
const HAIR_DOWN = [
  ['.2222.', '222222', '2....2'], // A short
  ['..2222', '222222', '22....'], // B side-swept
  ['.2222.', '222222', '2....2', '2....2', '2....2'], // C long
  ['.2222.', '222222', '2....2'], // D bun (+ the bun above)
];
const HAIR_UP = [
  ['.2222.', '222222', '222222', '222222'],
  ['.2222.', '222222', '222222', '222222'],
  ['.2222.', '222222', '222222', '222222', '222222', '.2222.'],
  ['.2222.', '222222', '222222', '222222'],
];
const HAIR_LEFT = [
  ['..222.', '.2222.', '...222', '....22'],
  ['.2222.', '22222.', '...222', '....22'],
  ['..222.', '.2222.', '...222', '...222', '...222', '....22'],
  ['..222.', '.2222.', '...222', '....22'],
];
function hairFrame(rows, bun, mirror) {
  const out = new Uint8Array(64);
  const put = (r, y) => {
    const line = '...' + (mirror ? [...r].reverse().join('') : r) + '...';
    for (let x = 0; x < 12; x++) if (line[x] === '2') out[y * 3 + (x >> 2)] |= 2 << (6 - (x & 3) * 2);
  };
  rows.forEach((r, i) => put(r, 4 + i)); // head row 0 = sprite row 5, one higher = 4
  if (bun) put('..22..', 3);
  return out;
}
export function hairFrames() {
  const frames = [];
  for (let style = 0; style < 4; style++)
    frames.push(
      hairFrame(HAIR_DOWN[style], style === 3, false),
      hairFrame(HAIR_UP[style], style === 3, false),
      hairFrame(HAIR_LEFT[style], style === 3, false),
      hairFrame(HAIR_LEFT[style], style === 3, true),
    );
  return frames.flatMap((f) => [...f]);
}

const str = (s) => `.byte ${asc(s).join(', ')}, 0`;

export function titleDataAsm({ bigText, CORP_COLORS, SKIN_TONES, HAIR_COLORS, titles, games }) {
  if (CORP_COLORS.length !== CORP_C64.length || SKIN_TONES.length !== SKIN_C64.length || HAIR_COLORS.length !== HAIR_C64.length)
    throw new Error('corpColors.js changed: update tools/titledata.js');
  const out = ['; generated by c64/build.js (tools/titledata.js)'];
  const logo = (name, text) => {
    const rows = bigText(text);
    out.push(`${name}_W = ${rows[0].length}`);
    rows.forEach((r, i) => out.push(`${name}${i}: .byte ${r.join(', ')}`));
  };
  logo('logo_a', 'SYNERGY');
  logo('logo_b', 'TOWER');
  out.push(`N_COLORS = ${CORP_COLORS.length}`, `N_SKINS = ${SKIN_TONES.length}`, `N_HAIRS = ${HAIR_COLORS.length}`, `N_CORPS = ${CORP_NAMES.length}`);
  out.push(`color_c64: .byte ${CORP_C64.join(', ')}`, `skin_c64: .byte ${SKIN_C64.join(', ')}`, `hair_c64: .byte ${HAIR_C64.join(', ')}`);
  CORP_COLORS.forEach((c, i) => out.push(`cname${i}: ${str(c.name)}`, `chint${i}: ${str(`(${c.hint})`)}`));
  out.push(`cname_lo: .byte ${CORP_COLORS.map((_, i) => `<cname${i}`).join(', ')}`, `cname_hi: .byte ${CORP_COLORS.map((_, i) => `>cname${i}`).join(', ')}`);
  out.push(`chint_lo: .byte ${CORP_COLORS.map((_, i) => `<chint${i}`).join(', ')}`, `chint_hi: .byte ${CORP_COLORS.map((_, i) => `>chint${i}`).join(', ')}`);
  CORP_NAMES.forEach((n, i) => out.push(`corpn${i}: ${str(n)}`));
  out.push(`corpn_lo: .byte ${CORP_NAMES.map((_, i) => `<corpn${i}`).join(', ')}`, `corpn_hi: .byte ${CORP_NAMES.map((_, i) => `>corpn${i}`).join(', ')}`);
  titles.forEach((t, i) => out.push(`ttl${i}: ${str(t)}`));
  out.push(`ttl_lo: .byte ${titles.map((_, i) => `<ttl${i}`).join(', ')}`, `ttl_hi: .byte ${titles.map((_, i) => `>ttl${i}`).join(', ')}`);
  HOW_TO_C64.forEach((t, i) => out.push(`howto${i}: ${str(t)}`));
  out.push(`N_HOWTO = ${HOW_TO_C64.length}`, `howto_lo: .byte ${HOW_TO_C64.map((_, i) => `<howto${i}`).join(', ')}`, `howto_hi: .byte ${HOW_TO_C64.map((_, i) => `>howto${i}`).join(', ')}`);
  out.push(`GAMES_ON_DISK = ${games}`);
  out.push(`portraits: .byte ${[0, 1, 2, 3].flatMap((s) => [...portrait(s)]).join(', ')}`);
  out.push(`hair_frames: .byte ${hairFrames().join(', ')}`); // style × (down, up, left, right)
  return out.join('\n') + '\n';
}
