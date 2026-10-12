// Minimal 1541 disk image writer: 35 tracks, BAM + directory on track 18, PRG files.
// Writing the image ourselves (instead of c1541) lets the build choose each file's sector interleave and
// know where every file starts, so the fast loader can fetch files by track/sector without a directory search.
const TRACKS = 35;
export const sectorsOn = (t) => (t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17);
const offsetOf = (t, s) => {
  let n = 0;
  for (let k = 1; k < t; k++) n += sectorsOn(k);
  return (n + s) * 256;
};
// Data tracks nearest to the directory first, like the DOS: 17, 19, 16, 20, ... and last the directory track's
// own spare sectors (the DOS never puts files there, but the fast loader reads by track/sector anyway).
const TRACK_ORDER = [];
for (let d = 1; d < TRACKS; d++) for (const t of [18 - d, 18 + d]) if (t >= 1 && t <= TRACKS) TRACK_ORDER.push(t);
TRACK_ORDER.push(18);
// Directory sectors in the DOS's order (8 entries each); the first DIR_RESERVE are kept for it.
const DIR_ORDER = [1, 4, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18];
const DIR_RESERVE = 8;

const petscii = (s) => [...s.toUpperCase()].map((c) => c.charCodeAt(0));

export class D64 {
  constructor(name, id) {
    this.img = new Uint8Array(offsetOf(TRACKS + 1, 0));
    this.used = Array.from({ length: TRACKS + 1 }, (_, t) => new Array(t ? sectorsOn(t) : 0).fill(false));
    this.files = []; // { name, track, sector, blocks }
    this.name = name;
    this.id = id;
    this.used[18][0] = true;
    for (const d of DIR_ORDER.slice(0, DIR_RESERVE)) this.used[18][d] = true;
  }

  /** Allocate and write a file. `interleave` = sectors skipped between consecutive blocks. */
  add(name, bytes, interleave = 10) {
    const blocks = Math.max(1, Math.ceil(bytes.length / 254));
    const chain = [];
    let ti = 0;
    let sector = -1;
    for (let b = 0; b < blocks; b++) {
      while (this.used[TRACK_ORDER[ti]].every(Boolean)) if (++ti >= TRACK_ORDER.length) throw new Error('disk full');
      const t = TRACK_ORDER[ti];
      const n = sectorsOn(t);
      let s = sector < 0 ? 0 : (sector + interleave) % n;
      while (this.used[t][s]) s = (s + 1) % n;
      this.used[t][s] = true;
      chain.push([t, s]);
      sector = s;
    }
    chain.forEach(([t, s], i) => {
      const o = offsetOf(t, s);
      const part = bytes.subarray(i * 254, i * 254 + 254);
      const next = chain[i + 1];
      this.img[o] = next ? next[0] : 0;
      this.img[o + 1] = next ? next[1] : part.length + 1;
      this.img.set(part, o + 2);
    });
    const f = { name, track: chain[0][0], sector: chain[0][1], blocks, chain };
    this.files.push(f);
    return f;
  }

  /** Write `bytes` into file `f`'s blocks (allocated earlier, at least as big); blocks left over are freed. */
  rewrite(f, bytes) {
    const blocks = Math.max(1, Math.ceil(bytes.length / 254));
    if (blocks > f.blocks) throw new Error(`${f.name}: ${blocks} blocks do not fit the ${f.blocks} reserved`);
    for (const [t, s] of f.chain.slice(blocks)) {
      this.used[t][s] = false;
      this.img.fill(0, offsetOf(t, s), offsetOf(t, s) + 256);
    }
    f.chain = f.chain.slice(0, blocks);
    f.blocks = blocks;
    f.chain.forEach(([t, s], i) => {
      const o = offsetOf(t, s);
      const part = bytes.subarray(i * 254, i * 254 + 254);
      const next = f.chain[i + 1];
      this.img.fill(0, o, o + 256);
      this.img[o] = next ? next[0] : 0;
      this.img[o + 1] = next ? next[1] : part.length + 1;
      this.img.set(part, o + 2);
    });
    return f;
  }

  /** Directory order can differ from allocation order (LOAD"*" takes the first entry). */
  finish(order = this.files.map((f) => f.name)) {
    const bam = offsetOf(18, 0);
    const img = this.img;
    // Directory sectors 18/1, 18/4, 18/7, ... (8 entries each, linked), as the DOS lays them out.
    const dirSectors = DIR_ORDER.slice(0, Math.max(1, Math.ceil(order.length / 8)));
    if (dirSectors.length > DIR_RESERVE) throw new Error(`more than ${8 * DIR_RESERVE} files`);
    for (const d of DIR_ORDER.slice(dirSectors.length, DIR_RESERVE)) this.used[18][d] = false; // (spare ones back)
    img.set([18, 1, 0x41, 0x00], bam);
    for (let t = 1; t <= TRACKS; t++) {
      const free = this.used[t].map((u) => !u);
      const bits = [0, 0, 0];
      free.forEach((f, s) => f && (bits[s >> 3] |= 1 << (s & 7)));
      img.set([free.filter(Boolean).length, ...bits], bam + 4 * t);
    }
    img.fill(0xa0, bam + 0x90, bam + 0xab);
    img.set(petscii(this.name).slice(0, 16), bam + 0x90);
    img.set(petscii(this.id).slice(0, 2), bam + 0xa2);
    img.set([0x32, 0x41], bam + 0xa5); // "2A"
    dirSectors.forEach((d, k) => {
      const next = dirSectors[k + 1];
      img.set(next ? [18, next] : [0, 0xff], offsetOf(18, d));
    });
    order.forEach((name, i) => {
      const f = this.files.find((x) => x.name === name);
      const e = offsetOf(18, dirSectors[i >> 3]) + (i & 7) * 32;
      img[e + 2] = 0x82; // PRG, closed
      img[e + 3] = f.track;
      img[e + 4] = f.sector;
      img.fill(0xa0, e + 5, e + 21);
      img.set(petscii(f.name).slice(0, 16), e + 5);
      img[e + 30] = f.blocks & 0xff;
      img[e + 31] = f.blocks >> 8;
    });
    return img;
  }

  /** Free blocks as the DOS counts them (without the directory track). */
  get blocksFree() {
    let n = 0;
    for (let t = 1; t <= TRACKS; t++) if (t !== 18) n += this.used[t].filter((u) => !u).length;
    return n;
  }

  /** Data blocks on the directory track. */
  get dirTrackBlocks() {
    return this.files.reduce((n, f) => n + f.chain.filter(([t]) => t === 18).length, 0);
  }
}
