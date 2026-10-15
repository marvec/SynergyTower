// Dishes (home office chore): scrub each plate clean with back-and-forth strokes, then drop it into the drying rack as
// it swings past the free slot. Miss the slot and it breaks.
import { W, H, rect, drawText, header, timerBar, Floaters, Shake, Countdown, finish } from '../engine/mgkit.js';

const PLATES = 6;
const STROKES = 8;
const PLATE = { x: 150, y: 120, r: 46 };
const RACK = { x: 340, y: 150 };
const SWING = 80;
const TOL = 14;

export default {
  id: 'dishes',
  name: 'Squeaky Clean',
  help: 'Scrub: LEFT, RIGHT, LEFT, RIGHT (or drag the mouse across the plate). Then press SPACE or click as it swings over the gap in the rack.',
  create({ rng, theme, sfx = () => {} }) {
    const total = new Countdown(60);
    const fl = new Floaters();
    const shake = new Shake();
    let plate = 0;
    let phase = 'scrub'; // scrub -> rack (swinging over the rack) -> next plate
    let strokes = 0;
    let last = null; // the last stroke's side: 'L' | 'R'
    let swingT = 0;
    let good = 0;
    let wait = 0;
    let t = 0;
    const grime = () => Array.from({ length: 5 }, () => ({ a: rng.float(0, Math.PI * 2), d: rng.float(8, 34), s: rng.int(4, 8) }));
    let spots = grime();
    const speed = () => 2 + plate * 0.25;
    const plateX = () => RACK.x + Math.sin(swingT * speed()) * SWING;

    const stroke = (side) => {
      if (side === last) return;
      last = side;
      strokes++;
      sfx('type');
      if (strokes >= STROKES) {
        phase = 'rack';
        swingT = rng.float(0, 2);
        fl.add('Sparkling!', PLATE.x, PLATE.y - 50, '#bfe4f2');
      }
    };
    const drop = () => {
      const ok = Math.abs(plateX() - RACK.x) <= TOL;
      if (ok) {
        good++;
        sfx('good');
        fl.add('Clink!', RACK.x, RACK.y - 40, '#5fd068');
      } else {
        sfx('bad');
        shake.hit();
        fl.add('CRASH!', plateX(), RACK.y - 40, '#e2504a');
      }
      plate++;
      wait = 0.35;
      phase = 'next';
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ phase, plateX: plateX(), target: RACK.x, tol: TOL, last }),
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        t += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / PLATES);
        const p = input.pointer;
        if (phase === 'scrub') {
          if (input.pressed('ArrowLeft')) stroke('L');
          else if (input.pressed('ArrowRight')) stroke('R');
          else if (p.inside && p.moved && Math.abs(p.y - PLATE.y) < PLATE.r && Math.abs(p.x - PLATE.x) < PLATE.r + 20) stroke(p.x < PLATE.x ? 'L' : 'R');
        } else if (phase === 'rack') {
          swingT += dt;
          if (input.confirm() || p.clicked) drop();
        } else {
          wait -= dt;
          if (wait <= 0) {
            if (plate >= PLATES) return finish(inst, good / PLATES);
            phase = 'scrub';
            strokes = 0;
            last = null;
            spots = grime();
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, H, '#dcdbd2');
        for (let x = 0; x < W; x += 20) for (let y = 20; y < H; y += 20) rect(g, x, y, 19, 19, (x + y) % 40 ? '#e8e6e0' : '#d4d2c8');
        // The sink and its suds.
        rect(g, 70, 70, 160, 110, '#1a1a22');
        rect(g, 74, 74, 152, 102, '#8aa8bc');
        for (let i = 0; i < 9; i++) rect(g, 80 + i * 16, 160 + Math.round(Math.sin(t * 2 + i) * 2), 12, 8, '#f4f6f8');
        // The drying rack with its free slot.
        rect(g, RACK.x - 70, RACK.y, 140, 6, '#9aa1ad');
        for (let x = RACK.x - 66; x <= RACK.x + 66; x += 12) rect(g, x, RACK.y - 30, 2, 30, '#9aa1ad');
        for (let i = 0; i < good; i++) rect(g, RACK.x - 62 + (i % 5) * 12, RACK.y - 26, 3, 24, '#f4f1e8');
        rect(g, RACK.x - 9, RACK.y - 34, 18, 3, '#5fd068');
        const showPlate = phase === 'scrub' || phase === 'rack';
        if (showPlate) {
          const cx = phase === 'rack' ? plateX() : PLATE.x;
          const cy = phase === 'rack' ? RACK.y - 60 : PLATE.y;
          const r = phase === 'rack' ? 22 : PLATE.r;
          rect(g, cx - r, cy - r * 0.9, r * 2, r * 1.8, '#1a1a22');
          rect(g, cx - r + 2, cy - r * 0.9 + 2, r * 2 - 4, r * 1.8 - 4, '#f4f1e8');
          rect(g, cx - r * 0.6, cy - r * 0.55, r * 1.2, r * 1.1, '#e8e2d4');
          if (phase === 'scrub') {
            const dirt = 1 - strokes / STROKES;
            for (const sp of spots) {
              const size = Math.round(sp.s * dirt);
              if (size > 0) rect(g, cx + Math.cos(sp.a) * sp.d - size / 2, cy + Math.sin(sp.a) * sp.d * 0.8 - size / 2, size, size, '#8a6a3a');
            }
            // The sponge, on the side of the last stroke.
            const sx = cx + (last === 'L' ? -24 : last === 'R' ? 24 : 0);
            rect(g, sx - 9, cy - 6, 18, 12, '#1a1a22');
            rect(g, sx - 8, cy - 5, 16, 5, '#f2d22e');
            rect(g, sx - 8, cy, 16, 5, '#2fa39a');
          }
        }
        const hint = phase === 'scrub' ? `Scrub! ${strokes}/${STROKES}` : phase === 'rack' ? 'Drop it in the gap!' : '';
        drawText(g, hint, W / 2, H - 24, { align: 'center', color: '#3a3d48' });
        g.restore();
        header(g, theme?.title || 'Dishes', `Plate ${Math.min(plate + 1, PLATES)}/${PLATES} · ${good} racked`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
