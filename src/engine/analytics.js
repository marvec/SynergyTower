// Cookieless analytics, only on the production domain (never on localhost or in tests).
// Scripts are injected at runtime because Bun's HTML bundler rewrites tags in index.html.
// Blocked or offline scripts simply don't load; the game never depends on them.
const PROD_HOSTS = ['synergytower.co.uk', 'www.synergytower.co.uk'];
const CLOUDFLARE_TOKEN = 'bb9c0a04c397468f9075eaab8adb5949';

export function initAnalytics() {
  if (typeof document === 'undefined' || !PROD_HOSTS.includes(location.hostname)) return;
  // Cloudflare Web Analytics: page visits only.
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: CLOUDFLARE_TOKEN });
  document.head.appendChild(s);
}
