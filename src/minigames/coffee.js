// Coffee Run: memorise colleagues' coffee orders, then rebuild each one from memory.
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, choiceBox, face, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';

const PARTS = [
  { key: 'Size', options: ['Tiny', 'Tall', 'Grande', 'Venti', 'Bucket'] },
  { key: 'Drink', options: ['Latte', 'Flat White', 'Cold Brew', 'Matcha', 'Decaf', 'Espresso', 'Mocha', 'Chai', 'Hot Water'] },
  { key: 'Milk', options: ['Whole', 'Oat', 'Almond', 'Soy', 'Skim', 'No milk', 'Goat'] },
  { key: 'Extra', options: ['Extra shot', 'Caramel', 'Sprinkles', 'Ice', 'Whip', 'Cinnamon', 'Honey', 'Unicorn dust'] },
];
const NAMES = ['Ada', 'Bob', 'Cleo', 'Dev', 'Eve', 'Finn', 'Gus', 'Hana', 'Kai', 'Lena', 'Milo', 'Nia', 'Otto', 'Rosa', 'Tess', 'Vera'];
const BOSSES = { lobby: 'Head Porter', support: 'Team Lead', sales: 'Sales VP', marketing: 'CMO', it: 'CTO', finance: 'CFO', legalhr: 'HR Head', exec: 'CEO' };
const CUP = { Tiny: 10, Tall: 14, Grande: 17, Venti: 20, Bucket: 24 };

export default {
  id: 'coffee',
  name: 'Coffee Run',
  help: 'Memorise every order, then rebuild each one. Keys 1-4, arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const comps = Math.round(byDiff(d, 2, 4));
    const parts = PARTS.slice(0, comps);
    const count = Math.round(byDiff(d, 2, 4));
    const names = rng.sample(NAMES, count);
    if (theme?.dept && BOSSES[theme.dept]) names[count - 1] = BOSSES[theme.dept];
    const orders = names.map((name) => ({ name, seed: rng.int(0, 4095), picks: parts.map((p) => rng.pick(p.options)) }));
    const memoTime = count * comps * byDiff(d, 1.4, 0.8) + 1.5;
    const buildTime = Math.min(70, count * comps * byDiff(d, 4.5, 2.6) + 5);
    const totalComps = count * comps;
    const fl = new Floaters();
    const shake = new Shake();

    let phase = 'memo';
    let memoLeft = memoTime;
    let buildLeft = buildTime;
    let oi = 0; // order index
    let pi = 0; // part index
    let correct = 0;
    let built = []; // picks for current order [{ text, ok }]
    let choices = [];
    let focus = 0;
    let flash = null;
    let nextT = 0;

    const makeChoices = () => {
      const part = parts[pi];
      const right = orders[oi].picks[pi];
      const others = rng.sample(part.options.filter((o) => o !== right), 3);
      choices = rng.shuffle([right, ...others]);
      focus = 0;
    };

    const choose = (i) => {
      const text = choices[i];
      if (text === undefined || nextT > 0) return;
      const ok = text === orders[oi].picks[pi];
      built.push({ text, ok });
      if (ok) {
        correct++;
        sfx('good');
      } else {
        sfx('bad');
        shake.hit(0.15);
        fl.add(`They wanted ${orders[oi].picks[pi]}`, 300, 200, C.bad);
      }
      flash = { i, ok, t: 0.3 };
      pi++;
      if (pi >= comps) {
        nextT = 0.8;
        const allOk = built.every((b) => b.ok);
        fl.add(allOk ? 'Perfect cup!' : 'Close enough?', 80, 120, allOk ? C.good : C.warn);
        if (allOk) sfx('coin');
      } else makeChoices();
    };

    const optRect = (i) => ({ x: 176 + (i % 2) * 150, y: 126 + Math.floor(i / 2) * 40, w: 144, h: 32 });

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (flash) flash.t -= dt;
        if (inst.done) return;
        if (phase === 'memo') {
          memoLeft -= dt;
          if (memoLeft <= 0 || input.confirm() || input.pointer.clicked) {
            if (input.pointer.clicked) input.consumeClick();
            phase = 'build';
            makeChoices();
          }
          return;
        }
        buildLeft -= dt;
        if (buildLeft <= 0) return finish(inst, correct / totalComps);
        if (nextT > 0) {
          nextT -= dt;
          if (nextT <= 0) {
            oi++;
            pi = 0;
            built = [];
            if (oi >= count) return finish(inst, correct / totalComps);
            makeChoices();
          }
          return;
        }
        for (let i = 0; i < 4; i++) if (input.pressedExact(String(i + 1))) return choose(i);
        if (input.pressed('ArrowRight')) focus = (focus + 1) % 4;
        if (input.pressed('ArrowLeft')) focus = (focus + 3) % 4;
        if (input.pressed('ArrowDown')) focus = (focus + 2) % 4;
        if (input.pressed('ArrowUp')) focus = (focus + 2) % 4;
        if (input.confirm()) return choose(focus);
        const p = input.pointer;
        for (let i = 0; i < 4; i++) {
          const r = optRect(i);
          if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
            if (p.moved) focus = i;
            if (p.clicked) return choose(i);
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#4a3a34', desk: '#3a2a22' });
        // Café menu board.
        rect(g, 0, 18, W, 2, '#2a1d18');
        if (phase === 'memo') {
          header(g, theme?.title || 'Coffee Run', 'MEMORISE');
          timerBar(g, memoLeft, memoTime);
          drawText(g, 'Remember these orders!', W / 2, 26, { align: 'center', color: C.gold, shadow: C.border });
          const cw = Math.min(110, Math.floor((W - 20) / count) - 8);
          const x0 = Math.floor((W - count * (cw + 8) + 8) / 2);
          orders.forEach((o, i) => {
            const x = x0 + i * (cw + 8);
            const y = 42;
            panel(g, x, y, cw, 150, { fill: C.paper, light: '#ffffff', dark: '#b8b09a' });
            face(g, x + cw / 2 - 12, y + 8, o.seed, 2);
            drawText(g, o.name, x + cw / 2, y + 40, { align: 'center', color: C.ink });
            rect(g, x + 8, y + 52, cw - 16, 1, '#c8bfa6');
            o.picks.forEach((pk, k) => {
              drawText(g, parts[k].key + ':', x + 8, y + 60 + k * 20, { color: '#8a8070' });
              drawText(g, pk, x + 8, y + 69 + k * 20, { color: C.ink });
            });
          });
          drawText(g, 'Space / click when ready', W / 2, H - 18, { align: 'center', color: C.text, shadow: C.border });
        } else {
          header(g, theme?.title || 'Coffee Run', `Order ${Math.min(oi + 1, count)}/${count}`);
          timerBar(g, buildLeft, buildTime);
          const o = orders[Math.min(oi, count - 1)];
          // Customer.
          panel(g, 10, 28, 150, 200, { fill: '#5a463c', light: '#6e584c', dark: '#3a2c24' });
          face(g, 85 - 18, 40, o.seed, 3);
          drawText(g, o.name, 85, 88, { align: 'center', color: C.text, shadow: C.border });
          drawText(g, '"The usual, please."', 85, 100, { align: 'center', color: C.dim });
          // Cup being built.
          const size = built.find((b, k) => parts[k].key === 'Size')?.text;
          const ch = (CUP[size] || 16) * 2;
          const cupX = 70;
          const cupY = 210 - ch;
          rect(g, cupX, cupY, 30, ch, '#f4f1e8');
          rect(g, cupX - 2, cupY - 4, 34, 5, '#3a2a22');
          rect(g, cupX, cupY + ch / 3, 30, ch / 3, C.accent);
          frame(g, cupX, cupY, 30, ch, '#9a9080');
          built.forEach((b, k) => {
            drawText(g, `${b.ok ? '+' : 'x'} ${b.text}`, 18, 118 + k * 10, { color: b.ok ? C.good : C.bad });
          });
          // Choices.
          if (pi < comps && nextT <= 0) {
            drawText(g, `Pick the ${parts[pi].key}:`, 176, 108, { color: C.gold, shadow: C.border });
            choices.forEach((text, i) => {
              const r = optRect(i);
              let state = i === focus ? 'focus' : 'idle';
              if (flash && flash.t > 0 && flash.i === i) state = flash.ok ? 'right' : 'wrong';
              choiceBox(g, r.x, r.y, r.w, r.h, String(i + 1), text, state);
            });
          }
          // Progress dots.
          parts.forEach((p, k) => {
            const x = 176 + k * 72;
            rect(g, x, 40, 66, 18, k < pi ? '#2f6b3a' : k === pi ? C.accent : C.panelDark);
            frame(g, x, 40, 66, 18, C.border);
            drawText(g, p.key, x + 33, 45, { align: 'center' });
          });
          drawText(g, `Correct ${correct}/${totalComps}`, W - 12, 66, { align: 'right', color: C.gold, shadow: C.border });
        }
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
