// Scenery shared by the mini-games, in the in-between style on a 2 px grid: the hotel's (facade, palms, loungers,
// parasols, clouds: Pool Ball and the garden and beach games after it) and the flat's (tiles, worktop, a plant).
// Static: bake() them in create().
import { W, H, rect, drawText } from './mgkit.js';
import { cblob, shade } from './mgart.js';

/** The HOTEL PARADISO block, its cornice's top left at (x - 4, y): 348x124 px (x 66-414, y 30-154 by default), a
 *  sand-coloured wall, a cornice with the name, 3 rows of 8 shuttered windows with balconies. */
export function hotelFacade(g, x = 70, y = 30) {
  rect(g, x, y + 4, 340, 120, '#e8d6b4');
  rect(g, x - 4, y, 348, 6, '#c8b088');
  rect(g, x - 4, y, 348, 2, '#d8c49c');
  drawText(g, 'HOTEL PARADISO', x + 170, y + 10, { align: 'center', color: '#b0603a' });
  for (let row = 0; row < 3; row++) {
    const wy = y + 26 + row * 30;
    for (let col = 0; col < 8; col++) {
      const wx = x + 14 + col * 40;
      rect(g, wx, wy, 22, 18, '#5a8aaa');
      rect(g, wx, wy, 22, 6, '#8ac0dc');
      rect(g, wx + 10, wy, 2, 18, '#e8d6b4');
      rect(g, wx - 4, wy, 4, 18, '#2f8f7f');
      rect(g, wx + 22, wy, 4, 18, '#2f8f7f');
      rect(g, wx - 6, wy + 18, 34, 2, '#ffffff');
      for (let k = 0; k < 34; k += 6) rect(g, wx - 6 + k, wy + 20, 2, 4, '#ffffff');
    }
  }
}

/** A palm with its foot at (x, y), `h` px tall, the trunk leaning by `lean` (negative: left). Still: bake it. */
export function palm(g, x, y, h, lean) {
  let tx = x;
  for (let k = 0; k < h; k += 4) {
    const f = k / h;
    tx = x + lean * f * f * h * 0.5;
    rect(g, Math.round(tx) - 3, y - k - 4, 7, 4, '#8a6038');
    rect(g, Math.round(tx) - 3, y - k - 4, 7, 1, '#5a3a20');
    rect(g, Math.round(tx) + 2, y - k - 3, 2, 3, '#a87848');
  }
  const cx = Math.round(tx);
  const cy = y - h - 2;
  for (const [ang, len] of [[-2.8, 34], [-2.2, 30], [-1.6, 22], [-1.0, 30], [-0.35, 34], [0.2, 26], [-3.4, 26]]) {
    for (let k = 0; k < len; k++) {
      const f = k / len;
      const px = cx + Math.cos(ang) * k;
      const py = cy + Math.sin(ang) * k + f * f * 14;
      rect(g, Math.round(px), Math.round(py), 2, 2, f < 0.5 ? '#2f8a3a' : '#3fae4f');
      if (k % 3 === 0 && k > 4) rect(g, Math.round(px), Math.round(py) + 2, 1, 3, '#24662e');
    }
  }
  // The coconuts: a rim, the nut and a light patch, on the 2 px grid.
  for (const [dx, dy] of [[-2, 2], [3, 3], [0, 5]]) {
    const c = '#6a4a22';
    cblob(g, cx + dx, cy + dy, 3, 3, '#3a2a12');
    cblob(g, cx + dx - 2, cy + dy - 2, 2, 2, c);
    cblob(g, cx + dx - 1, cy + dy - 1, 2, 2, shade(c, 0.22));
  }
}

/** A sun lounger, 44 px wide, its mattress top at y; `flip` raises the backrest on the left instead of the right. */
export function lounger(g, x, y, flip) {
  rect(g, x, y, 44, 4, '#f4f4f0');
  for (let k = 0; k < 44; k += 8) rect(g, x + k, y - 4, 8, 4, k % 16 ? '#2fa39a' : '#ffffff');
  for (let k = 0; k < 14; k += 2) rect(g, flip ? x - k : x + 40 + k, y - 4 - k, 4, 2, k % 4 < 2 ? '#2fa39a' : '#ffffff');
  for (const lx of [x + 2, x + 40]) rect(g, lx, y + 4, 2, 6, '#9aa1ad');
}

/** A red-and-white parasol: pole standing at x with its foot at y, the canopy about 36 px wide, 50 px up. */
export function parasol(g, x, y) {
  rect(g, x, y - 46, 2, 46, '#f4f4f0');
  for (let k = 0; k < 18; k += 2) {
    const hw = 4 + k * 2;
    for (let s = -hw; s < hw; s += 8) rect(g, x + s, y - 50 + k, Math.min(8, hw - s), 2, Math.floor((s + 64) / 8) % 2 ? '#e2504a' : '#ffffff');
  }
}

/** A flat white cloud, 40 px wide with its top left at (x, y) (the bump rises 4 px above y). */
export function cloud(g, x, y) {
  rect(g, x, y, 40, 8, '#ffffff');
  rect(g, x + 8, y - 4, 22, 4, '#ffffff');
  rect(g, x, y + 8, 40, 2, '#d8eef8');
}

/** Subway tiles (the flat's kitchen wall) over x, y, w, h: grout, then 18 px tiles in staggered rows with a 2 px light top edge. */
export function subway(g, x, y, w, h, tile = '#eef2ee', grout = '#c8d0cc') {
  rect(g, x, y, w, h, grout);
  for (let yy = y, row = 0; yy < y + h; yy += 10, row++)
    for (let xx = x + (row % 2 ? -10 : 0); xx < x + w; xx += 20) {
      const x0 = Math.max(x, xx + 2);
      const x1 = Math.min(x + w, xx + 20);
      if (x1 <= x0) continue;
      rect(g, x0, yy + 2, x1 - x0, Math.min(8, y + h - yy - 2), tile);
      rect(g, x0, yy + 2, x1 - x0, 2, shade(tile, 0.4));
    }
}

/** Square bathroom tiles over x, y, w, h: grout, then size px tiles with a 2 px light top edge. */
export function squares(g, x, y, w, h, tile, grout, size = 20) {
  rect(g, x, y, w, h, grout);
  for (let yy = y; yy < y + h; yy += size)
    for (let xx = x; xx < x + w; xx += size) {
      rect(g, xx + 2, yy + 2, Math.min(size - 2, x + w - xx - 2), Math.min(size - 2, y + h - yy - 2), tile);
      rect(g, xx + 2, yy + 2, Math.min(size - 2, x + w - xx - 2), 2, shade(tile, 0.35));
    }
}

/** The worktop with its edge at y, and the cabinet doors under it down to the bottom (h px, default the rest of the screen). */
export function counter(g, y, h = H - y) {
  rect(g, 0, y, W, 14, '#9aa0a8');
  rect(g, 0, y, W, 2, '#c8ccd2');
  rect(g, 0, y + 12, W, 4, '#3a3d44');
  rect(g, 0, y + 16, W, h - 16, '#c8a070');
  for (let x = 4; x < W; x += 78) {
    rect(g, x, y + 20, 72, h - 20, '#b48a5a');
    rect(g, x + 4, y + 24, 64, h - 24, '#d4ae7c');
    rect(g, x + 4, y + 24, 64, 2, '#e8c898');
    rect(g, x + 32, y + 28, 8, 2, '#5a5a62');
  }
}

/** A terracotta pot with its foot at (x, y) and three leafy blobs above it; `s` scales it (1 = 16 px wide, about 34 px tall). */
export function pottedPlant(g, x, y, s = 1) {
  rect(g, x - 7 * s, y - 12 * s, 14 * s, 12 * s, '#b0603a');
  rect(g, x - 8 * s, y - 12 * s, 16 * s, 3 * s, '#c8784a');
  for (const [dx, dy, rx, ry] of [[-6, -18, 5, 7], [5, -20, 5, 8], [0, -26, 4, 7]]) {
    cblob(g, x + dx * s, y + dy * s, rx * s, ry * s, '#2f8a3a');
    cblob(g, x + dx * s - 2, y + dy * s - 2, Math.max(2, (rx - 2) * s), Math.max(2, (ry - 3) * s), '#4fba5a');
  }
}

// The Christmas party's (Gift Wrapping, Photo Booth, Dance-Off, Carol Karaoke). The static parts have their own functions
// so a game can bake them and draw only what twinkles per frame.

const BULBS = ['#e2504a', '#f2c14e', '#5fd068', '#5b8def', '#f29cd0'];
const wireY = (x, y, x0) => y + Math.round(Math.sin(((x - x0) / 76) * Math.PI) * 6);

/** The dark wire of a garland from x0 to x1, sagging 6 px every 76 px from y (static: bake it). */
export function stringWire(g, y, x0 = 0, x1 = W) {
  for (let x = x0; x < x1; x += 2) rect(g, x, wireY(x, y, x0), 2, 2, '#1a3a1a');
}

/** The garland's bulbs every 20 px, every other one lit by turns twice a second, with a soft glow (per frame). */
export function stringBulbs(g, y, t, x0 = 0, x1 = W) {
  for (let x = x0 + 10, i = 0; x < x1; x += 20, i++) {
    const yy = wireY(x, y, x0) + 2;
    const on = (i + Math.floor(t * 2)) % 2 === 0;
    const c = BULBS[i % BULBS.length];
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

/** A garland of coloured bulbs on a wire across the top, every other one lit by turns (the wire is static, the bulbs twinkle). */
export function stringLights(g, y, t, x0 = 0, x1 = W) {
  stringWire(g, y, x0, x1);
  stringBulbs(g, y, t, x0, x1);
}

/** The disco ball on its string (hung from y 18), a checker of mirror tiles that shift four times a second, a few sparkles. r = its radius. */
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

/** The tree without its baubles, centred on x with its pot standing at base and h px of boughs: stacked tiers in 2 px steps, a star (static: bake it). */
export function xmasTreeBody(g, x, base, h = 90) {
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
  const sy = base - h - 6;
  rect(g, x - 2, sy - 6, 4, 12, '#f2c14e');
  rect(g, x - 6, sy - 2, 12, 4, '#f2c14e');
}

/** The tree's seven baubles, each turning white now and then (per frame, over xmasTreeBody with the same x, base and h). */
export function xmasTreeBaubles(g, x, base, h = 90, t = 0) {
  const cols = ['#e2504a', '#f2c14e', '#5b8def', '#f29cd0'];
  const at = [[-10, -30], [8, -38], [-4, -52], [10, -60], [-8, -70], [2, -84], [-14, -44]];
  at.forEach(([dx, dy], i) => rect(g, x + dx, base + Math.round(dy * (h / 90)), 4, 4, (i + Math.floor(t * 2)) % 3 ? cols[i % 4] : '#ffffff'));
}

/** A Christmas tree: boughs, baubles that twinkle with t, a star; the trunk in a red pot at base. */
export function xmasTree(g, x, base, h = 90, t = 0) {
  xmasTreeBody(g, x, base, h);
  xmasTreeBaubles(g, x, base, h, t);
}
