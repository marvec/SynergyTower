// Home brew (home office: the coffee maker): grind the beans (mash), stop the kettle just off the boil, then pour three
// cups, each stopped at the line. Every step done right is a better pot.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';
import { cblob, bake } from '../engine/mgart.js';
import { subway, counter, pottedPlant } from '../engine/mgscenery.js';

const GRINDS = 14;
const HEAT_RATE = 0.32; // of the scale per second
const HEAT_OK = [0.82, 0.94];
const POUR_RATE = 0.42;
const POUR_OK = [0.78, 0.92];
const CUPS = 3;
const STEPS = 2 + CUPS;
const MUG_X = 266; // the first mug's left edge, 52 px apart
const MUGS = ['#f4f1e8', '#7fb4ea', '#f2c14e']; // the mugs' own colours

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
    let t = 0;
    const scene = bake(W, H, (b) => {
      rect(b, 0, 0, W, H, '#dcdbd2');
      subway(b, 0, 18, W, 164);
      shelf(b);
      counter(b, 180);
      grinder(b);
      kettle(b);
      MUGS.forEach((m, i) => mug(b, MUG_X + i * 52, m));
      rect(b, 150, 36, 180, 18, '#c8b880'); // the note for the step at hand
      rect(b, 150, 36, 180, 16, '#fff4c0');
    });

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
        t += dt;
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
        g.drawImage(scene, 0, 0);
        // The grinder's drawer fills with the grounds, the kettle lets off steam, the cups fill up to the line.
        const lvl = Math.round((grind / GRINDS) * 18);
        rect(g, 68, 172 - lvl, 34, lvl, '#5a3a22');
        rect(g, 82, 160, 8, 2, '#c8a040');
        steam(g, stage === 'heat' ? 0.4 + 0.6 * Math.min(1, level) : stage === 'grind' ? 0.2 : 0.35, t);
        for (let i = 0; i < CUPS; i++) {
          const fill = i < cup ? (cups[i] ? 0.85 : 0.45) : i === cup && stage === 'pour' ? Math.min(1, level) : 0;
          mugFill(g, MUG_X + i * 52, fill);
        }
        // The gauge for the step at hand, on a little panel over the cabinets.
        if (stage === 'heat' || stage === 'pour') {
          const ok = stage === 'heat' ? HEAT_OK : POUR_OK;
          const gx = 120;
          const gy = 222;
          const gw = 240;
          rect(g, gx - 6, gy - 6, gw + 12, 22, 'rgba(40,24,12,0.55)');
          rect(g, gx - 2, gy - 2, gw + 4, 14, '#1a1a22');
          rect(g, gx, gy, gw, 10, '#f4f6f8');
          rect(g, gx + gw * ok[0], gy, gw * (ok[1] - ok[0]), 10, '#5fd068');
          rect(g, Math.round(gx + Math.min(gw, gw * level) - 2), gy - 4, 4, 18, '#e2504a');
        }
        const tip = { grind: `Grind! ${grind}/${GRINDS}`, heat: 'Stop the kettle in the green', pour: `Pour cup ${Math.min(cup + 1, CUPS)}: stop at the line`, done: 'Coffee!' }[stage];
        drawText(g, tip, W / 2, 41, { align: 'center', color: '#3a2a1a' });
        header(g, theme?.title || 'Brew coffee', `${good}/${STEPS} steps right`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// Drawn in the in-between style (docs/minigame-visuals/mockups/home/brew.js).
function shelf(g) {
  rect(g, 300, 104, 160, 4, '#8a6038');
  rect(g, 300, 108, 160, 2, '#5a3a20');
  // A coffee bag, a canister, a jar of sugar, a plant.
  rect(g, 310, 78, 24, 26, '#6a4a2a');
  rect(g, 310, 78, 24, 4, '#8a6a3a');
  rect(g, 314, 88, 16, 8, '#f2c14e');
  rect(g, 346, 84, 20, 20, '#c8ccd2');
  rect(g, 344, 82, 24, 4, '#9aa1ad');
  rect(g, 378, 86, 18, 18, '#ffffff');
  rect(g, 376, 82, 22, 4, '#e2504a');
  pottedPlant(g, 432, 104, 1);
}

function grinder(g) {
  // Wooden box with a dark top plate, a crank handle, a little glass drawer (the grounds are drawn per frame).
  rect(g, 58, 110, 54, 72, '#3a2414');
  rect(g, 60, 112, 50, 68, '#8a5a32');
  rect(g, 60, 112, 50, 4, '#a87448');
  rect(g, 104, 112, 6, 68, '#6e4529');
  rect(g, 56, 104, 58, 8, '#3a3d48');
  rect(g, 56, 104, 58, 2, '#5a5e6a');
  rect(g, 82, 92, 6, 12, '#9aa1ad');
  rect(g, 84, 88, 26, 4, '#9aa1ad');
  cblob(g, 110, 84, 5, 5, '#3a2414');
  // Beans waiting in the hopper top.
  for (const [x, y] of [[66, 100], [72, 98], [96, 100], [102, 98]]) rect(g, x, y, 4, 4, '#4a2a14');
  rect(g, 66, 150, 38, 24, '#c8dce8');
  rect(g, 68, 152, 34, 20, '#e8f4f8');
  drawText(g, 'GRIND', 85, 202, { align: 'center', color: '#3a2a1a' });
}

function kettle(g) {
  // A gooseneck kettle on its base: a round body, a lid knob, a handle, the thin spout curving out.
  rect(g, 146, 172, 68, 8, '#2a2d38');
  rect(g, 146, 172, 68, 2, '#4a4e5a');
  rect(g, 196, 174, 6, 2, '#e2504a');
  cblob(g, 180, 148, 28, 24, '#6a707c');
  cblob(g, 180, 148, 26, 22, '#d8dee6');
  cblob(g, 172, 142, 10, 12, '#f4f8fc');
  rect(g, 160, 124, 40, 4, '#9aa1ad');
  rect(g, 176, 118, 8, 6, '#1a1a22');
  rect(g, 148, 132, 6, 30, '#1a1a22');
  rect(g, 148, 132, 14, 4, '#1a1a22');
  rect(g, 148, 158, 14, 4, '#1a1a22');
  for (let k = 0; k < 14; k++) {
    const x = 206 + k * 2;
    const y = 160 - Math.round(Math.sin((k / 14) * 2.2) * 28);
    rect(g, x, y, 4, 4, '#9aa1ad');
    rect(g, x, y, 4, 2, '#d8dee6');
  }
  drawText(g, 'KETTLE', 180, 202, { align: 'center', color: '#3a2a1a' });
}

/** Steam puffs off the spout; `amount` 0..1 is how strongly (the kettle heating up). */
function steam(g, amount, t) {
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.9 + k / 3) % 1;
    g.globalAlpha = 0.8 * amount * (1 - p);
    cblob(g, 234 + Math.round(Math.sin(p * 6 + k) * 4), 126 - p * 30, 4 + Math.round(p * 4), 4, '#ffffff');
  }
  g.globalAlpha = 1;
}

function mug(g, x, col) {
  // A mug with a rim and a handle; the coffee and the red fill line are drawn per frame.
  rect(g, x - 2, 140, 38, 42, '#3a3d48');
  rect(g, x, 142, 34, 38, col);
  rect(g, x, 142, 4, 38, '#ffffff');
  rect(g, x + 34, 150, 10, 18, '#3a3d48');
  rect(g, x + 36, 154, 4, 10, '#dcdbd2');
  rect(g, x + 4, 142, 28, 6, '#3a2414');
}

function mugFill(g, x, fill) {
  const h = Math.round(fill * 30);
  if (h) rect(g, x + 4, 178 - h, 28, h, '#6b4a32');
  if (h) rect(g, x + 4, 178 - h, 28, 2, '#a07448');
  rect(g, x + 4, 178 - Math.round(((POUR_OK[0] + POUR_OK[1]) / 2) * 30), 28, 2, '#e2504a');
}
