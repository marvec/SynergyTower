// Laundry (home office chore): clothes drop out of the basket one by one. Sort each into the right wash before it hits
// the floor: whites hot, colours warm, and anything wool or silk on the delicate cycle, whatever its colour.
import { W, H, rect, drawText, header, timerBar, Floaters, Shake, Countdown, finish } from '../engine/mgkit.js';

const ITEMS = 14;
const FALL_S = 3.4;
const GAP_S = 0.35;
const BINS = [
  { label: 'WHITES', temp: '60C', key: '1', arrow: 'ArrowLeft', drum: '#f4f6f8', x: 70 },
  { label: 'COLOURS', temp: '40C', key: '2', arrow: 'ArrowDown', drum: '#f29c38', x: 190 },
  { label: 'DELICATES', temp: '30C', key: '3', arrow: 'ArrowRight', drum: '#c8a8e8', x: 310 },
];
const BIN_W = 100;
const BIN_Y = 180;
const WHITE = ['White shirt', 'White socks', 'White towel', 'White T-shirt', 'Pillowcase'];
const COLOUR = [['Red T-shirt', '#e2504a'], ['Blue jeans', '#3b6fb6'], ['Green hoodie', '#2f8a3a'], ['Black socks', '#2b2e38'], ['Yellow towel', '#f2c14e'], ['Pink pyjamas', '#f29cd0']];
const DELICATE = [['Wool jumper', 'WOOL'], ['Silk blouse', 'SILK'], ['Cashmere scarf', 'WOOL'], ['Silk tie', 'SILK'], ['Lace top', 'HAND WASH']];
const DELICATE_COLORS = ['#f4f6f8', '#e2504a', '#3b6fb6', '#c8a8e8', '#2f8a3a'];

export default {
  id: 'laundry',
  name: 'Separate Cycles',
  help: 'Sort each piece before it lands: LEFT (or 1) whites, DOWN (2) colours, RIGHT (3) delicates, or click the drum. Wool and silk always go delicate.',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(70);
    const fl = new Floaters();
    const shake = new Shake();
    const pile = [];
    for (let i = 0; i < ITEMS; i++) {
      const k = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
      if (k === 0) pile.push({ name: rng.pick(WHITE), color: '#f4f6f8', bin: 0, tag: 'COTTON' });
      else if (k === 1) {
        const [name, color] = rng.pick(COLOUR);
        pile.push({ name, color, bin: 1, tag: 'COTTON' });
      } else {
        const [name, tag] = rng.pick(DELICATE);
        pile.push({ name, color: rng.pick(DELICATE_COLORS), bin: 2, tag });
      }
    }
    const order = rng.shuffle(pile);
    let item = null;
    let next = 0;
    let gap = 0.6;
    let good = 0;
    let seen = 0;
    const sorted = [0, 0, 0];

    const sort = (bin) => {
      const ok = bin === item.bin;
      if (ok) {
        good++;
        sorted[bin]++;
        sfx('good');
        fl.add('In!', BINS[bin].x + BIN_W / 2, BIN_Y - 10, '#5fd068');
      } else {
        sfx('bad');
        shake.hit();
        fl.add(item.bin === 2 ? 'Shrunk!' : item.bin === 0 ? 'Now it is pink!' : 'Faded!', BINS[bin].x + BIN_W / 2, BIN_Y - 10, '#e2504a');
      }
      item = null;
      gap = GAP_S;
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ item: item ? { bin: item.bin, y: item.y } : null, keys: BINS.map((b) => b.arrow) }),
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / ITEMS);
        if (!item) {
          gap -= dt;
          if (gap > 0) return;
          if (next >= order.length) return finish(inst, good / ITEMS);
          item = { ...order[next++], t: 0, y: 30 };
          seen++;
          return;
        }
        item.t += dt;
        item.y = 30 + (item.t / FALL_S) * (BIN_Y - 40);
        if (item.t >= FALL_S) {
          sfx('fail');
          fl.add('On the floor...', W / 2, BIN_Y - 10, '#e2504a');
          item = null;
          gap = GAP_S;
          return;
        }
        const p = input.pointer;
        for (let i = 0; i < BINS.length; i++) {
          const b = BINS[i];
          if (input.pressed(b.arrow) || input.pressedExact(b.key)) return sort(i);
          if (p.clicked && p.x >= b.x && p.x < b.x + BIN_W && p.y >= BIN_Y - 20 && p.y < H) return sort(i);
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, H, '#bccbd6');
        for (let x = 0; x < W; x += 24) rect(g, x, 0, 1, H, '#aab9c4');
        for (const [i, b] of BINS.entries()) {
          rect(g, b.x, BIN_Y, BIN_W, 80, '#1a1a22');
          rect(g, b.x + 1, BIN_Y + 1, BIN_W - 2, 78, '#f4f6f8');
          rect(g, b.x + 25, BIN_Y + 20, 50, 46, '#1a1a22');
          rect(g, b.x + 28, BIN_Y + 23, 44, 40, '#6a8aa8');
          rect(g, b.x + 32, BIN_Y + 40, 36, 8 + Math.min(14, sorted[i] * 3), b.drum);
          drawText(g, `${b.key} ${b.label}`, b.x + BIN_W / 2, BIN_Y + 5, { align: 'center', color: '#1a1a22' });
          drawText(g, b.temp, b.x + BIN_W / 2, BIN_Y + 68, { align: 'center', color: '#3a3d48' });
        }
        // The basket and the piece on its way down.
        rect(g, 400, 26, 64, 36, '#8a6a3a');
        rect(g, 404, 30, 56, 6, '#b98a5a');
        if (item) {
          const x = 240;
          const y = item.y;
          rect(g, x - 20, y - 10, 40, 24, '#1a1a22');
          rect(g, x - 19, y - 9, 38, 22, item.color);
          rect(g, x - 26, y - 9, 8, 10, item.color);
          rect(g, x + 18, y - 9, 8, 10, item.color);
          rect(g, x - 8, y + 4, 16, 7, '#ffffff');
          drawText(g, item.tag === 'COTTON' ? '' : item.tag, x, y + 15, { align: 'center', color: '#7a3bb6' });
          drawText(g, item.name, x, y - 22, { align: 'center', color: '#1a1a22' });
        }
        g.restore();
        header(g, theme?.title || 'Laundry', `${good}/${ITEMS} sorted · ${seen}/${ITEMS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
