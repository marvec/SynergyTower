// Slide Deck Order: pick the steps of a process in the right order to build the deck.
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, choiceBox, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { SEQUENCES } from '../data/mg-order.js';

export default {
  id: 'order',
  name: 'Slide Deck Order',
  help: 'Pick the steps in the correct order. Number keys, arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const rounds = Math.round(byDiff(d, 2, 4));
    const maxSteps = Math.round(byDiff(d, 4, 6));
    const pool = rng.shuffle(SEQUENCES[theme?.dept] || SEQUENCES.it);
    const decks = pool.slice(0, rounds).map(([title, ...steps]) => ({ title, steps: steps.slice(0, maxSteps) }));
    const total = Math.min(90, rounds * byDiff(d, 22, 13));
    const fl = new Floaters();
    const shake = new Shake();

    let round = 0;
    let elapsed = 0;
    let deck;
    let options; // [{ text, step, placed }]
    let placed; // texts in order
    let mistakes;
    let focus = 0;
    let wrongFlash = -1;
    let wrongT = 0;
    let between = 0;
    const roundScores = [];

    const startRound = () => {
      deck = decks[round];
      options = rng.shuffle(deck.steps.map((text, step) => ({ text, step, placed: false })));
      placed = [];
      mistakes = 0;
      focus = 0;
    };
    startRound();

    const roundScore = () => Math.max(0, 1 - mistakes * 0.25) * (placed.length / deck.steps.length);
    const final = () => {
      const sum = roundScores.reduce((a, b) => a + b, 0);
      return sum / rounds;
    };

    const choose = (i) => {
      const o = options[i];
      if (!o || o.placed) return;
      if (o.step === placed.length) {
        o.placed = true;
        placed.push(o.text);
        sfx('good');
        fl.add(`Slide ${placed.length}`, slotX(placed.length - 1) + slotW() / 2, 80, C.good);
        if (placed.length === deck.steps.length) {
          roundScores.push(roundScore());
          sfx('coin');
          between = 0.9;
        } else moveFocus(0);
      } else {
        mistakes++;
        sfx('bad');
        shake.hit();
        wrongFlash = i;
        wrongT = 0.35;
        fl.add('Not yet!', optX(i) + 110, optY(i), C.bad);
      }
    };

    const moveFocus = (dir) => {
      const n = options.length;
      if (dir === 0) {
        if (!options[focus].placed) return;
        dir = 1;
      }
      for (let k = 0; k < n; k++) {
        focus = (focus + dir + n) % n;
        if (!options[focus].placed) return;
      }
      focus = Math.max(0, options.findIndex((o) => !o.placed));
    };

    const slotW = () => Math.floor((W - 24 - (deck.steps.length - 1) * 4) / deck.steps.length);
    const slotX = (i) => 12 + i * (slotW() + 4);
    const optX = (i) => (i % 2 === 0 ? 14 : W / 2 + 4);
    const optY = (i) => 118 + Math.floor(i / 2) * 36;

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        wrongT = Math.max(0, wrongT - dt);
        if (inst.done) return;
        elapsed += dt;
        if (elapsed >= total) {
          if (between <= 0) roundScores.push(roundScore());
          return finish(inst, final());
        }
        if (between > 0) {
          between -= dt;
          if (between <= 0) {
            round++;
            if (round >= rounds) return finish(inst, final());
            startRound();
          }
          return;
        }
        for (let i = 0; i < options.length; i++) if (input.pressedExact(String(i + 1))) return choose(i);
        if (input.pressed('ArrowRight') || input.pressed('ArrowDown')) {
          moveFocus(input.pressed('ArrowDown') ? 2 : 1);
          sfx('blip');
        }
        if (input.pressed('ArrowLeft') || input.pressed('ArrowUp')) {
          moveFocus(input.pressed('ArrowUp') ? -2 : -1);
          sfx('blip');
        }
        if (options[focus]?.placed) moveFocus(1);
        if (input.confirm()) return choose(focus);
        const p = input.pointer;
        options.forEach((o, i) => {
          if (o.placed) return;
          if (p.x >= optX(i) && p.x < optX(i) + 212 && p.y >= optY(i) && p.y < optY(i) + 30) {
            if (p.moved) focus = i;
            if (p.clicked) choose(i);
          }
        });
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3a3f5a', desk: '#4f3a2c' });
        header(g, theme?.title || 'Slide Deck Order', `Deck ${Math.min(round + 1, rounds)}/${rounds}`);
        timerBar(g, total - elapsed, total);
        drawText(g, `Deck: ${deck.title}`, W / 2, 25, { align: 'center', color: C.gold, shadow: C.border, scale: 1 });
        // Slide slots.
        const sw = slotW();
        deck.steps.forEach((_, i) => {
          const x = slotX(i);
          const y = 38;
          const filled = i < placed.length;
          rect(g, x + 2, y + 2, sw, 56, 'rgba(0,0,0,0.3)');
          rect(g, x, y, sw, 56, filled ? '#ffffff' : '#555b74');
          frame(g, x, y, sw, 56, filled ? C.accent : '#6c7290');
          if (filled) {
            rect(g, x, y, sw, 8, C.accent);
            drawText(g, String(i + 1), x + 3, y, { color: C.text });
            const lines = wrapText(placed[i], sw - 6);
            lines.slice(0, 4).forEach((ln, k) => drawText(g, ln, x + sw / 2, y + 14 + k * 10, { align: 'center', color: C.ink }));
          } else {
            drawText(g, '?', x + sw / 2, y + 20, { align: 'center', color: '#8a90a8', scale: 2 });
          }
        });
        drawText(g, 'What comes next?', 14, 104, { color: C.text, shadow: C.border });
        options.forEach((o, i) => {
          if (o.placed) {
            rect(g, optX(i), optY(i), 212, 30, 'rgba(0,0,0,0.18)');
            return;
          }
          const state = wrongT > 0 && wrongFlash === i ? 'wrong' : i === focus ? 'focus' : 'idle';
          choiceBox(g, optX(i), optY(i), 212, 30, String(i + 1), o.text, state);
        });
        if (between > 0) {
          panel(g, W / 2 - 70, 92, 140, 22, { fill: '#2f6b3a' });
          drawText(g, mistakes ? `Deck done (${mistakes} oops)` : 'Flawless deck!', W / 2, 99, { align: 'center' });
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
