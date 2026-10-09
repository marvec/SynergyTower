// Meeting Buzzword Bingo: colleagues blurt buzzwords; mark the ones on your card to complete lines.
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, face, Floaters, Shake, byDiff, finish, measureText } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { BUZZ_COMMON, BUZZ_DEPT, BINGO_SPEAKERS } from '../data/mg-bingo.js';

function linesOf(size) {
  const lines = [];
  for (let r = 0; r < size; r++) lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}

export default {
  id: 'bingo',
  name: 'Meeting Buzzword Bingo',
  help: 'When someone says a word on your card, press Space or click it. Complete the lines!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const size = d < 0.5 ? 3 : 4;
    const target = d < 0.34 ? 1 : d < 0.67 ? 2 : 3;
    const dur = byDiff(d, 2.6, 1.15);
    const gap = 0.3;
    const pool = rng.shuffle([...(BUZZ_DEPT[theme?.dept] || []), ...BUZZ_COMMON]);
    const card = pool.slice(0, size * size);
    const distractPool = pool.slice(size * size);
    const lines = linesOf(size);

    // Guarantee the target is reachable: speak every word of `target` lines plus a few extras.
    const chosen = rng.sample(lines, target);
    const spokenIdx = new Set(chosen.flat());
    const extras = rng.int(1, 2);
    for (let k = 0; k < extras; k++) spokenIdx.add(rng.int(0, card.length - 1));
    const spoken = [...spokenIdx].map((i) => card[i]);
    const nDistract = Math.round(spoken.length * byDiff(d, 0.7, 1.5));
    for (let k = 0; k < nDistract; k++) spoken.push(rng.pick(distractPool));
    let seq = rng.shuffle(spoken);
    const maxWords = Math.floor(85 / (dur + gap));
    if (seq.length > maxWords) {
      // Keep all card words, trim distractors.
      const cardWords = seq.filter((w) => card.includes(w));
      const others = seq.filter((w) => !card.includes(w)).slice(0, Math.max(0, maxWords - cardWords.length));
      seq = rng.shuffle([...cardWords, ...others]);
    }
    const total = seq.length * (dur + gap) + 3;

    const marked = new Array(card.length).fill(false);
    const fl = new Floaters();
    const shake = new Shake();
    let elapsed = 0;
    let idx = -1;
    let wordT = 0;
    let wordHandled = false;
    let hits = 0;
    let misses = 0;
    let wrong = 0;
    let lineCount = 0;
    let speaker = 0;
    let bingoFlash = 0;

    const cardX = 252;
    const cardY = 24;
    const cardW = 222;
    const cardH = 236;
    const cw = cardW / size;
    const ch = (cardH - 18) / size;
    const bubble = { x: 0, y: 0, w: 0, h: 0 };

    const countLines = () => lines.filter((l) => l.every((i) => marked[i])).length;
    const current = () => (idx >= 0 && idx < seq.length && wordT > 0 ? seq[idx] : null);
    const score = () => {
      const acc = hits + misses + wrong > 0 ? hits / (hits + misses + wrong) : 0;
      return 0.6 * Math.min(1, lineCount / target) + 0.4 * acc;
    };

    const tryMark = (cellIdx) => {
      const word = current();
      if (!word) return;
      const ci = cellIdx ?? card.indexOf(word);
      if (ci >= 0 && card[ci] === word) {
        if (marked[ci]) return;
        marked[ci] = true;
        wordHandled = true;
        hits++;
        sfx('good');
        fl.add('Marked!', cardX + (ci % size) * cw + cw / 2, cardY + 18 + Math.floor(ci / size) * ch + 8, C.good);
        const before = lineCount;
        lineCount = countLines();
        if (lineCount > before) {
          sfx('coin');
          bingoFlash = 1;
          fl.add(lineCount >= target ? 'BINGO!' : 'Line!', cardX + cardW / 2, cardY + cardH / 2, C.gold);
        }
        if (lineCount >= target) finish(inst, score());
      } else {
        wrong++;
        sfx('bad');
        shake.hit();
        fl.add(word && card.includes(word) ? 'Wrong cell!' : 'Not on card!', 115, 60, C.bad);
      }
    };

    const nextWord = () => {
      idx++;
      if (idx >= seq.length) return finish(inst, score());
      wordT = dur;
      wordHandled = false;
      speaker = (speaker + 1 + rng.int(0, 2)) % 4;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        bingoFlash = Math.max(0, bingoFlash - dt * 1.5);
        if (inst.done) return;
        elapsed += dt;
        if (elapsed >= total) return finish(inst, score());
        if (wordT > 0) {
          wordT -= dt;
          if (wordT <= 0) {
            const w = seq[idx];
            const ci = card.indexOf(w);
            if (ci >= 0 && !marked[ci] && !wordHandled) {
              misses++;
              fl.add('Missed!', 115, 60, C.warn);
            }
            wordT = -gap;
          }
        } else {
          wordT += dt;
          if (wordT >= 0 || idx < 0) nextWord();
          if (inst.done) return;
        }
        if (input.pressed('Space') || input.pressedExact('Enter')) tryMark(null);
        const p = input.pointer;
        if (p.clicked) {
          if (p.x >= bubble.x && p.x < bubble.x + bubble.w && p.y >= bubble.y && p.y < bubble.y + bubble.h) tryMark(null);
          else if (p.x >= cardX && p.x < cardX + cardW && p.y >= cardY + 18 && p.y < cardY + cardH) {
            const c = Math.floor((p.x - cardX) / cw);
            const r = Math.floor((p.y - cardY - 18) / ch);
            const ci = r * size + c;
            if (ci >= 0 && ci < card.length && !marked[ci]) tryMark(ci);
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3d4560', desk: '#4a3a30' });
        header(g, theme?.title || 'Buzzword Bingo', `Lines ${lineCount}/${target}`);
        timerBar(g, total - elapsed, total);

        // Meeting room: window, table, colleagues.
        rect(g, 20, 26, 190, 40, '#8fb8d8');
        rect(g, 20, 26, 190, 2, '#c8e0f0');
        for (let x = 20; x < 210; x += 38) rect(g, x, 26, 2, 40, '#5a6478');
        rect(g, 10, 170, 210, 46, '#6b4a32');
        rect(g, 10, 170, 210, 3, '#8a6448');
        rect(g, 10, 214, 210, 4, '#3d2a1c');
        const seats = [[30, 140], [80, 134], [136, 134], [186, 140]];
        seats.forEach(([x, y], i) => {
          face(g, x, y, (i * 37 + 11) * 7, 2);
          drawText(g, BINGO_SPEAKERS[i], x + 12, y + 30, { align: 'center', color: C.dim });
        });
        // Player at the table (back of head).
        rect(g, 104, 196, 24, 18, '#2b1d14');
        rect(g, 98, 210, 36, 8, C.accent);

        const word = current();
        if (word) {
          const [sx, sy] = seats[speaker];
          const scale = measureText(word, 2) <= 200 ? 2 : 1;
          const tw = measureText(word, scale);
          bubble.w = tw + 16;
          bubble.h = 12 + 8 * scale;
          bubble.x = Math.max(4, Math.min(226 - bubble.w, 115 - bubble.w / 2));
          bubble.y = 76;
          rect(g, bubble.x - 1, bubble.y - 1, bubble.w + 2, bubble.h + 2, C.border);
          rect(g, bubble.x, bubble.y, bubble.w, bubble.h, '#ffffff');
          // tail toward speaker
          const tx = Math.max(bubble.x + 6, Math.min(bubble.x + bubble.w - 10, sx + 10));
          for (let k = 0; k < 6; k++) rect(g, tx + (sx + 12 > tx ? k : -k) * 0.5, bubble.y + bubble.h + k, 6 - k, 1, '#ffffff');
          drawText(g, word, bubble.x + bubble.w / 2, bubble.y + 6, { align: 'center', color: C.ink, scale });
          const f = Math.max(0, wordT / dur);
          rect(g, bubble.x + 2, bubble.y + bubble.h - 3, (bubble.w - 4) * f, 2, f > 0.35 ? C.good : C.warn);
          frame(g, seats[speaker][0] - 2, seats[speaker][1] - 2, 28, 32, C.gold);
        } else {
          bubble.w = 0;
          drawText(g, '...', 115, 86, { align: 'center', color: C.dim, scale: 2 });
        }
        drawText(g, 'Space / click = mark', 115, 226, { align: 'center', color: C.dim });

        // Bingo card.
        panel(g, cardX, cardY, cardW, cardH, { fill: C.paper, light: '#ffffff', dark: '#b8b09a', title: 'B I N G O', titleColor: bingoFlash > 0 ? C.gold : C.accent });
        for (let i = 0; i < card.length; i++) {
          const cx = cardX + (i % size) * cw;
          const cy = cardY + 18 + Math.floor(i / size) * ch;
          rect(g, cx + 2, cy + 2, cw - 4, ch - 4, marked[i] ? '#cfe8c8' : '#fbf8ef');
          frame(g, cx + 2, cy + 2, cw - 4, ch - 4, '#c8bfa6');
          const lines2 = wrapText(card[i], cw - 8);
          lines2.forEach((ln, k) => drawText(g, ln, cx + cw / 2, cy + ch / 2 - lines2.length * 5 + k * 10 + 1, { align: 'center', color: C.ink }));
          if (marked[i]) {
            g.globalAlpha = 0.55;
            rect(g, cx + cw / 2 - 8, cy + ch / 2 - 8, 16, 16, C.bad);
            g.globalAlpha = 1;
            frame(g, cx + cw / 2 - 8, cy + ch / 2 - 8, 16, 16, '#9a2a2a');
          }
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
