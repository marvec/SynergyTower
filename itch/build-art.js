// Makes the itch.io page art (itch/assets/cover.png, banner.png) from the game's own drawing code.
// Run `bun itch/build-art.js`, open the printed URL in any browser; the page draws the art and the server saves it.
// The art is drawn in a browser because it needs a canvas (the game has no npm dependencies, so no headless canvas).
import { mkdir, writeFile } from 'node:fs/promises';
import { PROD_DEFINE } from '../scripts/buildConfig.js';

const PORT = 5318;
const OUT = new URL('./assets/', import.meta.url);
await mkdir(OUT, { recursive: true });
const built = await Bun.build({ entrypoints: [new URL('./art-page.js', import.meta.url).pathname], define: PROD_DEFINE });
if (!built.success) {
  for (const log of built.logs) console.error(log);
  process.exit(1);
}
const js = await built.outputs[0].text();
const html = `<!doctype html><meta charset="utf-8"><title>itch art</title>
<style>body{background:#222;color:#ddd;font:14px sans-serif}canvas{display:block;margin:12px 0}</style>
<p id="status">Drawing...</p><script type="module">${js}</script>`;

let saved = 0;
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/save\/([a-z-]+\.png)$/);
    if (req.method === 'POST' && m) {
      await writeFile(new URL(m[1], OUT), new Uint8Array(await req.arrayBuffer()));
      console.log(`Saved itch/assets/${m[1]}`);
      if (++saved === 2) setTimeout(() => server.stop(true), 200);
      return new Response('ok');
    }
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  },
});
console.log(`Open http://localhost:${PORT}/ to draw and save the art.`);
