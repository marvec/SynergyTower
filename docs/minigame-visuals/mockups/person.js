// The Elevator Pitch figure (pitch.js person(), 12x30 cells, flat colours), extended for the mockups: a skirt, a tie,
// arms raised, a back view, swimwear. Not game code; the pitch figure itself is unchanged.
import { cells } from './kit.js';

/**
 * look: { skin, hair, top, pants, skirt?, tie?, lapel?, shoes?, long? (hair), suit? }
 * opts: { pose: 'stand' | 'armsUp' | 'walkA' | 'walkB', view: 'front' | 'back', swim: 'shorts' | 'suit' }
 */
export function person(g, x, y, s, look, opts = {}) {
  const r = cells(g, x, y, s);
  const { pose = 'stand', view = 'front', swim = null } = opts;
  const top = swim === 'shorts' ? look.skin : look.top;
  // Legs (or a skirt over them), shoes.
  const stepA = pose === 'walkA';
  const stepB = pose === 'walkB';
  if (look.skirt && !swim) {
    r(2, 19, 8, 5, look.skirt);
    r(1, 22, 10, 2, look.skirt);
    r(3, 24, 2, 5 - (stepA ? 1 : 0), look.skin);
    r(7, 24, 2, 5 - (stepB ? 1 : 0), look.skin);
  } else {
    r(3, 21, 2, 8 - (stepA ? 1 : 0), swim ? look.skin : look.pants);
    r(7, 21, 2, 8 - (stepB ? 1 : 0), swim ? look.skin : look.pants);
    if (swim === 'shorts') r(2, 19, 8, 4, look.trunks);
  }
  if (!swim) {
    r(2, 29 - (stepA ? 1 : 0), 3, 1, look.shoes || '#15161c');
    r(7, 29 - (stepB ? 1 : 0), 3, 1, look.shoes || '#15161c');
  }
  // Body and arms.
  r(2, 10, 8, 11, top);
  if (swim === 'suit') r(2, 12, 8, 9, look.suit), r(3, 10, 1, 2, look.suit), r(8, 10, 1, 2, look.suit);
  if (swim === 'shorts') r(2, 19, 8, 3, look.trunks);
  if (pose === 'armsUp') {
    // Raised above the head, hands open at the top.
    r(0, -4, 2, 15, swim ? look.skin : look.top);
    r(10, -4, 2, 15, swim ? look.skin : look.top);
    r(-1, -7, 3, 3, look.skin);
    r(10, -7, 3, 3, look.skin);
  } else {
    const swing = stepA ? 1 : stepB ? -1 : 0;
    r(0, 11 + swing, 2, 9, swim ? look.skin : top);
    r(10, 11 - swing, 2, 9, swim ? look.skin : top);
    r(0, 20 + swing, 2, 1, look.skin);
    r(10, 20 - swing, 2, 1, look.skin);
  }
  if (view === 'front' && !swim) {
    if (look.lapel) {
      r(3, 10, 1, 7, look.lapel);
      r(8, 10, 1, 7, look.lapel);
    }
    r(4, 10, 4, 1, look.collar || '#f4f1e8');
    if (look.tie) {
      r(5, 10, 2, 1, look.tie);
      r(5, 11, 2, 6, look.tie);
    }
  }
  // Head.
  r(5, 9, 2, 1, look.skin);
  r(2, 1, 8, 8, look.skin);
  r(1, 4, 1, 2, look.skin);
  r(10, 4, 1, 2, look.skin);
  if (view === 'back') {
    r(2, 0, 8, 7, look.hair);
    if (look.long) r(2, 7, 8, 4, look.hair);
    return;
  }
  r(2, 0, 8, 2, look.hair);
  r(2, 2, 1, 2, look.hair);
  r(9, 2, 1, 2, look.hair);
  if (look.long) {
    r(1, 2, 1, 8, look.hair);
    r(10, 2, 1, 8, look.hair);
  }
  if (look.glasses) {
    r(3, 4, 2, 1, '#15161c');
    r(7, 4, 2, 1, '#15161c');
    r(5, 4, 2, 1, '#15161c');
  } else {
    r(4, 4, 1, 1, '#222');
    r(7, 4, 1, 1, '#222');
  }
  r(5, 6, 2, 1, '#7a3b3b');
}
