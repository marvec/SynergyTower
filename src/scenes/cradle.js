// The window cleaners' cradle (scenes/roof.js): a ride down the outside of the tower from the roof to the roof floor you
// came up from (2, 12, 22 or 32), past every floor's lit windows and the colleagues inside (waving, staring, startled),
// then back in through the fire-escape window. Space or a click skips to the bottom.
import { W, H } from '../engine/screen.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import { C, rect } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { isTouch } from '../engine/platform.js';
import { createRng } from '../core/rng.js';
import * as RF from '../core/roof.js';
import * as S from '../core/state.js';
import { buildFloor } from '../core/tasks.js';
import { departmentForFloor } from '../data/departments.js';
import { CRADLE_FACES } from '../data/roof.js';
import { drawSky, drawSkyline } from './cityscape.js';
import { characterSheet, npcLook, npcIdentity } from './floorWorld.js';

const TOP = 40;
const FLOOR_PX = 64; // one floor of facade on screen
const SPEED = 2.6; // floors per second
const TOWER_X = 90;
const TOWER_W = 300;
const CRADLE_Y = 150; // the cradle's rail on screen

/** How long the ride takes from the roof down to `to`, before easing in. */
export const rideSeconds = (to) => (TOP - to + 1) / SPEED + 1.2;

export class CradleRide {
  constructor(game, to) {
    this.game = game;
    this.to = to;
    this.t = 0;
    this.total = rideSeconds(to);
    this.mode = RF.skyMode(game.now());
    this.sheet = characterSheet(game.playerLook());
    this.done = false;
    this.floors = new Map(); // floor -> its windows (built as they come into view)
  }

  get music() {
    return 'rooftop';
  }

  enter() {
    this.game.audio.play(this.music);
    this.game.sfx('door');
  }

  /** Where the cradle is, in floors (fractional): from just above the top floor down to `to`, slowing at the end. */
  get at() {
    const k = Math.min(1, this.t / this.total);
    const e = 1 - (1 - k) * (1 - k);
    return TOP + 0.6 - (TOP + 0.6 - this.to) * e;
  }

  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.t > 0.3 && (input.confirm() || input.pointer.clicked)) {
      input.consumeClick?.();
      this.t = this.total;
    }
    const f = Math.floor(this.at);
    if (f !== this.lastFloor) {
      this.lastFloor = f;
      if (this.t < this.total) this.game.sfx('blip');
    }
    if (this.t >= this.total + 0.8) this.finish();
  }

  async finish() {
    if (this.done) return;
    this.done = true;
    const game = this.game;
    const { FloorScene } = await import('./floorScene.js');
    game.set(new FloorScene(game, this.to, { arrival: 'roof' }));
    game.toast('In through the window. Nobody saw a thing. Well, nearly nobody.', C.dim);
  }

  /** A floor's windows: four, two of them with a colleague (their look, a reaction), the rest an empty desk. */
  windows(floor) {
    if (this.floors.has(floor)) return this.floors.get(floor);
    const s = this.game.state;
    const fl = buildFloor(floor);
    const fired = s.fired || {};
    const people = fl.npcs.filter((n) => !fired[n.seed]);
    const r = createRng(floor * 53 + S.castOf(s));
    const seats = r.sample([0, 1, 2, 3], Math.min(2, people.length));
    const out = [0, 1, 2, 3].map((i) => {
      const k = seats.indexOf(i);
      if (k < 0) return { person: null };
      const n = people[k];
      return {
        person: { sheet: characterSheet(npcLook(n.seed, fl.dept, S.castOf(s))), name: npcIdentity(n.seed, fl.dept, S.castOf(s)).name.split(' ')[0] },
        react: r.pick(CRADLE_FACES),
      };
    });
    this.floors.set(floor, out);
    return out;
  }

  render(g) {
    const night = this.mode === 'night';
    const at = this.at;
    drawSky(g, W, H, this.mode, this.t);
    drawSkyline(g, W, H + 60 + (at - 1) * 4, this.mode, 140, 11);
    // The facade.
    rect(g, TOWER_X - 4, 0, TOWER_W + 8, H, night ? '#1a1e30' : '#3a4256');
    rect(g, TOWER_X, 0, TOWER_W, H, night ? '#2a3048' : '#56607a');
    for (let i = -2; i < H / FLOOR_PX + 2; i++) {
      const floor = Math.floor(at) + i;
      const y = Math.round(CRADLE_Y - (floor - at) * FLOOR_PX) - FLOOR_PX + 20;
      if (floor > TOP) {
        if (floor === TOP + 1) {
          rect(g, TOWER_X - 8, y + FLOOR_PX - 14, TOWER_W + 16, 14, night ? '#3a3f55' : '#9a9ea6');
          rect(g, TOWER_X - 8, y + FLOOR_PX - 14, TOWER_W + 16, 2, night ? '#4a5068' : '#b4b2aa');
        }
        continue;
      }
      if (floor < 1) continue;
      this.drawFloor(g, floor, y, night);
    }
    this.drawCradle(g);
    rect(g, 0, 0, W, 16, 'rgba(13,15,24,0.75)');
    drawText(g, `FLOOR ${Math.min(TOP, Math.max(this.to, Math.round(at)))} · ${departmentForFloor(Math.min(TOP, Math.max(1, Math.round(at)))).name}`, W / 2, 4, { align: 'center', color: C.text });
    // What the people on the floor going past make of it, in one line.
    const here = Math.round(at);
    if (here >= 1 && here <= TOP && Math.abs(here - at) < 0.7) {
      const said = this.windows(here).filter((w) => w.person).map((w) => `${w.person.name} ${w.react}.`).join(' ');
      if (said) {
        rect(g, 0, H - 30, W, 14, 'rgba(13,15,24,0.75)');
        drawText(g, said, W / 2, H - 27, { align: 'center', color: C.gold });
      }
    }
    drawText(g, isTouch() ? 'Tap: skip' : 'SPACE / click: skip', W / 2, H - 12, { align: 'center', color: C.dim });
  }

  drawFloor(g, floor, y, night) {
    rect(g, TOWER_X, y + FLOOR_PX - 3, TOWER_W, 3, night ? '#1a1e30' : '#3a4256');
    drawText(g, `F${floor}`, TOWER_X + 14 + 3 * 72 + 60, y + 1, { align: 'right', color: night ? '#6a7090' : '#c8ccd4' }); // over the last window
    const wins = this.windows(floor);
    const lit = night || floor === this.to;
    wins.forEach((w, i) => {
      const wx = TOWER_X + 14 + i * 72;
      const wy = y + 10;
      const ww = 60;
      const wh = FLOOR_PX - 20;
      rect(g, wx - 1, wy - 1, ww + 2, wh + 2, '#1a1a22');
      rect(g, wx, wy, ww, wh, lit ? '#e8d890' : '#bcd8ee');
      // A desk with a monitor in every window.
      rect(g, wx + 6, wy + wh - 12, ww - 12, 4, '#7a5536');
      rect(g, wx + ww - 22, wy + wh - 22, 12, 9, '#1a1a22');
      rect(g, wx + ww - 21, wy + wh - 21, 10, 6, '#7fc4ff');
      if (w.person) {
        const near = Math.abs(floor - this.at) < 0.7;
        const waving = near && (w.react === 'waves' || w.react === 'waves back');
        const px = wx + 12;
        const py = wy + wh - CHAR_H - 4;
        g.drawImage(w.person.sheet, 0, 0, CHAR_W, CHAR_H, px, py, CHAR_W, CHAR_H);
        if (waving && Math.floor(this.t * 5) % 2) rect(g, px + 14, py + 6, 2, 5, '#e0b48a');
        if (near && ['stares', 'calls security', 'faints'].includes(w.react)) drawText(g, '!', px + 8, py - 9, { align: 'center', color: C.bad });
        if (near && w.react === 'spills coffee') rect(g, px + 14, py + 14, 3, 3, '#6a4a2a');
      }
      // Glass glare.
      rect(g, wx + 2, wy + 2, 2, wh - 4, 'rgba(255,255,255,0.25)');
    });
  }

  /** The cradle on its cables, the player in it with a squeegee. */
  drawCradle(g) {
    const cx = W / 2 - 10;
    const y = CRADLE_Y;
    rect(g, cx - 40, 0, 1, y - 18, '#2b2e38');
    rect(g, cx + 40, 0, 1, y - 18, '#2b2e38');
    rect(g, cx - 44, y - 18, 88, 2, '#f2c230');
    rect(g, cx - 44, y - 18, 2, 22, '#b08a18');
    rect(g, cx + 42, y - 18, 2, 22, '#b08a18');
    const bob = Math.round(Math.sin(this.t * 3) * 1);
    g.drawImage(this.sheet, 0, 1 * CHAR_H, CHAR_W, CHAR_H, cx - 8, y - CHAR_H + 4 + bob, CHAR_W, CHAR_H);
    rect(g, cx + 6, y - 12 + bob, 1, 8, '#9aa1ad');
    rect(g, cx + 3, y - 13 + bob, 7, 2, '#2a86c7');
    rect(g, cx - 46, y + 4, 92, 8, '#1a1a22');
    rect(g, cx - 45, y + 5, 90, 6, '#c8ccd4');
    rect(g, cx - 45, y + 5, 90, 1, '#e8ecf0');
    rect(g, cx - 12, y + 7, 24, 3, '#3a3f48');
  }

  exit() {}
}
