// Hotel set mockups (not game code), in-between style: window.__mockShot_hotel(name).
import { install, mid } from './harness.js';
import { sleep } from './hotel/sleep.js';
import { buffet } from './hotel/buffet.js';
import { swim } from './hotel/swim.js';
import { sunbathe } from './hotel/sunbathe.js';
import { cocktail } from './hotel/cocktail.js';

install('_hotel', {
  'mid-sleep': mid((g, t) => sleep(g, t, false)),
  'mid-sleep-skirt': mid((g, t) => sleep(g, t, true)),
  'mid-buffet': mid((g, t) => buffet(g, t)),
  'mid-swim': mid((g, t) => swim(g, t, false)),
  'mid-swim-skirt': mid((g, t) => swim(g, t, true)),
  'mid-sunbathe': mid((g, t) => sunbathe(g, t, false)),
  'mid-sunbathe-skirt': mid((g, t) => sunbathe(g, t, true)),
  'mid-cocktail': mid((g, t) => cocktail(g, t)),
});
