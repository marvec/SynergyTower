// The vacation hotel (spec 2026-10-13-vacation): a FloorScene on the resort map (core/hotel.js) with a 15-minute wall
// clock. Holiday activities (MinigameScene mode 'vacation') are free and pay a coffee each, once per stay; the main
// entrance at the top of the lobby is the way back to the office.
import { W, H } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatTime } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { createRng } from '../core/rng.js';
import { buildHotel } from '../core/hotel.js';
import { T_WATER } from '../core/floorgen.js';
import * as V from '../core/vacation.js';
import * as E from '../core/economy.js';
import { ACTIVITIES, HOTEL_NAME, HOTEL_LINES, HOTEL_WRAP_LINES } from '../data/vacation.js';
import { FloorScene } from './floorScene.js';
import { MinigameScene } from './minigameScene.js';
import { Dialog } from './overlays.js';
import { HUD_H } from './hud.js';

const SHIRTS = ['#e85d75', '#f29c38', '#2fa39a', '#f2e14e', '#7fc4ff', '#5fd068', '#f29cd0', '#ffffff'];
const SHORTS = ['#f2e6c8', '#3b6fb6', '#e2504a', '#2f8a3a', '#d9b25c'];

export class HotelScene extends FloorScene {
  constructor(game) {
    super(game, E.VACATION_FLOOR, { arrival: 'entrance', fl: buildHotel() });
    this.taskMode = 'vacation';
    this.leaving = false;
    const e = this.fl.entrance;
    this.exitItem = { x: e.x, y: e.y, w: e.w, h: 1 };
    // Holiday clothes: a loud shirt and shorts for you, summer clothes for the guests.
    this.player.setLook({ ...this.player.look, jacket: null, tie: null, badge: false, shirt: '#e85d75', pants: '#f2e6c8', shoes: '#8a5a3a' });
    const rng = createRng(2026);
    for (const n of this.npcs) {
      n.a.setLook({ ...n.a.look, jacket: null, tie: null, badge: false, shirt: rng.pick(SHIRTS), pants: rng.pick(SHORTS) });
      n.a.who.role = 'Hotel guest';
    }
    if (this.receptionist) this.receptionist.who.role = 'Concierge';
    this.view.afterFloor = (g) => this.drawWaves(g);
  }

  enter() {
    const game = this.game;
    game.state.floor = this.floorNo;
    game.audio.play('tropical');
    this.banner = 4;
    game.toast(`Welcome to paradise! ${formatTime(V.vacationLeft(game.state, game.now()))} of holiday. Every activity: +1 coffee.`, C.gold);
  }

  resume() {
    this.game.audio.play('tropical');
  }

  /** Guests talk about the holiday. */
  nextLine() {
    return this.rng.pick(HOTEL_LINES);
  }

  interactables() {
    return [...super.interactables(), ...this.fl.activities.map((it) => ({ kind: 'activity', it })), { kind: 'exit', it: this.exitItem }];
  }

  interact(t) {
    if (t.kind !== 'exit' && t.kind !== 'activity') return super.interact(t);
    this.pending = null;
    this.player.path = null;
    if (t.kind === 'exit') return this.finish(true);
    const it = t.it;
    const p = this.player;
    p.faceTowards(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y);
    this.openActivity(it.activity);
  }

  /** The activity card: what it is and what it pays; a done one can be played again just for fun. */
  openActivity(task) {
    const game = this.game;
    const a = ACTIVITIES.find((v) => v.game === task.game);
    const done = V.activityDone(game.state, task.game);
    game.sfx('click');
    game.push(
      new Dialog(game, {
        title: `${a.where} · ${a.title}`,
        w: 300,
        text:
          `${a.blurb}\n` +
          (done ? 'Done! Its coffee is already in your cup. Play again just for fun?' : `Free, it is all inclusive. Enjoy it (1 star or more) for +${E.VACATION_COFFEE} coffee to take back to the office.`),
        button: 'Later',
        action: { label: done ? 'Again, for fun' : "Let's go!", onClick: () => this.startActivity(task) },
      }),
    );
  }

  startActivity(task) {
    if (!V.vacationActive(this.game.state, this.game.now())) return this.finish();
    this.game.push(new MinigameScene(this.game, task, () => {}, { mode: 'vacation' }));
  }

  update(dt) {
    super.update(dt);
    if (this.leaving || this.game.top !== this) return;
    if (!V.vacationActive(this.game.state, this.game.now())) this.finish();
    else if (this.game.input.down('ArrowUp') && this.atDoor()) this.finish(true);
  }

  /** Walking up into the front doors (the doorway row is solid, so the player stops right below it). */
  atDoor() {
    const e = this.fl.entrance;
    const p = this.player;
    return p.x > e.x && p.x < e.x + e.w && p.y < e.y + 1.45;
  }

  /** Time is up: the wrap-up card, then floor 20. Checking out early (the front door) goes straight back. */
  finish(early = false) {
    if (this.leaving) return;
    this.leaving = true;
    const game = this.game;
    const sum = V.endVacation(game.state) || { coffee: 0, activities: 0 };
    track('vacation_end', { coffee: sum.coffee, activities: sum.activities, early });
    game.saveNow();
    game.sfx(early ? 'door' : 'ding');
    const cups = `${sum.coffee} extra coffee${sum.coffee === 1 ? '' : 's'}`;
    const home = async () => {
      const { FloorScene: Office } = await import('./floorScene.js');
      game.set(new Office(game, E.VACATION_FLOOR, { arrival: 'elevator' }));
      game.toast(`Back at the office, rested, with ${cups} from the holiday.`, C.coffee);
    };
    if (early) return home();
    game.push(
      new Dialog(game, {
        title: 'Back to work',
        w: 300,
        text: `${this.rng.pick(HOTEL_WRAP_LINES)}\n${sum.activities} activit${sum.activities === 1 ? 'y' : 'ies'} enjoyed, ${cups} to take back.`,
        button: 'Back to the office',
        onClose: home,
      }),
    );
  }

  render(g) {
    super.render(g);
    this.drawExitSign(g);
    this.drawClock(g);
  }

  /** Waves on the sea and ripples in the pool, drawn on the floor under everything else (FloorView.afterFloor). */
  drawWaves(g) {
    const fl = this.fl;
    const t = this.view.time;
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE));
    const x1 = Math.min(fl.w - 1, Math.ceil((this.cam.x + W) / TILE));
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE));
    const y1 = Math.min(fl.h - 1, Math.ceil((this.cam.y + H) / TILE));
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (fl.tiles[y * fl.w + x] !== T_WATER) continue;
        const ph = t * 1.6 + x * 0.7 + y * 1.3;
        if (Math.sin(ph) < 0.55) continue;
        g.fillRect(x * TILE + ((x * 7 + y * 3) % 10), y * TILE + 4 + Math.round(Math.sin(ph * 0.5) * 3) + ((x + y) % 2) * 6, 3, 1);
      }
  }

  /** Activity markers: a coffee cup to win, a tick once enjoyed. */
  drawMarkers(g, s, now) {
    super.drawMarkers(g, s, now);
    const bob = Math.round(Math.sin(this.time * 4) * 1.5);
    for (const it of this.fl.activities) {
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const y = this.view.itemTop(it) - 16 + bob;
      const done = V.activityDone(s, it.activity.game);
      rect(g, cx - 6, y, 13, 12, C.border);
      rect(g, cx - 5, y + 1, 11, 10, done ? C.goodBtn : '#fbf8ef');
      rect(g, cx - 1, y + 12, 3, 2, C.border);
      icon(g, done ? 'check' : 'coffee', cx - 3, y + 3);
    }
  }

  drawPrompt(g, s, now) {
    const t = this.focus;
    if (t?.kind !== 'activity') return super.drawPrompt(g, s, now);
    const a = t.it.activity;
    const text = a.title;
    const sub = V.activityDone(s, a.game) ? 'done, play for fun' : `+${E.VACATION_COFFEE} coffee`;
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
  }

  /** A green EXIT sign over the front doors: check out and back to the office, at any time. */
  drawExitSign(g) {
    const e = this.fl.entrance;
    const x = Math.round((e.x + e.w / 2) * TILE - this.cam.x);
    const y = Math.round(e.y * TILE - this.cam.y) - 14;
    const w = measureText('EXIT') + 6;
    rect(g, x - w / 2, y, w, 10, C.border);
    rect(g, x - w / 2 + 1, y + 1, w - 2, 8, C.goodBtn);
    drawText(g, 'EXIT', x, y + 1, { align: 'center', color: C.text });
  }

  /** The holiday clock under the HUD (top right): time left and the coffee won so far. */
  drawClock(g) {
    const s = this.game.state;
    const left = V.vacationLeft(s, this.game.now());
    const t = formatTime(left);
    const won = `+${s.vacation?.coffee || 0}`;
    const name = 'PARADISE PALMS';
    const w = measureText(name) + measureText(t) + measureText(won) + 46;
    const x = W - w - 4;
    const y = HUD_H + 3;
    const low = left < 60000;
    panel(g, x, y, w, 15, { fill: C.panelDark });
    drawText(g, name, x + 6, y + 4, { color: C.gold });
    let cx = x + 10 + measureText(name);
    icon(g, 'clock', cx, y + 4);
    cx += 10;
    if (!low || Math.floor(this.time * 3) % 2) drawText(g, t, cx, y + 4, { color: low ? C.bad : C.text });
    cx += measureText(t) + 6;
    icon(g, 'coffee', cx, y + 4);
    drawText(g, won, cx + 10, y + 4, { color: C.coffee });
    rect(g, x + 1, y + 13, Math.round((w - 2) * Math.min(1, left / (E.VACATION_S * 1000))), 1, low ? C.bad : C.good);
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 4 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, C.gold);
    rect(g, 0, y + 33, W, 1, C.gold);
    drawText(g, HOTEL_NAME.toUpperCase(), W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    const sub = `Ultra all inclusive · ${E.VACATION_S / 60} minutes · every activity +1 coffee`;
    drawText(g, sub, W / 2, y + 23, { align: 'center', color: C.gold });
    for (let i = 0; i < 5; i++) icon(g, 'star', W / 2 - measureText(sub) / 2 - 44 + i * 8, y + 23);
    g.globalAlpha = 1;
  }
}
