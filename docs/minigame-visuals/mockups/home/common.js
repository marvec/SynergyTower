// Shared flat (home office) scenery for the home chore mockups, in the in-between style: Squeaky Clean's tiles,
// worktop and cabinets, 2 px detail, flat colours.
import { rect } from '../../../../src/engine/mgkit.js';
import { cblob, shade } from '../kit.js';

/** Subway tiles (Squeaky Clean's kitchen wall). */
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

/** Square bathroom tiles. */
export function squares(g, x, y, w, h, tile, grout, size = 20) {
  rect(g, x, y, w, h, grout);
  for (let yy = y; yy < y + h; yy += size)
    for (let xx = x; xx < x + w; xx += size) {
      rect(g, xx + 2, yy + 2, Math.min(size - 2, x + w - xx - 2), Math.min(size - 2, y + h - yy - 2), tile);
      rect(g, xx + 2, yy + 2, Math.min(size - 2, x + w - xx - 2), 2, shade(tile, 0.35));
    }
}

/** Worktop and cabinet doors (Squeaky Clean's counter). */
export function counter(g, y, h = 270 - y) {
  rect(g, 0, y, 480, 14, '#9aa0a8');
  rect(g, 0, y, 480, 2, '#c8ccd2');
  rect(g, 0, y + 12, 480, 4, '#3a3d44');
  rect(g, 0, y + 16, 480, h - 16, '#c8a070');
  for (let x = 4; x < 480; x += 78) {
    rect(g, x, y + 20, 72, h - 20, '#b48a5a');
    rect(g, x + 4, y + 24, 64, h - 24, '#d4ae7c');
    rect(g, x + 4, y + 24, 64, 2, '#e8c898');
    rect(g, x + 32, y + 28, 8, 2, '#5a5a62');
  }
}

/** A potted plant (2 px cells). */
export function plant(g, x, y, s = 1) {
  rect(g, x - 7 * s, y - 12 * s, 14 * s, 12 * s, '#b0603a');
  rect(g, x - 8 * s, y - 12 * s, 16 * s, 3 * s, '#c8784a');
  for (const [dx, dy, rx, ry] of [[-6, -18, 5, 7], [5, -20, 5, 8], [0, -26, 4, 7]]) {
    cblob(g, x + dx * s, y + dy * s, rx * s, ry * s, '#2f8a3a');
    cblob(g, x + dx * s - 2, y + dy * s - 2, Math.max(2, (rx - 2) * s), Math.max(2, (ry - 3) * s), '#4fba5a');
  }
}
