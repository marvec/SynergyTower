// Pool ball (vacation hotel): keep the slow beach ball in the air by moving under it. Dropping it costs nothing but a
// moment: it bobs back up.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const GOAL = 10;
const WATER = 200; // y of the pool surface
const HANDS = WATER - 18; // where the ball meets your hands
const GRAVITY = 150;
const BOUNCE = 150;
const SPEED = 230;
const CATCH = 30; // half-width of your reach

export default {
  id: 'beachball',
  name: 'Pool Ball',
  help: 'Move left and right (arrows or mouse) to stay under the beach ball and bounce it. Keep it out of the water!',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(32);
    const fl = new Floaters();
    const you = { x: W / 2 };
    const ball = { x: W / 2 + 60, y: 40, vx: -20, vy: 0, wet: 0 };
    let bounces = 0;
    let t = 0;

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
        rect(g, 0, 0, W, H, '#8fd0f0');
        rect(g, 0, 150, W, 50, '#f4f1e8');
        for (let x = 0; x < W; x += 40) rect(g, x + 4, 158, 32, 20, '#e6d3ad');
        rect(g, 0, WATER, W, H - WATER, '#3ec1e0');
        for (let i = 0; i < 14; i++) rect(g, ((i * 61 + t * 30) % (W + 40)) - 20, WATER + 10 + (i % 4) * 14, 14, 1, '#8fe6f5');
        // You, waist-deep, arms up.
        const x = Math.round(you.x);
        rect(g, x - 8, HANDS + 6, 16, 14, '#e85d75');
        rect(g, x - 6, HANDS - 6, 12, 12, '#f2c9a0');
        rect(g, x - 6, HANDS - 6, 12, 3, '#5a3a22');
        rect(g, x - 14, HANDS - 2, 4, 14, '#f2c9a0');
        rect(g, x + 10, HANDS - 2, 4, 14, '#f2c9a0');
        rect(g, x - 22, WATER, 44, 2, '#e8f8ff');
        if (ball.wet > 0) {
          rect(g, ball.x - 9, WATER - 3, 18, 5, '#e2504a');
        } else drawBall(g, ball.x, ball.y, t);
        header(g, theme?.title || 'Pool ball', `Bounces ${bounces}/${GOAL}`);
        timerBar(g, total.left, total.total);
        drawText(g, 'Stay under the ball and keep it up', W / 2, 24, { align: 'center', color: '#1a3a5a' });
        fl.render(g);
      },
    };
    return inst;
  },
};

function drawBall(g, x, y, t) {
  x = Math.round(x);
  y = Math.round(y);
  rect(g, x - 6, y - 9, 12, 18, '#1a1a22');
  rect(g, x - 9, y - 6, 18, 12, '#1a1a22');
  const c = ['#e2504a', '#ffffff', '#3b6fb6', '#f2c14e'];
  const k = Math.floor(t * 6) % 4;
  for (let i = 0; i < 4; i++) rect(g, x - 8 + i * 4, y - 5, 4, 10, c[(i + k) % 4]);
  rect(g, x - 5, y - 8, 10, 3, c[k]);
  rect(g, x - 5, y + 5, 10, 3, c[(k + 2) % 4]);
  rect(g, x - 3, y - 6, 3, 2, '#ffffff');
}
