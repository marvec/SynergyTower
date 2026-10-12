// Sleep in (vacation hotel): count the sheep as they jump over the fence. Super easy: a wide window while each sheep is
// in the air; pressing with no sheep in the air wakes you up a little.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

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
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(SHEEP * GAP + 5);
    const fl = new Floaters();
    const stars = Array.from({ length: 40 }, () => ({ x: rng.int(0, W), y: rng.int(20, 150), p: rng.float(0, 6) }));
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
        rect(g, 0, 0, W, H, '#141a3a');
        for (const s of stars) if (Math.sin(t * 2 + s.p) > -0.6) rect(g, s.x, s.y, 1, 1, '#e8eaff');
        // A crescent moon.
        rect(g, 382, 38, 18, 26, '#f6e8b8');
        rect(g, 378, 42, 26, 18, '#f6e8b8');
        rect(g, 389, 36, 16, 24, '#141a3a');
        rect(g, 386, 40, 22, 16, '#141a3a');
        rect(g, 0, GROUND, W, H - GROUND, '#2f6b3a');
        rect(g, 0, GROUND, W, 2, '#3f8a4a');
        // The fence.
        for (const dx of [-14, 0, 14]) rect(g, FENCE_X + dx - 2, GROUND - 26, 4, 26, '#8a6a3a');
        rect(g, FENCE_X - 22, GROUND - 22, 44, 3, '#a8864c');
        rect(g, FENCE_X - 22, GROUND - 12, 44, 3, '#a8864c');
        for (const s of flock) {
          const k = clamp(1 - Math.abs(s.x - FENCE_X) / JUMP, 0, 1);
          const y = GROUND - 14 - Math.round(Math.sin(k * Math.PI / 2) * 42);
          drawSheep(g, s.x, y, t, s.counted);
        }
        // You, in bed, in the corner: the more sheep, the sleepier.
        rect(g, 12, 236, 90, 26, '#8a5a3a');
        rect(g, 14, 232, 86, 10, '#f4f1e8');
        rect(g, 36, 236, 64, 22, '#2fa39a');
        rect(g, 18, 228, 14, 10, '#f2c9a0');
        rect(g, 18, 228, 14, 3, '#5a3a22');
        const zz = Math.min(3, Math.floor(counted / 3));
        for (let i = 0; i < zz; i++) drawText(g, 'z', 36 + i * 8, 218 - i * 8 - Math.round(Math.sin(t * 2 + i) * 2), { color: '#c8d0ff' });
        header(g, theme?.title || 'Sleep in', `Sheep ${counted}/${SHEEP}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Count each sheep while it is in the air', W / 2, 24, { align: 'center', color: '#c8d0ff' });
        fl.render(g);
      },
    };
    return inst;
  },
};

function drawSheep(g, x, y, t, counted) {
  const leg = Math.floor(t * 8) % 2;
  rect(g, x - 9, y + 10, 2, 5 - leg, '#1a1a22');
  rect(g, x + 5, y + 10, 2, 4 + leg, '#1a1a22');
  rect(g, x - 12, y, 22, 12, '#1a1a22');
  rect(g, x - 11, y + 1, 20, 10, counted ? '#fff6c8' : '#f4f1e8');
  rect(g, x - 9, y - 2, 6, 4, '#f4f1e8');
  rect(g, x - 1, y - 2, 6, 4, '#f4f1e8');
  rect(g, x + 8, y + 1, 7, 7, '#1a1a22');
  rect(g, x + 12, y + 3, 1, 1, '#ffffff');
}
