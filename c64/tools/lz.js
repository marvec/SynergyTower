// Tiny byte-oriented LZ77 packer; the 6502 unpacker is `lz_unpack` in src/main.s (~70 bytes).
// Stream of tokens, unpacked forwards:
//   $00            end of stream
//   $01-$7F        literal run: that many bytes follow
//   $80-$BF        short match: length (t & $3F) + 3, then 1 byte = distance - 1 (distance 1..256)
//   $C0-$FF        long match:  length (t & $3F) + 4, then 2 bytes = distance (lo, hi)
const SHORT_MIN = 3;
const LONG_MIN = 4;
const MAX_SHORT = 0x3f + SHORT_MIN;
const MAX_LONG = 0x3f + LONG_MIN;

export function pack(data) {
  const out = [];
  let lit = [];
  const flush = () => {
    for (let i = 0; i < lit.length; i += 127) {
      const run = lit.slice(i, i + 127);
      out.push(run.length, ...run);
    }
    lit = [];
  };
  // Hash chains on 3-byte prefixes keep this fast enough for 16 KB inputs.
  const head = new Map();
  const prev = new Int32Array(data.length).fill(-1);
  const key = (i) => data[i] | (data[i + 1] << 8) | (data[i + 2] << 16);
  const insert = (i) => {
    if (i + 2 >= data.length) return;
    const k = key(i);
    prev[i] = head.has(k) ? head.get(k) : -1;
    head.set(k, i);
  };
  let i = 0;
  while (i < data.length) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + 2 < data.length) {
      for (let j = head.has(key(i)) ? head.get(key(i)) : -1, n = 0; j >= 0 && n < 256; j = prev[j], n++) {
        const dist = i - j;
        if (dist > 0xffff) break;
        let len = 0;
        const max = Math.min(MAX_LONG, data.length - i);
        while (len < max && data[j + len] === data[i + len]) len++;
        // Prefer the cheaper short form when it is as good.
        const gain = dist <= 256 ? Math.min(len, MAX_SHORT) - 2 : len - 3;
        const bestGain = bestLen ? (bestDist <= 256 ? Math.min(bestLen, MAX_SHORT) - 2 : bestLen - 3) : 0;
        if (gain > bestGain) {
          bestLen = dist <= 256 ? Math.min(len, MAX_SHORT) : len;
          bestDist = dist;
        }
      }
    }
    const short = bestDist <= 256 && bestLen >= SHORT_MIN;
    const long = bestDist > 256 && bestLen >= LONG_MIN;
    if (short || long) {
      flush();
      if (short) out.push(0x80 | (bestLen - SHORT_MIN), bestDist - 1);
      else out.push(0xc0 | (bestLen - LONG_MIN), bestDist & 0xff, bestDist >> 8);
      for (let k = 0; k < bestLen; k++) insert(i + k);
      i += bestLen;
    } else {
      lit.push(data[i]);
      insert(i);
      i++;
    }
  }
  flush();
  out.push(0);
  return Uint8Array.from(out);
}

/** Reference unpacker (mirrors the 6502 routine); the build uses it to self-check every packed file. */
export function unpack(src) {
  const out = [];
  let p = 0;
  for (;;) {
    const t = src[p++];
    if (t === 0) return Uint8Array.from(out);
    if (t < 0x80) {
      for (let k = 0; k < t; k++) out.push(src[p++]);
    } else {
      const long = t >= 0xc0;
      const len = (t & 0x3f) + (long ? LONG_MIN : SHORT_MIN);
      const dist = long ? src[p] | (src[p + 1] << 8) : src[p] + 1;
      p += long ? 2 : 1;
      for (let k = 0; k < len; k++) out.push(out[out.length - dist]);
    }
  }
}

/**
 * Unpacking in place: the packed data sits higher up in the same memory and the output grows from below. Returns
 * the smallest distance (input start - output start) at which no output byte overwrites input not read yet.
 */
export function inPlaceGap(src) {
  let gap = 1;
  let w = 0;
  let p = 0;
  for (;;) {
    const t = src[p++];
    if (t === 0) return gap;
    if (t < 0x80) {
      for (let k = 0; k < t; k++) {
        p++; // this literal is read, then written at w
        gap = Math.max(gap, w - p + 1);
        w++;
      }
    } else {
      const long = t >= 0xc0;
      const len = (t & 0x3f) + (long ? LONG_MIN : SHORT_MIN);
      p += long ? 2 : 1;
      for (let k = 0; k < len; k++) {
        gap = Math.max(gap, w - p + 1);
        w++;
      }
    }
  }
}
