// Elevator interior: doors close, floor counter runs, ding, doors open. Promotions get a fanfare + card.
import { W, H } from '../engine/screen.js';
import { C, rect, panel, icon, ButtonSet } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import { characterSheet } from './floorWorld.js';
import { titleForFloor, floorName, departmentForFloor } from '../data/departments.js';
import * as E from '../core/economy.js';

export class ElevatorRide {
  constructor(game, from, to, { promoted = false } = {}) {
    this.game = game;
    this.from = from;
    this.to = to;
    this.promoted = promoted;
    this.t = 0;
    this.travel = Math.min(3, 0.6 + Math.abs(to - from) * 0.12);
    this.phase = 'closing';
    this.dinged = false;
    this.buttons = new ButtonSet();
  }
  enter() {
    this.game.audio.play('lobby');
    this.game.sfx('door');
  }
  get shown() {
    if (this.phase === 'closing') return this.from;
    if (this.phase === 'moving') {
      const k = Math.min(1, this.t / this.travel);
      return Math.round(this.from + (this.to - this.from) * k);
    }
    return this.to;
  }
  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.phase === 'closing' && this.t > 0.6) {
      this.phase = 'moving';
      this.t = 0;
    } else if (this.phase === 'moving' && this.t > this.travel) {
      this.phase = 'opening';
      this.t = 0;
      this.game.sfx('ding');
    } else if (this.phase === 'opening' && this.t > 0.6) {
      if (this.promoted) {
        this.phase = 'card';
        this.t = 0;
        this.game.audio.play('fanfare', departmentForFloor(this.to).music);
        this.buttons.add({ x: W / 2 - 60, y: H / 2 + 72, w: 120, h: 20, label: 'To my new desk!', color: C.good, textColor: '#10240f', onClick: () => this.arrive() });
      } else this.arrive();
    }
    if (this.phase === 'card') this.buttons.update(input, (n) => this.game.sfx(n));
    else if (this.phase !== 'card' && (input.back() || (this.t > 0.2 && input.pointer.clicked && this.phase === 'moving'))) this.t = this.travel;
  }
  async arrive() {
    if (this.leaving) return;
    this.leaving = true;
    const { FloorScene } = await import('./floorScene.js');
    this.game.set(new FloorScene(this.game, this.to, { arrival: 'elevator' }));
  }
  render(g) {
    const corp = this.game.corpColor();
    rect(g, 0, 0, W, H, '#2a2620');
    // Cabin walls.
    rect(g, 60, 20, W - 120, H - 40, '#6b5a44');
    for (let x = 70; x < W - 70; x += 40) rect(g, x, 30, 34, H - 70, '#7a6850');
    rect(g, 60, H - 40, W - 120, 20, '#3a3530');
    rect(g, 60, 60, W - 120, 3, '#c9a227');
    // Display.
    rect(g, W / 2 - 40, 26, 80, 28, '#1a1a22');
    rect(g, W / 2 - 37, 29, 74, 22, '#0d1a0d');
    const dir = this.to > this.from ? '↑' : this.to < this.from ? '↓' : '·';
    drawText(g, `${dir} ${this.shown}`, W / 2, 33, { align: 'center', scale: 2, color: '#f29c38' });
    // Player inside.
    const look = this.game.playerLook();
    const sheet = characterSheet(look);
    g.drawImage(sheet, 0, 0, CHAR_W, CHAR_H, W / 2 - CHAR_W * 2.5, H - 40 - CHAR_H * 5 + 4, CHAR_W * 5, CHAR_H * 5);
    // Panel of buttons.
    rect(g, W - 100, 100, 18, 60, '#9aa1ad');
    for (let i = 0; i < 6; i++) rect(g, W - 96, 104 + i * 9, 10, 6, i === 1 ? '#f2c14e' : '#5a606c');
    // Doors (front layer).
    let open = 0;
    if (this.phase === 'closing') open = 1 - Math.min(1, this.t / 0.6);
    else if (this.phase === 'moving') open = 0;
    else open = Math.min(1, this.t / 0.6);
    if (this.phase === 'card') open = 1;
    const half = (W - 120) / 2;
    const dw = Math.round(half * (1 - open));
    if (dw > 0) {
      rect(g, 60, 64, dw, H - 104, '#9aa1ad');
      rect(g, W - 60 - dw, 64, dw, H - 104, '#9aa1ad');
      rect(g, 60 + dw - 2, 64, 2, H - 104, '#6a707c');
      rect(g, W - 60 - dw, 64, 2, H - 104, '#6a707c');
      if (this.phase === 'moving') drawText(g, `${corp.name}`, W / 2, H / 2, { align: 'center', color: '#6a707c' });
    }
    if (this.phase === 'moving') {
      const shake = Math.round(Math.sin(this.t * 40));
      rect(g, 0, H - 18 + shake, W, 1, '#1a1a22');
      drawText(g, 'Click / Esc to skip', W / 2, H - 12, { align: 'center', color: '#8a7a60' });
    }
    if (this.phase === 'card') this.renderCard(g);
  }
  renderCard(g) {
    const s = this.game.state;
    const x = W / 2 - 140;
    const y = H / 2 - 92;
    panel(g, x, y, 280, 194, { title: 'PROMOTED!' });
    const pop = Math.min(1, this.t * 3);
    drawText(g, titleForFloor(this.to), W / 2, y + 26, { align: 'center', scale: pop > 0.9 ? 2 : 1, color: C.gold, shadow: C.border });
    drawText(g, `Floor ${this.to} · ${floorName(this.to)} · ${departmentForFloor(this.to).name}`, W / 2, y + 50, { align: 'center' });
    const lines = [
      ['star', `New KPI quota: ${E.starQuota(this.to)} stars`],
      ['sp', `Tasks now pay ${E.taskReward(this.to, 2).sp} SP at 2 stars`],
      ['coffee', `Max coffee ${12 + Math.floor(this.to / 5) + 2 * (s.perks.mug || 0)}, tasks cost ${E.coffeeCost(this.to)}`],
      ['so', '+1 Stock Option signing bonus'],
      ['clock', `Task cooldowns: ${Math.round(E.stationCooldownMs(this.to, s.perks) / 60000)} min`],
    ];
    lines.forEach(([ic, t], i) => {
      icon(g, ic, x + 30, y + 68 + i * 13);
      drawText(g, t, x + 42, y + 68 + i * 13);
    });
    drawText(g, this.to >= 36 ? 'The corner offices are near. Stay hungry.' : 'Your new colleagues are already judging you.', W / 2, y + 140, { align: 'center', color: C.dim });
    this.buttons.render(g);
  }
}
