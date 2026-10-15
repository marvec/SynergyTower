// Vacuum (home office chore): dust bunnies all over the living room floor, shuffling away when the vacuum comes near.
// Steer the vacuum over every one of them.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const ROOM = { x: 30, y: 34, w: 420, h: 206 };
const BUNNIES = 28;
const SPEED = 140;
const REACH = 14;
const SHY = 46; // bunnies shuffle away from the vacuum inside this distance
const SHUFFLE = 22;

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
        rect(g, 0, 0, W, H, '#5a3d28');
        rect(g, ROOM.x, ROOM.y, ROOM.w, ROOM.h, '#b98a5a');
        for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += 8) rect(g, ROOM.x, y, ROOM.w, 1, '#a77a4c');
        rect(g, ROOM.x + 150, ROOM.y + 60, 130, 80, '#b5653a');
        rect(g, ROOM.x + 156, ROOM.y + 66, 118, 68, '#d08a52');
        for (const b of dust) {
          const wob = Math.round(Math.sin(t * 6 + b.seed) * 1);
          rect(g, b.x - 5, b.y - 4 + wob, 10, 8, '#8a8a92');
          rect(g, b.x - 4, b.y - 5 + wob, 8, 2, '#a8a8b0');
          rect(g, b.x - 2, b.y - 1 + wob, 1, 1, '#1a1a22');
          rect(g, b.x + 1, b.y - 1 + wob, 1, 1, '#1a1a22');
        }
        // The vacuum head, its hose up to the body trailing behind.
        rect(g, vac.x - 12, vac.y - 5, 24, 10, '#1a1a22');
        rect(g, vac.x - 11, vac.y - 4, 22, 8, '#e2504a');
        rect(g, vac.x - 11, vac.y + 2, 22, 2, '#3a3d48');
        rect(g, vac.x - 1, vac.y - 16, 3, 12, '#6a707c');
        drawText(g, `${got}/${BUNNIES} dust bunnies`, W / 2, H - 22, { align: 'center', color: '#f4f1e8' });
        header(g, theme?.title || 'Vacuum', `${got}/${BUNNIES}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
