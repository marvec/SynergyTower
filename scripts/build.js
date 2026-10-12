// Production build: static, offline-capable site in dist/.
import { rm, cp } from 'node:fs/promises';
import { PROD_DEFINE } from './buildConfig.js';

await rm('dist', { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ['./src/index.html', './src/feedback/index.html', './src/c64/index.html'], // the game, /feedback/, /c64/
  outdir: './dist',
  minify: true,
  sourcemap: 'linked',
  define: PROD_DEFINE,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await cp('public', 'dist', { recursive: true });
console.log(`Built ${result.outputs.length} files + public/ into dist/`);
