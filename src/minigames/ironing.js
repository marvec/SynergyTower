// Ironing (home office chore): a shirt full of creases. Move the iron over each one to press it flat, but keep it
// moving: an iron left standing on the fabric heats up and scorches it.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { cblob, bake, glow } from '../engine/mgart.js';

const SHIRT = { x: 120, y: 50, w: 240, h: 170 };
const CREASES = 10;
const SPEED = 150;
const REACH = 12;
const PRESS_S = 0.4; // under the iron to smooth a crease
const HEAT_S = 1.6; // standing still on the fabric this long scorches it
const BODY = { x0: 175, x1: 305 }; // creases below the sleeves stay on the body (the shirt's body is x 166-314)
const SLEEVE_Y = 112; // the sleeves end at y 118; above this a crease may lie anywhere across the shoulders

/** Is a crease centred here on the shirt's shape (the body, or a sleeve above its hem), not in a bare corner? */
const creaseOk = (x, y) => (x >= BODY.x0 && x <= BODY.x1) || y <= SLEEVE_Y;

export default {
  id: 'ironing',
  name: 'Pressing Matters',
  help: 'Move the iron (arrow keys or mouse) over every crease to press it flat. Keep it moving: left standing, it scorches the shirt.',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(45);
    const fl = new Floaters();
    const iron = { x: 420, y: 135 };
    let aim = null;
    let heat = 0;
    let scorches = 0;
    let smoothed = 0;
    const marks = [];
    const creases = [];
    // Rejection sampling: a point on the shirt's shape, clear of the others; after 400 tries one on the body, whatever is near.
    while (creases.length < CREASES) {
      let c = null;
      for (let tries = 0; tries < 400 && !c; tries++) {
        const o = { x: rng.int(SHIRT.x + 20, SHIRT.x + SHIRT.w - 20), y: rng.int(SHIRT.y + 20, SHIRT.y + SHIRT.h - 20), press: 0, len: rng.int(10, 18) };
        if (creaseOk(o.x, o.y) && creases.every((p) => Math.hypot(p.x - o.x, p.y - o.y) > 34)) c = o;
      }
      c ||= { x: rng.int(BODY.x0, BODY.x1), y: rng.int(SHIRT.y + 20, SHIRT.y + SHIRT.h - 20), press: 0, len: rng.int(10, 18) };
      creases.push(c);
    }
    let t = 0;
    const scene = bake(W, H, (b) => {
      rect(b, 0, 0, W, H, '#e8dcc8');
      floor(b);
      board(b);
      shirt(b);
      rect(b, 0, H - 26, W, 12, 'rgba(60,40,24,0.55)'); // under the hint
    });
    const onShirt = () => iron.x > SHIRT.x && iron.x < SHIRT.x + SHIRT.w && iron.y > SHIRT.y && iron.y < SHIRT.y + SHIRT.h;
    const score = () => Math.max(0, smoothed - scorches) / CREASES;

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ iron: { ...iron }, creases: creases.filter((c) => c.press < 1).map((c) => ({ x: c.x, y: c.y })), heat }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        const kx = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
        const ky = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
        const p = input.pointer;
        const before = { ...iron };
        if (kx || ky) {
          aim = null;
          const len = Math.hypot(kx, ky);
          iron.x += (kx / len) * SPEED * dt;
          iron.y += (ky / len) * SPEED * dt;
        } else {
          if (p.inside && (p.moved || p.down) && p.y > 20) aim = { x: p.x, y: p.y };
          if (aim) {
            const d = Math.hypot(aim.x - iron.x, aim.y - iron.y);
            if (d > 1) {
              const step = Math.min(d, SPEED * dt);
              iron.x += ((aim.x - iron.x) / d) * step;
              iron.y += ((aim.y - iron.y) / d) * step;
            }
          }
        }
        iron.x = clamp(iron.x, 20, W - 20);
        iron.y = clamp(iron.y, 30, H - 20);
        const moving = Math.hypot(iron.x - before.x, iron.y - before.y) > 20 * dt;
        if (onShirt() && !moving) heat += dt / HEAT_S;
        else heat = Math.max(0, heat - dt * 1.5);
        if (heat >= 1) {
          heat = 0;
          scorches++;
          marks.push({ x: iron.x, y: iron.y });
          sfx('bad');
          fl.add('Scorched!', iron.x, iron.y - 16, '#e2504a');
        }
        for (const c of creases) {
          if (c.press >= 1 || Math.hypot(c.x - iron.x, c.y - iron.y) > REACH) continue;
          c.press += dt / PRESS_S;
          if (c.press >= 1) {
            smoothed++;
            sfx('good');
            fl.add('Smooth', c.x, c.y - 12, '#5fd068');
          }
        }
        if (smoothed >= CREASES) finish(inst, score());
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        for (const m of marks) {
          cblob(g, m.x, m.y, 10, 6, '#8a5a3a');
          cblob(g, m.x, m.y, 6, 4, '#5a3a22');
        }
        for (const c of creases) if (c.press < 1) crease(g, c.x, c.y, c.len, 0.3 + 0.7 * (1 - c.press));
        // The iron: the longer it stands, the hotter it glows (orange, then red with a pulsing glow on the fabric).
        ironAt(g, Math.round(iron.x), Math.round(iron.y), t, heat);
        drawText(g, `${smoothed}/${CREASES} creases`, W / 2, H - 24, { align: 'center', color: '#f4f1e8' });
        header(g, theme?.title || 'Ironing', scorches ? `${scorches} scorched` : 'No scorch marks');
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// Drawn in the in-between style (docs/minigame-visuals/mockups/home/ironing.js).
function floor(g) {
  for (let y = 18, i = 0; y < H; y += 12, i++) {
    rect(g, 0, y, W, 12, i % 2 ? '#c09060' : '#b88858');
    rect(g, 0, y + 10, W, 2, '#a07448');
    for (let x = (i * 46) % 90; x < W; x += 90) rect(g, x, y, 2, 10, '#a07448');
  }
}

function board(g) {
  // From above: straight long edges, a pointed nose at the left, a square end with rounded corners at the right.
  const cy = 135;
  const half = 96;
  for (let x = 60; x < 420; x += 2) {
    const nose = x < 160 ? Math.sqrt((x - 60) / 100) : 1;
    const end = x > 410 ? 0.9 : 1;
    const hh = Math.round((half * nose * end) / 2) * 2;
    if (hh <= 0) continue;
    rect(g, x, cy - hh - 2, 2, hh * 2 + 4, '#5a8ab0');
    rect(g, x, cy - hh, 2, hh * 2, '#9fd3f0');
  }
  for (let y = cy - half + 8; y < cy + half - 6; y += 12) for (let x = 160 + ((y / 12) % 2) * 6; x < 404; x += 12) rect(g, x, y, 2, 2, '#c8e8f8');
}

function shirt(g) {
  // Sleeves out at the shoulders, the body below; the collar and placket down the middle.
  const W0 = '#f4f6f8';
  const SH = '#d8dce4';
  const cx = SHIRT.x + SHIRT.w / 2;
  rect(g, SHIRT.x, SHIRT.y + 8, 52, 60, W0);
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 8, 52, 60, W0);
  rect(g, SHIRT.x, SHIRT.y + 60, 52, 8, SH); // cuffs
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 60, 52, 8, SH);
  rect(g, SHIRT.x + 46, SHIRT.y + 4, SHIRT.w - 92, SHIRT.h - 4, W0);
  rect(g, SHIRT.x + 46, SHIRT.y + SHIRT.h - 4, SHIRT.w - 92, 4, SH);
  rect(g, SHIRT.x + 50, SHIRT.y + 8, 2, 60, SH); // the sleeve seams
  rect(g, SHIRT.x + SHIRT.w - 52, SHIRT.y + 8, 2, 60, SH);
  // Collar wings and the placket with its buttons, a breast pocket.
  for (let k = 0; k < 12; k += 2) {
    rect(g, cx - 22 + k, SHIRT.y + k, 20 - k, 2, '#ffffff');
    rect(g, cx + 2, SHIRT.y + k, 20 - k, 2, '#ffffff');
  }
  rect(g, cx - 22, SHIRT.y + 12, 44, 2, SH);
  rect(g, cx - 4, SHIRT.y + 14, 8, SHIRT.h - 14, '#eceef2');
  rect(g, cx - 4, SHIRT.y + 14, 2, SHIRT.h - 14, SH);
  for (let y = SHIRT.y + 24; y < SHIRT.y + SHIRT.h - 6; y += 24) rect(g, cx - 2, y, 4, 4, '#b8bcc8');
  rect(g, cx + 30, SHIRT.y + 34, 24, 26, SH);
  rect(g, cx + 32, SHIRT.y + 34, 20, 24, W0);
  rect(g, cx + 32, SHIRT.y + 38, 20, 2, SH);
}

function crease(g, x, y, len, a) {
  g.globalAlpha = a;
  for (let i = 0; i < len; i += 2) {
    const dy = [0, 2, 2, 0, -2, -2][(i / 2) % 6];
    rect(g, Math.round(x - len / 2) + i, y + dy, 2, 2, '#9aa0ac');
    rect(g, Math.round(x - len / 2) + i, y + dy + 2, 2, 2, '#ffffff');
  }
  g.globalAlpha = 1;
}

/** The iron from above: a pointed nose (left), a rounded heel, the blue body, a black handle, the soleplate's rim, steam off the nose and the cord out of the top of the handle at the heel. `heat` 0..1: cool is the approved look; warm (> 0.3) an orange soleplate and glow, hot (> 0.6) a red one with a pulsing glow on the fabric. */
function ironAt(g, x, y, t, heat) {
  const r = Math.round;
  const stage = heat > 0.6 ? 2 : heat > 0.3 ? 1 : 0;
  const rim = ['#f29c38', '#ff7a1a', '#ff3020'][stage];
  const edge = ['#1a1a22', '#b84a14', '#8a1410'][stage]; // the soleplate's outline
  if (stage) glow(g, x - 2, y - 4, stage === 2 ? 24 + r(Math.sin(t * 12) * 3) : 20, stage === 2 ? '#ff2a1a' : '#ff9a3a', stage === 2 ? 1.6 : 1.2);
  for (let k = 0; k < 16; k += 2) {
    const w = 18 + r(Math.min(k, 16 - k) * 0.4) + k;
    rect(g, r(x - 18 + (16 - k) * 0.6), y - 12 + k, w + 12, 2, edge);
  }
  for (let k = 2; k < 14; k += 2) {
    const w = 14 + k;
    rect(g, r(x - 14 + (14 - k) * 0.6), y - 12 + k, w + 12, 2, rim);
    rect(g, r(x - 12 + (14 - k) * 0.6), y - 12 + k, w + 6, 2, '#2a6ad1');
  }
  rect(g, x - 6, y - 8, 22, 4, '#3a7ad1');
  rect(g, x - 2, y - 4, 18, 4, '#1a1a22');
  rect(g, x, y - 2, 14, 2, '#3a3d48');
  // Steam puffs drifting off the nose.
  for (let k = 0; k < 3; k++) {
    const p = (t * 1.2 + k / 3) % 1;
    g.globalAlpha = 0.7 * (1 - p);
    cblob(g, x - 22 - p * 14, y - 10 - p * 20 + k * 4, 4 + r(p * 4), 4 + r(p * 3), '#ffffff');
  }
  g.globalAlpha = 1;
  // The cord leaves the top of the handle at the heel and loops up and away.
  rect(g, x + 14, y - 8, 4, 2, '#1a1a22');
  for (let k = 0; k < 44; k += 2) rect(g, x + 18 + k, y - 10 - r(k * 0.5 + Math.sin(k * 0.18) * 3), 2, 2, '#1a1a22');
}
