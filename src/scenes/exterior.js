// Intro: camera pans down the tower, then the player walks along the street to the entrance.
import { W, H } from '../engine/screen.js';
import { C, rect, panel } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { createRng } from '../core/rng.js';
import { drawSky, drawSkyline, drawTower, towerHeight, TOWER_W } from './cityscape.js';
import { Actor, npcLook } from './floorWorld.js';
import { isTouch } from '../engine/platform.js';

const WORLD_W = 900;
const GROUND = 0; // world y of the sidewalk line (characters stand here)
const TOWER_X = 560;

export class ExteriorScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.pan = 1; // 1 = looking at the top, 0 = at street level
    this.player = new Actor(game.playerLook(), 24, 0);
    this.player.dir = 'right';
    const r = createRng(9);
    this.walkers = Array.from({ length: 6 }, (_, i) => {
      const a = new Actor(npcLook(100 + i, 'lobby'), r.float(0, WORLD_W / 16), 0.35 + r.float(0, 0.4));
      return { a, v: r.chance(0.5) ? r.float(1, 1.8) : -r.float(1, 1.8) };
    });
    this.cars = [{ x: -60, v: 70, c: '#c94a4a' }, { x: 500, v: -55, c: '#f2c14e' }];
    this.camX = TOWER_X + TOWER_W / 2 - W / 2;
    this.target = null;
    this.entering = 0;
  }
  enter() {
    this.game.audio.play('lobby');
  }
  get doorX() {
    return TOWER_X + TOWER_W / 2;
  }
  update(dt) {
    const input = this.game.input;
    const p = this.player;
    this.t += dt;
    if (this.entering) {
      this.entering += dt;
      p.moving = true;
      p.dir = 'up';
      p.y -= dt * 0.8;
      p.update(dt);
      if (this.entering > 1.1) this.goInside();
      return;
    }
    if (this.pan > 0) {
      this.pan = Math.max(0, this.pan - dt * 0.33);
      if (input.confirm() || input.pointer.clicked) {
        this.pan = 0;
        input.consumeKeys();
        input.consumeClick();
      }
    }
    const canMove = this.pan < 0.15;
    let kx = canMove ? (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0) : 0;
    if (canMove && input.pointer.clicked) {
      this.target = (input.pointer.x + this.camX) / 16;
    }
    if (kx) this.target = null;
    else if (this.target != null) {
      const d = this.target - p.x;
      if (Math.abs(d) < 0.1) this.target = null;
      else kx = Math.sign(d);
    }
    if (kx) {
      p.x = Math.max(0.5, Math.min(WORLD_W / 16 - 0.5, p.x + kx * 4 * dt));
      p.dir = kx > 0 ? 'right' : 'left';
      p.moving = true;
    } else p.moving = false;
    p.update(dt);
    const nearDoor = Math.abs(p.x * 16 - this.doorX) < 24;
    if (nearDoor && (input.confirm() || input.pressed('ArrowUp') || (this.target == null && input.pointer.clicked))) this.startEntering();
    if (nearDoor && this.target != null && Math.abs(this.target * 16 - this.doorX) < 24 && !kx) this.startEntering();
    for (const w of this.walkers) {
      w.a.x += w.v * dt;
      w.a.dir = w.v > 0 ? 'right' : 'left';
      w.a.moving = true;
      if (w.a.x > WORLD_W / 16 + 1) w.a.x = -1;
      if (w.a.x < -1) w.a.x = WORLD_W / 16 + 1;
      w.a.update(dt);
    }
    for (const c of this.cars) {
      c.x += c.v * dt;
      if (c.x > WORLD_W + 80) c.x = -80;
      if (c.x < -80) c.x = WORLD_W + 80;
    }
    if (this.pan <= 0) {
      const want = Math.max(0, Math.min(WORLD_W - W, p.x * 16 - W / 2));
      this.camX += (want - this.camX) * Math.min(1, dt * 3);
    }
  }
  startEntering() {
    this.entering = 0.01;
    this.player.x = this.doorX / 16;
    this.game.sfx('door');
  }
  async goInside() {
    if (this.leaving) return;
    this.leaving = true;
    const { FloorScene } = await import('./floorScene.js');
    this.game.set(new FloorScene(this.game, 1, { arrival: 'entrance' }));
  }
  render(g) {
    const corp = this.game.corpColor();
    const s = this.game.state;
    const streetY = H - 46;
    const th = towerHeight();
    const ease = this.pan * this.pan * (3 - 2 * this.pan);
    const camY = -ease * (th - H + 70);
    drawSky(g, W, H, 'day', this.t);
    drawSkyline(g, W, streetY - camY * 0.3, 'day', this.camX);
    g.save();
    g.translate(-Math.round(this.camX), -Math.round(camY));
    // Other buildings.
    rect(g, 140, streetY - 180, 120, 180, '#7a8498');
    for (let y = streetY - 172; y < streetY - 10; y += 10) for (let x = 146; x < 254; x += 10) rect(g, x, y, 6, 6, '#a8c8e0');
    rect(g, 780, streetY - 140, 100, 140, '#8a7a6a');
    for (let y = streetY - 132; y < streetY - 10; y += 12) for (let x = 786; x < 874; x += 12) rect(g, x, y, 7, 7, '#c8d8e8');
    drawTower(g, TOWER_X, streetY, corp, { corpName: s.corp.name, mode: 'day', t: this.t });
    // Street.
    rect(g, -20, streetY, WORLD_W + 40, 14, '#a8a49a');
    for (let x = 0; x < WORLD_W; x += 24) rect(g, x, streetY, 1, 14, '#8f8b82');
    rect(g, -20, streetY + 14, WORLD_W + 40, 40, '#3a3d46');
    for (let x = 0; x < WORLD_W; x += 40) rect(g, x, streetY + 30, 20, 2, '#e8e0a0');
    // Trees and lamp posts.
    for (const tx of [60, 300, 470, 720, 860]) {
      rect(g, tx, streetY - 26, 3, 26, '#5a3a22');
      rect(g, tx - 9, streetY - 44, 21, 20, '#3f8f3f');
      rect(g, tx - 6, streetY - 48, 15, 6, '#4fa94f');
    }
    const actors = [...this.walkers.map((w) => w.a), this.player].sort((a, b) => a.y - b.y);
    for (const a of actors) {
      g.save();
      g.translate(0, streetY + 9 - a.y * 16 + (a.y - 0) * 6);
      a.draw(g);
      g.restore();
    }
    // Cars drive on the road, in front of the sidewalk: draw them over the pedestrians.
    for (const c of this.cars) this.drawCar(g, c, streetY + 18);
    g.restore();
    if (this.pan > 0.15) {
      panel(g, W / 2 - 150, H - 30, 300, 20, { fill: C.panelDark });
      drawText(g, `${s.corp.name} Tower · 40 floors · 1 corner office`, W / 2, H - 24, { align: 'center', color: C.gold });
    } else if (!this.entering) {
      const near = Math.abs(this.player.x * 16 - this.doorX) < 24;
      panel(g, 4, 4, near ? 170 : 220, 18, { fill: C.panelDark });
      const hint = isTouch() ? (near ? 'Tap to enter the tower' : '→ Tap to walk to the entrance') : near ? 'SPACE / ↑  Enter the tower' : '→ Walk to the entrance (or click)';
      drawText(g, hint, 10, 9, { color: near ? C.gold : C.text });
    }
  }
  drawCar(g, c, y) {
    const x = Math.round(c.x);
    rect(g, x, y, 44, 10, c.c);
    rect(g, x + 8, y - 7, 26, 8, c.c);
    rect(g, x + 10, y - 5, 10, 5, '#a8d4ee');
    rect(g, x + 22, y - 5, 10, 5, '#a8d4ee');
    rect(g, x + 6, y + 8, 8, 5, '#1a1a22');
    rect(g, x + 30, y + 8, 8, 5, '#1a1a22');
    rect(g, c.v > 0 ? x + 42 : x, y + 2, 2, 3, '#f2d878');
  }
}

export { GROUND };
