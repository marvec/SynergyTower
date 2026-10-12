// Dev server: bundles src/index.html on the fly (hot reload) and serves public/ files.
import homepage from './src/index.html';
import feedbackPage from './src/feedback/index.html';
import c64Page from './src/c64/index.html';

const PORT = Number(process.env.PORT || 5317);

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: {
    '/': homepage,
    '/feedback': feedbackPage,
    '/feedback/': feedbackPage,
    '/c64': c64Page,
    '/c64/': c64Page,
  },
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const file = Bun.file(`./public${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`); // folders serve index.html, like GitHub Pages
    if (pathname !== '/' && !pathname.includes('..') && (await file.exists())) return new Response(file);
    return new Response('Not found', { status: 404 });
  },
});

console.log(`SynergyTower dev server: ${server.url}`);
