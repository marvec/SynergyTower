// Swim to the buoy (vacation hotel): tap for each stroke to swim out to the buoy and back to the jetty. Gentle waves,
// no rush: strokes come as fast as the arms do.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { bands, cblob, cells, bake } from '../engine/mgart.js';
import { palm } from '../engine/mgscenery.js';
import { DEFAULT_PLAYER } from '../engine/figure.js';

const STROKES = 10; // strokes per leg
const STROKE_S = 0.35; // an arm needs this long before the next stroke
const NEAR = 60;
const FAR = W - 70;
const SEA_Y = 120;

export default {
  id: 'swim',
  name: 'Swim to the Buoy',
  help: 'Press SPACE, an arrow key or click for each stroke. Swim out to the buoy, touch it and swim back to the jetty.',
  create({ theme, sfx = () => {}, player }) {
    const total = new Countdown(30);
    const fl = new Floaters();
    const look = player || DEFAULT_PLAYER;
    const scene = bake(W, H, scenery); // the far beach, the sea and the jetty
    let progress = 0; // 0..STROKES out, then STROKES..2*STROKES back
    let shown = 0;
    let arm = 0;
    let t = 0;

    const legX = () => {
      const k = clamp(shown / STROKES, 0, 2);
      return k <= 1 ? NEAR + (FAR - NEAR) * k : FAR - (FAR - NEAR) * (k - 1);
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ canStroke: arm <= 0, back: progress >= STROKES }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        arm = Math.max(0, arm - dt);
        shown += clamp(progress - shown, -dt * 4, dt * 4);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, progress / (2 * STROKES));
        const tap = input.confirm() || input.pointer.clicked || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some((k) => input.pressed(k));
        if (tap && arm <= 0) {
          arm = STROKE_S;
          progress++;
          sfx(progress === STROKES ? 'good' : 'step');
          if (progress === STROKES) fl.add('Buoy! Now back', FAR, SEA_Y - 30, C.gold);
          if (progress >= 2 * STROKES) {
            sfx('good');
            return finish(inst, 1);
          }
        }
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        // Ripples drift left to right.
        for (let i = 0; i < 24; i++) {
          const x = ((i * 47 + t * 18) % (W + 30)) - 15;
          rect(g, Math.round(x), SEA_Y - 24 + (i % 8) * 18, 10, 2, '#8fd4f4');
        }
        buoy(g, t);
        // You, swimming the crawl (facing the way you go): the arm is up mid-stroke, then reaches ahead.
        const back = progress >= STROKES;
        swimmer(g, Math.round(legX()), SEA_Y - 4 + Math.round(Math.sin(t * 3) * 2), arm > STROKE_S / 2, back, look);
        // Progress: out and back.
        const bw = 200;
        const fillW = Math.round((bw * progress) / (2 * STROKES));
        rect(g, W / 2 - bw / 2 - 2, 234, bw + 4, 12, '#0f2a44');
        rect(g, W / 2 - bw / 2, 236, bw, 8, '#1a3a5a');
        rect(g, W / 2 - bw / 2, 236, fillW, 8, C.good);
        rect(g, W / 2 - bw / 2, 236, fillW, 2, '#9af0a0');
        rect(g, W / 2, 232, 2, 16, '#ffffff');
        drawText(g, back ? 'Back to the jetty!' : 'Out to the buoy!', W / 2, 250, { align: 'center', color: '#ffffff', shadow: '#0f2a44' });
        header(g, theme?.title || 'Swim', `${Math.round((progress / (2 * STROKES)) * 100)}%`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// The hotel beach far behind, open sea up to the swimming line, the jetty on the left.
function scenery(g) {
  bands(g, 0, 0, W, SEA_Y - 40, ['#6ab8ea', '#8fd0f0', '#b4e2f6']);
  cblob(g, 300, 46, 12, 12, '#fff2b0');
  rect(g, 60, 34, 34, 6, '#ffffff');
  rect(g, 66, 30, 18, 4, '#ffffff');
  rect(g, 0, SEA_Y - 40, W, 40, '#bfe6f8');
  rect(g, 140, SEA_Y - 58, 100, 22, '#e8d6b4');
  for (let x = 146; x < 234; x += 12) for (const y of [SEA_Y - 54, SEA_Y - 46]) rect(g, x, y, 6, 4, '#5a8aaa');
  rect(g, 136, SEA_Y - 60, 108, 4, '#c8b088');
  rect(g, 0, SEA_Y - 38, W, 6, '#ecd9a0');
  palm(g, 262, SEA_Y - 36, 36, 0.3);
  palm(g, 112, SEA_Y - 36, 30, -0.3);
  bands(g, 0, SEA_Y - 32, W, H - SEA_Y + 32, ['#5ab0e0', '#3a9ad4', '#2f8cc8', '#2a80bc', '#257ab8', '#206ea8']);
  rect(g, 0, SEA_Y - 16, 56, 8, '#b98a5a');
  for (let x = 0; x < 56; x += 8) rect(g, x, SEA_Y - 16, 2, 8, '#8f6640');
  rect(g, 0, SEA_Y - 16, 56, 2, '#d8a870');
  for (const x of [6, 44]) rect(g, x, SEA_Y - 8, 6, 54, '#8f6640'), rect(g, x, SEA_Y - 8, 2, 54, '#a87850');
  // A ladder into the water.
  for (const x of [26, 36]) rect(g, x, SEA_Y - 8, 2, 20, '#c8ccd2');
  for (let k = 0; k < 3; k++) rect(g, 26, SEA_Y - 4 + k * 6, 12, 2, '#c8ccd2');
}

// A striped buoy bobbing on its float line.
function buoy(g, t) {
  const x = FAR + 24;
  const y = SEA_Y - 4 + Math.round(Math.sin(t * 2.4) * 2);
  for (let k = 0; k < 6; k++) rect(g, x + 12 + k * 8, SEA_Y + 2, 4, 2, k % 2 ? '#f2c14e' : '#e2504a');
  cblob(g, x, y, 12, 10, '#a8302a');
  cblob(g, x - 2, y - 2, 10, 8, '#e2504a');
  rect(g, x - 10, y - 2, 20, 4, '#ffffff');
  rect(g, x - 1, y - 22, 2, 14, '#3a3d48');
  rect(g, x + 1, y - 22, 8, 6, '#f2c14e');
  rect(g, x - 14, SEA_Y + 2, 28, 2, '#e8f8ff');
}

// You doing the crawl on 3 px cells, x the middle of your body, y the waterline: back and legs just under the surface
// (tinted), head and a stroking arm out of the water. Trunks or a suit in the corporate colour, long hair with a skirt.
export function swimmer(g, x, y, armUp, back, look) {
  const skin = look.skin;
  const suit = look.corp || look.top;
  const c = cells(g, x - 24, y - 9, 3);
  // Cells run left to right; facing left (the way back) mirrors them around the middle.
  const r = (cx, cy, w, h, col) => c(back ? 25 - cx - w : cx, cy, w, h, col);
  g.save();
  g.globalAlpha = 0.6;
  r(0, 4, 3, 2, skin);
  r(-2, 4, 2, 2, '#e8f8ff'); // the kick
  if (look.skirt) r(3, 3, 12, 4, suit);
  else {
    r(3, 3, 6, 4, skin);
    r(4, 3, 4, 4, suit); // trunks
    r(9, 3, 6, 4, skin);
  }
  g.restore();
  // Head (facing the way you go), hair, one goggle.
  r(14, 0, 6, 6, skin);
  r(14, 0, 6, 2, look.hair);
  r(14, 2, 2, 2, look.hair);
  if (look.long) {
    r(12, 1, 2, 3, look.hair);
    r(10, 3, 3, 3, look.hair); // trailing in the water
  }
  r(18, 2, 2, 1, '#1a1a22');
  r(19, 4, 1, 1, '#7a3b3b');
  // The stroking arm: up and over, or reaching ahead.
  if (armUp) {
    r(11, -5, 2, 6, skin);
    r(12, -7, 4, 2, skin);
  } else r(20, 3, 7, 2, skin);
  // Splashes and the wake (mirrored around the middle of the swimmer).
  const px = (dx, w) => x + (back ? 27 - dx - w : dx);
  for (const [dx, dy] of [[-30, 2], [38, -2], [44, -6]]) rect(g, px(dx, 2), y + dy, 2, 2, '#e8f8ff');
  rect(g, px(-30, 76), y + 10, 76, 2, '#e8f8ff');
}
