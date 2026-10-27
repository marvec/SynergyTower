// Mockup harness (not game code): bundled with `bun build`, evaluated in the dev server's page.
import { massage } from './massage.js';
import { poolball } from './poolball.js';
import { sandcastle } from './sandcastle.js';
import { dishes } from './dishes.js';
import { smoke } from './cigarette.js';
import { bossAlert } from './bossalert.js';
import { poolball2 } from './poolball2.js';
import { massage2 } from './massage2.js';
import { install, mid } from './harness.js';

const MOCKS = {
  'massage-a': (g, t) => massage(g, t, 'day'),
  'massage-b': (g, t) => massage(g, t, 'candle'),
  poolball: (g, t) => poolball(g, t),
  sandcastle: (g, t) => sandcastle(g, t, 3),
  'sandcastle-done': (g, t) => sandcastle(g, t, 6),
  dishes: (g, t) => dishes(g, t),
  'cigarette-dusk': (g, t) => smoke(g, t, 'dusk'),
  'cigarette-night': (g, t) => smoke(g, t, 'night'),
  bossalert: (g, t) => bossAlert(g, t),
  'mid-poolball-trousers': (g, t) => poolball2(g, t, false),
  'mid-poolball-skirt': (g, t) => poolball2(g, t, true),
  'mid-massage-trousers': (g, t) => massage2(g, t, false),
  'mid-massage-skirt': (g, t) => massage2(g, t, true),
  'mid-sandcastle': mid((g, t) => sandcastle(g, t, 3)),
  'mid-sandcastle-done': mid((g, t) => sandcastle(g, t, 6)),
  'mid-dishes': mid((g, t) => dishes(g, t)),
  'mid-cigarette-dusk': mid((g, t) => smoke(g, t, 'dusk')),
  'mid-cigarette-night': mid((g, t) => smoke(g, t, 'night')),
  'mid-bossalert': mid((g, t) => bossAlert(g, t)),
};

install('', MOCKS);
