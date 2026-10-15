// Home brew (home office: the coffee maker): grind the beans (mash), stop the kettle just off the boil, then pour three
// cups, each stopped at the line. Every step done right is a better pot.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';

const GRINDS = 14;
const HEAT_RATE = 0.32; // of the scale per second
const HEAT_OK = [0.82, 0.94];
const POUR_RATE = 0.42;
const POUR_OK = [0.78, 0.92];
const CUPS = 3;
const STEPS = 2 + CUPS;

export default {
  id: 'brew',
  name: 'Home Brew',
  help: 'Mash SPACE (or click) to grind. Press as the kettle reaches the green band. Then stop each cup at the line.',
  create({ theme, sfx = () => {} }) {
    const total = new Countdown(45);
    const fl = new Floaters();
    let stage = 'grind'; // grind -> heat -> pour (x3) -> done
    let grind = 0;
    let level = 0;
    let cup = 0;
    let good = 0;
    let pause = 0;
    const cups = [];

    const next = (ok, text) => {
      if (ok) good++;
      sfx(ok ? 'good' : 'bad');
      fl.add(text, W / 2, 70, ok ? '#5fd068' : '#e2504a');
      pause = 0.4;
      level = 0;
      if (stage === 'grind') stage = 'heat';
      else if (stage === 'heat') stage = 'pour';
      else {
        cups.push(ok);
        cup++;
        if (cup >= CUPS) stage = 'done';
      }
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ stage, level, band: stage === 'heat' ? HEAT_OK : POUR_OK, paused: pause > 0 }),
      update(dt, input) {
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / STEPS);
        if (stage === 'done') return finish(inst, good / STEPS);
        if (pause > 0) {
          pause -= dt;
          return;
        }
        const press = input.confirm() || input.pointer.clicked;
        if (stage === 'grind') {
          if (press) {
            grind++;
            sfx('type');
            if (grind >= GRINDS) next(true, 'Ground!');
          }
          return;
        }
        const ok = stage === 'heat' ? HEAT_OK : POUR_OK;
        level += (stage === 'heat' ? HEAT_RATE : POUR_RATE) * dt;
        if (press) return next(level >= ok[0] && level <= ok[1], stage === 'heat' ? (level < ok[0] ? 'Lukewarm...' : level <= ok[1] ? 'Just off the boil!' : 'Boiled!') : level < ok[0] ? 'Half a cup...' : level <= ok[1] ? 'Perfect cup!' : 'Spilled!');
        if (level > 1) next(false, stage === 'heat' ? 'Boiled over!' : 'Spilled!');
      },
      render(g) {
        rect(g, 0, 0, W, H, '#dcdbd2');
        rect(g, 0, 180, W, 90, '#b98a5a');
        rect(g, 0, 180, W, 2, '#d9a97a');
        // The grinder, the kettle and the cups on the counter.
        rect(g, 60, 110, 50, 70, '#1a1a22');
        rect(g, 63, 113, 44, 64, '#6e4529');
        rect(g, 66, 160 - Math.round((grind / GRINDS) * 40), 38, Math.round((grind / GRINDS) * 40), '#5a3a22');
        rect(g, 80, 96, 10, 14, '#9aa1ad');
        drawText(g, 'GRIND', 85, 186, { align: 'center', color: '#3a2a1a' });
        rect(g, 150, 120, 60, 60, '#1a1a22');
        rect(g, 153, 123, 54, 54, '#c8ccd4');
        rect(g, 210, 130, 14, 6, '#c8ccd4');
        if (stage === 'heat' && level > 0.6) for (let i = 0; i < 3; i++) rect(g, 170 + i * 8, 108 - ((level * 40 + i * 7) % 14), 2, 6, '#ffffff');
        drawText(g, 'KETTLE', 180, 186, { align: 'center', color: '#3a2a1a' });
        for (let i = 0; i < CUPS; i++) {
          const x = 260 + i * 50;
          const fill = i < cup ? (cups[i] ? 0.85 : 0.45) : i === cup && stage === 'pour' ? Math.min(1, level) : 0;
          rect(g, x, 140, 34, 40, '#1a1a22');
          rect(g, x + 2, 142, 30, 36, '#f4f1e8');
          rect(g, x + 2, 178 - Math.round(fill * 36), 30, Math.round(fill * 36), '#6b4a32');
          rect(g, x + 2, 178 - Math.round(((POUR_OK[0] + POUR_OK[1]) / 2) * 36), 30, 1, '#e2504a');
          rect(g, x + 34, 150, 6, 14, '#1a1a22');
        }
        // The gauge for the step at hand.
        if (stage === 'heat' || stage === 'pour') {
          const ok = stage === 'heat' ? HEAT_OK : POUR_OK;
          const gx = 120;
          const gy = 220;
          const gw = 240;
          rect(g, gx - 1, gy - 1, gw + 2, 12, '#1a1a22');
          rect(g, gx, gy, gw, 10, '#f4f6f8');
          rect(g, gx + gw * ok[0], gy, gw * (ok[1] - ok[0]), 10, '#5fd068');
          rect(g, gx + Math.min(gw, gw * level) - 1, gy - 3, 3, 16, '#e2504a');
        }
        const tip = { grind: `Grind! ${grind}/${GRINDS}`, heat: 'Stop the kettle in the green', pour: `Pour cup ${Math.min(cup + 1, CUPS)}: stop at the line`, done: 'Coffee!' }[stage];
        drawText(g, tip, W / 2, 44, { align: 'center', color: '#3a2a1a' });
        header(g, theme?.title || 'Brew coffee', `${good}/${STEPS} steps right`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
