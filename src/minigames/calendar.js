// Schedule the Meeting: find the one time slot where every attendee is free.
import { W, H, C, rect, frame, panel, drawText, backdrop, header, timerBar, face, Floaters, Shake, byDiff, finish, measureText } from '../engine/mgkit.js';

const PEOPLE = {
  default: ['Boss', 'Dana (PM)', 'Raj (Dev)', 'Kim (Design)', 'Lee (QA)', 'Sam (Ops)'],
  lobby: ['Head Porter', 'Receptionist', 'Mail Lead', 'Security', 'Cleaner', 'Courier'],
  support: ['Team Lead', 'Agent Mo', 'Agent Jo', 'QA Coach', 'Trainer', 'Escalations'],
  sales: ['Sales VP', 'Client CEO', 'Account Exec', 'Sales Eng', 'Legal', 'Procurement'],
  marketing: ['CMO', 'Copywriter', 'Designer', 'Agency', 'Influencer', 'Analyst'],
  it: ['CTO', 'Backend Dev', 'Frontend Dev', 'DevOps', 'Security', 'Product Owner'],
  finance: ['CFO', 'Controller', 'Auditor', 'Analyst', 'Tax Advisor', 'Treasurer'],
  legalhr: ['HR Head', 'Counsel', 'Candidate', 'Hiring Mgr', 'Recruiter', 'Union Rep'],
  exec: ['CEO', 'CFO', 'COO', 'Board Chair', 'Investor', 'Assistant'],
};
const BUSY_LABELS = ['Mtg', 'Call', 'Lunch', '1:1', 'Gym', 'Focus', 'Demo', 'Nap?', 'Golf', 'Sync'];

export default {
  id: 'calendar',
  name: 'Schedule the Meeting',
  help: 'Find the slot where everyone is free. ← → to choose, Space to book, or click the column.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const rounds = Math.round(byDiff(d, 3, 5));
    const slots = Math.round(byDiff(d, 8, 16)); // half-hour or hour slots between 9:00 and 17:00
    const people = Math.round(byDiff(d, 3, 6));
    const roundTime = byDiff(d, 14, 7.5);
    const names = PEOPLE[theme?.dept] || PEOPLE.default;
    const fl = new Floaters();
    const shake = new Shake();

    const makeRound = () => {
      const free = rng.int(0, slots - 1);
      const rows = [];
      const roster = rng.shuffle(names).slice(0, people);
      for (let p = 0; p < people; p++) {
        const busy = new Array(slots).fill(null);
        // Random blocks of 1-3 slots.
        const blocks = rng.int(Math.ceil(slots / 6), Math.ceil(slots / 3));
        for (let b = 0; b < blocks; b++) {
          const len = rng.int(1, slots > 8 ? 3 : 2);
          const s = rng.int(0, slots - len);
          const label = rng.pick(BUSY_LABELS);
          for (let k = s; k < s + len; k++) busy[k] = label;
        }
        rows.push({ name: roster[p], busy, seed: rng.int(0, 9999) });
      }
      // Every other slot must have at least one busy attendee; the chosen one must be free for all.
      for (let s = 0; s < slots; s++) {
        if (s === free) rows.forEach((r) => (r.busy[s] = null));
        else if (rows.every((r) => !r.busy[s])) rng.pick(rows).busy[s] = rng.pick(BUSY_LABELS);
      }
      return { rows, free };
    };

    let round = 0;
    let current = makeRound();
    let cursor = Math.floor(slots / 2);
    let left = roundTime;
    let correct = 0;
    let reveal = 0; // seconds showing the answer between rounds
    let lastPick = -1;
    let lastOk = false;

    const gridX = 96;
    const gridY = 50;
    const gridW = W - gridX - 10;
    const rowH = Math.min(28, Math.floor(170 / people));
    const colW = gridW / slots;

    const slotLabel = (s) => {
      const mins = 9 * 60 + s * (slots <= 9 ? 60 : 30);
      return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
    };

    const pick = (s) => {
      lastPick = s;
      lastOk = s === current.free;
      if (lastOk) {
        correct++;
        sfx('good');
        fl.add('Booked!', gridX + (s + 0.5) * colW, gridY - 8, C.good);
      } else {
        sfx('bad');
        shake.hit();
        fl.add(s < 0 ? 'Too slow!' : 'Conflict!', W / 2, gridY - 8, C.bad);
      }
      reveal = 1.1;
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (inst.done) return;
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            round++;
            if (round >= rounds) return finish(inst, correct / rounds);
            current = makeRound();
            left = roundTime;
            lastPick = -1;
          }
          return;
        }
        left -= dt;
        if (left <= 0) return pick(-1);
        if (input.pressed('ArrowLeft')) {
          cursor = (cursor - 1 + slots) % slots;
          sfx('blip');
        }
        if (input.pressed('ArrowRight')) {
          cursor = (cursor + 1) % slots;
          sfx('blip');
        }
        if (input.confirm()) return pick(cursor);
        const p = input.pointer;
        if (p.x >= gridX && p.x < gridX + gridW && p.y >= gridY - 14 && p.y < gridY + rowH * people + 14) {
          const s = Math.floor((p.x - gridX) / colW);
          if (p.moved) cursor = s;
          if (p.clicked) pick(s);
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g, { wall: '#34405a', desk: '#5a4232' });
        header(g, theme?.title || 'Schedule the Meeting', `Meeting ${Math.min(round + 1, rounds)}/${rounds}`);
        timerBar(g, reveal > 0 ? 0 : left, roundTime);
        panel(g, 4, 22, W - 8, 212, { fill: '#f4f6fa', light: '#ffffff', dark: '#c0c6d4' });
        drawText(g, 'Find a slot free for ALL attendees', 12, 28, { color: C.ink });
        // Column headers.
        for (let s = 0; s < slots; s++) {
          const x = gridX + s * colW;
          if (slots <= 8 || s % 2 === 0) drawText(g, slotLabel(s), x + 1, gridY - 10, { color: '#6a7080' });
        }
        // Cursor column.
        const showAns = reveal > 0;
        if (!showAns) {
          rect(g, gridX + cursor * colW, gridY - 2, colW, rowH * people + 4, 'rgba(242,193,78,0.35)');
        } else {
          rect(g, gridX + current.free * colW, gridY - 2, colW, rowH * people + 4, 'rgba(95,208,104,0.45)');
          if (lastPick >= 0 && !lastOk) rect(g, gridX + lastPick * colW, gridY - 2, colW, rowH * people + 4, 'rgba(226,80,74,0.45)');
        }
        current.rows.forEach((r, i) => {
          const y = gridY + i * rowH;
          rect(g, 10, y, gridW + gridX - 10, 1, '#d8dce6');
          face(g, 12, y + Math.max(0, (rowH - 14) / 2), r.seed, 1);
          drawText(g, r.name, 28, y + rowH / 2 - 4, { color: C.ink });
          for (let s = 0; s < slots; s++) {
            if (!r.busy[s]) continue;
            const x = gridX + s * colW;
            const startsBlock = s === 0 || r.busy[s - 1] !== r.busy[s];
            rect(g, x + (startsBlock ? 1 : 0), y + 3, colW - (startsBlock ? 1 : 0), rowH - 6, '#7d8fd0');
            rect(g, x + (startsBlock ? 1 : 0), y + 3, colW - (startsBlock ? 1 : 0), 1, '#a8b6e6');
            if (startsBlock && measureText(r.busy[s]) <= colW - 4) drawText(g, r.busy[s], x + 3, y + rowH / 2 - 4, { color: '#ffffff' });
          }
        });
        rect(g, 10, gridY + people * rowH, gridW + gridX - 10, 1, '#d8dce6');
        for (let s = 0; s <= slots; s++) rect(g, gridX + s * colW, gridY, 1, people * rowH, 'rgba(0,0,0,0.08)');
        if (!showAns) frame(g, gridX + cursor * colW, gridY - 2, colW, rowH * people + 4, C.gold);
        drawText(g, `Booked ${correct} / ${rounds}`, W - 12, H - 22, { align: 'right', color: C.gold, shadow: C.border });
        drawText(g, '← → choose   Space book   or click', 12, H - 22, { color: C.text, shadow: C.border });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
