// Server Rack Sequence: watch the numbered servers in the rack blink, then repeat the sequence. It grows each round.
import { W, C, rect, frame, drawText, backdrop, header, timerBar, Floaters, Shake, Countdown, byDiff, finish } from '../engine/mgkit.js';

const N = 8; // servers in the rack, numbered 1-8 from the top
const GLOW = ['#ff5a4a', '#5fe070', '#5aa0ff', '#ffd84a', '#d070ff', '#ff9a3a', '#4ae0d8', '#ff7ab8']; // each server's light
const RACK = { x: 110, y: 24, w: 260, h: 226 };
const UNIT = { x: RACK.x + 16, w: RACK.w - 32, h: 20, step: 23, top: 44 };
const unitY = (i) => UNIT.top + i * UNIT.step;

export default {
  id: 'simon',
  name: 'Server Rack Sequence',
  help: 'Watch the servers blink, then repeat them: keys 1-8, Up/Down + Space, or click a server. Each round adds one more.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const maxLen = Math.round(byDiff(d, 5, 9));
    const rounds = maxLen - 2;
    const seq = Array.from({ length: maxLen }, () => rng.int(0, N - 1));
    const flashT = byDiff(d, 0.55, 0.3);
    const gapT = flashT * 0.45;
    const maxStrikes = d < 0.5 ? 3 : 2;
    const total = new Countdown(90);
    const fl = new Floaters();
    const shake = new Shake();
    let len = 3;
    let completed = 0;
    let strikes = 0;
    let phase = 'show';
    let t = 0;
    let inputIdx = 0;
    let idle = 0;
    let lit = -1;
    let litT = 0;
    let status = 'WATCH...';
    let anim = 0;
    let cursor = 0; // the server Up/Down points at (Space/Enter pushes it)

    function startShow() {
      phase = 'show';
      t = 0;
      inputIdx = 0;
      status = 'WATCH...';
    }

    function press(i) {
      lit = i;
      litT = 0.2;
      idle = 0;
      if (seq[inputIdx] === i) {
        sfx('blip');
        inputIdx++;
        if (inputIdx >= len) {
          completed++;
          sfx('good');
          fl.add('Rack OK!', W / 2, 90, C.good);
          len++;
          if (len > maxLen) return finish(inst, 1);
          phase = 'pause';
          t = 0.7;
          status = 'NICE!';
        }
      } else fail('Wrong server!');
    }

    function fail(msg) {
      strikes++;
      sfx('bad');
      shake.hit();
      fl.add(msg, W / 2, 90, C.bad);
      if (strikes >= maxStrikes) return finish(inst, completed / rounds);
      phase = 'pause';
      t = 0.9;
      status = 'AGAIN...';
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        litT -= dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, completed / rounds);
        if (phase === 'show') {
          t += dt;
          const pause = 0.6;
          const step = flashT + gapT;
          const k = Math.floor((t - pause) / step);
          if (t >= pause && k < len) {
            const within = (t - pause) % step < flashT;
            if (within && lit !== seq[k]) sfx('blip');
            lit = within ? seq[k] : -1;
            litT = within ? 0.05 : 0;
          } else lit = -1;
          if (t >= pause + len * step) {
            phase = 'input';
            idle = 0;
            status = 'YOUR TURN';
            lit = -1;
          }
        } else if (phase === 'input') {
          idle += dt;
          for (let i = 0; i < N; i++) if (input.pressedExact(String(i + 1))) return press(i);
          if (input.pressed('ArrowUp') || input.pressed('ArrowDown')) {
            cursor = (cursor + (input.pressed('ArrowUp') ? N - 1 : 1)) % N;
            idle = 0; // walking the cursor down the rack takes a moment
            sfx('click');
          }
          if (input.confirm()) return press(cursor);
          const p = input.pointer;
          const over = unitAt(p);
          if (over >= 0 && p.moved) cursor = over;
          if (p.clicked && over >= 0) return press(over);
          if (idle > 6) fail('Timed out!');
        } else if (phase === 'pause') {
          t -= dt;
          if (t <= 0) startShow();
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#22283a', desk: '#3a3e4a' });
        header(g, theme?.title || 'Server Rack Sequence', `Round ${Math.min(completed + 1, rounds)}/${rounds}`);
        timerBar(g, total.left, total.total);
        // Rack cabinet: rails, then the eight numbered servers.
        rect(g, RACK.x - 2, RACK.y, RACK.w + 4, RACK.h, C.border);
        rect(g, RACK.x, RACK.y + 2, RACK.w, RACK.h - 4, '#2b2e38');
        rect(g, RACK.x + 6, RACK.y + 2, 2, RACK.h - 4, '#3d4150');
        rect(g, RACK.x + RACK.w - 8, RACK.y + 2, 2, RACK.h - 4, '#3d4150');
        drawText(g, status, W / 2, RACK.y + 7, { align: 'center', color: phase === 'input' ? C.gold : C.text });
        for (let i = 0; i < N; i++) drawServer(g, i, lit === i && (phase === 'show' || litT > 0));
        // The cursor last, so the server below doesn't cover its bottom edge.
        if (phase === 'input') frame(g, UNIT.x - 2, unitY(cursor) - 2, UNIT.w + 4, UNIT.h + 4, C.gold);
        // Progress + strikes.
        if (phase === 'input') {
          for (let i = 0; i < len; i++) rect(g, W / 2 - len * 4 + i * 8, unitY(N) + 3, 6, 4, i < inputIdx ? C.good : C.panelLight);
        }
        drawText(g, 'Strikes:', 380, 230, { color: C.dim });
        for (let i = 0; i < maxStrikes; i++) drawText(g, 'X', 420 + i * 10, 230, { color: i < strikes ? C.bad : '#4a5068' });
        fl.render(g);
        g.restore();
      },
    };
    function unitAt(p) {
      if (p.x < UNIT.x || p.x >= UNIT.x + UNIT.w) return -1;
      for (let i = 0; i < N; i++) if (p.y >= unitY(i) && p.y < unitY(i) + UNIT.h) return i;
      return -1;
    }

    // One 1U-style server: its number on the left, drive bays, vents and status lights. Blinking = the whole front
    // panel lights up in the server's colour.
    function drawServer(g, i, on) {
      const y = unitY(i);
      const { x, w, h } = UNIT;
      rect(g, x - 1, y - 1, w + 2, h + 2, C.border);
      rect(g, x, y, w, h, on ? '#454c60' : '#1d2028');
      rect(g, x, y, w, 1, on ? '#8a93ad' : '#454a58');
      // Number plate.
      rect(g, x + 2, y + 2, 22, h - 4, on ? GLOW[i] : '#2b2e38');
      drawText(g, String(i + 1), x + 13, y + 3, { align: 'center', scale: 2, color: on ? C.border : '#c8ccd8' });
      // Drive bays.
      for (let k = 0; k < 4; k++) {
        const bx = x + 30 + k * 22;
        rect(g, bx, y + 4, 19, h - 8, on ? '#2b3040' : '#14161d');
        rect(g, bx + 2, y + h / 2 - 1, 8, 2, on ? '#9aa3bd' : '#3d4150');
        rect(g, bx + 14, y + 6, 2, 2, on ? GLOW[i] : Math.sin(anim * 5 + i * 1.7 + k) > 0.5 ? '#5fd068' : '#1d4a24');
      }
      // Vents and status lights.
      for (let k = 0; k < 7; k++) rect(g, x + 122 + k * 5, y + 5, 2, h - 10, on ? '#2b3040' : '#111');
      for (let k = 0; k < 3; k++) rect(g, x + w - 30 + k * 8, y + h / 2 - 2, 4, 4, on ? GLOW[i] : k === 0 ? '#2e6a36' : '#2b2e38');
      if (on) {
        g.globalAlpha = 0.22;
        rect(g, x, y, w, h, GLOW[i]);
        g.globalAlpha = 1;
      }
    }

    return inst;
  },
};
