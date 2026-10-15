// DOS-style lighting (Doom's COLORMAP, C-Dogs' visibility): the world is drawn unlit, then multiplied by a light buffer
// that only has a few shade levels, mixed with a 4x4 Bayer dither, so light reveals the sprites' own colours in steps
// instead of washing them out with a translucent overlay. Static lights are baked into a world lightmap once (and again
// when one is added or removed); dynamic ones (the player's light) are added each frame. Walls and tall furniture block
// light on the tile grid (Bresenham line of sight), so light never leaks into the next room.
// The light maths is plain typed arrays; only applyLighting touches a canvas.
import { W, H, makeCanvas } from './screen.js';

/** One place for the look. view: 'final' | 'unlit' | 'light' (the light buffer alone, for debugging). */
export const LIGHTING = {
  levels: 10, // shade levels per channel, black included
  dither: true, // 4x4 Bayer between neighbouring levels; off = plain rounding
  mode: 'pixel', // 'pixel' | 'tile' (one light value per 16x16 tile, the blocky look)
  ambient: 0.2, // the night's base light, 0..1
  fog: false, // tiles out of the player's sight are drawn at fogLevel once seen, black before
  fogLevel: 0.08,
  // Defaults for a light's `flicker` (a light can override each): how deep it wavers (0..1), how fast, and the share of
  // 250 ms slots with a brief dip to 60%.
  flicker: { depth: 0.1, speed: 1, dip: 0.03 },
  view: 'final',
};
export const VIEWS = ['final', 'unlit', 'light'];

// Thresholds in [0, 1), spread so a level between two shades turns into an even pixel pattern.
const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);
const FACE = 0x8000; // owner flag: the pixel is a wall's front face (it faces south)

/** Light reaching a pixel, by distance as a share of the radius (0..1). */
const FALLOFF = {
  linear: (d) => 1 - d,
  quad: (d) => (1 - d) * (1 - d),
};

const TAU = Math.PI * 2;
const FLICKER_HZ = [1.7, 3.1, 7.3]; // incommensurate, so the sum never settles into a visible beat
const DIP_SLOT_S = 0.25;
const DIP_LEVEL = 0.6;

/** A 32-bit integer hash (0..2^32-1). */
function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

/**
 * How bright a flickering light is at t seconds, about 1 - depth..1: three sines at incommensurate frequencies with phases
 * from the light's seed (so neighbours are out of sync), and now and then a 250 ms dip to 60%. Never dark, never random
 * per frame: the same t always gives the same value.
 */
export function flickerLevel(fx, t, defaults = LIGHTING.flicker) {
  const depth = fx.depth ?? defaults.depth;
  const speed = fx.speed ?? defaults.speed;
  const dip = fx.dip ?? defaults.dip;
  const seed = fx.seed | 0;
  let sum = 0;
  for (let k = 0; k < 3; k++) sum += Math.sin(TAU * FLICKER_HZ[k] * speed * t + (hash32(seed + k * 7919) / 2 ** 32) * TAU);
  let f = 1 - depth * (0.5 + 0.5 * (sum / 3));
  if (hash32((Math.floor(t / DIP_SLOT_S) + Math.imul(seed, 0x9e3779b1)) | 0) / 2 ** 32 < dip) f *= DIP_LEVEL;
  return f;
}

/** True when nothing opaque stands between two tiles (the end tiles themselves never block). */
function clearLine(opaque, cols, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (x === x1 && y === y1) return true;
    if ((x !== x0 || y !== y0) && opaque[y * cols + x]) return false;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x += sx);
    if (e2 <= dx) (err += dx), (y += sy);
  }
}

export class Lighting {
  /**
   * cols x rows tiles of `tile` px. opaque: Uint8Array per tile (walls and tall furniture block light). wall: Uint8Array
   * per tile of the walls alone, drawn wallH px taller than their tile (their top surface reaches into the row above);
   * the top row's walls (the outer wall) are outerRise px taller still. The pixel maps start `top` px above the floor's
   * first row, so those walls (reaching above y 0) are lit too.
   */
  constructor({ cols, rows, tile = 16, opaque, wall = opaque, wallH = 0, outerRise = 0, config = LIGHTING }) {
    Object.assign(this, { cols, rows, tile, opaque, wall, config });
    this.pw = cols * tile;
    this.ph = rows * tile;
    this.top = wallH ? wallH + outerRise : 0;
    this.owner = this.buildOwners(wall, wallH, outerRise);
    this.lights = [];
    this.ambient = [config.ambient, config.ambient, config.ambient];
    this.flashV = 0;
    this.flashRate = 0;
    this.map = new Float32Array(this.pw * (this.ph + this.top) * 3);
    this.dirty = true;
    this.frame = new Float32Array(W * H * 3);
    this.seen = config.fog ? new Uint8Array(cols * rows) : null;
    this.viewer = null;
  }

  /**
   * Which tile each world pixel shows, so a wall's pixels drawn over the row above still belong to the wall: tile index + 1
   * (0 = outside the floor), with FACE set on a wall's front face.
   */
  buildOwners(wall, wallH, outerRise) {
    const { cols, rows, tile, pw, ph, top } = this;
    const owner = new Uint16Array(pw * (ph + top));
    const isWall = (x, y) => y >= 0 && y < rows && wall[y * cols + x];
    const frontH = (r) => wallH + (r === 0 ? outerRise : 0);
    for (let py = -top; py < ph; py++) {
      const ty = Math.floor(py / tile);
      for (let tx = 0; tx < cols; tx++) {
        let v = ty >= 0 ? ty * cols + tx + 1 : 0;
        // A wall at row r covers [r * tile - frontH(r), (r + 1) * tile): its top, then its front (when the tile below is
        // open). Rows are drawn top to bottom, so the lowest wall covering the pixel shows.
        if (wallH) {
          for (let r = ty + 2; r >= ty; r--) {
            if (!isWall(tx, r) || py < r * tile - frontH(r) || py >= (r + 1) * tile) continue;
            v = r * cols + tx + 1;
            if (py >= (r + 1) * tile - frontH(r) && !isWall(tx, r + 1)) v |= FACE;
            break;
          }
        }
        owner.fill(v, (py + top) * pw + tx * tile, (py + top) * pw + (tx + 1) * tile);
      }
    }
    return owner;
  }

  /**
   * A light: x, y in world px, r its reach in px, intensity (above 1 saturates the middle), tint [r, g, b], falloff
   * 'linear' | 'quad', dynamic (moved every frame, not baked), level: a number or (t) => 0..1 (a blinking light), flicker:
   * { seed, depth?, speed?, dip? } (a light that wavers, more towards its edge; see flickerLevel).
   */
  addLight(opts) {
    const light = { intensity: 1, tint: [1, 1, 1], falloff: 'linear', dynamic: false, level: 1, ...opts };
    this.lights.push(light);
    if (!light.dynamic) this.dirty = true;
    return light;
  }

  removeLight(light) {
    const i = this.lights.indexOf(light);
    if (i < 0) return;
    this.lights.splice(i, 1);
    if (!light.dynamic) this.dirty = true;
  }

  /** The base light everywhere, optionally tinted per channel. */
  setAmbient(level, tint = this.ambientTint || [1, 1, 1]) {
    this.ambientTint = tint;
    this.ambient = tint.map((c) => level * c);
  }

  /** A global flash (an alarm, lightning): `amount` more ambient light, fading out over `seconds`. */
  flash(amount, seconds = 0.4) {
    this.flashV = Math.max(this.flashV, amount);
    this.flashRate = this.flashV / seconds;
  }

  update(dt) {
    this.flashV = Math.max(0, this.flashV - this.flashRate * dt);
  }

  /** For fog of war: where the player's eyes are, in world px. */
  setViewer(x, y) {
    this.viewer = { x, y };
  }

  /**
   * The tiles a light reaches, as bits: 1 = in sight, 2 = also a wall face it shines on (only light from the south lights a
   * wall's front). Cached on the light until it moves to another tile.
   */
  visibility(light) {
    const { cols, rows, tile, opaque } = this;
    const sx = Math.min(cols - 1, Math.max(0, Math.floor(light.x / tile)));
    const sy = Math.min(rows - 1, Math.max(0, Math.floor(light.y / tile)));
    const key = `${sx},${sy},${light.r}`;
    if (light._visKey === key) return light._vis;
    const vis = light._vis || new Uint8Array(cols * rows);
    vis.fill(0);
    const reach = Math.ceil(light.r / tile) + 1;
    const x0 = Math.max(0, sx - reach);
    const x1 = Math.min(cols - 1, sx + reach);
    const y0 = Math.max(0, sy - reach);
    const y1 = Math.min(rows - 1, sy + reach);
    const seen = (tx, ty) => clearLine(opaque, cols, sx, sy, tx, ty) || clearLine(opaque, cols, tx, ty, sx, sy);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) if (!opaque[ty * cols + tx] && seen(tx, ty)) vis[ty * cols + tx] = 1;
    }
    // A wall or tall cabinet is lit when the light sees it, or sees the open tile in front of it on the light's side (a
    // line along a wall runs through its neighbours, so walls seen at a shallow angle would otherwise stay dark).
    const lit = (tx, ty) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 && vis[ty * cols + tx] === 1;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!opaque[ty * cols + tx]) continue;
        const dx = Math.sign(sx - tx);
        const dy = Math.sign(sy - ty);
        if (seen(tx, ty) || (dx && lit(tx + dx, ty)) || (dy && lit(tx, ty + dy))) vis[ty * cols + tx] = 2;
      }
    }
    // Bit 1: lit; bit 2: a wall face it shines on (only light from the south reaches a wall's front).
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = ty * cols + tx;
        if (vis[i]) vis[i] = ty < sy ? 3 : 1;
      }
    }
    light._vis = vis;
    light._visKey = key;
    return vis;
  }

  /**
   * Adds a light into an RGB float buffer covering world px [ox, ox + bw) x [oy, oy + bh), clipped to the floor, scaled by
   * `level`. Pixel mode measures the distance per pixel, tile mode per tile centre (one value per tile). `edge`, when given
   * (same shape as buf), also gets the light weighted by its distance as a share of the radius (for the flicker).
   */
  splat(light, buf, ox, oy, bw, bh, level = 1, edge = null) {
    if (level <= 0) return;
    const { tile, cols, pw, ph, owner, top } = this;
    const vis = this.visibility(light);
    const perTile = this.config.mode === 'tile';
    const pad = perTile ? tile : 0;
    const x0 = Math.max(0, ox, Math.floor(light.x - light.r - pad));
    const y0 = Math.max(-top, oy, Math.floor(light.y - light.r - pad));
    const x1 = Math.min(pw, ox + bw, Math.ceil(light.x + light.r + pad));
    const y1 = Math.min(ph, oy + bh, Math.ceil(light.y + light.r + pad));
    const fall = FALLOFF[light.falloff] || FALLOFF.linear;
    const inv = 1 / light.r;
    const k = light.intensity * level;
    const [tr, tg, tb] = light.tint;
    for (let py = y0; py < y1; py++) {
      const row = (py + top) * pw;
      let i = ((py - oy) * bw + (x0 - ox)) * 3;
      for (let px = x0; px < x1; px++, i += 3) {
        const o = owner[row + px];
        if (!o) continue;
        const t = (o & ~FACE) - 1;
        if (!(vis[t] & (o & FACE ? 2 : 1))) continue;
        let dx, dy;
        if (perTile) {
          dx = ((t % cols) + 0.5) * tile - light.x;
          dy = (((t / cols) | 0) + 0.5) * tile - light.y;
        } else {
          dx = px + 0.5 - light.x;
          dy = py + 0.5 - light.y;
        }
        const d = Math.sqrt(dx * dx + dy * dy) * inv;
        if (d >= 1) continue;
        const v = k * fall(d);
        buf[i] += v * tr;
        buf[i + 1] += v * tg;
        buf[i + 2] += v * tb;
        if (edge) {
          edge[i] += v * tr * d;
          edge[i + 1] += v * tg * d;
          edge[i + 2] += v * tb * d;
        }
      }
    }
  }

  /**
   * Bakes the static lights: steady ones into the floor's lightmap, blinking and flickering ones each into a patch of their
   * own (a flickering one also into a distance-weighted copy), so a frame only scales the patches, never re-bakes.
   */
  bake() {
    this.map.fill(0);
    for (const l of this.lights) {
      if (l.dynamic) continue;
      if (typeof l.level === 'function' || l.flicker) {
        const pad = this.config.mode === 'tile' ? this.tile : 0;
        const x = Math.floor(l.x - l.r - pad);
        const y = Math.floor(l.y - l.r - pad);
        const w = Math.ceil(l.x + l.r + pad) - x;
        const h = Math.ceil(l.y + l.r + pad) - y;
        l._patch = { x, y, w, h, data: new Float32Array(w * h * 3), edge: l.flicker ? new Float32Array(w * h * 3) : null };
        this.splat(l, l._patch.data, x, y, w, h, 1, l._patch.edge);
      } else this.splat(l, this.map, 0, -this.top, this.pw, this.ph + this.top, l.level);
    }
    this.bakedMode = this.config.mode;
    this.dirty = false;
  }

  /** The tiles the player sees now (fog of war), marked as seen for good. */
  sight() {
    if (!this.viewer) return null;
    this.eye ||= { r: Math.max(W, H) }; // one object, so its sight stays cached until the player changes tile
    this.eye.x = this.viewer.x;
    this.eye.y = this.viewer.y;
    const vis = this.visibility(this.eye);
    this.seen ||= new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < vis.length; i++) if (vis[i]) this.seen[i] = 1;
    return vis;
  }

  /**
   * The light buffer for the screen at camera (cx, cy) (whole px) as RGBA bytes: lightmap + flickering patches + dynamic
   * lights + ambient and flash, clamped, then quantized to config.levels with the Bayer dither (anchored to the world, so
   * the pattern does not crawl when the camera moves). fade 0..1 blends from full light to the night (the lights going out).
   */
  compute(out, cx, cy, { fade = 1, t = 0 } = {}) {
    const { config, pw, ph, frame, owner, top } = this;
    if (this.dirty || this.bakedMode !== config.mode) this.bake();
    frame.fill(0);
    // The baked map, row by row.
    const xa = Math.max(0, cx);
    const xb = Math.min(pw, cx + W);
    if (xb > xa) {
      for (let sy = 0; sy < H; sy++) {
        const wy = cy + sy;
        if (wy < -top || wy >= ph) continue;
        const row = (wy + top) * pw;
        frame.set(this.map.subarray((row + xa) * 3, (row + xb) * 3), (sy * W + (xa - cx)) * 3);
      }
    }
    for (const l of this.lights) {
      const level = typeof l.level === 'function' ? l.level(t) : l.level;
      if (level <= 0) continue;
      if (l.dynamic) this.splat(l, frame, cx, cy, W, H, level);
      else if (l._patch && l.flicker) {
        // contribution * mix(1, f, d / r) = contribution + (f - 1) * contribution * d / r: the middle holds, the edge wavers.
        const f = flickerLevel(l.flicker, t, config.flicker);
        this.addPatch(l._patch, cx, cy, level, (f - 1) * level);
      } else if (l._patch) this.addPatch(l._patch, cx, cy, level);
    }
    const sight = config.fog ? this.sight() : null;
    const n = config.levels - 1;
    const step = 255 / n;
    const [ar, ag, ab] = this.ambient;
    const fl = this.flashV;
    const fog = config.fogLevel;
    for (let sy = 0, i = 0; sy < H; sy++) {
      const wy = cy + sy;
      const brow = (wy & 3) * 4;
      const inRow = wy >= -top && wy < ph;
      for (let sx = 0; sx < W; sx++, i++) {
        const wx = cx + sx;
        const b = config.dither ? BAYER[brow + (wx & 3)] : 0.5;
        let r = frame[i * 3] + ar + fl;
        let g = frame[i * 3 + 1] + ag + fl;
        let bl = frame[i * 3 + 2] + ab + fl;
        if (sight) {
          const o = inRow && wx >= 0 && wx < pw ? owner[(wy + top) * pw + wx] : 0;
          const tIdx = (o & ~FACE) - 1;
          if (!o || !sight[tIdx]) r = g = bl = o && this.seen[tIdx] ? fog : 0;
        }
        if (fade < 1) {
          r = 1 - fade * (1 - Math.min(1, r));
          g = 1 - fade * (1 - Math.min(1, g));
          bl = 1 - fade * (1 - Math.min(1, bl));
        }
        const j = i * 4;
        out[j] = Math.min(n, (r * n + b) | 0) * step;
        out[j + 1] = Math.min(n, (g * n + b) | 0) * step;
        out[j + 2] = Math.min(n, (bl * n + b) | 0) * step;
        out[j + 3] = 255;
      }
    }
    return out;
  }

  /** Adds level x a baked patch (plus edgeK x its distance-weighted copy) to the frame. */
  addPatch(p, cx, cy, level, edgeK = 0) {
    const x0 = Math.max(p.x, cx);
    const y0 = Math.max(p.y, cy);
    const x1 = Math.min(p.x + p.w, cx + W);
    const y1 = Math.min(p.y + p.h, cy + H);
    const { frame } = this;
    for (let y = y0; y < y1; y++) {
      let s = ((y - p.y) * p.w + (x0 - p.x)) * 3;
      let d = ((y - cy) * W + (x0 - cx)) * 3;
      if (edgeK && p.edge) {
        for (let x = x0; x < x1; x++, s += 3, d += 3) {
          frame[d] += p.data[s] * level + p.edge[s] * edgeK;
          frame[d + 1] += p.data[s + 1] * level + p.edge[s + 1] * edgeK;
          frame[d + 2] += p.data[s + 2] * level + p.edge[s + 2] * edgeK;
        }
        continue;
      }
      for (let x = x0; x < x1; x++, s += 3, d += 3) {
        frame[d] += p.data[s] * level;
        frame[d + 1] += p.data[s + 1] * level;
        frame[d + 2] += p.data[s + 2] * level;
      }
    }
  }

  /**
   * Lights the world already drawn on g (screen space, camera at cam in whole px): multiplies it by the quantized light
   * buffer. Draw the HUD and markers afterwards, so they are never lit.
   */
  applyLighting(g, cam, opts) {
    const view = this.config.view;
    if (view === 'unlit') return;
    if (!this.layer) {
      this.layer = makeCanvas(W, H);
      this.image = this.layer[1].createImageData(W, H);
    }
    const [c, d] = this.layer;
    this.compute(this.image.data, Math.round(cam.x), Math.round(cam.y), opts);
    d.putImageData(this.image, 0, 0);
    g.save();
    g.globalAlpha = 1;
    g.globalCompositeOperation = view === 'light' ? 'source-over' : 'multiply';
    g.drawImage(c, 0, 0);
    g.restore();
  }
}
