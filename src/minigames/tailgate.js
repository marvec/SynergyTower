// Badge Tailgate: a queue walks toward the lobby turnstile. Employees badge in (green BEEP), visitors wear an
// orange sticker; anyone with neither is a stranger, often tailgating right behind a colleague or wearing a
// "disguise" (ladder, pizza, hi-vis, duck). Stop the strangers before they cross the gate line; let the rest pass.
import { W, H, C, rect, drawText, measureText, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { SIGNS, EXCUSES, DISGUISE, LEGIT, LEGIT_VISITOR, LEGIT_ODD, WRONG, SNEAKED } from '../data/mg-tailgate.js';

const GATE_X = 330;
const LANE = 172; // feet y in the queue
const ASIDE = 196; // feet y once pulled aside
const SPAWN_X = -16;
const REVEAL = 170; // badges light up within this distance of the gate
const OUTFITS = ['ladder', 'pizza', 'hivis', 'duck'];
const SKINS = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];
const HAIRS = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#1a1a1a', '#9a9aa0'];
const SHIRTS = ['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#c86a9a', '#4a9aa0', '#d8d8e0'];
const PANTS = ['#2b2e38', '#3a3f58', '#4a3a2a', '#20242e', '#55607a'];
const TIES = ['#e2304a', '#3b6fb6', '#f2c14e', '#3bb66a'];
const STOP_BTN = { x: 196, y: 210, w: 88, h: 32 };

export default {
  id: 'tailgate',
  name: 'Badge Tailgate',
  help: 'Stop people without a badge (green BEEP) or VISITOR sticker before they pass the gate. SPACE stops the marked person (Left/Right to change), or click a person.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const sign = SIGNS[theme?.dept] || SIGNS.lobby;
    const speed = byDiff(d, 42, 80);
    const interval = byDiff(d, 1.75, 1.0);
    const arrivals = byDiff(d, 30, 38); // seconds of people arriving
    const tailP = byDiff(d, 0.12, 0.28);
    const soloP = 0.2;
    const visitorP = 0.12;
    const tailGap = Math.round(byDiff(d, 26, 19));
    const disguise = byDiff(d, 0.1, 0.7);
    const oddball = d < 0.3 ? 0 : byDiff(d, 0, 0.3);
    const fl = new Floaters();
    const shake = new Shake();

    let nextId = 1;
    const mk = (kind, x) => {
      const p = {
        id: nextId++,
        kind,
        x,
        y: LANE,
        state: 'walk',
        crossed: false,
        beeped: false,
        hop: false,
        t: 0,
        line: null,
        hold: 0,
        outfit: null,
        skin: rng.pick(SKINS),
        hair: rng.pick(HAIRS),
        shirt: rng.pick(SHIRTS),
        pants: rng.pick(PANTS),
        tie: rng.pick(TIES),
        suit: rng.chance(kind === 'emp' ? 0.35 : 0.15),
        long: rng.chance(0.35),
        glasses: rng.chance(0.25),
      };
      if (kind === 'stranger' && rng.chance(disguise)) p.outfit = rng.pick(OUTFITS);
      if (kind !== 'stranger' && rng.chance(oddball)) p.outfit = kind === 'visitor' ? 'pizza' : rng.pick(OUTFITS);
      return p;
    };

    // Everyone walks at the same speed, so the whole queue can be laid out up front behind the door.
    const people = [];
    let dist = 20;
    while (dist < speed * arrivals) {
      const roll = rng.next();
      const x = SPAWN_X - dist;
      if (roll < tailP) {
        people.push(mk('emp', x));
        const t = mk('stranger', x - tailGap);
        t.tail = true;
        people.push(t);
        dist += tailGap;
      } else if (roll < tailP + soloP) people.push(mk('stranger', x));
      else if (roll < tailP + soloP + visitorP) people.push(mk('visitor', x));
      else people.push(mk('emp', x));
      dist += Math.max(44, speed * interval * rng.float(0.75, 1.3));
    }
    // At least four strangers per round.
    for (let k = 0; people.filter((p) => p.kind === 'stranger').length < 4 && k < 50; k++) {
      const p = rng.pick(people.filter((q) => q.kind === 'emp'));
      if (p) Object.assign(p, { kind: 'stranger', outfit: rng.chance(disguise) ? rng.pick(OUTFITS) : null });
    }
    const strangers = people.filter((p) => p.kind === 'stranger').length;
    const lastX = Math.min(...people.map((p) => p.x));
    const total = new Countdown(Math.min(75, (GATE_X - lastX + 40) / speed + 3.5));

    let caught = 0;
    let wrong = 0;
    let sneaked = 0;
    let flapOpen = 0;
    let led = { col: null, t: 0 };
    let guardT = 0;
    let manual = null; // person picked with arrows / hover; null = nearest to the gate
    let anim = 0;
    let target = null;

    const score = () => clamp((caught - 0.75 * wrong) / strangers, 0, 1);
    const candidates = () => people.filter((p) => p.state === 'walk' && !p.crossed && p.x > -8).sort((a, b) => b.x - a.x);

    function stop(p) {
      if (!p) {
        sfx('click');
        return;
      }
      p.state = 'aside';
      p.t = 0;
      guardT = 0.5;
      if (manual === p) manual = null;
      if (p.kind === 'stranger') {
        caught++;
        p.line = p.outfit ? rng.pick(DISGUISE[p.outfit]) : rng.pick(EXCUSES);
        p.hold = 1.9;
        sfx('good');
        fl.add(p.tail ? 'Tailgater busted!' : 'Busted!', clamp(p.x, 60, W - 60), 70, C.good);
      } else {
        wrong++;
        p.line = p.outfit ? rng.pick(LEGIT_ODD[p.outfit]) : p.kind === 'visitor' ? rng.pick(LEGIT_VISITOR) : rng.pick(LEGIT);
        p.hold = 1.5;
        sfx('bad');
        shake.hit();
        fl.add(rng.pick(WRONG), clamp(p.x, 60, W - 60), 70, C.bad);
      }
    }

    const hitTest = (pt, cands) => {
      let best = null;
      let bd = 1e9;
      for (const p of cands) {
        if (pt.x >= p.x - 11 && pt.x <= p.x + 11 && pt.y >= LANE - 52 && pt.y <= LANE + 3) {
          const dd = Math.abs(pt.x - p.x);
          if (dd < bd) (bd = dd), (best = p);
        }
      }
      return best;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        flapOpen = Math.max(0, flapOpen - dt);
        led.t = Math.max(0, led.t - dt);
        guardT = Math.max(0, guardT - dt);
        for (const p of people) {
          p.t += dt;
          if (p.state === 'walk') {
            p.x += speed * dt;
            if (!p.crossed && !p.beeped && p.x >= GATE_X - 14) {
              p.beeped = true;
              if (p.kind !== 'stranger') {
                flapOpen = 0.75;
                led = { col: C.good, t: 0.5 };
                sfx('blip');
              } else if (flapOpen <= 0) {
                p.hop = true; // vaults the closed turnstile
                led = { col: C.bad, t: 0.5 };
              }
            }
            if (!p.crossed && p.x >= GATE_X) {
              p.crossed = true;
              if (p.kind === 'stranger') {
                sneaked++;
                sfx('bad');
                shake.hit(0.2);
                fl.add(rng.pick(SNEAKED), GATE_X + 24, 70, C.warn);
              }
            }
            if (p.x > W + 24) p.state = 'gone';
          } else if (p.state === 'aside') {
            p.y = Math.round(LANE + (ASIDE - LANE) * clamp(p.t / 0.25, 0, 1));
            if (p.t >= p.hold) {
              p.state = p.kind === 'stranger' ? 'escort' : 'pass';
              p.t = 0;
            }
          } else if (p.state === 'escort') {
            p.x -= 75 * dt;
            if (p.x < -24) p.state = 'gone';
          } else if (p.state === 'pass') {
            p.x += speed * 1.2 * dt;
            if (p.x > W + 24) p.state = 'gone';
          }
        }
        // Targeting.
        const cands = candidates();
        if (manual && !cands.includes(manual)) manual = null;
        target = manual || cands[0] || null;
        if (cands.length && (input.pressed('ArrowLeft') || input.pressed('ArrowRight'))) {
          const idx = target ? cands.indexOf(target) : 0;
          const ni = input.pressed('ArrowLeft') ? Math.min(cands.length - 1, idx + 1) : Math.max(0, idx - 1);
          manual = ni === 0 ? null : cands[ni];
          target = cands[ni];
          sfx('blip');
        }
        const pt = input.pointer;
        const hov = hitTest(pt, cands);
        if (pt.moved && hov) {
          manual = hov;
          target = hov;
        }
        if (pt.clicked) {
          if (hov) stop(hov);
          else if (pt.x >= STOP_BTN.x && pt.x < STOP_BTN.x + STOP_BTN.w && pt.y >= STOP_BTN.y && pt.y < STOP_BTN.y + STOP_BTN.h) stop(target);
        } else if (input.confirm()) stop(target);
        if (target && target.state !== 'walk') target = candidates()[0] || null;
        if (people.every((p) => p.state === 'gone')) finish(inst, score());
      },
      render(g) {
        g.save();
        shake.apply(g);
        drawLobby(g, sign, anim);
        // Scan zone and gate line on the floor.
        rect(g, GATE_X - REVEAL, LANE - 10, REVEAL, 14, 'rgba(138,180,255,0.16)');
        drawText(g, 'BADGE SCAN ZONE', GATE_X - REVEAL + 4, LANE + 6, { color: 'rgba(40,50,80,0.55)' });
        for (let y = 120; y < 204; y += 6) rect(g, GATE_X - 1, y, 2, 3, C.gold);
        // Back post with the reader.
        rect(g, GATE_X - 4, 128, 8, 32, '#4a4f60');
        rect(g, GATE_X - 3, 128, 2, 32, '#6a7084');
        rect(g, GATE_X - 7, 120, 14, 9, '#20232c');
        rect(g, GATE_X - 3, 122, 6, 4, led.t > 0 ? led.col : '#3a3f4a');
        const lane = people.filter((p) => p.state === 'walk' && p.x > -24 && p.x < W + 24).sort((a, b) => a.x - b.x);
        for (const p of lane) drawPerson(g, p, hopOffset(p), false);
        // Flap (closed: glass across the lane).
        if (flapOpen <= 0) {
          rect(g, GATE_X - 1, 146, 3, 28, 'rgba(170,210,255,0.75)');
          rect(g, GATE_X - 1, 146, 3, 1, '#ffffff');
        } else rect(g, GATE_X - 1, 146, 3, 5, 'rgba(170,210,255,0.75)');
        // Front post.
        rect(g, GATE_X - 4, 146, 8, 40, '#5a6074');
        rect(g, GATE_X - 3, 146, 2, 40, '#8088a0');
        rect(g, GATE_X - 7, 185, 14, 3, '#2b2e38');
        drawGuard(g, GATE_X + 30, 200, guardT > 0);
        const aside = people.filter((p) => p.state !== 'walk' && p.state !== 'gone').sort((a, b) => a.x - b.x);
        for (const p of aside) drawPerson(g, p, 0, p.state === 'escort' || (p.state === 'aside' && p.kind === 'stranger'));
        // Badge indicators above heads in the scan zone.
        for (const p of lane) {
          if (p.crossed || p.x < GATE_X - REVEAL) continue;
          const top = LANE - 50 + hopOffset(p);
          if (p.kind === 'emp') drawBeep(g, p.x, top - 12, anim);
          else if (p.kind === 'visitor') drawVisitorTag(g, p.x, top - 12);
        }
        // Target marker.
        if (target && target.state === 'walk') {
          const tx = Math.round(target.x);
          const top = LANE - 50 + hopOffset(target);
          const bob = Math.floor(anim * 4) % 2;
          const ay = top - 26 - bob;
          rect(g, tx - 4, ay, 9, 2, C.gold);
          rect(g, tx - 3, ay + 2, 7, 2, C.gold);
          rect(g, tx - 2, ay + 4, 5, 2, C.gold);
          rect(g, tx - 1, ay + 6, 3, 2, C.gold);
          corners(g, tx - 12, top - 2, 24, LANE - top + 5, C.gold);
        }
        // Speech bubbles.
        for (const p of aside) if (p.state === 'aside' && p.line) bubble(g, p.x, 102, p.line, p.kind === 'stranger');
        drawUi(g);
        header(g, theme?.title || 'Badge Tailgate', `Caught ${caught}/${strangers}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
        g.restore();
      },
    };

    function hopOffset(p) {
      if (!p.hop || p.state !== 'walk') return 0;
      const f = clamp((p.x - (GATE_X - 14)) / 28, 0, 1);
      return -Math.round(Math.sin(Math.PI * f) * 14);
    }

    function drawUi(g) {
      rect(g, 0, 204, W, H - 204, '#20243a');
      rect(g, 0, 204, W, 1, C.border);
      rect(g, 0, 205, W, 1, C.panelLight);
      // Legend.
      drawBeep(g, 22, 212, 0.3);
      drawText(g, 'BADGE: let in', 36, 213, { color: C.good });
      drawVisitorTag(g, 22, 225);
      drawText(g, 'VISITOR: let in', 36, 226, { color: C.warn });
      rect(g, 16, 239, 12, 7, '#3a3f58');
      drawText(g, '?', 22, 239, { align: 'center', color: C.bad });
      drawText(g, 'NOTHING: STOP!', 36, 239, { color: C.bad });
      // STOP button.
      const b = STOP_BTN;
      rect(g, b.x, b.y, b.w, b.h, C.border);
      rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, '#b03a35');
      rect(g, b.x + 1, b.y + 1, b.w - 2, 1, 'rgba(255,255,255,0.35)');
      rect(g, b.x + 1, b.y + b.h - 2, b.w - 2, 1, 'rgba(0,0,0,0.35)');
      drawText(g, 'STOP!', b.x + b.w / 2, b.y + 5, { align: 'center', color: C.text, shadow: C.border, scale: 2 });
      drawText(g, 'SPACE', b.x + b.w / 2, b.y + 22, { align: 'center', color: '#ffd0c8' });
      // Stats.
      drawText(g, `Busted: ${caught}`, 330, 212, { color: C.good });
      drawText(g, `Wrong stops: ${wrong}`, 330, 224, { color: wrong ? C.bad : C.dim });
      drawText(g, `Sneaked in: ${sneaked}`, 330, 236, { color: sneaked ? C.warn : C.dim });
      drawText(g, 'SPACE stops the marked person (Left/Right to pick), or click a person.', W / 2, 256, { align: 'center', color: C.dim });
    }

    return inst;
  },
};

function corners(g, x, y, w, h, c) {
  rect(g, x, y, 4, 1, c);
  rect(g, x, y, 1, 4, c);
  rect(g, x + w - 4, y, 4, 1, c);
  rect(g, x + w - 1, y, 1, 4, c);
  rect(g, x, y + h - 1, 4, 1, c);
  rect(g, x, y + h - 4, 1, 4, c);
  rect(g, x + w - 4, y + h - 1, 4, 1, c);
  rect(g, x + w - 1, y + h - 4, 1, 4, c);
}

function drawLobby(g, sign, t) {
  // Wall.
  rect(g, 0, 0, W, H, '#7d8296');
  for (let x = 0; x < W; x += 40) rect(g, x, 18, 1, 92, 'rgba(0,0,0,0.12)');
  rect(g, 0, 104, W, 14, '#5a5f74');
  rect(g, 0, 104, W, 1, '#9aa0b8');
  // Sign.
  const sw = Math.max(measureText(sign[0]) + 24, measureText(sign[1]) + 20, 150);
  const sx = Math.round(190 - sw / 2);
  rect(g, sx, 24, sw, 28, C.border);
  rect(g, sx + 1, 25, sw - 2, 26, C.accentDark);
  rect(g, sx + 1, 25, sw - 2, 1, C.accent);
  drawText(g, sign[0], sx + sw / 2, 29, { align: 'center', color: C.gold, shadow: C.border });
  drawText(g, sign[1], sx + sw / 2, 40, { align: 'center', color: C.accentLight });
  // Revolving door.
  rect(g, 4, 44, 50, 74, '#2b2e38');
  rect(g, 6, 46, 46, 58, '#9ec4e0');
  rect(g, 6, 46, 46, 4, '#c8e0f0');
  const k = Math.floor(t * 3) % 3;
  rect(g, 12 + k * 12, 50, 2, 54, '#5a6a80');
  rect(g, 28, 46, 2, 58, '#3d4150');
  rect(g, 6, 104, 46, 14, '#3d4150');
  drawText(g, 'IN', 29, 108, { align: 'center', color: C.gold });
  // Elevators past the gate.
  for (const ex of [372, 422]) {
    rect(g, ex - 2, 54, 44, 64, '#3d4150');
    rect(g, ex, 58, 40, 60, '#a8aebe');
    rect(g, ex + 19, 58, 2, 60, '#6a7084');
    rect(g, ex + 12, 46, 16, 7, C.border);
    drawText(g, String(((ex / 2 + Math.floor(t)) % 40) + 1), ex + 20, 46, { align: 'center', color: C.warn });
  }
  // Plant.
  rect(g, 66, 96, 14, 14, '#8a5a3a');
  rect(g, 64, 80, 6, 16, '#3a8a4a');
  rect(g, 72, 74, 6, 22, '#4aa05a');
  rect(g, 78, 84, 5, 12, '#3a8a4a');
  // Floor + red carpet queue.
  rect(g, 0, 118, W, 86, '#c4b99c');
  for (const y of [126, 138, 154, 176, 200]) rect(g, 0, y, W, 1, 'rgba(0,0,0,0.08)');
  for (let x = 0; x < W; x += 36) rect(g, x, 118, 1, 86, 'rgba(0,0,0,0.05)');
  rect(g, 0, 160, GATE_X, 16, '#8a2a2a');
  rect(g, 0, 160, GATE_X, 1, '#b04040');
  // Stanchions + rope behind the queue.
  for (let x = 70; x < GATE_X - 20; x += 60) {
    rect(g, x, 140, 3, 16, '#c8a040');
    rect(g, x - 2, 155, 7, 2, '#8a6a20');
    if (x + 60 < GATE_X - 20) for (let k2 = 0; k2 < 57; k2 += 3) rect(g, x + 3 + k2, 142 + Math.round(Math.sin((k2 / 57) * Math.PI) * 4), 3, 1, '#a02a3a');
  }
}

/** Green "badge + beep" icon centred on x. */
function drawBeep(g, x, y, t) {
  x = Math.round(x);
  rect(g, x - 6, y, 12, 9, C.border);
  rect(g, x - 5, y + 1, 10, 7, '#ffffff');
  rect(g, x - 5, y + 1, 10, 2, C.good);
  rect(g, x - 4, y + 4, 3, 3, '#8a93a6');
  rect(g, x, y + 4, 4, 1, '#8a93a6');
  rect(g, x, y + 6, 3, 1, '#8a93a6');
  if (Math.floor(t * 4) % 2 === 0) {
    rect(g, x + 8, y + 1, 1, 7, C.good);
    rect(g, x + 10, y, 1, 9, C.good);
  }
}

function drawVisitorTag(g, x, y) {
  x = Math.round(x);
  rect(g, x - 11, y - 1, 22, 11, C.border);
  rect(g, x - 10, y, 20, 9, '#f29c38');
  drawText(g, 'VIS', x, y + 1, { align: 'center', color: '#3a2000' });
}

function bubble(g, x, bottom, text, angry) {
  const lines = wrapText(text, 96).slice(0, 3);
  const w = Math.max(...lines.map((l) => measureText(l))) + 10;
  const h = lines.length * 10 + 6;
  const bx = Math.round(clamp(x - w / 2, 4, W - 4 - w));
  const by = Math.round(bottom - h - 4);
  rect(g, bx, by, w, h, C.border);
  rect(g, bx + 1, by + 1, w - 2, h - 2, angry ? '#fff6e8' : '#ffffff');
  const tx = Math.round(clamp(x, bx + 4, bx + w - 6));
  rect(g, tx, by + h - 1, 4, 2, angry ? '#fff6e8' : '#ffffff');
  rect(g, tx + 1, by + h + 1, 2, 2, C.border);
  lines.forEach((l, k) => drawText(g, l, bx + 5, by + 4 + k * 10, { color: C.ink }));
}

function drawGuard(g, x, feet, alert) {
  rect(g, x - 5, feet - 14, 4, 14, '#1d2340');
  rect(g, x + 1, feet - 14, 4, 14, '#1d2340');
  rect(g, x - 6, feet - 2, 5, 2, '#111');
  rect(g, x + 1, feet - 2, 5, 2, '#111');
  rect(g, x - 7, feet - 32, 14, 18, '#2a3560');
  rect(g, x - 6, feet - 30, 3, 2, C.gold);
  rect(g, x - 5, feet - 44, 10, 12, '#d9a273');
  rect(g, x - 6, feet - 47, 12, 4, '#1d2340');
  rect(g, x - 8, feet - 44, 6, 1, '#1d2340');
  rect(g, x - 4, feet - 40, 2, 2, '#111');
  if (alert) {
    rect(g, x - 13, feet - 44, 3, 14, '#2a3560');
    rect(g, x - 14, feet - 48, 5, 5, '#d9a273');
  } else rect(g, x - 9, feet - 31, 3, 14, '#2a3560');
}

/** Person seen from the side, centred on p.x, feet on p.y. `left` = facing left. */
function drawPerson(g, p, yo, left) {
  const x = Math.round(p.x);
  const feet = p.y + yo;
  const step = Math.floor(Math.abs(p.x) / 6) % 2;
  const dir = left ? -1 : 1;
  if (p.outfit === 'duck') return drawDuck(g, x, feet, step, dir, p);
  // Legs + shoes.
  rect(g, x - 5, feet - 14, 4, 14 - step * 2, p.pants);
  rect(g, x + 1, feet - 14, 4, 12 + step * 2, p.pants);
  rect(g, x - 6 + step * dir, feet - 2, 5, 2, '#141414');
  rect(g, x + 1 - step * dir, feet - 2, 5, 2, '#141414');
  // Torso.
  const top = p.suit ? '#2a2d38' : p.shirt;
  rect(g, x - 7, feet - 32, 14, 18, top);
  if (p.suit) {
    rect(g, x - 2, feet - 32, 4, 9, '#f0f0f0');
    rect(g, x - 1, feet - 31, 2, 10, p.tie);
  }
  if (p.outfit === 'hivis') {
    rect(g, x - 7, feet - 32, 14, 18, '#d8f030');
    rect(g, x - 7, feet - 25, 14, 2, '#d0d4e0');
    rect(g, x - 7, feet - 19, 14, 2, '#d0d4e0');
  }
  // Badge / sticker on the chest.
  if (p.kind === 'emp') {
    rect(g, x - 3, feet - 32, 1, 6, '#2050c0');
    rect(g, x + 3, feet - 32, 1, 6, '#2050c0');
    rect(g, x - 3, feet - 26, 7, 6, '#ffffff');
    rect(g, x - 3, feet - 26, 7, 2, C.accent);
  } else if (p.kind === 'visitor') {
    rect(g, x - 1 + dir * 2, feet - 28, 6, 4, '#f29c38');
    rect(g, x + dir * 2, feet - 27, 4, 1, '#ffffff');
  }
  // Head.
  rect(g, x - 5, feet - 44, 10, 12, p.skin);
  rect(g, x - 5, feet - 46, 10, 4, p.hair);
  rect(g, x - 5 * dir - (dir > 0 ? 0 : 2), feet - 44, 2, p.long ? 10 : 5, p.hair);
  rect(g, x + 2 * dir - (dir > 0 ? 0 : 1), feet - 40, 2, 2, '#111');
  if (p.glasses) rect(g, x + 1 * dir - (dir > 0 ? 0 : 3), feet - 41, 4, 1, '#111');
  rect(g, x + 3 * dir - (dir > 0 ? 0 : 1), feet - 36, 2, 1, '#7a3b3b');
  // Arm (swinging) and props.
  const sleeve = p.outfit === 'hivis' ? '#d8f030' : top;
  if (p.outfit === 'ladder') {
    rect(g, x + 2 * dir - (dir > 0 ? 0 : 3), feet - 31, 3, 9, sleeve);
    const lx = x - 30;
    rect(g, lx, feet - 30, 62, 2, '#c08552');
    rect(g, lx, feet - 23, 62, 2, '#c08552');
    for (let k = 0; k < 62; k += 7) rect(g, lx + k, feet - 28, 2, 5, '#a06a3a');
  } else if (p.outfit === 'pizza') {
    for (let k = 0; k < 3; k++) {
      rect(g, x + 2 * dir - (dir > 0 ? 0 : 16), feet - 25 - k * 4, 16, 4, C.border);
      rect(g, x + 2 * dir - (dir > 0 ? 0 : 16) + 1, feet - 24 - k * 4, 14, 2, k % 2 ? '#f0e8d8' : '#e8d0a0');
    }
    rect(g, x - 6, feet - 48, 12, 3, '#c0392b');
    rect(g, x + 4 * dir - (dir > 0 ? 0 : 4), feet - 46, 4, 1, '#c0392b');
  } else if (p.outfit === 'hivis') {
    rect(g, x + 2 * dir - (dir > 0 ? 0 : 3), feet - 31, 3, 10, sleeve);
    rect(g, x + 4 * dir - (dir > 0 ? 0 : 7), feet - 28, 7, 9, '#9a6b42');
    rect(g, x + 4 * dir - (dir > 0 ? 0 : 7) + 1, feet - 27, 5, 7, '#f4f1e8');
    rect(g, x - 6, feet - 48, 12, 3, '#f2c14e');
  } else {
    const sw = step ? 2 : -2;
    rect(g, x - 1 + sw * dir, feet - 31, 3, 13, sleeve);
    rect(g, x - 1 + sw * dir, feet - 18, 3, 2, p.skin);
  }
}

function drawDuck(g, x, feet, step, dir, p) {
  const Y = '#f2d23c';
  const O = '#f29c38';
  rect(g, x - 5, feet - 6, 3, 6 - step, O);
  rect(g, x + 2, feet - 6, 3, 5 + step, O);
  rect(g, x - 7 + (dir > 0 ? 0 : -2), feet - 2, 7, 2, O);
  rect(g, x + 1 + (dir > 0 ? 2 : 0), feet - 2, 7, 2, O);
  rect(g, x - 10, feet - 30, 20, 24, Y);
  rect(g, x - 10, feet - 30, 20, 2, '#fff07a');
  rect(g, x - 11 * dir - (dir > 0 ? 0 : 3), feet - 26, 3, 10, '#e0be28'); // tail
  rect(g, x + 4 * dir - (dir > 0 ? 0 : 6), feet - 24, 6, 9, '#e0be28'); // wing
  rect(g, x - 7, feet - 46, 14, 16, Y);
  rect(g, x + 7 * dir - (dir > 0 ? 0 : 7), feet - 39, 7, 4, O);
  rect(g, x + 2 * dir - (dir > 0 ? 0 : 2), feet - 43, 2, 2, '#111');
  if (p.kind === 'emp') {
    rect(g, x - 3, feet - 30, 1, 5, '#2050c0');
    rect(g, x + 3, feet - 30, 1, 5, '#2050c0');
    rect(g, x - 3, feet - 25, 7, 6, '#ffffff');
    rect(g, x - 3, feet - 25, 7, 2, C.accent);
  } else if (p.kind === 'visitor') {
    rect(g, x - 2, feet - 26, 6, 4, '#f29c38');
    rect(g, x - 1, feet - 25, 4, 1, '#ffffff');
  }
}
