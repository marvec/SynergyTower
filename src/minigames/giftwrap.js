// Gift Wrapping (Christmas party, the Secret Santa table): three gifts; for each, cut the paper at the mark, tape the seam
// in the green band and tie the bow as the ring closes. Nine timed presses (SPACE or a click); going past the band misses.
import { W, H, rect, drawText, header, timerBar, Floaters, Countdown, byDiff, finish } from '../engine/mgkit.js';
import { isTouch } from '../engine/platform.js';
import { cblob, bake, shade } from '../engine/mgart.js';
import { stringWire, stringBulbs, xmasTreeBody, xmasTreeBaubles } from '../engine/mgscenery.js';

const STEPS = ['cut', 'tape', 'bow'];
const RATE = { cut: 0.42, tape: 0.55, bow: 0.5 }; // of the gauge per second
const GIFTS = 3;
const PAPERS = ['#d8343a', '#2f8a3a', '#3a5fb6', '#b6973b', '#7a3bb6'];
const RIBBONS = ['#f2e14e', '#f4f1e8', '#f29cd0', '#e2504a'];
const TIPS = { cut: 'Cut the paper at the mark', tape: 'Tape the seam in the green band', bow: 'Tie the bow as the ring closes' };

export default {
  id: 'giftwrap',
  name: 'Gift Wrapping',
  help: 'Secret Santa! Press SPACE (or click) to cut the paper at the mark, tape the seam in the band and tie the bow as the ring closes.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const total = new Countdown(60);
    const fl = new Floaters();
    const gifts = Array.from({ length: GIFTS }, () => ({
      paper: rng.pick(PAPERS),
      ribbon: rng.pick(RIBBONS),
      w: rng.int(60, 90),
      h: rng.int(40, 56),
      bands: STEPS.map(() => {
        const w = byDiff(d, 0.16, 0.09);
        const a = rng.float(0.45, 0.85 - w);
        return [a, a + w];
      }),
      ok: [],
    }));
    let gi = 0;
    let si = 0;
    let level = 0;
    let pause = 0;
    let good = 0;
    // The hall, the window, the tree, the table and its tools never change; the gifts' paper is baked once each.
    let t = 0;
    const scene = bake(W, H, (b) => {
      hall(b);
      xmasTreeBody(b, TREE.x, TREE.base, TREE.h);
      table(b);
      tools(b);
    });
    const gauge = bake(GAUGE.w + 40, 18, (b) => tapeStrip(b));
    for (const gf of gifts) {
      gf.kraft = bake(gf.w + 4, gf.h + 2, (b) => giftBody(b, 2, 2, gf.w, gf.h, null));
      gf.papered = bake(gf.w + 4, gf.h + 2, (b) => giftBody(b, 2, 2, gf.w, gf.h, gf.paper));
    }
    const stage = () => (gi >= GIFTS ? 'done' : STEPS[si]);
    const band = () => (gi >= GIFTS ? [0, 0] : gifts[gi].bands[si]);

    const next = (ok, text) => {
      gifts[gi].ok.push(ok);
      if (ok) good++;
      sfx(ok ? 'good' : 'bad');
      fl.add(text, W / 2, 70, ok ? '#5fd068' : '#e2504a');
      level = 0;
      pause = 0.45;
      si++;
      if (si >= STEPS.length) {
        si = 0;
        gi++;
      }
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ stage: stage(), level, band: band(), paused: pause > 0 }),
      update(dt, input) {
        t += dt;
        fl.update(dt);
        if (inst.done) return;
        if (total.update(dt) || gi >= GIFTS) return finish(inst, good / (GIFTS * STEPS.length));
        if (pause > 0) {
          pause -= dt;
          return;
        }
        const st = stage();
        const [a, b] = band();
        level += RATE[st] * dt;
        if (input.confirm() || input.pointer.clicked) {
          const ok = level >= a && level <= b;
          return next(ok, ok ? { cut: 'Clean cut!', tape: 'Neat!', bow: 'Lovely bow!' }[st] : level < a ? 'Too soon!' : 'Too late!');
        }
        if (level > 1) next(false, { cut: 'Paper everywhere!', tape: 'Tangled!', bow: 'Knotted!' }[st]);
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        // The window's snow (it drifts by 2 px twice a second), the garland's bulbs and the tree's baubles twinkle.
        for (const [x, y] of FLAKES) rect(g, x, y + (Math.floor(t * 2) % 2) * 2, 2, 2, '#f4f1e8');
        stringBulbs(g, 24, t);
        xmasTreeBaubles(g, TREE.x, TREE.base, TREE.h, t);
        // Wrapped gifts so far, on the left; the one on the table in the middle.
        gifts.forEach((gf, i) => {
          if (i >= gi) return;
          const nice = gf.ok.filter(Boolean).length;
          wrapped(g, 30 + i * 46, 170 - 30, 40, 30, nice >= 2 ? gf.paper : '#8a7a6a', gf.ribbon, nice === 3);
        });
        if (gi < GIFTS) {
          const gf = gifts[gi];
          const x = W / 2 - gf.w / 2;
          const y = 168 - gf.h;
          g.drawImage(si > 0 ? gf.papered : gf.kraft, x - 2, y - 2);
          // The seam where the paper overlaps, waiting for tape.
          if (si > 0) {
            rect(g, x + gf.w / 2 - 1, y, 2, gf.h, shade(gf.paper, -0.3));
            rect(g, x + gf.w / 2 + 1, y, 6, gf.h, shade(gf.paper, 0.2));
          }
          if (si > 1) rect(g, x + gf.w / 2 - 2, y, 4, gf.h, gf.ribbon);
          if (si > 1) rect(g, x, y + gf.h / 2 - 2, gf.w, 4, gf.ribbon);
          const st = stage();
          const [a, b] = band();
          if (st === 'bow') {
            // The closing ring: the band is where the bow sits snug.
            const r = Math.round((1 - level) * 40) + 4;
            const ra = Math.round((1 - b) * 40) + 4;
            const rb = Math.round((1 - a) * 40) + 4;
            const cx = W / 2;
            const cy = y - 30;
            for (let k = 0; k < 24; k++) {
              const ang = (k / 24) * Math.PI * 2;
              rect(g, Math.round(cx + Math.cos(ang) * rb) - 1, Math.round(cy + Math.sin(ang) * rb) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * ra) - 1, Math.round(cy + Math.sin(ang) * ra) - 1, 2, 2, '#5fd068');
              rect(g, Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy + Math.sin(ang) * r) - 1, 3, 3, gf.ribbon);
            }
          } else {
            // The gauge is a strip of tape off its roll: the green band where the seam sits, the red mark moving along it.
            const { x: gx, y: gy, w: gw } = GAUGE;
            g.drawImage(gauge, gx - 20, gy - 4);
            rect(g, Math.round(gx + gw * a), gy, Math.round(gw * (b - a)), 10, '#5fd068');
            rect(g, Math.round(gx + gw * a), gy, Math.round(gw * (b - a)), 2, '#9af0a0');
            const mx = Math.round(gx + Math.min(gw, gw * level));
            rect(g, mx - 2, gy - 4, 4, 18, '#e2504a');
            rect(g, mx - 4, gy - 6, 8, 2, '#e2504a');
          }
          drawText(g, TIPS[st], W / 2, 44, { align: 'center', color: '#f4f1e8', shadow: '#1a1426' });
        }
        drawText(g, isTouch() ? 'Tap at the right moment' : 'SPACE at the right moment', W / 2, 256, { align: 'center', color: '#f4e0c8' });
        header(g, theme?.title || 'Gift Wrapping', `Gift ${Math.min(gi + 1, GIFTS)}/${GIFTS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

// The art (docs/minigame-visuals/mockups/party/giftwrap.js): the Secret Santa table in the party hall.
const GAUGE = { x: 120, y: 214, w: 240 };
const TREE = { x: 456, base: 166, h: 110 };
const FLAKES = [[40, 58], [62, 70], [84, 60], [50, 84], [76, 92], [88, 80]];

/** The hall wall down to the table (y 18-170): two flat bands, a dado, the garland's wire, a window and the floor under the table. */
function hall(g) {
  rect(g, 0, 18, W, 152, '#2a2038');
  for (let x = 0; x < W; x += 24) rect(g, x, 18, 12, 152, '#2e2440');
  rect(g, 0, 166, W, 4, '#1a1426');
  stringWire(g, 24);
  rect(g, 28, 46, 70, 60, '#1a1426');
  rect(g, 32, 50, 62, 52, '#2a3a6a');
  rect(g, 32, 96, 62, 6, '#f4f1e8');
  rect(g, 62, 50, 2, 52, '#1a1426');
}

/** The red tablecloth with a white hem over the table top (y 166), its front falling to the floor. */
function table(g) {
  rect(g, 0, 196, W, H - 196, '#3a2a22');
  rect(g, 0, 166, W, 8, '#e2504a');
  rect(g, 0, 166, W, 2, '#f06a64');
  rect(g, 0, 174, W, 30, '#c8343a');
  for (let x = 0; x < W; x += 40) rect(g, x + 18, 174, 4, 30, '#b02a30');
  rect(g, 0, 204, W, 4, '#f4f1e8');
  for (let x = 0; x < W; x += 8) rect(g, x, 208, 4, 2, '#f4f1e8');
}

function paperRoll(g, x, y, len, col, alt) {
  rect(g, x, y, len, 12, col);
  for (let k = 4; k < len; k += 10) rect(g, x + k, y + 2, 4, 4, alt);
  rect(g, x, y, len, 2, shade(col, 0.3));
  rect(g, x, y + 10, len, 2, shade(col, -0.3));
  cblob(g, x + len, y + 6, 4, 6, '#c8a878');
  cblob(g, x + len, y + 6, 2, 2, '#8a6a4a');
}

/** Paper rolls, a tape dispenser, scissors and a spool of ribbon on the right of the table. */
function tools(g) {
  paperRoll(g, 336, 150, 60, '#2f8a3a', '#f4f1e8');
  paperRoll(g, 348, 138, 52, '#3a5fb6', '#f2e14e');
  rect(g, 404, 152, 26, 14, '#3a3f55');
  rect(g, 404, 152, 26, 2, '#5a607a');
  cblob(g, 414, 152, 8, 8, '#d8dee6');
  cblob(g, 414, 152, 4, 4, '#3a3f55');
  rect(g, 426, 148, 6, 4, '#9aa1ad');
  for (let k = 0; k < 14; k += 2) {
    rect(g, 300 + k, 160 - k / 2, 2, 2, '#9aa1ad');
    rect(g, 300 + k, 154 + k / 2, 2, 2, '#9aa1ad');
  }
  cblob(g, 296, 152, 4, 4, '#e2504a');
  cblob(g, 296, 162, 4, 4, '#e2504a');
  cblob(g, 318, 160, 8, 6, '#f29cd0');
  cblob(g, 318, 160, 2, 2, '#b06a90');
}

/** A gift at x, y (w by h): kraft paper when `paper` is null, else patterned paper with dots and a light top edge. */
function giftBody(g, x, y, w, h, paper) {
  rect(g, x - 2, y - 2, w + 4, h + 2, '#1a1a22');
  if (!paper) {
    rect(g, x, y, w, h, '#c8a878');
    rect(g, x, y, w, 2, '#dcc090');
    rect(g, x, y + h - 2, w, 2, '#a88a5a');
    return;
  }
  rect(g, x, y, w, h, paper);
  for (let yy = y + 4; yy < y + h - 2; yy += 10) for (let xx = x + 10; xx < x + w - 4; xx += 12) rect(g, xx, yy, 4, 4, '#f4f1e8');
  rect(g, x, y, w, 2, shade(paper, 0.3));
}

/** A finished gift with a ribbon cross, and a bow when the wrapping was neat. */
function wrapped(g, x, y, w, h, paper, ribbon, bow) {
  rect(g, x - 2, y - 2, w + 4, h + 2, '#1a1a22');
  rect(g, x, y, w, h, paper);
  for (let yy = y + 4; yy < y + h - 2; yy += 8) for (let xx = x + ((yy - y) % 16 === 4 ? 2 : 6); xx < x + w - 2; xx += 10) rect(g, xx, yy, 2, 2, shade(paper, 0.3));
  rect(g, x, y, w, 2, shade(paper, 0.3));
  rect(g, x + w / 2 - 2, y, 4, h, ribbon);
  rect(g, x, y + h / 2 - 2, w, 4, ribbon);
  if (bow) {
    cblob(g, x + w / 2 - 6, y - 4, 6, 4, ribbon);
    cblob(g, x + w / 2 + 6, y - 4, 6, 4, ribbon);
    rect(g, x + w / 2 - 2, y - 6, 4, 4, '#1a1a22');
  }
}

/** The tape strip on its roll, in a baked 280 x 18 image drawn 20 px left of the gauge and 4 above it. */
function tapeStrip(g) {
  const gx = 20;
  const gy = 4;
  rect(g, gx - 2, gy - 2, GAUGE.w + 4, 14, '#1a1a22');
  rect(g, gx, gy, GAUGE.w, 10, '#e8eef4');
  rect(g, gx, gy, GAUGE.w, 2, '#ffffff');
  for (let x = gx + 6; x < gx + GAUGE.w; x += 12) rect(g, x, gy + 4, 4, 2, '#c8d4e0');
  cblob(g, gx - 10, gy + 5, 8, 8, '#9aa1ad');
  cblob(g, gx - 10, gy + 5, 4, 4, '#3a3f55');
}
