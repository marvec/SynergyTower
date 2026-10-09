// Fridge Tetris: lunch containers fall into the overstuffed office fridge. Fill whole shelves (rows) to clear them;
// mystery containers from 2019 that are still inside at the end count against you.
import { W, C, rect, frame, panel, drawText, drawWrapped, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { drawButton, inRect } from '../engine/ui.js';
import { wrapText } from '../engine/font.js';
import { FRIDGE_NOTES, FRIDGE_NOTES_DEPT, TUPPERWARE, MYSTERY, ITEM_NAMES, CLEAR_LINES } from '../data/mg-fridge.js';

const COLS = 8;
const ROWS = 12;
const CELL = 16;
const FX = 176; // fridge interior
const FY = 38;
const FW = COLS * CELL;
const FH = ROWS * CELL;

const TETRO = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
];
const LIDS = ['#3b82f6', '#f27fb8', '#f2913a', '#a66df0', '#4fd6e0', '#f2d14e', '#e2504a', '#4cc35a'];
const FOODS = ['#e8b04a', '#7cc85a', '#d07a2a', '#f0eee0', '#c0392b', '#d8c49a', '#8a5a3a', '#e8d070'];

const BTN_ROT = { x: 324, y: 160, w: 72, h: 22, label: 'ROTATE', color: C.accent };
const BTN_DROP = { x: 402, y: 160, w: 72, h: 22, label: 'DROP', color: '#7a4a9a' };

const rotateMat = (m, dir) => {
  const n = m.length;
  return m.map((row, r) => row.map((_, c) => (dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r])));
};
const shade = (hex, f) => {
  const v = parseInt(hex.slice(1), 16);
  const ch = (s) => clamp(Math.round(((v >> s) & 255) * f), 0, 255);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

export default {
  id: 'fridge',
  name: 'Fridge Tetris',
  help: 'Fit the lunches into the fridge and fill whole shelves to clear them. Arrows move, UP rotates, SPACE drops; or aim with the mouse, click to drop, wheel to rotate.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const total = new Countdown(byDiff(d, 60, 50));
    const target = Math.round(byDiff(d, 4, 7));
    const baseFall = byDiff(d, 0.85, 0.45);
    const mysteryP = byDiff(d, 0.05, 0.13);
    const fl = new Floaters();
    const shake = new Shake();
    const note = rng.pick([...FRIDGE_NOTES, ...(FRIDGE_NOTES_DEPT[theme?.dept] || [])]);
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let nextId = 1;
    let lines = 0;
    let overflow = false;
    let endT = -1;
    let banner = '';
    let fallT = 0;
    let lockT = 0;
    let anim = 0;
    let flashes = [];
    const hold = { ArrowLeft: 0, ArrowRight: 0 };

    function makePiece() {
      const r = rng.next();
      let kind = 'tup';
      let mat = rng.pick(TETRO);
      if (r < mysteryP) kind = 'mystery';
      else if (r < mysteryP + 0.05) (kind = 'cake'), (mat = [[1, 1], [1, 1]]);
      else if (r < mysteryP + 0.13) (kind = 'yogurt'), (mat = [[1]]);
      else if (r < mysteryP + 0.21) (kind = 'milk'), (mat = [[1, 0], [1, 0]]);
      const name = kind === 'tup' ? rng.pick(TUPPERWARE) : kind === 'mystery' ? rng.pick(MYSTERY) : ITEM_NAMES[kind];
      return { kind, mat, id: nextId++, lid: rng.pick(LIDS), food: rng.pick(FOODS), name, x: 0, y: 0 };
    }

    const filled = (mat) => {
      const out = [];
      mat.forEach((row, r) => row.forEach((v, c) => v && out.push({ c, r })));
      return out;
    };
    const collide = (mat, x, y) =>
      filled(mat).some(({ c, r }) => {
        const gx = x + c;
        const gy = y + r;
        return gx < 0 || gx >= COLS || gy >= ROWS || (gy >= 0 && grid[gy][gx]);
      });
    const mysteryLeft = () => {
      const ids = new Set();
      for (const row of grid) for (const cell of row) if (cell?.kind === 'mystery') ids.add(cell.id);
      return ids.size;
    };
    const rawScore = () => lines / target - 0.08 * Math.min(4, mysteryLeft()) - (overflow ? 0.1 : 0);

    let cur = null;
    let next = makePiece();

    function spawn() {
      cur = next;
      next = makePiece();
      const top = Math.min(...filled(cur.mat).map((f) => f.r));
      const span = cur.mat.length;
      cur.x = Math.floor((COLS - span) / 2);
      cur.y = -top;
      fallT = 0;
      lockT = 0;
      if (collide(cur.mat, cur.x, cur.y)) end('FRIDGE FULL', true);
    }

    function end(text, isOverflow = false) {
      if (endT >= 0) return;
      overflow = overflow || isOverflow;
      banner = text;
      endT = 1.1;
      if (isOverflow) {
        sfx('fail');
        shake.hit(0.4);
      }
    }

    function tryMove(dx, dy) {
      if (!cur || collide(cur.mat, cur.x + dx, cur.y + dy)) return false;
      cur.x += dx;
      cur.y += dy;
      return true;
    }

    function rotate(dir) {
      if (!cur || cur.kind === 'yogurt' || cur.kind === 'cake') return;
      const m = rotateMat(cur.mat, dir);
      for (const k of [0, -1, 1, -2, 2]) {
        if (!collide(m, cur.x + k, cur.y)) {
          cur.mat = m;
          cur.x += k;
          sfx('blip');
          return;
        }
      }
    }

    function lock() {
      for (const { c, r } of filled(cur.mat)) {
        const gy = cur.y + r;
        if (gy < 0) overflow = true;
        else grid[gy][cur.x + c] = { id: cur.id, kind: cur.kind, lid: cur.lid, food: cur.food };
      }
      sfx('step');
      const piece = cur;
      cur = null;
      // Clear full shelves.
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (grid[y].every(Boolean)) {
          grid.splice(y, 1);
          grid.unshift(Array(COLS).fill(null));
          flashes.push({ y: y - cleared, t: 0.35 });
          cleared++;
          y++;
        }
      }
      if (cleared) {
        lines += cleared;
        sfx(cleared > 1 ? 'cash' : 'coin');
        fl.add(cleared > 1 ? `${cleared} shelves!` : rng.pick(CLEAR_LINES), FX + FW / 2, FY + 60, C.good);
      } else if (piece.kind === 'mystery') fl.add('Ew. What IS that?', FX + FW / 2, FY + 20, '#b8e07a');
      if (overflow) return end('FRIDGE FULL', true);
      if (rawScore() >= 1) {
        sfx('star');
        return end('Fridge spotless!');
      }
      spawn();
    }

    function hardDrop() {
      if (!cur) return;
      let n = 0;
      while (tryMove(0, 1)) n++;
      if (n > 2) shake.hit(0.08);
      lock();
    }

    const ghostY = () => {
      let y = cur.y;
      while (!collide(cur.mat, cur.x, y + 1)) y++;
      return y;
    };

    spawn();

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        flashes = flashes.filter((f) => (f.t -= dt) > 0);
        if (inst.done) return;
        if (endT >= 0) {
          endT -= dt;
          if (endT <= 0) finish(inst, rawScore());
          return;
        }
        if (total.update(dt)) {
          end(rawScore() >= 0.85 ? 'Lunch is served!' : "Time's up!");
          return;
        }
        if (!cur) return;
        const p = input.pointer;
        // Rotation: UP, mouse wheel, ROTATE button.
        if (input.pressed('ArrowUp')) rotate(1);
        const wh = input.wheel();
        if (wh) rotate(wh > 0 ? 1 : -1);
        if (p.clicked && inRect(p, BTN_ROT.x, BTN_ROT.y, BTN_ROT.w, BTN_ROT.h)) rotate(1);
        // Sideways with auto-repeat.
        for (const [k, dx] of [['ArrowLeft', -1], ['ArrowRight', 1]]) {
          if (input.pressed(k)) {
            tryMove(dx, 0);
            hold[k] = 0;
          } else if (input.down(k)) {
            hold[k] += dt;
            while (hold[k] > 0.2) {
              tryMove(dx, 0);
              hold[k] -= 0.05;
            }
          } else hold[k] = 0;
        }
        // Pointer aims the column.
        const inFridge = p.x >= FX - 20 && p.x < FX + FW + 20 && p.y >= FY - 24 && p.y < FY + FH + 12;
        if (p.moved && inFridge) {
          const cells = filled(cur.mat);
          const minC = Math.min(...cells.map((f) => f.c));
          const maxC = Math.max(...cells.map((f) => f.c));
          const col = clamp(Math.floor((p.x - FX) / CELL), 0, COLS - 1);
          const want = clamp(col - Math.floor((minC + maxC) / 2), -minC, COLS - 1 - maxC);
          while (cur.x !== want && tryMove(Math.sign(want - cur.x), 0));
        }
        // Hard drop: SPACE/Enter, click in the fridge, DROP button.
        if (input.confirm() || (p.clicked && (inFridge || inRect(p, BTN_DROP.x, BTN_DROP.y, BTN_DROP.w, BTN_DROP.h)))) {
          sfx('click');
          return hardDrop();
        }
        // Gravity (faster as the lunch rush goes on), soft drop with DOWN.
        const fall = input.down('ArrowDown') ? 0.04 : baseFall * (1 - 0.25 * (1 - total.frac));
        fallT += dt;
        if (collide(cur.mat, cur.x, cur.y + 1)) {
          lockT += dt;
          fallT = 0;
          if (lockT >= 0.4) lock();
        } else {
          lockT = 0;
          while (fallT >= fall && cur) {
            fallT -= fall;
            if (!tryMove(0, 1)) break;
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        drawKitchen(g);
        header(g, theme?.title || 'Fridge Tetris', `Shelves ${lines}/${target}`);
        timerBar(g, total.left, total.total);
        drawDoor(g, note);

        // Fridge body and interior.
        rect(g, FX - 10, FY - 14, FW + 20, FH + 24, C.border);
        rect(g, FX - 9, FY - 13, FW + 18, FH + 22, '#e4e8ec');
        rect(g, FX - 9, FY - 13, FW + 18, 2, '#ffffff');
        rect(g, FX - 9, FY + FH + 7, FW + 18, 2, '#9aa3ad');
        rect(g, FX - 1, FY - 1, FW + 2, FH + 2, '#8a96a3');
        rect(g, FX, FY, FW, FH, '#cfe0ea');
        rect(g, FX + FW / 2 - 12, FY - 9, 24, 4, '#fff6c8'); // fridge light
        rect(g, FX + FW / 2 - 10, FY - 5, 20, 2, 'rgba(255,246,200,0.5)');
        for (let r = 3; r < ROWS; r += 3) rect(g, FX, FY + r * CELL - 1, FW, 1, 'rgba(255,255,255,0.7)');
        for (let c = 1; c < COLS; c++) rect(g, FX + c * CELL, FY, 1, FH, 'rgba(120,140,160,0.12)');
        // Settled food.
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            const cell = grid[y][x];
            if (!cell) continue;
            const same = (xx, yy) => yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS && grid[yy][xx]?.id === cell.id;
            drawCell(g, FX + x * CELL, FY + y * CELL, CELL, cell, { u: same(x, y - 1), d: same(x, y + 1), l: same(x - 1, y), r: same(x + 1, y) }, anim, !(y > 0 && grid[y - 1][x]));
          }
        drawLabels(g, grid);
        // Ghost + falling piece.
        if (cur && endT < 0) {
          const gy = ghostY();
          for (const { c, r } of filled(cur.mat)) if (gy + r >= 0) frame(g, FX + (cur.x + c) * CELL + 1, FY + (gy + r) * CELL + 1, CELL - 2, CELL - 2, 'rgba(40,60,90,0.35)');
          drawPiece(g, cur, FX + cur.x * CELL, FY + cur.y * CELL, CELL, anim, FY);
        }
        for (const f of flashes) {
          g.fillStyle = `rgba(255,255,255,${f.t * 2})`;
          g.fillRect(FX, FY + f.y * CELL, FW, CELL);
        }

        // Side panel: next item, progress, buttons, smell-o-meter.
        panel(g, 324, 22, 150, 76, { title: 'NEXT' });
        const nm = next.mat.length;
        const ps = 12;
        drawPiece(g, next, 399 - Math.round((nm * ps) / 2), 62 - Math.round((nm * ps) / 2) + (nm === 4 ? 6 : 0), ps, anim, 0);
        drawText(g, next.name, 399, 86, { align: 'center', color: next.kind === 'mystery' ? '#b8e07a' : next.kind === 'cake' ? '#ffb0c8' : C.gold });
        panel(g, 324, 102, 150, 52);
        drawText(g, 'Shelves cleaned', 332, 108, { color: C.dim });
        drawText(g, `${lines}/${target}`, 466, 108, { align: 'right', color: lines >= target ? C.good : C.text });
        const prog = clamp(lines / target, 0, 1);
        rect(g, 332, 120, 134, 6, C.border);
        rect(g, 333, 121, Math.round(132 * prog), 4, C.good);
        const ml = mysteryLeft();
        drawText(g, `Mystery inside: ${ml}`, 332, 134, { color: ml ? '#b8e07a' : C.dim });
        drawButton(g, BTN_ROT, false, false);
        drawButton(g, BTN_DROP, false, false);
        panel(g, 324, 188, 150, 40);
        drawText(g, 'Smell-o-meter', 332, 194, { color: C.dim });
        const smell = clamp(0.15 + ml * 0.22, 0, 1);
        for (let k = 0; k < 13; k++) rect(g, 332 + k * 10, 208, 8, 10, k / 13 < smell ? (k < 5 ? C.good : k < 9 ? C.warn : C.bad) : C.panelDark);

        if (endT >= 0) {
          rect(g, FX - 6, FY + FH / 2 - 16, FW + 12, 30, C.border);
          rect(g, FX - 5, FY + FH / 2 - 15, FW + 10, 28, overflow ? '#7a2b2b' : '#2f6b3a');
          drawText(g, banner, FX + FW / 2, FY + FH / 2 - 7, { align: 'center', color: C.text, shadow: C.border, scale: banner.length > 12 ? 1 : 2 });
        }
        drawText(g, 'Arrows: move/rotate  SPACE: drop  |  Mouse: aim, click drop, wheel rotate', W / 2, 256, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;

    function drawPiece(g, pc, ox, oy, s, t, clipTop) {
      const m = pc.mat;
      const has = (c, r) => r >= 0 && r < m.length && c >= 0 && c < m.length && m[r][c];
      const cell = { id: pc.id, kind: pc.kind, lid: pc.lid, food: pc.food };
      m.forEach((row, r) =>
        row.forEach((v, c) => {
          const y = oy + r * s;
          if (!v || y < clipTop) return;
          drawCell(g, ox + c * s, y, s, cell, { u: has(c, r - 1), d: has(c, r + 1), l: has(c - 1, r), r: has(c + 1, r) }, t, !has(c, r - 1));
        }),
      );
      if (pc.kind === 'cake' && oy >= clipTop) cakeLabel(g, ox, oy, s);
    }
  },
};

/** One fridge cell of a container; `nb` says which neighbours belong to the same container. */
function drawCell(g, x, y, s, cell, nb, t, openTop) {
  const k = cell.kind;
  if (k === 'yogurt') {
    rect(g, x + 2, y + 3, s - 4, s - 4, C.border);
    rect(g, x + 3, y + 4, s - 6, s - 6, '#f4f4f0');
    rect(g, x + 1, y + 2, s - 2, 3, cell.lid);
    rect(g, x + 3, y + s * 0.55, s - 6, 2, cell.lid);
    return;
  }
  const body = k === 'tup' ? cell.food : k === 'milk' ? '#f4f4f0' : k === 'cake' ? '#f2d9a0' : '#5e7a2e';
  rect(g, x, y, s, s, body);
  if (k === 'tup') {
    const h = (cell.id * 7 + x * 3 + y * 5) % 11;
    rect(g, x + 3 + (h % 7), y + 6 + (h % 5), 2, 2, shade(cell.food, 0.7));
    rect(g, x + 9 - (h % 4), y + 10 - (h % 3), 2, 2, shade(cell.food, 1.25));
    if (!nb.l) rect(g, x + 1, y + 1, 1, s - 2, 'rgba(255,255,255,0.45)');
    if (!nb.u) {
      rect(g, x, y, s, 4, cell.lid);
      rect(g, x, y, s, 1, 'rgba(255,255,255,0.5)');
    }
  } else if (k === 'milk') {
    rect(g, x, y + Math.floor(s / 2) - 2, s, 4, '#3b82f6');
    if (!nb.u) rect(g, x + 2, y, s - 4, 3, '#cfd6e3');
  } else if (k === 'cake') {
    rect(g, x, y + s - 6, s, 2, '#fff6f0');
    if (!nb.u) {
      rect(g, x, y, s, 5, '#f27fb8');
      rect(g, x + 4, y + 5, 2, 2, '#f27fb8');
      rect(g, x + 10, y + 5, 2, 3, '#f27fb8');
    }
  } else {
    // Mystery container: mouldy green, fuzzy spots and stink lines.
    const h = (cell.id * 13 + x + y) % 9;
    rect(g, x + 2 + h, y + 4, 3, 3, '#3e5a1e');
    rect(g, x + 10 - (h % 5), y + 9, 3, 2, '#8aa04a');
    if (!nb.u) rect(g, x, y, s, 3, '#3a4a20');
    if (!nb.u && openTop) {
      for (const sx of [4, 10]) {
        for (let k2 = 0; k2 < 4; k2++) {
          const wob = Math.round(Math.sin(t * 6 + k2 + sx) * 1.5);
          rect(g, x + sx + wob, y - 2 - k2 * 2, 1, 2, 'rgba(184,224,122,0.8)');
        }
      }
    }
  }
  const edge = 'rgba(13,15,24,0.85)';
  if (!nb.u) rect(g, x, y, s, 1, edge);
  if (!nb.d) rect(g, x, y + s - 1, s, 1, edge);
  if (!nb.l) rect(g, x, y, 1, s, edge);
  if (!nb.r) rect(g, x + s - 1, y, 1, s, edge);
}

function cakeLabel(g, x, y, s) {
  rect(g, x + 2, y + s - 2, s * 2 - 4, 9, '#fff');
  frame(g, x + 2, y + s - 2, s * 2 - 4, 9, '#c0392b');
  drawText(g, s >= 16 ? 'KAREN' : 'K', x + s, y + s - 1, { align: 'center', color: '#c0392b' });
}

/** Labels for intact cakes in the grid. */
function drawLabels(g, grid) {
  for (let y = 0; y < ROWS - 1; y++)
    for (let x = 0; x < COLS - 1; x++) {
      const c = grid[y][x];
      if (c?.kind !== 'cake') continue;
      const ok = grid[y][x + 1]?.id === c.id && grid[y + 1][x]?.id === c.id && grid[y + 1][x + 1]?.id === c.id && grid[y - 1]?.[x]?.id !== c.id && grid[y][x - 1]?.id !== c.id;
      if (ok) cakeLabel(g, FX + x * CELL, FY + y * CELL, CELL);
    }
}

function drawKitchen(g) {
  rect(g, 0, 0, W, 270, '#b9c4c9');
  for (let y = 18; y < 236; y += 12) for (let x = (y / 12) % 2 ? 0 : 6; x < W; x += 12) rect(g, x, y, 11, 11, '#c6d0d4');
  rect(g, 0, 236, W, 34, '#6b5a4a');
  rect(g, 0, 236, W, 2, '#8a7560');
  for (let x = 0; x < W; x += 30) rect(g, x, 238, 1, 32, 'rgba(0,0,0,0.15)');
}

function drawDoor(g, note) {
  // Open fridge door (inside view) with door shelves and the sticky note.
  const x = 82;
  const y = 26;
  const w = 84;
  const h = 210;
  rect(g, x, y, w, h, C.border);
  rect(g, x + 1, y + 1, w - 2, h - 2, '#d7dde2');
  rect(g, x + 1, y + 1, w - 2, 1, '#ffffff');
  rect(g, x + w - 5, y + 4, 3, h - 8, '#aab3bc'); // gasket
  // Door shelves with condiments.
  for (const sy of [118, 160]) {
    rect(g, x + 4, y + sy + 22, w - 12, 4, '#9aa3ad');
    rect(g, x + 4, y + sy + 22, w - 12, 1, '#ffffff');
  }
  const bottles = [
    [8, 118, 8, 18, '#c0392b'], [20, 118, 10, 12, '#f2d14e'], [34, 118, 7, 16, '#4cc35a'], [46, 118, 14, 10, '#f4f4f0'], [62, 118, 8, 14, '#8a5a3a'],
    [8, 160, 12, 18, '#f4f4f0'], [24, 160, 9, 12, '#e8b04a'], [37, 160, 7, 20, '#3b82f6'], [48, 160, 18, 14, '#f27fb8'],
  ];
  for (const [bx, by, bw, bh, col] of bottles) {
    rect(g, x + bx, y + by + 22 - bh, bw, bh, C.border);
    rect(g, x + bx + 1, y + by + 23 - bh, bw - 2, bh - 1, col);
    rect(g, x + bx + 1, y + by + 23 - bh, 1, bh - 1, 'rgba(255,255,255,0.4)');
  }
  // Sticky note.
  const nx = x + 6;
  const ny = y + 10;
  const nw = 70;
  const lines = wrapText(note, nw - 8);
  const nh = Math.max(40, lines.length * 10 + 12);
  rect(g, nx + 2, ny + 2, nw, nh, 'rgba(0,0,0,0.25)');
  rect(g, nx, ny, nw, nh, '#fbe36a');
  rect(g, nx, ny, nw, 4, '#f2d14e');
  rect(g, nx + nw / 2 - 2, ny - 2, 5, 5, '#e2504a'); // magnet
  drawWrapped(g, note, nx + 4, ny + 7, nw - 8, { color: '#3a3020' });
}
