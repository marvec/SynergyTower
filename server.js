// Dev server: bundles src/index.html on the fly (hot reload) and serves public/ files.
import homepage from './src/index.html';

const PORT = Number(process.env.PORT || 3000);

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: {
    '/': homepage,
  },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(`./public${pathname}`);
    if (pathname !== '/' && !pathname.includes('..') && (await file.exists())) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`SynergyTower dev server: ${server.url}`);
