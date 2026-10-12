// Sandcastle (vacation hotel): the bucket swings slowly over the castle; drop it when it is over the top to add a layer.
// Generous: anywhere over most of the top holds. A miss just slides off; tip the bucket again.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';

const LAYERS = 6;
const SWING = 64; // px either side of the castle
const PERIOD = 3.2; // seconds per full swing
const HOLD = 30; // drops within this offset stick
const BASE_Y = 226;
const LAYER_H = 16;
const FALL = 0.35;

export default {
  id: 'sandcastle',
  name: 'Sandcastle',
  help: 'Press SPACE or click to tip the bucket when it swings over the castle. Six layers make a castle!',
  create({ theme, sfx = () => {} }) {
    const total = new Countdown(40);
    const fl = new Floaters();
    const cx = W / 2;
    let built = 0;
    let phase = 0;
    let drop = null; // { x, t } a layer falling
    let t = 0;

    const offset = () => Math.sin((phase * 2 * Math.PI) / PERIOD) * SWING;
    const width = (i) => 96 - i * 10;
    const topY = () => BASE_Y - built * LAYER_H;

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ offset: offset(), falling: !!drop }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, built / LAYERS);
        if (drop) {
          drop.t += dt;
          if (drop.t >= FALL) {
            if (Math.abs(drop.x) <= HOLD) {
              built++;
              sfx('good');
              fl.add(built === LAYERS ? 'A castle!' : 'Packed!', cx, topY() - 20, C.gold);
              if (built >= LAYERS) return finish(inst, 1);
            } else {
              sfx('bad');
              fl.add('It slid off', cx + drop.x, topY() - 10, C.dim);
            }
            drop = null;
          }
          return;
        }
        phase += dt;
        if (input.confirm() || input.pointer.clicked) {
          drop = { x: offset(), t: 0 };
          sfx('click');
        }
      },
      render(g) {
        rect(g, 0, 0, W, H, '#8fd0f0');
        rect(g, 0, 70, W, 40, '#2a86c7');
        rect(g, 0, 108, W, 4, '#e8f8ff');
        rect(g, 0, 112, W, H - 112, '#ecd9a0');
        for (let i = 0; i < 50; i++) rect(g, (i * 89) % W, 120 + ((i * 37) % 140), 1, 1, '#d9c283');
        // The mound the castle stands on, a spade stuck in it.
        rect(g, cx - 70, BASE_Y, 140, 8, '#d9b56a');
        rect(g, cx - 60, BASE_Y - 3, 120, 4, '#e6c47a');
        rect(g, cx + 80, BASE_Y - 26, 2, 22, '#8a5a3a');
        rect(g, cx + 77, BASE_Y - 8, 8, 9, '#e2504a');
        // The castle so far.
        for (let i = 0; i < built; i++) {
          const w = width(i);
          const y = BASE_Y - (i + 1) * LAYER_H;
          rect(g, cx - w / 2, y, w, LAYER_H, i % 2 ? '#d9b56a' : '#e6c47a');
          rect(g, cx - w / 2, y, w, 2, '#f2dc9a');
          for (let x = cx - w / 2 + 3; x < cx + w / 2 - 4; x += 8) rect(g, x, y - 3, 4, 3, '#e6c47a');
        }
        if (built >= LAYERS) {
          rect(g, cx, topY() - 26, 1, 22, '#6b4a22');
          rect(g, cx + 1, topY() - 26, 12, 7, '#e2504a');
        }
        // The falling layer, then the bucket on its swing.
        if (drop) {
          const k = Math.min(1, drop.t / FALL);
          const y = 60 + (topY() - LAYER_H - 60) * k;
          const w = width(built);
          rect(g, cx + drop.x - w / 2, y, w, LAYER_H, '#e6c47a');
        }
        const bx = cx + (drop ? drop.x : offset());
        const tip = drop ? Math.min(1, drop.t * 6) : 0;
        rect(g, bx - 1, 26, 2, 22, '#1a1a22');
        rect(g, bx - 16, 46 + tip * 4, 32, 20 - tip * 6, '#1a1a22');
        rect(g, bx - 15, 47 + tip * 4, 30, 18 - tip * 6, '#3b6fb6');
        rect(g, bx - 15, 47 + tip * 4, 30, 3, '#7fb4ea');
        // Where the next layer goes: little flags either side of the top of the castle.
        if (built < LAYERS)
          for (const sx of [-1, 1]) {
            const fx = cx + sx * (width(built) / 2 + 6);
            rect(g, fx, topY() - 18, 1, 16, '#6b4a22');
            rect(g, fx + (sx > 0 ? 1 : -5), topY() - 18, 5, 4, '#f2c14e');
          }
        rect(g, bx - 12, 44, 24, 2, '#1a1a22');
        header(g, theme?.title || 'Sandcastle', `Layers ${built}/${LAYERS}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Tip the bucket over the castle', W / 2, 250, { align: 'center', color: '#5a3a22' });
        fl.render(g);
      },
    };
    return inst;
  },
};
