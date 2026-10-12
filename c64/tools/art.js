// Charset + sprite art for the C64 build.
//
// Multicolour character cells are 4 fat pixels × 8 rows. Symbols:
//   '.' = $D021 black, 'a' = $D022 dark grey, 'b' = $D023 mid grey, 'c' = colour RAM (0-7, per cell)
//   '_' = transparent (only in furniture drawings; resolved against the cell underneath)
// Hires cells (font, UI) are 8 × 8, '#' = colour RAM.
import { readFileSync } from 'node:fs';

export const BG = 0; // $D021 black
export const MC1 = 11; // $D022 dark grey
export const MC2 = 12; // $D023 mid grey
export const COL = { black: 0, white: 1, red: 2, cyan: 3, purple: 4, green: 5, blue: 6, yellow: 7 };

// ---------------------------------------------------------------- charset allocation

export class Charset {
  constructor() {
    this.bytes = new Uint8Array(2048);
    this.used = new Map(); // key -> index
    this.next = 128; // tiles and furniture live in 128-255
    this.limit = 256; // (codes from `limit` up are reserved: quarter blocks for the title logo)
  }
  setHires(index, rows) {
    rows.forEach((r, y) => {
      let b = 0;
      for (let x = 0; x < 8; x++) if (r[x] === '#') b |= 0x80 >> x;
      this.bytes[index * 8 + y] = b;
    });
  }
  /** Multicolour cell from 8 rows of 4 symbols; deduplicated. Returns the char index. */
  mc(rows) {
    const key = rows.join('|');
    if (this.used.has(key)) return this.used.get(key);
    if (this.next >= this.limit) throw new Error(`charset full: more than ${this.limit - 128} tile/furniture cells`);
    const index = this.next++;
    rows.forEach((r, y) => {
      let b = 0;
      for (let x = 0; x < 4; x++) b |= { '.': 0, a: 1, b: 2, c: 3 }[r[x]] << (6 - x * 2);
      this.bytes[index * 8 + y] = b;
    });
    this.used.set(key, index);
    return index;
  }
}

// ---------------------------------------------------------------- font (from the game's own bitmap font)

export function fontGlyphs(fontSource) {
  const src = readFileSync(fontSource, 'utf8');
  const start = src.indexOf('const G = {');
  const end = src.indexOf('\n};', start);
  return new Function(`return ${src.slice(start + 10, end + 2)}`)();
}

export function addFont(cs, glyphs) {
  for (let code = 32; code < 127; code++) {
    const ch = String.fromCharCode(code);
    const def = glyphs[ch] || glyphs['?'];
    const rows = def.split('|');
    const w = rows[0].length;
    const ox = Math.max(0, Math.floor((7 - w) / 2));
    const cell = Array.from({ length: 8 }, (_, y) => {
      const r = rows[y] || '';
      return ('.'.repeat(ox) + r.replaceAll('#', '#') + '........').slice(0, 8);
    });
    cs.setHires(code, cell);
  }
}

// ---------------------------------------------------------------- UI chars (hires, 0-31)

export const UI = {
  blank: 0,
  block: 1,
  clip: 3,
  coffee: 4,
  star: 5,
  starOff: 6,
  tl: 7,
  t: 8,
  tr: 9,
  l: 10,
  r: 11,
  bl: 12,
  b: 13,
  br: 14,
  checker: 15,
  hairL: 16,
  hairR: 17,
  faceL: 18,
  faceR: 19,
  marker: 20,
  halfBlock: 21,
  clock: 22,
  up: 23,
  check: 24,
  so: 25,
  hr: 26,
  pip: 27,
  pipOff: 28,
  lock: 29,
  arrow: 30,
  cursor: 31,
};

const UI_ART = {
  blank: ['........', '........', '........', '........', '........', '........', '........', '........'],
  block: ['########', '########', '########', '########', '########', '########', '########', '########'],
  halfBlock: ['####....', '####....', '####....', '####....', '####....', '####....', '####....', '####....'],
  clip: ['...##...', '..#..#..', '..#..#..', '..#.##..', '..#.##..', '..#.##..', '..####..', '...##...'],
  coffee: ['.#..#...', '..#..#..', '........', '#####...', '#####.#.', '#####.#.', '#####...', '.###....'],
  star: ['...#....', '...#....', '#######.', '.#####..', '..###...', '.##.##..', '.#...#..', '........'],
  starOff: ['...#....', '..#.#...', '##...##.', '.#...#..', '..#.#...', '.#.#.#..', '.#...#..', '........'],
  tl: ['........', '........', '........', '....####', '...#....', '...#....', '...#....', '...#....'],
  t: ['........', '........', '........', '########', '........', '........', '........', '........'],
  tr: ['........', '........', '........', '####....', '....#...', '....#...', '....#...', '....#...'],
  l: ['...#....', '...#....', '...#....', '...#....', '...#....', '...#....', '...#....', '...#....'],
  r: ['....#...', '....#...', '....#...', '....#...', '....#...', '....#...', '....#...', '....#...'],
  bl: ['...#....', '...#....', '...#....', '....####', '........', '........', '........', '........'],
  b: ['........', '........', '........', '########', '........', '........', '........', '........'],
  br: ['....#...', '....#...', '....#...', '####....', '........', '........', '........', '........'],
  checker: ['#...#...', '........', '..#...#.', '........', '#...#...', '........', '..#...#.', '........'],
  marker: ['...##...', '..####..', '..####..', '..####..', '...##...', '........', '...##...', '...##...'],
  clock: ['..####..', '.#..#.#.', '#...#..#', '#...###.', '#......#', '.#....#.', '..####..', '........'],
  up: ['...#....', '..###...', '.#####..', '#######.', '..###...', '..###...', '..###...', '........'],
  check: ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
  so: ['.######.', '#......#', '#.#..#.#', '#..##..#', '#..##..#', '#.#..#.#', '#......#', '.######.'],
  hr: ['########', '#.#.##.#', '#.#.#.##', '#...##.#', '#.#.#.##', '#.#.#.##', '########', '........'],
  pip: ['........', '..###...', '.#####..', '.#####..', '.#####..', '..###...', '........', '........'],
  pipOff: ['........', '..###...', '.#...#..', '.#...#..', '.#...#..', '..###...', '........', '........'],
  lock: ['..###...', '.#...#..', '.#...#..', '#######.', '###.###.', '###.###.', '#######.', '........'],
  arrow: ['........', '.#......', '.##.....', '.###....', '.####...', '.###....', '.##.....', '.#......'],
  cursor: ['........', '........', '........', '........', '........', '........', '#######.', '#######.'],
};

// Badge face, 16 × 16: hair (top two cells, hair colour) and face (bottom two cells, skin colour).
const HAIR = ['.....######.....', '...##########...', '..############..', '.##############.', '.##############.', '.####......####.', '.###........###.', '.##..........##.'];
const FACE = ['..############..', '..##..####..##..', '..##..####..##..', '..############..', '..############..', '...###....###...', '....########....', '......####......'];

export function addUi(cs) {
  for (const [name, rows] of Object.entries(UI_ART)) cs.setHires(UI[name], rows);
  cs.setHires(UI.hairL, HAIR.map((r) => r.slice(0, 8)));
  cs.setHires(UI.hairR, HAIR.map((r) => r.slice(8)));
  cs.setHires(UI.faceL, FACE.map((r) => r.slice(0, 8)));
  cs.setHires(UI.faceR, FACE.map((r) => r.slice(8)));
}

// ---------------------------------------------------------------- floor + walls

export const FLOOR_ART = {
  carpet: ['cbbb', 'bbbb', 'bbcb', 'bbbb', 'cbbb', 'bbbb', 'bbcb', 'bbbb'],
  tile: ['ccbb', 'ccbb', 'ccbb', 'ccbb', 'bbcc', 'bbcc', 'bbcc', 'bbcc'],
  bathroom: ['ccca', 'ccca', 'ccca', 'aaaa', 'ccca', 'ccca', 'ccca', 'aaaa'],
  marble: ['cccc', 'ccbc', 'cccc', 'bccc', 'cccc', 'cccb', 'cccc', 'cbcc'],
  parquet: ['bbbb', 'bbab', 'bbbb', 'aaaa', 'bbbb', 'abbb', 'bbbb', 'aaaa'],
  hall: ['bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'abbb'],
};
export const WALL_CAP = ['aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa'];
export const WALL_FACE = ['aaaa', 'aaaa', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', '....'];

/** A floor cell whose lower part is covered by the cap of the wall below (the oblique view shifts wall tops up). */
export const capBelow = (floor) => [floor[0], floor[1], 'aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa', 'aaaa'];

// ---------------------------------------------------------------- furniture

/** Each def draws into a fat-pixel canvas: x 0..w*4-1, y -8..h*8-1 (negative y = drawn over the tile above). */
export const FURNITURE = {
  desk: { c: COL.yellow, draw(r, W) {
    r(0, 1, W, 5, 'c'); r(0, 6, W, 1, 'a'); r(0, 7, 1, 1, '.'); r(W - 1, 7, 1, 1, '.');
    r(1, -3, 3, 4, '.'); r(2, -2, 1, 2, 'a'); r(W - 3, 3, 2, 1, '.');
  } },
  reception: { c: COL.white, draw(r, W) { r(0, 0, W, 3, 'c'); r(0, 3, W, 4, 'a'); r(0, 7, W, 1, '.'); r(2, -2, 3, 3, '.'); } },
  hrdesk: { c: COL.purple, draw(r, W) { r(0, 1, W, 4, 'c'); r(0, 5, W, 2, 'a'); r(0, 7, W, 1, '.'); } },
  counter: { c: COL.white, draw(r, W) { r(0, 0, W, 3, 'c'); r(0, 3, W, 4, 'a'); r(0, 7, W, 1, '.'); } },
  chair: { draw(r) { r(1, -1, 2, 4, '.'); r(0, 3, 4, 2, 'a'); r(1, 5, 2, 1, '.'); r(0, 6, 1, 1, '.'); r(3, 6, 1, 1, '.'); } },
  chairup: { draw(r) { r(1, 0, 2, 3, '.'); r(0, 3, 4, 2, 'a'); r(0, 5, 1, 1, '.'); r(3, 5, 1, 1, '.'); } },
  stool: { c: COL.yellow, draw(r) { r(0, 2, 4, 2, 'c'); r(1, 4, 2, 2, 'a'); r(1, 6, 1, 1, '.'); r(2, 6, 1, 1, '.'); } },
  plant: { c: COL.green, draw(r) {
    r(1, -6, 2, 2, 'c'); r(0, -4, 4, 6, 'c'); r(1, 2, 2, 1, 'c'); r(1, 3, 2, 3, 'a'); r(0, 3, 4, 1, 'a'); r(1, 6, 2, 1, '.');
  } },
  sofa: { c: COL.red, draw(r, W, H) { r(0, 0, W, H - 1, 'c'); r(0, 0, 1, H - 1, 'a'); r(0, 0, W, 2, 'a'); r(0, H - 3, W, 2, 'a'); r(0, H - 1, W, 1, '.'); } },
  coffeemachine: { c: COL.red, draw(r) { r(0, -4, 4, 11, 'a'); r(1, -3, 2, 2, 'c'); r(1, 1, 2, 2, '.'); r(0, 7, 4, 1, '.'); } },
  espressobar: { c: COL.yellow, draw(r) { r(0, -4, 4, 11, 'a'); r(1, -3, 2, 2, 'c'); r(1, 1, 2, 3, '.'); r(0, 7, 4, 1, '.'); } },
  microwave: { c: COL.white, draw(r) { r(0, 0, 4, 3, 'c'); r(0, -3, 4, 3, 'a'); r(1, -2, 2, 1, '.'); r(0, 3, 4, 4, 'a'); r(0, 7, 4, 1, '.'); } },
  fridge: { c: COL.white, draw(r) { r(0, -7, 4, 14, 'c'); r(0, -2, 4, 1, 'a'); r(3, -5, 1, 2, 'a'); r(3, 1, 1, 3, 'a'); r(0, 7, 4, 1, '.'); } },
  vending: { c: COL.red, draw(r) { r(0, -7, 4, 14, 'c'); r(1, -6, 2, 7, '.'); r(1, 3, 2, 1, 'a'); r(0, 7, 4, 1, '.'); } },
  watercooler: { c: COL.cyan, draw(r) { r(1, -7, 2, 3, 'c'); r(0, -4, 4, 11, 'a'); r(1, 0, 2, 1, '.'); r(0, 7, 4, 1, '.'); } },
  kitchentable: { c: COL.white, draw(r, W) { r(0, 1, W, 4, 'c'); r(0, 5, W, 1, 'a'); r(1, 6, 1, 1, '.'); r(W - 2, 6, 1, 1, '.'); } },
  meetingtable: { c: COL.yellow, draw(r, W, H) { r(0, 1, W, H - 3, 'c'); r(0, H - 2, W, 1, 'a'); r(1, H - 1, 1, 1, '.'); r(W - 2, H - 1, 1, 1, '.'); } },
  whiteboard: { c: COL.white, draw(r, W) {
    r(0, -7, W, 8, 'a'); r(1, -6, W - 2, 6, 'c'); r(2, -4, 3, 1, '.'); r(W - 4, -2, 2, 1, '.'); r(1, 1, 1, 6, 'a'); r(W - 2, 1, 1, 6, 'a');
  } },
  mailshelf: { c: COL.yellow, draw(r) {
    r(0, -6, 4, 13, 'a'); r(0, -2, 4, 1, '.'); r(0, 2, 4, 1, '.'); r(1, -5, 2, 2, 'c'); r(1, -1, 2, 2, 'c'); r(1, 3, 2, 2, 'c'); r(0, 7, 4, 1, '.');
  } },
  boxes: { c: COL.yellow, draw(r) { r(0, 1, 4, 6, 'c'); r(0, 1, 4, 1, 'a'); r(1, -2, 3, 3, 'c'); r(1, -2, 3, 1, 'a'); r(0, 7, 4, 1, '.'); } },
  poster: { c: COL.red, draw(r, W) { r(0, -7, W, 7, 'a'); r(1, -6, W - 2, 5, 'c'); } },
  filing: { c: COL.white, draw(r) {
    r(0, -5, 4, 12, 'a'); r(0, -1, 4, 1, '.'); r(0, 3, 4, 1, '.'); r(1, -3, 2, 1, 'c'); r(1, 1, 2, 1, 'c'); r(1, 5, 2, 1, 'c'); r(0, 7, 4, 1, '.');
  } },
  toilet: { c: COL.white, draw(r) { r(1, -2, 2, 3, 'c'); r(0, 1, 4, 4, 'c'); r(1, 2, 2, 2, 'a'); r(1, 5, 2, 2, 'c'); r(1, 7, 2, 1, '.'); } },
  sink: { c: COL.white, draw(r) { r(0, -4, 4, 3, 'a'); r(0, 0, 4, 3, 'c'); r(1, 1, 2, 1, 'a'); r(1, 3, 2, 4, 'a'); } },
  fountain: { c: COL.cyan, draw(r, W, H) { r(0, 1, W, H - 2, 'a'); r(1, 2, W - 2, H - 4, 'c'); r(3, -3, 2, 7, 'b'); r(3, -4, 2, 1, 'c'); r(0, H - 1, W, 1, '.'); } },
  turnstile: { c: COL.red, draw(r, W) {
    for (let x = 0; x < W; x += 4) { r(x + 1, -5, 2, 12, 'a'); r(x + 1, -6, 2, 1, 'c'); }
    r(0, 0, W, 1, 'c'); r(0, 7, W, 1, '.');
  } },
  turnstileopen: { c: COL.green, draw(r, W) {
    for (let x = 0; x < W; x += 4) { r(x + 1, -5, 2, 12, 'a'); r(x + 1, -6, 2, 1, 'c'); }
    r(0, 7, W, 1, '.');
  } },
  fountain: { c: COL.cyan, draw(r, W) { r(0, 2, W, 5, 'a'); r(1, 1, W - 2, 3, 'c'); r(W / 2 - 1, -4, 2, 5, 'c'); r(0, 7, W, 1, '.'); } },
  receptionist: { draw() {} },
  hrrep: { draw() {} },
  elevator: { c: COL.white, draw(r, W) { r(0, -8, W, 15, 'a'); r(1, -7, W - 2, 14, 'c'); r(W / 2, -7, 1, 14, '.'); r(0, 7, W, 1, '.'); } },
  directory: { c: COL.white, draw(r) { r(0, -6, 4, 6, 'a'); r(1, -5, 2, 4, 'c'); r(1, 0, 2, 6, 'a'); r(0, 6, 4, 1, '.'); } },
  hrrep: { draw() {} }, // drawn as a sprite
  default: { c: COL.purple, draw(r, W, H) { r(0, 0, W, H - 1, 'c'); r(0, 0, W, 1, 'a'); r(0, H - 1, W, 1, '.'); } },
};

/** Draw an item into a symbol grid. Returns { rows: string[] (lift + footprint), lift: 8 }. */
export function drawItem(type, w, h) {
  const def = FURNITURE[type] || FURNITURE.default;
  const W = w * 4;
  const H = h * 8;
  const grid = Array.from({ length: H + 8 }, () => Array(W).fill('_'));
  const r = (x, y, rw, rh, s) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) if (grid[yy + 8] && xx >= 0 && xx < W) grid[yy + 8][xx] = s;
  };
  def.draw(r, W, H);
  return { grid, color: def.c ?? COL.black };
}

/** Composite item symbols over the cell underneath. Under 'c' pixels turn 'b' when the item brings its own colour. */
export function composite(under, item, itemUsesC) {
  return under.map((row, y) =>
    [...row].map((s, x) => (item[y][x] !== '_' ? item[y][x] : itemUsesC && s === 'c' ? 'b' : s)).join(''),
  );
}

// ---------------------------------------------------------------- sprites (multicolour, 12 fat px wide, 21 rows)
// '1' = $D025 (black outline/hair), '2' = sprite colour (shirt), '3' = $D026 (skin).

const BODY = ['.2222.', '222222', '222222', '322223', '.2222.', '.1111.'];
const LEGS = [
  ['.1..1.', '.1..1.', '.1..1.', '11..11'],
  ['.1..1.', '.1..1.', '.1..1.', '....11'],
  ['.1..1.', '.1..1.', '.1..1.', '11....'],
];
const HEAD_DOWN = ['.1111.', '111111', '133331', '131131', '133331', '..33..'];
const HEAD_UP = ['.1111.', '111111', '111111', '111111', '311113', '..33..'];
const SIDE = {
  head: ['..111.', '.1111.', '.33111', '.13111', '.33311', '..33..'],
  body: ['..222.', '.2222.', '.2222.', '.3222.', '..222.', '..111.'],
  legs: [
    ['..1.1.', '..1.1.', '..1.1.', '.11.11'],
    ['..1.1.', '.1...1', '.1...1', '11...1'],
    ['..1.1.', '..1.1.', '..11..', '..11..'],
  ],
};

function spriteBytes(rows) {
  // rows: up to 21 strings of 6 fat px; placed at fat columns 3..8, bottom-aligned (feet on row 20).
  const out = new Uint8Array(64);
  const top = 21 - rows.length;
  rows.forEach((r, i) => {
    const y = top + i;
    const line = ('...' + r + '...').padEnd(12, '.');
    for (let x = 0; x < 12; x++) {
      const v = { '.': 0, 1: 1, 2: 2, 3: 3 }[line[x]];
      out[y * 3 + (x >> 2)] |= v << (6 - (x & 3) * 2);
    }
  });
  return out;
}

const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

/** 12 person frames: down ×3, up ×3, left ×3, right ×3 (stand, step A, step B). */
export function personSprites() {
  const frames = [];
  for (const head of [HEAD_DOWN, HEAD_UP]) for (const legs of LEGS) frames.push([...head, ...BODY, ...legs]);
  const left = SIDE.legs.map((legs) => [...SIDE.head, ...SIDE.body, ...legs]);
  frames.push(...left, ...left.map(mirror));
  const out = new Uint8Array(frames.length * 64);
  frames.forEach((f, i) => out.set(spriteBytes(f), i * 64));
  return out;
}

// The boss for Boss Alert: dark suit (outline colour) with the tie in the sprite colour (red), one row taller.
const BOSS_BODY = ['.1111.', '.2111.', '.2111.', '.2111.', '.3111.', '.1111.', '..111.'];

/** 6 boss frames: left ×3, right ×3 (stand, step A, step B). */
export function bossSprites() {
  const left = SIDE.legs.map((legs) => [...SIDE.head, ...BOSS_BODY, ...legs]);
  const frames = [...left, ...left.map(mirror)];
  const out = new Uint8Array(frames.length * 64);
  frames.forEach((f, i) => out.set(spriteBytes(f), i * 64));
  return out;
}

// Multicolour chars the overlays draw with. Allocated before the floor, so their codes don't depend on it.
const OVERLAY_CHARS = {
  MC_A: WALL_CAP,
  MC_B: ['bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb', 'bbbb'],
  MC_C: ['cccc', 'cccc', 'cccc', 'cccc', 'cccc', 'cccc', 'cccc', 'cccc'],
  MC_KNOB: ['cccc', 'cccc', 'cccc', 'ccac', 'ccac', 'cccc', 'cccc', 'cccc'],
  MC_HALL: FLOOR_ART.hall,
  MC_CARDS: ['cccc', 'bcbc', 'bcbc', 'bcbc', 'cccc', 'cbcb', 'cbcb', 'cccc'],
  MC_GRID: ['ccca', 'ccca', 'ccca', 'aaaa', 'ccca', 'ccca', 'ccca', 'aaaa'],
};

/** Adds the overlay chars; returns gen/chars.inc. */
export function addOverlayChars(cs) {
  return ['; generated by c64/build.js (tools/art.js OVERLAY_CHARS)', ...Object.entries(OVERLAY_CHARS).map(([k, rows]) => `${k} = ${cs.mc(rows)}`)].join('\n') + '\n';
}

// ---------------------------------------------------------------- title logo (quarter blocks, codes 241-255)
export const QUARTER = 240; // + pattern: 1 top left, 2 top right, 4 bottom left, 8 bottom right

/** Reserves codes 241-255 for the 15 quarter-block chars (hires: the title's colour RAM is below 8). */
export function addQuarterBlocks(cs) {
  cs.limit = QUARTER + 1;
  for (let p = 1; p < 16; p++) {
    const half = (l, r) => (l ? '####' : '....') + (r ? '####' : '....');
    const top = half(p & 1, p & 2);
    const bottom = half(p & 4, p & 8);
    cs.setHires(QUARTER + p, [top, top, top, top, bottom, bottom, bottom, bottom]);
  }
}

/** Text in the game's bitmap font, 2 × 2 font pixels per char: rows of char codes (0 = space). */
export function bigText(glyphs, text) {
  const cols = [];
  for (const ch of text) {
    const rows = (glyphs[ch] || glyphs['?']).split('|');
    const w = rows[0].length;
    for (let x = 0; x < w; x++) cols.push(rows.map((r) => r[x] === '#'));
    cols.push(Array(7).fill(false));
  }
  cols.pop();
  if (cols.length % 2) cols.push(Array(7).fill(false));
  const px = (x, y) => (cols[x] && y < 7 ? cols[x][y] : false);
  const out = [];
  for (let cy = 0; cy < 4; cy++) {
    const row = [];
    for (let cx = 0; cx < cols.length / 2; cx++) {
      const p = (px(cx * 2, cy * 2) ? 1 : 0) | (px(cx * 2 + 1, cy * 2) ? 2 : 0) | (px(cx * 2, cy * 2 + 1) ? 4 : 0) | (px(cx * 2 + 1, cy * 2 + 1) ? 8 : 0);
      row.push(p ? QUARTER + p : 32);
    }
    out.push(row);
  }
  return out;
}
