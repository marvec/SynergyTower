// The Daily Memo card (core/memo.js), opened from the lobby noticeboard: today's game with Play (one attempt), or
// today's result with Share. It reads the date every frame, so it turns to the next Memo at midnight.
import { C } from '../engine/ui.js';
import { drawText, drawWrapped } from '../engine/font.js';
import * as M from '../core/memo.js';
import { DEPARTMENTS } from '../data/departments.js';
import { MEMO_BLURB, MEMO_DONE, MEMO_TITLE, MEMO_WARNING } from '../data/memo.js';
import { MINIGAMES } from '../minigames/index.js';
import { Modal, drawStarsLarge } from './overlays.js';
import { shareMemo } from './minigameScene.js';

export class MemoCard extends Modal {
  /** onPlay(): starts today's attempt (FloorScene#startMemo). */
  constructor(game, { onPlay }) {
    super(game, { w: 300, h: 134, title: MEMO_TITLE });
    this.onPlay = onPlay;
  }
  /** Today's Memo number. */
  get n() {
    return M.memoNumber(this.game.now());
  }
  /** Today's result, once played. */
  get result() {
    return M.memoResult(this.game.state, this.n);
  }
  build() {
    const b = this.buttons;
    const f = b.focus;
    b.clear();
    const by = this.y + this.h - 26;
    const pending = M.memoStatus(this.game.state, this.game.now()) === 'pending';
    const r = this.result;
    this.title = `${MEMO_TITLE} #${this.n}`;
    if (pending) b.add({ x: this.x + 60, y: by, w: 86, h: 18, label: 'Play', color: C.goodBtn, onClick: () => (this.close(), this.onPlay()) });
    else if (r) b.add({ x: this.x + 60, y: by, w: 86, h: 18, label: 'Share', color: C.accent, onClick: () => shareMemo(this.game, r, MINIGAMES[r.game].name) });
    b.add({ x: this.x + (b.items.length ? 154 : 107), y: by, w: 86, h: 18, label: 'Close', color: C.panelLight, onClick: () => this.close() });
    b.focus = Math.min(f, b.items.length - 1);
  }
  renderBody(g, x, y) {
    const s = this.game.state;
    const now = this.game.now();
    const n = M.memoNumber(now);
    const memo = M.memoFor(n);
    const r = M.memoResult(s, n);
    const streak = M.memoStreak(s, now);
    const cx = x + this.w / 2;
    drawText(g, MINIGAMES[memo.game].name, cx, y + 6, { align: 'center', color: C.gold });
    drawText(g, `Theme: ${DEPARTMENTS.find((d) => d.id === memo.dept).name}`, cx, y + 17, { align: 'center', color: C.dim });
    if (r) {
      drawStarsLarge(g, r.stars, cx, y + 30);
      drawText(g, `Score ${r.score.toFixed(2)}  -  streak ${streak} (best ${s.memo.best})`, cx, y + 56, { align: 'center' });
      drawText(g, MEMO_DONE, cx, y + 70, { align: 'center', color: C.dim });
    } else {
      drawWrapped(g, MEMO_BLURB, x + 14, y + 32, this.w - 28);
      drawText(g, MEMO_WARNING, cx, y + 64, { align: 'center', color: C.warn });
      if (streak) drawText(g, `Memo streak: ${streak}`, cx, y + 78, { align: 'center', color: C.dim });
    }
  }
}
