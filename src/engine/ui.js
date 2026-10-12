// UI kit: palette, panels, pixel icons and a keyboard+mouse button set.
import { track } from './analytics.js';
import { drawText, measureText } from './font.js';

export const C = {
  bg: '#1b1e2b',
  panel: '#2a2f45',
  panelLight: '#3b4262',
  panelDark: '#20243a',
  border: '#0d0f18',
  text: '#f4f1e8',
  dim: '#9aa0b8',
  good: '#5fd068',
  goodBtn: '#2e8540',
  bad: '#e2504a',
  warn: '#f29c38',
  gold: '#f2c14e',
  coffee: '#c08552',
  so: '#7ee0c3',
  xp: '#8ab4ff',
  paper: '#efe9d9',
  ink: '#2a2a35',
  accent: '#1f70c1',
  accentDark: '#0f3d6e',
  accentLight: '#7fb4ea',
};

/** Coffee count colour for S.coffeeLevel: red = no task affordable on this floor, amber = not the priciest ones. */
export const coffeeColor = (level) => (level === 'empty' ? C.bad : level === 'low' ? C.warn : C.text);

/** The player's corporation colour feeds the accent colours. */
export function setAccent(colorDef) {
  if (!colorDef) return;
  C.accent = colorDef.color;
  C.accentDark = colorDef.dark;
  C.accentLight = colorDef.light;
}

export function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function frame(g, x, y, w, h, color) {
  rect(g, x, y, w, 1, color);
  rect(g, x, y + h - 1, w, 1, color);
  rect(g, x, y, 1, h, color);
  rect(g, x + w - 1, y, 1, h, color);
}

/** Bevelled pixel panel. */
export function panel(g, x, y, w, h, opts = {}) {
  const fill = opts.fill || C.panel;
  const light = opts.light || C.panelLight;
  const dark = opts.dark || C.panelDark;
  rect(g, x, y, w, h, C.border);
  rect(g, x + 1, y + 1, w - 2, h - 2, fill);
  rect(g, x + 1, y + 1, w - 2, 1, light);
  rect(g, x + 1, y + 1, 1, h - 2, light);
  rect(g, x + 1, y + h - 2, w - 2, 1, dark);
  rect(g, x + w - 2, y + 1, 1, h - 2, dark);
  if (opts.title) {
    rect(g, x + 1, y + 1, w - 2, 12, opts.titleColor || C.accent);
    rect(g, x + 1, y + 13, w - 2, 1, C.border);
    drawText(g, opts.title, x + w / 2, y + 3, { align: 'center', color: C.text, shadow: C.border });
  }
}

export function dim(g, alpha = 0.6) {
  g.fillStyle = `rgba(8,10,18,${alpha})`;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
}

export function bar(g, x, y, w, h, frac, color, back = C.panelDark) {
  rect(g, x, y, w, h, C.border);
  rect(g, x + 1, y + 1, w - 2, h - 2, back);
  const fw = Math.max(0, Math.min(1, frac)) * (w - 2);
  if (fw > 0) {
    rect(g, x + 1, y + 1, fw, h - 2, color);
    rect(g, x + 1, y + 1, fw, 1, 'rgba(255,255,255,0.35)');
  }
}

// --- Pixel icons (7×7 unless the map says otherwise). Palette: k border, others per icon.
const ICONS = {
  // Paperclips: the soft currency (state key `sp`).
  sp: { map: '....ss.|...s..s|..s.s.d|.s.s.d.|s.s.d..|s..d...|.sd....', pal: { s: '#dfe5f2', d: '#8a93aa' } },
  star: { map: '...y...|...y...|yyywyyy|.yyyyo.|..yyo..|.yy.yo.|.y...o.', pal: { y: '#f2c14e', w: '#fff6c8', o: '#c98d1e' } },
  starOff: { map: '...g...|...g...|ggglggg|.ggggd.|..ggd..|.gg.gd.|.g...d.', pal: { g: '#4a5068', l: '#5d6480', d: '#393e52' } },
  // 11×11 star for the results screen.
  starBig: { map: '.....k.....|....kyk....|...kywok...|kkkkywyokkk|kyyyyyyyyok|.kyyyyyyok.|..kyyyyok..|.kyyyyyyok.|.kyyokyyok.|kyok...kyok|kkk.....kkk', pal: { y: '#f2c14e', w: '#fff6c8', o: '#c98d1e' } },
  starBigOff: { map: '.....k.....|....kgk....|...kgldk...|kkkkglgdkkk|kggggggggdk|.kggggggdk.|..kggggdk..|.kggggggdk.|.kggdkggdk.|kgdk...kgdk|kkk.....kkk', pal: { g: '#4a5068', l: '#5d6480', d: '#393e52' } },
  coffee: { map: '.w.w...|kkkkkk.|kbbbbkk|kbbbbkk|kbbbbk.|.kkkk..|kkkkkk.', pal: { w: '#d8d8d8', b: '#c08552' } },
  so: { map: 'kkkkkkk|kgggggk|kgggkgk|kggkggk|kgkgggk|kkggggk|kkkkkkk', pal: { g: '#7ee0c3' } },
  xp: { map: '...k...|..kbk..|.kbbbk.|kkbbbkk|..kbk..|..kbk..|..kkk..', pal: { b: '#8ab4ff' } },
  clock: { map: '.kkkkk.|kwwkwwk|kwwkwwk|kwwkkwk|kwwwwwk|kwwwwwk|.kkkkk.', pal: { w: '#e8e8f0' } },
  lock: { map: '..kkk..|.k...k.|.k...k.|kkkkkkk|kyyyyyk|kyykyyk|kkkkkkk', pal: { y: '#f2c14e' } },
  check: { map: '.......|......k|.....kg|k...kg.|gk.kg..|.gkg...|..g....', pal: { g: '#5fd068' } },
  pad: { map: '.........|.bbbbbbb.|bbdbbbrbb|bdddbrbrb|bbdbbbrbb|bbbb.bbbb|.bb...bb.', pal: { b: '#c8cdd8', d: '#3a3f55', r: '#e2504a' } },
  note: { map: '...kkkk|...k..k|...k..k|...k..k|.kkk.kk|kkkkkkk|.kk.kk.', pal: {} },
  mute: { map: '...k..k|..kk.k.|kkwk...|kkwk...|kkwk...|..kk.k.|...k..k', pal: { w: '#9aa0b8' } },
  cart: { map: 'k......|kkkkkkk|.kwwwwk|.kwwwk.|.kkkkk.|.......|..k..k.', pal: { w: '#7ee0c3' } },
  up: { map: '...k...|..kgk..|.kgggk.|kkgggkk|..kgk..|..kgk..|..kkk..', pal: { g: '#5fd068' } },
  book: { map: 'kkkkkk.|kbbbbkk|kbwwbkk|kbbbbkk|kbwwbkk|kbbbbkk|kkkkkk.', pal: { b: '#8ab4ff', w: '#e8e8f0' } },
  medal: { map: '.rr.bb.|..rbb..|..kkk..|.kyyyk.|.kywyk.|.kyyyk.|..kkk..', pal: { r: '#e2504a', b: '#2a6ad1', y: '#f2c14e', w: '#fff6c8' } },
  menu: { map: '.......|kkkkkkk|.......|kkkkkkk|.......|kkkkkkk|.......', pal: {} },
};
const iconCache = new Map();

export function icon(g, name, x, y, scale = 1) {
  const def = ICONS[name];
  if (!def) return;
  let c = iconCache.get(name);
  if (!c) {
    const rows = def.map.split('|');
    c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const cg = c.getContext('2d');
    rows.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx];
        if (ch === '.') continue;
        cg.fillStyle = ch === 'k' ? (name === 'note' || name === 'menu' ? '#f4f1e8' : '#0d0f18') : def.pal[ch] || '#fff';
        cg.fillRect(xx, yy, 1, 1);
      }
    });
    iconCache.set(name, c);
  }
  g.drawImage(c, Math.round(x), Math.round(y), c.width * scale, c.height * scale);
}

export function stars(g, count, x, y, scale = 1, max = 3) {
  for (let i = 0; i < max; i++) icon(g, i < count ? 'star' : 'starOff', x + i * 8 * scale, y, scale);
}

export function formatNum(n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0) + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M';
  return (n / 1e9).toFixed(2) + 'B';
}

export function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export const inRect = (p, x, y, w, h) => p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;

/**
 * Retained button group with mouse hover/click, arrow-key focus and Space/Enter activation.
 * add({ x, y, w, h, label, onClick, hotkey, disabled, color, icon, sub, draw }).
 */
export class ButtonSet {
  constructor({ keyboard = true, columns = 0 } = {}) {
    this.items = [];
    this.focus = 0;
    this.keyboard = keyboard;
    this.columns = columns;
    this.hover = -1;
  }
  clear() {
    this.items = [];
  }
  add(b) {
    this.items.push(b);
    return b;
  }
  update(input, sfx) {
    const p = input.pointer;
    this.hover = -1;
    this.items.forEach((b, i) => {
      if (inRect(p, b.x, b.y, b.w, b.h)) {
        this.hover = i;
        if (p.moved) this.focus = i;
      }
    });
    if (this.focus >= this.items.length) this.focus = Math.max(0, this.items.length - 1);
    for (const b of this.items) {
      if (b.hotkey && !b.disabled && input.pressedExact(b.hotkey)) return this.fire(b, input, sfx);
    }
    if (p.clicked && this.hover >= 0) {
      const b = this.items[this.hover];
      input.consumeClick();
      if (!b.disabled) return this.fire(b, input, sfx);
      sfx?.('bad');
      return true;
    }
    if (!this.keyboard || !this.items.length) return false;
    const n = this.items.length;
    const cols = this.columns || n;
    const move = (d) => {
      this.focus = (this.focus + d + n) % n;
      sfx?.('blip');
    };
    if (input.pressed('ArrowRight')) move(1);
    else if (input.pressed('ArrowLeft')) move(-1);
    else if (input.pressed('ArrowDown')) move(this.columns ? cols : 1);
    else if (input.pressed('ArrowUp')) move(this.columns ? -cols : -1);
    if (input.confirm()) {
      const b = this.items[this.focus];
      if (b && !b.disabled) return this.fire(b, input, sfx);
      if (b) sfx?.('bad');
    }
    return false;
  }
  fire(b, input, sfx) {
    sfx?.('click');
    input.consumeKeys();
    b.onClick?.();
    return true;
  }
  render(g) {
    this.items.forEach((b, i) => drawButton(g, b, this.keyboard && i === this.focus, i === this.hover));
  }
}

export function drawButton(g, b, focused, hovered) {
  if (b.draw) return b.draw(g, b, focused, hovered); // a button with art of its own (the title screen's store badges)
  const base = b.disabled ? '#3a3d4d' : b.color || C.accent;
  rect(g, b.x, b.y, b.w, b.h, C.border);
  rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, base);
  rect(g, b.x + 1, b.y + 1, b.w - 2, 1, 'rgba(255,255,255,0.3)');
  rect(g, b.x + 1, b.y + b.h - 2, b.w - 2, 1, 'rgba(0,0,0,0.35)');
  if (hovered && !b.disabled) rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 'rgba(255,255,255,0.12)');
  if (focused) frame(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold);
  const tc = b.disabled ? '#7a7d8d' : b.textColor || C.text;
  let tx = b.x + b.w / 2;
  const hasSub = !!b.sub;
  const ty = b.y + Math.floor((b.h - (hasSub ? 18 : 8)) / 2) + 1;
  if (b.icon) {
    const lw = measureText(b.label || '') + (b.label ? 10 : 7);
    icon(g, b.icon, tx - lw / 2, ty);
    tx += 5;
  }
  const shadow = b.textColor ? null : C.border; // dark text on a light button: a shadow only smears it
  if (b.label) drawText(g, b.label, tx, ty, { align: 'center', color: tc, shadow });
  if (hasSub) drawText(g, b.sub, b.x + b.w / 2, ty + 10, { align: 'center', color: b.disabled ? '#7a7d8d' : C.gold, shadow: C.border });
}

// External links drawn on the canvas. They open from the pointerup handler (a user gesture) rather than from the game
// loop, so popup blockers let them through. Spots expire quickly, so a link vanishes with the scene that drew it.
const linkSpots = [];
export const COFFEE_URL = 'https://buymeacoffee.com/marvec';
/** Opens the tip page. Called from button handlers, which run within the browser's user-activation window after a click or key press. */
export const openCoffee = () => {
  track('coffee_click');
  window.open(COFFEE_URL, '_blank', 'noopener');
};

/** Right-aligned link text ending at x. `url` may also be a function, called on click. */
export function drawLink(g, input, text, x, y, url) {
  const w = measureText(text);
  const lx = x - w;
  const hover = linkAt(input.pointer.x, input.pointer.y, lx, y, w) && input.pointer.inside;
  drawText(g, text, lx, y, { color: hover ? C.gold : '#c8b8e8', shadow: '#000' });
  rect(g, lx, y + 7, w, 1, hover ? C.gold : '#8878a8');
  const now = performance.now();
  for (let i = linkSpots.length - 1; i >= 0; i--) if (now - linkSpots[i].t > 250 || linkSpots[i].url === url) linkSpots.splice(i, 1);
  linkSpots.push({ x: lx, y: y - 2, w, h: 11, url, t: now });
}

function linkAt(px, py, x, y, w) {
  return px >= x && px < x + w && py >= y - 2 && py < y + 9;
}

/** The URL (or callback) of a live link under the pointer, if any. */
export function linkUnder(px, py) {
  const now = performance.now();
  return linkSpots.find((s) => now - s.t < 250 && px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h)?.url;
}
