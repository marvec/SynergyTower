// Pool ball (vacation hotel): keep the slow beach ball in the air by moving under it. Dropping it costs nothing but a
// moment: it bobs back up.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { bands, cblob, bake } from '../engine/mgart.js';
import { person, DEFAULT_PLAYER } from '../engine/figure.js';
import { hotelFacade, palm, lounger, parasol, cloud } from '../engine/mgscenery.js';

const GOAL = 10;
const WATER = 214; // y of the pool surface
const YOU_Y = WATER - 38; // the top of your head (2x figure, waist-deep)
const BALL_R = 14; // the ball's radius, its outline included
const HANDS = YOU_Y - 14 - BALL_R; // the ball's centre when its bottom meets your raised hands (7 cells above the head)
const GRAVITY = 150;
const BOUNCE = 150;
const SPEED = 230;
const CATCH = 30; // half-width of your reach
const PHASES = 12; // the ball's turning, in baked steps

export default {
  id: 'beachball',
  name: 'Pool Ball',
  help: 'Move left and right (arrows or mouse) to stay under the beach ball and bounce it. Keep it out of the water!',
  create({ rng, theme, sfx = () => {}, player }) {
    const total = new Countdown(32);
    const fl = new Floaters();
    const you = { x: W / 2 };
    const ball = { x: W / 2 + 60, y: 40, vx: -20, vy: 0, wet: 0 };
    let bounces = 0;
    let t = 0;
    const look = player || DEFAULT_PLAYER;
    const scene = bake(W, H, scenery);
    const pool = bake(W, H - WATER, poolBands);
    const lane = bake(W, H - WATER + 24, laneLine);
    const balls = Array.from({ length: PHASES }, (_, k) => bake(BALL_R * 2, BALL_R * 2, (b) => drawBall(b, BALL_R, BALL_R, (k * Math.PI) / PHASES)));

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ ball: { ...ball }, you: { ...you } }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, bounces / GOAL);
        const p = input.pointer;
        if (p.inside && (p.moved || p.down)) you.x += clamp(p.x - you.x, -SPEED * 1.5 * dt, SPEED * 1.5 * dt);
        if (input.down('ArrowLeft')) you.x -= SPEED * dt;
        if (input.down('ArrowRight')) you.x += SPEED * dt;
        you.x = clamp(you.x, 30, W - 30);
        if (ball.wet > 0) {
          ball.wet -= dt;
          if (ball.wet <= 0) Object.assign(ball, { x: rng.int(80, W - 80), y: 40, vx: rng.float(-30, 30), vy: 0 });
          return;
        }
        ball.vy += GRAVITY * dt;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.x < 20 || ball.x > W - 20) ball.vx = -ball.vx, (ball.x = clamp(ball.x, 20, W - 20));
        if (ball.vy > 0 && ball.y >= HANDS && ball.y < HANDS + 14 && Math.abs(ball.x - you.x) < CATCH) {
          ball.y = HANDS;
          ball.vy = -BOUNCE;
          ball.vx = rng.float(35, 70) * (rng.chance(0.5) ? -1 : 1);
          bounces++;
          sfx('blip');
          fl.add(String(bounces), ball.x, HANDS - 30, C.gold);
          if (bounces >= GOAL) return finish(inst, 1);
        }
        if (ball.y > WATER + 4) {
          ball.wet = 0.9;
          sfx('click');
          fl.add('Splash!', ball.x, WATER - 20, '#7fc4ff');
        }
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        // You, waist-deep, arms up; the water is drawn over your legs.
        const x = Math.round(you.x);
        const px = x - 12;
        person(g, px, YOU_Y, 2, look, { pose: 'armsUp', swim: look.skirt ? 'suit' : 'trunks' });
        g.drawImage(pool, 0, WATER);
        for (let i = 0; i < 22; i++) rect(g, ((i * 61 + t * 30) % (W + 40)) - 20, WATER + 8 + (i % 5) * 11, 10 + (i % 3) * 4, 2, '#8fe6f5');
        g.drawImage(lane, 0, WATER - 24);
        // The legs show faintly through the water.
        g.save();
        g.globalAlpha = 0.35;
        rect(g, px + 6, WATER, 4, 18, look.skin);
        rect(g, px + 14, WATER, 4, 18, look.skin);
        // The ball's shadow on the water: where it comes down.
        if (!ball.wet) rect(g, Math.round(ball.x) - 8, WATER + 2, 16, 2, '#0a3a5a');
        g.restore();
        for (let k = -14; k < 38; k += 4) rect(g, px + k, WATER + ((k / 4) % 2 ? 0 : 2), 4, 2, '#e8fcff');
        if (ball.wet > 0) {
          // Half under: the top of the ball bobbing on the water.
          const bx = Math.round(ball.x);
          rect(g, bx - 8, WATER - 6, 16, 2, '#1a1a22');
          rect(g, bx - 10, WATER - 4, 20, 6, '#1a1a22');
          rect(g, bx - 8, WATER - 4, 16, 4, '#e2504a');
          rect(g, bx - 2, WATER - 4, 4, 4, '#ffffff');
          rect(g, bx - 6, WATER - 4, 2, 2, '#ffffff');
        } else {
          const f = Math.floor(((t * 1.5) / Math.PI) * PHASES) % PHASES;
          g.drawImage(balls[f], Math.round(ball.x) - BALL_R, Math.round(ball.y) - BALL_R);
        }
        header(g, theme?.title || 'Pool ball', `Bounces ${bounces}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Stay under the ball and keep it up', W / 2, 22, { align: 'center', color: '#1a3a5a' });
        fl.render(g);
      },
    };
    return inst;
  },
};

// The static scenery: sky, clouds, the hotel, palms, the deck with loungers and parasols, the pool's coping.
function scenery(g) {
  rect(g, 0, 0, W, H, '#8fd0f0');
  bands(g, 0, 18, W, 132, ['#6ab8ea', '#8fd0f0', '#b4e2f6']);
  cloud(g, 40, 34);
  cloud(g, 330, 26);
  hotelFacade(g);
  palm(g, 34, 186, 120, 0.35);
  palm(g, 452, 184, 110, -0.4);
  bands(g, 0, 150, W, WATER - 158, ['#efe4cc', '#eadcc0']);
  for (let y = 156; y < WATER - 8; y += 12) rect(g, 0, y, W, 1, '#d4c4a4');
  parasol(g, 64, 188);
  lounger(g, 20, 190, false);
  lounger(g, 84, 192, false);
  parasol(g, 408, 186);
  lounger(g, 360, 190, true);
  lounger(g, 424, 192, true);
  rect(g, 150, 182, 30, 10, '#f2c14e');
  for (let k = 0; k < 30; k += 8) rect(g, 150 + k, 182, 4, 10, '#e2504a');
  rect(g, 0, WATER - 8, W, 4, '#f8f6f0');
  for (let x = 0; x < W; x += 8) rect(g, x, WATER - 4, 8, 4, (x / 8) % 2 ? '#2a86c7' : '#e8f6fb');
}

// The pool, drawn at y = WATER over the swimmer: flat bands.
function poolBands(g) {
  bands(g, 0, 0, W, H - WATER, ['#4ccde8', '#3ab8dc', '#2ea4d0', '#2490c2']);
}

// The tiles' dashes on the pool floor and the lane line's posts and ropes, drawn at y = WATER - 24 over the ripples.
function laneLine(g) {
  for (let x = 0; x < W; x += 16) rect(g, x, 256 - WATER + 24, 10, 4, '#1f74a8');
  for (const lx of [442, 456]) rect(g, lx, 2, 2, 40, '#d8dee6');
  for (let k = 0; k < 3; k++) rect(g, 442, 26 + k * 8, 16, 2, '#b8c4d0');
}

// A chunky ball: 2 px cells, six panels turning by `a`, a white cap and one highlight, a 2 px outline (BALL_R in all).
function drawBall(g, x, y, a) {
  const cols = ['#e2504a', '#ffffff', '#3b6fb6', '#f2c14e', '#ffffff', '#3bb66a'];
  const r = BALL_R - 2;
  cblob(g, x, y, r + 2, r + 2, '#1a1a22');
  for (let dy = -r; dy < r; dy += 2)
    for (let dx = -r; dx < r; dx += 2) {
      const cx = dx + 1;
      const cy = dy + 1;
      if (cx * cx + cy * cy > r * r) continue;
      const ring = Math.sqrt(r * r - cy * cy) || 1;
      const lon = Math.asin(Math.max(-1, Math.min(1, cx / ring)));
      let c = cols[((Math.floor(((lon + a) / Math.PI) * 6) % 6) + 6) % 6];
      if (cy < -r * 0.65 && Math.abs(cx) < 6) c = '#ffffff';
      rect(g, x + dx, y + dy, 2, 2, c);
    }
  rect(g, x - 6, y - 8, 4, 2, '#ffffff');
}
