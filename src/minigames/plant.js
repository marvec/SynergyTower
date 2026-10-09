// Desk Plant Survival: keep your desk plant alive through one fiscal quarter (13 weeks, compressed).
// Balance water and light inside their green bands and squash the pests. The office will not help.
import { W, H, C, rect, frame, panel, drawText, header, timerBar, Floaters, Shake, byDiff, clamp, lerp, finish } from '../engine/mgkit.js';
import { CAPTIONS_GOOD, CAPTIONS_BAD, EVENTS } from '../data/mg-plant.js';

const WATER_BAND = [0.35, 0.78];
const ROT = 0.9;
const LIGHT_BAND = [0.35, 0.72];
const POT_X = 240; // pot centre
const POT_TOP = 136;
const BTNS = [
  { id: 'water', label: 'WATER', key: '1', x: 92, y: 210, w: 92, h: 26 },
  { id: 'blinds', label: 'BLINDS', key: '2', x: 194, y: 210, w: 92, h: 26 },
  { id: 'spray', label: 'SPRAY', key: '3', x: 296, y: 210, w: 92, h: 26 },
];
const WINDOW = { x: 18, y: 28, w: 140, h: 120 };
// Stems: angle from vertical (radians) and length.
const STEMS = [
  { a: -0.95, len: 56 },
  { a: -0.45, len: 78 },
  { a: 0.05, len: 92 },
  { a: 0.5, len: 76 },
  { a: 1.0, len: 54 },
];
const POSTER = { lobby: 'WELCOME', support: 'PATIENCE', sales: 'CLOSING', marketing: 'VIRALITY', it: 'UPTIME', finance: 'ROI', legalhr: 'POLICY', exec: 'VISION' };
const inBox = (p, b) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;

function mix(c1, c2, t) {
  t = clamp(t, 0, 1);
  const a = parseInt(c1.slice(1), 16);
  const b = parseInt(c2.slice(1), 16);
  const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export default {
  id: 'plant',
  name: 'Desk Plant Survival',
  help: 'Keep water and light in the green bands and squash pests. 1/W water, 2/B blinds, 3/SPACE spray, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const fl = new Floaters();
    const shake = new Shake();
    const Q = byDiff(d, 45, 55);
    const weekLen = Q / 13;
    const drainBase = byDiff(d, 0.04, 0.062);
    const lightRate = byDiff(d, 0.06, 0.09);
    const bugEvery = byDiff(d, 4.6, 2.4);
    const eventEvery = byDiff(d, 9, 5.5);
    const dmgMul = byDiff(d, 0.85, 1.15);

    let t = 0;
    let water = 0.6;
    let light = 0.5;
    let blindsOpen = false;
    let health = 0.75;
    let weighted = 0;
    let week = 1;
    let caption = 'W1: Plant onboarded. Badge pending.';
    let captionT = 0;
    let bugs = [];
    let bugT = 3;
    let eventT = eventEvery * 0.7;
    let ev = null; // banner { text, sub, t }
    let acT = 0;
    let heatT = 0;
    let weekendT = 0;
    let waterCd = 0;
    let sprayCd = 0;
    let canAnim = 0;
    let mist = 0;
    let mistToMonitor = false;
    let monitorWet = 0;
    let anim = 0;
    let focus = 0;
    const deck = { good: rng.shuffle(CAPTIONS_GOOD), bad: rng.shuffle(CAPTIONS_BAD), gi: 0, bi: 0 };
    const evDeck = rng.shuffle(EVENTS);
    let evi = 0;

    const droop = () => clamp((0.7 - health) / 0.6, 0, 1);
    const stemPoint = (s, u) => {
      const side = Math.sign(s.a) || 1;
      const dr = droop();
      const a = s.a * (1 + dr * 0.6);
      const L = s.len * (1 - dr * 0.15);
      return {
        x: POT_X + Math.sin(a) * L * u + side * dr * 10 * u * u,
        y: POT_TOP - Math.cos(a) * L * u + dr * 30 * u * u,
      };
    };
    const bugPos = (b) => {
      const p = stemPoint(STEMS[b.stem], b.u);
      return { x: p.x + b.ox, y: p.y + b.oy };
    };
    const score = () => weighted / Q; // weights average 1.0 over the quarter

    function act(id) {
      if (weekendT > 0) {
        fl.add('Office closed!', POT_X, 120, C.dim);
        sfx('click');
        return;
      }
      if (id === 'water') {
        if (waterCd > 0) return;
        waterCd = 0.3;
        water = clamp(water + 0.2, 0, 1.05);
        canAnim = 0.6;
        sfx('blip');
        if (water > ROT) fl.add('Glug... too much!', POT_X, POT_TOP + 6, C.warn);
      } else if (id === 'blinds') {
        blindsOpen = !blindsOpen;
        sfx('click');
        fl.add(blindsOpen ? 'Blinds up' : 'Blinds down', WINDOW.x + WINDOW.w / 2, WINDOW.y + 60, C.text);
      } else if (id === 'spray') {
        if (sprayCd > 0) return;
        sprayCd = 0.4;
        mist = 0.5;
        if (bugs.length) {
          fl.add(bugs.length > 1 ? `-${bugs.length} pests` : 'Squashed!', POT_X, 60, C.good);
          bugs = [];
          mistToMonitor = false;
          sfx('good');
        } else {
          mistToMonitor = true;
          monitorWet = 2.5;
          health = Math.max(0, health - 0.05);
          shake.hit(0.2);
          fl.add('You sprayed your monitor.', 330, 120, C.bad);
          sfx('bad');
        }
      }
    }

    function spawnBug() {
      if (bugs.length >= 10) return;
      bugs.push({ stem: rng.int(0, STEMS.length - 1), u: rng.float(0.35, 1), ox: rng.int(-4, 4), oy: rng.int(-3, 2), ph: rng.float(0, 6) });
    }

    function fireEvent() {
      const e = evDeck[evi++ % evDeck.length];
      ev = { text: e.text, sub: e.sub, t: 2.8 };
      sfx('ding');
      if (e.kind === 'ac') acT = 7;
      else if (e.kind === 'coffee') water = clamp(water + 0.3, 0, 1.05);
      else if (e.kind === 'weekend') weekendT = byDiff(d, 2, 2.5);
      else if (e.kind === 'window') light = clamp(light + 0.35, 0, 1);
      else if (e.kind === 'fruit') for (let i = 0; i < 3; i++) spawnBug();
      else if (e.kind === 'intern') water = clamp(water + 0.25, 0, 1.05);
      else if (e.kind === 'heat') heatT = 6;
      else if (e.kind === 'audit') blindsOpen = true;
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        canAnim = Math.max(0, canAnim - dt);
        mist = Math.max(0, mist - dt);
        monitorWet = Math.max(0, monitorWet - dt);
        captionT += dt;
        if (ev) {
          ev.t -= dt;
          if (ev.t <= 0) ev = null;
        }
        if (inst.done) return;
        t += dt;
        waterCd = Math.max(0, waterCd - dt);
        sprayCd = Math.max(0, sprayCd - dt);
        acT = Math.max(0, acT - dt);
        heatT = Math.max(0, heatT - dt);
        weekendT = Math.max(0, weekendT - dt);

        // Weeks.
        const wk = Math.min(13, 1 + Math.floor(t / weekLen));
        if (wk !== week) {
          week = wk;
          captionT = 0;
          const good = health >= 0.5;
          const list = good ? deck.good : deck.bad;
          const txt = list[(good ? deck.gi++ : deck.bi++) % list.length];
          caption = `W${week}: ${txt}`;
          if (week === 13) caption = 'W13: Quarter close! Hold on...';
        }

        // Needs drift.
        let drain = drainBase;
        if (acT > 0) drain *= 0.4;
        if (heatT > 0) drain *= 2;
        if (weekendT > 0) drain *= 1.5;
        water = Math.max(0, water - drain * dt);
        light = clamp(light + (blindsOpen ? lightRate : -lightRate) * dt, 0, 1);
        bugT -= dt;
        if (bugT <= 0) {
          bugT = bugEvery * rng.float(0.7, 1.3);
          spawnBug();
        }
        eventT -= dt;
        if (eventT <= 0 && t < Q - 3) {
          eventT = eventEvery * rng.float(0.8, 1.25);
          fireEvent();
        }

        // Health integrates over time.
        let dh = 0;
        if (water < WATER_BAND[0]) dh -= 0.04 + 0.25 * (WATER_BAND[0] - water);
        else if (water > WATER_BAND[1]) dh -= 0.03 + 0.45 * (water - WATER_BAND[1]);
        else dh += 0.025;
        if (light < LIGHT_BAND[0]) dh -= 0.03 + 0.25 * (LIGHT_BAND[0] - light);
        else if (light > LIGHT_BAND[1]) dh -= 0.03 + 0.25 * (light - LIGHT_BAND[1]);
        else dh += 0.025;
        dh += bugs.length ? -0.022 * bugs.length : 0.015;
        health = clamp(health + (dh < 0 ? dh * dmgMul : dh) * dt, 0, 1);
        weighted += health * (0.5 + t / Q) * dt;
        if (health <= 0) {
          fl.add('Your plant has filed for a transfer.', W / 2, 110, C.bad);
          sfx('fail');
          return finish(inst, Math.min(0.3, score()));
        }
        if (t >= Q) {
          sfx('star');
          return finish(inst, score());
        }

        // Input.
        if (input.pressedExact('1') || input.pressedExact('w')) act('water');
        if (input.pressedExact('2') || input.pressedExact('b')) act('blinds');
        if (input.pressedExact('3') || input.pressedExact('Space')) act('spray');
        if (input.pressed('ArrowLeft')) focus = (focus + 2) % 3;
        if (input.pressed('ArrowRight')) focus = (focus + 1) % 3;
        if (input.pressedExact('Enter')) act(BTNS[focus].id);
        const p = input.pointer;
        if (p.clicked) {
          let hit = false;
          // Individual bugs first (front-most last).
          for (let i = bugs.length - 1; i >= 0 && !hit; i--) {
            const bp = bugPos(bugs[i]);
            if (Math.abs(p.x - bp.x) <= 6 && Math.abs(p.y - bp.y) <= 6) {
              hit = true;
              if (weekendT > 0) fl.add('Office closed!', POT_X, 120, C.dim);
              else {
                bugs.splice(i, 1);
                sfx('good');
                fl.add('squish', bp.x, bp.y - 6, C.good);
              }
            }
          }
          for (let i = 0; i < BTNS.length && !hit; i++)
            if (inBox(p, BTNS[i])) {
              hit = true;
              focus = i;
              act(BTNS[i].id);
            }
          if (!hit && inBox(p, WINDOW)) act('blinds');
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        drawWall(g);
        drawWindow(g);
        drawCalendar(g);
        drawDesk(g);
        drawPlant(g);
        drawEffects(g);
        drawVitals(g);
        drawButtons(g);
        if (weekendT > 0) {
          g.fillStyle = 'rgba(8,10,18,0.55)';
          g.fillRect(0, 18, W, H - 18);
          drawText(g, 'WEEKEND', W / 2, 92, { align: 'center', color: C.gold, shadow: C.border, scale: 3 });
          drawText(g, 'Office closed. The plant is on its own.', W / 2, 122, { align: 'center', color: C.text, shadow: C.border });
        }
        if (ev) {
          panel(g, 92, 22, 296, 30, { fill: '#5a3a1a', light: '#8a5a2a', dark: '#3a2410' });
          drawText(g, ev.text, W / 2, 27, { align: 'center', color: C.gold });
          drawText(g, ev.sub, W / 2, 38, { align: 'center', color: C.text });
        }
        const cy = captionT < 0.25 ? 242 + Math.round((0.25 - captionT) * 20) : 242;
        drawText(g, caption, W / 2, cy, { align: 'center', color: health >= 0.5 ? C.so : C.warn, shadow: C.border });
        drawText(g, '1/W water  2/B blinds  3/SPACE spray  - or click (bugs too)', W / 2, 256, { align: 'center', color: C.dim });
        header(g, theme?.title || 'Desk Plant Survival', `Week ${week}/13`);
        timerBar(g, Q - t, Q);
        fl.render(g);
        g.restore();
      },
    };

    // --- Rendering ---
    function drawWall(g) {
      rect(g, 0, 0, W, H, '#4a5470');
      for (let x = 0; x < W; x += 24) rect(g, x, 18, 1, 152, 'rgba(0,0,0,0.07)');
      // Motivational poster.
      rect(g, 172, 84, 46, 58, C.border);
      rect(g, 173, 85, 44, 56, '#2a3a5a');
      rect(g, 180, 92, 30, 20, '#6a8ab0');
      rect(g, 186, 100, 18, 12, '#e8e8f0');
      drawText(g, POSTER[theme?.dept] || 'GROWTH', 195, 120, { align: 'center', color: C.gold });
      drawText(g, 'is fun', 195, 130, { align: 'center', color: C.dim });
    }

    function drawWindow(g) {
      const { x, y, w, h } = WINDOW;
      rect(g, x - 4, y - 4, w + 8, h + 8, '#d8d8e0');
      rect(g, x - 3, y - 3, w + 6, h + 6, '#b0b0bc');
      // Sky by light level.
      const sky = mix('#2a3a6a', '#8ac8ff', light);
      rect(g, x, y, w, h, sky);
      rect(g, x + w - 34, y + 14, 16, 16, mix('#c8c060', '#fff090', light));
      const bld = [[0, 70, 24], [26, 52, 20], [48, 80, 28], [80, 60, 22], [104, 88, 36]];
      for (const [bx, bh, bw] of bld) {
        rect(g, x + bx, y + h - bh * 0.7, bw, bh * 0.7, '#3a4058');
        for (let wy = y + h - bh * 0.7 + 4; wy < y + h - 4; wy += 7) for (let wx = x + bx + 3; wx < x + bx + bw - 3; wx += 6) rect(g, wx, wy, 2, 3, '#f2d27a');
      }
      if (acT > 0) {
        for (let i = 0; i < 8; i++) rect(g, x + i * 3, y, 2, 10 - i, '#e8f6ff');
        for (let i = 0; i < 8; i++) rect(g, x + w - 2 - i * 3, y, 2, 10 - i, '#e8f6ff');
      }
      // Blinds.
      if (blindsOpen) {
        rect(g, x, y, w, 12, '#e8e2d0');
        for (let k = 0; k < 4; k++) rect(g, x, y + 2 + k * 3, w, 1, '#b8b09a');
      } else {
        for (let sy = y; sy < y + h; sy += 8) {
          rect(g, x, sy, w, 7, '#e8e2d0');
          rect(g, x, sy + 6, w, 1, '#b8b09a');
        }
      }
      rect(g, x + w - 8, y, 1, blindsOpen ? 40 : h - 10, '#8a8270');
      rect(g, x + w - 9, blindsOpen ? y + 40 : y + h - 10, 3, 4, '#8a8270');
      rect(g, x + w / 2 - 1, y - 3, 2, h + 6, '#b0b0bc');
      // Sun beam toward the plant.
      if (blindsOpen && light > 0.2) {
        g.fillStyle = `rgba(255,240,170,${(0.08 + light * 0.12).toFixed(3)})`;
        for (let k = 0; k < 30; k++) g.fillRect(x + w + k * 3, y + 30 + k * 3, 40, 3);
      }
    }

    function drawCalendar(g) {
      const x = 172;
      const y = 26;
      rect(g, x, y, 46, 50, C.border);
      rect(g, x + 1, y + 1, 44, 48, '#f4f1e8');
      rect(g, x + 1, y + 1, 44, 10, '#c03030');
      drawText(g, 'Q3', x + 23, y + 2, { align: 'center', color: '#fff' });
      drawText(g, `W${week}`, x + 23, y + 18, { align: 'center', color: C.ink, scale: 2 });
      for (let k = 0; k < 13; k++) rect(g, x + 4 + k * 3, y + 40, 2, 4, k < week ? '#c03030' : '#c8c0b0');
    }

    function drawDesk(g) {
      rect(g, 0, 170, W, 36, '#7a5236');
      rect(g, 0, 170, W, 2, '#9a6a46');
      rect(g, 0, 204, W, H - 204, '#20243a');
      // Monitor.
      const mx = 300;
      rect(g, mx + 22, 156, 8, 14, '#2b2e38');
      rect(g, mx + 12, 168, 28, 3, '#2b2e38');
      rect(g, mx, 112, 52, 46, C.border);
      rect(g, mx + 3, 115, 46, 38, monitorWet > 0 ? '#9ab8d8' : '#e9eef5');
      rect(g, mx + 3, 115, 46, 6, '#1f7a44');
      for (let r = 0; r < 4; r++) rect(g, mx + 6, 125 + r * 7, 30 - r * 4, 2, '#a0a8b8');
      if (monitorWet > 0) for (let k = 0; k < 7; k++) rect(g, mx + 6 + k * 6, 118 + ((k * 11 + Math.floor(anim * 20)) % 30), 1, 3, '#5a8ab8');
      // Mug with pens.
      rect(g, 120, 156, 12, 14, '#3b6fb6');
      rect(g, 122, 150, 1, 7, C.gold);
      rect(g, 126, 148, 1, 9, C.bad);
      rect(g, 129, 151, 1, 6, '#111');
    }

    function drawPlant(g) {
      const h = health;
      const lowLight = light < LIGHT_BAND[0];
      const highLight = light > LIGHT_BAND[1];
      let leaf = '#3fae4f';
      if (lowLight) leaf = mix('#3fae4f', '#c8d890', (LIGHT_BAND[0] - light) / 0.35 + 0.3);
      if (highLight) leaf = mix('#3fae4f', '#c8a040', (light - LIGHT_BAND[1]) / 0.28 + 0.2);
      leaf = mix(leaf, '#8a6a3a', clamp((0.55 - h) / 0.45, 0, 1));
      const dark = mix(leaf, '#000000', 0.3);
      const stem = mix('#2f7a3a', '#6a5030', clamp((0.5 - h) / 0.5, 0, 1));
      const happy = h > 0.85 ? Math.sin(anim * 4) : 0;
      // Stems and leaves.
      STEMS.forEach((s, si) => {
        for (let k = 0; k <= 60; k++) {
          const p = stemPoint(s, k / 60);
          rect(g, p.x, p.y, 2, 2, stem);
        }
        [0.4, 0.68, 0.92].forEach((u, li) => {
          const p = stemPoint(s, u);
          const side = (li + si) % 2 ? 1 : -1;
          const size = 8 + li * 2;
          drawLeaf(g, p.x, p.y + Math.round(happy * (li + 1) * 0.5), side, size, leaf, dark, droop(), highLight && (li + si) % 2 === 0);
        });
        const tip = stemPoint(s, 1);
        drawLeaf(g, tip.x, tip.y - 2, Math.sign(s.a) || 1, 10, leaf, dark, droop(), false);
      });
      // Fallen leaves when unhealthy.
      if (h < 0.45) {
        rect(g, POT_X - 34, 168, 6, 2, '#8a6a3a');
        if (h < 0.3) rect(g, POT_X + 28, 167, 5, 2, '#7a5a2a');
      }
      // Pot.
      for (let y = 0; y < 34; y++) {
        const half = 22 - Math.floor(y / 5);
        rect(g, POT_X - half, POT_TOP + y, half * 2, 1, y < 6 ? '#c8703a' : '#b0603a');
      }
      rect(g, POT_X - 24, POT_TOP, 48, 6, '#d07a4a');
      rect(g, POT_X - 24, POT_TOP, 48, 1, '#e8946a');
      // Soil: dry, fine or soggy.
      const soil = water > ROT ? '#2a1a10' : water < WATER_BAND[0] ? '#a07a50' : '#4a3020';
      rect(g, POT_X - 21, POT_TOP + 1, 42, 3, soil);
      if (water < 0.2) for (let k = -16; k < 18; k += 8) rect(g, POT_X + k, POT_TOP + 2, 3, 1, '#7a5a38');
      if (water > ROT) {
        rect(g, POT_X - 28, 168, 56, 3, '#4a6a8a');
        if (Math.floor(anim * 3) % 2) rect(g, POT_X - 6, POT_TOP - 2, 2, 2, '#8ab4d8');
      }
      // Scarf when the AC goes Arctic.
      if (acT > 0) {
        rect(g, POT_X - 22, POT_TOP + 8, 44, 4, '#c03030');
        rect(g, POT_X + 12, POT_TOP + 10, 4, 10, '#c03030');
      }
      // Face on the pot.
      const mood = h > 0.7 ? 'happy' : h > 0.4 ? 'meh' : 'sad';
      rect(g, POT_X - 8, POT_TOP + 14, 2, 3, '#3a2010');
      rect(g, POT_X + 6, POT_TOP + 14, 2, 3, '#3a2010');
      if (mood === 'happy') {
        rect(g, POT_X - 4, POT_TOP + 21, 8, 1, '#3a2010');
        rect(g, POT_X - 5, POT_TOP + 20, 1, 1, '#3a2010');
        rect(g, POT_X + 4, POT_TOP + 20, 1, 1, '#3a2010');
      } else if (mood === 'meh') rect(g, POT_X - 4, POT_TOP + 21, 8, 1, '#3a2010');
      else {
        rect(g, POT_X - 4, POT_TOP + 21, 8, 1, '#3a2010');
        rect(g, POT_X - 5, POT_TOP + 22, 1, 1, '#3a2010');
        rect(g, POT_X + 4, POT_TOP + 22, 1, 1, '#3a2010');
        if (Math.floor(anim * 2) % 2) rect(g, POT_X - 9, POT_TOP + 18, 1, 2, '#8ab4ff');
      }
      // Pests.
      for (const b of bugs) {
        const p = bugPos(b);
        const leg = Math.floor(anim * 10 + b.ph) % 2;
        rect(g, p.x - 2, p.y - 1, 5, 3, '#b02020');
        rect(g, p.x - 1, p.y - 2, 3, 1, '#e04040');
        rect(g, p.x + 3, p.y - 1, 1, 1, '#111');
        rect(g, p.x - 3 + leg, p.y + 2, 1, 1, '#111');
        rect(g, p.x + 2 - leg, p.y + 2, 1, 1, '#111');
      }
    }

    function drawLeaf(g, x, y, side, size, col, dark, dr, burnt) {
      const tilt = Math.round(dr * 4);
      for (let i = 0; i < size; i++) {
        const thick = i < size / 2 ? 1 + Math.floor(i / 1.5) : Math.max(1, Math.floor((size - i) / 1.2));
        const lx = x + side * (i + 1);
        const ly = y - Math.round((size - i) * 0.3) + Math.round((i * tilt) / size);
        rect(g, lx, ly, 1, thick + 1, col);
        if (i > 0 && i < size - 1) rect(g, lx, ly + thick, 1, 1, dark);
      }
      if (burnt) rect(g, x + side * Math.ceil(size / 2), y - 1, 1, 1, '#6a3a1a');
    }

    function drawEffects(g) {
      if (canAnim > 0) {
        const cx = POT_X + 30;
        const cy = POT_TOP - 30;
        rect(g, cx, cy, 18, 12, '#5a8a9a');
        rect(g, cx, cy, 18, 2, '#7aaaba');
        rect(g, cx - 10, cy + 2, 10, 2, '#5a8a9a');
        rect(g, cx + 17, cy + 1, 4, 8, '#5a8a9a');
        for (let k = 0; k < 5; k++) rect(g, cx - 12 - (k % 2) * 3, cy + 6 + ((k * 7 + Math.floor(anim * 40)) % 26), 1, 3, '#8ab4ff');
      }
      if (mist > 0) {
        const tx = mistToMonitor ? 326 : POT_X;
        const ty = mistToMonitor ? 130 : 70;
        for (let k = 0; k < 14; k++) {
          const f = ((k * 0.07 + (0.5 - mist)) * 2) % 1;
          rect(g, lerp(342, tx, f) + ((k * 5) % 9) - 4, lerp(208, ty, f) + ((k * 3) % 7) - 3, 2, 2, 'rgba(220,240,255,0.8)');
        }
      }
    }

    function drawVitals(g) {
      panel(g, 364, 24, 108, 142, { title: 'PLANT VITALS' });
      const row = (label, y, val, band, col) => {
        drawText(g, label, 372, y, { color: C.text });
        const bx = 372;
        const bw = 92;
        rect(g, bx, y + 10, bw, 8, C.border);
        rect(g, bx + 1, y + 11, bw - 2, 6, C.panelDark);
        if (band) rect(g, bx + 1 + Math.round(band[0] * (bw - 2)), y + 11, Math.round((band[1] - band[0]) * (bw - 2)), 6, '#2a5a34');
        const fw = Math.round(clamp(val, 0, 1) * (bw - 2));
        rect(g, bx + 1 + Math.max(0, fw - 2), y + 9, 2, 10, col);
        if (band) {
          const st = val < band[0] ? 'LOW' : val > band[1] ? 'HIGH' : 'OK';
          drawText(g, st, bx + bw, y, { align: 'right', color: st === 'OK' ? C.good : C.bad });
        }
      };
      row('Water', 42, Math.min(1, water), WATER_BAND, water > ROT ? C.bad : '#8ab4ff');
      row('Light', 66, light, LIGHT_BAND, C.gold);
      drawText(g, 'Pests', 372, 90, { color: C.text });
      drawText(g, bugs.length ? `${bugs.length}` : 'none', 464, 90, { align: 'right', color: bugs.length ? C.bad : C.good });
      for (let i = 0; i < Math.min(10, bugs.length); i++) rect(g, 372 + i * 9, 102, 5, 3, '#b02020');
      drawText(g, 'Health', 372, 116, { color: C.text });
      const hc = health > 0.6 ? C.good : health > 0.3 ? C.warn : C.bad;
      rect(g, 372, 128, 92, 10, C.border);
      rect(g, 373, 129, 90, 8, C.panelDark);
      rect(g, 373, 129, Math.round(90 * health), 8, hc);
      rect(g, 373, 129, Math.round(90 * health), 1, 'rgba(255,255,255,0.35)');
      drawText(g, blindsOpen ? 'Blinds: OPEN' : 'Blinds: CLOSED', 418, 146, { align: 'center', color: C.dim });
    }

    function drawButtons(g) {
      BTNS.forEach((b, i) => {
        const disabled = weekendT > 0;
        rect(g, b.x, b.y, b.w, b.h, C.border);
        rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, disabled ? '#3a3d4d' : C.accent);
        rect(g, b.x + 1, b.y + 1, b.w - 2, 1, 'rgba(255,255,255,0.3)');
        if (i === focus) frame(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold);
        rect(g, b.x + 4, b.y + 7, 11, 11, C.border);
        drawText(g, b.key, b.x + 10, b.y + 9, { align: 'center', color: C.gold });
        const label = b.id === 'blinds' ? (blindsOpen ? 'CLOSE' : 'OPEN') : b.label;
        drawText(g, label, b.x + 18 + (b.w - 18) / 2, b.y + 9, { align: 'center', color: disabled ? '#7a7d8d' : C.text, shadow: C.border });
        // Tiny tool icons.
        const ix = b.x + b.w - 14;
        const iy = b.y + 8;
        if (b.id === 'water') {
          rect(g, ix, iy + 2, 8, 6, '#7aaaba');
          rect(g, ix - 3, iy + 3, 3, 1, '#7aaaba');
        } else if (b.id === 'blinds') {
          for (let k = 0; k < 4; k++) rect(g, ix, iy + k * 2, 8, 1, '#e8e2d0');
        } else {
          rect(g, ix + 2, iy + 3, 5, 6, '#e8e8f0');
          rect(g, ix + 1, iy, 6, 3, '#5fd068');
        }
      });
    }

    return inst;
  },
};
