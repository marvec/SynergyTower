// Mockup entry for the Christmas party games (in-between style): window.__mockShot_party(name, t).
import { install, mid } from './harness.js';
import { giftwrap } from './party/giftwrap.js';
import { photobooth } from './party/photobooth.js';
import { dance } from './party/dance.js';
import { carols } from './party/carols.js';

install('_party', {
  'mid-giftwrap': mid((g, t) => giftwrap(g, t)),
  'mid-photobooth': mid((g, t) => photobooth(g, t, false)),
  'mid-photobooth-skirt': mid((g, t) => photobooth(g, t, true)),
  'mid-dance': mid((g, t) => dance(g, t, false)),
  'mid-dance-skirt': mid((g, t) => dance(g, t, true)),
  'mid-carols': mid((g, t) => carols(g, t, false)),
});
