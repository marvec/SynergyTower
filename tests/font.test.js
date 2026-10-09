import { test, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hasGlyph } from '../src/engine/font.js';

test('font covers all printable ASCII', () => {
  const missing = [];
  for (let c = 32; c < 127; c++) if (!hasGlyph(String.fromCharCode(c))) missing.push(String.fromCharCode(c));
  expect(missing.join('')).toBe('');
});

test('every non-ASCII character in string literals has a glyph', () => {
  const missing = new Set();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.endsWith('font.js')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/'([^'\n\\]|\\.)*'|`[^`]*`|"([^"\n\\]|\\.)*"/g))
          for (const ch of m[0]) if (ch.charCodeAt(0) > 126 && !hasGlyph(ch)) missing.add(`${ch} (${p})`);
      }
    }
  };
  walk('src');
  expect([...missing]).toEqual([]);
});
