// Inbox Triage: sort each incoming email into one of three bins before its timer runs out.
import { W, H, C, rect, panel, drawText, backdrop, header, timerBar, monitor, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';

// [reply, archive, spam] item pools; department sets override the bin labels.
const POOLS = {
  default: {
    bins: ['Reply', 'Archive', 'Spam'],
    items: [
      ['Boss: Can you send the Q3 deck?', 'Client: Quick question on invoice', 'HR: Please confirm your start date', 'Team: Who can cover Friday?', 'Boss: Need this by EOD, thoughts?', 'Client: Is the demo still on?', 'IT: Did the reset work for you?', 'Mentor: Lunch tomorrow?'],
      ['FYI: Parking lot repaint', 'Weekly digest #212', 'Newsletter: Synergy Monthly', 'Reminder: Casual Friday', 'Cafeteria menu update', 'Policy v14.2 (no action needed)', 'FYI: Elevator maintenance', 'Org announcement: new VP'],
      ['YOU WON A FREE CRUISE!!!', 'Prince needs your bank details', 'Hot stock tip, act now', 'Your account will be closed!!', 'Cheap watches 90% off', 'Click here for free money', 'Re: Re: Re: invoice.exe', 'Miracle synergy pills'],
    ],
  },
  lobby: {
    bins: ['Deliver', 'Hold', 'Return'],
    items: [
      ['Parcel: Floor 12, Sales', 'Letter: CEO office', 'Box: IT, fragile', 'Envelope: HR, urgent'],
      ['Package: name smudged', 'Box: "do not open till Xmas"', 'Parcel: recipient on vacation', 'Crate: awaiting signature'],
      ['Wrong address: Synergy Bakery', 'Unpaid postage', 'Addressed to "Occupant" in 1987', 'Leaking mystery box'],
    ],
  },
  support: {
    bins: ['Solve', 'Escalate', 'Close'],
    items: [
      ['Password reset request', 'How do I export a PDF?', 'Where is my receipt?', 'Login loop on mobile'],
      ['Data loss, angry CEO', 'Outage across Europe', 'Legal threat in ticket', 'Bug in billing engine'],
      ['"Nevermind, fixed it"', 'Duplicate of #4411', 'Customer said thanks!', 'Spam bot ticket'],
    ],
  },
  legalhr: {
    bins: ['Keep', 'File', 'Shred'],
    items: [
      ['Signed contract (original)', 'Active NDA', 'Patent filing', 'Employee offer letter'],
      ['Old meeting minutes', 'Expired policy 2019', 'Training certificates', 'Archived job posting'],
      ['Draft with coffee stain', 'Doodle of the boss', 'Fantasy football picks', 'Duplicate printout'],
    ],
  },
  it: {
    bins: ['Fix now', 'Backlog', 'Ignore'],
    items: [
      ['PROD DOWN: checkout 500s', 'Security: leaked API key', 'DB disk at 99%', 'SSL cert expires today'],
      ['Feature: dark mode', 'Refactor legacy module', 'Button 2px off on IE6', 'Upgrade lib (non-urgent)'],
      ['"Is the internet down?" (it is not)', 'Monitor flagged: CPU at 3%', 'Alert: everything fine', 'Test alert, please ignore'],
    ],
  },
};

export default {
  id: 'inbox',
  name: 'Inbox Triage',
  help: 'Sort each item into the right bin. Keys: ← ↓ → (or 1 2 3), or click a bin.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const pool = POOLS[theme?.dept] || POOLS.default;
    const count = Math.round(byDiff(d, 8, 16));
    const perItem = byDiff(d, 4.2, 1.7);
    const queue = [];
    for (let i = 0; i < count; i++) {
      const cat = rng.int(0, 2);
      queue.push({ cat, text: rng.pick(pool.items[cat]), from: rng.int(1000, 9999) });
    }
    const fl = new Floaters();
    const shake = new Shake();
    const binX = [W / 2 - 150, W / 2 - 50, W / 2 + 50];
    const binY = H - 62;
    let i = 0;
    let left = perItem;
    let correct = 0;
    let slide = 1; // 1 → item slides in
    let flash = null;

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        if (flash) flash.t -= dt;
        if (inst.done) return;
        slide = Math.max(0, slide - dt * 5);
        left -= dt;
        let pick = -1;
        if (input.pressed('ArrowLeft') || input.pressedExact('1')) pick = 0;
        if (input.pressed('ArrowDown') || input.pressedExact('2')) pick = 1;
        if (input.pressed('ArrowRight') || input.pressedExact('3')) pick = 2;
        const p = input.pointer;
        if (p.clicked) binX.forEach((x, b) => {
          if (p.x >= x && p.x < x + 100 && p.y >= binY && p.y < binY + 50) pick = b;
        });
        if (pick < 0 && left > 0) return;
        const item = queue[i];
        if (pick === item.cat) {
          correct++;
          sfx('good');
          fl.add('+1', binX[pick] + 50, binY - 4, C.good);
          flash = { b: pick, ok: true, t: 0.25 };
        } else {
          sfx('bad');
          shake.hit();
          fl.add(pick < 0 ? 'Too slow!' : 'Wrong bin!', W / 2, 120, C.bad);
          flash = { b: pick < 0 ? item.cat : pick, ok: false, t: 0.25 };
        }
        i++;
        left = perItem;
        slide = 1;
        if (i >= queue.length) finish(inst, correct / queue.length);
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        header(g, theme?.title || 'Inbox Triage', `${Math.min(i + 1, queue.length)}/${queue.length}`);
        timerBar(g, left, perItem);
        const s = monitor(g, 90, 34, 300, 130);
        rect(g, s.x, s.y, s.w, 12, C.accent);
        drawText(g, 'Inbox - ' + (queue.length - i) + ' unread', s.x + 4, s.y + 2);
        // Upcoming list.
        for (let k = 1; k <= 3 && i + k < queue.length; k++) {
          rect(g, s.x + 6, s.y + 78 + k * 12, s.w - 12, 10, '#d5dce8');
          drawText(g, '· ' + queue[i + k].text.slice(0, 44), s.x + 9, s.y + 79 + k * 12, { color: '#6a7080' });
        }
        if (i < queue.length) {
          const item = queue[i];
          const ox = Math.round(slide * 200);
          panel(g, s.x + 8 + ox, s.y + 18, s.w - 16, 56, { fill: '#ffffff', light: '#ffffff', dark: '#c8cfdc' });
          drawText(g, `From: ext-${item.from}@mail`, s.x + 14 + ox, s.y + 24, { color: '#6a7080' });
          drawText(g, item.text, s.x + 14 + ox, s.y + 40, { color: C.ink });
          drawText(g, 'Received just now', s.x + 14 + ox, s.y + 58, { color: '#9aa0b0' });
        }
        const keys = ['←', '↓', '→'];
        binX.forEach((x, b) => {
          let fill = C.panel;
          if (flash && flash.t > 0 && flash.b === b) fill = flash.ok ? '#2f6b3a' : '#7a2b2b';
          panel(g, x, binY, 100, 50, { fill });
          rect(g, x + 30, binY + 8, 40, 18, '#1d2133');
          rect(g, x + 32, binY + 10, 36, 3, ['#5fd068', '#8ab4ff', '#e2504a'][b]);
          drawText(g, pool.bins[b], x + 50, binY + 30, { align: 'center' });
          drawText(g, `${keys[b]} / ${b + 1}`, x + 50, binY + 40, { align: 'center', color: C.dim });
        });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
