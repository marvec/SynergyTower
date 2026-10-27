// Christmas party mockups, shared bits: the Elevator Pitch figure with party poses and a Santa hat, the player's look by
// the trousers/skirt choice, string lights, a disco ball, a tree, chunky arrows. Not game code.
import { rect } from '../../../../src/engine/mgkit.js';
import { cells, cblob } from '../kit.js';

export const CORP = '#2f8f7f'; // the career's corporate colour

/** The player at the party: shirt and trousers with a corporate tie, or a corporate-colour skirt and long hair. */
export const playerLook = (skirt) =>
  skirt
    ? { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', skirt: CORP, long: true, hat: 'santa' }
    : { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55', tie: CORP, hat: 'santa' };

/** A few colleagues (pitch-figure looks), some in Santa hats. */
export const GUESTS = [
  { skin: '#d9a273', hair: '#2b1d14', top: '#b63b3b', pants: '#2b2e38', hat: 'santa' },
  { skin: '#a86b42', hair: '#1a1a1a', top: '#e8d8d8', pants: '#3a3f55', skirt: '#2f6f5f', long: true, hat: 'santa' },
  { skin: '#f2c9a0', hair: '#d9b25c', top: '#3b6fb6', pants: '#22242e', tie: '#c9a227' },
  { skin: '#6b4228', hair: '#1a1a1a', top: '#2f8a3a', pants: '#2b2e38', skirt: '#7a3b4a', long: true, hat: 'santa' },
  { skin: '#f2c9a0', hair: '#a33b20', top: '#7a3bb6', pants: '#3a3f55', hat: 'santa' },
  { skin: '#d9a273', hair: '#c8c8c8', top: '#22242e', pants: '#22242e', tie: '#c0392b', lapel: '#f4f1e8' },
];

/**
 * The pitch figure (12x30 cells at scale s, flat colours) with party poses:
 * stand | armsUp | waveL | waveR | crouch | danceA | danceB. expr: 'smile' | 'sing' | 'neutral'.
 */
export function figure(g, x, y, s, look, pose = 'stand', expr = 'smile') {
  const r = cells(g, x, y, s);
  const dy = pose === 'crouch' ? 4 : 0; // the upper body drops, the knees bend
  const up = (side) => {
    const c = side < 0 ? 0 : 10;
    r(c, -4 + dy, 2, 15, look.top);
    r(c + (side < 0 ? -1 : 0), -7 + dy, 3, 3, look.skin);
  };
  const down = (side) => {
    const c = side < 0 ? 0 : 10;
    r(c, 11 + dy, 2, 9, look.top);
    r(c, 20 + dy, 2, 1, look.skin);
  };
  const out = (side) => {
    const c = side < 0 ? -5 : 10;
    r(c, 11 + dy, 7, 2, look.top);
    r(side < 0 ? c - 1 : c + 7, 10 + dy, 2, 3, look.skin);
  };
  // Legs (or a skirt over them), shoes.
  const bendA = pose === 'danceA';
  const bendB = pose === 'danceB';
  if (look.skirt) {
    r(3, 24, 2, 5 - (bendA ? 2 : 0), look.skin);
    r(7, 24, 2, 5 - (bendB ? 2 : 0), look.skin);
  } else if (pose === 'crouch') {
    r(2, 21 + dy, 2, 8 - dy, look.pants);
    r(8, 21 + dy, 2, 8 - dy, look.pants);
  } else {
    r(3, 21, 2, 8 - (bendA ? 2 : 0), look.pants);
    r(7, 21, 2, 8 - (bendB ? 2 : 0), look.pants);
  }
  r(pose === 'crouch' ? 1 : 2, 29 - (bendA ? 2 : 0), 3, 1, '#15161c');
  r(pose === 'crouch' ? 8 : 7, 29 - (bendB ? 2 : 0), 3, 1, '#15161c');
  // Body.
  r(2, 10 + dy, 8, 11 - (pose === 'crouch' ? 2 : 0), look.top);
  if (look.skirt) {
    r(2, 19 + (pose === 'crouch' ? 2 : 0), 8, 5 - (pose === 'crouch' ? 2 : 0), look.skirt);
    r(1, 22, 10, 2, look.skirt);
  }
  if (look.lapel) {
    r(3, 10 + dy, 1, 7, look.lapel);
    r(8, 10 + dy, 1, 7, look.lapel);
  }
  r(4, 10 + dy, 4, 1, '#f4f1e8');
  if (look.tie) r(5, 10 + dy, 2, 7, look.tie);
  // Arms by pose.
  if (pose === 'armsUp') up(-1), up(1);
  else if (pose === 'waveL') up(-1), down(1);
  else if (pose === 'waveR') down(-1), up(1);
  else if (pose === 'danceA') up(-1), out(1);
  else if (pose === 'danceB') out(-1), up(1);
  else down(-1), down(1);
  // Head.
  const hy = dy;
  r(5, 9 + hy, 2, 1, look.skin);
  r(2, 1 + hy, 8, 8, look.skin);
  r(1, 4 + hy, 1, 2, look.skin);
  r(10, 4 + hy, 1, 2, look.skin);
  r(2, 0 + hy, 8, 2, look.hair);
  r(2, 2 + hy, 1, 2, look.hair);
  r(9, 2 + hy, 1, 2, look.hair);
  if (look.long) r(1, 2 + hy, 1, 8, look.hair), r(10, 2 + hy, 1, 8, look.hair);
  r(4, 4 + hy, 1, 1, '#222');
  r(7, 4 + hy, 1, 1, '#222');
  if (expr === 'sing') r(5, 6 + hy, 2, 2, '#3a1a1a');
  else if (expr === 'smile') r(4, 6 + hy, 4, 1, '#7a3b3b'), r(4, 5 + hy, 1, 1, '#7a3b3b'), r(7, 5 + hy, 1, 1, '#7a3b3b');
  else r(5, 6 + hy, 2, 1, '#7a3b3b');
  if (look.hat === 'santa') santaHat(g, x, y + hy * s, s);
}

/** A Santa hat over a pitch figure's head (cells of the figure at x, y, scale s): red cap, white trim, a pompom. */
export function santaHat(g, x, y, s) {
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

/** A garland of coloured bulbs on a wire across the top, every other one lit by turns. */
export function stringLights(g, y, t, x0 = 0, x1 = 480) {
  const cols = ['#e2504a', '#f2c14e', '#5fd068', '#5b8def', '#f29cd0'];
  for (let x = x0; x < x1; x += 2) rect(g, x, y + Math.round(Math.sin((x - x0) / 76 * Math.PI) * 6), 2, 2, '#1a3a1a');
  for (let x = x0 + 10, i = 0; x < x1; x += 20, i++) {
    const yy = y + Math.round(Math.sin((x - x0) / 76 * Math.PI) * 6) + 2;
    const on = (i + Math.floor(t * 2)) % 2 === 0;
    const c = cols[i % cols.length];
    if (on) {
      g.save();
      g.globalAlpha = 0.25;
      cblob(g, x + 2, yy + 3, 6, 6, c);
      g.restore();
    }
    rect(g, x, yy, 4, 4, on ? c : '#4a4050');
    rect(g, x + 1, yy - 2, 2, 2, '#8a8a8a');
  }
}

/** The disco ball on its string, checker of mirror tiles, a few sparkles. */
export function discoBall(g, x, y, t, r = 12) {
  rect(g, x - 1, 18, 2, y - r - 18, '#8a8a9a');
  for (let dy = -r; dy < r; dy += 4)
    for (let dx = -r; dx < r; dx += 4) {
      const cx = dx + 2;
      const cy = dy + 2;
      if (cx * cx + cy * cy > r * r) continue;
      const k = (Math.floor(dx / 4) + Math.floor(dy / 4) + Math.floor(t * 4)) & 3;
      const light = cx + cy < -4;
      rect(g, x + dx, y + dy, 4, 4, light ? ['#ffffff', '#c8d4e8', '#e8eef8', '#a8b4cc'][k] : ['#8a94ac', '#c8d4e8', '#6a7490', '#a8b4cc'][k]);
      rect(g, x + dx, y + dy, 4, 1, '#5a6480');
    }
  for (const [dx, dy] of [[-r - 6, -4], [r + 4, 6], [-4, r + 6]]) {
    if (Math.floor(t * 3 + dx) % 2) continue;
    rect(g, x + dx, y + dy - 2, 2, 6, '#ffffff');
    rect(g, x + dx - 2, y + dy, 6, 2, '#ffffff');
  }
}

/** A Christmas tree: stacked tiers in 2 px steps, baubles, a star; trunk in a red pot. */
export function tree(g, x, base, h = 90, t = 0) {
  rect(g, x - 8, base - 12, 16, 12, '#b8282e');
  rect(g, x - 8, base - 12, 16, 2, '#e2504a');
  rect(g, x - 3, base - 18, 6, 6, '#6b4a22');
  const tiers = 3;
  const th = Math.floor((h - 24) / tiers / 2) * 2;
  for (let i = 0; i < tiers; i++) {
    const top = base - 18 - (i + 1) * th - 6;
    const w0 = 34 - i * 8;
    for (let k = 0; k < th + 8; k += 2) {
      const hw = Math.round((w0 * k) / (th + 8) / 2) * 2;
      rect(g, x - hw, top + k, hw * 2, 2, k % 6 < 2 ? '#2f8a3a' : '#24702e');
    }
  }
  const cols = ['#e2504a', '#f2c14e', '#5b8def', '#f29cd0'];
  const r = [[-10, -30], [8, -38], [-4, -52], [10, -60], [-8, -70], [2, -84], [-14, -44]];
  r.forEach(([dx, dy], i) => rect(g, x + dx, base + dy * (h / 90), 4, 4, (i + Math.floor(t * 2)) % 3 ? cols[i % 4] : '#ffffff'));
  const sy = base - h - 6;
  rect(g, x - 2, sy - 6, 4, 12, '#f2c14e');
  rect(g, x - 6, sy - 2, 12, 4, '#f2c14e');
}

/** A 16 px arrow on a 2 px grid along lane 0..3 (left, down, up, right), centred on x, y. */
export function arrow2(g, x, y, lane, col) {
  const map = ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..', '..####..'];
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      if (map[j][i] !== '#') continue;
      const [u, v] = lane === 2 ? [i, j] : lane === 1 ? [i, 7 - j] : lane === 0 ? [j, i] : [7 - j, i];
      rect(g, x - 8 + u * 2, y - 8 + v * 2, 2, 2, col);
    }
}

/** A dark party-hall wall: two flat bands, a dado line, a garland. */
export function hallWall(g, t, y0 = 18, y1 = 200) {
  rect(g, 0, y0, 480, y1 - y0, '#2a2038');
  for (let x = 0; x < 480; x += 24) rect(g, x, y0, 12, y1 - y0, '#2e2440');
  rect(g, 0, y1 - 4, 480, 4, '#1a1426');
  stringLights(g, y0 + 6, t);
}
