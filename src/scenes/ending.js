// CEO ending: fireworks over the lit-up tower, career stats, then free play continues.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, ButtonSet } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { drawSky, drawSkyline, drawTower, TOWER_W, towerHeight } from './cityscape.js';

export class EndingScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.sparks = [];
    this.buttons = new ButtonSet();
    this.buttons.add({ x: W / 2 - 70, y: H - 30, w: 140, h: 20, label: 'Keep running the company', color: C.gold, textColor: C.ink, onClick: () => this.game.pop() });
    this.opaque = true;
  }
  enter() {
    this.game.audio.play('fanfare', 'title');
  }
  exit() {
    this.game.audio.play('exec');
  }
  update(dt) {
    this.t += dt;
    if (Math.random() < dt * 2.5) {
      const x = 40 + Math.random() * (W - 80);
      const y = 30 + Math.random() * 90;
      const col = ['#f2c14e', '#e2504a', '#7ee0c3', '#8ab4ff', this.game.corpColor().light][Math.floor(Math.random() * 5)];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const v = 30 + Math.random() * 40;
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2, col });
      }
      this.game.sfx('blip');
    }
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt;
      p.life -= dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    if (this.t > 1) this.buttons.update(this.game.input, (n) => this.game.sfx(n));
  }
  render(g) {
    const s = this.game.state;
    const corp = this.game.corpColor();
    drawSky(g, W, H, 'night', this.t);
    drawSkyline(g, W, H - 10, 'night', 0);
    const pan = Math.min(1, this.t / 6);
    drawTower(g, W - TOWER_W - 30, H - 10 + (towerHeight() - H + 40) * (1 - pan), corp, { corpName: s.corp.name, mode: 'night', t: this.t, lit: true, highlightFloor: 40 });
    for (const p of this.sparks) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      rect(g, p.x, p.y, 2, 2, p.col);
    }
    g.globalAlpha = 1;
    panel(g, 16, 30, 250, 170, { title: 'CHIEF EXECUTIVE OFFICER' });
    drawText(g, `Congratulations, ${s.player.name}!`, 141, 52, { align: 'center', color: C.gold });
    const lines = [
      `From unpaid intern to CEO of ${s.corp.name}.`,
      '',
      `Tasks completed: ${s.stats.tasksPlayed}`,
      `Perfect (3-star) tasks: ${s.stats.perfectTasks}`,
      `Promotions: ${s.stats.promotions}`,
      `Seniority level: ${s.level}`,
      `Stock Options bought (pretend): ${s.stats.soPurchased}`,
      '',
      'The board thanks you. Shareholders weep with joy.',
      'Free play continues — beat your best scores!',
    ];
    lines.forEach((l, i) => drawText(g, l, 26, 68 + i * 12, { color: i >= 8 ? C.dim : C.text }));
    this.buttons.render(g);
  }
}
