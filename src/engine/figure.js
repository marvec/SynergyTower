// The Elevator Pitch figure (12x30 cells, flat colours, a big head), shared by the mini-games. Poses, a skirt, swimwear,
// a back view and a Santa hat were added for the in-between style (docs/minigame-visuals/mockups/person.js, party/common.js).
import { C } from './ui.js';
import { cells, shade } from './mgart.js';

const EYE = '#222';
const MOUTH = '#7a3b3b';

/**
 * 12x30 pixel person at scale s.
 * look: { skin, hair, top, pants, skirt?, tie?, lapel?, collar?, long? (hair), hat?: 'santa', shoes?, ceo?, brow?, corp?, bib? }
 *   `corp` is the swimwear colour; `ceo` is the pitch CEO; `bib` is the pitch employee's red tabs and white bib (no collar or tie).
 * opts: { pose: stand | walkA | walkB | armsUp | waveL | waveR | crouch | danceA | danceB, view: front | back,
 *   swim: null | trunks | suit, expr: neutral | interested | delighted | bored | annoyed | talk | nervous | smile | sing | sleep }.
 * A string as the 6th argument is the expression (pitch.js calls it that way).
 */
export function person(g, x, y, s, look, opts = {}) {
  if (typeof opts === 'string') opts = { expr: opts };
  const { pose = 'stand', view = 'front', swim = null, expr = 'neutral' } = opts;
  const r = cells(g, x, y, s);
  const crouch = pose === 'crouch';
  const dy = crouch ? 4 : 0; // the upper body drops, the knees bend
  const stepA = pose === 'walkA';
  const stepB = pose === 'walkB';
  const shortA = stepA ? 1 : pose === 'danceA' ? 2 : 0; // the raised foot
  const shortB = stepB ? 1 : pose === 'danceB' ? 2 : 0;
  const swing = stepA ? 1 : stepB ? -1 : 0;
  const corp = look.corp || look.top; // swimwear colour (looks not built by figureLook have none)
  const body = swim === 'trunks' ? look.skin : swim === 'suit' ? corp : look.top;
  const sleeve = swim ? look.skin : look.top;
  const shoes = look.shoes || '#15161c';

  // Legs, shoes.
  if (swim) {
    r(3, 21, 2, 8, look.skin);
    r(7, 21, 2, 8, look.skin);
  } else if (look.skirt) {
    r(3, 24, 2, 5 - shortA, look.skin);
    r(7, 24, 2, 5 - shortB, look.skin);
  } else if (crouch) {
    r(2, 21 + dy, 2, 8 - dy, look.pants);
    r(8, 21 + dy, 2, 8 - dy, look.pants);
  } else {
    r(3, 21, 2, 8 - shortA, look.pants);
    r(7, 21, 2, 8 - shortB, look.pants);
  }
  if (!swim) {
    r(crouch ? 1 : 2, 29 - shortA, 3, 1, shoes);
    r(crouch ? 8 : 7, 29 - shortB, 3, 1, shoes);
  }

  // Body, then the skirt over it, or the swim trunks.
  r(2, 10 + dy, 8, 11 - (crouch ? 2 : 0), body);
  if (swim === 'trunks') r(2, 19, 8, 4, corp);
  else if (look.skirt && !swim) {
    r(2, 19 + (crouch ? 2 : 0), 8, 5 - (crouch ? 2 : 0), look.skirt);
    r(1, 22, 10, 2, look.skirt);
  }

  // Arms by pose.
  const up = (c) => {
    r(c, -4 + dy, 2, 15, sleeve);
    r(c - (c === 0 ? 1 : 0), -7 + dy, 3, 3, look.skin);
  };
  const down = (c, sw) => {
    r(c, 11 + dy + sw, 2, 9, sleeve);
    r(c, 20 + dy + sw, 2, 1, look.skin);
  };
  const out = (left) => {
    const c = left ? -5 : 10;
    r(c, 11 + dy, 7, 2, sleeve);
    r(left ? c - 1 : c + 7, 10 + dy, 2, 3, look.skin);
  };
  if (pose === 'armsUp') up(0), up(10);
  else if (pose === 'waveL') up(0), down(10, 0);
  else if (pose === 'waveR') down(0, 0), up(10);
  else if (pose === 'danceA') up(0), out(false);
  else if (pose === 'danceB') out(true), up(10);
  else down(0, swing), down(10, -swing);

  // The outfit: the CEO's suit, the pitch employee's bib, or collar, lapels and tie.
  if (view === 'front' && !swim) {
    if (look.ceo) {
      r(3, 10, 1, 7, look.lapel);
      r(8, 10, 1, 7, look.lapel);
      r(4, 10, 4, 1, '#f4f1e8');
      r(5, 10, 2, 1, '#8e1f1a');
      r(5, 11, 2, 6, '#c0392b');
      r(10, 19, 2, 1, '#f2c14e'); // gold watch
    } else if (look.bib) {
      r(4, 10, 1, 4, '#e2504a');
      r(7, 10, 1, 4, '#e2504a');
      r(4, 14, 4, 3, '#f4f1e8');
      r(5, 15, 2, 1, C.accent);
    } else {
      if (look.lapel) {
        r(3, 10 + dy, 1, 7, look.lapel);
        r(8, 10 + dy, 1, 7, look.lapel);
      }
      r(4, 10 + dy, 4, 1, look.collar || '#f4f1e8');
      if (look.tie) r(5, 10 + dy, 2, 7, look.tie);
    }
  }

  // Head.
  r(5, 9 + dy, 2, 1, look.skin);
  r(2, 1 + dy, 8, 8, look.skin);
  r(1, 4 + dy, 1, 2, look.skin);
  r(10, 4 + dy, 1, 2, look.skin);
  if (view === 'back') {
    r(2, dy, 8, 7, look.hair);
    if (look.long) r(2, 7 + dy, 8, 4, look.hair);
  } else {
    if (look.ceo) {
      r(2, 1, 1, 4, look.hair);
      r(9, 1, 1, 4, look.hair);
      r(3, 1, 6, 1, '#f8dcc0');
    } else {
      r(2, dy, 8, 2, look.hair);
      r(2, 2 + dy, 1, 2, look.hair);
      r(9, 2 + dy, 1, 2, look.hair);
      if (look.long) {
        r(1, 2 + dy, 1, 8, look.hair);
        r(10, 2 + dy, 1, 8, look.hair);
      }
    }
    face(r, look, expr, dy);
  }
  if (look.hat === 'santa') santaHat(g, x, y + dy * s, s);
}

/** Eyes and mouth by expression, `dy` cells down. */
function face(r, look, expr, dy) {
  const f = (cx, cy, w, h, col) => r(cx, cy + dy, w, h, col);
  switch (expr) {
    case 'interested':
      f(4, 2, 1, 1, look.brow);
      f(7, 2, 1, 1, look.brow);
      f(4, 4, 1, 2, EYE);
      f(7, 4, 1, 2, EYE);
      f(5, 6, 2, 2, MOUTH);
      break;
    case 'delighted':
      f(3, 4, 1, 1, EYE);
      f(4, 3, 1, 1, EYE);
      f(5, 4, 1, 1, EYE);
      f(6, 4, 1, 1, EYE);
      f(7, 3, 1, 1, EYE);
      f(8, 4, 1, 1, EYE);
      f(3, 5, 1, 1, MOUTH);
      f(8, 5, 1, 1, MOUTH);
      f(4, 6, 4, 1, MOUTH);
      f(5, 7, 2, 1, '#c0392b');
      f(2, 6, 1, 1, '#f09090');
      f(9, 6, 1, 1, '#f09090');
      break;
    case 'bored':
      f(3, 4, 2, 1, EYE);
      f(6, 4, 2, 1, EYE);
      f(3, 3, 2, 1, '#d9a273');
      f(6, 3, 2, 1, '#d9a273');
      f(6, 7, 2, 1, MOUTH);
      break;
    case 'annoyed':
      f(3, 2, 1, 1, EYE);
      f(4, 3, 1, 1, EYE);
      f(8, 2, 1, 1, EYE);
      f(7, 3, 1, 1, EYE);
      f(4, 4, 1, 1, EYE);
      f(7, 4, 1, 1, EYE);
      f(5, 6, 2, 1, MOUTH);
      f(4, 7, 1, 1, MOUTH);
      f(7, 7, 1, 1, MOUTH);
      f(2, 5, 1, 2, '#e07070');
      f(9, 5, 1, 2, '#e07070');
      break;
    case 'talk':
    case 'sing':
      f(4, 4, 1, 1, EYE);
      f(7, 4, 1, 1, EYE);
      f(5, 6, 2, 2, '#3a1a1a');
      break;
    case 'nervous':
      f(4, 4, 1, 1, EYE);
      f(7, 4, 1, 1, EYE);
      f(4, 6, 4, 1, MOUTH);
      f(9, 2, 1, 2, '#8ad0ff');
      break;
    case 'smile':
      f(4, 4, 1, 1, EYE);
      f(7, 4, 1, 1, EYE);
      f(4, 6, 4, 1, MOUTH);
      f(4, 5, 1, 1, MOUTH);
      f(7, 5, 1, 1, MOUTH);
      break;
    case 'sleep':
      f(3, 4, 2, 1, EYE);
      f(7, 4, 2, 1, EYE);
      f(5, 6, 2, 1, MOUTH);
      break;
    default:
      f(4, 4, 1, 1, EYE);
      f(7, 4, 1, 1, EYE);
      f(5, 6, 2, 1, MOUTH);
  }
}

/** A Santa hat over a figure's head (cells of the figure at x, y, scale s): red cap, white trim and bobble. */
function santaHat(g, x, y, s) {
  const r = cells(g, x, y, s);
  r(2, -1, 8, 2, '#d8343a');
  r(3, -2, 6, 1, '#d8343a');
  r(5, -3, 4, 1, '#d8343a');
  r(8, -2, 3, 1, '#b8282e');
  r(10, -1, 1, 1, '#b8282e');
  r(10, 0, 2, 2, '#f4f1e8');
  r(1, 1, 10, 2, '#f4f1e8');
  r(4, -1, 2, 1, '#e85a5e');
}

/** A figure look for the career's look (game.playerLook()) and its corporate colour. */
export function figureLook(look, corp) {
  const D = DEFAULT_PLAYER;
  const hair = look.hair || D.hair;
  return {
    skin: look.skin || D.skin,
    hair,
    top: look.jacket || look.shirt || D.top,
    pants: look.pants || D.pants,
    skirt: look.skirt || null,
    tie: look.tie || null,
    lapel: look.jacket ? look.shirt || null : null,
    collar: look.shirt || D.collar,
    long: !!look.skirt || look.hairStyle === 2,
    brow: shade(hair, -0.2),
    corp: corp || D.corp,
  };
}

/** Whoever plays when no career is loaded (tests, __mg on the title). */
export const DEFAULT_PLAYER = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: null, tie: null, lapel: null, collar: '#dfe6ee', long: false, brow: '#3a2414', corp: '#1f70c1' };
