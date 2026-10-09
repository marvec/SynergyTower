// Whack-a-Bug / Whack-a-Notification: hit the targets popping out of a 3×3 grid, but spare the decoys.
import { W, H, C, rect, frame, drawText, backdrop, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';

const THEMES = {
  default: { target: 'popup', decoy: 'boss', tName: 'popups', dName: 'boss mail' },
  it: { target: 'bug', decoy: 'feature', tName: 'bugs', dName: 'features' },
  marketing: { target: 'troll', decoy: 'fan', tName: 'troll comments', dName: 'fan comments' },
  support: { target: 'ticket', decoy: 'thanks', tName: 'tickets', dName: 'thank-yous' },
};

// Numpad layout: slot index (row-major, top row first) → key label.
const SLOT_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

export default {
  id: 'whack',
  name: 'Whack-a-Bug',
  help: 'Hit targets as they pop up: numpad keys 7-9/4-6/1-3, arrows + SPACE, or click. Spare the decoys!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const th = THEMES[theme?.dept] || THEMES.default;
    const duration = byDiff(d, 25, 32);
    const total = new Countdown(duration);
    const life = byDiff(d, 1.7, 0.8);
    const interval = byDiff(d, 0.95, 0.45);
    const decoyChance = d < 0.2 ? 0 : byDiff(d, 0.1, 0.3);
    const fl = new Floaters();
    const shake = new Shake();
    const scr = { x: 120, y: 30, w: 240, h: 170 };
    const cellW = 70;
    const cellH = 46;
    const cx = (s) => scr.x + 12 + (s % 3) * (cellW + 8);
    const cy = (s) => scr.y + 20 + Math.floor(s / 3) * (cellH + 6);
    const slots = Array(9).fill(null);
    let spawnT = 0.6;
    let targets = 0;
    let hits = 0;
    let bad = 0;
    let whiffs = 0;
    let cursor = 4;
    let anim = 0;

    const currentScore = () => (targets ? clamp((hits - 0.6 * bad - 0.15 * whiffs) / targets, 0, 1) : 0);

    function whack(s) {
      const o = slots[s];
      if (!o || o.hit) {
        whiffs++;
        sfx('click');
        fl.add('miss', cx(s) + cellW / 2, cy(s) + 10, C.dim);
        return;
      }
      o.hit = true;
      o.hitT = 0.35;
      if (o.kind === 'target') {
        hits++;
        sfx('good');
        fl.add('+1', cx(s) + cellW / 2, cy(s) + 6, C.good);
      } else {
        bad++;
        sfx('bad');
        shake.hit();
        fl.add('Oops!', cx(s) + cellW / 2, cy(s) + 6, C.bad);
      }
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, currentScore());
        // Spawning.
        spawnT -= dt;
        if (spawnT <= 0 && total.left > 1) {
          spawnT = interval * rng.float(0.7, 1.3);
          const free = slots.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
          if (free.length) {
            const s = rng.pick(free);
            const kind = rng.chance(decoyChance) ? 'decoy' : 'target';
            if (kind === 'target') targets++;
            slots[s] = { kind, age: 0, life: life * rng.float(0.85, 1.15), hit: false, hitT: 0 };
          }
        }
        // Aging.
        slots.forEach((o, i) => {
          if (!o) return;
          if (o.hit) {
            o.hitT -= dt;
            if (o.hitT <= 0) slots[i] = null;
            return;
          }
          o.age += dt;
          if (o.age >= o.life) {
            if (o.kind === 'target') fl.add('escaped', cx(i) + cellW / 2, cy(i) + 10, C.warn);
            slots[i] = null;
          }
        });
        // Input.
        for (let s = 0; s < 9; s++) if (input.pressedExact(SLOT_KEYS[s])) whack(s);
        if (input.pressed('ArrowLeft') && cursor % 3 > 0) cursor--;
        if (input.pressed('ArrowRight') && cursor % 3 < 2) cursor++;
        if (input.pressed('ArrowUp') && cursor > 2) cursor -= 3;
        if (input.pressed('ArrowDown') && cursor < 6) cursor += 3;
        if (input.confirm()) whack(cursor);
        const p = input.pointer;
        if (p.clicked) {
          for (let s = 0; s < 9; s++) {
            if (p.x >= cx(s) && p.x < cx(s) + cellW && p.y >= cy(s) && p.y < cy(s) + cellH) {
              cursor = s;
              whack(s);
            }
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        header(g, theme?.title || 'Whack-a-Bug', `Hit ${hits}/${targets}`);
        timerBar(g, total.left, total.total);
        monitor(g, scr.x, scr.y, scr.w, scr.h, th.target === 'bug' ? '#12161c' : '#e9eef5');
        rect(g, scr.x, scr.y, scr.w, 12, C.accent);
        drawText(g, `Hit the ${th.tName}!`, scr.x + 4, scr.y + 2);
        for (let s = 0; s < 9; s++) {
          const x = cx(s);
          const y = cy(s);
          rect(g, x, y, cellW, cellH, th.target === 'bug' ? '#1d232c' : '#cfd6e3');
          rect(g, x, y + cellH - 10, cellW, 10, th.target === 'bug' ? '#0a0d12' : '#aab3c4');
          drawText(g, SLOT_KEYS[s], x + 3, y + 2, { color: th.target === 'bug' ? '#3a4558' : '#8a93a6' });
          const o = slots[s];
          if (o) {
            const pop = o.hit ? 1 : Math.min(1, o.age * 8, (o.life - o.age) * 8);
            const ox = x + cellW / 2 - 12;
            const oy = y + cellH - 10 - Math.round(pop * 30);
            g.save();
            g.beginPath();
            g.rect(x, y, cellW, cellH - 10);
            g.clip();
            SPRITES[o.kind === 'target' ? th.target : th.decoy](g, ox, oy, anim, o.hit);
            g.restore();
          }
          if (s === cursor) frame(g, x - 2, y - 2, cellW + 4, cellH + 4, C.gold);
        }
        drawText(g, `Spare the ${th.dName}` + (decoyChance ? '' : ' (none today)'), W / 2, 238, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};

// 24×28 sprites; `hit` draws a squashed/crossed version.
const SPRITES = {
  bug(g, x, y, t, hit) {
    if (hit) {
      rect(g, x, y + 18, 24, 6, '#2f8a3a');
      rect(g, x + 4, y + 16, 4, 2, '#5fd068');
      drawText(g, 'x_x', x + 3, y + 8, { color: '#e2504a' });
      return;
    }
    const leg = Math.floor(t * 10) % 2;
    for (let i = 0; i < 3; i++) {
      rect(g, x + 1 - leg, y + 10 + i * 5, 4, 1, '#111');
      rect(g, x + 19 + leg, y + 10 + i * 5, 4, 1, '#111');
    }
    rect(g, x + 5, y + 8, 14, 18, '#3fae4f');
    rect(g, x + 11, y + 8, 2, 18, '#1d4a24');
    rect(g, x + 7, y + 2, 10, 7, '#2b2e38');
    rect(g, x + 8, y + 4, 2, 2, '#ff5a4a');
    rect(g, x + 14, y + 4, 2, 2, '#ff5a4a');
    rect(g, x + 7, y, 1, 3, '#111');
    rect(g, x + 16, y, 1, 3, '#111');
  },
  feature(g, x, y, t, hit) {
    rect(g, x + 2, y + 6, 20, 16, hit ? '#7a5c00' : '#f2c14e');
    rect(g, x + 2, y + 6, 20, 2, '#fff6c8');
    drawText(g, 'NEW', x + 5, y + 10, { color: hit ? '#e2504a' : '#5a3e00' });
  },
  popup(g, x, y, t, hit) {
    rect(g, x, y + 4, 24, 20, hit ? '#7a2b2b' : '#e2504a');
    rect(g, x, y + 4, 24, 4, '#ff8a80');
    drawText(g, hit ? 'x' : '!', x + 12, y + 11, { align: 'center', color: '#fff', scale: 1 });
    rect(g, x + 18, y, 8, 8, '#f2c14e');
  },
  boss(g, x, y, t, hit) {
    rect(g, x, y + 6, 24, 16, hit ? '#3a3d4d' : '#3b6fb6');
    rect(g, x, y + 6, 24, 1, '#fff');
    rect(g, x + 1, y + 7, 11, 7, '#7fb4ea');
    rect(g, x + 12, y + 7, 11, 7, '#7fb4ea');
    drawText(g, 'BOSS', x + 3, y + 14, { color: '#fff' });
  },
  troll(g, x, y, t, hit) {
    rect(g, x, y + 4, 24, 16, hit ? '#5a2a2a' : '#c74634');
    rect(g, x + 4, y + 20, 5, 4, hit ? '#5a2a2a' : '#c74634');
    drawText(g, hit ? '...' : '!!1', x + 12, y + 8, { align: 'center', color: '#fff' });
  },
  fan(g, x, y, t, hit) {
    rect(g, x, y + 4, 24, 16, hit ? '#3a3d4d' : '#e8f0ff');
    rect(g, x + 4, y + 20, 5, 4, hit ? '#3a3d4d' : '#e8f0ff');
    rect(g, x + 7, y + 8, 4, 4, '#e2504a');
    rect(g, x + 13, y + 8, 4, 4, '#e2504a');
    rect(g, x + 8, y + 12, 8, 3, '#e2504a');
    rect(g, x + 10, y + 15, 4, 2, '#e2504a');
  },
  ticket(g, x, y, t, hit) {
    rect(g, x, y + 6, 24, 16, hit ? '#7a5c30' : '#f29c38');
    rect(g, x - 1, y + 12, 3, 4, '#e9eef5');
    rect(g, x + 22, y + 12, 3, 4, '#e9eef5');
    drawText(g, hit ? 'OK' : '#?', x + 12, y + 10, { align: 'center', color: '#2a2a35' });
  },
  thanks(g, x, y, t, hit) {
    rect(g, x, y + 6, 24, 16, hit ? '#3a3d4d' : '#5fd068');
    drawText(g, 'thx', x + 12, y + 10, { align: 'center', color: '#103a18' });
  },
};
