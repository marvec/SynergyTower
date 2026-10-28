// Photo Booth (Christmas party): four shots. Each shows a pose card and counts down; hold that pose's arrow when the
// flash fires (or tap its pad before it). A pose counts only if struck after the previous shot (an eager press during
// the flash counts for the next card), so holding one arrow throughout is a stiff photo every time. The strip of four
// photos is the result.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch, reducedMotion } from '../engine/platform.js';
import { bake } from '../engine/mgart.js';
import { person, DEFAULT_PLAYER } from '../engine/figure.js';

const KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const POSES = ['Wave left', 'Crouch', 'Hands up', 'Wave right'];
const SHOTS = 4;
const PAD = { y: 228, w: 96, h: 26, x0: 36, gap: 8 };
const padX = (i) => PAD.x0 + i * (PAD.w + PAD.gap);
/** The line over the pads: what to do, with keys or by touch. */
export const HINT = { keys: 'Press the arrow once the card shows', touch: 'Tap the pose once the card shows' };

const POSE_OF = ['waveL', 'crouch', 'armsUp', 'waveR']; // the figure's pose for each card
const FLAKES = [[146, 80], [180, 60], [310, 66], [336, 104], [160, 124], [300, 130], [210, 100], [276, 92]];
const GREY = { top: '#9a9a9a', skin: '#b8b8b8', hair: '#5a5a5a', tie: '#7a7a7a', pants: '#6a6a6a', skirt: '#7a7a7a' }; // a missed shot, washed out

export default {
  id: 'photobooth',
  name: 'Photo Booth',
  help: 'Strike the pose on each card: press its arrow key once the card shows and hold it (or tap its pad) till the flash. Four shots!',
  create({ difficulty: d, rng, theme, player, sfx = () => {} }) {
    const look = { ...(player || DEFAULT_PLAYER), hat: 'santa' }; // you pose in a Santa hat, in the career's trousers or skirt
    const wait = byDiff(d, 3, 2.2);
    const total = new Countdown(SHOTS * (wait + 1) + 4);
    const poses = Array.from({ length: SHOTS }, () => rng.int(0, 3));
    const fl = new Floaters();
    const strip = [];
    const scene = bake(W, H, booth);
    const card = bake(96, 100, poseCard);
    let shot = 0;
    let t = 0;
    let clock = 0; // for the snow and the blinking light
    const still = reducedMotion(); // the system asks for less motion: the snow stays put
    let phase = 'count';
    let tap = -1;
    let good = 0;
    const struck = new Set(); // the poses struck (arrow pressed, pad tapped) since the last shot fired
    const holding = (input) => {
      const k = KEYS.findIndex((key) => input.down(key));
      return k >= 0 ? k : tap;
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ pose: poses[Math.min(shot, SHOTS - 1)], next: poses[shot + 1] ?? null, phase, left: wait - t, flashT: phase === 'flash' ? t : 0 }),
      update(dt, input) {
        inst._input = input;
        clock += dt;
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / SHOTS);
        t += dt;
        if (input.pointer.clicked && input.pointer.y >= PAD.y) {
          const i = [0, 1, 2, 3].find((k) => input.pointer.x >= padX(k) && input.pointer.x < padX(k) + PAD.w);
          if (i != null) (tap = i), struck.add(i);
        }
        KEYS.forEach((k, i) => input.pressed(k) && struck.add(i));
        if (phase === 'count' && t >= wait) {
          const pose = holding(input);
          const stiff = pose === poses[shot] && !struck.has(pose);
          const ok = pose === poses[shot] && !stiff;
          if (ok) good++;
          strip.push(ok ? pose : stiff ? -1 : pose);
          sfx(ok ? 'good' : 'bad');
          fl.add(ok ? 'Perfect pose!' : stiff ? 'Too stiff! Strike it fresh' : 'Blinked!', W / 2, 60, ok ? '#5fd068' : '#e2504a');
          phase = 'flash';
          t = 0;
          tap = -1;
          struck.clear(); // from now on, presses are for the next card
        } else if (phase === 'flash' && t >= 1) {
          shot++;
          t = 0;
          phase = 'count';
          if (shot >= SHOTS) return finish(inst, good / SHOTS);
        }
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        // The snow drifts down the backdrop from under the banner (y 56-196, then again from the top), a light blinks in the corner.
        const fall = still ? 0 : clock * 10;
        FLAKES.forEach(([x, y]) => snowflake(g, x, 56 + Math.round(((y - 56 + fall) % 140) / 2) * 2));
        if (Math.floor(clock * 2) % 2) rect(g, 338, 186, 6, 6, '#e2504a');
        // The live view: you, holding whatever you hold right now; the pose card on the left.
        const held = KEYS.findIndex((k) => inst._input?.down?.(k));
        const now = held >= 0 ? held : tap;
        person(g, W / 2 - 18, 100, 3, look, { pose: now >= 0 ? POSE_OF[now] : 'stand', expr: 'smile' });
        if (phase === 'count' && shot < SHOTS) {
          g.drawImage(card, 16, 42);
          person(g, 64 - 12, 62, 2, look, { pose: POSE_OF[poses[shot]], expr: 'smile' });
          drawText(g, POSES[poses[shot]], 64, 126, { align: 'center', color: '#1a1a22' });
          drawText(g, String(Math.max(1, Math.ceil(wait - t))), W / 2, 62, { align: 'center', scale: 2, color: '#d8343a' });
        }
        if (phase === 'flash' && t < 0.25) rect(g, 0, 0, W, H, 'rgba(255,255,255,0.85)');
        // The strip so far, on the right: the busts of your shots (grey when missed), then empty frames.
        for (let i = 0; i < SHOTS; i++) {
          const x = 380;
          const y = 40 + i * 44;
          if (i >= strip.length) {
            rect(g, x - 2, y - 2, 44, 44, '#1a1a22');
            rect(g, x, y, 40, 40, '#3a2a4a');
            continue;
          }
          const p = strip[i];
          const ok = p === poses[i];
          rect(g, x - 2, y - 2, 44, 44, '#1a1a22');
          rect(g, x, y, 40, 40, ok ? '#c8e0f0' : '#8a8a8a');
          g.save();
          g.beginPath();
          g.rect(x, y, 40, 40);
          g.clip();
          person(g, x + 8, y + 12, 2, ok ? look : { ...look, ...GREY, tie: look.tie && GREY.tie, skirt: look.skirt && GREY.skirt }, { pose: p >= 0 ? POSE_OF[p] : 'stand', expr: 'smile' });
          g.restore();
        }
        for (let i = 0; i < 4; i++) {
          const on = tap === i;
          rect(g, padX(i), PAD.y, PAD.w, PAD.h, '#1a1a22');
          rect(g, padX(i) + 1, PAD.y + 1, PAD.w - 2, PAD.h - 2, on ? '#f2e14e' : '#3a2a4a');
          rect(g, padX(i) + 1, PAD.y + 1, PAD.w - 2, 2, on ? '#fff07a' : '#5a4a6a');
          drawText(g, POSES[i], padX(i) + PAD.w / 2, PAD.y + 9, { align: 'center', color: on ? '#1a1a22' : '#f4f1e8' });
        }
        drawText(g, isTouch() ? HINT.touch : HINT.keys, W / 2, 216, { align: 'center', color: '#c8b8a8' });
        header(g, theme?.title || 'Photo Booth', `Shot ${Math.min(shot + 1, SHOTS)}/${SHOTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// The art (docs/minigame-visuals/mockups/party/photobooth.js): inside the booth, velvet curtains and a winter backdrop.

function curtain(g, x, w) {
  for (let k = 0; k < w; k += 8) {
    rect(g, x + k, 18, 8, 252, '#8a1a2a');
    rect(g, x + k, 18, 4, 252, '#a8283a');
    rect(g, x + k + 6, 18, 2, 252, '#6a1020');
  }
}

/** The booth: curtains each side, the red frame, the backdrop of the live view with its banner and camera corners, the photo strip's paper. */
function booth(g) {
  rect(g, 0, 0, W, H, '#2a1a2e');
  curtain(g, 0, 16);
  curtain(g, 464, 16);
  rect(g, 118, 28, 244, 184, '#1a1a22');
  rect(g, 120, 30, 240, 180, '#d8343a');
  rect(g, 120, 30, 240, 2, '#f06a64');
  rect(g, 126, 36, 228, 168, '#c8e0f0');
  rect(g, 126, 150, 228, 54, '#f4f8fc');
  rect(g, 150, 40, 180, 14, '#2f8a3a');
  rect(g, 150, 52, 180, 2, '#1f6a2a');
  drawText(g, "SEASON'S GREETINGS", W / 2, 43, { align: 'center', color: '#f4f1e8' });
  for (const [x, y, dx, dy] of [[130, 40, 1, 1], [350, 40, -1, 1], [130, 200, 1, -1], [350, 200, -1, -1]]) {
    rect(g, x - (dx < 0 ? 10 : 0), y - (dy < 0 ? 2 : 0), 10, 2, '#ffffff');
    rect(g, x - (dx < 0 ? 2 : 0), y - (dy < 0 ? 10 : 0), 2, 10, '#ffffff');
  }
  rect(g, 374, 34, 52, 186, '#f4f1e8');
  rect(g, 374, 34, 52, 2, '#ffffff');
}

/** The yellow pose card's frame and light top edge (96 x 100, drawn at 16, 42). */
function poseCard(g) {
  rect(g, 0, 0, 96, 100, '#1a1a22');
  rect(g, 2, 2, 92, 96, '#f2e14e');
  rect(g, 2, 2, 92, 2, '#fff07a');
}

/** A snowflake: a white cross with a diagonal glint, 10 px wide, its centre at x + 1, y + 1. */
function snowflake(g, x, y) {
  rect(g, x - 4, y, 10, 2, '#ffffff');
  rect(g, x, y - 4, 2, 10, '#ffffff');
  rect(g, x - 2, y - 2, 2, 2, '#e8f4fc');
  rect(g, x + 2, y + 2, 2, 2, '#e8f4fc');
}
