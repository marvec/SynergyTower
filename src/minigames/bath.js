// Bath (home office chore): two taps, one bath. The water cools by itself; keep it inside the comfort band (which
// shifts as you relax) by opening the hot or the cold tap. Time spent just right is time relaxed.
import { W, H, rect, drawText, header, timerBar, Countdown, clamp, finish } from '../engine/mgkit.js';
import { cblob, shade, bake } from '../engine/mgart.js';
import { squares, pottedPlant } from '../engine/mgscenery.js';

const TIME = 40;
const TAP = 3.2; // degrees per second from a tap
const COOL = 0.35;
const START = 28;
const SHIFT_S = 10;
const OVAL = { cx: 240, cy: 132, rx: 112, ry: 20 }; // the water inside the tub's rim; bubbles stay inside it
const TH = { x: 420, y: 60, h: 140 }; // the thermometer

/** The water's colour: blue when cold, warming to a soft pink when hot (never grey-brown on the way). */
export function bathWater(temp) {
  const k = clamp((temp - 20) / 25, 0, 1);
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(90 + 150 * k * 0.7)}${hex(180 - 40 * k)}${hex(228 - 60 * k)}`;
}

export default {
  id: 'bath',
  name: 'Just Right',
  help: 'Hold LEFT for the cold tap, RIGHT for the hot one (or hold the mouse on a tap). Keep the water inside the comfort band.',
  create({ rng, theme }) {
    const total = new Countdown(TIME);
    let temp = START;
    let band = [37, 40];
    let inBand = 0;
    let shiftT = SHIFT_S;
    let t = 0;
    let hot = false;
    let cold = false;
    const bubbles = [];

    const scene = bake(W, H, (b) => {
      room(b);
      tubShell(b);
      for (const [x, col, label] of [[150, '#2a6ad1', 'COLD'], [330, '#e2504a', 'HOT']]) tap(b, x, col, label);
      thermometerFrame(b);
      rect(b, 140, 226, 200, 16, 'rgba(20,30,36,0.6)'); // under the hint
    });

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ temp, band: [...band], bubbles: bubbles.map((b) => ({ ...b })) }),
      update(dt, input) {
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, inBand / (TIME * 0.8));
        const p = input.pointer;
        const mouseTap = p.down && p.y > 30 ? (p.x < W / 2 ? 'cold' : 'hot') : null;
        hot = input.down('ArrowRight') || mouseTap === 'hot';
        cold = input.down('ArrowLeft') || mouseTap === 'cold';
        temp += ((hot ? TAP : 0) - (cold ? TAP : 0) - COOL + Math.sin(t * 0.9) * 0.3) * dt;
        temp = clamp(temp, 15, 50);
        shiftT -= dt;
        if (shiftT <= 0) {
          shiftT = SHIFT_S;
          const mid = clamp((band[0] + band[1]) / 2 + rng.pick([-2, -1.5, 1.5, 2]), 36, 41);
          band = [mid - 1.5, mid + 1.5];
        }
        const good = temp >= band[0] && temp <= band[1];
        if (good) {
          inBand += dt;
          if (rng.chance(dt * 6)) bubbles.push({ x: rng.int(180, 290), y: 142, s: rng.int(4, 9) < 7 ? 4 : 6 });
        }
        for (const b of bubbles) b.y -= dt * 10;
        while (bubbles.length && bubbles[0].y < 120) bubbles.shift();
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        const water = bathWater(temp);
        tubWater(g, water, t);
        for (const b of bubbles) {
          rect(g, Math.round(b.x), Math.round(b.y), b.s, b.s, '#ffffff');
          rect(g, Math.round(b.x), Math.round(b.y), 2, 2, water);
        }
        duck(g, Math.round(Math.sin(t * 2)) * 2);
        // The taps run when open: cold (left), hot (right).
        if (cold) stream(g, 150, t);
        if (hot) stream(g, 330, t);
        thermometer(g, temp, band);
        const good = temp >= band[0] && temp <= band[1];
        drawText(g, good ? 'Just right...' : temp < band[0] ? 'Brr! Too cold' : 'Ouch! Too hot', 240, 230, { align: 'center', color: good ? '#b8f0b8' : temp < band[0] ? '#bfe4f2' : '#ffb0a0' });
        header(g, theme?.title || 'Bath', `Relaxed ${Math.round(Math.min(1, inBand / (TIME * 0.8)) * 100)}%`);
        timerBar(g, total.left, total.total);
      },
    };
    return inst;
  },
};

// Drawn in the in-between style (docs/minigame-visuals/mockups/home/bath.js).
function room(g) {
  squares(g, 0, 18, W, 172, '#d8eef0', '#b0ccd4');
  rect(g, 0, 132, W, 4, '#4a9aa8');
  rect(g, 0, 190, W, H - 190, '#8aa0aa');
  for (let x = 0; x < W; x += 24) rect(g, x, 190, 2, H - 190, '#7a909a');
  // A towel on a rail and a plant on the floor.
  rect(g, 20, 60, 50, 4, '#9aa1ad');
  rect(g, 26, 64, 38, 50, '#e2504a');
  rect(g, 26, 104, 38, 4, '#f4f1e8');
  pottedPlant(g, 60, 238, 1.4);
}

function tap(g, x, col, label) {
  // A chrome spout from the wall, a cross handle with a coloured cap.
  rect(g, x - 4, 74, 8, 16, '#9aa1ad');
  rect(g, x - 4, 74, 2, 16, '#e8eef4');
  rect(g, x - 12, 70, 24, 4, '#9aa1ad');
  rect(g, x - 12, 70, 24, 2, '#e8eef4');
  rect(g, x - 2, 64, 4, 6, '#9aa1ad');
  cblob(g, x, 64, 4, 4, col);
  rect(g, x - 6, 90, 12, 6, '#9aa1ad');
  rect(g, x - 6, 90, 12, 2, '#e8eef4');
  rect(g, x - 4, 96, 8, 4, '#6a707c');
  drawText(g, label, x, 52, { align: 'center', color: col, shadow: '#ffffff' });
}

function stream(g, x, t) {
  for (let k = 0; k < 6; k++) {
    rect(g, x - 2, 100 + k * 4, 4, 4, '#bfe4f2');
    rect(g, x - 2 + ((k + Math.round(t * 8)) % 2) * 2, 100 + k * 4, 2, 2, '#ffffff');
  }
}

/** The tub without its water: the gold feet, the enamel side and the oval rim. */
function tubShell(g) {
  for (const fx of [146, 322]) {
    rect(g, fx, 196, 12, 16, '#c8a040');
    rect(g, fx - 2, 208, 16, 6, '#a88020');
    rect(g, fx, 196, 4, 10, '#f2d870');
  }
  cblob(g, 240, 176, 126, 30, '#9aa4b0');
  rect(g, 114, 130, 252, 46, '#9aa4b0');
  cblob(g, 240, 176, 122, 26, '#f4f6f8');
  rect(g, 118, 130, 244, 46, '#f4f6f8');
  rect(g, 118, 184, 244, 4, '#e2e6ec');
  cblob(g, 240, 128, 130, 34, '#9aa4b0');
  cblob(g, 240, 128, 126, 30, '#ffffff');
}

function tubWater(g, water, t) {
  cblob(g, OVAL.cx, 130, 114, 22, shade(water, -0.2));
  cblob(g, OVAL.cx, OVAL.cy, OVAL.rx, OVAL.ry, water);
  rect(g, 160, 120, 60, 2, 'rgba(255,255,255,0.45)');
  rect(g, 250, 126, 40, 2, 'rgba(255,255,255,0.35)');
  // Foam at the ends.
  for (const [x, y, rx] of [[146, 128, 10], [160, 136, 8], [140, 140, 6], [330, 126, 10], [318, 138, 8], [214, 140, 6]]) {
    cblob(g, x, y, rx, Math.round(rx * 0.6), '#ffffff');
    cblob(g, x - 2, y - 2, Math.max(2, rx - 4), 2, '#eef4fa');
  }
}

function duck(g, dy) {
  cblob(g, 280, 130 + dy, 9, 5, '#d8b018');
  cblob(g, 280, 128 + dy, 8, 5, '#f2d22e');
  cblob(g, 288, 120 + dy, 5, 5, '#f2d22e');
  rect(g, 292, 120 + dy, 6, 2, '#f29c38');
  rect(g, 288, 118 + dy, 2, 2, '#1a1a22');
  rect(g, 274, 124 + dy, 6, 2, '#f8e870');
}

function thermometerFrame(g) {
  rect(g, TH.x - 2, TH.y - 2, 20, TH.h + 4, '#3a3d48');
  rect(g, TH.x, TH.y, 16, TH.h, '#f4f6f8');
}

function thermometer(g, temp, band) {
  const { x: tx, y: ty, h: th } = TH;
  const yOf = (v) => ty + th - ((v - 15) / 35) * th;
  rect(g, tx, yOf(band[1]), 16, yOf(band[0]) - yOf(band[1]), '#9ae0a0');
  rect(g, tx + 6, yOf(temp), 4, ty + th - yOf(temp) + 6, '#e2504a');
  cblob(g, tx + 8, ty + th + 10, 10, 10, '#3a3d48');
  cblob(g, tx + 8, ty + th + 10, 8, 8, '#e2504a');
  for (let v = 20; v <= 45; v += 5) rect(g, tx, yOf(v), 4, 2, '#9aa1ad');
  drawText(g, `${Math.round(temp)}C`, tx + 8, ty + th + 24, { align: 'center', color: '#1a1a22' });
}
