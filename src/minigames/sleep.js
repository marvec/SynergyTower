// Sleep in (vacation hotel): count the sheep as they jump over the fence. Super easy: a wide window while each sheep is
// in the air; pressing with no sheep in the air wakes you up a little.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { bands, cblob, cells, bake } from '../engine/mgart.js';
import { DEFAULT_PLAYER } from '../engine/figure.js';

const SHEEP = 10;
const GAP = 2.4; // seconds between sheep
const SPEED = 110; // px/s
const FENCE_X = W / 2;
const JUMP = 70; // px either side of the fence where the sheep is in the air
const GROUND = 214;

export default {
  id: 'sleep',
  name: 'Counting Sheep',
  help: 'Press SPACE or click while each sheep jumps over the fence to count it. Count them all and drift off...',
  create({ rng, theme, sfx = () => {}, player }) {
    const total = new Countdown(SHEEP * GAP + 5);
    const fl = new Floaters();
    const look = player || DEFAULT_PLAYER;
    const scene = bake(W, H, scenery);
    const flock = [];
    let spawned = 0;
    let spawnT = 0.6;
    let counted = 0;
    let wakes = 0;
    let t = 0;

    const airborne = () => flock.find((s) => !s.counted && Math.abs(s.x - FENCE_X) < JUMP);
    const score = () => clamp((counted - wakes * 0.5) / SHEEP, 0, 1);

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ airborne: !!airborne() }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        spawnT -= dt;
        if (spawnT <= 0 && spawned < SHEEP) {
          spawnT = GAP;
          spawned++;
          flock.push({ x: -20, counted: false, seed: rng.int(0, 3) });
        }
        for (const s of flock) s.x += SPEED * dt;
        while (flock.length && flock[0].x > W + 30) flock.shift();
        if (input.confirm() || input.pointer.clicked) {
          const s = airborne();
          if (s) {
            s.counted = true;
            counted++;
            sfx('blip');
            fl.add(String(counted), s.x, GROUND - 70, C.gold);
          } else {
            wakes++;
            sfx('click');
            fl.add('Hm?', FENCE_X, GROUND - 90, C.dim);
          }
        }
        if (spawned === SHEEP && !flock.length) finish(inst, score());
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        STARS.forEach(([x, y], i) => rect(g, x, y, 2, 2, Math.sin(t * 2 + i) > -0.4 ? '#e8eaff' : '#8a96c0'));
        for (const s of flock) {
          const k = clamp(1 - Math.abs(s.x - FENCE_X) / JUMP, 0, 1);
          const y = GROUND - 14 - Math.round(Math.sin(k * Math.PI / 2) * 42);
          drawSheep(g, Math.round(s.x), y, t, s.counted);
        }
        // You, in bed, in the corner: the more sheep, the sleepier.
        drawSleeper(g, look);
        const zz = Math.min(3, Math.floor(counted / 3));
        for (let i = 0; i < zz; i++) drawText(g, 'z', 46 + i * 9, 206 - i * 9 - Math.round(Math.sin(t * 2 + i) * 2), { color: '#c8d0ff', scale: i === 2 ? 2 : 1 });
        header(g, theme?.title || 'Sleep in', `Sheep ${counted}/${SHEEP}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Count each sheep while it is in the air', W / 2, 24, { align: 'center', color: '#c8d0ff' });
        fl.render(g);
      },
    };
    return inst;
  },
};

const STARS = [[30, 40], [80, 70], [120, 44], [170, 96], [210, 50], [300, 84], [350, 110], [440, 40], [460, 90], [20, 120], [150, 130], [420, 130], [330, 52]];

// The sky, hills, meadow, fence and bed: everything that never moves (the stars twinkle, so they are drawn per frame).
function scenery(g) {
  bands(g, 0, 18, W, GROUND - 18, ['#0e1430', '#141a3a', '#1a2248', '#222c56']);
  // A crescent moon.
  cblob(g, 392, 50, 14, 14, '#f6e8b8');
  cblob(g, 400, 46, 12, 12, '#141a3a');
  // Hills, then the meadow.
  cblob(g, 90, GROUND, 120, 30, '#1e3a32');
  cblob(g, 380, GROUND, 150, 40, '#1a3430');
  rect(g, 0, GROUND, W, H - GROUND, '#2f6b3a');
  rect(g, 0, GROUND, W, 2, '#3f8a4a');
  for (let x = 4; x < W; x += 22) {
    rect(g, x, GROUND + 6 + (x % 3) * 8, 2, 4, '#3f8a4a');
    rect(g, x + 2, GROUND + 4 + (x % 3) * 8, 2, 2, '#3f8a4a');
  }
  // The fence.
  for (const dx of [-24, 0, 24]) {
    rect(g, FENCE_X + dx - 3, GROUND - 30, 6, 30, '#8a6a3a');
    rect(g, FENCE_X + dx - 1, GROUND - 32, 2, 2, '#8a6a3a');
    rect(g, FENCE_X + dx - 3, GROUND - 30, 2, 30, '#a8864c');
  }
  for (const y of [GROUND - 24, GROUND - 12]) {
    rect(g, FENCE_X - 34, y, 68, 4, '#a8864c');
    rect(g, FENCE_X - 34, y + 2, 68, 2, '#7a5a30');
  }
  // The bed: headboard, frame, pillow, blanket.
  const r = cells(g, 10, 214, 2);
  r(0, 0, 4, 22, '#6a4226');
  r(0, 0, 4, 1, '#8a5a3a');
  r(4, 12, 44, 8, '#8a5a3a');
  r(4, 8, 12, 5, '#f4f1e8');
  r(14, 7, 34, 6, '#2fa39a');
  for (let k = 16; k < 48; k += 6) r(k, 7, 2, 6, '#5fd0c8');
}

// Your head on the pillow, eyes shut; with long hair it lies along the pillow.
function drawSleeper(g, look) {
  const r = cells(g, 10, 214, 2);
  r(6, 2, 8, 7, look.skin);
  r(6, 1, 8, 2, look.hair);
  if (look.long) {
    r(4, 3, 2, 8, look.hair);
    r(14, 3, 2, 6, look.hair);
  }
  r(8, 5, 2, 1, '#3a2a1a');
  r(11, 5, 2, 1, '#3a2a1a');
}

// A woolly 2 px sheep: shadowed body, tufts, black face, one eye.
function drawSheep(g, x, y, t, counted) {
  const wool = counted ? '#fff3b8' : '#f4f1e8';
  const shadow = counted ? '#e8d890' : '#c8c4bc';
  const leg = Math.floor(t * 8 + x) % 2 ? 2 : 0;
  for (const lx of [-8, -2, 4, 8]) rect(g, x + lx, y + 8, 2, 6 - (lx % 4 ? leg : 2 - leg), '#1a1a22');
  cblob(g, x, y + 4, 14, 8, shadow);
  for (const [dx, dy] of [[-8, 0], [-2, -2], [4, 0], [-4, 4], [4, 4]]) cblob(g, x + dx, y + dy, 6, 6, wool);
  rect(g, x + 10, y - 2, 8, 8, '#1a1a22');
  rect(g, x + 8, y - 4, 4, 2, '#1a1a22');
  rect(g, x + 14, y, 2, 2, '#ffffff');
}
