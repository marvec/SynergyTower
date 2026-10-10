// Magic Chart: tune the mystery knobs, sliders and switches until the quarterly chart climbs to the target line.
// Every control has a hidden sweet spot; the closer the whole panel is, the steeper the chart rises.
import { W, C, rect, frame, drawText, backdrop, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { CHART_TITLES, SLIDER_LABELS, KNOB_LABELS, SWITCH_LABELS } from '../data/mg-chart.js';

const ROUNDS = 3;
const START_V = 25;
const SAMPLE_DT = 0.1;
const VISIBLE = 150;
const SPEED = 125; // chart units per second per point of quality above the threshold
const FALL = 0.3; // below the threshold the chart sinks slower, so there is time to read it
const RANGE = { slider: 10, knob: 7, switch: 1 };
const PANEL_Y = 166;
const CELL_H = 96;

export default {
  id: 'chart',
  name: 'Magic Chart',
  help: 'Tune the knobs, sliders and switches until the chart climbs to the target. ←/→ pick, ↑/↓ adjust (or click / drag / wheel).',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const fl = new Floaters();
    const shake = new Shake();
    const total = new Countdown(byDiff(d, 85, 80));
    const threshold = byDiff(d, 0.78, 0.81);
    const driftEvery = d >= 0.5 ? byDiff(d, 16, 10) : Infinity;
    const title = rng.pick(CHART_TITLES[theme?.dept] || CHART_TITLES.default);

    // Panel layout: 3 controls at d=0 up to 6 at d=1, always at least one of each kind.
    const n = Math.round(byDiff(d, 3, 6));
    const kinds = ['slider', 'knob', 'switch', 'slider', 'knob', 'switch'].slice(0, n);
    const labels = { slider: rng.shuffle([...SLIDER_LABELS]), knob: rng.shuffle([...KNOB_LABELS]), switch: rng.shuffle([...SWITCH_LABELS]) };
    const cellW = Math.min(76, Math.floor((W - 20) / n));
    const x0 = Math.round((W - cellW * n) / 2);
    const controls = rng.shuffle(kinds).map((kind, i) => ({
      kind,
      label: labels[kind].pop(),
      value: kind === 'switch' ? rng.int(0, 1) : rng.int(0, RANGE[kind]),
      target: 0,
      x: x0 + i * cellW,
      w: cellW,
    }));

    let round = 0;
    let v = START_V;
    let hist = [];
    let acc = 0;
    let driftT = driftEvery;
    let focus = 0;
    let drag = -1;
    let flash = 0;

    const closeness = (c) => 1 - Math.abs(c.value - c.target) / RANGE[c.kind];
    const quality = () => controls.reduce((s, c) => s + closeness(c), 0) / controls.length;
    const slope = () => {
      const q = quality() - threshold;
      return q * SPEED * (q < 0 ? FALL : 1);
    };

    /** New hidden sweet spots, mostly away from the current settings so every quarter needs re-tuning. */
    function newTargets() {
      for (const c of controls) {
        const r = RANGE[c.kind];
        if (c.kind === 'switch') c.target = rng.chance(0.75) ? 1 - c.value : c.value;
        else {
          let t = rng.int(0, r);
          for (let k = 0; k < 6 && Math.abs(t - c.value) < r * 0.35; k++) t = rng.int(0, r);
          c.target = t;
        }
      }
      // Make sure the quarter starts in decline.
      if (quality() >= threshold) {
        const c = controls.find((c) => c.kind !== 'switch');
        c.target = c.value > RANGE[c.kind] / 2 ? 0 : RANGE[c.kind];
      }
      v = START_V;
      hist = Array(VISIBLE).fill(START_V);
    }
    newTargets();

    const score = () => clamp((round + Math.max(0, (v - START_V) / (100 - START_V))) / ROUNDS, 0, 1);

    function adjust(i, delta) {
      const c = controls[i];
      if (!c) return;
      const before = c.value;
      if (c.kind === 'switch') c.value = 1 - c.value;
      else c.value = clamp(c.value + delta, 0, RANGE[c.kind]);
      if (c.value !== before) sfx('click');
    }

    function hitCell(p) {
      return controls.findIndex((c) => p.x >= c.x && p.x < c.x + c.w && p.y >= PANEL_Y && p.y < PANEL_Y + CELL_H);
    }
    const trackOf = (c) => ({ x: c.x + c.w / 2 - 4, y: PANEL_Y + 22, w: 8, h: 50 });

    function setFromTrack(i, p) {
      const c = controls[i];
      const t = trackOf(c);
      const nv = Math.round(clamp(1 - (p.y - t.y) / t.h, 0, 1) * RANGE.slider);
      if (nv !== c.value) {
        c.value = nv;
        sfx('click');
      }
    }

    const inst = {
      done: false,
      score: 0,
      peek: () => ({ controls, focus, slope: slope() }), // tests: a bot that knows the sweet spots
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        flash = Math.max(0, flash - dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());

        // Keyboard.
        for (let k = 0; k < controls.length; k++) if (input.pressedExact(String(k + 1))) focus = k;
        if (input.pressed('ArrowLeft')) focus = (focus + controls.length - 1) % controls.length;
        if (input.pressed('ArrowRight')) focus = (focus + 1) % controls.length;
        if (input.pressed('ArrowUp')) adjust(focus, 1);
        if (input.pressed('ArrowDown')) adjust(focus, -1);
        if (input.confirm() && controls[focus].kind !== 'slider') {
          const c = controls[focus];
          if (c.kind === 'knob') {
            c.value = (c.value + 1) % (RANGE.knob + 1);
            sfx('click');
          } else adjust(focus, 0);
        }

        // Mouse: drag sliders, click knobs (left half turns down, right half up) and switches; wheel adjusts.
        const p = input.pointer;
        const cell = hitCell(p);
        if (cell >= 0 && p.moved && drag < 0) focus = cell;
        if (p.clicked && cell >= 0) {
          focus = cell;
          const c = controls[cell];
          if (c.kind === 'slider') {
            drag = cell;
            setFromTrack(cell, p);
          } else if (c.kind === 'knob') adjust(cell, p.x < c.x + c.w / 2 ? -1 : 1);
          else adjust(cell, 0);
        }
        if (drag >= 0) {
          if (p.down) setFromTrack(drag, p);
          else drag = -1;
        }
        const wh = input.wheel();
        if (wh && cell >= 0) adjust(cell, wh < 0 ? 1 : -1);

        // Market shifts on hard: one sweet spot wanders off.
        driftT -= dt;
        if (driftT <= 0) {
          driftT = driftEvery;
          const movable = controls.filter((c) => c.kind !== 'switch');
          const c = rng.pick(movable);
          const step = rng.chance(0.5) ? 1 : -1;
          c.target = clamp(c.target + (c.target + step < 0 || c.target + step > RANGE[c.kind] ? -step : step), 0, RANGE[c.kind]);
          fl.add('Market shift!', W / 2, 60, C.warn);
        }

        // Chart.
        acc += dt;
        while (acc >= SAMPLE_DT) {
          acc -= SAMPLE_DT;
          const noise = (rng.next() - 0.5) * 1.2;
          v = clamp(v + slope() * SAMPLE_DT + noise, 0, 100);
          hist.push(v);
          if (hist.length > VISIBLE) hist.shift();
          if (v >= 100) {
            round++;
            sfx('good');
            flash = 0.6;
            fl.add(`Q${round} target smashed!`, W / 2, 70, C.good);
            if (round >= ROUNDS) return finish(inst, 1);
            newTargets();
            fl.add('New quarter, new chart', W / 2, 84, C.gold);
            break;
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#262b40', desk: '#4a3b30' });
        header(g, theme?.title || 'Magic Chart', `Quarter ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`);
        timerBar(g, total.left, total.total);
        const dark = controls.some((c) => c.label === 'Dark mode' && c.value);
        const s = monitor(g, 56, 30, 368, 118, dark ? '#10131c' : '#f4f6fa');
        const ink = dark ? '#c8cdd8' : '#3a3f55';
        const grid = dark ? '#1c2230' : '#dde3ee';
        rect(g, s.x, s.y, s.w, 12, C.accent);
        drawText(g, title, s.x + 4, s.y + 2);
        const sl = slope();
        drawText(g, `${sl >= 0 ? '+' : ''}${sl.toFixed(1)} / s`, s.x + s.w - 4, s.y + 2, { align: 'right', color: sl >= 0 ? '#9ff0a6' : '#ffb0a8' });
        const top = s.y + 24;
        const ch = s.h - 30;
        const yOf = (val) => Math.round(top + (1 - val / 100) * ch);
        for (let k = 0; k <= 4; k++) rect(g, s.x + 22, yOf(k * 25), s.w - 26, 1, grid);
        for (let k = 0; k <= 4; k++) drawText(g, String(k * 25), s.x + 19, yOf(k * 25) - 4, { align: 'right', color: ink });
        // Target line.
        const ty = yOf(100);
        for (let x = s.x + 22; x < s.x + s.w - 4; x += 6) rect(g, x, ty, 3, 1, C.gold);
        drawText(g, 'TARGET', s.x + 26, ty - 9, { color: C.gold });
        // Line (with a gratuitous 3D shadow if that switch is on).
        const fx = s.x + 22;
        const step = (s.w - 30) / (VISIBLE - 1);
        const three = controls.some((c) => c.label === '3D effect' && c.value);
        const drawLine = (ox, oy, colorFn) => {
          let py = yOf(hist[0]);
          for (let i = 1; i < hist.length; i++) {
            const x = Math.round(fx + i * step);
            const y = yOf(hist[i]);
            rect(g, x + ox, Math.min(py, y) + oy, Math.max(1, Math.ceil(step)), Math.abs(y - py) + 2, colorFn(i));
            py = y;
          }
        };
        if (three) drawLine(3, 3, () => (dark ? '#2a3044' : '#b8c0d0'));
        drawLine(0, 0, (i) => (hist[i] >= hist[i - 1] ? '#2fa84a' : '#d8453c'));
        if (flash > 0) {
          g.globalAlpha = flash;
          rect(g, s.x, s.y + 12, s.w, s.h - 12, C.gold);
          g.globalAlpha = 1;
        }
        // Quarter pills.
        for (let k = 0; k < ROUNDS; k++) {
          const px = s.x + s.w - 4 - (ROUNDS - k) * 26;
          rect(g, px, s.y + 14, 24, 8, k < round ? '#2f8a3a' : k === round ? C.accentDark : grid);
          drawText(g, `Q${k + 1}`, px + 12, s.y + 14, { align: 'center', color: k <= round ? '#fff' : ink });
        }

        // Control panel.
        rect(g, 4, PANEL_Y - 6, W - 8, CELL_H + 8, C.border);
        rect(g, 5, PANEL_Y - 5, W - 10, CELL_H + 6, '#3a3e4c');
        rect(g, 5, PANEL_Y - 5, W - 10, 1, '#5a5f70');
        controls.forEach((c, i) => drawControl(g, c, i, i === focus));
        fl.render(g);
        g.restore();
      },
    };

    function drawControl(g, c, i, focused) {
      const cx = Math.round(c.x + c.w / 2);
      if (focused) frame(g, c.x + 2, PANEL_Y - 2, c.w - 4, CELL_H - 2, C.gold);
      drawText(g, `${i + 1}`, c.x + 6, PANEL_Y, { color: C.dim });
      drawText(g, c.label, cx, PANEL_Y + CELL_H - 13, { align: 'center', color: focused ? C.gold : C.text });
      if (c.kind === 'slider') {
        const t = trackOf(c);
        rect(g, t.x + 2, t.y, 4, t.h, '#1a1c24');
        for (let k = 0; k <= RANGE.slider; k++) rect(g, t.x - 3, Math.round(t.y + t.h - (k / RANGE.slider) * t.h), 3, 1, '#7a7f90');
        const ky = Math.round(t.y + t.h - (c.value / RANGE.slider) * t.h);
        rect(g, t.x - 4, ky - 3, 16, 7, C.border);
        rect(g, t.x - 3, ky - 2, 14, 5, '#d8dce6');
        rect(g, t.x - 3, ky, 14, 1, '#8a90a2');
        drawText(g, String(c.value), cx + 14, ky - 3, { color: C.dim });
      } else if (c.kind === 'knob') {
        const cy = PANEL_Y + 44;
        const r = 14;
        // Scale ticks around the dial: 8 positions over 270 degrees.
        for (let k = 0; k <= RANGE.knob; k++) {
          const a = angle(k);
          rect(g, Math.round(cx + Math.cos(a) * (r + 5)), Math.round(cy + Math.sin(a) * (r + 5)), 2, 2, k === c.value ? C.gold : '#7a7f90');
        }
        for (let yy = -r; yy <= r; yy++) {
          const hw = Math.round(Math.sqrt(r * r - yy * yy));
          rect(g, cx - hw, cy + yy, hw * 2, 1, yy < -r + 2 || yy > r - 2 ? C.border : yy < 0 ? '#5a5f70' : '#4a4e5c');
        }
        const a = angle(c.value);
        for (let k = 3; k < r - 2; k++) rect(g, Math.round(cx + Math.cos(a) * k), Math.round(cy + Math.sin(a) * k), 2, 2, '#f2f4f8');
        drawText(g, '-', c.x + 8, cy - 4, { color: C.dim });
        drawText(g, '+', c.x + c.w - 10, cy - 4, { color: C.dim });
      } else {
        const sx = cx - 9;
        const sy = PANEL_Y + 26;
        rect(g, sx, sy, 18, 36, C.border);
        rect(g, sx + 1, sy + 1, 16, 34, '#22242e');
        const on = c.value === 1;
        const ky = on ? sy + 3 : sy + 19;
        rect(g, sx + 3, ky, 12, 14, on ? '#2f8a3a' : '#7a2b2b');
        rect(g, sx + 3, ky, 12, 1, 'rgba(255,255,255,0.35)');
        drawText(g, on ? 'ON' : 'OFF', cx, PANEL_Y + 66, { align: 'center', color: on ? C.good : C.dim });
      }
    }
    return inst;
  },
};

/** Knob dial angle for position k: from 135 degrees (bottom left) clockwise to 405 degrees (bottom right). */
function angle(k) {
  return ((135 + (k / RANGE.knob) * 270) * Math.PI) / 180;
}
