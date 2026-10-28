// Laundry (home office chore): clothes drop out of the basket one by one. Sort each into the right wash before it hits
// the floor: whites hot, colours warm, and anything wool or silk on the delicate cycle, whatever its colour.
import { W, H, rect, drawText, header, timerBar, Floaters, Shake, Countdown, finish } from '../engine/mgkit.js';
import { cblob, shade, bake } from '../engine/mgart.js';
import { subway } from '../engine/mgscenery.js';

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

// What each piece looks like when it falls: one of six garment shapes; an unknown name is a T-shirt.
export const GARMENTS = ['hoodie', 'tshirt', 'socks', 'jeans', 'shirt', 'towel'];
export const GARMENT_OF = {
  'White shirt': 'shirt', 'White socks': 'socks', 'White towel': 'towel', 'White T-shirt': 'tshirt', Pillowcase: 'towel',
  'Red T-shirt': 'tshirt', 'Blue jeans': 'jeans', 'Green hoodie': 'hoodie', 'Black socks': 'socks', 'Yellow towel': 'towel', 'Pink pyjamas': 'shirt',
  'Wool jumper': 'hoodie', 'Silk blouse': 'shirt', 'Cashmere scarf': 'towel', 'Silk tie': 'shirt', 'Lace top': 'tshirt',
};
export const ITEM_NAMES = [...WHITE, ...COLOUR.map((c) => c[0]), ...DELICATE.map((d) => d[0])];
export const garmentOf = (name) => GARMENT_OF[name] || 'tshirt';

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
    let t = 0;
    const scene = bake(W, H, (b) => {
      room(b);
      for (const bin of BINS) machine(b, bin);
    });

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
      peek: () => ({ item: item ? { bin: item.bin, y: item.y, color: item.color } : null, keys: BINS.map((b) => b.arrow) }),
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        t += dt;
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
        g.drawImage(scene, 0, 0);
        for (const [i, b] of BINS.entries()) load(g, b, sorted[i], t);
        if (item) {
          // Drawn a little lower than item.y so the name clears the header, and squeezed so it stops just above the
          // machines (its middle at y 155) when it hits the floor.
          const x = 240;
          const y = 46 + (item.y - 30) * 0.78;
          drawGarment(g, garmentOf(item.name), x, y, item.color);
          drawText(g, item.name, x, y - 26, { align: 'center', color: '#1a1a22' });
          if (item.tag !== 'COTTON') drawText(g, item.tag, x, y + 24, { align: 'center', color: '#7a3bb6' });
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

/** The utility room: subway tiles, a shelf (powder, softener, folded towels), the tiled floor, the wicker basket. */
function room(g) {
  subway(g, 0, 18, W, 160, '#e4ecf0', '#b8c8d2');
  rect(g, 20, 64, 150, 4, '#8a6038');
  rect(g, 20, 68, 150, 2, '#5a3a20');
  rect(g, 30, 40, 22, 24, '#f2c14e');
  rect(g, 30, 46, 22, 8, '#e2504a');
  rect(g, 60, 44, 16, 20, '#7ab0e8');
  rect(g, 64, 38, 8, 6, '#3b6fb6');
  for (let k = 0; k < 3; k++) rect(g, 90, 56 - k * 6, 40, 6, ['#f29cd0', '#ffffff', '#5fd068'][k]);
  rect(g, 0, 178, W, H - 178, '#9aa8b4');
  for (let x = 0; x < W; x += 40) rect(g, x, 178, 2, H - 178, '#8a98a4');
  rect(g, 0, 178, W, 2, '#c8d4dc');
  // A wicker basket with a sock hanging over its rim.
  rect(g, 398, 30, 68, 34, '#6a4a22');
  for (let yy = 32; yy < 62; yy += 4) for (let xx = 400 + ((yy / 4) % 2) * 4; xx < 464; xx += 8) rect(g, xx, yy, 4, 2, '#b98a5a');
  rect(g, 396, 26, 72, 6, '#8a6a3a');
  rect(g, 396, 26, 72, 2, '#c8a070');
  rect(g, 410, 22, 20, 6, '#f4f6f8');
  rect(g, 420, 22, 8, 16, '#e2504a');
  rect(g, 420, 34, 12, 6, '#e2504a');
}

/** A front-loading washing machine without its load: the panel (label, dial, temperature), the chrome ring and the glass of the round door. */
function machine(g, b) {
  const x = b.x;
  const y = BIN_Y;
  rect(g, x, y, BIN_W, 82, '#5a6070');
  rect(g, x + 2, y + 2, BIN_W - 4, 80, '#f4f6f8');
  rect(g, x + 2, y + 2, BIN_W - 4, 2, '#ffffff');
  rect(g, x + BIN_W - 6, y + 4, 4, 78, '#d8dce4');
  rect(g, x + 2, y + 4, BIN_W - 4, 14, '#e2e6ec');
  drawText(g, `${b.key} ${b.label}`, x + 6, y + 6, { color: '#1a1a22' });
  cblob(g, x + 88, y + 11, 4, 4, '#9aa1ad');
  rect(g, x + 87, y + 7, 2, 4, '#3a3d48');
  const cx = x + 48;
  const cy = y + 48;
  cblob(g, cx, cy, 24, 24, '#9aa1ad');
  cblob(g, cx, cy, 20, 20, '#c8ccd2');
  cblob(g, cx, cy, 16, 16, '#3a4a5a');
  cblob(g, cx, cy, 14, 14, '#5a7a98');
  rect(g, cx - 8, cy - 10, 6, 2, '#8ab0d0'); // a reflection on the glass
  rect(g, cx + 20, cy - 4, 4, 8, '#9aa1ad'); // the door's hinge
  rect(g, x + 4, y + 76, BIN_W - 8, 4, '#c8ccd2');
  drawText(g, b.temp, x + 6, y + 64, { color: '#3a3d48' });
}

/** The wash tumbling behind the glass: one more lump of the drum's colour for every piece sorted into it. */
function load(g, b, sorted, t) {
  const cx = b.x + 48;
  const cy = BIN_Y + 48;
  const fill = Math.min(10, 2 + sorted * 2);
  for (let k = 0; k < fill; k += 2) cblob(g, cx - 8 + ((k * 7 + Math.round(t * 8)) % 16), cy + 8 - (k % 4), 4, 3, b.drum);
}

/** A garment of `kind` centred on (x, y), in colour `col`, with a dark outline so white wash shows on the tiles. */
export function drawGarment(g, kind, x, y, col) {
  const draw = SHAPES[kind] || SHAPES.tshirt;
  const edge = shade(col, -0.55);
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) draw(g, x + dx, y + dy, { c: edge, d: edge, l: edge, w: edge });
  draw(g, x, y, { c: col, d: shade(col, -0.3), l: shade(col, 0.2), w: '#f4f1e8' });
}

const SHAPES = {
  // A hoodie: hood, body with a kangaroo pocket, sleeves, cuffs, drawstrings, the care label on the hem.
  hoodie(g, x, y, p) {
    rect(g, x - 16, y - 8, 32, 26, p.c);
    rect(g, x - 28, y - 6, 12, 18, p.c);
    rect(g, x + 16, y - 6, 12, 18, p.c);
    rect(g, x - 28, y + 12, 12, 4, p.d);
    rect(g, x + 16, y + 12, 12, 4, p.d);
    rect(g, x - 16, y + 16, 32, 4, p.d);
    cblob(g, x, y - 12, 10, 6, p.c);
    cblob(g, x, y - 10, 6, 4, p.d);
    rect(g, x - 14, y - 8, 4, 22, p.l);
    rect(g, x - 10, y + 4, 20, 8, p.d);
    rect(g, x - 4, y - 4, 2, 8, p.w);
    rect(g, x + 2, y - 4, 2, 8, p.w);
    rect(g, x - 6, y + 16, 12, 6, '#ffffff');
  },
  // A T-shirt: short sleeves, a round neck, a hem.
  tshirt(g, x, y, p) {
    rect(g, x - 14, y - 10, 28, 30, p.c);
    rect(g, x - 26, y - 10, 12, 12, p.c);
    rect(g, x + 14, y - 10, 12, 12, p.c);
    rect(g, x - 26, y - 2, 12, 4, p.d);
    rect(g, x + 14, y - 2, 12, 4, p.d);
    rect(g, x - 14, y + 16, 28, 4, p.d);
    rect(g, x - 12, y - 8, 4, 22, p.l);
    cblob(g, x, y - 10, 6, 4, p.d);
    rect(g, x - 6, y + 16, 12, 6, '#ffffff');
  },
  // A pair of socks lying side by side: leg, foot, a ribbed cuff, heel and toe.
  socks(g, x, y, p) {
    for (const dx of [-22, 2]) {
      rect(g, x + dx, y - 14, 12, 28, p.c);
      rect(g, x + dx, y + 6, 20, 10, p.c);
      rect(g, x + dx, y - 14, 12, 4, p.w);
      rect(g, x + dx + 2, y - 8, 2, 14, p.l);
      rect(g, x + dx + 12, y + 6, 8, 10, p.d);
      rect(g, x + dx, y + 12, 4, 4, p.d);
    }
  },
  // Jeans: a waistband with a button, two legs, pockets and stitching.
  jeans(g, x, y, p) {
    rect(g, x - 14, y - 18, 28, 6, p.d);
    rect(g, x - 14, y - 12, 13, 32, p.c);
    rect(g, x + 1, y - 12, 13, 32, p.c);
    rect(g, x - 1, y - 8, 2, 28, p.d);
    rect(g, x - 12, y - 10, 6, 2, p.l);
    rect(g, x + 6, y - 10, 6, 2, p.l);
    rect(g, x - 12, y + 16, 9, 4, p.d);
    rect(g, x + 3, y + 16, 9, 4, p.d);
    rect(g, x - 2, y - 17, 4, 4, '#f2c14e');
    rect(g, x - 12, y - 4, 2, 14, p.l);
  },
  // A button-up shirt: collar, long sleeves with cuffs, a placket with buttons.
  shirt(g, x, y, p) {
    rect(g, x - 13, y - 10, 26, 30, p.c);
    rect(g, x - 25, y - 8, 12, 26, p.c);
    rect(g, x + 13, y - 8, 12, 26, p.c);
    rect(g, x - 25, y + 14, 12, 4, p.d);
    rect(g, x + 13, y + 14, 12, 4, p.d);
    rect(g, x - 1, y - 8, 2, 28, p.d);
    for (let k = 0; k < 4; k++) rect(g, x - 1, y - 4 + k * 7, 2, 2, p.w);
    rect(g, x - 6, y - 14, 12, 4, p.l);
    rect(g, x - 8, y - 12, 6, 4, p.w);
    rect(g, x + 2, y - 12, 6, 4, p.w);
    rect(g, x - 11, y - 8, 4, 22, p.l);
  },
  // A folded towel: stripes at the ends, fringe, a fold line.
  towel(g, x, y, p) {
    rect(g, x - 24, y - 12, 48, 30, p.c);
    rect(g, x - 24, y - 12, 48, 4, p.l);
    rect(g, x - 24, y + 6, 48, 4, p.w);
    rect(g, x - 24, y + 12, 48, 4, p.d);
    rect(g, x - 24, y - 2, 48, 2, p.d);
    for (let k = -22; k < 22; k += 4) rect(g, x + k, y + 18, 2, 4, p.d);
  },
};
