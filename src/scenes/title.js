import { MINIGAMES } from '../minigames/index.js';
// Title screen: animated tower at dusk, logo, continue / new career.
import { W, H } from '../engine/screen.js';
import { C, ButtonSet, rect, drawLink, openCoffee } from '../engine/ui.js';
import { openFeedback } from '../engine/feedback.js';
import { drawText, measureText } from '../engine/font.js';
import { CORP_COLORS } from '../data/corpColors.js';
import { drawSky, drawSkyline, drawTower, towerHeight, TOWER_W } from './cityscape.js';
import { Dialog, HOW_TO } from './overlays.js';
import { titleForFloor } from '../data/departments.js';

// Station mini-games (the HR review isn't one).
const GAME_COUNT = Object.keys(MINIGAMES).length - 1;

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.buttons = new ButtonSet();
    this.saved = game.hasSave() && game.load();
    this.build();
  }
  build() {
    const b = this.buttons;
    b.clear();
    const x = 40;
    let y = 150;
    if (this.saved) {
      const s = this.game.state;
      b.add({ x, y, w: 150, h: 20, label: 'Continue career', color: C.goodBtn, onClick: () => this.continue() });
      y += 26;
      this.savedInfo = `${s.player.name} · ${titleForFloor(s.maxFloor)} · F${s.maxFloor}`;
    }
    b.add({ x, y, w: 150, h: 20, label: this.saved ? 'New career' : 'Start your career', onClick: () => this.newGame() });
    y += 26;
    b.add({ x, y, w: 150, h: 20, label: 'How to play', color: C.panelLight, onClick: () => this.game.push(new Dialog(this.game, { title: 'How to play', w: 320, text: HOW_TO })) });
  }
  enter() {
    this.game.audio.play('title');
  }
  resume() {
    this.game.audio.play('title');
  }
  async continue() {
    const { FloorScene } = await import('./floorScene.js');
    const s = this.game.state;
    if (!s.flags.introSeen) {
      const { ExteriorScene } = await import('./exterior.js');
      return this.game.set(new ExteriorScene(this.game));
    }
    // A new hire who has not made it past the lobby turnstiles yet comes back in through the front door.
    const arrival = s.lobby !== 'done' && s.floor === 1 ? 'entrance' : 'elevator';
    this.game.set(new FloorScene(this.game, s.floor, { arrival }));
  }
  async newGame() {
    const { SetupScene } = await import('./setup.js');
    this.game.set(new SetupScene(this.game));
  }
  update(dt) {
    this.t += dt;
    this.buttons.update(this.game.input, (n) => this.game.sfx(n));
  }
  render(g) {
    const groundY = H - 18;
    drawSky(g, W, H, 'dusk', this.t);
    drawSkyline(g, W, groundY, 'night', this.t * 4);
    const corp = this.saved ? this.game.corpColor() : CORP_COLORS[Math.floor(this.t / 3) % CORP_COLORS.length];
    const name = this.saved ? this.game.state.corp.name : corp.name + ' Corp';
    // Tower slowly scrolls to show it is tall.
    const th = towerHeight();
    const pan = (Math.sin(this.t * 0.25) + 1) / 2;
    const gy = groundY + (th - H + 60) * pan;
    drawTower(g, W - TOWER_W - 60, gy, corp, { corpName: name, mode: 'night', t: this.t });
    rect(g, 0, groundY, W, 18, '#20232e');
    rect(g, 0, groundY, W, 2, '#3a3f4e');
    // Logo.
    const wob = Math.round(Math.sin(this.t * 2) * 2);
    drawText(g, 'SYNERGY', 40, 40 + wob, { scale: 4, color: C.gold, shadow: '#000' });
    drawText(g, 'TOWER', 40, 76 - wob, { scale: 4, color: '#ffffff', shadow: '#000' });
    drawText(g, 'Climb 40 floors of corporate absurdity.', 42, 112, { color: '#e8dff8', shadow: '#000' });
    drawText(g, `Prove your skills in ${GAME_COUNT} challenging tasks!`, 42, 122, { color: C.gold, shadow: '#000' });
    if (this.savedInfo) drawText(g, this.savedInfo, 42, 138, { color: C.so, shadow: '#000' });
    this.buttons.render(g);
    drawText(g, 'v1.0 · works offline · no cookies · M toggles music', 4, H - 11, { color: '#8890b0' });
    drawLink(g, this.game.input, 'Buy author a coffee', W - 4, H - 11, openCoffee);
    drawLink(g, this.game.input, 'Feedback', W - 4 - measureText('Buy author a coffee') - 14, H - 11, sendFeedback);
  }
}

const sendFeedback = () => openFeedback('title screen');
