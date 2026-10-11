#!/usr/bin/env bun
// Builds the C64 proof of concept: bakes floor 1, the font, sprites and music out of the JS game, assembles the
// boot file, the main program and the mini-game overlays (cc65), packs them and writes build/synergy.d64.
//
//   bun c64/build.js                 build
//   bun c64/build.js --run           build and start VICE
//   bun c64/build.js --autoplay      build a test disk whose joystick walks to the Memory station and plays
//   bun c64/build.js --autoplay --shots=8,20,40   ... and save headless VICE screenshots at those seconds
//   bun c64/build.js --autoplay=bingo   ... the same for another station's game
//   --interleave=N    sector interleave of the fast-loaded files (default 13)
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { installMockDocument } from '../tests/mock-canvas.js';

installMockDocument();
const { Charset, fontGlyphs, addFont, addUi, personSprites, bossSprites, addOverlayChars, BG } = await import('./tools/art.js');
const { bakeFloor, autoplayScript, OFF, HDR, FLOOR_BASE } = await import('./tools/floor.js');
const { songAsm, freqTables } = await import('./tools/music.js');
const { pack, unpack } = await import('./tools/lz.js');
const { jargonAsm, bingoAsm } = await import('./tools/mgdata.js');
const { D64 } = await import('./tools/d64.js');
const { SONGS } = await import('../src/data/music.js');
const E = await import('../src/core/economy.js');

const ROOT = dirname(new URL(import.meta.url).pathname);
const B = join(ROOT, 'build');
const GEN = join(B, 'gen');
const args = process.argv.slice(2);
const DEMO = args.includes('--demo'); // autoplay Boss Alert after a walk to the bottom of the floor
const autoArg = args.find((a) => a.startsWith('--autoplay')) ?? (DEMO ? '--autoplay=stealth' : undefined);
const AUTOPLAY = !!autoArg;
const AUTO_GAME = autoArg?.split('=')[1] || 'memory'; // --autoplay=jargon walks to that station instead
const FLOOR = 1;
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

const def = AUTOPLAY ? ['-D', 'AUTOPLAY=1'] : [];
const disk = new D64('synergy tower', 'st');
// Sector interleave of fast-loaded files. Measured in VICE with the 2-bit loader: a block takes ~50 ms to send and
// the DOS needs ~60 ms more to pick up the next read job and decode the sector, so 11 or less misses a whole
// revolution (7-block overlay: 1 = 1.3 s, 8 = 1.8 s, 11 = 2.0 s) and 12-15 catch the next sector (0.9 s).
// 13 leaves a margin for real drives running a little fast.
const FAST_INTERLEAVE = Number(args.find((a) => a.startsWith('--interleave='))?.slice(13) ?? 13);

// ---- drive code + mini-game overlays (first on the disk, so the floor file can point at them)
run('ca65', ['-o', 'build/obj/drive.o', 'src/drive.s']);
run('ld65', ['-C', 'cfg/drive.cfg', '-o', 'build/obj/drive.bin', 'build/obj/drive.o']);
const overlays = [
  { src: 'mg_memory.s', file: 'mg.memory' },
  { src: 'mg_jargon.s', file: 'mg.jargon' },
  { src: 'mg_bingo.s', file: 'mg.bingo' },
  { src: 'mg_stealth.s', file: 'mg.stealth' },
];
const report = [];
const packed = (raw, name) => {
  const p = pack(raw);
  const back = unpack(p);
  if (back.length !== raw.length || back.some((v, i) => v !== raw[i])) throw new Error(`packer self-check failed: ${name}`);
  if (p.length > 0x2000) throw new Error(`${name} does not fit the load buffer`);
  const f = disk.add(name, p, FAST_INTERLEAVE);
  report.push({ name, raw: raw.length, packed: p.length, f });
  return f;
};

// ---- charset: UI, font, the overlays' chars (fixed codes), then the floor's tiles (below)
const cs = new Charset();
addUi(cs);
addFont(cs, fontGlyphs(join(ROOT, '../src/engine/font.js')));
writeFileSync(join(GEN, 'chars.inc'), addOverlayChars(cs));
writeFileSync(join(GEN, 'boss.bin'), bossSprites());
writeFileSync(join(GEN, 'mg_jargon_data.s'), jargonAsm());
writeFileSync(join(GEN, 'mg_bingo_data.s'), bingoAsm('lobby'));

const files = {};
for (const o of overlays) {
  run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, '-o', `build/obj/${o.file}.o`, `src/${o.src}`]);
  run('ld65', ['-C', 'cfg/overlay.cfg', '-Ln', `build/obj/${o.file}.lbl`, '-o', `build/obj/${o.file}.bin`, `build/obj/${o.file}.o`]);
  files[o.file] = packed(readFileSync(join(B, 'obj', `${o.file}.bin`)), o.file);
}

// ---- art + floor
const floor = bakeFloor(FLOOR, cs, files);
writeFileSync(join(GEN, 'charset.bin'), cs.bytes);
writeFileSync(join(GEN, 'sprites.bin'), personSprites());
const floorFile = packed(floor.bin, 'floor01');
writeFileSync(join(GEN, 'files.inc'), `FLOOR01_T = ${floorFile.track}\nFLOOR01_S = ${floorFile.sector}\n`);

const reward = [0, 1, 2, 3].map((st) => E.taskReward(FLOOR, st).sp);
const inc = [
  '; generated by c64/build.js',
  `FL_MAP  = ${hex(FLOOR_BASE + OFF.MAP)}`,
  `FL_COL  = ${hex(FLOOR_BASE + OFF.MAPCOL)}`,
  `FL_INFO = ${hex(FLOOR_BASE + OFF.INFO)}`,
  `FL_HDR  = ${hex(FLOOR_BASE + OFF.HDR)}`,
  ...Object.entries(HDR).map(([k, v]) => `HDR_${k} = ${v}`),
  `QUOTA = ${E.starQuota(FLOOR)}`,
  `START_CLIPS = ${E.STARTING.sp}`,
  `START_COFFEE = ${E.maxCoffee(FLOOR)}`,
  `COFFEE_MAX = ${E.maxCoffee(FLOOR)}`,
  ...reward.map((r, i) => `REWARD${i} = ${r}`),
];
writeFileSync(join(GEN, 'floor.inc'), inc.join('\n') + '\n');

// ---- music: the floor's department song + the mini-game song
const songs = [floor.dept.music, 'minigame'];
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

if (AUTOPLAY) {
  const script = autoplayScript(floor.fl, floor.info, floor.iacts, AUTO_GAME, { tour: DEMO });
  writeFileSync(join(GEN, 'autoplay.s'), ['autoplay_script:', ...script.map(([n, j]) => `  .byte ${n}, ${j}`), '  .byte 0', ''].join('\n'));
}

// ---- main program (fast-loaded and unpacked to $0801 by the boot file)
run('ca65', ['-g', '-I', 'src', '-I', 'build', '--bin-include-dir', 'build', ...def, '-o', 'build/obj/main.o', 'src/main.s']);
run('ld65', ['-C', 'cfg/main.cfg', '-m', 'build/main.map', '-Ln', 'build/main.lbl', '-o', 'build/main.prg', 'build/obj/main.o']);
const mainFile = packed(readFileSync(join(B, 'main.prg')).subarray(2), 'main');
writeFileSync(join(GEN, 'boot.inc'), `MAIN_T = ${mainFile.track}\nMAIN_S = ${mainFile.sector}\n`);

// ---- boot file: the only KERNAL load (first in the directory for LOAD"*")
run('ca65', ['-I', 'src', '-I', 'build', '--bin-include-dir', 'build', '-o', 'build/obj/boot.o', 'src/boot.s']);
run('ld65', ['-C', 'cfg/boot.cfg', '-m', 'build/boot.map', '-o', 'build/disk/synergy', 'build/obj/boot.o']);
disk.add('synergy', readFileSync(join(B, 'disk', 'synergy')), 10);
const d64 = join(B, 'synergy.d64');
writeFileSync(d64, disk.finish(['synergy', 'main', 'floor01', ...overlays.map((o) => o.file)]));

// ---- report
const size = (p) => statSync(join(ROOT, p)).size;
const mainRaw = size('build/main.prg') - 2;
console.log(`charset: ${cs.next - 128}/128 tile cells used`);
console.log(`boot      ${String(size('build/disk/synergy') - 2).padStart(6)} B  (KERNAL load)   main $0801-${hex(0x0801 + mainRaw - 1)}`);
for (const r of report) console.log(`${r.name.padEnd(9)} ${String(r.raw).padStart(6)} B  -> ${String(r.packed).padStart(5)} B (lz)   track ${r.f.track} sector ${r.f.sector}, ${r.f.blocks} blocks`);
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
          const p = spawn('x64sc', ['-default', '-silent', '-sounddev', 'dummy', '-warp', '-limitcycles', String(Math.round(s * 985248)), '-exitscreenshot', out, '-autostart', d64], { stdio: 'ignore' });
          p.on('exit', () => resolve(console.log(`screenshot ${out}`)));
        }),
    ),
  );
}
if (args.includes('--run')) spawn('x64sc', ['-autostart', d64], { stdio: 'ignore', detached: true }).unref();
