// Floor quests: mini-games whose first half is played on the floor itself, against the clock.
//   feedback: find a named colleague and chat with them (earlier chats don't count), then write their 360 review.
//   lostpw:   mobile whiteboards roll in when the task starts; one shows your pet. Then log back in at the desk.
// The FloorScene owns one FloorQuest at a time and routes interactions here; the desk half is a normal mini-game.
import { TILE, CHAR_W, CHAR_H } from '../engine/art.js';
import { C, rect, frame, panel, icon, bar } from '../engine/ui.js';
import { drawText, measureText } from '../engine/font.js';
import * as S from '../core/state.js';
import { placeProps, speedBonus } from '../core/quests.js';
import { loginName } from '../core/terminal.js';
import { byDiff } from '../engine/mgkit.js';
import { MINIGAMES } from '../minigames/index.js';
import { feedbackFacts } from '../minigames/feedback.js';
import { lostPassword } from '../minigames/lostpw.js';
import { BRAG_LINES, ADMIT_LINES, GREETINGS } from '../data/mg-feedback.js';
import { PETS, SPECIES_NAME, DECOY_BOARDS } from '../data/mg-lostpw.js';
import { FIRST_NAMES } from '../data/people.js';
import { Modal, Dialog } from './overlays.js';
import { MinigameScene } from './minigameScene.js';
import { HUD_H } from './hud.js';

const MARKERS = ['#2a4a9a', '#a33b30', '#2f7f3a', '#22242e'];

/** A mobile whiteboard on wheels, rolled onto the floor for the Lost Password quest. Sorts like an actor. */
class QuestBoard {
  constructor(tx, ty, content) {
    this.tx = tx;
    this.ty = ty;
    this.x = tx + 0.5;
    this.y = ty + 0.9;
    this.content = content; // { pet: { species, name, owner, color } } or { note: { title, lines } }
    this.checked = false;
    this.it = { x: tx, y: ty, w: 1, h: 1, top: ty * TILE - 22 };
  }
  draw(g) {
    const cx = this.tx * TILE + 8;
    const base = this.ty * TILE + 15;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(cx - 10, base - 1, 20, 3);
    rect(g, cx - 8, base - 9, 1, 9, '#5a5f70');
    rect(g, cx + 7, base - 9, 1, 9, '#5a5f70');
    rect(g, cx - 10, base - 1, 5, 1, '#5a5f70');
    rect(g, cx + 5, base - 1, 5, 1, '#5a5f70');
    rect(g, cx - 10, base, 2, 2, C.border);
    rect(g, cx + 8, base, 2, 2, C.border);
    const bx = cx - 11;
    const by = base - 24;
    rect(g, bx, by, 22, 16, '#8a90a2');
    rect(g, bx + 1, by + 1, 20, 13, '#f8f8f4');
    rect(g, bx + 1, by + 14, 20, 1, '#5a5f70');
    // Scribbles hint at what is on the board.
    const c = this.content;
    if (c.pet) {
      rect(g, bx + 4, by + 4, 7, 6, c.pet.color);
      rect(g, bx + 5, by + 3, 2, 2, c.pet.color);
      rect(g, bx + 13, by + 5, 6, 1, MARKERS[0]);
      rect(g, bx + 13, by + 8, 4, 1, MARKERS[1]);
    } else {
      rect(g, bx + 3, by + 3, 12, 1, MARKERS[1]);
      rect(g, bx + 3, by + 6, 15, 1, MARKERS[0]);
      rect(g, bx + 3, by + 9, 9, 1, MARKERS[2]);
      rect(g, bx + 3, by + 12, 13, 1, MARKERS[0]);
    }
  }
  drawBubble() {}
}

/** Close-up of a whiteboard. */
class BoardView extends Modal {
  constructor(game, board) {
    super(game, { w: 300, h: 176, title: 'Whiteboard' });
    this.board = board;
  }
  build() {
    this.buttons.clear();
    this.buttons.add({ x: this.x + this.w / 2 - 40, y: this.y + this.h - 24, w: 80, h: 18, label: 'OK', onClick: () => this.close() });
  }
  renderBody(g, x, y) {
    const bx = x + 10;
    const by = y + 4;
    const bw = this.w - 20;
    const bh = 128;
    rect(g, bx - 2, by - 2, bw + 4, bh + 4, '#8a90a2');
    rect(g, bx, by, bw, bh, '#f8f8f4');
    rect(g, bx + 8, by + bh - 6, 30, 3, MARKERS[0]); // marker tray
    rect(g, bx + 42, by + bh - 6, 30, 3, MARKERS[1]);
    const c = this.board.content;
    if (c.pet) {
      const pet = PETS[c.pet.species];
      const s = 7;
      const px = bx + 18;
      const py = by + 14;
      // A "photo" taped to the board.
      rect(g, px - 6, py - 6, 12 * s + 12, 12 * s + 12, '#ffffff');
      frame(g, px - 6, py - 6, 12 * s + 12, 12 * s + 12, '#c8cdd8');
      rect(g, px - 6, py - 6, 12 * s + 12, 12 * s + 12, 'rgba(255,240,200,0.25)');
      rect(g, px + 30, py - 10, 24, 6, 'rgba(240,220,120,0.8)');
      pet.map.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          const ch = row[xx];
          if (ch === '.') continue;
          rect(g, px + xx * s, py + yy * s, s, s, ch === 'k' ? '#22242e' : ch === 'w' ? '#ffffff' : ch === 'p' ? '#e88a9a' : c.pet.color);
        }
      });
      const tx = px + 12 * s + 18;
      drawText(g, c.pet.name.toUpperCase(), tx, by + 30, { scale: 2, color: MARKERS[0] });
      drawText(g, `${c.pet.owner}'s ${SPECIES_NAME[c.pet.species]}`, tx, by + 52, { color: MARKERS[1] });
      // Hand-drawn heart.
      const hx = tx + 4;
      const hy = by + 72;
      for (const [dx, dy, w] of [[1, 0, 2], [5, 0, 2], [0, 1, 4], [4, 1, 4], [0, 2, 8], [1, 3, 6], [2, 4, 4], [3, 5, 2]]) rect(g, hx + dx * 2, hy + dy * 2, w * 2, 2, MARKERS[1]);
      drawText(g, 'best colleague ever', tx, by + 90, { color: MARKERS[2] });
    } else {
      const n = c.note;
      drawText(g, n.title, bx + bw / 2, by + 12, { align: 'center', scale: 2, color: MARKERS[1] });
      n.lines.forEach((l, i) => drawText(g, l, bx + 30, by + 44 + i * 16, { color: MARKERS[[0, 2, 3][i % 3]] }));
      // Doodle: a box with an arrow.
      rect(g, bx + bw - 60, by + 50, 34, 1, MARKERS[0]);
      rect(g, bx + bw - 60, by + 74, 34, 1, MARKERS[0]);
      rect(g, bx + bw - 60, by + 50, 1, 25, MARKERS[0]);
      rect(g, bx + bw - 27, by + 50, 1, 25, MARKERS[0]);
      rect(g, bx + bw - 44, by + 76, 1, 20, MARKERS[2]);
      for (let k = 0; k < 4; k++) rect(g, bx + bw - 47 + k, by + 92 + k, 7 - k * 2, 1, MARKERS[2]);
    }
  }
}

export class FloorQuest {
  constructor(scene, task) {
    this.scene = scene;
    this.game = scene.game;
    this.task = task;
    this.kind = MINIGAMES[task.game].quest;
    const d = task.difficulty;
    this.d = d;
    const rng = scene.rng;
    this.station = scene.fl.items.find((it) => it.task?.id === task.id);
    this.phase = 'search';
    this.boards = [];
    const p = scene.player;
    if (this.kind === 'feedback') {
      this.limit = Math.round(byDiff(d, 80, 55));
      const pool = scene.npcs.filter((n) => !n.brain.exit);
      this.target = rng.pick(pool);
      const facts = feedbackFacts(rng, scene.fl.dept);
      const id = this.target.id;
      this.data = { ...facts, name: id.name, role: id.role, years: id.years };
    } else {
      this.limit = Math.round(byDiff(d, 75, 50));
      const decoys = Math.round(byDiff(d, 0, 3));
      this.data = lostPassword(rng, decoys);
      const s = this.game.state;
      this.data.user = loginName(s.player.name);
      const count = Math.round(byDiff(d, 3, 6));
      const st = this.station;
      const spots = placeProps(scene.fl, rng, Math.max(count, decoys + 2), [
        { x: p.x, y: p.y, r: 5 },
        { x: st.x + st.w / 2, y: st.y + st.h / 2, r: 4 },
        { x: scene.fl.spawn.x, y: scene.fl.spawn.y, r: 5 },
      ]);
      const color = (sp) => rng.pick(PETS[sp].colors);
      const owner = s.player.name.split(' ')[0] || 'Your';
      this.owner = owner;
      const contents = [{ pet: { ...this.data.pet, owner, color: color(this.data.pet.species), mine: true } }];
      for (const dp of this.data.decoys) {
        let o = rng.pick(FIRST_NAMES);
        while (o === owner) o = rng.pick(FIRST_NAMES);
        contents.push({ pet: { ...dp, owner: o, color: color(dp.species) } });
      }
      for (const note of rng.shuffle([...DECOY_BOARDS])) if (contents.length < spots.length) contents.push({ note });
      const order = rng.shuffle(contents.slice(0, spots.length));
      if (!order.some((c) => c.pet?.mine)) order[0] = contents[0];
      this.boards = spots.map((sp, i) => new QuestBoard(sp.x, sp.y, order[i]));
      this.game.sfx('door');
    }
    this.deadline = this.game.now() + this.limit * 1000;
    this.over = false;
    this.time = 0;
  }

  get left() {
    return Math.max(0, (this.deadline - this.game.now()) / 1000);
  }
  get props() {
    return this.boards;
  }
  get objective() {
    if (this.kind === 'feedback') return this.phase === 'search' ? `Find ${this.data.name} and have a chat` : `Back to "${this.task.title}" to write it up`;
    return this.phase === 'search' ? `Find ${this.owner}'s ${SPECIES_NAME[this.data.pet.species]} (yours!) on a whiteboard` : 'Back to your desk to log in';
  }
  stationSub() {
    if (this.kind === 'feedback') return this.phase === 'search' ? `find ${this.data.name.split(' ')[0]} first` : 'write the review';
    return this.phase === 'search' ? 'try to log in anyway' : 'log in';
  }
  isStation(it) {
    return it === this.station;
  }

  update(dt) {
    this.time += dt;
    if (!this.over && this.left <= 0) {
      this.fail(this.kind === 'feedback' ? `${this.data.name} went home for the day. Review deadline missed.` : 'IT locked your account for "suspicious inactivity".', "Time's up");
    }
  }

  /** Talking during the quest. Returns true when the quest handled it. */
  onTalk(n) {
    if (this.kind !== 'feedback' || n !== this.target) return false;
    const rng = this.scene.rng;
    const f = this.data;
    const brag = rng.pick(BRAG_LINES).replace('{a}', f.achievement);
    const admit = rng.pick(ADMIT_LINES).replace('{g}', f.growth);
    n.a.say(this.phase === 'search' ? rng.pick(GREETINGS) : 'Like I said...', 3);
    n.brain.talkPause = 5;
    this.game.sfx('blip');
    if (this.phase === 'search') {
      this.phase = 'return';
      this.game.sfx('good');
    }
    this.game.push(
      new Dialog(this.game, {
        title: `${f.name} · ${f.role}`,
        w: 300,
        text: `"${brag}"\n"${admit}"\n"Been here ${f.years} year${f.years === 1 ? '' : 's'} now. Time flies."`,
        button: 'Noted',
      }),
    );
    return true;
  }

  /** Colleagues who are not the target sometimes point you the right way. */
  hintLine(n) {
    if (this.kind !== 'feedback' || this.phase !== 'search' || n === this.target || !this.scene.rng.chance(0.6)) return null;
    const t = this.target.a;
    const dx = t.x - n.a.x;
    const dy = t.y - n.a.y;
    const where = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'off to the left' : 'off to the right') : dy < 0 ? 'up towards the elevators' : 'down the south side';
    return `${this.data.name.split(' ')[0]}? Saw them ${where}.`;
  }

  inspect(b) {
    this.game.sfx('click');
    b.checked = true;
    if (b.content.pet?.mine && this.phase === 'search') {
      this.phase = 'return';
      this.data.seen = true;
      this.game.sfx('good');
    }
    this.game.push(new BoardView(this.game, b));
  }

  atStation() {
    if (this.kind === 'feedback' && this.phase === 'search') {
      this.game.sfx('bad');
      this.game.toast(`Talk to ${this.data.name} first. Hallway chats from before don't count.`, C.warn);
      return;
    }
    this.over = true;
    this.scene.quest = null;
    const quest = { ...this.data, speed: speedBonus(this.left, this.limit) };
    this.game.push(new MinigameScene(this.game, { ...this.task, quest }, (r) => this.scene.taskDone(r)));
  }

  giveUp() {
    this.fail('You gave up. Coffee is not refunded.', 'Task abandoned');
  }

  fail(text, title) {
    const game = this.game;
    this.over = true;
    this.scene.quest = null;
    S.completeTask(game.state, this.task, game.state.floor, 0, game.now());
    game.markDirty();
    game.saveNow();
    game.sfx('fail');
    game.push(new Dialog(game, { title, text: `${text}\nNo KPI stars this time.`, w: 260 }));
  }

  /** World-space markers (inside the camera transform). */
  renderWorld(g) {
    const bob = Math.round(Math.sin(this.time * 5) * 1.5);
    for (const b of this.boards) {
      const cx = b.tx * TILE + 8;
      const y = b.ty * TILE - 22 + bob;
      if (b.checked) icon(g, 'check', cx - 3, y);
      else {
        rect(g, cx - 4, y - 2, 9, 10, C.border);
        rect(g, cx - 3, y - 1, 7, 8, C.xp);
        drawText(g, '?', cx + 1, y - 1, { align: 'center', color: C.ink });
      }
    }
    if (this.phase === 'return' && this.station) {
      const it = this.station;
      const cx = Math.round((it.x + it.w / 2) * TILE);
      const y = this.scene.view.itemTop(it) - 30 + bob;
      rect(g, cx - 6, y, 12, 9, C.border);
      rect(g, cx - 5, y + 1, 10, 7, C.good);
      for (let k = 0; k < 4; k++) rect(g, cx - 4 + k, y + 9 + k, 8 - k * 2, 1, C.good);
    }
    if (this.kind === 'feedback' && this.phase === 'search' && this.d < 0.3) {
      const a = this.target.a;
      const cx = Math.round(a.x * TILE);
      const y = Math.round(a.y * TILE) - CHAR_H - 12 + bob;
      rect(g, cx - 4, y, 9, 10, C.border);
      rect(g, cx - 3, y + 1, 7, 8, C.xp);
      drawText(g, '?', cx + 1, y + 1, { align: 'center', color: C.ink });
    }
  }

  /** Screen-space objective panel under the HUD. */
  renderHud(g) {
    const portrait = this.kind === 'feedback';
    const obj = this.objective;
    const w = Math.max(200, measureText(obj) + (portrait ? 34 : 14), measureText(this.task.title) + 150);
    const x = 4;
    const y = HUD_H + 3;
    panel(g, x, y, w, 32, { fill: C.panelDark });
    let tx = x + 6;
    if (portrait) {
      rect(g, x + 4, y + 4, 18, 24, '#2b2e3c');
      g.drawImage(this.target.a.sheet, 0, 0, CHAR_W, CHAR_H, x + 5, y + 5, CHAR_W, CHAR_H);
      tx = x + 26;
    }
    drawText(g, this.task.title, tx, y + 4, { color: C.gold });
    drawText(g, 'G: give up', x + w - 6, y + 4, { align: 'right', color: C.dim });
    drawText(g, obj, tx, y + 14, { color: C.text });
    const left = this.left;
    const f = left / this.limit;
    bar(g, tx, y + 25, w - (tx - x) - 34, 4, f, f > 0.5 ? C.good : f > 0.2 ? C.warn : C.bad);
    drawText(g, `${Math.ceil(left)}s`, x + w - 6, y + 23, { align: 'right', color: f > 0.2 ? C.text : C.bad });
    if (this.kind === 'lostpw') {
      const seen = this.boards.filter((b) => b.checked).length;
      drawText(g, `${seen}/${this.boards.length} boards`, x + w - 66, y + 4, { align: 'right', color: C.dim });
    }
  }
}
