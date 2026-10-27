// Sunbathe (vacation hotel): the side facing the sun slowly tans. Turn over while it is golden: too early and you are
// still pale, too late and you are a lobster. Four turns, a wide golden window.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';
import { cblob, cells, rnd, shade, bake } from '../engine/mgart.js';
import { DEFAULT_PLAYER } from '../engine/figure.js';

const TURNS = 4;
const RATE = 0.2; // tan per second
const GOLD = [0.5, 0.92];
const SUN = { x: 410, y: 50 };
const METER = { x: 60, y: 70, h: 140 };

/** The colour k of the way from '#rrggbb' a to b, as '#rrggbb'. */
const lerp = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
};
/** Your own skin, tanning to a golden brown by 0.7, then burning red. The tan is the skin itself, darker and warmer (blue falls most), so every tone darkens as it tans. */
export const skinAt = (own, tan) => {
  const n = parseInt(own.slice(1), 16);
  const ch = (s, k) => Math.round(((n >> s) & 255) * k);
  const golden = `#${((1 << 24) | (ch(16, 0.86) << 16) | (ch(8, 0.78) << 8) | ch(0, 0.68)).toString(16).slice(1)}`;
  return tan < 0.7 ? lerp(own, golden, tan / 0.7) : lerp(golden, '#e2504a', Math.min(1, (tan - 0.7) / 0.3));
};

export default {
  id: 'sunbathe',
  name: 'Golden Brown',
  help: 'Your side facing the sun tans. Press SPACE or click to turn over while the tan is golden, before you burn. Four turns.',
  create({ theme, sfx = () => {}, player }) {
    const total = new Countdown(40);
    const fl = new Floaters();
    const look = player || DEFAULT_PLAYER;
    const scene = bake(W, H, scenery); // sand, towel, beach things, the meter's tube
    let tan = 0;
    let turns = 0;
    let good = 0;
    let back = false; // which side faces the sun
    let flip = 0;
    let t = 0;

    const turn = (verdict) => {
      turns++;
      if (verdict === 'gold') good++;
      sfx(verdict === 'gold' ? 'good' : 'bad');
      fl.add({ gold: 'Golden!', pale: 'Still pale...', burnt: 'Ouch! Lobster!' }[verdict], W / 2, 120, verdict === 'gold' ? C.gold : verdict === 'pale' ? C.dim : C.bad);
      back = !back;
      tan = 0;
      flip = 0.4;
    };

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ tan, gold: GOLD }),
      update(dt, input) {
        fl.update(dt);
        t += dt;
        flip = Math.max(0, flip - dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, good / TURNS);
        if (flip > 0) return;
        tan += RATE * dt;
        if (input.confirm() || input.pointer.clicked) turn(tan < GOLD[0] ? 'pale' : tan <= GOLD[1] ? 'gold' : 'burnt');
        else if (tan > 1) turn('burnt');
        if (turns >= TURNS) finish(inst, good / TURNS);
      },
      render(g) {
        g.drawImage(scene, 0, 0);
        // The sun's rays, turning.
        for (let k = 0; k < 8; k++) {
          const a = t * 0.6 + (k * Math.PI) / 4;
          rect(g, Math.round((SUN.x + Math.cos(a) * 28) / 2) * 2 - 2, Math.round((SUN.y + Math.sin(a) * 28) / 2) * 2 - 2, 4, 4, '#f29c38');
        }
        // You on the towel, lifted a little while you turn over.
        const lift = flip > 0 ? Math.round(Math.sin((flip / 0.4) * Math.PI) * 8) : 0;
        you(g, back, skinAt(look.skin, tan), look, lift);
        // The thermometer's mercury: the live tan.
        const ty = METER.y + METER.h * (1 - Math.min(1, tan));
        rect(g, METER.x - 6, ty - 2, 28, 4, '#1a1a22');
        drawText(g, back ? 'Back in the sun' : 'Front in the sun', W / 2, 200, { align: 'center', color: '#5a3a22' });
        header(g, theme?.title || 'Sunbathe', `Golden ${good}/${TURNS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};

function scenery(g) {
  // The beach from above: flat sand, a few 2 px grains, footprints and a shell.
  rect(g, 0, 18, W, H - 18, '#ecd9a0');
  const r = rnd(5);
  for (let i = 0; i < 70; i++) rect(g, Math.floor((r() * W) / 2) * 2, 20 + Math.floor((r() * (H - 22)) / 2) * 2, 2, 2, i % 3 ? '#d9c283' : '#f6e8b8');
  for (let i = 0; i < 5; i++) cblob(g, 120 + i * 18, 220 + (i % 2) * 8, 4, 6, '#d9c283');
  cblob(g, 360, 226, 6, 4, '#f4e8e0');
  cblob(g, SUN.x, SUN.y, 16, 16, '#f29c38');
  cblob(g, SUN.x, SUN.y, 14, 14, '#f2e14e');
  // The striped towel with its fringe.
  rect(g, 150, 108, 184, 74, '#24877e');
  for (let x = 152; x < 332; x += 16) rect(g, x, 110, 8, 70, '#5fd0c8');
  for (let x = 152; x < 332; x += 4) rect(g, x, 180, 2, 4, '#5fd0c8'), rect(g, x, 106, 2, 4, '#5fd0c8');
  // Flip-flops, sunscreen, a book, a drink.
  for (const x of [360, 372]) {
    cblob(g, x, 150, 5, 10, '#e2504a');
    rect(g, x - 1, 142, 2, 6, '#ffffff');
  }
  rect(g, 352, 112, 12, 22, '#f29c38');
  rect(g, 354, 108, 8, 4, '#ffffff');
  rect(g, 354, 118, 8, 6, '#ffffff');
  rect(g, 112, 124, 26, 20, '#3b6fb6');
  rect(g, 114, 126, 22, 16, '#f4f1e8');
  rect(g, 124, 126, 2, 16, '#c8c4bc');
  cblob(g, 126, 168, 8, 8, '#c8ccd4');
  cblob(g, 126, 168, 6, 6, '#f2c14e');
  rect(g, 128, 156, 2, 12, '#e2504a');
  // The tan meter as a thermometer: pale, golden, burnt, with its bulb.
  const { x: mx, y: my, h: mh } = METER;
  rect(g, mx - 3, my - 3, 22, mh + 6, '#5a3a22');
  rect(g, mx, my, 16, mh, '#f6e0c8');
  rect(g, mx, my + mh * (1 - GOLD[1]), 16, mh * (GOLD[1] - GOLD[0]), '#f2c14e');
  rect(g, mx, my, 16, mh * (1 - GOLD[1]), '#e2504a');
  rect(g, mx, my, 4, mh, 'rgba(255,255,255,0.35)');
  cblob(g, mx + 8, my + mh + 8, 12, 12, '#5a3a22');
  cblob(g, mx + 8, my + mh + 8, 10, 10, '#f6e0c8');
  drawText(g, 'TAN', mx + 8, my - 14, { align: 'center', color: '#5a3a22' });
  drawText(g, 'Turn over while the tan is golden', W / 2, 24, { align: 'center', color: '#5a3a22' });
}

// You from above, head to the left, on 3 px cells: face up (sunglasses, a smile) or face down (all hair), in trunks or a
// swimsuit in the corporate colour, long hair with a skirt.
function you(g, back, skin, look, lift) {
  const r = cells(g, 160, 112 - lift, 3);
  const suit = look.corp || look.top;
  const feet = shade(skin, -0.08);
  r(14, 2, 14, 2, skin); // arms along the body
  r(14, 18, 14, 2, skin);
  r(12, 4, 20, 14, skin); // torso
  r(32, 6, 22, 4, skin); // legs
  r(32, 12, 22, 4, skin);
  r(54, 5, 3, 5, feet);
  r(54, 12, 3, 5, feet);
  if (look.skirt) {
    r(16, 5, 16, 12, suit);
    r(14, 4, 2, 2, suit);
  } else r(26, 4, 6, 14, suit); // trunks
  r(3, 5, 9, 10, skin); // head
  r(12, 9, 1, 2, skin);
  if (back) r(3, 5, 9, 10, look.hair);
  else {
    r(3, 5, 3, 10, look.hair);
    r(7, 6, 2, 3, '#1a1a22'); // sunglasses
    r(7, 11, 2, 3, '#1a1a22');
    r(7, 9, 1, 2, '#1a1a22');
    r(10, 9, 1, 2, '#a04a3a');
  }
  if (look.long) r(0, 4, 4, 12, look.hair);
}
