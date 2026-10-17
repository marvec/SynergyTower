// Smoke Break (the roof, core/roof.js): a cigarette with a colleague. Hold to draw and keep the ember in its sweet spot:
// too little and it goes out (relight it with the lighter, in the wind), too much and you cough. Flick the ash before it
// falls on your tie, and stub it out before the ember reaches the filter and your fingers. The cigarette's length is
// the clock. Score: the share of the time in the sweet spot, less a bit for every mishap.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';

const FILTER = 0.12; // the filter's share of the cigarette: the ember stops here (fingers!)
const STUB_AT = 0.06; // within this much of the filter, the flick key stubs it out
const LIMIT_S = 80; // overall time limit
const ASH_MAX = 0.09; // ash this long falls off
const RELIGHT_S = 0.9; // holding the lighter to it
const FLICK_BTN = { x: W - 96, y: H - 44, w: 84, h: 26 };
const CIG = { x: 150, y: 132, len: 250, h: 8 }; // on screen at full length

export default {
  id: 'cigarette',
  name: 'Smoke Break',
  help: 'Hold SPACE or the mouse to draw: keep the ember in the green. Too little and it goes out, too much and you cough. Flick the ash with F (or the button) and stub it out at the filter.',
  create({ difficulty = 0.3, rng, theme, sfx = () => {} }) {
    const total = new Countdown(LIMIT_S);
    const fl = new Floaters();
    const shake = new Shake();
    const width = byDiff(difficulty, 0.4, 0.24);
    const sweet = [0.6 - width / 2, 0.6 + width / 2];
    const gustPower = byDiff(difficulty, 0.25, 0.45);
    let len = 1; // what is left, filter included
    let heat = 0.55;
    let lit = true;
    let relight = 0;
    let ash = 0;
    let cough = 0;
    let drops = 0;
    let fingers = false;
    let sweetT = 0;
    let t = 0;
    let gust = 0; // heat per second while a gust blows
    let gustT = 0;
    let nextGust = rng.float(3, 6);
    const smoke = [];

    const mishap = (text, color = C.bad) => {
      drops++;
      sfx('bad');
      fl.add(text, W / 2, 96, color);
    };

    const end = () => finish(inst, clamp(sweetT / Math.max(1, t) - drops * 0.08 - (fingers ? 0.2 : 0), 0, 1));

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ heat, sweet, lit, ash, ashMax: ASH_MAX, len, filter: FILTER, stubAt: STUB_AT, cough, gust }),
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        for (const s of smoke) (s.t += dt), (s.y -= dt * 18), (s.x += dt * (6 + gust * 30));
        while (smoke.length && smoke[0].t > 2) smoke.shift();
        if (inst.done) return;
        t += dt;
        if (total.update(dt)) return end();
        const p = input.pointer;
        const onBtn = p.x >= FLICK_BTN.x && p.y >= FLICK_BTN.y && p.x < FLICK_BTN.x + FLICK_BTN.w && p.y < FLICK_BTN.y + FLICK_BTN.h;
        const draw = (input.down('Space') || input.down('Enter') || (p.down && !onBtn)) && cough <= 0;
        const flick = input.pressedExact('f') || input.pressedExact('x') || input.pressed('ArrowDown') || (p.clicked && onBtn);
        // Wind: now and then a gust fans the ember or cools it.
        nextGust -= dt;
        if (nextGust <= 0) {
          gust = (rng.chance(0.5) ? 1 : -1) * gustPower;
          gustT = rng.float(1, 2);
          nextGust = rng.float(4, 8);
        }
        if (gustT > 0 && (gustT -= dt) <= 0) gust = 0;
        cough = Math.max(0, cough - dt);
        if (flick) {
          if (lit && len - FILTER < STUB_AT) {
            sfx('good');
            fl.add('Stubbed out. Smooth.', W / 2, 96, C.good);
            return end();
          }
          if (ash > 0.005) {
            ash = 0;
            sfx('click');
          }
        }
        if (!lit) {
          // The lighter: hold to light it; a gust blows the flame out.
          relight = draw ? relight + dt : 0;
          if (gust < 0 && draw) relight = Math.max(0, relight - dt * 3);
          if (relight >= RELIGHT_S) {
            lit = true;
            heat = 0.5;
            relight = 0;
            sfx('coin');
          }
          return;
        }
        heat += (draw ? 0.55 : -0.3) * dt + gust * dt;
        if (heat >= 1) {
          mishap('*cough cough*');
          shake.hit(0.6);
          heat = 0.4;
          cough = 0.8;
        } else if (heat <= 0) {
          mishap('It went out!', C.warn);
          heat = 0;
          lit = false;
          return;
        }
        if (heat >= sweet[0] && heat <= sweet[1]) sweetT += dt;
        const burn = (0.01 + 0.014 * heat) * dt;
        len -= burn;
        ash += burn;
        if (draw && rng.chance(dt * 6)) smoke.push({ x: CIG.x + CIG.len * len, y: CIG.y - 2, t: 0 });
        if (ash > ASH_MAX) {
          mishap('Ash on your tie!', C.warn);
          ash = 0;
        }
        if (len <= FILTER) {
          fingers = true;
          len = FILTER;
          shake.hit(0.5);
          sfx('fail');
          fl.add('Ow! Your fingers!', W / 2, 96, C.bad);
          end();
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        // A rooftop at sunset behind the cigarette.
        rect(g, 0, 0, W, H, '#5a3f7a');
        rect(g, 0, 60, W, 60, '#b0587a');
        rect(g, 0, 120, W, 40, '#f29c6a');
        for (let i = 0; i < 22; i++) {
          const bw = 18 + ((i * 37) % 26);
          const bh = 30 + ((i * 53) % 70);
          rect(g, i * 24 - 10, 200 - bh, bw, bh, '#2b2a4a');
        }
        rect(g, 0, 200, W, 70, '#8a8c90');
        rect(g, 0, 200, W, 3, '#b4b2aa');
        // Smoke.
        for (const s of smoke) {
          g.globalAlpha = Math.max(0, 0.6 * (1 - s.t / 2));
          const r = 2 + Math.floor(s.t * 3);
          rect(g, Math.round(s.x - r / 2), Math.round(s.y - r / 2), r, r, '#e8ecf0');
          g.globalAlpha = 1;
        }
        // The sleeve and the hand, the filter held between two fingers.
        const SKIN = '#e0b48a';
        const SKIN_D = '#c8966a';
        rect(g, CIG.x - 70, CIG.y + 10, 34, 46, '#1a1a22');
        rect(g, CIG.x - 69, CIG.y + 11, 32, 44, '#2b3550');
        rect(g, CIG.x - 69, CIG.y + 11, 32, 3, '#f4f1e8');
        rect(g, CIG.x - 40, CIG.y + 4, 30, 24, '#1a1a22');
        rect(g, CIG.x - 39, CIG.y + 5, 28, 22, SKIN);
        rect(g, CIG.x - 39, CIG.y + 20, 28, 2, SKIN_D);
        for (const [dy, w] of [[-7, 34], [CIG.h + 1, 30]]) {
          rect(g, CIG.x - 12, CIG.y + dy - 1, w, 8, '#1a1a22');
          rect(g, CIG.x - 11, CIG.y + dy, w - 2, 6, SKIN);
          rect(g, CIG.x + w - 18, CIG.y + dy + 1, 3, 3, '#f0d0b0');
          rect(g, CIG.x - 11, CIG.y + dy + 5, w - 2, 1, SKIN_D);
        }
        // The cigarette: filter, paper, ash, ember.
        const fw = Math.round(CIG.len * FILTER);
        const pw = Math.round(CIG.len * (len - FILTER));
        rect(g, CIG.x - 1, CIG.y - 1, fw + pw + 2, CIG.h + 2, '#1a1a22');
        rect(g, CIG.x, CIG.y, fw, CIG.h, '#d98a3a');
        rect(g, CIG.x, CIG.y, fw, 2, '#f2b060');
        rect(g, CIG.x + fw, CIG.y, pw, CIG.h, '#f4f1e8');
        rect(g, CIG.x + fw, CIG.y, pw, 1, '#ffffff');
        const tip = CIG.x + fw + pw;
        const aw = Math.round(CIG.len * ash);
        if (aw > 0) rect(g, tip - aw, CIG.y, aw, CIG.h, ash > ASH_MAX * 0.75 ? '#6a707c' : '#9aa1ad');
        if (lit) {
          const ember = heat > sweet[1] ? '#ffe070' : heat >= sweet[0] ? '#ff8a3a' : '#a33b3b';
          rect(g, tip - 3, CIG.y + 1, 4, CIG.h - 2, ember);
          if (heat >= sweet[0]) rect(g, tip, CIG.y + 2, 1, CIG.h - 4, '#ffd06a');
        } else {
          rect(g, tip - 2, CIG.y + 1, 3, CIG.h - 2, '#3a3a3a');
          // The lighter.
          rect(g, tip - 6, CIG.y + 14, 12, 22, '#1a1a22');
          rect(g, tip - 5, CIG.y + 15, 10, 20, '#2a6ad1');
          if (relight > 0) {
            const fh = 4 + Math.round(relight * 6) + (Math.floor(t * 20) % 2);
            rect(g, tip - 2, CIG.y + 14 - fh, 4, fh, '#ffb030');
            rect(g, tip - 1, CIG.y + 15 - fh, 2, fh - 2, '#fff0a0');
          }
        }
        // The filter line: stub it out once the ember gets close.
        const stub = lit && len - FILTER < STUB_AT;
        if (stub && Math.floor(t * 4) % 2) drawText(g, 'Stub it out! (F)', tip, CIG.y - 18, { align: 'center', color: C.bad });
        // Wind.
        if (gust) {
          const dir = gust > 0 ? 1 : -1;
          for (let i = 0; i < 5; i++) {
            const y = 40 + i * 30;
            const x = ((t * 160 * dir + i * 97) % (W + 60) + W + 60) % (W + 60) - 30;
            rect(g, x, y, 22, 1, 'rgba(255,255,255,0.5)');
          }
          drawText(g, gust > 0 ? 'Gust: it fans the ember' : 'Gust: it cools the ember', W / 2, 186, { align: 'center', color: '#f4f1e8' });
        }
        g.restore();
        // The heat meter: out at the bottom, cough at the top, the sweet spot in green.
        const mx = 18;
        const my = 40;
        const mh = 130;
        rect(g, mx - 1, my - 1, 16, mh + 2, '#1a1a22');
        rect(g, mx, my, 14, mh, '#3a3f48');
        rect(g, mx, my + Math.round(mh * (1 - sweet[1])), 14, Math.round(mh * (sweet[1] - sweet[0])), '#2f8f4f');
        rect(g, mx, my, 14, 8, '#a33b3b');
        const hy = my + Math.round(mh * (1 - clamp(heat, 0, 1)));
        rect(g, mx - 4, hy - 1, 22, 3, lit ? '#ffd06a' : '#6a707c');
        drawText(g, 'HEAT', mx + 7, my + mh + 4, { align: 'center', color: C.text });
        // Ash gauge.
        drawText(g, 'ASH', mx + 34, my + mh + 4, { align: 'center', color: C.text });
        rect(g, mx + 27, my + mh - 40, 14, 41, '#1a1a22');
        rect(g, mx + 28, my + mh - 39 + Math.round(39 * (1 - Math.min(1, ash / ASH_MAX))), 12, Math.round(39 * Math.min(1, ash / ASH_MAX)), ash > ASH_MAX * 0.75 ? C.warn : '#9aa1ad');
        // The flick button.
        const b = FLICK_BTN;
        rect(g, b.x, b.y, b.w, b.h, C.border);
        rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, stub ? '#7a2b2b' : '#3a4058');
        drawText(g, stub ? 'STUB OUT' : 'FLICK ASH', b.x + b.w / 2, b.y + 5, { align: 'center', color: C.text });
        drawText(g, 'F', b.x + b.w / 2, b.y + 15, { align: 'center', color: C.dim });
        drawText(g, lit ? (cough > 0 ? 'Coughing...' : 'Hold to draw') : 'It went out: hold to use the lighter', W / 2, H - 40, { align: 'center', color: lit ? C.dim : C.warn });
        header(g, theme?.title || 'Smoke Break', `Sweet spot ${Math.round((sweetT / Math.max(1, t)) * 100)}%`);
        timerBar(g, len - FILTER, 1 - FILTER);
        fl.render(g);
      },
    };
    return inst;
  },
};
