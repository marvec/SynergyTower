// Byte-pair text compression for the C64 strings. The font uses codes 32-126 (and UI chars below 32), so
// bytes 128-255 are free: each stands for a pair of symbols, which may be pairs themselves. The C64 expands a
// string with a few lines of recursion (src/text.s expand) and two 128-byte tables.
// Trained on all texts at once; ~38% smaller for English office jokes.

/** texts: arrays of byte values. Returns pairs: [[a, b], ...] for tokens 128.. */
export function trainBpe(texts, maxTokens = 128) {
  let seqs = texts.map((t) => [...t]);
  const pairs = [];
  for (let t = 128; t < 128 + maxTokens; t++) {
    const count = new Map();
    for (const q of seqs) for (let i = 0; i + 1 < q.length; i++) {
      const k = q[i] * 256 + q[i + 1];
      count.set(k, (count.get(k) || 0) + 1);
    }
    let best = -1;
    let bestN = 2; // a pair must occur at least 3 times to pay for its table entry
    for (const [k, n] of count) if (n > bestN) [best, bestN] = [k, n];
    if (best < 0) break;
    const a = best >> 8;
    const b = best & 255;
    pairs.push([a, b]);
    seqs = seqs.map((q) => replace(q, a, b, t));
  }
  return pairs;
}

function replace(q, a, b, t) {
  const out = [];
  for (let i = 0; i < q.length; i++) {
    if (i + 1 < q.length && q[i] === a && q[i + 1] === b) {
      out.push(t);
      i++;
    } else out.push(q[i]);
  }
  return out;
}

/** Encode one text (byte values < 128) with the trained pairs, in training order. */
export function encodeBpe(bytes, pairs) {
  let q = [...bytes];
  if (q.some((c) => c >= 128)) throw new Error('bpe: text already uses bytes >= 128');
  pairs.forEach(([a, b], i) => (q = replace(q, a, b, 128 + i)));
  return q;
}

export function decodeBpe(bytes, pairs) {
  const out = [];
  const emit = (c) => (c >= 128 ? (emit(pairs[c - 128][0]), emit(pairs[c - 128][1])) : out.push(c));
  bytes.forEach(emit);
  return out;
}

/**
 * Rewrites the string literals in an assembler source (`.byte "text", 0` lines) into encoded bytes.
 * `chunks`: a 10 (line break) inside .byte lists ends a chunk (written as 0) - for the far texts, whose
 * paragraphs are expanded one at a time.
 */
export function literals(src) {
  const out = [];
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]);
  return out;
}

export function encodeAsm(src, pairs, { chunks = false } = {}) {
  return src
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\s*(?:[\w@]+:)?\s*)\.byte\s+(.*)$/);
      if (!m || !m[2].includes('"')) return line;
      const [body, comment] = splitComment(m[2]);
      m[3] = comment;
      const items = splitItems(body);
      const flat = [];
      for (const it of items) {
        if (it.startsWith('"')) flat.push({ text: it.slice(1, -1) });
        else flat.push({ expr: it });
      }
      // merge consecutive literal chars; numbers 10 in chunk mode end a paragraph
      const outItems = [];
      let buf = [];
      const flush = () => {
        if (buf.length) outItems.push(...encodeBpe(buf, pairs));
        buf = [];
      };
      for (const it of flat) {
        if (it.text != null) buf.push(...[...it.text].map((c) => c.charCodeAt(0)));
        else if (chunks && it.expr.trim() === '10') {
          flush();
          outItems.push(0);
        } else if (chunks && it.expr.trim() === '0') {
          flush();
          outItems.push(0, 0); // end of the last chunk + an empty chunk: end of the text
        } else {
          flush();
          outItems.push(it.expr);
        }
      }
      flush();
      return `${m[1]}.byte ${outItems.join(', ')}${m[3] || ''}`;
    })
    .join('\n');
}

/** "items ; comment" -> [items, comment] (a ";" inside quotes is text). */
function splitComment(s) {
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') inStr = !inStr;
    if (s[i] === ';' && !inStr) return [s.slice(0, i).trimEnd(), ' ' + s.slice(i)];
  }
  return [s, ''];
}

function splitItems(s) {
  const items = [];
  let cur = '';
  let inStr = false;
  for (const ch of s) {
    if (ch === '"') inStr = !inStr;
    if (ch === ',' && !inStr) {
      items.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) items.push(cur.trim());
  return items;
}
