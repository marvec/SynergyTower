// The fire escape (core/roof.js): a short climb up the side of the tower, or back down, with a floor counter running to
// 40 (or back to the floor you came from) and a joke scaled by the distance. Space or a click skips it.
import { W, H } from '../engine/screen.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import { C, rect } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { isTouch } from '../engine/platform.js';
import { CLIMB_UP, CLIMB_DOWN, CLIMB_SKIP } from '../data/roof.js';
import * as RF from '../core/roof.js';
import { drawSky, drawSkyline } from './cityscape.js';
import { characterSheet } from './floorWorld.js';

const ROOF_FLOOR = 40;
const FLOOR_PX = 44; // one floor of facade on screen
const SPEED = 9; // floors per second at full speed
const RUST = '#a5492e';
const RUST_D = '#6e2f1e';

/** How long the climb takes: a second or two plus a little per floor, never more than 4.5 s. */
export const climbSeconds = (floors) => Math.min(4.5, 1.2 + floors / SPEED);

export class RoofClimb {
  /** from: the roof floor (2, 12, 22, 32); up: climbing up to the roof, else back down to `from`. */
  constructor(game, from, { up = true } = {}) {
    this.game = game;
    this.from = from;
    this.up = up;
    this.opaque = true;
    this.t = 0;
    this.total = climbSeconds(ROOF_FLOOR - from);
    this.line = up ? CLIMB_UP[from] || CLIMB_UP[2] : CLIMB_DOWN[Math.floor(Math.random() * CLIMB_DOWN.length)];
    this.mode = RF.skyMode(game.now());
    this.sheet = characterSheet(game.playerLook());
    this.done = false;
  }

  get music() {
    return 'rooftop';
  }

  enter() {
    this.game.audio.play(this.music);
  }

  /** 0..1 along the climb, eased at both ends. */
  get k() {
    const k = Math.min(1, this.t / this.total);
    return k * k * (3 - 2 * k);
  }

  /** The floor the climber is at now (a number, for the counter and the scroll). */
  get floorAt() {
    const a = this.up ? this.from : ROOF_FLOOR;
    const b = this.up ? ROOF_FLOOR : this.from;
    return a + (b - a) * this.k;
  }

  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.t > 0.3 && (input.confirm() || input.pointer.clicked)) {
      input.consumeClick?.();
      this.t = this.total + 1;
    }
    const step = Math.floor(this.t * 6);
    if (step !== this.step && this.t < this.total) {
      this.step = step;
      this.game.sfx('step');
    }
    if (this.t >= this.total + 0.35) this.finish();
  }

  async finish() {
    if (this.done) return;
    this.done = true;
    const game = this.game;
    if (this.up) {
      const { RoofScene } = await import('./roof.js');
      game.set(new RoofScene(game, this.from));
    } else {
      const { FloorScene } = await import('./floorScene.js');
      game.set(new FloorScene(game, this.from, { arrival: 'roof' }));
      game.toast('Back in through the window. Act natural.', C.dim);
    }
  }

  render(g) {
    const night = this.mode === 'night';
    drawSky(g, W, H, this.mode, this.t);
    const f = this.floorAt;
    // The city below: lower as you climb.
    const ground = H + 40 + (f - 1) * 6;
    drawSkyline(g, W, Math.min(H + 120, ground), this.mode, this.from * 37, 9);
    // The tower's side wall with a column of windows, scrolling past.
    const tx = 150;
    const tw = 180;
    rect(g, tx, 0, tw, H, night ? '#2a3048' : '#56607a');
    rect(g, tx, 0, 3, H, night ? '#1a1e30' : '#3a4256');
    rect(g, tx + tw - 3, 0, 3, H, night ? '#1a1e30' : '#3a4256');
    const off = (f % 1) * FLOOR_PX;
    // Every floor with a pixel on screen, the climber in the middle: as many below as above.
    const reach = Math.ceil(H / 2 / FLOOR_PX) + 1;
    for (let i = -reach; i <= reach; i++) {
      const y = Math.round(H / 2 - (i * FLOOR_PX) + off - FLOOR_PX / 2);
      const floor = Math.floor(f) + i;
      if (y >= H || y + FLOOR_PX <= 0 || floor < 1) continue;
      if (floor > ROOF_FLOOR) {
        // Above the top floor: the parapet, then sky.
        if (floor === ROOF_FLOOR + 1) rect(g, tx - 6, y + FLOOR_PX - 8, tw + 12, 8, night ? '#3a3f55' : '#9a9ea6');
        continue;
      }
      rect(g, tx + 3, y + FLOOR_PX - 2, tw - 6, 2, night ? '#1a1e30' : '#3a4256');
      for (let k = 0; k < 4; k++) {
        const wx = tx + 14 + k * 42;
        if (k === 1) continue; // the ladder runs here
        const lit = night ? (floor * 7 + k) % 3 !== 0 : false;
        rect(g, wx, y + 5, 28, FLOOR_PX - 20, '#1a1a22');
        rect(g, wx + 1, y + 6, 26, FLOOR_PX - 22, night ? (lit ? '#f2d878' : '#1a2038') : '#8ec5f0');
        if (!night) rect(g, wx + 1, y + 6, 26, 2, '#c8e6fa');
      }
      // The floor's number under its last window, clear of the glass.
      drawText(g, `F${floor}`, tx + 14 + 3 * 42 + 28, y + FLOOR_PX - 12, { align: 'right', color: night ? '#6a7090' : '#c8ccd4' });
    }
    // The ladder.
    const lx = tx + 54;
    rect(g, lx, 0, 3, H, RUST_D);
    rect(g, lx + 21, 0, 3, H, RUST_D);
    rect(g, lx + 1, 0, 1, H, RUST);
    rect(g, lx + 22, 0, 1, H, RUST);
    const roff = Math.round((f * FLOOR_PX) % 9);
    for (let y = -9 + roff; y < H; y += 9) rect(g, lx + 3, y, 18, 2, RUST);
    // The climber, seen from behind, hands and feet alternating.
    const frame = this.t >= this.total ? 0 : 1 + (Math.floor(this.t * 6) % 2);
    const s = 2;
    g.drawImage(this.sheet, frame * CHAR_W, 1 * CHAR_H, CHAR_W, CHAR_H, lx + 12 - CHAR_W, H / 2 - CHAR_H, CHAR_W * s, CHAR_H * s);
    // The counter and the joke.
    rect(g, 0, 0, W, 30, 'rgba(13,15,24,0.75)');
    drawText(g, `FLOOR ${Math.round(f)}`, W / 2, 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    rect(g, 0, H - 34, W, 34, 'rgba(13,15,24,0.75)');
    drawText(g, this.line, W / 2, H - 28, { align: 'center', color: C.gold });
    drawText(g, isTouch() ? 'Tap: skip' : CLIMB_SKIP, W / 2, H - 14, { align: 'center', color: C.dim });
  }

  exit() {}
}
