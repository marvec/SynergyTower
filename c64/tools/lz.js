// Bit-packed LZ77 with an optimal parse; the 6502 unpacker is `lz_unpack` in src/loader.s.
//
// The stream mixes bits and raw bytes: when the unpacker needs a bit and has none left it takes the next stream
// byte as 8 more bits (MSB first), so the packer puts each bit byte where the unpacker will reach for it.
// Numbers are Elias gamma codes (n zero bits, then the n+1 bits of the value, MSB first; values >= 1).
//
//   after a match (and at the start):   0 = literal run    1 = match at a new offset
//   after a literal run:                0 = repeat match   1 = match at a new offset
//   literal run:     gamma(length), then the bytes
//   repeat match:    gamma(length): copy from the last offset again
//   new offset:      gamma(((offset - 1) >> 8) + 1), one raw byte (offset - 1) & 255, gamma(length - 1)
//                    (a high part of 256 ends the stream)
//
// With a dictionary (`pack(data, dict)`): matches may also copy from `dict`, as if it stood right before the
// output; a match never runs from the dictionary into the output (the 6502 side keeps the dictionary elsewhere).
const MAX_LIT = 512; // longest literal run the parser tries
const MAX_CAND = 48; // match candidates per position (hash chain depth)
const MAX_OFFSET = 0xffff;
const LEN_STEPS = 24; // lengths tried per candidate below its longest (all of them up to this, then only the longest)

const gbits = (v) => 2 * (31 - Math.clz32(v)) + 1;

class BitOut {
  constructor() {
    this.out = [];
    this.bitPos = -1; // index of the current bit byte
    this.nbits = 8;
  }
  bit(b) {
    if (this.nbits === 8) {
      this.bitPos = this.out.length;
      this.out.push(0);
      this.nbits = 0;
    }
    if (b) this.out[this.bitPos] |= 0x80 >> this.nbits;
    this.nbits++;
  }
  gamma(v) {
    const n = 31 - Math.clz32(v);
    for (let k = 0; k < n; k++) this.bit(0);
    for (let k = n; k >= 0; k--) this.bit((v >> k) & 1);
  }
  byte(b) {
    this.out.push(b & 0xff);
  }
}

export function pack(data, dict) {
  const start = dict ? dict.length : 0;
  if (dict) { const d = new Uint8Array(start + data.length); d.set(dict); d.set(data, start); data = d; }
  const n = data.length;
  // Hash chains on 2- and 3-byte prefixes.
  const head2 = new Map();
  const head3 = new Map();
  const prev2 = new Int32Array(n).fill(-1);
  const prev3 = new Int32Array(n).fill(-1);
  for (let i = 0; i + 1 < n; i++) {
    const k2 = data[i] | (data[i + 1] << 8);
    prev2[i] = head2.get(k2) ?? -1;
    head2.set(k2, i);
    if (i + 2 < n) {
      const k3 = k2 | (data[i + 2] << 16);
      prev3[i] = head3.get(k3) ?? -1;
      head3.set(k3, i);
    }
  }
  // (the chains above run backwards from the last position; walk them from i, skipping positions >= i)
  const matchLen = (i, j, max) => {
    if (j < start) max = Math.min(max, start - j); // (no match runs from the dictionary into the output)
    let l = 0;
    while (l < max && data[j + l] === data[i + l]) l++;
    return l;
  };
  // DP: cost[i] = fewest bits for data[0..i); state: the last offset and whether a literal run ended at i.
  const INF = 1e18;
  const cost = new Float64Array(n + 1).fill(INF);
  const kind = new Uint8Array(n + 1); // 1 literal run, 2 repeat, 3 new offset
  const arg = new Int32Array(n + 1); // literal length / match length
  const offAt = new Int32Array(n + 1); // the last offset after the step that ends here
  const litEnd = new Uint8Array(n + 1);
  const from = new Int32Array(n + 1);
  cost[start] = 0;
  offAt[start] = 1;
  const relax = (to, c, k, a, off, lit, fr) => {
    if (c < cost[to]) {
      cost[to] = c;
      kind[to] = k;
      arg[to] = a;
      offAt[to] = off;
      litEnd[to] = lit;
      from[to] = fr;
    }
  };
  // The newest occurrence before i for each prefix: rebuild chains forward instead (simple and exact).
  const last2 = new Map();
  const last3 = new Map();
  const back2 = new Int32Array(n).fill(-1);
  const back3 = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (i + 1 < n) {
      const k2 = data[i] | (data[i + 1] << 8);
      back2[i] = last2.get(k2) ?? -1;
      last2.set(k2, i);
      if (i + 2 < n) {
        const k3 = k2 | (data[i + 2] << 16);
        back3[i] = last3.get(k3) ?? -1;
        last3.set(k3, i);
      }
    }
  }
  void prev2;
  void prev3;
  for (let i = start; i < n; i++) {
    const c0 = cost[i];
    if (c0 >= INF) continue;
    const lit = litEnd[i];
    const lastOff = offAt[i];
    if (!lit) {
      // a literal run from here
      const maxL = Math.min(MAX_LIT, n - i);
      for (let L = 1; L <= maxL; L++) relax(i + L, c0 + 1 + gbits(L) + 8 * L, 1, L, lastOff, 1, i);
    } else if (i - lastOff >= 0) {
      // a repeat match
      const lm = matchLen(i, i - lastOff, n - i);
      for (let l = 1; l <= lm; l++) if (l <= LEN_STEPS || l === lm) relax(i + l, c0 + 1 + gbits(l), 2, l, lastOff, 0, i);
    }
    // matches at new offsets: 3-byte chain, then 2-byte matches close by
    const tried = new Set();
    const tryCand = (j) => {
      const off = i - j;
      if (off <= 0 || off > MAX_OFFSET || tried.has(off)) return;
      tried.add(off);
      const lm = matchLen(i, j, n - i);
      if (lm < 2) return;
      const head = 1 + gbits(((off - 1) >> 8) + 1) + 8;
      for (let l = 2; l <= lm; l++) if (l <= LEN_STEPS || l === lm) relax(i + l, c0 + head + gbits(l - 1), 3, l, off, 0, i);
    };
    let cnt = 0;
    for (let j = back3[i]; j >= 0 && cnt < MAX_CAND; j = back3[j], cnt++) {
      if (i - j > MAX_OFFSET) break;
      tryCand(j);
    }
    cnt = 0;
    for (let j = back2[i]; j >= 0 && cnt < 8 && i - j <= 256; j = back2[j], cnt++) tryCand(j);
  }
  // walk back the best path, then emit it forwards
  const steps = [];
  for (let p = n; p > start; p = from[p]) steps.push(p);
  steps.reverse();
  const bo = new BitOut();
  let prevLit = 0;
  for (const p of steps) {
    const k = kind[p];
    const a = arg[p];
    if (k === 1) {
      bo.bit(0);
      bo.gamma(a);
      const start = p - a;
      for (let q = start; q < p; q++) bo.byte(data[q]);
      prevLit = 1;
    } else if (k === 2) {
      if (!prevLit) throw new Error('lz: repeat match after a match');
      bo.bit(0);
      bo.gamma(a);
      prevLit = 0;
    } else {
      const off = offAt[p];
      bo.bit(1);
      bo.gamma(((off - 1) >> 8) + 1);
      bo.byte((off - 1) & 0xff);
      bo.gamma(a - 1);
      prevLit = 0;
    }
  }
  bo.bit(1); // end: a new offset with high part 256
  bo.gamma(256);
  return Uint8Array.from(bo.out);
}

/** Reference unpacker (mirrors the 6502 routine). With `track`, also returns the in-place gap (see inPlaceGap). */
function run(src, track, dict = []) {
  const out = [...dict];
  const from = (off, len) => {
    const at = out.length - off;
    if (at < 0 || (at < dict.length && at + len > dict.length)) throw new Error('lz: match outside the data');
    for (let k = 0; k < len; k++) put(out[at + k]);
  };
  let p = 0;
  let bits = 0;
  let nb = 0;
  let gap = 1;
  const readByte = () => src[p++];
  const bit = () => {
    if (nb === 0) {
      bits = readByte();
      nb = 8;
    }
    nb--;
    return (bits >> nb) & 1;
  };
  const gamma = () => {
    let z = 0;
    while (!bit()) z++;
    let v = 1;
    for (let k = 0; k < z; k++) v = (v << 1) | bit();
    return v;
  };
  const put = (b) => {
    // writing out[w] must not reach input not read yet: w < start + p, i.e. start >= w - p + 1
    if (track) gap = Math.max(gap, out.length - p + 1);
    out.push(b);
  };
  let off = 1;
  let afterLit = false;
  for (;;) {
    if (!bit()) {
      if (!afterLit) {
        const len = gamma();
        for (let k = 0; k < len; k++) {
          const b = readByte();
          put(b);
        }
        afterLit = true;
        continue;
      }
      from(off, gamma());
      afterLit = false;
      continue;
    }
    const hi = gamma() - 1;
    if (hi === 255) break;
    off = ((hi << 8) | readByte()) + 1;
    from(off, gamma() + 1);
    afterLit = false;
  }
  return track ? gap : Uint8Array.from(out.slice(dict.length));
}

export const unpack = (src, dict) => run(src, false, dict);

/**
 * Unpacking in place: the packed data sits higher up in the same memory and the output grows from below. Returns
 * the smallest distance (input start - output start) at which no output byte overwrites input not read yet.
 */
export const inPlaceGap = (src) => run(src, true);
