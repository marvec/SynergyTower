// Vacuum (home office chore): dust bunnies all over the living room floor, shuffling away when the vacuum comes near.
// Steer the vacuum over every one of them.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';
import { cblob, bake } from '../engine/mgart.js';

const ROOM = { x: 30, y: 34, w: 420, h: 206 };
const BUNNIES = 28;
const SPEED = 140;
const REACH = 14;
const SHY = 46; // bunnies shuffle away from the vacuum inside this distance
const SHUFFLE = 22;
const BUNNY_BOX = 20; // a baked dust bunny's square, its centre in the middle

export default {
  id: 'vacuum',
  name: 'Dust Buster',
  help: 'Steer the vacuum with the arrow keys or the mouse and suck up every dust bunny. They shuffle away when you get close.',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(45);
    const fl = new Floaters();
    const vac = { x: ROOM.x + 24, y: ROOM.y + ROOM.h - 24 };
    let aim = null; // the mouse's spot, while it steers
    const dust = [];
    while (dust.length < BUNNIES) {
      const b = { x: rng.int(ROOM.x + 12, ROOM.x + ROOM.w - 12), y: rng.int(ROOM.y + 12, ROOM.y + ROOM.h - 12), seed: rng.int(0, 99) };
      if (Math.hypot(b.x - vac.x, b.y - vac.y) > 70 && dust.every((o) => Math.hypot(o.x - b.x, o.y - b.y) > 18)) dust.push(b);
    }
    let got = 0;
    let t = 0;
    // A dust bunny is baked in its three wobble heights (a pixel up, level, a pixel down) and drawn per bunny.
    const bunnies = [-1, 0, 1].map((dy) => bake(BUNNY_BOX, BUNNY_BOX, (b) => bunny(b, BUNNY_BOX / 2, BUNNY_BOX / 2 + dy)));
    const scene = bake(W, H, (b) => {
      room(b);
      rect(b, 0, H - 26, W, 12, 'rgba(30,20,14,0.6)'); // under the hint
    });

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ vac: { ...vac }, dust: dust.map((b) => ({ x: b.x, y: b.y })) }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, got / BUNNIES);
        const kx = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
        const ky = (input.down('ArrowDown') ? 1 : 0) - (input.down('ArrowUp') ? 1 : 0);
        const p = input.pointer;
        if (kx || ky) {
          aim = null;
          const len = Math.hypot(kx, ky);
          vac.x += (kx / len) * SPEED * dt;
          vac.y += (ky / len) * SPEED * dt;
        } else {
          if (p.inside && (p.moved || p.down) && p.y > 20) aim = { x: p.x, y: p.y };
          if (aim) {
            const dx = aim.x - vac.x;
            const dy = aim.y - vac.y;
            const d = Math.hypot(dx, dy);
            if (d > 2) {
              const step = Math.min(d, SPEED * dt);
              vac.x += (dx / d) * step;
              vac.y += (dy / d) * step;
            }
          }
        }
        vac.x = clamp(vac.x, ROOM.x + 8, ROOM.x + ROOM.w - 8);
        vac.y = clamp(vac.y, ROOM.y + 8, ROOM.y + ROOM.h - 8);
        for (let i = dust.length - 1; i >= 0; i--) {
          const b = dust[i];
          const d = Math.hypot(b.x - vac.x, b.y - vac.y);
          if (d < REACH) {
            dust.splice(i, 1);
            got++;
            sfx('blip');
            fl.add(got % 7 ? '+1' : 'Slurp!', b.x, b.y - 8, '#f2c14e');
          } else if (d < SHY) {
            b.x = clamp(b.x + ((b.x - vac.x) / d) * SHUFFLE * dt, ROOM.x + 6, ROOM.x + ROOM.w - 6);
            b.y = clamp(b.y + ((b.y - vac.y) / d) * SHUFFLE * dt, ROOM.y + 6, ROOM.y + ROOM.h - 6);
          }
        }
        if (got >= BUNNIES) finish(inst, 1);
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        for (const b of dust) g.drawImage(bunnies[Math.round(Math.sin(t * 6 + b.seed)) + 1], Math.round(b.x) - BUNNY_BOX / 2, Math.round(b.y) - BUNNY_BOX / 2);
        vacuum(g, vac.x, vac.y);
        drawText(g, `${got}/${BUNNIES} dust bunnies`, W / 2, H - 24, { align: 'center', color: '#f4f1e8' });
        header(g, theme?.title || 'Vacuum', `${got}/${BUNNIES}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

/** The living room from above: planks, a patterned rug, the walls' tops with the furniture standing on them (all outside ROOM). */
function room(g) {
  rect(g, 0, 18, W, H - 18, '#4a3428');
  // The walls' tops around the room, a skirting line inside.
  rect(g, ROOM.x - 8, ROOM.y - 8, ROOM.w + 16, ROOM.h + 16, '#e8dcc8');
  rect(g, ROOM.x - 8, ROOM.y - 8, ROOM.w + 16, 2, '#f8f0e0');
  // Planks: two tones, a joint line every board, staggered butt joints.
  for (let y = ROOM.y, i = 0; y < ROOM.y + ROOM.h; y += 10, i++) {
    rect(g, ROOM.x, y, ROOM.w, 10, i % 2 ? '#c09060' : '#b88858');
    rect(g, ROOM.x, y + 8, ROOM.w, 2, '#a07448');
    for (let x = ROOM.x + ((i * 46) % 90); x < ROOM.x + ROOM.w; x += 90) rect(g, x, y, 2, 8, '#a07448');
  }
  rect(g, ROOM.x, ROOM.y, ROOM.w, 4, '#8a6040'); // the wall's shadow on the floor
  // The rug: a border, then a row of diamonds.
  const rx = ROOM.x + 150;
  const ry = ROOM.y + 60;
  rect(g, rx, ry, 130, 80, '#8a3a2a');
  rect(g, rx + 4, ry + 4, 122, 72, '#d08a52');
  rect(g, rx + 8, ry + 8, 114, 64, '#b5653a');
  rect(g, rx + 12, ry + 12, 106, 56, '#e8b878');
  for (let k = 0; k < 5; k++) {
    const cx = rx + 25 + k * 20;
    for (let d = 0; d < 8; d += 2) {
      rect(g, cx - d, ry + 32 + d, d * 2 + 2, 2, '#8a3a2a');
      rect(g, cx - d, ry + 46 - d, d * 2 + 2, 2, '#8a3a2a');
    }
  }
  for (let x = rx; x < rx + 130; x += 6) {
    rect(g, x, ry - 4, 2, 4, '#e8dcc8');
    rect(g, x, ry + 80, 2, 4, '#e8dcc8');
  }
  // Furniture standing on the wall tops, just reaching into the room: sofa, plant, TV bench, armchair.
  rect(g, 120, 20, 120, 20, '#3a6a8a');
  rect(g, 124, 30, 112, 14, '#4a7a9a');
  for (let k = 0; k < 3; k++) rect(g, 128 + k * 36, 32, 32, 10, '#5a8aaa');
  cblob(g, 38, 40, 10, 10, '#b0603a');
  cblob(g, 38, 38, 8, 8, '#2f8a3a');
  cblob(g, 36, 36, 4, 4, '#4fba5a');
  rect(g, 300, 22, 90, 16, '#5a4030');
  rect(g, 312, 18, 66, 8, '#1a1a22');
  rect(g, 314, 20, 62, 4, '#3a4a6a');
  rect(g, 444, 160, 26, 40, '#7a4a3a');
  rect(g, 448, 166, 18, 28, '#9a6a4a');
}

/** A dust bunny centred at (x, yy): a fluffy grey ball with a lumpy outline, a light top, two feet and eyes (baked at 3 heights). */
function bunny(g, x, yy) {
  cblob(g, x, yy + 1, 8, 7, '#5a5a62');
  cblob(g, x, yy, 7, 6, '#8a8a92');
  cblob(g, x - 2, yy - 2, 4, 3, '#b0b0b8');
  for (const dx of [-8, 6, -4]) rect(g, x + dx, yy - 6 + (dx & 2), 2, 2, '#8a8a92');
  rect(g, x - 4, yy + 6, 2, 2, '#4a4a52');
  rect(g, x + 2, yy + 6, 2, 2, '#4a4a52');
  rect(g, x - 4, yy - 2, 2, 2, '#ffffff');
  rect(g, x + 2, yy - 2, 2, 2, '#ffffff');
  rect(g, x - 4, yy - 2, 2, 1, '#1a1a22');
  rect(g, x + 2, yy - 2, 2, 1, '#1a1a22');
}

/** A cordless stick vacuum: the brush head on the floor at (x, y), the stick rising to the motor with its clear dust cup, the handle and the battery pack. Nothing trails behind it. */
function vacuum(g, x, y) {
  for (let k = 0; k < 13; k++) {
    rect(g, x + 2 + k * 2, y - 8 - k * 2, 4, 4, '#3a3d48');
    rect(g, x + 2 + k * 2, y - 8 - k * 2, 2, 2, '#c8ccd2');
  }
  const mx = x + 30;
  const my = y - 34;
  cblob(g, mx, my, 10, 8, '#1a1a22');
  cblob(g, mx, my, 8, 6, '#9ad0e0');
  rect(g, mx - 4, my, 8, 4, '#8a8a90'); // dust in the cup
  rect(g, mx + 6, my - 10, 10, 8, '#1a1a22');
  rect(g, mx + 8, my - 8, 6, 4, '#e2504a'); // motor
  rect(g, mx + 14, my - 18, 4, 12, '#1a1a22'); // handle
  rect(g, mx + 16, my - 20, 8, 4, '#1a1a22');
  rect(g, mx + 8, my - 14, 6, 4, '#3a3d48'); // battery
  rect(g, mx + 9, my - 13, 2, 2, '#5fd068');
  // The brush head: a red shell, bristles at the front, a swivel neck.
  rect(g, x - 14, y - 6, 28, 12, '#1a1a22');
  rect(g, x - 12, y - 6, 24, 8, '#e2504a');
  rect(g, x - 12, y - 6, 24, 2, '#ff7a6a');
  for (let k = -12; k < 12; k += 4) rect(g, k + x, y + 2, 2, 4, '#f2c14e');
  rect(g, x - 2, y - 10, 6, 4, '#3a3d48');
}
