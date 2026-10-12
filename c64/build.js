#!/usr/bin/env bun
// Builds the C64 version: bakes the 40 floors, the font, sprites, music and texts out of the JS game, assembles the
// boot file, the resident parts and the overlays (cc65), packs them and writes one disk image per disk side.
//
// The tower spans 8 disk sides (build/synergy-1a.d64 .. synergy-4b.d64), one per department (floors 1-5, 6-10,
// ...); side 1 also holds the boot file, the resident program and the title.
// Every side carries its floors, its department image (charset + colleague lines + a directory of the side's
// files, always at the same track/sector), the mini-games of its floors built with that department's content,
// the terminal and a save game.
//
//   bun c64/build.js                 build every side
//   bun c64/build.js --sides=1,3     build only these sides
//   bun c64/build.js --run           build and start VICE with side 1
//   bun c64/build.js --publish       build every side and zip them for the download page (public/c64/)
//   bun c64/build.js --autoplay      test disk: skips the title, walks to the Memory station and plays it perfectly
//   bun c64/build.js --autoplay --shots=8,20,40   ... and save headless VICE screenshots at those seconds
//   bun c64/build.js --autoplay=bingo   ... the same for another station's game
//   --dept=<id>       test builds: the games' content of that department (default: the floor's)
//   --diff=<0-255>    test builds: every station's difficulty
//   --crowd           fill floor 1 with extra colleagues (sprite multiplexer test)
//   --interleave=N    sector interleave of the fast-loaded files (default 13)
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { installMockDocument } from '../tests/mock-canvas.js';

installMockDocument();
const { Charset, fontGlyphs, addFont, addUi, personSprites, bossSprites, addOverlayChars, addQuarterBlocks, bigText, BG } = await import('./tools/art.js');
const { bakeFloor, autoplayScript, OFF, HDR, KIND, ACTOR, FLOOR_BASE, asc } = await import('./tools/floor.js');
const { songAsm, freqTables } = await import('./tools/music.js');
const { pack, unpack, inPlaceGap } = await import('./tools/lz.js');
const { jargonAsm, bingoAsm, reviewAsm } = await import('./tools/mgdata.js');
const { gameList, gamesAsm, C64_GAMES } = await import('./tools/games.js');
const { trainBpe, encodeBpe, encodeAsm, literals } = await import('./tools/bpe.js');
const { D64 } = await import('./tools/d64.js');
const { SONGS } = await import('../src/data/music.js');
const { buildFloor } = await import('../src/core/tasks.js');
const { titleForFloor, floorName, departmentForFloor, DEPARTMENTS } = await import('../src/data/departments.js');
const { COMMON_NPC_LINES } = await import('../src/data/npcLines.js');
const { FIRED_LINES, KEPT_LINES, FILE_NOTES } = await import('../src/data/people.js');
if (FILE_NOTES.length > 90) throw new Error('more file notes than one char can name (tools/floor.js)');
const FATE_LINES = Math.min(FIRED_LINES.length, KEPT_LINES.length); // (the CEO's fire / keep reactions)
const E = await import('../src/core/economy.js');

const ROOT = dirname(new URL(import.meta.url).pathname);
const B = join(ROOT, 'build');
const GEN = join(B, 'gen');
const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DEMO = args.includes('--demo'); // autoplay after a walk to the bottom of the floor
const autoArg = args.find((a) => a.startsWith('--autoplay')) ?? (DEMO ? '--autoplay=memory' : undefined);
const AUTOPLAY = !!autoArg;
const AUTO_GAME = autoArg?.split('=')[1] || 'memory'; // --autoplay=jargon walks to that station instead
void BG;
for (const d of [GEN, join(B, 'obj'), join(B, 'disk')]) mkdirSync(d, { recursive: true });

// ---- disk sides
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const SIDES = range(0, 7).map((d) => range(d * 5 + 1, d * 5 + 5)).map((floors, i) => ({
  n: i + 1,
  label: `${Math.floor(i / 2) + 1}${i % 2 ? 'b' : 'a'}`,
  floors,
  dept: departmentForFloor(floors[0]),
}));
const sideOf = (f) => SIDES.find((s) => s.floors.includes(f));
// Test builds: --dept themes the games for that department, --diff forces every station's difficulty, and a game
// with no station on side 1 (floors 1-5) is put on a floor-1 station (instead of the first one that isn't the check-in).
const DEPT_OPT = opt('dept');
if (DEPT_OPT && !DEPARTMENTS.some((d) => d.id === DEPT_OPT)) throw new Error(`--dept: no department ${DEPT_OPT} (${DEPARTMENTS.map((d) => d.id).join(', ')})`);
const DIFF = opt('diff') === undefined ? undefined : Number(opt('diff'));
if (AUTOPLAY && C64_GAMES[AUTO_GAME] && !SIDES[0].floors.some((f) => buildFloor(f).tasks.some((t) => t.task.game === AUTO_GAME))) {
  buildFloor(1).items.find((it) => it.task && !it.task.checkin).task.game = AUTO_GAME;
}
// --autoplay=ceo: a test career on floor 40, one star short of the quota: it plays a station there (the disk swap to
// the exec side is done from the VICE monitor at swap_prompt) and should end on the CEO ending.
const CEO_TEST = AUTO_GAME === 'ceo';
const BUILD_SIDES = opt('sides') ? opt('sides').split(',').map(Number) : CEO_TEST ? [1, SIDES.length] : AUTOPLAY ? [1] : SIDES.map((s) => s.n);
if (!BUILD_SIDES.includes(1)) BUILD_SIDES.unshift(1); // (side 1 carries the resident program every side relies on)

const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`${cmd} ${argv.join(' ')}\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
  return r.stdout;
};
const hex = (n, w = 4) => '$' + n.toString(16).padStart(w, '0');
const bytes = (name, arr) => `${name}: .byte ${arr.join(', ')}`;
const words = (name, arr) => [bytes(`${name}_lo`, arr.map((v) => v & 0xff)), bytes(`${name}_hi`, arr.map((v) => v >> 8))].join('\n');
const words24 = (name, arr) => [bytes(`${name}_lo`, arr.map((v) => v & 0xff)), bytes(`${name}_md`, arr.map((v) => (v >> 8) & 0xff)), bytes(`${name}_hi`, arr.map((v) => v >> 16))].join('\n');
const def = AUTOPLAY ? ['-D', 'AUTOPLAY=1', ...(args.includes('--fire') ? ['-D', 'AUTO_FIRE=1'] : [])] : []; // --fire (with --autoplay=ceo): fires colleague 1 on arrival
const asm = (src, obj, extra = []) => run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, ...extra, '-o', obj, src]);

// Sector interleave of fast-loaded files. Measured in VICE with the 2-bit loader: a block takes ~50 ms to send and
// the DOS needs ~60 ms more to pick up the next read job and decode the sector, so 11 or less misses a whole
// revolution (7-block overlay: 1 = 1.3 s, 8 = 1.8 s, 11 = 2.0 s) and 12-15 catch the next sector (0.9 s).
// 13 leaves a margin for real drives running a little fast.
const FAST_INTERLEAVE = Number(opt('interleave') ?? 13);
const checkedPack = (raw, name, dict) => {
  const p = pack(raw, dict);
  const back = unpack(p, dict);
  if (back.length !== raw.length || back.some((v, i) => v !== raw[i])) throw new Error(`packer self-check failed: ${name}`);
  return p;
};
// Overlays unpack in place in the slot ($4000-$5fff): the packed copy starts at least `gap` bytes (tools/lz.js
// inPlaceGap) after the unpacked image's start, and ends by the spill area's end ($6000-$63ff, src/main.s).
const SLOT = 0x4000;
const SPILL_END = 0x6400;
const slotAt = (raw, p, name) => {
  const at = Math.max(SLOT + inPlaceGap(p), SLOT + raw.length - p.length);
  if (at + p.length > SPILL_END) throw new Error(`${name}: in-place unpack reaches past the spill area`);
  return at;
};

// ---- games: every station game of the tower (in floor order, the index is the same on every side) + the review
const games = gameList(range(1, E.FLOORS).flatMap((f) => buildFloor(f).tasks.map((t) => t.task.game)));
const gameIndex = Object.fromEntries(games.map((g) => [g.id, g.index]));
const ported = (g) => g.src && existsSync(join(ROOT, 'src', g.src));

// ---- drive code
run('ca65', ['-o', 'build/obj/drive.o', 'src/drive.s']);
run('ld65', ['-C', 'cfg/drive.cfg', '-o', 'build/obj/drive.bin', 'build/obj/drive.o']);

// ---- charset: UI, font, the overlays' chars (fixed codes, the same on every side), quarter blocks; each side then
// adds its floors' tiles
const glyphs = fontGlyphs(join(ROOT, '../src/engine/font.js'));
const baseCharset = () => {
  const cs = new Charset();
  addUi(cs);
  addFont(cs, glyphs);
  const inc = addOverlayChars(cs);
  addQuarterBlocks(cs);
  return { cs, inc };
};
writeFileSync(join(GEN, 'chars.inc'), baseCharset().inc);
const { CORP_COLORS, SKIN_TONES, HAIR_COLORS } = await import('../src/data/corpColors.js');
const { titleDataAsm } = await import('./tools/titledata.js');
writeFileSync(join(GEN, 'title_data.s'), titleDataAsm({ bigText: (t) => bigText(glyphs, t), CORP_COLORS, SKIN_TONES, HAIR_COLORS, titles: [1, 2, 3].map((f) => titleForFloor(f)), games: games.length - 1, disk1Floors: SIDES[0].floors }));
writeFileSync(join(GEN, 'boss.bin'), bossSprites());
writeFileSync(join(GEN, 'sprites.bin'), personSprites());
{
  const { REVIEW } = await import('../src/data/mg-review.js');
  writeFileSync(join(GEN, 'mg_review_data.s'), reviewAsm({ REVIEW, titles: range(1, 40).map((f) => titleForFloor(f)), depts: DEPARTMENTS.map((d) => d.name) }));
}

// ---- text compression: byte pairs trained on every text of the game (tools/bpe.js), the same table on every side
const perksText = ['Upgrade your office.', ...E.PERKS.map((p) => `${p.name}: ${p.desc}`)];
const srcStrings = readFileSync(join(ROOT, 'src/strings.s'), 'utf8');
const srcFar = readFileSync(join(ROOT, 'src/fartext.s'), 'utf8');
const corpus = [
  ...literals(srcStrings), ...literals(srcFar), ...COMMON_NPC_LINES, ...FIRED_LINES, ...KEPT_LINES, ...FILE_NOTES, ...DEPARTMENTS.flatMap((d) => d.npcLines), ...perksText,
  ...games.map((g) => g.name), ...games.map((g) => g.help), ...range(1, 40).map((f) => titleForFloor(f)), ...range(1, 40).map((f) => floorName(f)),
].map((t) => asc(t));
const pairs = trainBpe(corpus);
const encBytes = (s) => [...encodeBpe(asc(s), pairs), 0];
const enc = (s) => `.byte ${encBytes(s).join(', ')}`; // a string
const encFar = (paras) => `.byte ${paras.flatMap((p) => encBytes(p)).join(', ')}, 0`; // paragraphs + end
writeFileSync(join(GEN, 'bpe.s'), [bytes('bpe_a', pairs.map((p) => p[0])), bytes('bpe_b', pairs.map((p) => p[1]))].join('\n') + '\n');
writeFileSync(join(GEN, 'strings.s'), '; generated by c64/build.js: src/strings.s with byte-pair encoded texts\n' + encodeAsm(srcStrings, pairs));
writeFileSync(join(GEN, 'fartext.s'), '; generated by c64/build.js: src/fartext.s with byte-pair encoded paragraphs\n' + encodeAsm(srcFar, pairs, { chunks: true }));

// ---- music: all songs in the RAM under the KERNAL (the player banks it in). Song numbers: 0 = this side's
// department song (the player looks it up in the directory), 1 mini-game, 2 title, 3 fanfare, 4.. departments.
const SONG_LIST = ['minigame', 'title', 'fanfare', 'lobby', 'office', 'tech', 'exec'];
const DEPT_SONG = (dept) => 4 + SONG_LIST.slice(3).indexOf(dept.music);
{
  const { lo, hi } = freqTables();
  writeFileSync(
    join(GEN, 'music.s'),
    [
      '; generated by c64/build.js from src/data/music.js (the songs are in the far texts, gen/far.s)',
      `songs_lo: .byte 0, ${SONG_LIST.map((_, i) => `<song${i + 1}`).join(', ')}`,
      `songs_hi: .byte 0, ${SONG_LIST.map((_, i) => `>song${i + 1}`).join(', ')}`,
      `freq_lo: .byte ${lo.join(', ')}`,
      `freq_hi: .byte ${hi.join(', ')}`,
    ].join('\n') + '\n',
  );
}

// ---- far texts (RAM under the KERNAL, loaded once at boot): game help, perks, the songs
const far = [
  '; generated by c64/build.js (tools/games.js, src/core/economy.js, src/data/music.js)',
  ...games.map((g) => `ghelp${g.index}: ${encFar([g.help])}`),
  `f_perks: ${encFar(perksText)}`,
  `f_fired: ${encFar(FIRED_LINES.slice(0, FATE_LINES))}`,
  `f_kept: ${encFar(KEPT_LINES.slice(0, FATE_LINES))}`,
  `f_notes: ${encFar(FILE_NOTES)}`,
  ...SONG_LIST.map((name, i) => songAsm(`song${i + 1}`, SONGS[name]).asm),
];
writeFileSync(join(GEN, 'far.s'), far.join('\n') + '\n');

// ---- the side directory (in the department image at $d000, copied to resident memory when a side is loaded).
// Offsets for src/*.s in gen/dir.inc. Games are indexed as in the game table (0 = not on this side).
const G = games.length;
const DIR = {};
{
  let o = 0;
  const field = (name, n) => ((DIR[name] = o), (o += n));
  field('MAGIC', 2); // "ST"
  field('SIDE', 1);
  field('DEPTNO', 1);
  field('SONG', 1);
  field('FIRST', 1); // first floor on the side
  field('NFLOORS', 1);
  field('FLOOR_T', 5);
  field('FLOOR_S', 5);
  for (const f of ['TERM', 'MAIN3', 'SAVE', 'SAVE2', 'SAVE3', 'TITLE', 'END']) field(`${f}_T`, 1), field(`${f}_S`, 1);
  field('TERM_AT', 2);
  field('TITLE_AT', 2);
  field('END_AT', 2);
  field('GAME_T', G);
  field('GAME_S', G);
  field('GAME_ATL', G);
  field('GAME_ATH', G);
  field('LINES_DEPT', 1); // colleague lines of the department (the common ones: LINES_COMMON)
  DIR.SIZE = o;
}
writeFileSync(join(GEN, 'dir.inc'), ['; generated by c64/build.js: the side directory (src/main.s side_dir)', ...Object.entries(DIR).map(([k, v]) => `DIR_${k} = ${v}`), `FAR2 = $d000`, `LINES_COMMON = ${COMMON_NPC_LINES.length}`, `SIDES = ${SIDES.length}`].join('\n') + '\n');
writeFileSync(join(GEN, 'sides.s'), bytes('side_of_floor', range(1, 40).map((f) => sideOf(f).n)) + '\n');
// best stars of every station (src/state.s best_get): a nibble each, every floor from a whole byte, in state page 3
{
  let o = 0;
  const base = range(1, 40).map((f) => ((o += Math.ceil(buildFloor(f).tasks.length / 2)), o - Math.ceil(buildFloor(f).tasks.length / 2)));
  if (o > 254) throw new Error(`best stars: ${o} B, more than state page 3`);
  if (Math.max(...range(1, 40).map((f) => buildFloor(f).tasks.length)) > 14) throw new Error('more than STATIONS_MAX stations');
  writeFileSync(join(GEN, 'sides.s'), bytes('side_of_floor', range(1, 40).map((f) => sideOf(f).n)) + '\n' + bytes('best_base', base) + '\n');
}

// ---- generated includes
const IA = { KIND: 0, ARG: 1, MARK: 2, UC: 4, UCOL: 5, STR: 6, X: 8, Y: 9, W: 10, ARG2: 11 };
writeFileSync(
  join(GEN, 'floor.inc'),
  [
    '; generated by c64/build.js',
    `FL_MAP  = ${hex(FLOOR_BASE + OFF.MAP)}`,
    `FL_COL  = ${hex(FLOOR_BASE + OFF.MAPCOL)}`,
    `FL_INFO = ${hex(FLOOR_BASE + OFF.INFO)}`,
    `FL_HDR  = ${hex(FLOOR_BASE + OFF.HDR)}`,
    ...Object.entries(HDR).map(([k, v]) => `HDR_${k} = ${v}`),
    ...Object.entries(IA).map(([k, v]) => `IA_${k} = ${v}`),
    ...Object.entries(KIND).map(([k, v]) => `KIND_${k.toUpperCase()} = ${v}`),
    `ACTOR_COLLEAGUE = ${ACTOR.colleague}`,
    `ACTOR_RECEPTION = ${ACTOR.receptionist}`,
    `ACTOR_HR = ${ACTOR.hr}`,
    `FLOORS_TOP = ${E.FLOORS}`,
    `FATE_LINES = ${FATE_LINES}`,
    `START_SP = ${E.STARTING.sp}`,
    `START_SO = ${E.STARTING.so}`,
  ].join('\n') + '\n',
);
writeFileSync(join(GEN, 'games.s'), gamesAsm(games, enc));

// Economy: per-floor rewards and cooldowns travel in each floor's header (tools/floor.js econBlock); the tables for
// all 40 floors (fees, titles, names) and levels are in part 3.
const perkCost = E.PERKS.flatMap((p) => [0, 1, 2, 3, 4].map((lv) => E.perkCost(p, lv)));
if (perkCost.some((c) => c > 0xffff)) throw new Error('perk cost > 16 bit');
if (E.PERKS.map((p) => p.id).join() !== 'mug,espresso,chair,monitor,stapler,plant') throw new Error('perk order changed (state.s PERK_*)');
const ALL = range(1, E.FLOORS);
writeFileSync(
  join(GEN, 'econ.s'),
  [
    '; generated by c64/build.js from src/core/economy.js',
    words('regen', [0, 1, 2, 3, 4, 5].map((e) => E.coffeeRegenMs({ espresso: e }) / 1000)),
    words('perkc', perkCost),
    bytes('perk_max', E.PERKS.map((p) => p.max)),
    bytes('perk_cur', E.PERKS.map((p) => (p.currency === 'so' ? 1 : 0))),
  ].join('\n') + '\n',
);
writeFileSync(
  join(GEN, 'econ3.s'),
  [
    '; generated by c64/build.js from src/core/economy.js and src/data/departments.js (part 3)',
    words24('fee', [0, ...ALL.map((f) => E.keycardFee(f))]), // promotion from floor f
    words24('xpn', [0, ...range(1, 99).map((l) => Math.min(0xffffff, E.xpToNext(l)))]), // level n -> n+1
    ...ALL.map((f) => `title${f}: ${enc(titleForFloor(f))}\nfname${f}: ${enc(floorName(f))}`),
    bytes('title_lo', ALL.map((f) => `<title${f}`)),
    bytes('title_hi', ALL.map((f) => `>title${f}`)),
    bytes('fname_lo', ALL.map((f) => `<fname${f}`)),
    bytes('fname_hi', ALL.map((f) => `>fname${f}`)),
  ].join('\n') + '\n',
);

// ---- the terminal (the same on every side): an overlay like the mini-games, with its texts (tools/termdata.js)
{
  const T = await import('../src/data/terminal.js');
  const { termDataAsm } = await import('./tools/termdata.js');
  const src = readFileSync(join(ROOT, '../src/core/terminal.js'), 'utf8');
  const COMMANDS = [...src.slice(src.indexOf('const COMMANDS = ['), src.indexOf('];', src.indexOf('const COMMANDS = ['))).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  writeFileSync(join(GEN, 'term_data.s'), termDataAsm({ ...T, COMMANDS, FLOORS: E.FLOORS, floorNames: range(1, 40).map((f) => floorName(f)) }).asm);
}
writeFileSync(join(GEN, 'files.inc'), '');

// ---- the title overlay (side 1)
const overlayBin = (src, name, cfg = 'overlay', extra = []) => {
  asm(`src/${src}`, `build/obj/${name}.o`, extra);
  run('ld65', ['-C', `cfg/${cfg}.cfg`, '-Ln', `build/obj/${name}.lbl`, '-o', `build/obj/${name}.bin`, `build/obj/${name}.o`]);
  return readFileSync(join(B, 'obj', `${name}.bin`));
};
const titleRaw = overlayBin('sys_title.s', 'sys.title');
const titlePacked = checkedPack(titleRaw, 'sys.title');
const termRaw = overlayBin('sys_term.s', 'sys.term');
if (termRaw.length > 0x2000) throw new Error(`sys.term: ${termRaw.length} B, more than the 8 KB slot`);
const termPacked = checkedPack(termRaw, 'sys.term');
const endRaw = overlayBin('sys_end.s', 'sys.end'); // the CEO ending (the side with floor 40)
const endPacked = checkedPack(endRaw, 'sys.end');

// ---- mini-game overlays, assembled per department (their content is per department)
const gameBins = {}; // dept id -> game id -> { raw, packed, at }
const deptGames = async (deptId) => {
  if (gameBins[deptId]) return gameBins[deptId];
  writeFileSync(join(GEN, 'mg_jargon_data.s'), jargonAsm());
  writeFileSync(join(GEN, 'mg_bingo_data.s'), bingoAsm(deptId));
  const failed = new Set(); // content that doesn't generate for this department (yet): the game is left out
  for (const g of games) {
    const gen = join(ROOT, 'tools', 'mg', `${g.id}.js`);
    try {
      if (existsSync(gen)) writeFileSync(join(GEN, `mg_${g.id}_data.s`), (await import(gen)).dataAsm({ dept: deptId }));
    } catch (e) {
      failed.add(g.id);
      console.log(`mg.${g.id} (${deptId}): ${e.message}`);
    }
  }
  const out = {};
  for (const g of games.filter((g) => ported(g) && !failed.has(g.id))) {
    const raw = overlayBin(g.src, `mg.${g.id}`, 'overlay', ['-D', `DEPT_NO=${DEPARTMENTS.findIndex((d) => d.id === deptId)}`]);
    if (raw.length > 0x2000) throw new Error(`mg.${g.id} (${deptId}): ${raw.length} B, more than the 8 KB slot`);
    if (g.quest || ['lostpw', 'feedback'].includes(g.id)) {
      // a floor quest's overlay stays in the slot while a fired colleague walks out: it must end below the route map
      const lbl = readFileSync(join(B, 'obj', `mg.${g.id}.lbl`), 'utf8');
      const sym = (n) => parseInt(lbl.match(new RegExp(`al ([0-9A-F]+) \\.${n}\\b`))[1], 16);
      if (sym('__BSS_RUN__') + sym('__BSS_SIZE__') > 0x5a00) throw new Error(`mg.${g.id} (${deptId}): reaches the route map at $5a00 (src/leave.s)`);
    }
    const p = checkedPack(raw, `mg.${g.id}`);
    out[g.id] = { raw, packed: p, at: slotAt(raw, p, `mg.${g.id}`) };
  }
  return (gameBins[deptId] = out);
};

// ---- the test career (side 1): starts on the floor of the game it plays
const sideFloorsBaked = {};

// ---- one disk side
// The floor template (src/loader.s): unpacked to the overlay slot for a floor's unpacking, kept packed under the
// KERNAL; the packed floor loads above the template.
// The template is the grids (map, colours, walk/interact) and the fixed part of the header (names, colleague and
// interactable tables) of one floor; it is kept packed from the end of the far texts (src/main.s tpl_pack) to $fdc0.
const TPL_SIZE = 3 * 40 * 28 + HDR.SP;
const TPL_RAM_END = 0xfdc0;
const TPL = 0x4000;
const FLOOR_PACKED = 0x4f00;
const TPL_COPY = 0x5900;
const FLOOR_PACKED_MAX = TPL_COPY - FLOOR_PACKED;
let TPL_PACK, TPL_MAX; // (from the resident program's labels)
const DEPT_RESERVE = 26 * 254; // the department image's blocks, reserved first (so it starts at the same place)
const sideReports = [];
let side1 = null; // { disk, files } of side 1, finished after the resident program is placed
const buildSide = async (side) => {
  const disk = new D64(`synergy tower ${side.label}`, 'st');
  const report = [];
  const add = (name, p, raw, interleave = FAST_INTERLEAVE) => {
    const f = disk.add(name, p, interleave);
    report.push({ name, raw, packed: p.length, f });
    return f;
  };
  const deptFile = disk.add('dept', new Uint8Array(DEPT_RESERVE), FAST_INTERLEAVE);
  const saveFile = disk.add('save', new Uint8Array(508), 1);
  const save3File = disk.add('save3', new Uint8Array(254), 1); // (state page 3, at $bf00)
  // floors
  const { cs } = baseCharset();
  const deptId = DEPT_OPT ?? side.dept.id;
  const baked = side.floors.map((f) => bakeFloor(f, cs, gameIndex, { crowd: f === 1 && args.includes('--crowd'), diff: DIFF }));
  sideFloorsBaked[side.n] = baked;
  // The floors share their walls, corridors and lobby: each is packed against a template, the grids (map, colours,
  // walk/interact) of the side's floor most like the others, which the department image carries (src/floor.s).
  const GRIDS = 3 * 40 * 28;
  const grid = (fl) => fl.bin.subarray(0, GRIDS);
  const likeness = (a) => baked.reduce((n, b) => n + grid(a).reduce((m, v, i) => m + (v === grid(b)[i]), 0), 0);
  const model = baked.reduce((best, fl) => (likeness(fl) > likeness(best) ? fl : best));
  let tpl = model.bin.slice(0, TPL_SIZE);
  let tplPacked = checkedPack(tpl, 'template');
  if (tplPacked.length > TPL_MAX) {
    tpl.fill(0, GRIDS); // (no room for its header part: the grids alone)
    tplPacked = checkedPack(tpl, 'template');
    console.log(`side ${side.n}: the floor template's header part doesn't fit ($${TPL_PACK.toString(16)}-$${TPL_RAM_END.toString(16)}), grids only`);
  }
  if (tplPacked.length > TPL_MAX) throw new Error(`side ${side.n}: the floor template packs to ${tplPacked.length} B, more than the ${TPL_MAX} B at $${TPL_PACK.toString(16)}`);
  const floorFiles = baked.map((fl, i) => {
    const p = checkedPack(fl.bin, 'floor', tpl);
    if (p.length > FLOOR_PACKED_MAX) throw new Error(`floor ${side.floors[i]}: ${p.length} B packed, more than the ${FLOOR_PACKED_MAX} B load buffer (src/floor.s)`);
    return add(`floor${String(side.floors[i]).padStart(2, '0')}`, p, fl.bin.length);
  });
  // games of these floors (+ the review)
  const bins = await deptGames(deptId);
  const here = new Set(side.floors.flatMap((f) => buildFloor(f).tasks.map((t) => t.task.game)));
  here.add('review');
  const gfile = {};
  for (const g of games) if (here.has(g.id) && bins[g.id]) gfile[g.id] = { ...add(g.file, bins[g.id].packed, bins[g.id].raw.length), at: bins[g.id].at };
  const missing = [...here].filter((id) => !bins[id]);
  const main3File = side.n === 1 ? add('main3', main3Packed, main3Raw.length) : null; // (part 3: loaded by the boot file)
  const termFile = add('sys.term', termPacked, termRaw.length);
  const titleFile = side.n === 1 ? add('sys.title', titlePacked, titleRaw.length) : null;
  const endFile = side.floors.includes(E.FLOORS) ? add('sys.end', endPacked, endRaw.length) : null;
  // directory + colleague lines -> the department image ($c800 charset, $d000 directory and lines)
  const dir = new Uint8Array(DIR.SIZE);
  dir.set([0x53, 0x54, side.n, DEPARTMENTS.indexOf(side.dept), DEPT_SONG(side.dept), side.floors[0], side.floors.length], DIR.MAGIC);
  floorFiles.forEach((f, i) => ((dir[DIR.FLOOR_T + i] = f.track), (dir[DIR.FLOOR_S + i] = f.sector)));
  const ts = (k, f) => f && ((dir[DIR[`${k}_T`]] = f.track), (dir[DIR[`${k}_S`]] = f.sector));
  ts('TERM', termFile);
  { const at = slotAt(termRaw, termPacked, 'sys.term'); dir.set([at & 0xff, at >> 8], DIR.TERM_AT); }
  ts('MAIN3', main3File);
  ts('SAVE', saveFile);
  ts('SAVE2', { track: saveFile.chain[1][0], sector: saveFile.chain[1][1] });
  ts('SAVE3', save3File);
  ts('TITLE', titleFile);
  if (titleFile) dir.set([slotAt(titleRaw, titlePacked, 'sys.title') & 0xff, slotAt(titleRaw, titlePacked, 'sys.title') >> 8], DIR.TITLE_AT);
  ts('END', endFile);
  if (endFile) dir.set([slotAt(endRaw, endPacked, 'sys.end') & 0xff, slotAt(endRaw, endPacked, 'sys.end') >> 8], DIR.END_AT);
  for (const g of games) {
    const f = gfile[g.id];
    if (!f) continue;
    dir[DIR.GAME_T + g.index] = f.track;
    dir[DIR.GAME_S + g.index] = f.sector;
    dir[DIR.GAME_ATL + g.index] = f.at & 0xff;
    dir[DIR.GAME_ATH + g.index] = f.at >> 8;
  }
  dir[DIR.LINES_DEPT] = side.dept.npcLines.length;
  const lines = [...COMMON_NPC_LINES, ...side.dept.npcLines].flatMap((l) => [...encBytes(l), 0]);
  const far2 = [...dir, ...lines];
  if (far2.length > 0x1000) throw new Error(`side ${side.n}: directory + colleague lines ${far2.length} B, more than the 4 KB at $d000`);
  if (cs.next > 256) throw new Error(`side ${side.n}: charset full`);
  const image = new Uint8Array(0x800 + far2.length);
  image.set(cs.bytes.subarray(0, 0x800), 0);
  image.set(far2, 0x800);
  const deptPacked = checkedPack(image, 'dept');
  disk.rewrite(deptFile, Uint8Array.from([tplPacked.length & 0xff, tplPacked.length >> 8, ...tplPacked, ...deptPacked])); // (src/loader.s dept_tpl)
  report.unshift({ name: 'dept', raw: image.length + tpl.length, packed: 2 + tplPacked.length + deptPacked.length, f: deptFile });
  if (deptFile.track !== DEPT_T || deptFile.sector !== DEPT_S) throw new Error('the department image moved');
  sideReports.push({ side, disk, report, missing, cells: cs.next - 128 });
  return { disk, report, deptFile, saveFile, floorFiles, gfile, baked };
};
// The department image is the first file allocated on every side, so it starts at the same track/sector.
const { DEPT_T, DEPT_S } = (() => {
  const f = new D64('x', 'st').add('dept', new Uint8Array(DEPT_RESERVE), FAST_INTERLEAVE);
  return { DEPT_T: f.track, DEPT_S: f.sector };
})();
writeFileSync(join(GEN, 'files.inc'), [`DEPT_T = ${DEPT_T}`, `DEPT_S = ${DEPT_S}`, ...Object.entries({ TPL, TPL_SIZE, TPL_RAM_END, FLOOR_PACKED, TPL_COPY }).map(([k, v]) => `${k} = ${v}`)].join('\n') + '\n');

// ---- the test career's script (side 1 floors)
const writeAutoplay = (baked) => {
  if (!AUTOPLAY) return;
  let autoFloorNo = SIDES[0].floors.find((f) => buildFloor(f).tasks.some((t) => t.task.game === AUTO_GAME)) || 1;
  let autoFloor = baked[autoFloorNo - 1];
  let target = AUTO_GAME;
  if (CEO_TEST) {
    autoFloorNo = E.FLOORS;
    autoFloor = bakeFloor(E.FLOORS, baseCharset().cs, gameIndex, {});
    target = buildFloor(E.FLOORS).tasks.map((t) => t.task.game).find((g) => ported(games[gameIndex[g]]));
  }
  // --autoplay=<game>: play that station; --autoplay=promote: promotion-ready, HR review, then the elevator up.
  const lobbyDone = AUTO_GAME !== 'jargon';
  const FIRE = 16;
  const idle = (n) => Array.from({ length: Math.ceil(n / 250) }, (_, i) => [Math.min(250, n - i * 250), 0]);
  // HR desk -> review card -> Start, the review (~25 s); the elevator -> panel -> promote; the card's button comes
  // from the free-running fire presses after the script.
  const kinds = ['hr', 'elevator', 'terminal', 'coffee', 'turnstile', 'poster'];
  const plan = kinds.includes(AUTO_GAME) ? [{ kind: AUTO_GAME }] : AUTO_GAME === 'promote' ? [{ kind: 'hr', wait: 60, then: [[2, FIRE], ...idle(1300)] }, { kind: 'elevator', wait: 60, then: [[2, FIRE], [10, 0]] }] : target;
  const script = [...(args.includes('--fire') ? idle(700) : []), ...autoplayScript(autoFloor.fl, autoFloor.info, autoFloor.iacts, plan, { tour: DEMO, fromEntrance: !lobbyDone })]; // (--fire: stand still while they walk out)
  writeFileSync(
    join(GEN, 'autoplay.s'),
    [`AUTO_LOBBY = ${lobbyDone ? 2 : 0}`, `AUTO_COFFEE = ${lobbyDone ? 6 : 0}`, `AUTO_READY = ${AUTO_GAME === 'promote' ? 1 : 0}`, `AUTO_CEO = ${CEO_TEST ? 1 : 0}`, `AUTO_FLOOR = ${autoFloorNo}`, 'autoplay_script:', ...script.map(([n, j]) => `  .byte ${n}, ${j}`), '  .byte 0', ''].join('\n'),
  );
};

// ---- resident program: part 1 ($0801), part 2 ($9600), part 3 ($6400, on every side: it is reloaded after the
// terminal), far texts ($e000). It is the same for every side: what differs comes from the side's directory.
// The test script needs side 1's floors baked first (they only depend on the floor and the charset order).
{
  const { cs } = baseCharset();
  writeAutoplay(SIDES[0].floors.map((f) => bakeFloor(f, cs, gameIndex, { crowd: f === 1 && args.includes('--crowd'), diff: DIFF })));
}
asm('src/main.s', 'build/obj/main.o');
run('ld65', ['-C', 'cfg/main.cfg', '-m', 'build/main.map', '-Ln', 'build/main.lbl', '-o', 'build/main.prg', 'build/obj/main.o']);
const mainRaw = readFileSync(join(B, 'main.prg')).subarray(2);
const main2Raw = readFileSync(join(B, 'main2.bin'));
const main3Raw = readFileSync(join(B, 'main3.bin'));
const farRaw = readFileSync(join(B, 'far.bin'));
TPL_PACK = parseInt(readFileSync(join(B, 'main.lbl'), 'utf8').match(/al ([0-9A-F]+) \.tpl_pack\b/)[1], 16);
if (TPL_PACK !== 0xe000 + farRaw.length) throw new Error('tpl_pack is not the end of the far texts');
TPL_MAX = TPL_RAM_END - TPL_PACK;
if (TPL_COPY + TPL_MAX > 0x6400 || TPL + TPL_SIZE > FLOOR_PACKED) throw new Error('floor template buffers overlap');
const main3Packed = checkedPack(main3Raw, 'main3');

// ---- the sides
for (const side of SIDES.filter((s) => BUILD_SIDES.includes(s.n))) {
  const r = await buildSide(side);
  if (side.n === 1) side1 = r;
}
// side 1 also carries the boot file and the resident parts
{
  const { disk, report } = side1;
  const add = (name, raw) => {
    const p = checkedPack(raw, name);
    const f = disk.add(name, p, FAST_INTERLEAVE);
    report.push({ name, raw: raw.length, packed: p.length, f });
    return f;
  };
  const farFile = add('far', farRaw);
  const main2File = add('main2', main2Raw);
  const mainFile = add('main', mainRaw);
  const main3File = report.find((r) => r.name === 'main3').f;
  writeFileSync(
    join(GEN, 'boot.inc'),
    [`TPL_PACK = ${TPL_PACK}`, `MAIN_T = ${mainFile.track}`, `MAIN_S = ${mainFile.sector}`, `MAIN3_T = ${main3File.track}`, `MAIN3_S = ${main3File.sector}`, `MAIN2_T = ${main2File.track}`, `MAIN2_S = ${main2File.sector}`, `FAR_T = ${farFile.track}`, `FAR_S = ${farFile.sector}`].join('\n') + '\n',
  );
  run('ca65', ['-I', 'src', '-I', 'build', '--bin-include-dir', 'build', '-o', 'build/obj/boot.o', 'src/boot.s']);
  run('ld65', ['-C', 'cfg/boot.cfg', '-m', 'build/boot.map', '-o', 'build/disk/synergy', 'build/obj/boot.o']);
  disk.add('synergy', readFileSync(join(B, 'disk', 'synergy')), 10);
}

// ---- write the images + report
const size = (p) => statSync(join(ROOT, p)).size;
console.log(`boot ${size('build/disk/synergy') - 2} B (KERNAL load); main $0801-${hex(0x0801 + mainRaw.length - 1)}, main3 $6400-${hex(0x6400 + main3Raw.length - 1)}, main2 $9600-${hex(0x9600 + main2Raw.length - 1)}, far $e000-${hex(0xe000 + farRaw.length - 1)}`);
const images = [];
for (const { side, disk, report, missing, cells } of sideReports) {
  const first = ['synergy', 'dept', 'main', 'main2', 'main3', 'far', 'sys.title', 'sys.end', 'sys.term', 'save', 'save3'];
  const order = [...first.filter((n) => disk.files.some((f) => f.name === n)), ...disk.files.map((f) => f.name).filter((n) => !first.includes(n))];
  const file = join(B, `synergy-${side.label}.d64`);
  writeFileSync(file, disk.finish(order));
  images.push(file);
  const verbose = args.includes('--verbose') || sideReports.length === 1;
  if (verbose) for (const r of report) console.log(`${r.name.padEnd(10)} ${String(r.raw).padStart(6)} B  -> ${String(r.packed).padStart(5)} B (lz)   track ${r.f.track} sector ${r.f.sector}, ${r.f.blocks} blocks`);
  console.log(`side ${side.n} (disk ${side.label}, floors ${side.floors[0]}-${side.floors.at(-1)}, ${side.dept.id}): ${disk.blocksFree} blocks free (+${disk.used[18].filter((u) => !u).length} on track 18${disk.dirTrackBlocks ? `, ${disk.dirTrackBlocks} used there` : ''}), ${disk.files.length} files, ${cells}/128 tile cells${missing.length ? `; not ported yet: ${missing.join(' ')}` : ''}`);
}
copyFileSync(join(B, 'synergy-1a.d64'), join(B, 'synergy.d64')); // (the tests and --run use side 1 under this name)
if (args.includes('--publish')) {
  // the download on synergytower.co.uk/c64/: all 8 release sides, nothing else
  if (AUTOPLAY || BUILD_SIDES.length !== SIDES.length) throw new Error('--publish needs a release build of every side');
  const zip = join(ROOT, '..', 'public', 'c64', 'synergy-tower-c64.zip');
  rmSync(zip, { force: true });
  const z = spawnSync('zip', ['-q', '-9', '-X', '-j', zip, ...SIDES.map((s) => join(B, `synergy-${s.label}.d64`))], { stdio: 'inherit' });
  if (z.status !== 0) throw new Error('zip failed');
  console.log(`published ${zip} (${statSync(zip).size} bytes)`);
}
const d64 = join(B, 'synergy.d64');

// ---- optional: headless screenshots / interactive run
const shots = opt('shots');
if (shots) {
  const secs = shots.split(',').map(Number);
  await Promise.all(
    secs.map(
      (s) =>
        new Promise((resolve) => {
          const out = join(B, `shot-${s}s.png`);
          // each run on its own copy (a run saves its career into the image); -console: no GUI window needed;
          // a fixed seed, no random autostart delay and no drive wobble make the shot times repeatable
          const img = join(B, `shot-${s}s.d64`);
          writeFileSync(img, readFileSync(d64));
          const p = spawn('x64sc', ['-default', '-console', '-silent', '-sounddev', 'dummy', '-warp', '-seed', '1', '+autostart-delay-random', '-drive8wobblefrequency', '0', '-drive8wobbleamplitude', '0', '-limitcycles', String(Math.round(s * 985248)), '-exitscreenshot', out, '-autostart', img], { stdio: 'ignore' });
          p.on('exit', () => rmSync(img, { force: true }));
          p.on('exit', () => resolve(console.log(`screenshot ${out}`)));
        }),
    ),
  );
}
if (args.includes('--run')) spawn('x64sc', ['-autostart', d64], { stdio: 'ignore', detached: true }).unref();
