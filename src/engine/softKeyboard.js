// The phone's on-screen keyboard for canvas text UIs (the workstation terminal). An invisible <input> lies over a
// game rect: tapping it focuses it natively (the only way iOS opens the keyboard), and what is typed is replayed
// into the game's input as key presses. Phone keyboards rarely send usable keydown events (Android reports
// 'Unidentified' while composing words), so typing is read from the field's value instead: every change is diffed
// against the previous value into Backspaces and characters.
const SENTINEL = String.fromCharCode(0x200b); // keeps the field non-empty, so Backspace at the start still produces an input event
const PASS_KEYS = new Set(['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);

export class SoftKeyboard {
  constructor(screen, input, rect) {
    this.screen = screen;
    this.input = input;
    this.rect = rect;
    const el = (this.el = document.createElement('input'));
    el.type = 'text';
    el.autocomplete = 'off';
    el.spellcheck = false;
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('enterkeyhint', 'go');
    el.setAttribute('aria-label', 'Type a command');
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '5',
      opacity: '0',
      border: '0',
      padding: '0',
      margin: '0',
      background: 'transparent',
      color: 'transparent',
      caretColor: 'transparent',
      fontSize: '16px', // iOS zooms into fields with smaller text
    });
    this.prev = SENTINEL;
    el.value = SENTINEL;
    el.addEventListener('input', () => this.sync());
    // A hardware keyboard on a tablet: Enter, Tab, history and Escape still arrive as keys.
    el.addEventListener('keydown', (e) => {
      if (!PASS_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Enter') this.reset();
      this.press(e.key);
    });
    document.body.appendChild(el);
    this.layout();
  }
  get focused() {
    return document.activeElement === this.el;
  }
  press(key) {
    this.input.keyDown(key);
    this.input.queueKey(key);
    this.input.keyUp(key);
  }
  sync() {
    let cur = this.el.value;
    if (!cur.startsWith(SENTINEL)) {
      // The sentinel itself was deleted: that was one more Backspace.
      cur = SENTINEL + cur;
      this.el.value = cur;
      this.press('Backspace');
    }
    const prev = this.prev;
    let same = 0;
    while (same < prev.length && same < cur.length && prev[same] === cur[same]) same++;
    for (let i = same; i < prev.length; i++) this.press('Backspace');
    for (const ch of cur.slice(same)) {
      this.input.queueKey(ch);
      this.input.typeChar(ch);
    }
    this.prev = cur;
    if (cur.length > 200) this.reset();
  }
  reset() {
    this.el.value = this.prev = SENTINEL;
  }
  layout() {
    const r = this.screen.toClient(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    const s = this.el.style;
    const v = (n) => `${Math.round(n)}px`;
    if (s.left !== v(r.left) || s.top !== v(r.top) || s.width !== v(r.width) || s.height !== v(r.height))
      Object.assign(s, { left: v(r.left), top: v(r.top), width: v(r.width), height: v(r.height) });
  }
  destroy() {
    this.el.blur();
    this.el.remove();
  }
}
