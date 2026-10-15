// Ironing (home office chore): a shirt full of creases. Move the iron over each one to press it flat, but keep it
// moving: an iron left standing on the fabric heats up and scorches it.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, clamp, finish } from '../engine/mgkit.js';

const SHIRT = { x: 120, y: 50, w: 240, h: 170 };
const CREASES = 10;
const SPEED = 150;
const REACH = 12;
const PRESS_S = 0.4; // under the iron to smooth a crease
const HEAT_S = 1.6; // standing still on the fabric this long scorches it

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
    while (creases.length < CREASES) {
      const c = { x: rng.int(SHIRT.x + 20, SHIRT.x + SHIRT.w - 20), y: rng.int(SHIRT.y + 20, SHIRT.y + SHIRT.h - 20), press: 0, len: rng.int(10, 18) };
      if (creases.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 34)) creases.push(c);
    }
    const onShirt = () => iron.x > SHIRT.x && iron.x < SHIRT.x + SHIRT.w && iron.y > SHIRT.y && iron.y < SHIRT.y + SHIRT.h;
    const score = () => Math.max(0, smoothed - scorches) / CREASES;

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ iron: { ...iron }, creases: creases.filter((c) => c.press < 1).map((c) => ({ x: c.x, y: c.y })), heat }),
      update(dt, input) {
        fl.update(dt);
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
        rect(g, 0, 0, W, H, '#e8dcc8');
        // The ironing board and the shirt on it.
        rect(g, 90, 40, 360, 190, '#9fd3f0');
        rect(g, 90, 40, 360, 2, '#c8e8f8');
        rect(g, SHIRT.x, SHIRT.y, SHIRT.w, SHIRT.h, '#f4f6f8');
        rect(g, SHIRT.x + SHIRT.w / 2 - 1, SHIRT.y, 2, SHIRT.h, '#d8dce4');
        for (let y = SHIRT.y + 16; y < SHIRT.y + SHIRT.h; y += 26) rect(g, SHIRT.x + SHIRT.w / 2 + 4, y, 3, 3, '#c8ccd4');
        for (const m of marks) rect(g, m.x - 9, m.y - 6, 18, 12, '#8a5a3a');
        for (const c of creases) {
          if (c.press >= 1) continue;
          const a = 1 - c.press;
          g.globalAlpha = 0.3 + 0.7 * a;
          for (let i = 0; i < c.len; i++) rect(g, c.x - c.len / 2 + i, c.y + Math.round(Math.sin(i * 0.9) * 2), 1, 2, '#8a919d');
          g.globalAlpha = 1;
        }
        // The iron: its soleplate glows hotter the longer it stands.
        const hot = Math.min(1, heat);
        rect(g, iron.x - 14, iron.y - 8, 28, 16, '#1a1a22');
        rect(g, iron.x - 13, iron.y - 7, 26, 14, hot > 0.6 ? '#e2504a' : hot > 0.3 ? '#f29c38' : '#c8ccd4');
        rect(g, iron.x - 8, iron.y - 14, 16, 7, '#2a6ad1');
        rect(g, iron.x - 4, iron.y - 18, 8, 4, '#1a1a22');
        drawText(g, `${smoothed}/${CREASES} creases`, W / 2, H - 22, { align: 'center', color: '#5a3a22' });
        header(g, theme?.title || 'Ironing', scorches ? `${scorches} scorched` : 'No scorch marks');
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
