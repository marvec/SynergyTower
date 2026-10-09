// Name Badge Memory: flip badges two at a time and match the colleague pairs.
import { W, H, C, rect, frame, drawText, backdrop, header, timerBar, face, Floaters, Shake, byDiff, finish, clamp } from '../engine/mgkit.js';

const NAMES = [
  'Ada', 'Bob', 'Cleo', 'Dev', 'Eve', 'Finn', 'Gus', 'Hana', 'Ivo', 'Jade', 'Kai', 'Lena',
  'Milo', 'Nia', 'Otto', 'Pia', 'Quin', 'Rosa', 'Stan', 'Tess', 'Umar', 'Vera', 'Walt', 'Xena', 'Yuri', 'Zoe',
];
const ROLES = {
  lobby: ['Porter', 'Courier', 'Guest', 'Guard'],
  support: ['Agent', 'Lead', 'Coach', 'Caller'],
  sales: ['AE', 'SDR', 'Client', 'VP'],
  marketing: ['Brand', 'Copy', 'Social', 'SEO'],
  it: ['Dev', 'Ops', 'QA', 'SRE'],
  finance: ['Audit', 'Tax', 'AP', 'FP&A'],
  legalhr: ['HR', 'Legal', 'Recruit', 'Payroll'],
  exec: ['CEO', 'CFO', 'COO', 'Board'],
};

export default {
  id: 'memory',
  name: 'Name Badge Memory',
  help: 'Flip two badges at a time and match the pairs. Arrows + Space, or click.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const pairs = [6, 8, 10, 12][Math.round(clamp(d, 0, 1) * 3)];
    const cols = pairs <= 8 ? 4 : pairs === 10 ? 5 : 6;
    const rows = (pairs * 2) / cols;
    const roles = ROLES[theme?.dept] || ROLES.it;
    const names = rng.sample(NAMES, pairs);
    const people = names.map((name, i) => ({ name, role: roles[i % roles.length], seed: rng.int(0, 4095) }));
    const cards = rng.shuffle([...people.keys(), ...people.keys()]).map((p) => ({ p, up: false, matched: false, flip: 0 }));
    const peekTime = byDiff(d, 2.5, 0.8);
    const total = Math.min(85, pairs * byDiff(d, 6, 4.6) + 10);
    const fl = new Floaters();
    const shake = new Shake();

    const areaY = 24;
    const areaH = H - areaY - 22;
    const cw = Math.min(64, Math.floor((W - 20) / cols) - 6);
    const ch = Math.min(56, Math.floor(areaH / rows) - 6);
    const gx = Math.floor((W - cols * (cw + 6) + 6) / 2);
    const gy = areaY + Math.floor((areaH - rows * (ch + 6) + 6) / 2);
    const cx = (i) => gx + (i % cols) * (cw + 6);
    const cy = (i) => gy + Math.floor(i / cols) * (ch + 6);

    let peek = peekTime;
    let elapsed = 0;
    let open = []; // indices currently face-up (unmatched)
    let hideT = 0;
    let turns = 0;
    let found = 0;
    let cursor = 0;

    const score = () => {
      const allowed = Math.ceil(pairs * 1.6);
      const extra = Math.max(0, turns - allowed);
      const eff = clamp(1 - extra / (pairs * 2.5), 0.3, 1);
      return (found / pairs) * eff;
    };

    const hideOpen = () => {
      for (const i of open) cards[i].up = false;
      open = [];
      hideT = 0;
    };

    const flip = (i) => {
      const c = cards[i];
      if (!c || c.matched || c.up) return;
      if (open.length === 2) hideOpen();
      c.up = true;
      c.flip = 0.15;
      open.push(i);
      sfx('blip');
      if (open.length === 2) {
        turns++;
        const [a, b] = open;
        if (cards[a].p === cards[b].p) {
          cards[a].matched = cards[b].matched = true;
          open = [];
          found++;
          sfx('good');
          fl.add(people[cards[a].p].name + '!', cx(b) + cw / 2, cy(b), C.good);
          if (found === pairs) finish(inst, score());
        } else {
          hideT = 0.8;
          sfx('bad');
          shake.hit(0.12);
        }
      }
    };

    const drawBadge = (g, x, y, person, matched) => {
      rect(g, x, y, cw, ch, matched ? '#d8f0d4' : '#fbf8ef');
      frame(g, x, y, cw, ch, matched ? '#4a9a52' : '#b8b09a');
      rect(g, x + cw / 2 - 1, y - 3, 2, 5, '#c74634');
      rect(g, x + 2, y + 2, cw - 4, 6, C.accent);
      const s = ch >= 56 ? 2 : 1;
      face(g, x + cw / 2 - 6 * s, y + 9, person.seed, s);
      const ty = y + 9 + 14 * s + 1;
      drawText(g, person.name, x + cw / 2, Math.min(ty, y + ch - 18), { align: 'center', color: C.ink });
      drawText(g, person.role, x + cw / 2, Math.min(ty + 9, y + ch - 9), { align: 'center', color: '#6a7080' });
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        for (const c of cards) c.flip = Math.max(0, c.flip - dt);
        if (inst.done) return;
        if (peek > 0) {
          peek -= dt;
          return;
        }
        elapsed += dt;
        if (elapsed >= total) return finish(inst, score());
        if (hideT > 0) {
          hideT -= dt;
          if (hideT <= 0) hideOpen();
        }
        const n = cards.length;
        if (input.pressed('ArrowRight')) cursor = (cursor + 1) % n;
        if (input.pressed('ArrowLeft')) cursor = (cursor - 1 + n) % n;
        if (input.pressed('ArrowDown')) cursor = (cursor + cols) % n;
        if (input.pressed('ArrowUp')) cursor = (cursor - cols + n) % n;
        if (input.confirm()) flip(cursor);
        const p = input.pointer;
        for (let i = 0; i < n; i++) {
          if (p.x >= cx(i) && p.x < cx(i) + cw && p.y >= cy(i) && p.y < cy(i) + ch) {
            if (p.moved) cursor = i;
            if (p.clicked) flip(i);
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#3b4462', desk: '#55402f' });
        header(g, theme?.title || 'Name Badge Memory', `Pairs ${found}/${pairs}  Turns ${turns}`);
        timerBar(g, peek > 0 ? total : total - elapsed, total);
        cards.forEach((c, i) => {
          const x = cx(i);
          const y = cy(i);
          rect(g, x + 2, y + 2, cw, ch, 'rgba(0,0,0,0.3)');
          const shown = peek > 0 || c.up || c.matched;
          if (c.flip > 0) {
            // squash animation
            const k = Math.abs(c.flip / 0.15 - 0.5) * 2;
            const w = Math.max(2, cw * k);
            rect(g, x + (cw - w) / 2, y, w, ch, C.accentLight);
          } else if (shown) drawBadge(g, x, y, people[c.p], c.matched);
          else {
            rect(g, x, y, cw, ch, C.accent);
            frame(g, x, y, cw, ch, C.accentDark);
            rect(g, x + 4, y + 4, cw - 8, ch - 8, C.accentDark);
            drawText(g, 'ID', x + cw / 2, y + ch / 2 - 4, { align: 'center', color: C.accentLight });
          }
          if (i === cursor && peek <= 0) frame(g, x - 2, y - 2, cw + 4, ch + 4, C.gold);
        });
        if (peek > 0) drawText(g, `Memorize! ${Math.ceil(peek)}`, W / 2, H - 18, { align: 'center', color: C.gold, shadow: C.border, scale: 1 });
        else drawText(g, 'Arrows + Space or click to flip', W / 2, H - 18, { align: 'center', color: C.text, shadow: C.border });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
