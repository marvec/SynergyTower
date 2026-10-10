// New career: name your corporation, pick its colour, name and style your employee.
import { track } from '../engine/analytics.js';
import { W, H } from '../engine/screen.js';
import { C, ButtonSet, panel, rect, frame, setAccent } from '../engine/ui.js';
import { drawText } from '../engine/font.js';
import { TextField } from '../engine/textfield.js';
import { CORP_COLORS, SKIN_TONES, HAIR_COLORS } from '../data/corpColors.js';
import { characterSheet } from './floorWorld.js';
import { CHAR_W, CHAR_H } from '../engine/art.js';
import * as S from '../core/state.js';

const CORP_NAMES = ['Synergex', 'Globodyne', 'MegaCorp Holdings', 'Initech Prime', 'Paradigm Dynamics', 'Leverage Unlimited', 'Omnicorp Solutions', 'Bluesky Ventures', 'Strategix', 'Consolidated Widgets'];

export class SetupScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.color = 0;
    this.skin = 0;
    this.hair = 0;
    this.hairStyle = 0;
    this.buttons = new ButtonSet({ columns: 0 });
    this.error = '';
  }
  enter() {
    const scr = this.game.screen;
    this.corpField = new TextField(scr, { x: 20, y: 40, w: 180, h: 16, value: CORP_NAMES[Math.floor(Math.random() * CORP_NAMES.length)], maxLength: 22 });
    this.nameField = new TextField(scr, { x: 20, y: 76, w: 180, h: 16, value: '', placeholder: 'Your name', maxLength: 16 });
    this.resizeHandler = () => {
      this.corpField.layout();
      this.nameField.layout();
    };
    window.addEventListener('resize', this.resizeHandler);
    this.game.audio.play('title');
  }
  exit() {
    this.corpField?.destroy();
    this.nameField?.destroy();
    window.removeEventListener('resize', this.resizeHandler);
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    CORP_COLORS.forEach((c, i) => {
      b.add({ x: 20 + (i % 6) * 31, y: 110 + Math.floor(i / 6) * 22, w: 27, h: 18, label: '', color: c.color, onClick: () => (this.color = i) });
    });
    SKIN_TONES.forEach((s, i) => b.add({ x: 20 + i * 22, y: 176, w: 18, h: 14, label: '', color: s, onClick: () => (this.skin = i) }));
    HAIR_COLORS.forEach((h, i) => b.add({ x: 120 + i * 18, y: 176, w: 14, h: 14, label: '', color: h, onClick: () => (this.hair = i) }));
    ['A', 'B', 'C', 'D'].forEach((l, i) => b.add({ x: 20 + i * 24, y: 206, w: 20, h: 14, label: l, color: C.panelLight, onClick: () => (this.hairStyle = i) }));
    b.add({ x: 270, y: 224, w: 180, h: 22, label: 'Start my career  →', color: C.goodBtn, onClick: () => this.start() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  look() {
    const c = CORP_COLORS[this.color];
    return { skin: SKIN_TONES[this.skin], hair: HAIR_COLORS[this.hair], hairStyle: this.hairStyle, shirt: '#dfe6ee', jacket: null, pants: '#3a3f55', tie: null, shoes: '#2a1d14', badge: true, glasses: false, _c: c.id };
  }
  async start() {
    const corpName = this.corpField.value;
    const playerName = this.nameField.value;
    if (!corpName) {
      this.error = 'Your corporation needs a name.';
      this.game.sfx('bad');
      return this.corpField.focus();
    }
    if (!playerName) {
      this.error = 'HR needs your name for the badge.';
      this.game.sfx('bad');
      return this.nameField.focus();
    }
    track('career_start');
    const s = S.newGame({ corpName, colorId: CORP_COLORS[this.color].id, playerName, skin: this.skin, hair: this.hair }, this.game.now());
    s.player.hairStyle = this.hairStyle;
    this.game.setState(s);
    this.game.saveNow();
    const { ExteriorScene } = await import('./exterior.js');
    this.game.set(new ExteriorScene(this.game));
  }
  update(dt) {
    this.t += dt;
    this.build();
    setAccent(CORP_COLORS[this.color]);
    const typing = this.corpField?.focused || this.nameField?.focused;
    if (!typing) this.buttons.update(this.game.input, (n) => this.game.sfx(n));
    else if (this.game.input.pointer.clicked) {
      this.buttons.keyboard = false;
      this.buttons.update(this.game.input, (n) => this.game.sfx(n));
      this.buttons.keyboard = true;
    }
  }
  render(g) {
    const c = CORP_COLORS[this.color];
    rect(g, 0, 0, W, H, C.bg);
    for (let y = 0; y < H; y += 16) rect(g, 0, y, W, 1, 'rgba(255,255,255,0.03)');
    panel(g, 8, 8, 214, H - 16, { title: 'New Career' });
    drawText(g, 'Corporation name', 20, 30, { color: C.dim });
    drawText(g, 'Your name', 20, 66, { color: C.dim });
    drawText(g, `Colour: ${c.name}`, 20, 100, { color: C.dim });
    drawText(g, `(${c.hint})`, 200, 100, { color: C.dim, align: 'right' });
    drawText(g, 'Skin', 20, 166, { color: C.dim });
    drawText(g, 'Hair', 120, 166, { color: C.dim });
    drawText(g, 'Hair style', 20, 196, { color: C.dim });
    // field frames
    frame(g, 19, 39, 182, 18, C.gold);
    frame(g, 19, 75, 182, 18, C.gold);
    this.buttons.render(g);
    // Selected markers.
    const sel = (i, x, y, w, h) => frame(g, x - 2, y - 2, w + 4, h + 4, '#ffffff');
    sel(0, 20 + (this.color % 6) * 31, 110 + Math.floor(this.color / 6) * 22, 27, 18);
    sel(0, 20 + this.skin * 22, 176, 18, 14);
    sel(0, 120 + this.hair * 18, 176, 14, 14);
    sel(0, 20 + this.hairStyle * 24, 206, 20, 14);

    // Preview: badge card.
    panel(g, 240, 20, 220, 196, { fill: '#f4f1e8', light: '#ffffff', dark: '#c8c0aa' });
    rect(g, 241, 21, 218, 36, c.color);
    rect(g, 241, 55, 218, 2, c.dark);
    drawText(g, (this.corpField?.value || 'Your Corp').toUpperCase().slice(0, 22), 350, 28, { align: 'center', scale: 1, color: '#ffffff', shadow: c.dark });
    drawText(g, 'EMPLOYEE ID', 350, 42, { align: 'center', color: c.light });
    rect(g, 262, 70, 72, 92, c.light);
    rect(g, 264, 72, 68, 88, '#dfe8f0');
    const sheet = characterSheet(this.look());
    const frameIdx = Math.floor(this.t * 4) % 3;
    g.drawImage(sheet, frameIdx * CHAR_W, 0, CHAR_W, CHAR_H, 274, 78, CHAR_W * 3, CHAR_H * 3);
    drawText(g, this.nameField?.value || 'Your Name', 344, 80, { color: C.ink, scale: 1 });
    drawText(g, 'Unpaid Intern', 344, 94, { color: '#6a6050' });
    drawText(g, 'Floor 1 · Lobby', 344, 106, { color: '#6a6050' });
    drawText(g, 'Clearance: none', 344, 118, { color: '#6a6050' });
    for (let i = 0; i < 20; i++) rect(g, 344 + i * 5, 136, (i * 7) % 3 + 1, 18, C.ink);
    drawText(g, 'Valid until promoted', 350, 176, { align: 'center', color: '#8a8070' });
    rect(g, 330, 190, 40, 6, c.color);
    if (this.error) drawText(g, this.error, 270, 254, { color: C.bad });
    else drawText(g, 'Enter/Tab confirms a field. Arrows + Space to pick.', 242, 254, { color: C.dim });
  }
}
