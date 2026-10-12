// Dinner buffet (vacation hotel): dishes appear along the buffet; touch them with your plate to eat them. All inclusive,
// nothing is off limits.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const GOAL = 12;
const AREA = { x: 40, y: 70, w: 400, h: 150 };
const SPEED = 190;
const REACH = 26;
const DISHES = [
  { name: 'Lobster', a: '#e2504a', b: '#ffd0c8' },
  { name: 'Sushi', a: '#ffffff', b: '#f29c38' },
  { name: 'Mango', a: '#f2c14e', b: '#f29c38' },
  { name: 'Cake', a: '#8a4a2a', b: '#f29cd0' },
  { name: 'Salad', a: '#5fd068', b: '#e2504a' },
  { name: 'Pineapple', a: '#f2e14e', b: '#2f8a3a' },
  { name: 'Ice cream', a: '#f4f1e8', b: '#7fc4ff' },
  { name: 'Pizza', a: '#f2c14e', b: '#c74634' },
];

export default {
  id: 'buffet',
  name: 'All You Can Eat',
  help: 'Move your plate with the mouse or the arrow keys and touch the dishes on the buffet to eat them. Everything is included!',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    const plate = { x: W / 2, y: AREA.y + AREA.h / 2 };
    const items = [];
    let spawnT = 0.2;
    let eaten = 0;
    let t = 0;

    const spawn = () => {
      for (let tries = 0; tries < 10; tries++) {
        const x = rng.int(AREA.x + 16, AREA.x + AREA.w - 16);
        const y = rng.int(AREA.y + 16, AREA.y + AREA.h - 16);
        if (Math.hypot(x - plate.x, y - plate.y) < 60) continue;
        if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 36)) continue;
        items.push({ x, y, d: rng.pick(DISHES), age: 0 });
        return;
      }
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ plate: { ...plate }, items: items.map((o) => ({ x: o.x, y: o.y })) }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, eaten / GOAL);
        spawnT -= dt;
        if (spawnT <= 0 && items.length < 4) {
          spawnT = 0.9;
          spawn();
        }
        const p = input.pointer;
        if (p.inside && (p.moved || p.down) && p.y > 20) {
          plate.x += clamp(p.x - plate.x, -SPEED * 2 * dt, SPEED * 2 * dt);
          plate.y += clamp(p.y - plate.y, -SPEED * 2 * dt, SPEED * 2 * dt);
        }
        if (input.down('ArrowLeft')) plate.x -= SPEED * dt;
        if (input.down('ArrowRight')) plate.x += SPEED * dt;
        if (input.down('ArrowUp')) plate.y -= SPEED * dt;
        if (input.down('ArrowDown')) plate.y += SPEED * dt;
        plate.x = clamp(plate.x, AREA.x, AREA.x + AREA.w);
        plate.y = clamp(plate.y, AREA.y, AREA.y + AREA.h);
        for (let i = items.length - 1; i >= 0; i--) {
          const o = items[i];
          o.age += dt;
          if (Math.hypot(o.x - plate.x, o.y - plate.y) < REACH) {
            items.splice(i, 1);
            eaten++;
            sfx('coin');
            fl.add(`Yum! ${o.d.name}`, o.x, o.y - 10, C.gold);
          }
        }
        if (eaten >= GOAL) finish(inst, 1);
      },
      render(g) {
        rect(g, 0, 0, W, H, '#6e4529');
        for (let x = 0; x < W; x += 20) rect(g, x, 0, 1, H, '#7a5536');
        // The buffet: a long white table with a teal runner.
        rect(g, AREA.x - 12, AREA.y - 12, AREA.w + 24, AREA.h + 24, '#1a1a22');
        rect(g, AREA.x - 11, AREA.y - 11, AREA.w + 22, AREA.h + 22, '#f4f1e8');
        rect(g, AREA.x - 11, AREA.y + AREA.h / 2 - 6, AREA.w + 22, 12, '#5fd0c8');
        for (const o of items) {
          const pop = Math.min(1, o.age * 5);
          rect(g, o.x - 17, o.y - 5, 34, 16, '#1a1a22');
          rect(g, o.x - 16, o.y - 4, 32, 14, '#c8ccd4');
          rect(g, o.x - 16, o.y + 6, 32, 4, '#a8acb4');
          const w = Math.round(26 * pop);
          const h = Math.round(14 * pop);
          rect(g, o.x - w / 2 - 1, o.y - h + 2, w + 2, h + 1, '#1a1a22');
          rect(g, o.x - w / 2, o.y - h + 3, w, h - 1, o.d.a);
          rect(g, o.x - 8 * pop, o.y - h + 5, 5 * pop, 4 * pop, o.d.b);
          rect(g, o.x + 3 * pop, o.y - h + 8, 5 * pop, 3 * pop, o.d.b);
          rect(g, o.x - w / 2 + 1, o.y - h + 3, w - 2, 1, 'rgba(255,255,255,0.4)');
        }
        // Your plate, with a fork.
        rect(g, plate.x - 16, plate.y - 11, 32, 22, '#1a1a22');
        rect(g, plate.x - 15, plate.y - 10, 30, 20, '#ffffff');
        rect(g, plate.x - 9, plate.y - 6, 18, 12, '#e8e6e0');
        rect(g, plate.x + 18, plate.y - 12, 3, 24, '#1a1a22');
        rect(g, plate.x + 19, plate.y - 11, 1, 22, '#e8eaf0');
        rect(g, plate.x + 17, plate.y - 12, 5, 6, '#c8ccd4');
        header(g, theme?.title || 'Dinner buffet', `Eaten ${eaten}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Touch anything on the buffet to eat it', W / 2, 30, { align: 'center', color: '#f6e8b8' });
        drawText(g, 'Chef recommends: everything', W / 2, 240, { align: 'center', color: '#f6e8b8' });
        fl.render(g);
      },
    };
    return inst;
  },
};
