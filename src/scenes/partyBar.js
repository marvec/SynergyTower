// The party's bar (core/party.js drink): mulled wine, eggnog and Synergy Punch raise how tipsy you are, up to three;
// then the bartender only pours water, which sobers you up at once. No reward: drinks only make things wobblier.
import { C, rect } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import * as PA from '../core/party.js';
import { BARTENDER, DRINKS } from '../data/party.js';
import { Modal } from './overlays.js';

export class PartyBar extends Modal {
  constructor(game, { bartender = null } = {}) {
    super(game, { w: 280, h: 150, title: `Bar · ${bartender?.who?.name || BARTENDER.name}` });
    this.bartender = bartender;
    this.line = PA.tipsyLevel(game.state) >= PA.PARTY.maxTipsy ? BARTENDER.enough : 'What can I get you?';
  }
  build() {
    const s = this.game.state;
    const full = PA.tipsyLevel(s) >= PA.PARTY.maxTipsy;
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    DRINKS.forEach((d, i) => b.add({ x: this.x + 10 + i * 88, y: this.y + 80, w: 84, h: 18, label: d.label, color: '#8a2a3a', disabled: full, onClick: () => this.order(d.kind) }));
    b.add({ x: this.x + 10, y: this.y + 104, w: 128, h: 18, label: 'Water', color: '#2f6f8a', onClick: () => this.order('water') });
    b.add({ x: this.x + this.w - 138, y: this.y + 104, w: 128, h: 18, label: 'Back', onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  order(kind) {
    const game = this.game;
    const r = PA.drink(game.state, kind);
    if (!r.ok) {
      this.line = BARTENDER.enough;
      return game.sfx('bad');
    }
    track('party_drink', { kind });
    game.markDirty();
    game.sfx(kind === 'water' ? 'click' : 'coin');
    this.line = kind === 'water' ? BARTENDER.water : r.tipsy >= PA.PARTY.maxTipsy ? BARTENDER.enough : BARTENDER.serve[(game.state.party?.drinks || 0) % BARTENDER.serve.length];
    this.bartender?.say(this.line, 3);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const t = PA.tipsyLevel(s);
    drawText(g, `"${this.line}"`, x + this.w / 2, y + 20, { align: 'center', color: C.text });
    drawText(g, 'Free drinks. They only make things wobblier.', x + this.w / 2, y + 34, { align: 'center', color: C.dim });
    // "Tipsy" and its boxes, centred, clear of the drink buttons below
    const n = PA.PARTY.maxTipsy;
    const tx = Math.round(x + this.w / 2 - (measureText('Tipsy') + 6 + n * 12 - 3) / 2);
    const bx = tx + measureText('Tipsy') + 6;
    drawText(g, 'Tipsy', tx, y + 50, { color: C.dim });
    for (let i = 0; i < n; i++) rect(g, bx + i * 12, y + 50, 9, 7, i < t ? '#f29cd0' : '#3a3d48');
  }
}
