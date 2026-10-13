// Pixel art for the business-trip drive (driveScene.js): the player's sports car and the traffic seen from behind,
// roadside objects, gantries and the stage backdrops. Everything is drawn in code once and cached as canvases.
import { makeCanvas } from '../engine/screen.js';
import { rect } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { createRng } from '../core/rng.js';

const cache = new Map();
const baked = (key, w, h, draw) => {
  let c = cache.get(key);
  if (!c) {
    const [canvas, g] = makeCanvas(w, h);
    draw(g, w, h);
    c = canvas;
    cache.set(key, c);
  }
  return c;
};

/** The motorway crash barrier (drawn as a continuous rail by driveScene, not as sprites): steel beam, its lower edge, posts. */
export const RAIL = { beam: '#c8ccd4', edge: '#8a909c', post: '#5a5f6a' };

/** Per-stage colours: sky bands (top → horizon), backdrop silhouettes, verge, road, rumble strips, lane marks. */
export const STAGE_LOOK = {
  downtown: { sky: ['#2f5f9e', '#3b6dad', '#4a7fbe', '#5d93cc', '#77a9da', '#93bfe4'], far: '#55688c', near: '#3a465e', verge: ['#76767e', '#6c6c74'], road: '#4b4b53', rumble: ['#e0e0e0', '#c43030'], lane: '#e8e8e8', sun: null },
  country: { sky: ['#3f7fd0', '#4c8bd6', '#5b98dc', '#6ca6e2', '#82b6e8', '#9cc7ee'], far: '#7d9db8', near: '#4f8a46', verge: ['#4c9f48', '#45944a'], road: '#5d5d65', rumble: ['#e8e8e8', '#c83232'], lane: '#e8e8e8', sun: '#fff1a8' },
  motorway: { sky: ['#5f82a8', '#6b8db1', '#7898ba', '#86a4c2', '#96b1ca', '#a8bed2'], far: '#8c9cab', near: '#647d55', verge: ['#6f8f50', '#68874a'], road: '#45454d', rumble: ['#e8e8e8', '#45454d'], lane: '#e8e8e8', sun: null },
  park: { sky: ['#3d3470', '#5a3d80', '#86508a', '#bf6488', '#e5846c', '#f2ac68'], far: '#58395c', near: '#33503f', verge: ['#57ad57', '#4fa24f'], road: '#56565e', rumble: ['#f2c14e', '#3a3a42'], lane: '#f4f1e8', sun: '#ffd27a' },
};

// ------------------------------------------------------------------ cars
/** The player's red wedge-shaped sports car from behind. steer -1/0/1, brake lights on or off. 64×30. */
export function playerCar(steer = 0, brake = false) {
  return baked(`pc${steer}${brake}`, 64, 30, (g) => {
    const red = '#c8242c';
    const hi = '#ea5560';
    const dk = '#861820';
    const lean = steer * 2;
    // Wheels.
    for (const x of [3 - Math.max(0, -steer), 51 + Math.max(0, steer)]) {
      rect(g, x, 21, 10, 9, '#141418');
      rect(g, x + 1, 22, 8, 1, '#3a3a44');
    }
    // Body.
    rect(g, 2, 13, 60, 12, red);
    rect(g, 2, 13, 60, 1, hi);
    rect(g, 2, 23, 60, 2, dk);
    rect(g, 1, 15, 1, 8, dk);
    rect(g, 62, 15, 1, 8, dk);
    // Rear window with louvres (leans into the turn).
    for (let r = 0; r < 9; r++) {
      const inset = 14 - Math.round(r * 0.7);
      rect(g, inset + lean, 3 + r, 64 - inset * 2, 1, r === 0 ? hi : r % 2 ? '#1a1d28' : '#353a4a');
    }
    rect(g, 8 + lean, 11, 48, 2, dk); // spoiler
    rect(g, 6 + lean, 10, 52, 1, red);
    // Tail lights, number plate, bumper, exhausts.
    const tl = brake ? '#ff7a7a' : '#d01818';
    rect(g, 5, 16, 13, 4, tl);
    rect(g, 46, 16, 13, 4, tl);
    rect(g, 5, 16, 3, 4, '#f29c38');
    rect(g, 56, 16, 3, 4, '#f29c38');
    if (brake) {
      rect(g, 6, 17, 11, 2, '#fff0f0');
      rect(g, 47, 17, 11, 2, '#fff0f0');
    }
    rect(g, 25, 17, 14, 5, '#f2f2e0');
    for (let k = 0; k < 4; k++) rect(g, 27 + k * 3, 19, 2, 1, '#2a2a35');
    rect(g, 3, 24, 58, 2, '#26262e');
    rect(g, 18, 25, 3, 2, '#9aa0b0');
    rect(g, 43, 25, 3, 2, '#9aa0b0');
  });
}

/** A family hatchback from behind, in `color`. 40×26. */
export function trafficCar(color) {
  return baked(`tc${color}`, 40, 26, (g) => {
    rect(g, 2, 18, 8, 8, '#141418');
    rect(g, 30, 18, 8, 8, '#141418');
    rect(g, 1, 9, 38, 13, color);
    rect(g, 1, 9, 38, 1, 'rgba(255,255,255,0.35)');
    rect(g, 1, 20, 38, 2, 'rgba(0,0,0,0.3)');
    rect(g, 6, 1, 28, 8, color);
    rect(g, 8, 2, 24, 6, '#1e2230');
    rect(g, 9, 3, 8, 1, '#4a5068');
    rect(g, 3, 12, 6, 3, '#c81e1e');
    rect(g, 31, 12, 6, 3, '#c81e1e');
    rect(g, 15, 14, 10, 4, '#ecebdc');
    rect(g, 2, 21, 36, 2, '#26262e');
  });
}

// ------------------------------------------------------------------ roadside
/** Roadside objects: canvas + world width (world units; the road is 2 × 2000 wide). */
export function roadside(kind, opts = {}) {
  const def = SIDE[kind];
  if (!def) return null;
  const key = `rs-${kind}-${opts.text || ''}`;
  return { canvas: baked(key, def.w, def.h, (g, w, h) => def.draw(g, w, h, opts)), worldW: def.worldW };
}

const SIDE = {
  lamp: {
    w: 10, h: 48, worldW: 420,
    draw(g) {
      rect(g, 4, 5, 2, 43, '#5a5f6a');
      rect(g, 4, 5, 1, 43, '#7a808c');
      rect(g, 0, 1, 10, 4, '#3a3f4e');
      rect(g, 1, 4, 8, 1, '#fff2b0');
      rect(g, 3, 44, 4, 4, '#3a3f4e');
    },
  },
  tree: {
    w: 40, h: 56, worldW: 2200,
    draw(g) {
      rect(g, 17, 36, 6, 20, '#6a4a2a');
      rect(g, 17, 36, 2, 20, '#82603a');
      const blob = [[14, 0, 12], [8, 3, 24], [4, 7, 32], [2, 12, 36], [1, 18, 38], [2, 25, 36], [5, 31, 30], [10, 36, 20]];
      blob.forEach(([x, y, w], i) => rect(g, x, y, w, i < blob.length - 1 ? blob[i + 1][1] - y : 4, '#3d7a35'));
      for (const [x, y, w] of [[12, 3, 8], [8, 9, 10], [6, 15, 8], [20, 20, 9], [11, 24, 6]]) rect(g, x, y, w, 3, '#5aa04a');
      for (const [x, y, w] of [[26, 12, 8], [28, 22, 7], [22, 30, 10]]) rect(g, x, y, w, 3, '#2c5e27');
    },
  },
  pine: {
    w: 28, h: 56, worldW: 1500,
    draw(g) {
      rect(g, 12, 46, 4, 10, '#5a3e24');
      for (let r = 0; r < 46; r++) {
        const half = Math.round(2 + (r % 15) * 0.55 + Math.floor(r / 15) * 3);
        rect(g, 14 - half, r, half * 2, 1, r % 15 < 2 ? '#3f7a45' : '#2a5a32');
      }
    },
  },
  bush: {
    w: 28, h: 16, worldW: 1300,
    draw(g) {
      rect(g, 4, 3, 20, 13, '#3f8a3a');
      rect(g, 0, 7, 28, 9, '#3f8a3a');
      rect(g, 6, 4, 8, 3, '#5aa64e');
      rect(g, 2, 13, 24, 3, '#2c6428');
    },
  },
  billboard: {
    w: 64, h: 40, worldW: 3000,
    draw(g, _w, _h, { text = 'SYNERGY' }) {
      rect(g, 10, 22, 3, 18, '#4a4f5a');
      rect(g, 51, 22, 3, 18, '#4a4f5a');
      rect(g, 0, 0, 64, 24, '#22242e');
      rect(g, 1, 1, 62, 22, '#f2c14e');
      rect(g, 1, 1, 62, 4, '#e0503a');
      drawText(g, text, 32, 10, { align: 'center', color: '#22242e' });
    },
  },
  house: {
    w: 56, h: 44, worldW: 3600,
    draw(g) {
      for (let r = 0; r < 16; r++) rect(g, 28 - r * 2 - 2, r, r * 4 + 4, 1, r % 4 === 3 ? '#8a2e24' : '#b03a2e');
      rect(g, 4, 16, 48, 28, '#e8dcc0');
      rect(g, 4, 16, 48, 1, '#c8b898');
      rect(g, 10, 22, 10, 8, '#5a7ab0');
      rect(g, 36, 22, 10, 8, '#5a7ab0');
      rect(g, 24, 30, 8, 14, '#6a4628');
      rect(g, 40, 2, 5, 10, '#7a5a4a');
    },
  },
  tower: {
    w: 40, h: 110, worldW: 3600,
    draw(g, w, h) {
      rect(g, 0, 0, w, h, '#4a5f7a');
      rect(g, 0, 0, w, 3, '#2e3c50');
      for (let y = 6; y < h - 4; y += 6)
        for (let x = 3; x < w - 3; x += 6) rect(g, x, y, 4, 3, (x * 7 + y * 3) % 5 === 0 ? '#f2d98a' : '#7d9bbf');
      rect(g, 0, 0, 2, h, '#5d7594');
    },
  },
  sign: {
    w: 56, h: 40, worldW: 2800,
    draw(g, _w, _h, { text = 'CLIENT 12 KM' }) {
      rect(g, 8, 20, 3, 20, '#6a707c');
      rect(g, 45, 20, 3, 20, '#6a707c');
      rect(g, 0, 0, 56, 22, '#f4f1e8');
      rect(g, 1, 1, 54, 20, '#1f7a3e');
      drawText(g, text.slice(0, 10), 28, 4, { align: 'center', color: '#f4f1e8' });
      drawText(g, text.slice(10) || '->', 28, 12, { align: 'center', color: '#f4f1e8' });
    },
  },
  chevronL: {
    w: 16, h: 20, worldW: 800,
    draw(g) {
      chevron(g, -1);
    },
  },
  chevronR: {
    w: 16, h: 20, worldW: 800,
    draw(g) {
      chevron(g, 1);
    },
  },
  palm: {
    w: 32, h: 56, worldW: 1700,
    draw(g) {
      for (let y = 12; y < 56; y++) rect(g, 15 + Math.round(Math.sin(y / 14) * 2), y, 3, 1, y % 4 ? '#8a6a44' : '#6a4e30');
      const fronds = [[-14, 8], [-9, 2], [0, -2], [9, 2], [14, 8], [-12, 14], [12, 14]];
      for (const [dx, dy] of fronds)
        for (let k = 0; k <= 8; k++) rect(g, 16 + Math.round((dx * k) / 8), 11 + Math.round((dy * k) / 8 + (k * k) / 16), 3, 2, k % 3 ? '#3f9a46' : '#2f7a36');
    },
  },
  cone: {
    w: 8, h: 10, worldW: 300,
    draw(g) {
      for (let r = 0; r < 8; r++) rect(g, 3 - Math.floor(r / 3), r, 2 + Math.floor(r / 3) * 2, 1, r === 3 || r === 4 ? '#f4f1e8' : '#f2742a');
      rect(g, 0, 8, 8, 2, '#f2742a');
    },
  },
  client: {
    w: 96, h: 84, worldW: 8000,
    draw(g, w, h, { text = 'CLIENT' }) {
      rect(g, 0, 18, w, h - 18, '#3a5a7a');
      for (let y = 30; y < h - 12; y += 7)
        for (let x = 4; x < w - 4; x += 8) rect(g, x, y, 6, 4, (x + y) % 3 ? '#8ec0e8' : '#c8e4f8');
      rect(g, 10, 0, w - 20, 18, '#2a3a52');
      rect(g, 12, 4, w - 24, 11, '#f2c14e');
      drawText(g, text.toUpperCase(), w / 2, 6, { align: 'center', color: '#22242e' });
      rect(g, 38, h - 12, 20, 12, '#22303e');
      rect(g, 47, h - 12, 2, 12, '#8ec0e8');
    },
  },
};

function chevron(g, dir) {
  rect(g, 7, 12, 2, 8, '#5a5f6a');
  rect(g, 0, 0, 16, 12, '#f4f1e8');
  rect(g, 1, 1, 14, 10, '#c83232');
  for (let k = 0; k < 4; k++) {
    const x = dir > 0 ? 4 + k : 11 - k;
    rect(g, x, 2 + k, 2, 1, '#f4f1e8');
    rect(g, x, 9 - k, 2, 1, '#f4f1e8');
  }
}

/** A banner across the road: text on a coloured strip (drawn scaled between the gantry posts). */
export function bannerText(text, color) {
  const w = measureText(text) + 8;
  return baked(`bn-${text}-${color}`, w, 9, (g) => {
    rect(g, 0, 0, w, 9, color);
    drawText(g, text, 4, 1, { color: '#f4f1e8' });
  });
}

// ------------------------------------------------------------------ backdrops
/** Far and near silhouettes for a stage, 960 px wide so they can scroll and wrap. */
export function backdrop(stageId) {
  const look = STAGE_LOOK[stageId];
  const far = baked(`bg-far-${stageId}`, 960, 60, (g) => {
    const r = createRng(stageId.length * 97 + 5);
    if (stageId === 'downtown' || stageId === 'park') {
      for (let x = 0; x < 960; ) {
        const bw = r.int(14, 40);
        const bh = r.int(14, stageId === 'park' ? 46 : 58);
        rect(g, x, 60 - bh, bw, bh, look.far);
        for (let wy = 64 - bh; wy < 58; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r.chance(0.3)) rect(g, wx, wy, 2, 2, stageId === 'park' ? '#f2c87a' : '#8aa0c0');
        x += bw + r.int(0, 6);
      }
    } else {
      let y = 40;
      for (let x = 0; x < 960; x++) {
        y = Math.max(8, Math.min(56, y + r.int(-2, 2) * (stageId === 'country' ? 1 : 0.5)));
        const yy = Math.round(y + Math.sin(x / 70) * 10);
        rect(g, x, yy, 1, 60 - yy, look.far);
        if (stageId === 'country' && yy < 26) rect(g, x, yy, 1, 2, '#e8eef4'); // snow caps
      }
    }
  });
  const near = baked(`bg-near-${stageId}`, 960, 40, (g) => {
    const r = createRng(stageId.length * 131 + 9);
    for (let x = 0; x < 960; x++) {
      const yy = Math.round(22 + Math.sin(x / 45) * 6 + Math.sin(x / 17 + 1) * 3);
      rect(g, x, yy, 1, 40 - yy, look.near);
      if ((stageId === 'country' || stageId === 'motorway') && r.chance(0.08)) rect(g, x - 1, yy - r.int(2, 6), 3, 6, look.near);
    }
  });
  return { far, near };
}
