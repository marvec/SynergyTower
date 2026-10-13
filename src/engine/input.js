// Unified input: keyboard state, per-frame presses, typed characters and a pointer in game coordinates.
import { linkUnder } from './ui.js';
import { openExternal } from './platform.js';
// Key names follow KeyboardEvent.key, normalised: 'ArrowUp', ' ' → 'Space', letters lowercase.
const KEY_ALIASES = { w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' };

export function createInput() {
  const down = new Set();
  let pressed = new Set();
  let typed = [];
  let seq = []; // every key press this frame, in order (raw KeyboardEvent.key, repeats included)
  // touch: the last pointer was a finger (buttons then forgive near misses, see ButtonSet)
  const pointer = { x: -1, y: -1, down: false, clicked: false, released: false, moved: false, inside: false, touch: false };
  let nextClick = false;
  let nextRelease = false;
  let wheel = 0;
  let nextWheel = 0;

  const norm = (k) => (k === ' ' ? 'Space' : k.length === 1 ? k.toLowerCase() : k);

  const input = {
    pointer,
    /** Raw key (exact) or movement alias (WASD act as arrows unless `exact`). */
    down: (k) => down.has(k) || [...down].some((d) => KEY_ALIASES[d] === k),
    pressed: (k) => pressed.has(k) || [...pressed].some((d) => KEY_ALIASES[d] === k),
    pressedExact: (k) => pressed.has(k),
    anyPressed: (...keys) => keys.some((k) => input.pressed(k)),
    confirm: () => pressed.has('Space') || pressed.has('Enter'),
    back: () => pressed.has('Escape'),
    typed: () => typed,
    /** Ordered key presses for text UIs that mix characters with Enter/Tab/arrows within one frame. */
    keySeq: () => seq,
    queueKey(key) {
      seq.push(key);
    },
    wheel: () => wheel,
    /** Marks the current click as handled so lower layers ignore it. */
    consumeClick() {
      pointer.clicked = false;
    },
    /** Drops a click that hasn't reached the game yet (it was handled outside the loop, e.g. by a link). */
    cancelClick() {
      pointer.clicked = false;
      nextClick = false;
    },
    consumeKeys() {
      pressed = new Set();
      typed = [];
      seq = [];
    },
    keyDown(key) {
      const k = norm(key);
      if (!down.has(k)) pressed.add(k);
      down.add(k);
    },
    keyUp(key) {
      down.delete(norm(key));
    },
    typeChar(ch) {
      typed.push(ch);
    },
    pointerMove(x, y) {
      pointer.x = x;
      pointer.y = y;
      pointer.moved = true;
      pointer.inside = true;
    },
    pointerDown(x, y) {
      input.pointerMove(x, y);
      pointer.down = true;
      nextClick = true;
    },
    pointerUp(x, y) {
      input.pointerMove(x, y);
      pointer.down = false;
      nextRelease = true;
    },
    addWheel(d) {
      nextWheel += d;
    },
    /** Call once per frame after update. */
    endFrame() {
      pressed = new Set();
      typed = [];
      seq = [];
      pointer.moved = false;
    },
    /** Call once per frame before update. */
    beginFrame() {
      pointer.clicked = nextClick;
      pointer.released = nextRelease;
      nextClick = false;
      nextRelease = false;
      wheel = nextWheel;
      nextWheel = 0;
    },
    clearAll() {
      down.clear();
      pressed = new Set();
      typed = [];
      seq = [];
    },
  };
  return input;
}

/** A scripted input for headless tests / demos. */
export function createFakeInput() {
  return createInput();
}

export function attachInput(input, canvas, toGame) {
  const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab']);
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (block.has(e.key)) e.preventDefault();
    input.keyDown(e.key);
    if (!e.metaKey && !e.ctrlKey) input.queueKey(e.key);
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) input.typeChar(e.key);
    if (e.key === 'Backspace') input.typeChar('\b');
  });
  window.addEventListener('keyup', (e) => input.keyUp(e.key));
  window.addEventListener('blur', () => input.clearAll());
  const pos = (e) => toGame(e.clientX, e.clientY);
  canvas.addEventListener('pointerdown', (e) => {
    input.pointer.touch = e.pointerType === 'touch';
    canvas.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    input.pointerDown(p.x, p.y);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    input.pointerMove(p.x, p.y);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = pos(e);
    input.pointerUp(p.x, p.y);
    const url = linkUnder(p.x, p.y);
    if (url) input.cancelClick(); // the link is the click: a dialog it opens must not receive it too
    if (typeof url === 'function') url();
    else if (url) openExternal(url);
  });
  canvas.addEventListener('pointerleave', () => (input.pointer.inside = false));
  canvas.addEventListener('wheel', (e) => input.addWheel(Math.sign(e.deltaY)), { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
