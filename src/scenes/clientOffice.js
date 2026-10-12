// The client's office at the end of a business trip (spec 2026-10-12-business-trip): a FloorScene on the big client floor
// (core/clientFloor.js) with a 15-minute wall clock. Tasks pay double paperclips (MinigameScene mode 'trip'), the brewers
// are ready again after 2 minutes, and the lobby door is the way back to the office.
import { W } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatNum, formatTime } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { buildClientFloor } from '../core/clientFloor.js';
import * as T from '../core/trip.js';
import * as E from '../core/economy.js';
import { CLIENT_NPC_LINES, WRAP_LINES } from '../data/trip.js';
import { FloorScene } from './floorScene.js';
import { Dialog } from './overlays.js';
import { HUD_H } from './hud.js';

export class ClientOfficeScene extends FloorScene {
  /** floor: the trip floor the visit came from (10 or 30); the player goes back there afterwards. */
  constructor(game, floor) {
    super(game, floor, { arrival: 'entrance', fl: buildClientFloor(floor) });
    this.client = this.fl.client;
    this.taskMode = 'trip';
    this.leaving = false;
    // The lobby door doubles as the way out.
    const e = this.fl.entrance;
    this.exitItem = { x: e.x, y: e.y, w: e.w, h: 1 };
  }

  get brewerKey() {
    return T.BREWER_KEY;
  }

  enter() {
    const game = this.game;
    game.state.floor = this.floorNo;
    game.audio.play('exec');
    this.banner = 4;
    game.toast(`Client visit: ${formatTime(T.tripLeft(game.state, game.now()))}. Tasks pay double paperclips!`, C.gold);
  }

  resume() {
    this.game.audio.play('exec');
  }

  useCoffee() {
    return T.useBrewer(this.game.state, this.game.now());
  }

  /** The client's staff mostly talk about the client. */
  nextLine() {
    return this.rng.chance(0.7) ? this.rng.pick(CLIENT_NPC_LINES) : super.nextLine();
  }

  interactables() {
    return [...super.interactables(), { kind: 'exit', it: this.exitItem }];
  }

  /** The main entrance: out through it at any time, straight back to the office (the visit ends). */
  interact(t) {
    if (t.kind !== 'exit') return super.interact(t);
    this.pending = null;
    this.player.path = null;
    this.finish(true);
  }

  startTask(task) {
    if (!T.tripActive(this.game.state, this.game.now())) return this.finish();
    super.startTask(task);
  }

  update(dt) {
    super.update(dt);
    if (this.leaving || this.game.top !== this) return;
    if (!T.tripActive(this.game.state, this.game.now())) this.finish();
    else if (this.game.input.down('ArrowDown') && this.atDoor()) this.finish(true);
  }

  /** Walking down into the lobby doors (the doorway row is solid, so the player stops right above it). */
  atDoor() {
    const e = this.fl.entrance;
    const p = this.player;
    return p.x > e.x && p.x < e.x + e.w && p.y > e.y - 0.45;
  }

  /** Time is up: the wrap-up card, then back to the home floor. Leaving early (the main entrance) goes straight back. */
  finish(early = false) {
    if (this.leaving) return;
    this.leaving = true;
    const game = this.game;
    const sum = T.endTrip(game.state) || { floor: this.floorNo, sp: 0, tasks: 0 };
    track('trip_end', { floor: this.floorNo, sp: sum.sp, tasks: sum.tasks, early });
    game.saveNow();
    game.sfx(early ? 'door' : 'ding');
    const home = async () => {
      const { FloorScene: Home } = await import('./floorScene.js');
      game.set(new Home(game, this.floorNo, { arrival: 'elevator' }));
      game.toast(`Back at the office. The trip earned you ${formatNum(sum.sp)} paperclips in ${sum.tasks} task${sum.tasks === 1 ? '' : 's'}.`, C.gold);
    };
    if (early) return home();
    game.push(
      new Dialog(game, {
        title: "Time's up!",
        w: 300,
        text:
          `${this.rng.pick(WRAP_LINES)}\n` +
          `At ${this.client.name}: ${sum.tasks} task${sum.tasks === 1 ? '' : 's'}, +${formatNum(sum.sp)} paperclips (double pay).\n` +
          'The pool car takes you back to the office.',
        button: 'Drive back',
        onClose: home,
      }),
    );
  }

  render(g) {
    super.render(g);
    this.drawExitSign(g);
    this.drawClock(g);
  }

  /** A green EXIT sign over the lobby doors: the way back to the office, open at any time. */
  drawExitSign(g) {
    const e = this.fl.entrance;
    const x = Math.round((e.x + e.w / 2) * TILE - this.cam.x);
    const y = Math.round(e.y * TILE - this.cam.y) - 14;
    const w = measureText('EXIT') + 6;
    rect(g, x - w / 2, y, w, 10, C.border);
    rect(g, x - w / 2 + 1, y + 1, w - 2, 8, C.goodBtn);
    drawText(g, 'EXIT', x, y + 1, { align: 'center', color: C.text });
  }

  /** The visit clock under the HUD (top right): client name, time left, paperclips earned so far. */
  drawClock(g) {
    const s = this.game.state;
    const left = T.tripLeft(s, this.game.now());
    const t = formatTime(left);
    const earned = `+${formatNum(s.trip?.sp || 0)}`;
    const name = this.client.short.toUpperCase();
    const w = measureText(name) + measureText(t) + measureText(earned) + 46;
    const x = W - w - 4; // right-aligned: toasts take the middle
    const y = HUD_H + 3;
    const low = left < 60000;
    panel(g, x, y, w, 15, { fill: C.panelDark });
    drawText(g, name, x + 6, y + 4, { color: C.gold });
    let cx = x + 10 + measureText(name);
    icon(g, 'clock', cx, y + 4);
    cx += 10;
    if (!low || Math.floor(this.time * 3) % 2) drawText(g, t, cx, y + 4, { color: low ? C.bad : C.text });
    cx += measureText(t) + 6;
    icon(g, 'sp', cx, y + 4);
    drawText(g, earned, cx + 10, y + 4, { color: C.gold });
    rect(g, x + 1, y + 13, Math.round((w - 2) * Math.min(1, left / (E.TRIP_VISIT_S * 1000))), 1, low ? C.bad : C.good);
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 4 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, C.gold);
    rect(g, 0, y + 33, W, 1, C.gold);
    drawText(g, this.client.name.toUpperCase(), W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `Client visit · ${E.TRIP_VISIT_S / 60} minutes · double paperclips`, W / 2, y + 23, { align: 'center', color: C.gold });
    g.globalAlpha = 1;
  }
}
