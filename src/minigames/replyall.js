// Reply-All Apocalypse: someone mailed ALL STAFF. Delete the reply-alls before they multiply and the inbox
// overflows, but leave the starred important mail alone (it files itself away after a few seconds).
import { W, C, rect, frame, panel, bar, drawText, measureText, backdrop, header, timerBar, monitor, Floaters, Shake, Countdown, byDiff, clamp, finish } from '../engine/mgkit.js';
import { icon } from '../engine/ui.js';
import { TOPICS, REPLIES, SENDERS, VIPS, OOPS } from '../data/mg-replyall.js';

const CAP = 12; // visible rows; more than this fills the overflow meter
const MAX_MAILS = CAP + 7; // spawning stops here (the meter is screaming anyway)
const ROW_H = 13;

const fit = (s, maxW) => {
  if (measureText(s) <= maxW) return s;
  while (s.length > 1 && measureText(s + '..') > maxW) s = s.slice(0, -1);
  return s + '..';
};
const prefix = (depth) => (depth <= 1 ? 'RE: ' : depth === 2 ? 'RE: RE: ' : `RE[${depth}]: `);

export default {
  id: 'replyall',
  name: 'Reply-All Apocalypse',
  help: 'Someone hit Reply All. Delete the RE: replies (click, or Up/Down + SPACE or X) before the inbox overflows. Never delete starred mail!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const topic = rng.pick(TOPICS[theme?.dept] || TOPICS.default);
    const duration = byDiff(d, 32, 40);
    const total = new Countdown(duration);
    const arrInt = byDiff(d, 1.7, 0.8); // seconds between fresh reply-alls
    const mult = byDiff(d, 0.035, 0.065); // per un-deleted reply, chance per second to spawn another
    const vipCount = Math.round(byDiff(d, 3, 7));
    const vipLife = byDiff(d, 7, 5);
    const lookalike = d < 0.45 ? 0 : byDiff(d, 0.1, 0.4);
    const tintVip = d < 0.5; // later on only the star + sender colour give them away
    const fl = new Floaters();
    const shake = new Shake();
    const s = { x: 14, y: 26, w: 358, h: 188 };
    const listY = s.y + 23;
    const x0 = s.x + 2;
    const rowW = s.w - 4;

    const mails = [];
    let nextId = 1;
    let junkTotal = 0;
    let deleted = 0;
    let vipDeleted = 0;
    let saved = 0;
    let whiffs = 0;
    let cursor = 0;
    let ov = 0; // overflow meter 0..1
    let overflowed = false;
    let arrT = 0.9;
    let anim = 0;
    const recipients = 1000 + rng.int(200, 8800);

    const addJunk = (depth) => {
      junkTotal++;
      let text;
      if (rng.chance(lookalike)) {
        const v = rng.pick(VIPS);
        text = 'RE: ' + rng.pick(v.subjects) + (rng.chance(0.5) ? '?' : '');
      } else text = prefix(depth) + rng.pick(REPLIES);
      mails.push({ id: nextId++, vip: false, sender: rng.pick(SENDERS), text, depth, age: 0 });
    };
    const addVip = () => {
      const v = rng.pick(VIPS);
      mails.push({ id: nextId++, vip: true, sender: v.sender, color: v.color, text: rng.pick(v.subjects), age: 0, life: vipLife * rng.float(0.9, 1.15) });
    };
    for (let k = 0; k < 3; k++) addJunk(1);
    // Important mail arrives on a schedule spread over the round.
    const vipTimes = [];
    for (let k = 0; k < vipCount; k++) vipTimes.push(2 + ((duration - 9) * (k + rng.float(0.15, 0.85))) / vipCount);

    const rowY = (r) => listY + r * ROW_H;
    const visible = () => Math.min(mails.length, CAP);

    const score = () => {
      let base = deleted / Math.max(1, junkTotal);
      if (overflowed) base *= 0.5;
      return clamp(base - 0.2 * vipDeleted - 0.02 * whiffs, 0, 1);
    };

    function del(r) {
      const m = r < visible() ? mails[r] : null;
      const fy = rowY(Math.min(r, CAP - 1)) + 2;
      if (!m) {
        whiffs++;
        sfx('click');
        fl.add('empty', x0 + rowW / 2, fy, C.dim);
        return;
      }
      mails.splice(r, 1);
      if (m.vip) {
        vipDeleted++;
        sfx('bad');
        shake.hit(0.35);
        fl.add(rng.pick(OOPS), x0 + rowW / 2, fy, C.bad);
      } else {
        deleted++;
        sfx(deleted % 5 === 0 ? 'coin' : 'blip');
        fl.add('+1', x0 + rowW - 30, fy, C.good);
      }
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());
        const spawning = total.left > 1.5;
        // Fresh reply-alls from outside.
        arrT -= dt;
        if (arrT <= 0) {
          arrT = arrInt * rng.float(0.6, 1.4);
          if (spawning && mails.length < MAX_MAILS) addJunk(rng.int(1, 2));
        }
        // Every reply that survives breeds more replies.
        const elapsed = duration - total.left;
        for (const m of mails.slice()) {
          m.age += dt;
          if (!m.vip && spawning && mails.length < MAX_MAILS && rng.chance(mult * dt)) addJunk(m.depth + 1);
        }
        while (vipTimes.length && elapsed >= vipTimes[0]) {
          vipTimes.shift();
          addVip();
        }
        // Important mail files itself away once it has been read (counts as saved).
        for (let k = mails.length - 1; k >= 0; k--) {
          const m = mails[k];
          if (m.vip && m.age >= m.life) {
            mails.splice(k, 1);
            saved++;
            sfx('ding');
            if (k < CAP) fl.add('Saved!', x0 + rowW / 2, rowY(k) + 2, C.gold);
          }
        }
        // Overflow meter.
        if (mails.length > CAP) ov += dt * (0.3 + 0.07 * (mails.length - CAP));
        else ov = Math.max(0, ov - dt * 0.2);
        if (ov >= 1) {
          overflowed = true;
          sfx('fail');
          shake.hit(0.5);
          return finish(inst, score());
        }
        // Input: keyboard cursor.
        const n = visible();
        if (input.pressed('ArrowUp')) cursor--;
        if (input.pressed('ArrowDown')) cursor++;
        cursor = clamp(cursor, 0, Math.max(0, n - 1));
        const keyDel = input.confirm() || input.pressedExact('x') || input.pressedExact('Delete') || input.pressedExact('Backspace');
        if (keyDel) del(cursor);
        // Pointer: hover moves the cursor, click deletes that row.
        const p = input.pointer;
        if (p.x >= x0 && p.x < x0 + rowW && p.y >= listY && p.y < listY + CAP * ROW_H) {
          const r = Math.floor((p.y - listY) / ROW_H);
          if (p.moved && r < n) cursor = r;
          if (p.clicked && !keyDel) {
            cursor = Math.min(r, Math.max(0, n - 1));
            del(r);
          }
        }
        cursor = clamp(cursor, 0, Math.max(0, visible() - 1));
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        header(g, theme?.title || 'Reply-All Apocalypse', `Deleted ${deleted}`);
        timerBar(g, total.left, total.total);
        monitor(g, s.x, s.y, s.w, s.h, '#e9eef5');
        // Title + thread banner.
        rect(g, s.x, s.y, s.w, 11, C.accent);
        drawText(g, `MailDrone 2000 - Inbox (${mails.length})`, s.x + 4, s.y + 2);
        drawText(g, 'x', s.x + s.w - 8, s.y + 2, { color: C.text });
        rect(g, s.x, s.y + 11, s.w, 10, '#d5dce8');
        drawText(g, fit(`Thread: "${topic}" to ALL STAFF (${recipients})`, s.w - 8), s.x + 4, s.y + 12, { color: '#4a5268' });
        // Rows.
        const n = visible();
        for (let r = 0; r < CAP; r++) {
          const y = rowY(r);
          const m = mails[r];
          rect(g, x0, y, rowW, ROW_H, r % 2 ? '#f1f4f9' : '#ffffff');
          if (!m) continue;
          if (m.vip && tintVip) rect(g, x0, y, rowW, ROW_H, '#fff3cf');
          rect(g, x0, y + ROW_H - 1, rowW, 1, '#dde3ec');
          if (m.vip) {
            icon(g, 'star', x0 + 4, y + 3);
            drawText(g, fit(m.sender, 64), x0 + 16, y + 3, { color: m.color });
            drawText(g, fit(m.text, 200), x0 + 84, y + 3, { color: C.ink });
            // "Being read" bar: when full the mail files itself.
            const f = clamp(m.age / m.life, 0, 1);
            rect(g, x0 + rowW - 52, y + 5, 30, 3, '#d5dce8');
            rect(g, x0 + rowW - 52, y + 5, Math.round(30 * f), 3, C.gold);
          } else {
            drawEnvelope(g, x0 + 3, y + 3);
            drawText(g, fit(m.sender, 64), x0 + 16, y + 3, { color: '#7a8296' });
            drawText(g, fit(m.text, 248), x0 + 84, y + 3, { color: C.ink });
          }
        }
        if (n > 0) {
          const y = rowY(cursor);
          frame(g, x0, y, rowW, ROW_H, C.gold);
          frame(g, x0 + 1, y + 1, rowW - 2, ROW_H - 2, '#f7dc8a');
          drawTrash(g, x0 + rowW - 12, y + 2, mails[cursor]?.vip);
        }
        // Footer: what does not fit.
        const fy = s.y + s.h - 9;
        rect(g, s.x, fy, s.w, 9, mails.length > CAP ? (Math.floor(anim * 6) % 2 ? '#e2504a' : '#a83a35') : '#d5dce8');
        drawText(g, mails.length > CAP ? `+${mails.length - CAP} more! INBOX FULL` : `${mails.length} of ${CAP} slots used`, s.x + s.w / 2, fy + 1, {
          align: 'center',
          color: mails.length > CAP ? '#fff' : '#4a5268',
        });
        // Desk clutter: a mug and a sticky note with a lesson nobody learned.
        rect(g, 40, 224, 16, 18, C.border);
        rect(g, 41, 225, 14, 16, '#e8e4dc');
        rect(g, 42, 226, 12, 3, '#4a2a18');
        rect(g, 55, 229, 4, 8, C.border);
        rect(g, 300, 222, 34, 24, '#f2e27a');
        rect(g, 300, 222, 34, 3, '#e0cc50');
        drawText(g, 'USE', 317, 227, { align: 'center', color: C.ink });
        drawText(g, 'BCC!', 317, 236, { align: 'center', color: '#c0392b' });
        drawSidePanel(g);
        drawText(g, 'Delete RE: replies: click, or Up/Down + SPACE / X. Keep starred mail!', W / 2, 254, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };

    function drawSidePanel(g) {
      const px = 382;
      const py = 21;
      panel(g, px, py, 92, 196, { title: 'MAIL SERVER' });
      const cx = px + 46;
      drawText(g, 'Inbox load', cx, py + 18, { align: 'center', color: C.dim });
      const load = mails.length / CAP;
      bar(g, px + 8, py + 28, 76, 7, load, load > 1 ? C.bad : load > 0.75 ? C.warn : C.good);
      drawText(g, 'OVERFLOW', cx, py + 40, { align: 'center', color: ov > 0 ? C.bad : C.dim });
      // Vertical meter, fills from the bottom.
      const mx = px + 30;
      const my = py + 51;
      const mh = 62;
      rect(g, mx, my, 32, mh, C.border);
      rect(g, mx + 1, my + 1, 30, mh - 2, C.panelDark);
      const fh = Math.round((mh - 2) * clamp(ov, 0, 1));
      if (fh > 0) rect(g, mx + 1, my + mh - 1 - fh, 30, fh, Math.floor(anim * 8) % 2 ? C.bad : '#ff7a6a');
      for (let k = 1; k < 4; k++) rect(g, mx + 1, my + Math.round((mh * k) / 4), 4, 1, C.dim);
      if (ov > 0 && Math.floor(anim * 4) % 2) drawText(g, 'INBOX FULL!', cx, my + mh + 4, { align: 'center', color: C.bad, shadow: C.border });
      drawText(g, `Deleted ${deleted}`, px + 8, py + 134, { color: C.text });
      drawText(g, `Saved ${saved}`, px + 8, py + 145, { color: C.gold });
      if (vipDeleted) drawText(g, `Oops ${vipDeleted}`, px + 52, py + 145, { color: C.bad });
      // Legend.
      rect(g, px + 6, py + 158, 80, 1, C.panelLight);
      icon(g, 'star', px + 8, py + 164);
      drawText(g, 'KEEP', px + 20, py + 164, { color: C.gold });
      drawEnvelope(g, px + 7, py + 177);
      drawText(g, 'DELETE RE:', px + 20, py + 177, { color: C.text });
    }

    return inst;
  },
};

function drawEnvelope(g, x, y) {
  rect(g, x, y, 9, 7, '#8a93a6');
  rect(g, x + 1, y + 1, 7, 5, '#e3e7ee');
  rect(g, x + 1, y + 1, 1, 1, '#8a93a6');
  rect(g, x + 2, y + 2, 1, 1, '#8a93a6');
  rect(g, x + 3, y + 3, 3, 1, '#8a93a6');
  rect(g, x + 6, y + 2, 1, 1, '#8a93a6');
  rect(g, x + 7, y + 1, 1, 1, '#8a93a6');
}

function drawTrash(g, x, y, warn) {
  const c = warn ? '#e2504a' : '#5a6078';
  rect(g, x + 2, y, 3, 1, c);
  rect(g, x, y + 1, 7, 1, c);
  rect(g, x + 1, y + 2, 5, 7, c);
  rect(g, x + 2, y + 3, 1, 5, '#ffffff');
  rect(g, x + 4, y + 3, 1, 5, '#ffffff');
}
