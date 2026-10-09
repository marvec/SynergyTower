// Cable Spaghetti: the server-room patch panel is wired all wrong. Re-patch every cable to the socket with its
// colour. Connecting a port to a socket swaps the two cable ends, so the wiring is always a permutation.
import { W, C, rect, frame, panel, drawText, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, lerp, finish } from '../engine/mgkit.js';
import { DEVICES_GENERIC, DEVICES_DEPT, PROD_DEVICE, CONNECT_LINES } from '../data/mg-cables.js';

const BASE = [
  { col: '#3b82f6', dark: '#1d4a99' },
  { col: '#4cc35a', dark: '#22702e' },
  { col: '#f2d14e', dark: '#9a7d14' },
  { col: '#f2913a', dark: '#9a4f12' },
  { col: '#a66df0', dark: '#5a2f99' },
  { col: '#4fd6e0', dark: '#1a7a82' },
  { col: '#f27fb8', dark: '#99335f' },
  { col: '#e8e8ee', dark: '#8a8a96' },
  { col: '#a8743e', dark: '#5a3a18' },
];
const PROD = { col: '#e2304a', dark: '#7a1020', prod: true };

const PORT_X = 70; // where cables leave the patch panel
const SOCK_X = 322; // where cables enter the device sockets
const BOX_X = 330;
const BOX_W = 146;

export default {
  id: 'cables',
  name: 'Cable Spaghetti',
  help: 'Re-patch every cable to the socket with its colour. Click a port, then a socket (or arrows + SPACE). Never touch PROD!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const n = Math.round(byDiff(d, 5, 8));
    const hasProd = d >= 0.55;
    const pairs = d >= 0.85 ? 2 : d >= 0.45 ? 1 : 0;
    const blinky = d >= 0.5;
    const total = new Countdown(byDiff(d, 45, 40));
    const fl = new Floaters();
    const shake = new Shake();

    // --- Cable colours: distinct base colours, plus striped darker twins at higher difficulty.
    const baseCount = n - (hasProd ? 1 : 0) - pairs;
    const bases = rng.sample(BASE, baseCount);
    const defs = bases.map((b) => ({ col: b.col, dark: b.dark, stripe: null }));
    for (let p = 0; p < pairs; p++) {
      const b = bases[p];
      defs.push({ col: b.dark, dark: '#0d0f18', stripe: b.col });
    }
    if (hasProd) defs.push({ ...PROD, stripe: null });

    // --- Device labels (prod gets its own, the rest from dept + generic pools).
    const pool = rng.shuffle([...(DEVICES_DEPT[theme?.dept] || []), ...rng.sample(DEVICES_GENERIC, 12)]);
    const cables = rng.shuffle(defs).map((def, i) => ({
      ...def,
      label: def.prod ? PROD_DEVICE : pool[i % pool.length],
      c1: { x: rng.int(100, 290), y: rng.int(34, 240) },
      c2: { x: rng.int(100, 290), y: rng.int(34, 240) },
      mess: 1,
      glow: 0,
    }));
    // Socket order on the right (want[j] = the cable whose colour socket j shows).
    const want = rng.shuffle([...Array(n).keys()]);
    const home = []; // home[i] = correct socket for cable i
    want.forEach((ci, j) => (home[ci] = j));
    // Initial wiring: prod is correct, everything else is a derangement.
    const free = [...Array(n).keys()].filter((i) => !cables[i].prod);
    const m = free.length;
    let perm;
    do perm = rng.shuffle(free);
    while (perm.some((c, k) => c === free[k]));
    const end = [];
    free.forEach((c, k) => (end[c] = home[perm[k]]));
    cables.forEach((c, i) => c.prod && (end[i] = home[i]));
    const sp = Math.min(30, Math.floor(206 / n));
    const rowY = (i) => Math.round(136 - ((n - 1) * sp) / 2 + i * sp);
    const isOk = (i) => end[i] === home[i];
    const owner = (j) => end.indexOf(j);
    const okCount = () => free.filter(isOk).length;

    let moves = 0;
    let mistakes = 0; // patches that fixed nothing or unplugged a correct cable
    const freeMistakes = n >= 6 ? 2 : 1;
    let prodTouches = 0;
    let alarm = 0;
    let sel = null; // { side: 'L'|'R', idx }
    let col = 0; // keyboard column: 0 ports, 1 sockets
    const cur = [0, 0];
    let anim = 0;
    let endT = -1;

    const score = (early) => {
      const extra = Math.max(0, mistakes - freeMistakes);
      const bonus = early ? 0.05 * total.frac : 0;
      return clamp(okCount() / m - 0.2 * extra - 0.25 * prodTouches + bonus, 0, 1);
    };

    function touchProd(j) {
      prodTouches++;
      alarm = 1;
      sel = null;
      sfx('fail');
      shake.hit(0.5);
      fl.add("DON'T TOUCH PROD!", 200, rowY(j) - 6, C.bad);
    }

    function connect(i, j) {
      const k = owner(j);
      sel = null;
      col = 0;
      if (k === i) return sfx('click');
      if (cables[k].prod) return touchProd(j);
      const wasI = isOk(i);
      const wasK = isOk(k);
      [end[i], end[k]] = [end[k], end[i]];
      moves++;
      let gained = false;
      for (const c of [i, k]) {
        if (isOk(c) && !(c === i ? wasI : wasK)) {
          gained = true;
          cables[c].glow = 1;
          fl.add(rng.pick(CONNECT_LINES), BOX_X + 70, rowY(end[c]) - 12, C.good);
        }
      }
      if (!gained || wasI || wasK) {
        mistakes++;
        sfx('bad');
        shake.hit(0.12);
        fl.add(wasI || wasK ? 'Unplugged a good one!' : 'Still wrong...', 196, rowY(j) - 6, C.warn);
      } else sfx('good');
      if (okCount() === m) {
        sfx('star');
        fl.add('All patched!', 196, 128, C.gold);
        endT = 0.8;
      }
    }

    function act(side, idx) {
      if (side === 'L') {
        if (cables[idx].prod) return touchProd(home[idx]);
        if (sel?.side === 'R') return connect(idx, sel.idx);
        sfx('blip');
        if (sel?.side === 'L' && sel.idx === idx) sel = null;
        else {
          sel = { side: 'L', idx };
          col = 1;
          cur[1] = end[idx];
        }
      } else {
        if (cables[owner(idx)].prod) return touchProd(idx);
        if (sel?.side === 'L') return connect(sel.idx, idx);
        sfx('blip');
        if (sel?.side === 'R' && sel.idx === idx) sel = null;
        else {
          sel = { side: 'R', idx };
          col = 0;
          cur[0] = owner(idx);
        }
      }
    }

    const hitRow = (p, side) => {
      const x0 = side === 'L' ? 8 : SOCK_X - 6;
      const x1 = side === 'L' ? PORT_X + 8 : BOX_X + BOX_W;
      if (p.x < x0 || p.x >= x1) return -1;
      for (let i = 0; i < n; i++) if (Math.abs(p.y - rowY(i)) <= sp / 2) return i;
      return -1;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        alarm = Math.max(0, alarm - dt * 1.2);
        for (let i = 0; i < n; i++) {
          const c = cables[i];
          c.mess = clamp(c.mess + (isOk(i) ? -dt * 2.5 : dt * 4), 0, 1);
          c.glow = Math.max(0, c.glow - dt);
        }
        if (inst.done) return;
        if (endT >= 0) {
          endT -= dt;
          if (endT <= 0) finish(inst, score(true));
          return;
        }
        if (total.update(dt)) return finish(inst, score(false));
        // Keyboard.
        if (input.pressed('ArrowLeft')) col = 0;
        if (input.pressed('ArrowRight')) col = 1;
        if (input.pressed('ArrowUp')) cur[col] = (cur[col] + n - 1) % n;
        if (input.pressed('ArrowDown')) cur[col] = (cur[col] + 1) % n;
        if (input.confirm()) return act(col ? 'R' : 'L', cur[col]);
        // Pointer.
        const p = input.pointer;
        for (const side of ['L', 'R']) {
          const i = hitRow(p, side);
          if (i < 0) continue;
          if (p.moved) {
            col = side === 'L' ? 0 : 1;
            cur[col] = i;
          }
          if (p.clicked) return act(side, i);
        }
        if (p.clicked && sel) sel = null; // click on empty space cancels the selection
      },
      render(g) {
        g.save();
        shake.apply(g);
        drawRoom(g, anim);
        header(g, theme?.title || 'Cable Spaghetti', `Patched ${okCount()}/${m}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Match every cable to its colour!', 196, 22, { align: 'center', color: C.dim });

        // Patch panel (left).
        const top = rowY(0) - sp / 2 - 4;
        const bot = rowY(n - 1) + sp / 2 + 4;
        panel(g, 8, top, PORT_X - 2, bot - top, { fill: '#2b2e38', light: '#4a4f5e', dark: '#15171f' });
        rect(g, 12, top + 3, 3, 3, '#15171f');
        rect(g, 12, bot - 6, 3, 3, '#15171f');
        for (let i = 0; i < n; i++) {
          const c = cables[i];
          const y = rowY(i);
          swatch(g, 20, y - 4, 16, 9, c);
          if (c.prod) drawText(g, 'PROD', 28, y + 6, { align: 'center', color: C.bad });
          rect(g, 52, y - 5, 14, 11, '#0d0f18');
          rect(g, 54, y - 3, 10, 7, isOk(i) ? '#1d3a22' : '#3a2020');
          rect(g, 57, y - 1, 4, 3, '#0d0f18');
          const ledOn = isOk(i) || (blinky && Math.floor(anim * 6 + i * 1.7) % 2 === 0);
          rect(g, 42, y - 1, 3, 3, isOk(i) ? C.good : ledOn ? C.bad : '#4a2020');
          if (sel?.side === 'L' && sel.idx === i) frame(g, 10, y - sp / 2 + 1, PORT_X - 6, sp - 2, C.gold);
          else if (col === 0 && cur[0] === i) frame(g, 10, y - sp / 2 + 1, PORT_X - 6, sp - 2, C.accentLight);
        }

        // Device sockets (right).
        for (let j = 0; j < n; j++) {
          const c = cables[want[j]];
          const y = rowY(j);
          const bh = Math.min(22, sp - 3);
          panel(g, BOX_X, y - Math.floor(bh / 2), BOX_W, bh, { fill: c.prod ? '#4a1e26' : '#30364f' });
          swatch(g, BOX_X + 5, y - 4, 10, 9, c);
          drawText(g, c.label, BOX_X + 19, y - 3, { color: c.prod ? '#ff9a9a' : C.text });
          const okHere = isOk(want[j]);
          for (let l = 0; l < 2; l++) {
            const on = okHere ? (l === 0 || Math.floor(anim * 3 + j) % 2 === 0) : blinky ? Math.floor(anim * (7 + l * 3) + j * 2.3) % 2 === 0 : l === 1;
            rect(g, BOX_X + BOX_W - 8, y - 4 + l * 5, 3, 3, on ? (okHere ? C.good : l ? C.warn : C.bad) : '#202330');
          }
          rect(g, SOCK_X - 4, y - 5, 12, 11, '#0d0f18');
          rect(g, SOCK_X - 2, y - 3, 8, 7, '#4a4f5e');
          rect(g, SOCK_X, y - 1, 4, 3, '#0d0f18');
          if (sel?.side === 'R' && sel.idx === j) frame(g, SOCK_X - 6, y - sp / 2 + 1, BOX_X + BOX_W - SOCK_X + 7, sp - 2, C.gold);
          else if (col === 1 && cur[1] === j) frame(g, SOCK_X - 6, y - sp / 2 + 1, BOX_X + BOX_W - SOCK_X + 7, sp - 2, C.accentLight);
        }

        // Cables: wrong ones first (the tangle), straightened ones on top, the selected one last.
        const order = [...Array(n).keys()].sort((a, b) => (isOk(a) - isOk(b)) || ((sel?.side === 'L' && sel.idx === a) - (sel?.side === 'L' && sel.idx === b)));
        for (const i of order) {
          const c = cables[i];
          const p0 = { x: PORT_X, y: rowY(i) };
          const p3 = { x: SOCK_X - 4, y: rowY(end[i]) };
          const hl = (sel?.side === 'L' && sel.idx === i) || (sel?.side === 'R' && end[i] === sel.idx);
          drawCable(g, p0, p3, c, hl, anim);
        }

        if (alarm > 0 && Math.floor(anim * 8) % 2 === 0) {
          g.fillStyle = `rgba(226,48,74,${0.35 * alarm})`;
          g.fillRect(0, 18, W, 252);
          drawText(g, 'PROD ALARM!', 196, 120, { align: 'center', color: '#fff', shadow: C.border, scale: 2 });
        }
        drawText(g, 'Click port, then socket  |  Arrows + SPACE  |  Left/Right: side', W / 2, 256, { align: 'center', color: C.dim });
        drawText(g, `Moves ${moves}`, 8, 22, { color: C.dim });
        if (mistakes) drawText(g, `Oops ${mistakes}`, 386, 22, { align: 'right', color: mistakes > freeMistakes ? C.bad : C.warn });
        fl.render(g);
        g.restore();
      },
    };

    function drawCable(g, p0, p3, c, hl, t) {
      const k = c.mess;
      const s1 = { x: lerp(p0.x, p3.x, 1 / 3), y: lerp(p0.y, p3.y, 1 / 3) };
      const s2 = { x: lerp(p0.x, p3.x, 2 / 3), y: lerp(p0.y, p3.y, 2 / 3) };
      const q1 = { x: lerp(s1.x, c.c1.x, k), y: lerp(s1.y, c.c1.y, k) };
      const q2 = { x: lerp(s2.x, c.c2.x, k), y: lerp(s2.y, c.c2.y, k) };
      const pts = [];
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const steps = Math.ceil((dist(p0, q1) + dist(q1, q2) + dist(q2, p3)) / 1.5);
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, cc = 3 * (1 - u) * u * u, e = u ** 3;
        pts.push({
          x: Math.round(a * p0.x + b * q1.x + cc * q2.x + e * p3.x),
          y: Math.round(a * p0.y + b * q1.y + cc * q2.y + e * p3.y),
        });
      }
      const ok = k < 0.05;
      const outline = hl ? C.gold : ok && c.glow > 0 ? '#c8ffd0' : C.border;
      for (const q of pts) rect(g, q.x - 2, q.y - 2, 5, 5, outline);
      pts.forEach((q, s) => {
        let fill = c.col;
        if (c.stripe && s % 8 < 3) fill = c.stripe;
        if (c.prod && s % 10 < 2) fill = '#ffd84a';
        rect(g, q.x - 1, q.y - 1, 3, 3, fill);
      });
      for (const q of pts.filter((_, s) => s % 6 === 0)) rect(g, q.x - 1, q.y - 1, 1, 1, 'rgba(255,255,255,0.35)');
      // Plugs at both ends.
      rect(g, p0.x - 2, p0.y - 3, 6, 7, c.dark);
      rect(g, p3.x - 2, p3.y - 3, 6, 7, c.dark);
      if (ok && c.glow > 0) {
        const pulse = Math.floor(t * 10) % 2;
        rect(g, p3.x - 3 - pulse, p3.y - 4 - pulse, 8 + pulse * 2, 1, C.good);
      }
    }

    return inst;
  },
};

/** Colour swatch with an optional stripe pattern so the twin shades can be told apart. */
function swatch(g, x, y, w, h, c) {
  rect(g, x - 1, y - 1, w + 2, h + 2, C.border);
  rect(g, x, y, w, h, c.col);
  if (c.stripe) for (let k = 0; k < w; k += 4) rect(g, x + k, y, 2, h, c.stripe);
  if (c.prod) for (let k = 0; k < w; k += 5) rect(g, x + k, y + h - 2, 2, 2, '#ffd84a');
  rect(g, x, y, w, 1, 'rgba(255,255,255,0.35)');
}

function drawRoom(g, t) {
  rect(g, 0, 0, W, 270, '#1e2230');
  // Server racks in the background.
  for (let x = 84; x < 316; x += 38) {
    rect(g, x, 30, 32, 212, '#262b3b');
    frame(g, x, 30, 32, 212, '#151823');
    for (let y = 36; y < 236; y += 10) {
      rect(g, x + 3, y, 26, 7, '#2e3446');
      const on = (Math.floor(t * 2 + x * 0.37 + y * 0.11) % 5) !== 0;
      rect(g, x + 24, y + 2, 2, 2, on ? '#2f8a3a' : '#123018');
      if ((x + y) % 3 === 0) rect(g, x + 20, y + 2, 2, 2, on ? '#c98d1e' : '#3a2a10');
    }
  }
  rect(g, 0, 244, W, 26, '#151823');
  for (let x = 0; x < W; x += 20) rect(g, x, 244, 1, 26, 'rgba(255,255,255,0.05)');
}
