// Cookieless analytics, only on the production domain and in the store apps (never on localhost or in tests).
// Cloudflare Web Analytics counts website visits; Umami counts visits plus the gameplay events sent with track().
// The app (served from localhost inside the WebView) uses Umami only, tagged 'app-ios' / 'app-android'.
// Scripts are injected at runtime because Bun's HTML bundler rewrites tags in index.html.
// Blocked or offline scripts simply don't load; the game never depends on them.
import { isNative, os } from './platform.js';

const PROD_HOSTS = ['synergytower.co.uk', 'www.synergytower.co.uk'];
const CLOUDFLARE_TOKEN = 'bb9c0a04c397468f9075eaab8adb5949';
const UMAMI_WEBSITE_ID = 'e79b8d17-4ef7-490a-b045-c05900f45107';

let enabled = false;
const queue = []; // events sent before the Umami script has loaded

function addScript(src, attrs, onload) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = src;
  Object.assign(s.dataset, attrs);
  if (onload) s.onload = onload;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (typeof document === 'undefined') return;
  const app = isNative();
  if (!app && !PROD_HOSTS.includes(location.hostname)) return;
  enabled = true;
  if (!app) addScript('https://static.cloudflareinsights.com/beacon.min.js', { cfBeacon: JSON.stringify({ token: CLOUDFLARE_TOKEN }) });
  addScript('https://cloud.umami.is/script.js', { websiteId: UMAMI_WEBSITE_ID, ...(app && { tag: `app-${os()}` }) }, () => {
    for (const [name, data] of queue.splice(0)) window.umami?.track(name, data);
  });
}

/** Records a gameplay event, e.g. track('task_played', { game: 'inbox', stars: 2 }). A no-op outside production. */
export function track(name, data) {
  if (!enabled) return;
  try {
    if (window.umami) window.umami.track(name, data);
    else if (queue.length < 50) queue.push([name, data]);
  } catch {
    // analytics must never break the game
  }
}
