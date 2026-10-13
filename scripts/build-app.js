// The store apps' web bundle: the game alone (no /c64/, /feedback/ or /how-to-play/ pages, no service worker)
// in mobile/www, which Capacitor copies into the iOS and Android projects (`bun run app:sync`, see mobile/README.md).
// The bundle is the same code as the website: platform differences are decided at runtime (src/engine/platform.js).
import { rm, cp, mkdir } from 'node:fs/promises';
import { PROD_DEFINE } from './buildConfig.js';

const OUT = 'mobile/www';
// public/ files the app needs: icons and the manifest. Not sw.js (the app is its own offline copy), the C64
// download, the guide or the crawler files (links to those open the website).
const PUBLIC = ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const result = await Bun.build({
  entrypoints: ['./src/index.html'],
  outdir: OUT,
  minify: true,
  sourcemap: 'none',
  define: PROD_DEFINE,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
for (const f of PUBLIC) await cp(`public/${f}`, `${OUT}/${f}`);
console.log(`Built ${result.outputs.length} files + ${PUBLIC.length} public files into ${OUT}/`);
