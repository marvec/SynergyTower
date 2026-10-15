// The basement archive (core/archive.js): a FloorScene on the archive's plan, dark in the night shift's style, with a
// five-minute clock (ARCHIVE.timeLimitS) that runs on the scene's own time (it stops whenever the game is paused or a card is open, never
// otherwise). Rows of HR cabinets to go through, one drawer at a time; the elevator takes you back up.
import { W, H } from '../engine/screen.js';
import { TILE } from '../engine/art.js';
import { C, rect, panel, icon, formatTime } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { LIGHTING } from '../engine/lighting.js';
import { isTouch } from '../engine/platform.js';
import * as A from '../core/archive.js';
import { pickLine } from '../core/curios.js';
import { DRAWER_LINES, FOLDER_FOUND, ARCHIVE_TIMEOUT, ARCHIVE_GIVE_UP } from '../data/archive.js';
import { FloorScene } from './floorScene.js';
import { darkLighting, lampsAt, drawNight } from './nightLights.js';
import { Dialog } from './overlays.js';

const URGENT_TINT = [1.5, 0.55, 0.5]; // the basement's dark turns red in the last seconds

export class ArchiveScene extends FloorScene {
  /** from: the floor the player came down from, and goes back up to. */
  constructor(game, from) {
    super(game, from, { arrival: 'elevator', fl: A.buildArchive() });
    this.from = from;
    this.left = A.ARCHIVE.timeLimitS; // seconds, counted down by update (scene time)
    this.over = false;
    this.search = null; // { it, t }: the drawer being gone through
    this.curios = []; // nothing down here but drawers and the elevator
    this.drawerMemo = {};
    // buildArchive() is shared between visits: every visit starts with the drawers shut.
    for (const it of this.fl.drawers) it.opened = false;
    this.hud.floorLabel = 'Archive';
    const config = Object.assign(Object.create(LIGHTING), { fog: A.ARCHIVE.fog });
    this.lighting = darkLighting(this.fl, lampsAt(A.archiveLamps(this.fl), 'archive'), { ambient: A.ARCHIVE.ambient ?? LIGHTING.ambient, config });
  }

  get music() {
    return 'nightshift';
  }

  enter() {
    const game = this.game;
    A.enterArchive(game.state);
    game.saveNow();
    game.audio.play(this.music);
    this.banner = 3.5;
    track('archive_enter', { floor: this.from });
  }

  /** The folder is in hand (found, not yet up in the elevator). */
  get found() {
    return !!A.archiveTask(this.game.state)?.found;
  }

  interactables() {
    return [...this.fl.drawers.map((it) => ({ kind: 'drawer', it })), { kind: 'elevator', it: this.fl.elevator }];
  }

  interact(t) {
    if (this.over) return;
    const game = this.game;
    const p = this.player;
    this.pending = null;
    p.path = null;
    if (t.kind === 'elevator') {
      game.sfx('ding');
      if (this.found) return this.leave('found');
      return game.push(new Dialog(game, { title: 'Elevator', w: 280, text: ARCHIVE_GIVE_UP, button: 'Keep looking', action: { label: 'Go back up', color: C.bad, onClick: () => this.leave('gave_up') } }));
    }
    const it = t.it;
    p.faceTowards(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y);
    if (it.opened) {
      game.sfx('click');
      return game.toast('Already been through that one.', C.dim);
    }
    if (this.found) return game.toast('You have the folder. To the elevator!', C.gold);
    if (this.search?.it !== it) this.search = { it, t: 0 };
  }

  update(dt) {
    if (this.over) return;
    super.update(dt);
    if (this.over || this.game.top !== this) return;
    const before = Math.ceil(this.left);
    this.left = Math.max(0, this.left - dt);
    if (this.left <= A.ARCHIVE.urgentS) {
      if (!this.urgent) {
        this.urgent = true;
        this.lighting.setAmbient(A.ARCHIVE.ambient ?? LIGHTING.ambient, URGENT_TINT);
      }
      if (Math.ceil(this.left) < before) this.game.sfx('blip');
    }
    if (this.left <= 0) return this.timeUp();
    this.updateSearch(dt);
  }

  /** Going through a drawer takes ARCHIVE.searchS standing still; walking away gives up on it. */
  updateSearch(dt) {
    const sr = this.search;
    if (!sr) return;
    const p = this.player;
    if (p.moving || this.distTo({ kind: 'drawer', it: sr.it }) > 1.6) {
      this.search = null;
      return;
    }
    const step = Math.floor(sr.t / 0.15);
    sr.t += dt;
    if (Math.floor(sr.t / 0.15) > step) this.game.sfx('type');
    if (sr.t < A.ARCHIVE.searchS) return;
    this.search = null;
    const it = sr.it;
    it.opened = true;
    const game = this.game;
    if (A.takeFolder(game.state, it.id)) {
      game.sfx('coin');
      game.toast(FOLDER_FOUND, C.gold);
      this.player.say('Got it!', 2);
      game.markDirty();
    } else if (this.rng.chance(A.ARCHIVE.flavorRate)) {
      const line = pickLine(DRAWER_LINES, this.drawerMemo);
      this.player.say(line, 2 + line.length / 30);
    }
  }

  /** The clock ran out: the folder stays down here, the task is off and security takes you back up. */
  timeUp() {
    this.over = true;
    const game = this.game;
    A.failArchive(game.state);
    track('archive_end', { floor: this.from, result: 'timeout' });
    game.saveNow();
    game.sfx('fail');
    game.push(new Dialog(game, { title: 'Out of time', w: 280, text: ARCHIVE_TIMEOUT, button: 'Back up', onClose: () => this.rideUp() }));
  }

  /** Into the elevator: with the folder (a success, the clock stops) or without it (the task is off). */
  leave(result) {
    if (this.over) return;
    this.over = true;
    const game = this.game;
    if (result === 'found') A.leaveWithFolder(game.state);
    else A.failArchive(game.state);
    track('archive_end', { floor: this.from, result, left: Math.ceil(this.left) });
    game.saveNow();
    if (result === 'found') game.toast(`Folder secured with ${formatTime(this.left * 1000)} to spare. Take it to HR on F${A.archiveTask(game.state).floor}.`, C.good);
    this.rideUp();
  }

  async rideUp() {
    const { ElevatorRide } = await import('./elevatorRide.js');
    this.game.set(new ElevatorRide(this.game, 0, this.from));
  }

  /** Dark like the night shift: the ceiling lights, the player's own light, the cabinets casting shadows. */
  drawDark(g) {
    drawNight(g, this.lighting, { fade: 1, cam: { x: Math.round(this.cam.x), y: Math.round(this.cam.y) }, player: this.player, t: this.time });
  }

  /** The drawer being searched gets a progress bar; once the folder is found, the elevator gets a marker. */
  drawMarkers(g) {
    // Drawn over the darkness, so the searched cabinets stay told apart even where no lamp reaches.
    for (const it of this.fl.drawers) if (it.opened) icon(g, 'check', it.x * TILE + 4, this.view.itemTop(it) - 2);
    const sr = this.search;
    if (sr) {
      const it = sr.it;
      const x = it.x * TILE;
      const y = this.view.itemTop(it) - 8;
      rect(g, x, y, 16, 5, C.border);
      rect(g, x + 1, y + 1, Math.round(14 * Math.min(1, sr.t / A.ARCHIVE.searchS)), 3, C.gold);
    }
    if (this.found) {
      const e = this.fl.elevator;
      const bob = Math.round(Math.sin(this.time * 4) * 1.5);
      const cx = Math.round((e.x + e.w / 2) * TILE);
      const y = this.view.itemTop(e) - 16 + bob;
      rect(g, cx - 6, y, 13, 12, C.border);
      rect(g, cx - 5, y + 1, 11, 10, C.goodBtn);
      icon(g, 'up', cx - 3, y + 3);
    }
  }

  drawPrompt(g) {
    const t = this.focus;
    if (!t) return;
    let text;
    let sub;
    if (t.kind === 'elevator') {
      text = 'Elevator';
      sub = this.found ? `back up to F${this.from} with the folder` : 'give up and go back up';
    } else {
      text = 'Filing cabinet';
      sub = t.it.opened ? 'checked' : this.search?.it === t.it ? 'searching...' : this.found ? 'you have the folder' : 'search the drawers';
    }
    const w = measureText(text) + measureText(sub) + 56;
    const x = 4;
    const y = H - 20;
    panel(g, x, y, w, 17, { fill: C.panelDark });
    rect(g, x + 4, y + 4, 30, 10, C.text);
    drawText(g, isTouch() ? 'TAP' : 'SPACE', x + 19, y + 5, { align: 'center', color: C.ink });
    drawText(g, text, x + 39, y + 5);
    drawText(g, sub, x + 44 + measureText(text), y + 5, { color: C.dim });
  }

  /** The archive clock under the HUD, in the night shift's style: red and blinking in the last seconds. */
  drawTimer(g, y) {
    const left = this.left * 1000;
    this.drawClockPanel(g, y, {
      name: 'ARCHIVE', color: '#e8c46a', left, total: A.ARCHIVE.timeLimitS * 1000, low: this.left <= A.ARCHIVE.urgentS,
      info: this.found ? 'got it' : 'find the folder', infoColor: this.found ? C.good : C.dim,
    });
    return true;
  }

  drawBanner(g) {
    const a = Math.min(1, this.banner, 3.5 - this.banner + 0.2);
    g.globalAlpha = Math.max(0, Math.min(1, a * 2));
    const y = 50;
    rect(g, 0, y, W, 34, 'rgba(13,15,24,0.8)');
    rect(g, 0, y, W, 1, '#e8c46a');
    rect(g, 0, y + 33, W, 1, '#e8c46a');
    drawText(g, 'ARCHIVE · BASEMENT', W / 2, y + 6, { align: 'center', scale: 2, color: C.text, shadow: C.border });
    drawText(g, `Find the lost folder at the far end: ${formatTime(A.ARCHIVE.timeLimitS * 1000)} on the clock`, W / 2, y + 23, { align: 'center', color: '#e8c46a' });
    g.globalAlpha = 1;
  }
}
