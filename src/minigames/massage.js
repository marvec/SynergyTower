// Massage (vacation hotel): knots show up on your back, red and tense. Tap each one to let it go; they wait patiently.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { cblob, cells, sprite, shade, bake } from '../engine/mgart.js';
import { DEFAULT_PLAYER } from '../engine/figure.js';

const GOAL = 12;
// The guest's back on the zoomed table (below the head, above the towel).
const BACK = { x: 196, y: 124, w: 88, h: 104 };
const SPEED = 200;
const REACH = 22;
const SPAWN_GAP = 24; // a new knot spawns at least this far from the hands (just outside REACH)

export default {
  id: 'massage',
  name: 'Deep Tissue',
  help: 'Click the knots on the back, or move the hands with the arrow keys and press SPACE. Let them all go.',
  create({ rng, theme, sfx = () => {}, player }) {
    const me = player || DEFAULT_PLAYER;
    const scene = bake(W, H, drawScene);
    const towelImg = bake(20 * S, H - Y(33), drawTowel);
    const handImg = [false, true].map((flip) => bake(HAND_W * HS + 6, HAND_H * HS + 6, (c) => drawHand(c, flip)));
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
          const k = { x: rng.int(BACK.x + 12, BACK.x + BACK.w - 12), y: rng.int(BACK.y + 12, BACK.y + BACK.h - 12), age: 0 };
          if (Math.hypot(k.x - hand.x, k.y - hand.y) > SPAWN_GAP) knots.push(k);
          else spawnT = 0; // too close to the hands: try another spot next frame instead of waiting
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
        g.drawImage(scene, 0, 0);
        guest(g, me);
        g.drawImage(towelImg, CX - 10 * S, Y(33));
        for (const k of knots) knot(g, k.x, k.y, k.age);
        // The masseur's hands, squeezed by 2 px on a press.
        const sq = press > 0 ? 2 : 0;
        g.drawImage(handImg[1], hand.x - 36 - sq - 3, hand.y - 18 + sq - 3);
        g.drawImage(handImg[0], hand.x + 3 - sq - 3, hand.y - 18 + sq - 3);
        // The candle flames flicker.
        for (const [x, y, ph] of CANDLES) rect(g, x - 2, y - 2 - (Math.floor((t + ph) * 6) % 2) * 2, 4, 4, '#ffb030');
        header(g, theme?.title || 'Massage', `Knots ${released}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Find the knots and let them go', W / 2, 256, { align: 'center', color: '#3a2414' });
        fl.render(g);
      },
    };
    return inst;
  },
};

// The look: you lie face down on a 6 px grid, zoomed in so the back fills the screen down to the towel at row 33.
const S = 6;
const CX = 240;
const OY = 38;
const Y = (row) => OY + row * S;
const CANDLES = [[62, 122, 0], [432, 146, 1]]; // x, y, flicker phase

function drawScene(g) {
  // Plank floor.
  rect(g, 0, 18, W, H - 18, '#9a6a44');
  for (let y = 18, i = 0; y < H; y += 12, i++) {
    rect(g, 0, y, W, 11, i % 2 ? '#a87650' : '#a2704a');
    rect(g, 0, y + 11, W, 1, '#7a5236');
    for (let x = (i * 37) % 70; x < W; x += 70 + ((i * 13) % 30)) rect(g, x, y, 1, 11, '#7a5236');
  }
  // The massage table.
  rect(g, 156, 20, 168, H - 20, '#8a7a64');
  rect(g, 158, 22, 164, H - 22, '#efe4cc');
  rect(g, 158, 22, 164, 2, '#fbf4e4');
  rect(g, 162, 26, 2, H - 26, '#e0d4ba');
  rect(g, 316, 26, 2, H - 26, '#e0d4ba');
  // Props: towels, hot stones with a candle, a bowl, an orchid, the oil, a candle, a teal towel stack.
  towels(g, 28, 36, '#f6f3ea');
  stones(g, 60, 134);
  candle(g, 62, 122);
  bowl(g, 64, 214);
  orchid(g, 420, 64);
  cblob(g, 404, 150, 8, 8, '#c8782a', 2);
  cblob(g, 404, 150, 3, 3, '#6a4a30', 2);
  candle(g, 432, 146);
  towels(g, 400, 204, '#2fa39a');
}

// You from above, 6 px cells: head 12 cells wide, torso 16, arms 2 with a gap (the table shows) below the shoulder.
// The view is cropped at the waist by the towel. Short hair, or long hair in a bun.
function guest(g, me) {
  const SKIN = me.skin;
  const SKIN_D = shade(SKIN, -0.15);
  const HAIR = me.hair;
  const r = cells(g, CX - 11 * S, OY, S); // cell 0 = 11 cells left of the centre line
  for (const [ax, gap] of [[0, 2], [20, 19]]) {
    r(ax, 14, 2, 22, SKIN);
    r(ax, 24, 2, 1, SKIN_D); // elbow
    r(gap, 14, 1, 2, SKIN); // the shoulder joins the arm
  }
  r(4, 13, 14, 1, SKIN);
  r(3, 14, 16, 12, SKIN);
  r(4, 26, 14, 10, SKIN);
  r(18, 15, 1, 11, SKIN_D); // the far side in shadow
  // Spine and shoulder blades: thin lines in the darker skin.
  rect(g, CX - 1, Y(15), 2, 20 * S, SKIN_D);
  for (const s of [-1, 1]) {
    rect(g, CX + s * Math.round(4.5 * S) - (s < 0 ? 2 : 0), Y(16), 2, 4 * S, SKIN_D);
    rect(g, CX + s * Math.round(3.5 * S) - (s < 0 ? S : 0), Y(20), S, 2, SKIN_D);
  }
  // Neck and the back of the head.
  r(9, 12, 4, 1, SKIN_D);
  r(5, 0, 12, 11, HAIR);
  r(4, 4, 1, 3, SKIN);
  r(17, 4, 1, 3, SKIN);
  r(7, 11, 8, 1, SKIN);
  rect(g, CX - Math.round(3.5 * S), OY + S, 7 * S, 2, shade(HAIR, 0.2));
  if (me.long) {
    r(8, -3, 6, 3, HAIR);
    r(9, 0, 4, 1, '#c84a6a');
    r(5, 11, 2, 3, HAIR);
    r(15, 11, 2, 3, HAIR);
  }
}

function drawTowel(g) {
  const w = 20 * S;
  const h = H - Y(33);
  rect(g, 0, 0, w, h, '#d8d0c0');
  rect(g, 2, 0, w - 4, h, '#f6f3ea');
  rect(g, 2, 0, w - 4, 4, '#ffffff');
  rect(g, 2, 10, w - 4, 4, '#2fa39a');
}

// A knot: a chunky red patch that pulses.
function knot(g, x, y, age) {
  const p = Math.floor(age * 4) % 2;
  cblob(g, x, y, 8 + p * 2, 6 + p * 2, '#f0a090', 2);
  cblob(g, x, y, 6, 4, '#e2504a', 2);
  rect(g, x - 2, y - 2, 2, 2, '#ff9a8a');
}

// The masseur's hands, 3 px cells with an outline, tunic cuffs. Baked once per side.
const HAND = ['....nn.....', '..nnSsnn...', '..SsSsSsnn.', '..SsSsSsSs.', '..SsSsSsSs.', '..SSSSSSSs.', 'nSSSSSSSSs.', 'SSsSSSSSSs.', '.SSSSSSSSs.', '..SSSSSSss.', '..cccccccc.', '..CCCCCCCC.'].join('|');
const HS = 3;
const HAND_W = 11;
const HAND_H = 12;
function drawHand(g, flip) {
  const pal = { S: '#c98a5e', s: '#a86e46', n: '#e8b494', c: '#f6f6f2', C: '#c8ccd0' };
  const out = Object.fromEntries(Object.keys(pal).map((k) => [k, '#3a2418']));
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sprite(g, HAND, out, 3 + ox * HS, 3 + oy * HS, HS, flip);
  sprite(g, HAND, pal, 3, 3, HS, flip);
}

// Props from above, flat with 2 px cells (the candle flames are drawn live).
function candle(g, x, y) {
  g.save();
  g.globalAlpha = 0.25;
  cblob(g, x, y, 16, 16, '#ffc060', 2);
  g.restore();
  cblob(g, x, y, 7, 7, '#c8bca0', 2);
  cblob(g, x, y, 5, 5, '#f4ecd8', 2);
}
function stones(g, x, y) {
  cblob(g, x, y, 16, 10, '#5a5a62', 2);
  cblob(g, x + 2, y - 4, 10, 6, '#7a7a82', 2);
  cblob(g, x + 3, y - 7, 6, 4, '#9a9aa2', 2);
}
function towels(g, x, y, col) {
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 14;
    rect(g, x, yy, 54, 12, shade(col, -0.25));
    rect(g, x + 2, yy + 2, 50, 8, col);
    cblob(g, x + 46, yy + 6, 6, 6, shade(col, -0.25), 2);
    cblob(g, x + 46, yy + 6, 2, 2, shade(col, 0.15), 2);
  }
}
function orchid(g, x, y) {
  cblob(g, x, y, 14, 14, '#b0603a', 2);
  cblob(g, x, y, 10, 10, '#5a3a22', 2);
  for (const [dx, dy, rx, ry] of [[-12, 4, 10, 4], [12, -2, 10, 4], [-2, -12, 4, 10]]) cblob(g, x + dx, y + dy, rx, ry, '#3f9a4a', 2);
  for (const [dx, dy] of [[-8, -16], [6, -20], [16, -10]]) {
    cblob(g, x + dx, y + dy, 5, 5, '#e86ab0', 2);
    rect(g, x + dx - 1, y + dy - 1, 2, 2, '#ffe070');
  }
}
function bowl(g, x, y) {
  cblob(g, x, y, 22, 16, '#d8d0c0', 2);
  cblob(g, x, y, 18, 12, '#5ab0c8', 2);
  for (const [dx, dy] of [[-6, -2], [6, 4]]) cblob(g, x + dx, y + dy, 4, 4, '#f2a0c0', 2);
}
