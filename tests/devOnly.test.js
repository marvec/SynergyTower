// Dev-only console helpers (src/debug.js) must never ship: the production build defines __DEV__ = false.
import { test, expect } from 'bun:test';
import { PROD_DEFINE } from '../scripts/buildConfig.js';

test('the production bundle leaves out the dev-only helpers', async () => {
  const build = (define) => Bun.build({ entrypoints: ['./src/main.js'], minify: true, define });
  const prod = await build(PROD_DEFINE);
  expect(prod.success).toBe(true);
  const code = (await Promise.all(prod.outputs.map((o) => o.text()))).join('\n');
  expect(code).not.toContain('__trip');
  expect(code).not.toContain('business trips leave from');
  // Sanity check: without the define (as on the dev server) the helpers are there.
  const dev = await build({});
  const devCode = (await Promise.all(dev.outputs.map((o) => o.text()))).join('\n');
  expect(devCode).toContain('__trip');
});
