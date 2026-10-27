// Dishes (home office chore): scrub each plate clean with back-and-forth strokes, then drop it into the drying rack as
// it swings past the free slot. Miss the slot and it breaks.
// Art: the flat's kitchen in the in-between style (docs/minigame-visuals). The kitchen is baked; the foam, the rack's
// plates and the plate are small baked images that are drawn per frame (a bubble, a racked plate, the clean plate and
// each level of leftovers are baked once in create()); the spots, the free slot's arrow and the sponge are fills.
import { W, H, rect, drawText, header, timerBar, Floaters, Shake, Countdown, finish } from '../engine/mgkit.js';
import { grad, rnd, bake, blob, shaded, grains, shade } from '../engine/mgart.js';
import { subway, counter } from '../engine/mgscenery.js';

const PLATES = 6;
const STROKES = 8;
const PLATE = { x: 150, y: 120, r: 46 };
const RACK = { x: 340, y: 168 };
const SWING = 80;
const TOL = 14;
const SLOT = 12; // px between the rack's wires; the free slot is at RACK.x, five more on each side
const SLOTS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]; // racked plates fill these from the left

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
    // Never changes: the wall, window, shelf, worktop, cabinets, tea towel, basin, tap, soap and the rack's frame.
    const scene = bake(W, H, (b) => {
      wall(b);
      worktop(b);
      basin(b);
      soap(b);
      rackFrame(b);
    });
    const foam = foamBubbles();
    const art = bakeArt();
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
        g.drawImage(scene, 0, 0);
        suds(g, foam, art, t);
        rackPlates(g, art, good);
        const showPlate = phase === 'scrub' || phase === 'rack';
        if (showPlate) {
          if (phase === 'rack') drawPlate(g, art, plateX(), RACK.y - 60, 22, 0, spots);
          else {
            const dirt = 1 - strokes / STROKES;
            drawPlate(g, art, PLATE.x, PLATE.y, PLATE.r, dirt, spots);
            // The sponge, on the side of the last stroke.
            sponge(g, PLATE.x + (last === 'L' ? -24 : last === 'R' ? 24 : 0), PLATE.y + 24, t);
          }
        }
        const hint = phase === 'scrub' ? `Scrub! ${strokes}/${STROKES}` : phase === 'rack' ? 'Drop it in the gap!' : '';
        drawText(g, hint, W / 2, H - 24, { align: 'center', color: '#3a2a1a' });
        g.restore();
        header(g, theme?.title || 'Dishes', `Plate ${Math.min(plate + 1, PLATES)}/${PLATES} · ${good} racked`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// The wall: subway tiles, a window over the sink (sky, bushes, curtains, a herb pot on the sill) and a shelf with mugs.
function wall(g) {
  subway(g, 0, 18, W, 140);
  rect(g, 66, 22, 172, 66, '#e8e4dc');
  grad(g, 72, 26, 160, 56, ['#8fc8f0', '#c8e8f8']);
  shaded(g, 110, 70, 26, 18, '#4f9a4a', { rim: '#2f6a2e', light: '#7aca6a' });
  shaded(g, 196, 74, 30, 14, '#5aa44f', { rim: '#2f6a2e', light: '#8ad06a' });
  rect(g, 150, 26, 4, 56, '#e8e4dc');
  rect(g, 72, 52, 160, 3, '#e8e4dc');
  for (const [x, d] of [[66, 1], [222, -1]])
    for (let y = 20; y < 92; y++) {
      const w = 14 + Math.round(Math.sin(y * 0.3) * 1) + (y > 70 ? Math.round((y - 70) * 0.2) : 0);
      rect(g, d > 0 ? x - 4 : x + 20 - w, y, w, 1, y % 6 < 3 ? '#e2504a' : '#f4f1e8');
    }
  rect(g, 60, 88, 184, 5, '#d8d0c0');
  rect(g, 60, 88, 184, 1, '#f4f0e8');
  rect(g, 196, 76, 14, 12, '#b0603a');
  rect(g, 195, 76, 16, 2, '#c8784a');
  for (const [dx, dy] of [[-3, -6], [2, -9], [6, -5], [0, -3]]) shaded(g, 203 + dx, 76 + dy, 3, 3, '#3fae4f', { rim: '#24662e' });
  rect(g, 300, 54, 150, 4, '#8a6038');
  rect(g, 300, 58, 150, 1, '#5a3a20');
  for (const [x, c] of [[312, '#e2504a'], [336, '#f2c14e'], [360, '#3b6fb6'], [384, '#f4f1e8']]) {
    rect(g, x, 40, 14, 14, shade(c, -0.25));
    rect(g, x + 1, 40, 12, 13, c);
    rect(g, x + 1, 40, 3, 13, shade(c, 0.25));
    rect(g, x + 14, 44, 3, 6, shade(c, -0.25));
  }
}

// The worktop (stone, grained) over the cabinet doors, and a striped tea towel hanging on one of them.
function worktop(g) {
  counter(g, 176);
  rect(g, 0, 158, W, 30, '#5a5a62');
  grad(g, 0, 158, W, 30, ['#9aa0a8', '#80868e']);
  grains(g, 0, 158, W, 30, ['#6a7078', '#b4bac2', '#e8ecf0'], 600, 3);
  rect(g, 0, 158, W, 2, '#c8ccd2');
  for (let y = 204; y < 240; y++) rect(g, 262, y, 18, 1, Math.floor(y / 4) % 2 ? '#e2504a' : '#f4f1e8');
  for (let x = 262; x < 280; x += 4) rect(g, x, 204, 2, 36, 'rgba(255,255,255,0.25)');
}

// The steel basin set into the worktop, its water, and the chrome gooseneck tap at the back right.
function basin(g) {
  rect(g, 56, 148, 190, 44, '#8a9098');
  rect(g, 58, 150, 186, 40, '#c8ced6');
  rect(g, 64, 154, 174, 32, '#5a6068');
  grad(g, 64, 154, 174, 32, ['#4a5058', '#7a8088']);
  rect(g, 226, 118, 6, 32, '#8a96a6');
  rect(g, 227, 118, 3, 32, '#e8eef4');
  for (let a = 0; a <= Math.PI; a += 0.05) rect(g, Math.round(216 + Math.cos(a) * 12), Math.round(118 - Math.sin(a) * 12), 4, 4, '#b8c4d0');
  rect(g, 202, 118, 6, 6, '#8a96a6');
  shaded(g, 238, 144, 4, 3, '#d8e0e8', { rim: '#8a96a6' });
}

// A bottle of washing-up liquid on the worktop between the basin and the rack.
function soap(g) {
  rect(g, 250, 120, 16, 38, '#2a7a4a');
  rect(g, 251, 121, 14, 36, '#4ac87a');
  rect(g, 252, 121, 3, 36, '#9af0b8');
  rect(g, 252, 134, 12, 12, '#f4f1e8');
  drawText(g, 'Z', 258, 136, { align: 'center', color: '#2a7a4a' });
  rect(g, 254, 112, 8, 8, '#f4f1e8');
  rect(g, 256, 108, 10, 4, '#f4f1e8');
}

// The rack's frame: a drip tray, the wire rails and a wire between every slot, and a cutlery cup.
function rackFrame(g) {
  rect(g, RACK.x - 70, RACK.y + 6, 140, 8, '#5aa0c8');
  rect(g, RACK.x - 70, RACK.y + 6, 140, 2, '#8ac8e8');
  rect(g, RACK.x - 70, RACK.y + 13, 140, 1, '#3a7a9a');
  rect(g, RACK.x - 66, RACK.y, 132, 3, '#9aa1ad');
  rect(g, RACK.x - 66, RACK.y - 22, 132, 2, '#c8ccd2');
  for (let x = RACK.x - 66; x <= RACK.x + 66; x += SLOT) {
    rect(g, x - 1, RACK.y - 38, 2, 40, '#c8ccd2');
    rect(g, x + 1, RACK.y - 38, 1, 40, '#7a808a');
  }
  rect(g, RACK.x + 76, RACK.y - 18, 16, 24, '#5aa0c8');
  rect(g, RACK.x + 76, RACK.y - 18, 16, 2, '#8ac8e8');
  for (const [dx, h] of [[3, 16], [7, 20], [11, 14]]) rect(g, RACK.x + 76 + dx, RACK.y - 18 - h, 2, h, '#c8ccd2');
}

// The plates standing in the rack (seen edge-on at a slant, a blue rim on the near edge), `n` of them, filling the slots
// from the left, and the free slot at RACK.x marked with a green arrow.
function rackPlate(g, c, cy) {
  blob(g, c, cy, 6, 21, '#5a6070');
  blob(g, c, cy, 5, 20, '#f4f2ec');
  blob(g, c - 1, cy - 1, 3, 15, '#fbfaf6');
  for (let yy = -18; yy <= 18; yy += 3) rect(g, c + 4, cy + yy, 1, 2, '#3b6fb6');
}

function rackPlates(g, art, n) {
  for (let i = 0; i < Math.min(n, SLOTS.length); i++) g.drawImage(art.racked, RACK.x + SLOTS[i] * SLOT - 7, RACK.y - 20 - 22);
  blob(g, RACK.x, RACK.y - 20, 4, 20, 'rgba(95,208,104,0.25)');
  for (let k = 0; k < 6; k++) rect(g, RACK.x - (5 - k), RACK.y - 58 + k, (5 - k) * 2 + 1, 1, '#5fd068');
  rect(g, RACK.x - 2, RACK.y - 66, 5, 8, '#5fd068');
}

// The foam heaped over the water: [x, y, r] bubbles and a few coloured sparkles, fixed (the same suds every game).
function foamBubbles() {
  const r = rnd(8);
  return Array.from({ length: 46 }, () => [Math.round(70 + r() * 160), 158 + r() * 22, 3 + Math.floor(r() * 6)]);
}

// The suds, each bubble bobbing a pixel or so with t (a bubble is a baked image per radius).
function suds(g, foam, art, t) {
  foam.forEach(([x, y, r], i) => {
    const c = r + 4;
    g.drawImage(art.bubbles[r], x - c, Math.round(y + Math.sin(t * 2 + i)) - c);
  });
  for (let i = 0; i < 8; i++) rect(g, 74 + i * 20 + (i % 3) * 3, 156 + (i % 2) * 6, 2, 2, ['#f2c0e0', '#c0e8f8', '#e8f8c0'][i % 3]);
}

const DIRT_LEVELS = STROKES; // strokes 0..STROKES-1 leave dirt 1, 7/8 .. 1/8
const HALF = { [PLATE.r]: PLATE.r + 6, 22: 28 }; // half the size of a baked plate by radius (room for the shadow)

/** What create() bakes: a bubble per radius, a racked plate, the clean plate at both sizes, the leftovers at each dirt level, the greasy ring. */
function bakeArt() {
  const bubbles = {};
  for (let r = 3; r <= 8; r++) {
    const c = r + 4;
    bubbles[r] = bake(c * 2, c * 2, (b) => shaded(b, c, c, r, r - 1, '#f4f8fc', { rim: '#c8d4e0', light: '#ffffff' }));
  }
  const clean = {};
  for (const r of [PLATE.r, 22]) clean[r] = bake(HALF[r] * 2, HALF[r] * 2, (b) => cleanPlate(b, HALF[r], HALF[r], r));
  const h = HALF[PLATE.r];
  const dirt = Array.from({ length: DIRT_LEVELS }, (_, s) => bake(h * 2, h * 2, (b) => leftovers(b, h, h, 1 - s / STROKES)));
  const ring = bake(h * 2, h * 2, (b) => {
    for (let a = 0; a < Math.PI * 1.4; a += 0.1) rect(b, Math.round(h + Math.cos(a) * 20), Math.round(h + Math.sin(a) * 17), 2, 1, 'rgba(160,120,40,0.5)');
  });
  return { bubbles, clean, dirt, ring, racked: bake(14, 44, (b) => rackPlate(b, 7, 22)) };
}

// A round plate tilted towards you, centred at (x, y): the blue patterned rim, the well, a shadow on the right. `dirt`
// (1 dirty .. 0 clean) scales the leftovers (ketchup, egg yolk, a greasy ring) and the crumbs in `spots`. The clean plate
// and the leftovers are baked images; only the crumbs are drawn as fills.
function cleanPlate(g, x, y, r) {
  const ry = Math.round(r * 0.92);
  blob(g, x + 3, y + 4, r, ry, 'rgba(0,0,0,0.25)');
  blob(g, x, y, r + 1, ry + 1, '#5a6070');
  blob(g, x, y, r, ry, '#f4f2ec');
  blob(g, x - 2, y - 2, r - 3, ry - 3, '#fbfaf6');
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    const px = x + Math.cos(a) * (r - 6);
    const py = y + Math.sin(a) * (ry - 6);
    rect(g, Math.round(px) - 1, Math.round(py) - 1, 3, 3, '#3b6fb6');
    rect(g, Math.round(x + Math.cos(a + 0.06) * (r - 10)), Math.round(y + Math.sin(a + 0.06) * (ry - 10)), 1, 1, '#7fb4ea');
  }
  blob(g, x, y, Math.round(r * 0.62), Math.round(ry * 0.62), '#e8e4da');
  blob(g, x - 1, y - 1, Math.round(r * 0.58), Math.round(ry * 0.58), '#f2efe6');
}

function leftovers(g, x, y, k) {
  blob(g, x - 12, y - 4, Math.round(10 * k), Math.round(6 * k), '#b8302a');
  blob(g, x - 14, y - 6, Math.round(6 * k), Math.round(3 * k), '#d84a3a');
  blob(g, x + 10, y - 14, Math.round(8 * k), Math.round(7 * k), '#e8b830');
  blob(g, x + 10, y - 14, Math.round(4 * k), Math.round(3 * k), '#f8d860');
}

function drawPlate(g, art, x, y, r, dirt, spots) {
  const h = HALF[r];
  const px = Math.round(x);
  const py = Math.round(y);
  g.drawImage(art.clean[r], px - h, py - h);
  if (dirt <= 0) return;
  g.drawImage(art.dirt[Math.min(DIRT_LEVELS - 1, Math.round((1 - dirt) * STROKES))], px - h, py - h);
  for (const sp of spots) {
    const size = Math.round(sp.s * dirt);
    if (size > 1) blob(g, Math.round(px + Math.cos(sp.a) * sp.d), Math.round(py + Math.sin(sp.a) * sp.d * 0.8), Math.round(size / 2), Math.round(size / 2), '#8a6a3a');
  }
  g.drawImage(art.ring, px - h, py - h);
}

// A two-layer sponge (yellow over green) centred at (x, y), with bubbles from the scrubbing.
function sponge(g, x, y, t) {
  rect(g, x - 15, y - 9, 30, 20, '#3a3020');
  rect(g, x - 14, y - 8, 28, 10, '#f2d22e');
  rect(g, x - 14, y - 8, 28, 2, '#fff07a');
  grains(g, x - 13, y - 6, 26, 7, ['#d4b020'], 22, 3);
  rect(g, x - 14, y + 2, 28, 8, '#2f8a3a');
  grains(g, x - 14, y + 2, 28, 8, ['#4aaa4a', '#1f6a2a'], 40, 4);
  for (const [dx, dy, rr] of [[-20, -10, 4], [18, -14, 3], [24, -2, 5], [-24, 6, 3], [6, -18, 2]]) {
    const b = Math.round(Math.sin(t * 3 + dx) * 1);
    blob(g, x + dx, y + dy + b, rr + 1, rr + 1, '#9ab8d0');
    blob(g, x + dx, y + dy + b, rr, rr, '#eaf6ff');
    rect(g, x + dx - 1, y + dy + b - Math.ceil(rr / 2), 1, 1, '#ffffff');
  }
}
