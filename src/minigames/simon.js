// Server Rack Sequence: watch the LEDs blink, then repeat the sequence. It grows each round.
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, Floaters, Shake, Countdown, byDiff, finish } from '../engine/mgkit.js';

const LEDS = [
  { on: '#ff5a4a', off: '#5a1e1a' },
  { on: '#5fe070', off: '#1d4a24' },
  { on: '#5aa0ff', off: '#1a2e55' },
  { on: '#ffd84a', off: '#5a4a14' },
  { on: '#d070ff', off: '#401a55' },
  { on: '#ff9a3a', off: '#5a3210' },
];

export default {
  id: 'simon',
  name: 'Server Rack Sequence',
  help: 'Watch the lights, then repeat them with keys 1-6 or by clicking. Each round adds one more.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const n = d < 0.34 ? 4 : d < 0.67 ? 5 : 6;
    const maxLen = Math.round(byDiff(d, 5, 9));
    const rounds = maxLen - 2;
    const seq = Array.from({ length: maxLen }, () => rng.int(0, n - 1));
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

    const ledW = 34;
    const gap = 10;
    const rowW = n * ledW + (n - 1) * gap;
    const ledX = (i) => W / 2 - rowW / 2 + i * (ledW + gap);
    const ledY = 104;

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
      } else fail('Wrong light!');
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
          for (let i = 0; i < n; i++) if (input.pressedExact(String(i + 1))) return press(i);
          const p = input.pointer;
          if (p.clicked) {
            for (let i = 0; i < n; i++) {
              if (p.x >= ledX(i) && p.x < ledX(i) + ledW && p.y >= ledY && p.y < ledY + ledW) return press(i);
            }
          }
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
        // Rack cabinet.
        const rx = 110;
        const rw = 260;
        rect(g, rx - 2, 24, rw + 4, 226, C.border);
        rect(g, rx, 26, rw, 222, '#2b2e38');
        rect(g, rx + 6, 26, 2, 222, '#3d4150');
        rect(g, rx + rw - 8, 26, 2, 222, '#3d4150');
        for (let y = 32; y < 244; y += 18) {
          if (y > 86 && y < 160) continue;
          rect(g, rx + 14, y, rw - 28, 14, '#1d2028');
          rect(g, rx + 14, y, rw - 28, 1, '#454a58');
          for (let k = 0; k < 6; k++) rect(g, rx + 20 + k * 4, y + 6, 2, 2, Math.sin(anim * 7 + y + k * 3) > 0.3 ? '#5fd068' : '#1d4a24');
          rect(g, rx + rw - 44, y + 4, 24, 6, '#111');
        }
        // LED panel.
        panel(g, rx + 12, 88, rw - 24, 70, { fill: '#1a1d26', light: '#3d4150', dark: '#0d0f18' });
        for (let i = 0; i < n; i++) {
          const x = ledX(i);
          const on = lit === i && (phase === 'show' || litT > 0);
          rect(g, x - 1, ledY - 1, ledW + 2, ledW + 2, C.border);
          rect(g, x, ledY, ledW, ledW, on ? LEDS[i].on : LEDS[i].off);
          if (on) {
            rect(g, x + 3, ledY + 3, ledW - 6, 4, 'rgba(255,255,255,0.55)');
            frame(g, x - 3, ledY - 3, ledW + 6, ledW + 6, LEDS[i].on);
          }
          drawText(g, String(i + 1), x + ledW / 2, ledY + ledW + 4, { align: 'center', color: C.dim });
        }
        drawText(g, status, W / 2, 92, { align: 'center', color: phase === 'input' ? C.gold : C.text });
        // Progress + strikes.
        if (phase === 'input') {
          for (let i = 0; i < len; i++) rect(g, W / 2 - len * 4 + i * 8, 170, 6, 4, i < inputIdx ? C.good : C.panelLight);
        }
        drawText(g, 'Strikes:', 380, 230, { color: C.dim });
        for (let i = 0; i < maxStrikes; i++) drawText(g, 'X', 420 + i * 10, 230, { color: i < strikes ? C.bad : '#4a5068' });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
