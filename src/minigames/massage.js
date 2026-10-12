// Massage (vacation hotel): knots show up on your back, red and tense. Tap each one to let it go; they wait patiently.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const GOAL = 12;
const BACK = { x: 150, y: 60, w: 180, h: 160 };
const SPEED = 200;
const REACH = 16;

export default {
  id: 'massage',
  name: 'Deep Tissue',
  help: 'Click the knots on the back, or move the hands with the arrow keys and press SPACE. Let them all go.',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    const hand = { x: BACK.x + BACK.w / 2, y: BACK.y + BACK.h / 2 };
    const knots = [];
    let spawnT = 0.3;
    let released = 0;
    let press = 0;
    let t = 0;

    const relax = (k) => {
      knots.splice(knots.indexOf(k), 1);
      released++;
      sfx('good');
      fl.add(released % 3 ? 'Ahh...' : 'Mmm!', k.x, k.y - 12, '#f6e8b8');
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ hand: { ...hand }, knots: knots.map((k) => ({ x: k.x, y: k.y })) }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        press = Math.max(0, press - dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, released / GOAL);
        spawnT -= dt;
        if (spawnT <= 0 && knots.length < 2) {
          spawnT = 0.8;
          const k = { x: rng.int(BACK.x + 20, BACK.x + BACK.w - 20), y: rng.int(BACK.y + 20, BACK.y + BACK.h - 20), age: 0 };
          if (Math.hypot(k.x - hand.x, k.y - hand.y) > 40) knots.push(k);
        }
        for (const k of knots) k.age += dt;
        if (input.down('ArrowLeft')) hand.x -= SPEED * dt;
        if (input.down('ArrowRight')) hand.x += SPEED * dt;
        if (input.down('ArrowUp')) hand.y -= SPEED * dt;
        if (input.down('ArrowDown')) hand.y += SPEED * dt;
        const p = input.pointer;
        if (p.inside && p.moved && p.y > 20) Object.assign(hand, { x: p.x, y: p.y });
        hand.x = clamp(hand.x, BACK.x, BACK.x + BACK.w);
        hand.y = clamp(hand.y, BACK.y, BACK.y + BACK.h);
        const at = (x, y) => knots.find((k) => Math.hypot(k.x - x, k.y - y) < REACH);
        if (p.clicked) {
          press = 0.2;
          const k = at(p.x, p.y);
          if (k) relax(k);
        } else if (input.confirm()) {
          press = 0.2;
          const k = at(hand.x, hand.y);
          if (k) relax(k);
        }
        if (released >= GOAL) finish(inst, 1);
      },
      render(g) {
        rect(g, 0, 0, W, H, '#e6d3ad');
        for (let x = 0; x < W; x += 16) rect(g, x, 0, 8, H, '#ead9b6');
        // The massage table and a back, seen from above.
        rect(g, BACK.x - 30, BACK.y - 40, BACK.w + 60, BACK.h + 70, '#ffffff');
        rect(g, BACK.x - 30, BACK.y + BACK.h + 10, BACK.w + 60, 20, '#2fa39a');
        rect(g, BACK.x + BACK.w / 2 - 22, BACK.y - 36, 44, 34, '#5a3a22');
        rect(g, BACK.x - 24, BACK.y - 4, 30, 90, '#f2c9a0');
        rect(g, BACK.x + BACK.w - 6, BACK.y - 4, 30, 90, '#f2c9a0');
        rect(g, BACK.x, BACK.y, BACK.w, BACK.h, '#f2c9a0');
        rect(g, BACK.x + BACK.w / 2 - 1, BACK.y + 10, 2, BACK.h - 20, '#d9a273');
        for (const k of knots) {
          const r = 6 + Math.round(Math.sin(k.age * 6) * 1.5);
          rect(g, k.x - r, k.y - r + 2, r * 2, r * 2 - 4, '#e2504a');
          rect(g, k.x - r + 2, k.y - r, r * 2 - 4, r * 2, '#e2504a');
          rect(g, k.x - 2, k.y - 2, 4, 4, '#ff8a80');
        }
        // The masseur's hands.
        const sq = press > 0 ? 2 : 0;
        for (const dx of [-12, 4]) {
          rect(g, hand.x + dx - sq, hand.y - 6 + sq, 10, 12, '#1a1a22');
          rect(g, hand.x + dx + 1 - sq, hand.y - 5 + sq, 8, 10, '#d9a273');
        }
        // Candles and a lotus flower.
        for (const x of [40, 420]) {
          rect(g, x, 200, 12, 18, '#f4f1e8');
          rect(g, x + 5, 194 + Math.round(Math.sin(t * 8 + x) * 1), 2, 6, '#f29c38');
        }
        header(g, theme?.title || 'Massage', `Knots ${released}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Find the knots and let them go', W / 2, 256, { align: 'center', color: '#5a3a22' });
        fl.render(g);
      },
    };
    return inst;
  },
};
