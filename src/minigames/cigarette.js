// Smoke Break (the roof, core/roof.js): a cigarette with a colleague. Hold to draw and keep the ember in its sweet spot:
// too little and it goes out (relight it with the lighter, in the wind), too much and you cough. Flick the ash before it
// falls on your tie, and stub it out before the ember reaches the filter and your fingers. The cigarette's length is
// the clock. Score: the share of the time in the sweet spot, less a bit for every mishap.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { cells, shade, bake, grad, glow, rnd, blob, grains } from '../engine/mgart.js';
import { DEFAULT_PLAYER } from '../engine/figure.js';

const FILTER = 0.12; // the filter's share of the cigarette: the ember stops here (fingers!)
const STUB_AT = 0.06; // within this much of the filter, the flick key stubs it out
const LIMIT_S = 80; // overall time limit
const ASH_MAX = 0.09; // ash this long falls off
const ASH_WARN = 0.75; // past this share of ASH_MAX the ash darkens, on the cigarette and its gauge
const RELIGHT_S = 0.9; // holding the lighter to it
const FLICK_BTN = { x: W - 96, y: H - 44, w: 84, h: 26 };
const CIG = { x: 150, y: 132, len: 250, h: 8 }; // on screen at full length
const METER = { x: 420, y: 36, w: 14, h: 130 }; // the gauges (each w wide) sit on the right: the arm takes the left

export default {
  id: 'cigarette',
  name: 'Smoke Break',
  help: 'Hold SPACE or the mouse to draw: keep the ember in the green. Too little and it goes out, too much and you cough. Flick the ash with F (or the button) and stub it out at the filter.',
  create({ difficulty = 0.3, rng, theme, player, sfx = () => {} }) {
    // The sky is the roof's (passed in the theme by RoofScene): dusk when nothing is said, never the wall clock.
    const mood = theme?.sky === 'night' || theme?.sky === 'day' ? theme.sky : 'dusk';
    const me = player || DEFAULT_PLAYER;
    const pal = { ...PAL[mood], skin: handTones(PAL[mood].skin, me.skin) }; // the hand is yours: the mood's lit tones, on your skin
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
    let anim = 0; // runs on after the end too: the antenna light, the lighter's flame
    let gust = 0; // heat per second while a gust blows
    let gustT = 0;
    let nextGust = rng.float(3, 6);
    const smoke = [];
    // Baked once: the sky, skyline and parapet, the gauges' frame and zones, the glows of the ember and of the fingers.
    const scene = bake(W, H, (g) => scenery(g, pal, mood));
    const gaugeZones = bake(METER.w, METER.h, (g) => (g.translate(-METER.x, -METER.y), gauge(g, sweet)));
    const glowR = mood === 'night' ? 30 : 20;
    const emberGlow = bake(glowR * 2 + 2, glowR * 2 + 2, (g) => glow(g, glowR + 1, glowR + 1, glowR, '#ff8030', mood === 'night' ? 0.8 : 0.6));
    const fingerGlow = mood === 'night' ? bake(100, 52, (g) => fingerLight(g)) : null;

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
        anim += dt;
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
        g.drawImage(scene, 0, 0);
        if (Math.floor(anim * 2) % 2 === 0) {
          // The antenna's red light blinks (not part of the bake).
          glow(g, 183, 70, 8, '#ff4040', 0.9);
          rect(g, 182, 69, 3, 3, '#ff5050');
        }
        // The arm and the back of the hand, the cigarette in front of them, the index finger over the filter.
        handBack(g, pal);
        const fw = Math.round(CIG.len * FILTER);
        const pw = Math.round(CIG.len * (len - FILTER));
        const tip = CIG.x + fw + pw;
        if (lit && fingerGlow) {
          // The ember's warm light on the fingers and the cuff.
          g.globalCompositeOperation = 'lighter';
          g.drawImage(fingerGlow, 136, 110);
          g.globalCompositeOperation = 'source-over';
        }
        // The cigarette: filter, paper, ash, ember.
        rect(g, CIG.x - 1, CIG.y - 1, fw + pw + 2, CIG.h + 2, '#2a2228');
        for (const [dy, hh, f, pp] of FILTER_ROWS) {
          rect(g, CIG.x, CIG.y + dy, fw, hh, f);
          rect(g, CIG.x + fw, CIG.y + dy, pw, hh, pp);
        }
        for (const [dx, dy, col] of FILTER_FLECKS) rect(g, CIG.x + dx, CIG.y + dy, 2, 2, col);
        rect(g, CIG.x + fw, CIG.y, 2, CIG.h, '#e8c860');
        rect(g, CIG.x + fw + 2, CIG.y, 1, CIG.h, '#c8a040');
        const aw = Math.round(CIG.len * ash);
        if (aw > 0) {
          const rows = ash > ASH_MAX * ASH_WARN ? ASH_ROWS_OLD : ASH_ROWS;
          for (let k = 0; k < CIG.h; k++) rect(g, tip - aw, CIG.y + k, aw, 1, rows[k]);
          for (let i = 0; i < aw; i += 4) rect(g, tip - aw + i, CIG.y + 1 + (i % 3) * 2, 2, 1, '#4a4e58');
        }
        if (lit) {
          g.drawImage(emberGlow, tip - glowR - 1, CIG.y + 4 - glowR - 1);
          const [body, core] = heat > sweet[1] ? ['#ffe070', '#fff4b0'] : heat >= sweet[0] ? ['#ff8a3a', '#ffd06a'] : ['#c84a2a', '#e0703a'];
          rect(g, tip - 3, CIG.y, 4, CIG.h, '#6a2a1a');
          rect(g, tip - 3, CIG.y + 1, 4, CIG.h - 2, body);
          rect(g, tip - 2, CIG.y + 2, 2, CIG.h - 4, core);
          if (heat >= sweet[0]) rect(g, tip, CIG.y + 3, 1, 2, '#fff4b0');
        } else {
          rect(g, tip - 2, CIG.y + 1, 3, CIG.h - 2, '#3a3a3a');
        }
        handFront(g, pal);
        if (!lit) {
          // The lighter.
          rect(g, tip - 6, CIG.y + 14, 12, 22, '#1a1a22');
          rect(g, tip - 5, CIG.y + 15, 10, 20, '#2a6ad1');
          if (relight > 0) {
            const fh = 4 + Math.round(relight * 6) + (Math.floor(anim * 20) % 2);
            rect(g, tip - 2, CIG.y + 14 - fh, 4, fh, '#ffb030');
            rect(g, tip - 1, CIG.y + 15 - fh, 2, fh - 2, '#fff0a0');
          }
        }
        // Smoke: chunky puffs from the ember, fading as they rise.
        for (const s of smoke) {
          g.globalAlpha = Math.max(0, 0.6 * (1 - s.t / 2));
          const r = 2 + 2 * Math.floor(s.t * 1.5);
          rect(g, Math.round(s.x - r / 2), Math.round(s.y - r / 2), r, r, mood === 'night' ? '#a8b0c8' : '#f4f0f4');
          g.globalAlpha = 1;
        }
        // The filter line: stub it out once the ember gets close.
        const stub = lit && len - FILTER < STUB_AT;
        if (stub && Math.floor(t * 4) % 2) drawText(g, 'Stub it out! (F)', tip, CIG.y - 18, { align: 'center', color: C.bad, shadow: '#1a1a22' });
        // Wind.
        if (gust) {
          const dir = gust > 0 ? 1 : -1;
          for (let i = 0; i < 5; i++) {
            const y = 40 + i * 30;
            const x = ((t * 160 * dir + i * 97) % (W + 60) + W + 60) % (W + 60) - 30;
            rect(g, x, y, 22, 1, 'rgba(255,255,255,0.5)');
          }
          drawText(g, gust > 0 ? 'Gust: it fans the ember' : 'Gust: it cools the ember', W / 2, 186, { align: 'center', color: '#f4f1e8', shadow: '#1a1a22' });
        }
        g.restore();
        // The heat meter: out at the bottom, cough at the top, the sweet spot in green.
        const { x: mx, y: my, w: mw, h: mh } = METER;
        rect(g, mx - 6, my - 6, 60, mh + 26, 'rgba(10,8,20,0.55)');
        rect(g, mx - 1, my - 1, mw + 2, mh + 2, '#1a1a22');
        g.drawImage(gaugeZones, mx, my);
        const hy = my + Math.round(mh * (1 - clamp(heat, 0, 1)));
        rect(g, mx - 4, hy - 2, mw + 8, 1, '#1a1a22');
        rect(g, mx - 4, hy - 1, mw + 8, 3, lit ? '#ffd06a' : '#6a707c');
        drawText(g, 'HEAT', mx + mw / 2, my + mh + 4, { align: 'center', color: C.text });
        // Ash gauge.
        const ax = mx + 27; // the ash gauge, as wide as the heat gauge
        drawText(g, 'ASH', ax + mw / 2, my + mh + 4, { align: 'center', color: C.text });
        rect(g, ax, my + mh - 40, mw, 41, '#1a1a22');
        const ah = Math.round(39 * Math.min(1, ash / ASH_MAX));
        rect(g, ax + 1, my + mh - 39 + 39 - ah, mw - 2, ah, ash > ASH_MAX * ASH_WARN ? C.warn : '#9aa1ad');
        // The flick button.
        const b = FLICK_BTN;
        rect(g, b.x, b.y, b.w, b.h, C.border);
        rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, stub ? '#7a2b2b' : '#3a4058');
        rect(g, b.x + 1, b.y + 1, b.w - 2, 1, stub ? '#a04848' : '#5a6078');
        drawText(g, stub ? 'STUB OUT' : 'FLICK ASH', b.x + b.w / 2, b.y + 5, { align: 'center', color: C.text });
        drawText(g, 'F', b.x + b.w / 2, b.y + 15, { align: 'center', color: C.dim });
        drawText(g, lit ? (cough > 0 ? 'Coughing...' : 'Hold to draw') : 'It went out: hold to use the lighter', W / 2, H - 40, { align: 'center', color: lit ? '#e8e4f0' : C.warn, shadow: '#1a1a22' });
        header(g, theme?.title || 'Smoke Break', `Sweet spot ${Math.round((sweetT / Math.max(1, t)) * 100)}%`);
        timerBar(g, len - FILTER, 1 - FILTER);
        fl.render(g);
      },
    };
    return inst;
  },
};

// The art: the roof's skyline at dusk, night or day, and a hand in a suit sleeve (3 px cells, a dark outline, flat
// skin in two tones). The scenery is baked in create(); the hand is drawn in two layers around the cigarette.
const PAL = {
  dusk: {
    sky: ['#2e2350', '#4a2f6a', '#7a3f78', '#c0587a', '#f08a6a', '#ffc884'],
    far: '#6a5080',
    near: '#2b2a4a',
    lit: 0.25,
    windows: ['#ffd27a', '#bfe0ff'],
    skin: ['#9a5a3a', '#c8865c', '#e0a878', '#f0c498'],
    sleeve: ['#141a2c', '#1f2a44', '#2b3a5c', '#3a4c74'],
    parapet: ['#8a8c90', '#a8a8a6', '#c8c4b8'],
  },
  night: {
    sky: ['#05060f', '#0a1024', '#121c3c', '#1e2a52', '#2a3a66'],
    far: '#1e2440',
    near: '#0e1020',
    lit: 0.45,
    windows: ['#ffd27a', '#bfe0ff'],
    skin: ['#4a3040', '#6a4450', '#8a5a5a', '#a87068'],
    sleeve: ['#080a14', '#0e1220', '#161c30', '#202a44'],
    parapet: ['#3a3c48', '#4a4c58', '#5a5c68'],
  },
  // Daylight uses the roof's own day colours (scenes/cityscape.js); the hand keeps the lit dusk tones (for the default skin).
  day: {
    sky: ['#5fa8e8', '#7ab8ee', '#94c8f2', '#b4daf6'],
    far: '#8aa8c8',
    near: '#6b86a6',
    lit: 0.3,
    windows: ['#8aa8c8', '#8aa8c8'],
    skin: ['#9a5a3a', '#c8865c', '#e0a878', '#f0c498'],
    sleeve: ['#141a2c', '#1f2a44', '#2b3a5c', '#3a4c74'],
    parapet: ['#8a8c90', '#a8a8a6', '#c8c4b8'],
  },
};
const REF_SKIN = '#f2c9a0'; // the skin the PAL tones were drawn for
/** The mood's skin tones for another skin: each channel scaled by its tone's ratio to REF_SKIN (the same skin gives the tones back). */
export function handTones(tones, skin) {
  const ch = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const ref = ch(REF_SKIN);
  const mine = ch(skin || REF_SKIN);
  return tones.map((t) => '#' + ch(t).map((v, i) => Math.max(0, Math.min(255, Math.round(mine[i] * (v / ref[i])))).toString(16).padStart(2, '0')).join(''));
}
const FILTER_ROWS = [
  [0, 2, '#f2b060', '#ffffff'],
  [2, 4, '#d98a3a', '#f4f1e8'],
  [6, 2, '#b06428', '#dedad0'],
];
const FILTER_FLECKS = [[4, 2, '#a85a20'], [14, 4, '#f8c070'], [22, 2, '#a85a20'], [8, 6, '#f8c070'], [18, 6, '#a85a20'], [26, 4, '#f8c070']];
const ASH_ROWS = ['#b4b8c0', '#a0a4ac', '#8a8e98', '#7a7e88', '#6a6e78', '#5a5e68', '#5a5e68', '#4a4e58'];
const ASH_ROWS_OLD = ASH_ROWS.map((c) => shade(c, -0.3)); // long ash, about to fall

/** The night's ember light on the fingers and the cuff, as one image (drawn additively at 136,110). */
function fingerLight(g) {
  for (let k = 24; k > 0; k -= 4) {
    g.globalAlpha = 0.035;
    blob(g, 50, 26, k * 2, k, '#ff7a30');
  }
}

function scenery(g, p, mood) {
  rect(g, 0, 0, W, 18, p.sky[0]); // under the header
  grad(g, 0, 18, W, 182, p.sky);
  if (mood === 'dusk') {
    glow(g, 372, 182, 70, '#ffd890', 0.7);
    blob(g, 372, 182, 22, 22, '#ffe8b0');
    blob(g, 372, 182, 18, 18, '#fff4d0');
    for (const [x, y, w] of [[40, 96, 120], [250, 84, 160], [330, 120, 110], [90, 140, 90]]) {
      rect(g, x, y, w, 2, '#e07a8a');
      rect(g, x + 8, y + 2, w - 20, 1, '#ffb090');
    }
  } else if (mood === 'night') {
    const r = rnd(33);
    for (let i = 0; i < 90; i++) rect(g, Math.floor(r() * W), 18 + Math.floor(r() * 120), 1, 1, r() > 0.8 ? '#ffffff' : '#8a96c0');
    blob(g, 404, 52, 13, 13, '#e8ecf4');
    blob(g, 409, 48, 12, 12, p.sky[1]);
    glow(g, 400, 52, 30, '#c8d4ff', 0.5);
  } else {
    blob(g, 404, 52, 13, 13, '#fff4c0');
    for (const [x, y] of [[40, 52], [210, 36], [300, 84], [120, 110]]) {
      rect(g, x, y, 34, 6, '#eef6fc');
      rect(g, x + 6, y - 4, 18, 5, '#eef6fc');
    }
  }
  skyline(g, p);
  parapet(g, p);
}

/** Two layers of buildings, a water tower and the antenna mast (its red light blinks in render()). */
function skyline(g, p) {
  const r = rnd(17);
  for (let x = -10; x < W; ) {
    const bw = 20 + Math.floor(r() * 30);
    const bh = 40 + Math.floor(r() * 50);
    rect(g, x, 200 - bh - 26, bw, bh + 26, p.far);
    x += bw + 2;
  }
  const r2 = rnd(29);
  for (let x = -6; x < W; ) {
    const bw = 26 + Math.floor(r2() * 40);
    const bh = 30 + Math.floor(r2() * 70);
    const top = 200 - bh;
    rect(g, x, top, bw, bh, p.near);
    rect(g, x, top, bw, 1, shade(p.near, 0.15));
    for (let wy = top + 5; wy < 196; wy += 6)
      for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (r2() < p.lit) rect(g, wx, wy, 2, 3, r2() > 0.3 ? p.windows[0] : p.windows[1]);
    x += bw + 3;
  }
  rect(g, 300, 104, 20, 14, p.near);
  blob(g, 310, 104, 10, 3, p.near);
  for (const lx of [302, 316]) rect(g, lx, 118, 2, 14, p.near);
  rect(g, 182, 70, 2, 40, p.near);
}

function parapet(g, p) {
  rect(g, 0, 200, W, 6, p.parapet[2]);
  rect(g, 0, 200, W, 1, shade(p.parapet[2], 0.2));
  rect(g, 0, 206, W, 2, shade(p.parapet[0], -0.3));
  rect(g, 0, 208, W, H - 208, p.parapet[0]);
  for (let y = 208, i = 0; y < H; y += 14, i++) {
    rect(g, 0, y, W, 1, shade(p.parapet[0], -0.18));
    for (let x = (i % 2) * 24; x < W; x += 48) rect(g, x, y, 1, 14, shade(p.parapet[0], -0.18));
  }
  // Sparse 2x2 flecks on the slabs.
  grains(g, 0, 208, W, H - 208, [shade(p.parapet[0], -0.1), shade(p.parapet[0], 0.08)], 500, 6);
  for (const x of [60, 230, 330]) for (let k = 0; k < 14; k++) rect(g, x + (k % 3), 208 + k * 3, 2, 3, 'rgba(40,30,30,0.18)');
  // A tin ashtray and a coffee cup on the ledge.
  rect(g, 418, 190, 18, 12, '#6a707c');
  rect(g, 418, 190, 18, 2, '#9aa1ad');
  rect(g, 422, 186, 8, 3, '#f4f1e8');
  rect(g, 428, 184, 2, 4, '#d98a3a');
  rect(g, 446, 186, 12, 15, '#f4f1e8');
  rect(g, 446, 186, 12, 3, '#3a2a1a');
  rect(g, 446, 192, 12, 4, '#e2504a');
}

/** The heat gauge's zones (drawn in screen coordinates; the caller translates): the frame and panel are drawn per frame. */
function gauge(g, sweet) {
  const { x: mx, y: my, w: mw, h: mh } = METER;
  const at = (v) => my + Math.round(mh * (1 - v));
  const top = at(sweet[1]);
  const bottom = at(sweet[0]);
  grad(g, mx, my, mw, top - my, ['#c84a3a', '#e8a040']); // too much: you cough
  rect(g, mx, top, mw, bottom - top, '#3a8a4a'); // the sweet spot
  grad(g, mx, bottom, mw, my + mh - bottom, ['#2a4a6a', '#1a2a3a']); // too little: it goes out
  rect(g, mx, top, mw, 1, '#9af0b0');
  rect(g, mx, bottom - 1, mw, 1, '#9af0b0');
}

// The hand is a cell sprite like the masseur's hands (3 px cells, a dark outline, flat skin in two tones), seen from the
// side. Two layers: behind the cigarette (sleeve, cuff, the back of the hand, the middle finger under the filter, the
// thumb, the curled fingers), then the index finger in front, over the filter's top edge.
const HC = 3;
const HX = CIG.x - 13 * HC;
const HY = CIG.y - 4 * HC;
function drawParts(g, parts) {
  for (const [cx, cy, w, h] of parts) rect(g, HX + cx * HC - 2, HY + cy * HC - 2, w * HC + 4, h * HC + 4, '#2a1a14');
  const r = cells(g, HX, HY, HC);
  for (const [cx, cy, w, h, col] of parts) r(cx, cy, w, h, col);
}
function handBack(g, p) {
  const [SD, SK] = [p.skin[1], p.skin[2]];
  // The sleeve comes straight in from the left edge to the cuff, a fold line or two.
  const left = -Math.ceil(HX / HC) - 1;
  drawParts(g, [[left, 1, -1 - left, 12, p.sleeve[2]]]);
  rect(g, 0, HY + HC, HX - HC, 2 * HC, p.sleeve[3]);
  rect(g, 0, HY + 10 * HC, HX - HC, 3 * HC, p.sleeve[1]);
  for (const fx of [40, 78, 104]) rect(g, fx, HY + 4 * HC, 2, 5 * HC, p.sleeve[1]);
  drawParts(g, [
    [-1, 0, 4, 14, '#f4f6f8'], // the cuff
    [5, 0, 7, 1, SK], // back of the hand: knuckles high, rounded at the wrist
    [3, 1, 9, 11, SK],
    [4, 12, 7, 1, SK],
    [12, 8, 9, 2, SK], // middle finger, under the filter
    [11, 11, 7, 2, SK], // thumb, pointing along below
    [8, 12, 4, 2, SD], // curled ring and little fingers
  ]);
  rect(g, HX - HC, HY + 11 * HC, 4 * HC, 3 * HC, '#c8ccd2');
  rect(g, HX, HY + 6 * HC, HC, HC, '#c8a040'); // the cufflink
  rect(g, HX + 3 * HC, HY + 10 * HC, 9 * HC, 2 * HC, SD); // the hand's underside in shadow
  rect(g, HX + 4 * HC, HY + 12 * HC, 7 * HC, HC, SD);
  rect(g, HX + 20 * HC, HY + 8 * HC, HC, 2 * HC, p.skin[3]); // nail
  rect(g, HX + 17 * HC, HY + 11 * HC, HC, 2 * HC, p.skin[3]);
  rect(g, HX + 16 * HC, HY + 8 * HC, 1, 2 * HC, SD); // knuckle crease
}
function handFront(g, p) {
  drawParts(g, [[12, 1, 11, 3, p.skin[2]]]); // index finger, its lower edge over the filter
  rect(g, HX + 10 * HC, HY + HC, 3 * HC, 3 * HC, p.skin[2]); // joined to the hand: no outline at the knuckle
  rect(g, HX + 22 * HC, HY + HC, HC, 2 * HC, p.skin[3]);
  rect(g, HX + 17 * HC, HY + HC, 1, 3 * HC, p.skin[1]);
  rect(g, HX + 12 * HC, HY + 3 * HC, 11 * HC, 1, p.skin[1]);
}
