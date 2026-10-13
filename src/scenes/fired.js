// Game over (core/conduct.js): failing the compliance training on the ground floor, or landing on compliance hold before
// checking in at reception (no badge: the HR office is beyond the turnstiles). fireCareer() deletes the career at once
// (no reload undoes it); FiredScene is the walk of shame out of the tower with a cardboard box, then the title.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, ButtonSet } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { drawSky, drawSkyline, drawTower, TOWER_W } from './cityscape.js';
import { Actor } from './floorWorld.js';
import { titleForFloor } from '../data/departments.js';
import { track } from '../engine/analytics.js';

const TOWER_X = 300;

const REASONS = {
  training: ['Compliance training: failed, on the ground floor.', 'There is no floor below this one.'],
  checkin: ['Reported to HR before you even had a badge.', 'Reception has seen enough. So has HR.'],
};

/** Ends the career being played: deletes it and returns what the walk out needs. reason: a REASONS key. */
export function fireCareer(game, reason) {
  const s = game.state;
  const career = { reason, look: game.playerLook(), name: s.player.name, corp: s.corp.name, corpColor: game.corpColor(), tasks: s.stats.tasksPlayed, title: titleForFloor(s.maxFloor) };
  track('fired_career', { reason, floor: s.maxFloor });
  game.wipeSave();
  return career;
}

export class FiredScene {
  /** career: what is left of it, from fireCareer() ({ reason, look, name, corp, corpColor, tasks, title }). */
  constructor(game, career) {
    this.game = game;
    this.career = career;
    this.opaque = true;
    this.t = 0;
    this.player = new Actor(career.look, (TOWER_X + TOWER_W / 2) / 16, 0);
    this.player.carry = 'box';
    this.player.dir = 'left';
    this.buttons = new ButtonSet();
    this.buttons.add({ x: W / 2 - 60, y: H - 26, w: 120, h: 18, label: 'Back to the title', onClick: () => this.leave() });
  }
  enter() {
    this.game.audio.play('lobby');
  }
  async leave() {
    if (this.leaving) return;
    this.leaving = true;
    const { TitleScene } = await import('./title.js');
    this.game.set(new TitleScene(this.game));
  }
  update(dt) {
    this.t += dt;
    const p = this.player;
    p.moving = p.x > 3;
    if (p.moving) p.x -= dt * 1.6;
    p.update(dt);
    if (this.t > 1.5) this.buttons.update(this.game.input, (n) => this.game.sfx(n));
  }
  render(g) {
    const k = this.career;
    const streetY = H - 46;
    drawSky(g, W, H, 'dusk', this.t);
    drawSkyline(g, W, streetY, 'dusk', 0);
    drawTower(g, TOWER_X, streetY, k.corpColor, { corpName: k.corp, mode: 'dusk', t: this.t });
    rect(g, 0, streetY, W, 14, '#a8a49a');
    for (let x = 0; x < W; x += 24) rect(g, x, streetY, 1, 14, '#8f8b82');
    rect(g, 0, streetY + 14, W, 40, '#3a3d46');
    g.save();
    g.translate(0, streetY + 9);
    this.player.draw(g);
    g.restore();
    panel(g, 12, 12, 250, 112, { title: "YOU'RE FIRED", titleColor: '#7a2b2b' });
    const lines = [
      [`${k.name}, ${k.title}`, C.gold],
      ...(REASONS[k.reason] || REASONS.training).map((l) => [l, C.text]),
      ['', C.text],
      [`Tasks completed for ${k.corp}: ${k.tasks}`, C.dim],
      ['Security will see you out. The career is over.', C.dim],
      ['Start a new one from the title screen.', C.dim],
    ];
    lines.forEach(([l, color], i) => drawText(g, l, 22, 32 + i * 12, { color }));
    if (this.t > 1.5) this.buttons.render(g);
  }
}
