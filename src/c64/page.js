// synergytower.co.uk/c64: the Commodore 64 version's landing page. Counts downloads and coffee clicks (cookieless,
// production domain only, see analytics.js); the page itself works without JavaScript.
import { initAnalytics, track } from '../engine/analytics.js';

initAnalytics();
for (const a of document.querySelectorAll('[data-track]')) {
  a.addEventListener('click', () => track(a.dataset.track, { at: a.closest('header') ? 'top' : 'body' }));
}
