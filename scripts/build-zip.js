// A downloadable, locally playable build: dist-zip/synergy-tower-web.zip with the game in one index.html.
// Unzip and open index.html (double-click, file://), or upload the ZIP to itch.io as an HTML5 game (index.html at the
// root). Browsers refuse to load a module script file from file://, so the bundle and its CSS are inlined into the page.
// No service worker, guide, C64 or feedback pages: links to those open the website (openExternal in platform.js).
import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { PROD_DEFINE } from './buildConfig.js';

const TMP = 'dist-zip/.bundle';
const DIR = 'dist-zip/synergy-tower';
const ZIP = 'dist-zip/synergy-tower-web.zip';
// public/ files the page links at runtime (src/main.js injects the manifest and the favicon).
const PUBLIC = ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest'];

await rm('dist-zip', { recursive: true, force: true });
await mkdir(DIR, { recursive: true });
const result = await Bun.build({ entrypoints: ['./src/index.html'], outdir: TMP, minify: true, sourcemap: 'none', define: PROD_DEFINE });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Text inside <script> must not close the element or open an HTML comment.
const safeJs = (s) => s.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--');
let html = await readFile(`${TMP}/index.html`, 'utf8');
const js = html.match(/<script type="module"[^>]*src="\.\/([^"]+\.js)"[^>]*><\/script>/);
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+\.css)"[^>]*>/);
if (!js || !css) throw new Error('index.html: no bundled script or stylesheet tag found');
const jsText = safeJs(await readFile(`${TMP}/${js[1]}`, 'utf8'));
const cssText = await readFile(`${TMP}/${css[1]}`, 'utf8');
// Functions as replacements, so `$&` and friends in the bundle are not read as patterns.
html = html.replace(js[0], () => `<script type="module">${jsText}</script>`);
html = html.replace(css[0], () => `<style>${cssText}</style>`);
if (/src="\.\/[^"]+\.js"/.test(html)) throw new Error('index.html still loads a script file: inline it too');
await writeFile(`${DIR}/index.html`, html);
for (const f of PUBLIC) await cp(`public/${f}`, `${DIR}/${f}`);
await rm(TMP, { recursive: true, force: true });

const zip = Bun.spawnSync(['zip', '-qr9', '../synergy-tower-web.zip', '.'], { cwd: DIR });
if (zip.exitCode !== 0) throw new Error(`zip failed: ${zip.stderr}`);
const kb = Math.round(Bun.file(ZIP).size / 1024);
console.log(`Built ${DIR}/ (open index.html) and ${ZIP} (${kb} KB)`);
