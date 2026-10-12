// Sunbathe (vacation hotel): the side facing the sun slowly tans. Turn over while it is golden: too early and you are
// still pale, too late and you are a lobster. Four turns, a wide golden window.
import { W, H, C, rect, drawText, header, timerBar, Floaters, Countdown, finish } from '../engine/mgkit.js';

const TURNS = 4;
const RATE = 0.2; // tan per second
const GOLD = [0.5, 0.92];

const lerpColor = (a, b, k) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const skin = (tan) => (tan < 0.7 ? lerpColor('#f6e0c8', '#d9a273', tan / 0.7) : lerpColor('#d9a273', '#e2504a', Math.min(1, (tan - 0.7) / 0.3)));

export default {
  id: 'sunbathe',
  name: 'Golden Brown',
  help: 'Your side facing the sun tans. Press SPACE or click to turn over while the tan is golden, before you burn. Four turns.',
  create({ theme, sfx = () => {} }) {
    const total = new Countdown(40);
    const fl = new Floaters();
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
        rect(g, 0, 0, W, H, '#ecd9a0');
        for (let i = 0; i < 60; i++) rect(g, (i * 97) % W, 20 + ((i * 53) % (H - 20)), 1, 1, '#d9c283');
        // The sun, rays turning.
        const sx = 410;
        const sy = 50;
        for (let k = 0; k < 8; k++) {
          const a = t * 0.6 + (k * Math.PI) / 4;
          rect(g, sx + Math.cos(a) * 26 - 2, sy + Math.sin(a) * 26 - 2, 4, 4, '#f29c38');
        }
        rect(g, sx - 14, sy - 14, 28, 28, '#f2e14e');
        // The towel and you on it, seen from above.
        rect(g, 150, 110, 180, 70, '#2fa39a');
        for (let x = 150; x < 330; x += 12) rect(g, x, 110, 6, 70, '#5fd0c8');
        const c = skin(tan);
        const lift = flip > 0 ? Math.round(Math.sin((flip / 0.4) * Math.PI) * 8) : 0;
        const y = 132 - lift;
        rect(g, 172, y + 2, 26, 22, back ? '#5a3a22' : c);
        if (!back) rect(g, 178, y + 9, 3, 3, '#1a1a22'), rect(g, 189, y + 9, 3, 3, '#1a1a22'), rect(g, 176, y, 20, 5, '#5a3a22');
        rect(g, 198, y, 70, 26, c);
        rect(g, 210, y + 4, 40, 18, back ? c : '#e85d75');
        if (back) rect(g, 214, y + 10, 32, 6, '#e85d75');
        rect(g, 268, y + 4, 44, 8, c);
        rect(g, 268, y + 14, 44, 8, c);
        rect(g, 204, y - 6, 40, 6, c);
        rect(g, 204, y + 26, 40, 6, c);
        // The tan meter: pale, golden, burnt.
        const mx = 60;
        const my = 70;
        const mh = 140;
        rect(g, mx - 1, my - 1, 18, mh + 2, '#1a1a22');
        rect(g, mx, my, 16, mh, '#f6e0c8');
        rect(g, mx, my + mh * (1 - GOLD[1]), 16, mh * (GOLD[1] - GOLD[0]), '#f2c14e');
        rect(g, mx, my, 16, mh * (1 - GOLD[1]), '#e2504a');
        const ty = my + mh * (1 - Math.min(1, tan));
        rect(g, mx - 4, ty - 1, 24, 3, '#1a1a22');
        drawText(g, 'TAN', mx + 8, my + mh + 6, { align: 'center', color: '#5a3a22' });
        drawText(g, back ? 'Back in the sun' : 'Front in the sun', W / 2, 200, { align: 'center', color: '#5a3a22' });
        drawText(g, 'Turn over while the tan is golden', W / 2, 24, { align: 'center', color: '#5a3a22' });
        header(g, theme?.title || 'Sunbathe', `Golden ${good}/${TURNS}`);
        timerBar(g, total.left, total.total);
        fl.render(g);
      },
    };
    return inst;
  },
};
