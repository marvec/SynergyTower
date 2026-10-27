// Dinner buffet (vacation hotel): dishes appear along the buffet; touch them with your plate to eat them. All inclusive,
// nothing is off limits.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { bands, cblob, sprite, bake } from '../engine/mgart.js';

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
// The Christmas party's buffet (theme.dept 'party', scenes/party.js).
const XMAS_DISHES = [
  { name: 'Turkey', a: '#b8763a', b: '#f2d9a0' },
  { name: 'Mince pie', a: '#c89a5a', b: '#8a4a2a' },
  { name: 'Gingerbread', a: '#a0622e', b: '#f4f1e8' },
  { name: 'Pudding', a: '#5a2a1a', b: '#2f8a3a' },
  { name: 'Sprouts', a: '#5fa048', b: '#3a7a2a' },
  { name: 'Stollen', a: '#f4f1e8', b: '#d8343a' },
  { name: 'Candy cane', a: '#f4f1e8', b: '#d8343a' },
  { name: 'Roast potatoes', a: '#e2b85a', b: '#b8863a' },
];
export const dishesFor = (theme) => (theme?.dept === 'party' ? XMAS_DISHES : DISHES);

export default {
  id: 'buffet',
  name: 'All You Can Eat',
  help: 'Move your plate with the mouse or the arrow keys and touch the dishes on the buffet to eat them. Everything is included!',
  create({ rng, theme, sfx = () => {} }) {
    const dishes = dishesFor(theme);
    const roomImg = bake(W, H, (b) => scenery(b, theme?.dept === 'party'));
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
        items.push({ x, y, d: rng.pick(dishes), age: 0 });
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
        g.drawImage(roomImg, 0, 0);
        for (const o of items) drawPlatter(g, Math.round(o.x), Math.round(o.y), foodFor(o.d.name), Math.min(1, o.age * 5));
        drawPlate(g, Math.round(plate.x), Math.round(plate.y));
        header(g, theme?.title || 'Dinner buffet', `Eaten ${eaten}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Touch anything on the buffet to eat it', W / 2, 30, { align: 'center', color: '#f6e8b8', shadow: '#3a2414' });
        drawText(g, 'Chef recommends: everything', W / 2, 240, { align: 'center', color: '#f6e8b8', shadow: '#3a2414' });
        fl.render(g);
      },
    };
    return inst;
  },
};

// 2 px food sprites (string maps, '|' between rows), found by the dish's name so the order of the lists does not matter.
// The hotel's are the mockup's; the Christmas ones use the dish's own colours plus one shade.
const FOODS = {
  Lobster: { map: 'c..........c|cc........cc|.cc.rrrr.cc.|..rrrrrrrr..|.rrRrrrrRrr.|..rrrrrrrr..|...r.rr.r...|..r..rr..r..', pal: { r: '#e2504a', R: '#ffffff', c: '#c03a34' } },
  Sushi: { map: '.ww..ww..ww.|wwoowwoowwoo|wwoowwoowwoo|kkkkkkkkkkkk|kkkkkkkkkkkk', pal: { w: '#ffffff', o: '#f29c38', k: '#1f3a2a' } },
  Cake: { map: '..pp.pp.pp..|.cccccccccc.|.pppppppppp.|.cccccccccc.|.yyyyyyyyyy.|.cccccccccc.', pal: { p: '#f29cd0', c: '#8a4a2a', y: '#f6e8b8' } },
  Pineapple: { map: '....g.g.....|.....gg.....|...yyyyyy...|..yoyyoyyo..|..yyyoyyoy..|..yoyyoyyo..|...yyyyyy...', pal: { g: '#2f8a3a', y: '#f2e14e', o: '#c8a020' } },
  'Ice cream': { map: '..pp..bb....|.pppp.bbbb..|.pppp.bbbb..|wwwwwwwwwww.|.wwwwwwwww..|..wwwwwww...', pal: { p: '#f29cd0', b: '#7fc4ff', w: '#e8e4dc' } },
  Pizza: { map: 'ccccccccccc|cyyryyyyryc|.yyyyyryyc.|..yryyyyc..|...yyyrc...|....yyc....|.....c.....', pal: { c: '#c8862a', y: '#f2c14e', r: '#c74634' } },
  Salad: { map: '..g.lg.r....|.glgggrgg...|gglrgglggg..|.wwwwwwwww..|..wwwwwww...', pal: { g: '#5fd068', l: '#3a9a4a', r: '#e2504a', w: '#ffffff' } },
  Mango: { map: '...oo.oo....|..oyyoyyo...|.oyyoyyoyo..|..oyyoyyo...|...oo.oo....', pal: { o: '#f29c38', y: '#f2c14e' } },
  // The Christmas party's.
  Turkey: { map: '...tttttt...|..ttbbbbtt..|.tttttttttt.|.tttttttttt.|bb.dddddd.bb|b..dddddd..b', pal: { t: '#b8763a', b: '#f2d9a0', d: '#8a5424' } },
  'Mince pie': { map: '...cccccc...|..ccsccscc..|.cccccccccc.|cmmmmmmmmmmc|.mmmmmmmmmm.', pal: { c: '#c89a5a', m: '#8a4a2a', s: '#e8c88a' } },
  Gingerbread: { map: '...gggggg...|...gwggwg...|...gggggg...|.gggggggggg.|....gwwg....|...gggggg...|..ggg..ggg..|..dd....dd..', pal: { g: '#a0622e', w: '#f4f1e8', d: '#7a4620' } },
  Pudding: { map: '....g.gg....|.....ggg....|...wwwwww...|..wwpwwpww..|.pppwppwppp.|.pppppppppp.|..pppppppp..', pal: { p: '#5a2a1a', g: '#2f8a3a', w: '#f4f1e8' } },
  Sprouts: { map: '....bbbb....|...baaaab...|..bbalaabb..|.baabbbbaab.|baalaabaalab|baaaaabaaaab|.bbbb.bbbb..', pal: { a: '#5fa048', b: '#3a7a2a', l: '#8ac870' } },
  Stollen: { map: '..wwwwwwww..|.wwwrwwwwww.|wwwwwwwrwwww|.dddddddddd.|..dddddddd..', pal: { w: '#f4f1e8', r: '#d8343a', d: '#d8b078' } },
  'Candy cane': { map: '..rwrw....|.wr..wr...|.rw...rw..|......wr..|......rw..|......wr..|......rw..|......wr..', pal: { r: '#d8343a', w: '#f4f1e8' } },
  'Roast potatoes': { map: '....bbbb....|.bb.pppp.bb.|bppbpphpbppb|bpppbpppbppb|.bbbbbbbbbb.', pal: { p: '#e2b85a', b: '#b8863a', h: '#f2d890' } },
};
export const foodFor = (name) => FOODS[name];

function scenery(g, party) {
  // The hotel restaurant: panelled wall with lanterns, wooden floor.
  bands(g, 0, 18, W, 40, ['#8a5a36', '#7a4e2e']);
  for (let x = 0; x < W; x += 40) rect(g, x, 18, 2, 40, '#6a4226');
  rect(g, 0, 56, W, 4, '#c8a060');
  rect(g, 0, 60, W, H - 60, '#6e4529');
  for (let y = 60; y < H; y += 14) rect(g, 0, y, W, 2, '#5e3a22');
  for (const x of [60, 420]) {
    rect(g, x - 1, 18, 2, 8, '#3a2a1a');
    rect(g, x - 6, 26, 12, 14, '#f2c14e');
    rect(g, x - 6, 26, 12, 2, '#c8862a');
    rect(g, x - 6, 38, 12, 2, '#c8862a');
  }
  // The buffet: a long table with a cloth and a runner (teal at the hotel, red at the party).
  const mid = AREA.y + AREA.h / 2;
  rect(g, AREA.x - 12, AREA.y - 12, AREA.w + 24, AREA.h + 24, '#d8d0c0');
  rect(g, AREA.x - 12, AREA.y - 12, AREA.w + 24, AREA.h + 20, '#f4f1e8');
  for (let x = AREA.x; x < AREA.x + AREA.w; x += 50) rect(g, x, AREA.y - 12, 2, AREA.h + 20, '#e8e2d4');
  rect(g, AREA.x - 12, mid - 6, AREA.w + 24, 12, party ? '#d8343a' : '#5fd0c8');
  rect(g, AREA.x - 12, mid + 4, AREA.w + 24, 2, party ? '#a02028' : '#3ab0a8');
  // A centrepiece: flowers at the hotel, a holly wreath at the party.
  cblob(g, 240, mid, 10, 8, party ? '#2f8a3a' : '#e86ab0');
  cblob(g, 236, mid - 2, 4, 4, party ? '#d8343a' : '#ffe070');
}

// A silver platter with the dish's food on it; `pop` (0..1) lifts the food in as the dish appears.
function drawPlatter(g, x, y, food, pop) {
  cblob(g, x, y + 4, 22, 10, '#8a8e98');
  cblob(g, x, y + 2, 20, 9, '#c8ccd4');
  cblob(g, x - 4, y, 10, 4, '#e8ecf0');
  if (pop < 0.4 || !food) return;
  const w = food.map.split('|')[0].length;
  sprite(g, food.map, food.pal, x - w, y - 10 + Math.round(((1 - pop) * 8) / 2) * 2, 2);
}

// Your plate (blue rim) with a fork.
function drawPlate(g, x, y) {
  cblob(g, x + 2, y + 2, 18, 14, 'rgba(0,0,0,0.25)');
  cblob(g, x, y, 18, 14, '#3b6fb6');
  cblob(g, x, y, 16, 12, '#ffffff');
  cblob(g, x, y, 10, 8, '#ece8e0');
  rect(g, x + 22, y - 4, 2, 18, '#c8ccd4');
  for (const k of [0, 2, 4]) rect(g, x + 20 + k, y - 12, 1, 8, '#c8ccd4');
  rect(g, x + 20, y - 5, 6, 2, '#c8ccd4');
}
