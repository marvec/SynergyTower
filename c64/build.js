#!/usr/bin/env bun
// Builds the C64 version: bakes floors 1-2, the font, sprites, music and texts out of the JS game, assembles the
// boot file, the three resident parts and the overlays (cc65), packs them and writes build/synergy.d64.
//
//   bun c64/build.js                 build
//   bun c64/build.js --run           build and start VICE
//   bun c64/build.js --autoplay      test disk: skips the title, walks to the Memory station and plays it perfectly
//   bun c64/build.js --autoplay --shots=8,20,40   ... and save headless VICE screenshots at those seconds
//   bun c64/build.js --autoplay=bingo   ... the same for another station's game
//   --crowd           fill floor 1 with extra colleagues (sprite multiplexer test)
//   --interleave=N    sector interleave of the fast-loaded files (default 13)
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { installMockDocument } from '../tests/mock-canvas.js';

installMockDocument();
const { Charset, fontGlyphs, addFont, addUi, personSprites, bossSprites, addOverlayChars, addQuarterBlocks, bigText, BG } = await import('./tools/art.js');
const { bakeFloor, autoplayScript, OFF, HDR, KIND, ACTOR, FLOOR_BASE, asc } = await import('./tools/floor.js');
const { songAsm, freqTables } = await import('./tools/music.js');
const { pack, unpack, inPlaceGap } = await import('./tools/lz.js');
const { jargonAsm, bingoAsm, reviewAsm } = await import('./tools/mgdata.js');
const { gameList, gamesAsm } = await import('./tools/games.js');
const { trainBpe, encodeBpe, encodeAsm, literals } = await import('./tools/bpe.js');
const { D64 } = await import('./tools/d64.js');
const { SONGS } = await import('../src/data/music.js');
const { buildFloor } = await import('../src/core/tasks.js');
const { titleForFloor, floorName, departmentForFloor } = await import('../src/data/departments.js');
const { COMMON_NPC_LINES } = await import('../src/data/npcLines.js');
const E = await import('../src/core/economy.js');

const ROOT = dirname(new URL(import.meta.url).pathname);
const B = join(ROOT, 'build');
const GEN = join(B, 'gen');
const args = process.argv.slice(2);
const DEMO = args.includes('--demo'); // autoplay after a walk to the bottom of the floor
const autoArg = args.find((a) => a.startsWith('--autoplay')) ?? (DEMO ? '--autoplay=memory' : undefined);
const AUTOPLAY = !!autoArg;
const AUTO_GAME = autoArg?.split('=')[1] || 'memory'; // --autoplay=jargon walks to that station instead
const FLOORS = [1, 2];
void BG;
for (const d of [GEN, join(B, 'obj'), join(B, 'disk')]) mkdirSync(d, { recursive: true });

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
const str = (s) => `.byte ${asc(s).join(', ')}, 0`;

const def = AUTOPLAY ? ['-D', 'AUTOPLAY=1'] : [];
const disk = new D64('synergy tower', 'st');
// Sector interleave of fast-loaded files. Measured in VICE with the 2-bit loader: a block takes ~50 ms to send and
// the DOS needs ~60 ms more to pick up the next read job and decode the sector, so 11 or less misses a whole
// revolution (7-block overlay: 1 = 1.3 s, 8 = 1.8 s, 11 = 2.0 s) and 12-15 catch the next sector (0.9 s).
// 13 leaves a margin for real drives running a little fast.
const FAST_INTERLEAVE = Number(args.find((a) => a.startsWith('--interleave='))?.slice(13) ?? 13);
const report = [];
const packed = (raw, name, max = 0x2000) => {
  const p = pack(raw);
  const back = unpack(p);
  if (back.length !== raw.length || back.some((v, i) => v !== raw[i])) throw new Error(`packer self-check failed: ${name}`);
  if (p.length > max) throw new Error(`${name} does not fit the load buffer (${p.length} B packed)`);
  const f = disk.add(name, p, FAST_INTERLEAVE);
  report.push({ name, raw: raw.length, packed: p.length, f });
  return f;
};

// ---- the save game: one reserved block the drive code writes in place
const saveFile = disk.add('save', new Uint8Array(254), 1);

// ---- games on the disk: the station games of floors 1-2 (in floor order) + the HR review
const games = gameList(FLOORS.flatMap((f) => buildFloor(f).tasks.map((t) => t.task.game)));
const gameIndex = Object.fromEntries(games.map((g) => [g.id, g.index]));

// ---- drive code
run('ca65', ['-o', 'build/obj/drive.o', 'src/drive.s']);
run('ld65', ['-C', 'cfg/drive.cfg', '-o', 'build/obj/drive.bin', 'build/obj/drive.o']);

// ---- charset: UI, font, the overlays' chars (fixed codes), then the floors' tiles (below)
const cs = new Charset();
addUi(cs);
addFont(cs, fontGlyphs(join(ROOT, '../src/engine/font.js')));
writeFileSync(join(GEN, 'chars.inc'), addOverlayChars(cs));
addQuarterBlocks(cs);
const glyphs = fontGlyphs(join(ROOT, '../src/engine/font.js'));
const { CORP_COLORS, SKIN_TONES, HAIR_COLORS } = await import('../src/data/corpColors.js');
const { HOW_TO_C64, titleDataAsm } = await import('./tools/titledata.js');
writeFileSync(join(GEN, 'title_data.s'), titleDataAsm({ bigText: (t) => bigText(glyphs, t), CORP_COLORS, SKIN_TONES, HAIR_COLORS, titles: [1, 2, 3].map((f) => titleForFloor(f)), games: games.length - 1 }));
void HOW_TO_C64;
writeFileSync(join(GEN, 'boss.bin'), bossSprites());
writeFileSync(join(GEN, 'mg_jargon_data.s'), jargonAsm());
writeFileSync(join(GEN, 'mg_bingo_data.s'), bingoAsm('lobby'));
// Each ported mini-game may bring a data generator, tools/mg/<id>.js: export function dataAsm({ dept }) -> asm text
// for build/gen/mg_<id>_data.s (content from src/data/mg-<id>.js).
for (const g of games) {
  const gen = join(ROOT, 'tools', 'mg', `${g.id}.js`);
  if (existsSync(gen)) writeFileSync(join(GEN, `mg_${g.id}_data.s`), (await import(gen)).dataAsm({ dept: departmentForFloor(1).id }));
}
{
  const { REVIEW } = await import('../src/data/mg-review.js');
  const { DEPARTMENTS } = await import('../src/data/departments.js');
  writeFileSync(join(GEN, 'mg_review_data.s'), reviewAsm({ REVIEW, titles: Array.from({ length: 40 }, (_, i) => titleForFloor(i + 1)), depts: DEPARTMENTS.map((d) => d.name) }));
}

// ---- overlays: mini-games (those written so far) + the system overlays
const files = {};
const overlay = (src, file, cfg = 'overlay', from = `src/${src}`) => {
  if (!existsSync(join(ROOT, 'src', src))) return;
  run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, '-o', `build/obj/${file}.o`, from]);
  run('ld65', ['-C', `cfg/${cfg}.cfg`, '-Ln', `build/obj/${file}.lbl`, '-o', `build/obj/${file}.bin`, `build/obj/${file}.o`]);
  files[file] = packed(readFileSync(join(B, 'obj', `${file}.bin`)), file);
};
for (const g of games) overlay(g.src, g.file);
{
  const T = await import('../src/data/terminal.js');
  const { termDataAsm } = await import('./tools/termdata.js');
  const src = readFileSync(join(ROOT, '../src/core/terminal.js'), 'utf8');
  const COMMANDS = [...src.slice(src.indexOf('const COMMANDS = ['), src.indexOf('];', src.indexOf('const COMMANDS = ['))).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const term = termDataAsm({ ...T, COMMANDS, FLOORS: E.FLOORS, floorNames: Array.from({ length: 40 }, (_, i) => floorName(i + 1)), titles: Array.from({ length: 40 }, (_, i) => titleForFloor(i + 1)), onDisk: FLOORS.length, source: readFileSync(join(ROOT, 'src/sys_term.s'), 'utf8') });
  writeFileSync(join(GEN, 'term_data.s'), term.asm);
  writeFileSync(join(GEN, 'sys_term_enc.s'), '; generated by c64/build.js: src/sys_term.s with byte-pair encoded messages\n' + term.source);
}
overlay('sys_title.s', 'sys.title');
// The terminal is too big for the overlay slot: it unpacks in place over $4000-$93ff (the slot, the load
// buffer and the floor, which is loaded again afterwards), from a packed copy loaded to the top of that area.
let termAt = 0;
{
  run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, '-o', 'build/obj/sys.term.o', 'build/gen/sys_term_enc.s']);
  run('ld65', ['-C', 'cfg/term.cfg', '-Ln', 'build/obj/sys.term.lbl', '-o', 'build/obj/sys.term.bin', 'build/obj/sys.term.o']);
  const raw = readFileSync(join(B, 'obj', 'sys.term.bin'));
  const p = pack(raw);
  termAt = 0x9400 - p.length;
  const gap = inPlaceGap(p);
  if (termAt - 0x4000 < gap) throw new Error(`sys.term: in-place unpack needs ${gap} B between output and input, has ${termAt - 0x4000}`);
  files['sys.term'] = disk.add('sys.term', p, FAST_INTERLEAVE);
  report.push({ name: 'sys.term', raw: raw.length, packed: p.length, f: files['sys.term'] });
}
const missing = games.filter((g) => !files[g.file]).map((g) => g.id);

// ---- floors
const baked = FLOORS.map((f) => bakeFloor(f, cs, gameIndex, { crowd: f === 1 && args.includes('--crowd') }));
writeFileSync(join(GEN, 'charset.bin'), cs.bytes);
writeFileSync(join(GEN, 'sprites.bin'), personSprites());
const floorFiles = baked.map((fl, i) => packed(fl.bin, `floor0${FLOORS[i]}`));

// ---- text compression: byte pairs trained on every text of the resident program (tools/bpe.js)
const dept = departmentForFloor(1);
for (const f of FLOORS) if (departmentForFloor(f).id !== dept.id) throw new Error('colleague lines: one department per disk');
const lines = [...COMMON_NPC_LINES, ...dept.npcLines];
const perksText = ['Upgrade your office.', ...E.PERKS.map((p) => `${p.name}: ${p.desc}`)];
const fl3 = [...FLOORS, FLOORS.length + 1]; // names/titles include the next floor (elevator, review card)
const srcStrings = readFileSync(join(ROOT, 'src/strings.s'), 'utf8');
const srcFar = readFileSync(join(ROOT, 'src/fartext.s'), 'utf8');
const corpus = [
  ...literals(srcStrings), ...literals(srcFar), ...lines, ...perksText, ...games.map((g) => g.name), ...games.map((g) => g.help),
  ...fl3.map((f) => titleForFloor(f)), ...fl3.map((f) => floorName(f)),
].map((t) => asc(t));
const pairs = trainBpe(corpus);
const enc = (s) => `.byte ${encodeBpe(asc(s), pairs).join(', ')}, 0`; // a string
const encFar = (paras) => `.byte ${paras.flatMap((p) => [...encodeBpe(asc(p), pairs), 0]).join(', ')}, 0`; // chunks + end
writeFileSync(join(GEN, 'bpe.s'), [bytes('bpe_a', pairs.map((p) => p[0])), bytes('bpe_b', pairs.map((p) => p[1]))].join('\n') + '\n');
writeFileSync(join(GEN, 'strings.s'), '; generated by c64/build.js: src/strings.s with byte-pair encoded texts\n' + encodeAsm(srcStrings, pairs));
writeFileSync(join(GEN, 'fartext.s'), '; generated by c64/build.js: src/fartext.s with byte-pair encoded paragraphs\n' + encodeAsm(srcFar, pairs, { chunks: true }));

// ---- generated includes
const IA = { KIND: 0, ARG: 1, MARK: 2, UC: 4, UCOL: 5, STR: 6, X: 8, Y: 9, W: 10, ARG2: 11 };
const floorInc = [
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
  `FLOORS_DISK = ${FLOORS.length}`,
  `START_SP = ${E.STARTING.sp}`,
  `START_SO = ${E.STARTING.so}`,
];
writeFileSync(join(GEN, 'floor.inc'), floorInc.join('\n') + '\n');
const sys = (name) => files[name] || { track: 0, sector: 0 };
writeFileSync(
  join(GEN, 'files.inc'),
  [
    `SAVE_T = ${saveFile.track}`, `SAVE_S = ${saveFile.sector}`,
    `SYS_TITLE_T = ${sys('sys.title').track}`, `SYS_TITLE_S = ${sys('sys.title').sector}`,
    `SYS_TERM_T = ${sys('sys.term').track}`, `SYS_TERM_S = ${sys('sys.term').sector}`,
    `SYS_TERM_AT = ${termAt}`,
  ].join('\n') + '\n',
);

// Economy tables from src/core/economy.js (floors 1..FLOORS, perks as levels).
const NF = FLOORS.length;
const sp = [];
const xp = [];
for (let f = 1; f <= NF; f++)
  for (let monitor = 0; monitor <= 5; monitor++)
    for (let stapler = 0; stapler <= 1; stapler++) for (let s = 0; s <= 3; s++) sp.push(E.taskReward(f, s, { monitor, stapler }).sp);
for (let f = 1; f <= NF; f++) for (let chair = 0; chair <= 5; chair++) for (let s = 0; s <= 3; s++) xp.push(E.taskReward(f, s, { chair }).xp);
const cd = [];
const pcdMin = [];
const pcdMax = [];
for (const plant of [0, 1])
  for (let f = 1; f <= NF; f++) {
    const perks = { plant };
    cd.push(E.reviewCooldownMs(f, perks) / 1000, ...[1, 2, 3].map((t) => E.stationCooldownMs(f, perks, ['timing', 'typing', 'cables'][t - 1]) / 1000));
    pcdMin.push(Math.max(1, Math.round((E.baseCooldownMs(f, perks) * E.COOLDOWN_TIER_MULT[3]) / 60000)));
    pcdMax.push(Math.round((E.baseCooldownMs(f, perks) * E.COOLDOWN_TIER_MULT[1]) / 60000));
  }
const perkCost = E.PERKS.flatMap((p) => [0, 1, 2, 3, 4].map((lv) => E.perkCost(p, lv)));
const econ = [
  '; generated by c64/build.js from src/core/economy.js and src/data/departments.js',
  words('fee', [0, ...FLOORS.map((f) => E.keycardFee(f))]),
  words('sp', sp),
  words('xp', xp),
  words('xpn', [0, ...Array.from({ length: 99 }, (_, i) => Math.min(0xffff, E.xpToNext(i + 1)))]), // (out of reach past ~Lv35)
  words('cd', cd),
  words('regen', [0, 1, 2, 3, 4, 5].map((e) => E.coffeeRegenMs({ espresso: e }) / 1000)),
  words('perkc', perkCost),
  bytes('perk_max', E.PERKS.map((p) => p.max)),
  bytes('perk_cur', E.PERKS.map((p) => (p.currency === 'so' ? 1 : 0))),
  bytes('pcd_min', pcdMin),
  bytes('pcd_max', pcdMax),
  bytes('floor_t', floorFiles.map((f) => f.track)),
  bytes('floor_s', floorFiles.map((f) => f.sector)),
  ...fl3.map((f) => `title${f}: ${enc(titleForFloor(f))}\nfname${f}: ${enc(floorName(f))}`),
  bytes('title_lo', fl3.map((f) => `<title${f}`)),
  bytes('title_hi', fl3.map((f) => `>title${f}`)),
  bytes('fname_lo', fl3.map((f) => `<fname${f}`)),
  bytes('fname_hi', fl3.map((f) => `>fname${f}`)),
];
if (E.PERKS.map((p) => p.id).join() !== 'mug,espresso,chair,monitor,stapler,plant') throw new Error('perk order changed (state.s PERK_*)');
writeFileSync(join(GEN, 'econ.s'), econ.join('\n') + '\n');

// Long texts for the RAM under the KERNAL: colleague lines (common + the lobby department's), game help, perks.
const far = [
  '; generated by c64/build.js (src/data/npcLines.js, departments.js, tools/games.js, src/core/economy.js)',
  ...lines.map((l, i) => `line${i}: ${encFar([l])}`),
  ...games.map((g) => `ghelp${g.index}: ${encFar([g.help])}`),
  `f_perks: ${encFar(perksText)}`,
];
writeFileSync(join(GEN, 'far.s'), far.join('\n') + '\n');
// The game table and the line address tables live in part 2 (they are read from normal RAM).
writeFileSync(
  join(GEN, 'games.s'),
  gamesAsm(games, files, enc) +
    [`LINES_COMMON = ${COMMON_NPC_LINES.length}`, `LINES_DEPT = ${dept.npcLines.length}`, bytes('lines_lo', lines.map((_, i) => `<line${i}`)), bytes('lines_hi', lines.map((_, i) => `>line${i}`))].join('\n') +
    '\n',
);

// ---- music: the floors' department song, the mini-game song, the title (the fanfare is for the CEO ending,
// which is not on this disk)
const songs = [dept.music, 'minigame', 'title'];
const { lo, hi } = freqTables();
const music = [
  '; generated by c64/build.js from src/data/music.js',
  `songs_lo: .byte ${songs.map((_, i) => `<song${i}`).join(', ')}`,
  `songs_hi: .byte ${songs.map((_, i) => `>song${i}`).join(', ')}`,
  `freq_lo: .byte ${lo.join(', ')}`,
  `freq_hi: .byte ${hi.join(', ')}`,
  ...songs.map((name, i) => songAsm(`song${i}`, SONGS[name]).asm),
];
writeFileSync(join(GEN, 'music.s'), music.join('\n') + '\n');

// The test career starts on the floor of the game it plays (floor 1 by default).
const autoFloorNo = FLOORS.find((f) => buildFloor(f).tasks.some((t) => t.task.game === AUTO_GAME)) || 1;
const autoFloor = baked[autoFloorNo - 1];
if (AUTOPLAY) {
  // --autoplay=<game>: play that station; --autoplay=promote: promotion-ready, HR review, then the elevator up.
  const lobbyDone = AUTO_GAME !== 'jargon';
  const FIRE = 16;
  const idle = (n) => Array.from({ length: Math.ceil(n / 250) }, (_, i) => [Math.min(250, n - i * 250), 0]);
  // HR desk -> review card -> Start, the review (~25 s); the elevator -> panel -> promote; the card's button comes
  // from the free-running fire presses after the script.
  const kinds = ['hr', 'elevator', 'terminal', 'coffee', 'turnstile', 'poster'];
  const plan = kinds.includes(AUTO_GAME) ? [{ kind: AUTO_GAME }] : AUTO_GAME === 'promote' ? [{ kind: 'hr', wait: 60, then: [[2, FIRE], ...idle(1300)] }, { kind: 'elevator', wait: 60, then: [[2, FIRE], [10, 0]] }] : AUTO_GAME;
  const script = autoplayScript(autoFloor.fl, autoFloor.info, autoFloor.iacts, plan, { tour: DEMO, fromEntrance: !lobbyDone });
  writeFileSync(
    join(GEN, 'autoplay.s'),
    [`AUTO_LOBBY = ${lobbyDone ? 2 : 0}`, `AUTO_COFFEE = ${lobbyDone ? 6 : 0}`, `AUTO_READY = ${AUTO_GAME === 'promote' ? 1 : 0}`, `AUTO_FLOOR = ${autoFloorNo}`, 'autoplay_script:', ...script.map(([n, j]) => `  .byte ${n}, ${j}`), '  .byte 0', ''].join('\n'),
  );
}

// ---- resident program: part 1 ($0801), part 2 ($9500), part 3 (far texts, $e600)
run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, '-o', 'build/obj/main.o', 'src/main.s']);
run('ld65', ['-C', 'cfg/main.cfg', '-m', 'build/main.map', '-Ln', 'build/main.lbl', '-o', 'build/main.prg', 'build/obj/main.o']);
const mainFile = packed(readFileSync(join(B, 'main.prg')).subarray(2), 'main', 0x4000);
const main2File = packed(readFileSync(join(B, 'main2.bin')), 'main2', 0x4000);
if (0xe000 + statSync(join(B, 'far.bin')).size > 0xfd00) throw new Error('far texts reach $fd00 (the hair sprite frames)');
const farFile = packed(readFileSync(join(B, 'far.bin')), 'far', 0x4000);
const charsFile = packed(cs.bytes, 'chars');
writeFileSync(
  join(GEN, 'boot.inc'),
  [`MAIN_T = ${mainFile.track}`, `MAIN_S = ${mainFile.sector}`, `MAIN2_T = ${main2File.track}`, `MAIN2_S = ${main2File.sector}`, `FAR_T = ${farFile.track}`, `FAR_S = ${farFile.sector}`, `CHARS_T = ${charsFile.track}`, `CHARS_S = ${charsFile.sector}`].join('\n') + '\n',
);

// ---- boot file: the only KERNAL load (first in the directory for LOAD"*")
run('ca65', ['-I', 'src', '-I', 'build', '--bin-include-dir', 'build', '-o', 'build/obj/boot.o', 'src/boot.s']);
run('ld65', ['-C', 'cfg/boot.cfg', '-m', 'build/boot.map', '-o', 'build/disk/synergy', 'build/obj/boot.o']);
disk.add('synergy', readFileSync(join(B, 'disk', 'synergy')), 10);
const d64 = join(B, 'synergy.d64');
const order = ['synergy', 'main', 'main2', 'far', 'chars', ...floorFiles.map((f) => f.name), 'sys.title', 'sys.term', ...games.map((g) => g.file), 'save'];
writeFileSync(d64, disk.finish(order.filter((n) => disk.files.some((f) => f.name === n))));

// ---- report
const size = (p) => statSync(join(ROOT, p)).size;
const mainRaw = size('build/main.prg') - 2;
console.log(`charset: ${cs.next - 128}/128 tile cells used`);
console.log(`boot ${size('build/disk/synergy') - 2} B (KERNAL load); main $0801-${hex(0x0801 + mainRaw - 1)}, main2 $9500-${hex(0x9500 + size('build/main2.bin') - 1)}, far $e000-${hex(0xe000 + size('build/far.bin') - 1)}`);
for (const r of report) console.log(`${r.name.padEnd(10)} ${String(r.raw).padStart(6)} B  -> ${String(r.packed).padStart(5)} B (lz)   track ${r.f.track} sector ${r.f.sector}, ${r.f.blocks} blocks`);
if (missing.length) console.log(`not on the disk yet: ${missing.join(', ')}`);
console.log(`disk: build/synergy.d64, ${disk.blocksFree} blocks free of 664 (interleave ${FAST_INTERLEAVE})`);
console.log(run('c1541', ['-attach', d64, '-list']).trim());

// ---- optional: headless screenshots / interactive run
const shots = args.find((a) => a.startsWith('--shots='));
if (shots) {
  const secs = shots.slice(8).split(',').map(Number);
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
