// Serves the production build from dist/ (service worker active here, not on the dev server).
const PORT = Number(process.env.PORT || 4173);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    let { pathname } = new URL(req.url);
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (pathname.includes('..')) return new Response('Bad request', { status: 400 });
    const file = Bun.file(`./dist${pathname}`);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file('./dist/index.html'));
  },
});

console.log(`SynergyTower preview (dist/): ${server.url}`);
