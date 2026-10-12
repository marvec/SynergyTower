// Pool bar cocktail (vacation hotel): the barman tosses fruit, you catch it in the glass. Everything goes in, nothing
// is bad for you here.
import { W, H, C, rect, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const GOAL = 10;
const FLOOR_Y = 228;
const SPEED = 240;
const HALF = 26; // half the glass's catch width
const FRUIT = [
  { a: '#f2e14e', b: '#2f8a3a' }, // pineapple
  { a: '#f29c38', b: '#5fd068' }, // orange
  { a: '#e2504a', b: '#5fd068' }, // cherry
  { a: '#8a5a3a', b: '#f4f1e8' }, // coconut
  { a: '#5fd068', b: '#2f8a3a' }, // lime
];

export default {
  id: 'cocktail',
  name: 'Pina Colada',
  help: 'Move the glass with the arrow keys or the mouse and catch the falling fruit. The more fruit, the better the cocktail!',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    const glass = { x: W / 2 };
    const fruit = [];
    let spawnT = 0.5;
    let caught = 0;
    let t = 0;

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ glass: { ...glass }, fruit: fruit.map((f) => ({ x: f.x, y: f.y })) }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, caught / GOAL);
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = 1.5;
          let x = rng.int(60, W - 60);
          if (Math.abs(x - glass.x) < 80) x = clamp(glass.x + (x < glass.x ? -1 : 1) * rng.int(90, 160), 60, W - 60);
          fruit.push({ x, y: 40, vy: 60, f: rng.pick(FRUIT), spin: rng.float(0, 6) });
        }
        const p = input.pointer;
        if (p.inside && (p.moved || p.down)) glass.x += clamp(p.x - glass.x, -SPEED * 1.5 * dt, SPEED * 1.5 * dt);
        if (input.down('ArrowLeft')) glass.x -= SPEED * dt;
        if (input.down('ArrowRight')) glass.x += SPEED * dt;
        glass.x = clamp(glass.x, 30, W - 30);
        for (let i = fruit.length - 1; i >= 0; i--) {
          const f = fruit[i];
          f.vy = Math.min(110, f.vy + 30 * dt);
          f.y += f.vy * dt;
          f.spin += dt * 5;
          if (f.y >= FLOOR_Y - 34 && f.y < FLOOR_Y - 18 && Math.abs(f.x - glass.x) < HALF) {
            fruit.splice(i, 1);
            caught++;
            sfx('coin');
            fl.add(String(caught), glass.x, FLOOR_Y - 60, C.gold);
            if (caught >= GOAL) return finish(inst, 1);
          } else if (f.y > FLOOR_Y + 10) {
            fruit.splice(i, 1);
            fl.add('splat', f.x, FLOOR_Y - 10, C.dim);
          }
        }
      },
      render(g) {
        // Sunset over the sea behind the bar.
        rect(g, 0, 0, W, H, '#e85d75');
        rect(g, 0, 70, W, 40, '#f29c38');
        rect(g, 0, 110, W, 40, '#f2c14e');
        rect(g, 300, 112, 60, 38, '#fff6c8');
        rect(g, 306, 106, 48, 6, '#fff6c8');
        rect(g, 0, 150, W, H - 150, '#2a86c7');
        for (let i = 0; i < 10; i++) rect(g, 290 + ((i * 13) % 80), 156 + i * 7, 30 - i * 2, 2, '#f6c87a');
        for (const x of [40, 430]) {
          rect(g, x, 60, 5, 168, '#3a2b2b');
          for (const [dx, dy, w] of [[-22, 50, 24], [3, 50, 24], [-16, 44, 14], [5, 44, 14], [-6, 40, 16]]) rect(g, x + dx, dy + 10, w, 5, '#2b1f2b');
        }
        // The thatched bar roof along the top.
        rect(g, 0, 14, W, 18, '#c9a14a');
        for (let x = 0; x < W; x += 6) rect(g, x, 32, 3, 4 + (x % 12 ? 0 : 3), '#a8862f');
        rect(g, 0, FLOOR_Y, W, H - FLOOR_Y, '#b98a5a');
        for (let x = 0; x < W; x += 20) rect(g, x, FLOOR_Y, 1, H - FLOOR_Y, '#8f6640');
        for (const f of fruit) {
          const x = Math.round(f.x);
          const y = Math.round(f.y);
          rect(g, x - 7, y - 7, 14, 14, '#1a1a22');
          rect(g, x - 6, y - 6, 12, 12, f.f.a);
          rect(g, x - 2 + Math.round(Math.cos(f.spin) * 2), y - 10, 4, 4, f.f.b);
        }
        // The glass: a tall one with a paper umbrella, filling up.
        const x = Math.round(glass.x);
        const top = FLOOR_Y - 34;
        rect(g, x - 18, top, 36, 34, '#1a1a22');
        rect(g, x - 16, top + 2, 32, 30, '#e8f8ff');
        const fill = Math.round(28 * Math.min(1, caught / GOAL));
        rect(g, x - 16, top + 32 - fill, 32, fill, '#f6e8b8');
        rect(g, x + 8, top - 18, 2, 20, '#8a5a3a');
        rect(g, x + 1, top - 20, 16, 4, '#e85d75');
        header(g, theme?.title || 'Pool bar', `Fruit ${caught}/${GOAL}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
