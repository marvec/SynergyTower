// Sandcastle (vacation hotel): the bucket swings slowly over the castle; drop it when it is over the top to add a layer.
// Generous: anywhere over most of the top holds. A miss just slides off; tip the bucket again.
// Art: the beach in the in-between style (docs/minigame-visuals). The scenery is baked; the surf (24 baked phases), the
// castle tiers (one baked image per layer, drawn for every layer built), the pennants and the kid's pail are drawn per
// frame (they change while you play).
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';
import { grad, rnd, sprite, bake, blob, line, shaded, grains } from '../engine/mgart.js';

const LAYERS = 6;
const SWING = 64; // px either side of the castle
const PERIOD = 3.2; // seconds per full swing
const HOLD = 30; // drops within this offset stick
const BASE_Y = 226;
const LAYER_H = 16;
const FALL = 0.35;
const SAND = ['#b89a5a', '#d4b46e', '#e6c784', '#f2dc9e']; // wet foot, shadow, face, light
const SURF_Y = 112; // where the beach starts: the surf never paints below it
const SURF_RATE = 1.5; // radians per second the surf rolls
const TAU = Math.PI * 2;
const SURF_PHASES = 24; // the surf is baked in this many phases of one roll
const SURF_TOP = 103; // the surf's rows: 103 .. SURF_Y - 1
const SURF_H = SURF_Y - SURF_TOP;

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

    // Never changes: the sky and sea, the beach with the parasol, the spade and the mound. Baked once.
    const scene = bake(W, H, (b) => {
      sea(b);
      beach(b);
      parasol(b);
      spade(b);
      blob(b, cx, BASE_Y + 4, 78, 7, SAND[1]);
      blob(b, cx, BASE_Y + 2, 72, 5, SAND[2]);
    });
    const dashes = waveDashes();
    // The tiers (one image per layer, drawn from `built` every frame, never part of `scene`) and the surf in SURF_PHASES phases.
    const pailImg = bake(PAIL.w, PAIL.h, (b) => (b.translate(PAIL.ox, PAIL.oy), drawPail(b)));
    const tiers = Array.from({ length: LAYERS }, (_, i) => bake(width(i), LAYER_H + 4, (b) => tier(b, i, width(i) / 2, 4, width(i))));
    const surfs = Array.from({ length: SURF_PHASES }, (_, k) => bake(W, SURF_H, (b) => (b.translate(0, -SURF_TOP), surf(b, ((k / SURF_PHASES) * Math.PI * 2) / SURF_RATE))));
    const drawTier = (g, i, x, y) => tiers[i] && g.drawImage(tiers[i], Math.round(x - width(i) / 2), Math.round(y) - 4); // never past the last tier

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ offset: offset(), falling: !!drop, built }),
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
            } else {
              sfx('bad');
              fl.add('It slid off', cx + drop.x, topY() - 10, C.dim);
            }
            drop = null; // before finishing: the host keeps rendering under the result card, and there is no tier past the sixth
            if (built >= LAYERS) return finish(inst, 1);
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
        g.drawImage(scene, 0, 0);
        // The sea's wave dashes drift sideways, the surf rolls in; the beach below is baked.
        for (const [x0, y, w] of dashes) rect(g, Math.floor((x0 + t * 6) % W), y, w, 1, '#8fe6f5');
        g.drawImage(surfs[Math.round((((t * SURF_RATE) % TAU) / TAU) * SURF_PHASES) % SURF_PHASES], 0, SURF_TOP);
        // The castle so far, then the shells that come with the finished keep.
        for (let i = 0; i < built; i++) drawTier(g, i, cx, BASE_Y - (i + 1) * LAYER_H);
        if (built >= LAYERS) {
          const top = topY();
          rect(g, cx, top - 30, 1, 26, '#6b4a22');
          for (let k = 0; k < 8; k++) rect(g, cx + 1, top - 30 + k, 14 - Math.abs(4 - k) * 2, 1, k < 4 ? '#e2504a' : '#c03a34');
          for (let i = 0; i < 6; i++) blob(g, cx - 30 + i * 12, BASE_Y - 8, 2, 2, '#f4e8e0');
        } else {
          // Where the next layer goes: little pennants either side of the top of the castle.
          for (const s of [-1, 1]) {
            const fx = cx + s * (width(built) / 2 + 8);
            rect(g, fx, topY() - 22, 1, 20, '#6b4a22');
            for (let k = 0; k < 5; k++) rect(g, fx + (s > 0 ? 1 : -k - 1), topY() - 22 + k, 7 - k, 1, k % 2 ? '#e2504a' : '#f2c14e');
          }
        }
        // The falling layer, then the kid's arm and the pail on its swing, tipped as it lets go.
        if (drop) {
          const k = Math.min(1, drop.t / FALL);
          drawTier(g, built, cx + drop.x, 60 + (topY() - LAYER_H - 60) * k);
        }
        const off = drop ? drop.x : offset();
        const tip = drop ? Math.min(1, drop.t * 6) : 0;
        arm(g, cx + off, 44);
        pail(g, pailImg, cx + off, 50 + tip * 4, -off / 500 + (off <= 0 ? 1 : -1) * tip * 0.35);
        header(g, theme?.title || 'Sandcastle', `Layers ${built}/${LAYERS}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Tip the bucket over the castle', W / 2, 256, { align: 'center', color: '#6a4a22' });
        fl.render(g);
      },
    };
    return inst;
  },
};

// The wave dashes on the sea: [x, y, width], fixed; render() slides them along.
function waveDashes() {
  const r = rnd(12);
  return Array.from({ length: 40 }, () => [Math.floor(r() * W), Math.floor(78 + r() * 28), Math.floor(3 + r() * 5)]);
}

// Sky, gulls, an island and a sail, the sea in bands down to the horizon and the shore.
function sea(g) {
  grad(g, 0, 18, W, 56, ['#5aa8e0', '#8fd0f0', '#cdeefa']);
  for (const [x, y] of [[60, 34], [120, 28], [380, 40]]) {
    line(g, x, y, x + 4, y - 3, '#3a4a5a');
    line(g, x + 4, y - 3, x + 8, y, '#3a4a5a');
  }
  blob(g, 390, 74, 40, 6, '#5a9a6a');
  blob(g, 380, 72, 18, 6, '#4a8a5a');
  rect(g, 0, 74, W, 1, '#e8f8ff');
  rect(g, 120, 66, 1, 8, '#6a5a4a');
  for (let k = 0; k < 7; k++) rect(g, 121, 66 + k, k, 1, '#ffffff');
  grad(g, 0, 75, W, 32, ['#1f6fb0', '#2a86c7', '#3ec1d8']);
  rect(g, 0, 107, W, SURF_Y - 107, '#bff2fa'); // the wash under the surf
}

// The surf: a scalloped foam line and the wash over the wet sand, in 2 px columns, rolling with t (baked per phase).
function surf(g, t) {
  for (let x = 0; x < W; x += 2) {
    const y = 106 + Math.round(Math.sin(x * 0.07 + t * SURF_RATE) * 2 + Math.sin(x * 0.19) * 1);
    rect(g, x, y, 2, Math.min(4, SURF_Y - y), '#ffffff');
    if (y + 4 < SURF_Y) rect(g, x, y + 4, 2, Math.min(2, SURF_Y - y - 4), '#bff2fa');
  }
}

// Wet and dry sand in bands with sparse grains, footprints, shells and a starfish. The bottom strip stays flat for the hint.
function beach(g) {
  grad(g, 0, SURF_Y, W, 20, ['#8fc8d0', '#c8b07a', '#d8bc80']);
  grad(g, 0, 128, W, H - 128, ['#e2c486', '#ecd49a', '#f2dea6']);
  grains(g, 0, SURF_Y, W, 138, ['#c8a868', '#fff0c0', '#d4b474'], 780, 21);
  for (let i = 0; i < 6; i++) blob(g, 40 + i * 14, 236 - i * 12 + (i % 2) * 5, 2, 3, '#d4b474');
  for (const [x, y] of [[96, 150], [404, 240], [330, 160]]) {
    blob(g, x, y, 4, 3, '#f4e8e0');
    for (let k = -3; k <= 3; k += 2) rect(g, x + k, y - 2, 1, 4, '#d8b8b0');
  }
  sprite(g, '..s..|..s..|sssss|.s.s.|s...s', { s: '#e8704a' }, 150, 236, 2);
}

// A striped parasol (blue and yellow) with a striped towel in its shade.
function parasol(g) {
  rect(g, 66, 136, 2, 100, '#f4f4f0');
  for (let k = 0; k < 22; k++) {
    const hw = Math.round(6 + k * 2.2);
    for (let s = -hw; s < hw; ) {
      const next = Math.min(hw, (Math.floor((s + 60) / 9) + 1) * 9 - 60);
      rect(g, 67 + s, 116 + k, next - s, 1, Math.floor((s + 60) / 9) % 2 ? '#f2c14e' : '#2a86c7');
      s = next;
    }
  }
  rect(g, 66, 112, 2, 4, '#b8a07c');
  for (let y = 0; y < 16; y++) rect(g, 30 - y, 230 + y, 80, 1, y % 6 < 3 ? '#e2504a' : '#ffffff');
}

// A red spade stuck in the sand.
function spade(g) {
  rect(g, 352, 180, 3, 40, '#8a5a3a');
  rect(g, 350, 178, 7, 4, '#e2504a');
  for (let k = 0; k < 10; k++) rect(g, 349 + Math.floor(k / 3), 218 + k, 9 - Math.floor(k / 3) * 2, 1, '#e2504a');
}

// A packed tier centred on cx with its top at y: tapering sides, light from the left, a wet darker foot, crenellations,
// windows (a door on the bottom one).
function tier(g, i, cx, y, w) {
  for (let k = 0; k < LAYER_H; k++) {
    const inset = Math.floor((LAYER_H - k) / 5);
    const x0 = cx - w / 2 + inset;
    const ww = w - inset * 2;
    rect(g, x0, y + k, ww, 1, SAND[2]);
    rect(g, x0, y + k, 3, 1, SAND[3]);
    rect(g, x0 + ww - 4, y + k, 4, 1, SAND[1]);
  }
  rect(g, cx - w / 2, y + LAYER_H - 2, w, 2, SAND[0]);
  grains(g, cx - w / 2 + 2, y + 1, w - 4, LAYER_H - 3, [SAND[1], SAND[3]], Math.round(w / 2), i * 31 + 5);
  for (let x = cx - w / 2 + 2; x < cx + w / 2 - 5; x += 9) {
    rect(g, x, y - 4, 5, 4, SAND[2]);
    rect(g, x, y - 4, 2, 4, SAND[3]);
    rect(g, x + 4, y - 4, 1, 4, SAND[1]);
  }
  if (i === 0) {
    blob(g, cx, y + 9, 6, 6, SAND[0]);
    rect(g, cx - 6, y + 9, 12, 7, SAND[0]);
    blob(g, cx, y + 9, 5, 5, '#5a4022');
    rect(g, cx - 5, y + 9, 10, 7, '#5a4022');
  } else
    for (const dx of [-w / 4, w / 4]) {
      rect(g, cx + dx - 2, y + 5, 4, 6, '#5a4022');
      blob(g, cx + dx, y + 5, 2, 2, '#5a4022');
    }
}

// The pail, baked upright once (PAIL: its size and the rim centre in it) and drawn turned by `tilt` radians with its rim
// centre at (x, y). Turning the image without smoothing keeps hard pixels; turned rects would blur at their edges.
const PAIL = { w: 34, h: 40, ox: 17, oy: 16 };
function pail(g, img, x, y, tilt) {
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(x), Math.round(y));
  g.rotate(tilt);
  g.drawImage(img, -PAIL.ox, -PAIL.oy);
  g.restore();
}

// The upright pail around its rim centre (0, 0): a tapered bucket, a light stripe, sand showing at the top, a label and a
// wire handle.
function drawPail(g) {
  for (let k = 0; k < 22; k++) {
    const hw = 14 - Math.floor(k / 4);
    rect(g, -hw, k, hw * 2, 1, '#1a3a7a');
    rect(g, -hw + 1, k, hw * 2 - 2, 1, '#3b6fb6');
    rect(g, -hw + 3, k, 3, 1, '#7fb4ea');
    rect(g, hw - 4, k, 3, 1, '#2a5498');
  }
  rect(g, -16, -2, 32, 4, '#1a3a7a');
  rect(g, -15, -2, 30, 3, '#5a8ad6');
  rect(g, -13, -1, 26, 1, SAND[2]);
  rect(g, -6, 8, 12, 6, '#f2c14e');
  sprite(g, '.y.|yyy|.y.', { y: '#ffffff' }, -1, 9, 1);
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.06) rect(g, Math.round(Math.cos(a) * 15), Math.round(Math.sin(a) * 14), 1, 1, '#9aa1ad');
}

// A kid's arm coming down from above the screen to the pail: sleeve, forearm, a fist at (x, y).
function arm(g, x, y) {
  rect(g, x - 6, 18, 12, 10, '#2a2a3a');
  rect(g, x - 5, 18, 10, 10, '#f2c14e');
  rect(g, x - 5, 26, 10, 2, '#d4a030');
  rect(g, x - 4, 28, 8, y - 34, '#c98a62');
  rect(g, x - 3, 28, 6, y - 34, '#e9b48c');
  rect(g, x - 2, 28, 2, y - 34, '#f6caa2');
  shaded(g, x, y - 4, 5, 5, '#e9b48c', { rim: '#b4744c', light: '#f6caa2' });
  rect(g, x - 4, y - 3, 8, 1, '#c98a62');
}
