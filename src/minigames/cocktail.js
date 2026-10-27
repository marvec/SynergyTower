// Pool bar cocktail (vacation hotel): the barman tosses fruit, you catch it in the glass. Everything goes in, nothing
// is bad for you here.
import { W, H, C, rect, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { bands, cblob, sprite, bake } from '../engine/mgart.js';

const GOAL = 10;
const FLOOR_Y = 228;
const SPEED = 240;
const HALF = 26; // half the glass's catch width
const FRUIT = [
  { a: '#f2e14e', b: '#2f8a3a', k: 'pineapple' },
  { a: '#f29c38', b: '#5fd068', k: 'orange' },
  { a: '#e2504a', b: '#5fd068', k: 'cherry' },
  { a: '#8a5a3a', b: '#f4f1e8', k: 'coconut' },
  { a: '#5fd068', b: '#2f8a3a', k: 'lime' },
];
// 7 px wide 2 px cells, recognisable at a glance.
const SPRITES = {
  pineapple: { map: '..g.g..|...g...|.yyyyy.|yoyyoyy|yyoyyoy|yoyyoyy|.yyyyy.', pal: { g: '#2f8a3a', y: '#f2e14e', o: '#c8a020' } },
  orange: { map: '...g...|.ooooo.|ooOoooo|oOooooo|ooooooo|ooooooo|.ooooo.', pal: { g: '#5fd068', o: '#f29c38', O: '#ffc070' } },
  cherry: { map: '....g..|...gg..|..g..g.|.g....g|rr...rr|rRr..rRr|rrr..rrr', pal: { g: '#3a8a3a', r: '#c8302a', R: '#ff8080' } },
  coconut: { map: '.bbbbb.|bwwwwwb|bwwwwwb|bwwwwwb|bbbbbbb|.bbbbb.', pal: { b: '#6a4228', w: '#f4f1e8' } },
  lime: { map: '.lllll.|lgggggl|lgwgwgl|lggwggl|lgwgwgl|lgggggl|.lllll.', pal: { l: '#3a9a3a', g: '#8ade6a', w: '#e8ffd8' } },
};
const CREAM = '#f6e8b8';

export default {
  id: 'cocktail',
  name: 'Pina Colada',
  help: 'Move the glass with the arrow keys or the mouse and catch the falling fruit. The more fruit, the better the cocktail!',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    const scene = bake(W, H, scenery); // the sunset, palms, thatch and bar
    const fruitArt = Object.fromEntries(Object.entries(SPRITES).map(([k, f]) => [k, bake(18, 18, (b) => fruitSprite(b, f))]));
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
        g.drawImage(scene, 0, 0);
        for (const f of fruit) g.drawImage(fruitArt[f.f.k], Math.round(f.x) - 9, Math.round(f.y) - 9);
        hurricane(g, Math.round(glass.x), Math.min(1, caught / GOAL));
        header(g, theme?.title || 'Pool bar', `Fruit ${caught}/${GOAL}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// A fruit with a dark outline (the sprite stamped around itself), centred in an 18 px square.
function fruitSprite(g, f) {
  const dark = Object.fromEntries(Object.keys(f.pal).map((k) => [k, '#1a1a22']));
  for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) sprite(g, f.map, dark, 2 + ox, 2 + oy, 2);
  sprite(g, f.map, f.pal, 2, 2, 2);
}

function palmSilhouette(g, x, flip) {
  const c = '#3a2440';
  for (let k = 0; k < 160; k += 4) rect(g, Math.round(x + (flip ? -1 : 1) * (k * k) / 1600), FLOOR_Y - k - 4, 6, 4, c);
  const top = FLOOR_Y - 164;
  const cx = Math.round(x + (flip ? -16 : 16));
  for (const [dx, dy, w] of [[-30, 6, 28], [4, 6, 28], [-22, 0, 18], [6, 0, 18], [-8, -4, 18], [-36, 12, 10], [30, 12, 10]]) rect(g, cx + dx, top + dy, w, 4, c);
}

// The sunset in flat bands with its reflection, palm silhouettes, a thatched roof with a fringe, a bamboo bar counter.
function scenery(g) {
  bands(g, 0, 18, W, 132, ['#c84a78', '#e85d75', '#f07a68', '#f29c38', '#f2b448', '#f2c14e']);
  cblob(g, 330, 132, 30, 30, '#fff6c8');
  bands(g, 0, 150, W, FLOOR_Y - 150, ['#2a86c7', '#2478b8', '#206aa8']);
  for (let i = 0; i < 10; i++) rect(g, 300 + ((i * 13) % 40) - i, 154 + i * 7, 60 - i * 4, 2, '#f6c87a');
  palmSilhouette(g, 40, false);
  palmSilhouette(g, 438, true);
  rect(g, 0, 14, W, 18, '#c9a14a');
  for (let x = 0; x < W; x += 8) rect(g, x, 18 + (x % 16 ? 4 : 8), 4, 2, '#a8862f');
  for (let x = 0; x < W; x += 4) rect(g, x, 32, 2, 4 + ((x * 7) % 10), '#a8862f');
  rect(g, 0, FLOOR_Y, W, 8, '#b98a5a');
  rect(g, 0, FLOOR_Y, W, 2, '#d8a870');
  rect(g, 0, FLOOR_Y + 8, W, H - FLOOR_Y - 8, '#ffffff'); // the white gaps between the bamboo
  for (let x = 0; x < W; x += 12) {
    rect(g, x, FLOOR_Y + 8, 10, H - FLOOR_Y - 8, '#c8a050');
    rect(g, x, FLOOR_Y + 8, 2, H - FLOOR_Y - 8, '#e0c070');
    rect(g, x, FLOOR_Y + 20, 10, 2, '#8a6a30');
    rect(g, x, FLOOR_Y + 34, 10, 2, '#8a6a30');
  }
}

// The hurricane glass standing on the bar at x: wide bowl, a waist, a foot; the pina colada rises with the fruit caught
// (fill 0..1), a pineapple wedge on the rim, a straw and a paper umbrella.
const ROWS = [16, 16, 15, 14, 12, 10, 8, 6, 6, 7, 9, 10, 10, 9, 7, 5, 3, 3, 3, 3];
const LIQUID = [1, 15]; // the rows the drink can fill
function hurricane(g, x, fill) {
  const top = FLOOR_Y - 40;
  const body = '#e8f8ff';
  ROWS.forEach((hw, i) => rect(g, x - hw - 2, top + i * 2, (hw + 2) * 2, 2, '#1a1a22'));
  const level = LIQUID[1] - Math.round((LIQUID[1] - LIQUID[0] + 1) * fill) + 1; // the first row with drink in it
  ROWS.forEach((hw, i) => {
    const full = i >= level && i <= LIQUID[1];
    rect(g, x - hw, top + i * 2, hw * 2, 2, full ? CREAM : body);
    if (full) rect(g, x - hw, top + i * 2, 2, 2, '#fffbe8');
  });
  rect(g, x - 10, FLOOR_Y - 2, 20, 2, '#1a1a22');
  rect(g, x - 8, FLOOR_Y - 4, 16, 2, body);
  rect(g, x - 18, top - 2, 6, 6, '#f2e14e');
  rect(g, x - 18, top - 2, 6, 2, '#2f8a3a');
  rect(g, x + 6, top - 20, 2, 26, '#e2504a');
  rect(g, x + 8, top - 20, 6, 2, '#e2504a');
  for (let k = 0; k < 6; k++) rect(g, x - 8 + k * 2, top - 20 + k * 2, 16 - k * 4 > 0 ? 18 - k * 4 : 2, 2, k % 2 ? '#e85d75' : '#ffb0c0');
  rect(g, x - 1, top - 14, 2, 14, '#8a5a3a');
}
