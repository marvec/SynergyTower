// Workstation terminal overlay: a fake Linux shell (src/core/terminal.js) in a CRT-green window.
// Keyboard: type, Enter runs, Up/Down history, Tab completes, PgUp/PgDn or the wheel scroll, Esc closes.
import { W, H } from '../engine/screen.js';
import { C, rect, dim, frame, inRect } from '../engine/ui.js';
import { drawText, charWidth } from '../engine/font.js';
import { createShell, loginName } from '../core/terminal.js';
import { departmentForFloor } from '../data/departments.js';

const X = 12;
const Y = 14;
const WW = W - 24;
const HH = H - 26;
const BODY_Y = Y + 13;
const PAD = 6;
const LINE = 10;
const ROWS = Math.floor((HH - 13 - PAD * 2 + 2) / LINE);
const GREEN = '#5fd068';
const TEXT = '#b9c7b9';
const CMD = '#d8f5d8';

/** Splits text into lines no wider than maxW (character wrap: shell output has long tokens). */
function wrapChars(text, maxW) {
  const out = [];
  let line = '';
  let w = 0;
  for (const ch of text) {
    const cw = charWidth(ch) + 1;
    if (w + cw > maxW && line) {
      out.push(line);
      line = '';
      w = 0;
    }
    line += ch;
    w += cw;
  }
  out.push(line);
  return out;
}

export class TerminalScene {
  constructor(game, { floor, ws, onWarp }) {
    this.game = game;
    this.opaque = false;
    this.capturesKeys = true; // M, H, B... are letters here
    this.onWarp = onWarp;
    const s = game.state;
    this.shell = createShell({
      user: loginName(s.player.name),
      floor,
      maxFloor: s.maxFloor,
      deptId: departmentForFloor(floor).id,
      corp: s.corp.name,
      ws,
      now: game.now(),
    });
    this.lines = []; // wrapped display lines: { text, color }
    this.inputText = '';
    this.histPos = -1;
    this.scroll = 0;
    this.t = 0;
    this.closing = null; // { t, warp? }
    this.print([
      'SynergyOS 40 LTS (tty1)',
      '',
      'Last login: today 09:07 from the kitchen',
      'This workstation is monitored for quality and training purposes.',
      'Type "help" for commands, "exit" or Esc to close.',
      '',
    ]);
  }

  print(lines, color = TEXT) {
    for (const l of lines) {
      const c = l.startsWith('[  OK  ]') ? GREEN : color;
      for (const part of wrapChars(l, WW - PAD * 2)) this.lines.push({ text: part, color: c });
    }
    if (this.lines.length > 600) this.lines.splice(0, this.lines.length - 600);
  }

  close() {
    if (this.game.top === this) this.game.pop();
  }

  submit() {
    const cmd = this.inputText;
    this.print([this.shell.prompt() + cmd], CMD);
    this.inputText = '';
    this.histPos = -1;
    this.scroll = 0;
    const r = this.shell.run(cmd);
    if (r.clear) this.lines = [];
    this.print(r.out);
    if (r.warp) {
      this.game.sfx('ding');
      this.closing = { t: 1.4, warp: r.warp };
    } else if (r.exit) this.closing = { t: 0.25 };
    else this.game.sfx('type');
  }

  update(dt) {
    const input = this.game.input;
    this.t += dt;
    if (this.closing) {
      this.closing.t -= dt;
      if (this.closing.t <= 0) {
        const warp = this.closing.warp;
        this.close();
        if (warp) this.onWarp?.(warp);
      }
      return;
    }
    if (input.back()) {
      this.game.sfx('click');
      return this.close();
    }
    const p = input.pointer;
    if (p.clicked) {
      input.consumeClick();
      if (inRect(p, X + WW - 13, Y + 1, 12, 11) || !inRect(p, X, Y, WW, HH)) {
        this.game.sfx('click');
        return this.close();
      }
    }
    // Process keys in order: fast typing can put characters and Enter into the same frame.
    const hist = this.shell.history;
    for (const k of input.keySeq()) {
      if (this.closing) break;
      if (k.length === 1) {
        if (k >= ' ' && k <= '~' && this.inputText.length < 160) this.inputText += k;
        this.scroll = 0;
      } else if (k === 'Backspace') this.inputText = this.inputText.slice(0, -1);
      else if (k === 'Enter') this.submit();
      else if (k === 'Tab') this.inputText = this.shell.complete(this.inputText);
      else if (k === 'ArrowUp' && hist.length) {
        this.histPos = this.histPos < 0 ? hist.length - 1 : Math.max(0, this.histPos - 1);
        this.inputText = hist[this.histPos];
      } else if (k === 'ArrowDown' && this.histPos >= 0) {
        this.histPos++;
        if (this.histPos >= hist.length) {
          this.histPos = -1;
          this.inputText = '';
        } else this.inputText = hist[this.histPos];
      } else if (k === 'PageUp') this.scroll += ROWS - 2;
      else if (k === 'PageDown') this.scroll -= ROWS - 2;
    }
    const maxScroll = Math.max(0, this.lines.length + 1 - ROWS);
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + input.wheel() * -3));
  }

  render(g) {
    dim(g, 0.6);
    rect(g, X, Y, WW, HH, C.border);
    rect(g, X + 1, Y + 1, WW - 2, 11, '#3a3f4f');
    drawText(g, `Terminal - ${this.shell.user}@${this.shell.host}`, X + WW / 2, Y + 3, { align: 'center', color: '#c8cdd8' });
    for (const [i, c] of ['#e2504a', '#f2c14e', '#5fd068'].entries()) rect(g, X + 5 + i * 8, Y + 4, 5, 5, c);
    const hover = inRect(this.game.input.pointer, X + WW - 13, Y + 1, 12, 11);
    rect(g, X + WW - 13, Y + 2, 11, 9, hover ? C.bad : '#4a5068');
    drawText(g, 'x', X + WW - 8, Y + 2, { align: 'center', color: C.text });
    rect(g, X + 1, BODY_Y, WW - 2, HH - 14, '#070b08');
    // Scanlines for the CRT look.
    for (let y = BODY_Y; y < Y + HH - 1; y += 2) rect(g, X + 1, y, WW - 2, 1, 'rgba(95,208,104,0.025)');

    const prompt = this.shell.prompt();
    const inputLines = this.closing ? [] : wrapChars(prompt + this.inputText, WW - PAD * 2);
    const all = [...this.lines, ...inputLines.map((text) => ({ text, color: CMD, input: true }))];
    const end = all.length - this.scroll;
    const start = Math.max(0, end - ROWS);
    for (let i = start; i < end; i++) {
      const l = all[i];
      const y = BODY_Y + PAD + (i - start) * LINE;
      if (l.input && i === all.length - inputLines.length) {
        // Colour the prompt part of the first input line.
        const pw = drawText(g, prompt, X + PAD, y, { color: GREEN });
        drawText(g, l.text.slice(prompt.length), X + PAD + pw + 1, y, { color: l.color });
      } else drawText(g, l.text, X + PAD, y, { color: l.color });
    }
    if (!this.closing && this.scroll === 0 && Math.floor(this.t * 2) % 2 === 0) {
      const last = inputLines[inputLines.length - 1] || '';
      let cw = 0;
      for (const ch of last) cw += charWidth(ch) + 1;
      const row = Math.min(ROWS, all.length - start) - 1;
      rect(g, X + PAD + cw, BODY_Y + PAD + row * LINE, 4, 8, GREEN);
    }
    if (this.scroll > 0) drawText(g, `-- scrolled ${this.scroll} lines --`, X + WW - PAD, Y + HH - 11, { align: 'right', color: C.warn });
    frame(g, X, Y, WW, HH, C.border);
  }
}
