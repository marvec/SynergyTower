// Rapid Reply: type corporate phrases against the clock. Mouse fallback: click the next letter tile.
import { W, C, rect, frame, panel, drawText, measureText, backdrop, header, timerBar, monitor, Floaters, Shake, byDiff, finish } from '../engine/mgkit.js';
import { charWidth } from '../engine/font.js';

const PHRASES = {
  general: [
    'per my last email', "let's circle back", 'happy friday everyone', 'thanks for flagging', 'can you see my screen',
    "you're on mute", 'sorry, go ahead', "let's take this offline", 'great question', 'quick sync at ten',
    'see attached report', 'synergy is our middle name', 'moving forward', 'low hanging fruit', 'any blockers today',
  ],
  lobby: ['welcome to the tower', 'please sign in here', 'parcel for floor nine', 'badge on at all times'],
  support: ['have you tried rebooting', 'sorry for the trouble', 'your ticket is solved', 'thanks for your patience'],
  sales: ['always be closing', 'quick demo next week', 'deal closed, ring the gong', 'pipeline looks strong'],
  marketing: ['make the logo bigger', 'engagement is up', 'new campaign live', 'brand voice matters'],
  it: ['works on my machine', 'fixed in prod', 'git push origin main', 'clear your cache', 'reboot the server'],
  finance: ['receipts by friday', 'budget approved', 'numbers look solid', 'ebitda is up'],
  legalhr: ['please sign the nda', 'mandatory fun at four', 'policy updated', 'all feedback is welcome'],
  exec: ['strong quarter, team', 'think outside the box', 'shareholder value first', 'more synergy please'],
};
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';

export default {
  id: 'typing',
  name: 'Rapid Reply',
  help: 'Type each phrase exactly. No keyboard? Click the tile with the next letter.',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const count = Math.round(byDiff(d, 3, 5));
    const pool = [...(PHRASES[theme?.dept] || []), ...PHRASES.general];
    const short = pool.filter((p) => p.length <= 22);
    const phrases = rng.sample(d < 0.5 && short.length >= count ? short : pool, count);
    const totalChars = phrases.reduce((s, p) => s + p.length, 0);
    const cps = byDiff(d, 1.6, 3.2);
    let total = Math.min(90, totalChars / cps + 4);
    let left = total;
    let mouseMode = false;
    let pi = 0; // phrase index
    let ci = 0; // char index within phrase
    let typed = 0;
    let errors = 0;
    let tiles = [];
    let flashBad = 0;
    const fl = new Floaters();
    const shake = new Shake();
    const sent = [];

    const tileRects = () => tiles.map((_, k) => ({ x: W / 2 - 98 + k * 50, y: 222, w: 44, h: 30 }));
    const makeTiles = () => {
      const next = phrases[pi]?.[ci];
      if (next == null) return (tiles = []);
      const set = new Set([next.toLowerCase()]);
      const choices = ALPHA + ' ';
      while (set.size < 4) set.add(choices[rng.int(0, choices.length - 1)]);
      tiles = rng.shuffle([...set]);
    };
    makeTiles();

    const score = () => {
      const progress = typed / totalChars;
      const acc = typed + errors > 0 ? typed / (typed + errors) : 0;
      return progress * acc ** 1.5;
    };

    const enter = (ch) => {
      const phrase = phrases[pi];
      const want = phrase[ci];
      if (ch.toLowerCase() === want.toLowerCase()) {
        ci++;
        typed++;
        sfx('blip');
        if (ci >= phrase.length) {
          sent.push(phrase);
          sfx('good');
          fl.add('Sent!', W / 2, 120, C.good);
          pi++;
          ci = 0;
          if (pi >= phrases.length) {
            finish(inst, score());
            return;
          }
        }
        makeTiles();
      } else {
        errors++;
        flashBad = 0.15;
        sfx('bad');
        shake.hit(0.15);
      }
    };

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        flashBad = Math.max(0, flashBad - dt);
        if (inst.done) return;
        left -= dt;
        if (left <= 0) return finish(inst, score());
        for (const ch of input.typed()) {
          if (ch === '\b' || ch.length !== 1) continue;
          enter(ch);
          if (inst.done) return;
        }
        const p = input.pointer;
        if (p.clicked) {
          tileRects().forEach((r, k) => {
            if (inst.done) return;
            if (p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h) {
              if (!mouseMode) {
                // Clicking letters is slower than typing: grant extra time once.
                mouseMode = true;
                left += total * 0.8;
                total *= 1.8;
              }
              enter(tiles[k]);
            }
          });
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        backdrop(g);
        const acc = typed + errors > 0 ? Math.round((typed / (typed + errors)) * 100) : 100;
        header(g, theme?.title || 'Rapid Reply', `${Math.min(pi + 1, phrases.length)}/${phrases.length}  acc ${acc}%`);
        timerBar(g, left, total);
        const s = monitor(g, 60, 30, 360, 118, '#f2f4f8');
        rect(g, s.x, s.y, s.w, 11, C.accent);
        drawText(g, 'Chat - #general', s.x + 4, s.y + 2);
        // Sent bubbles (last 3).
        sent.slice(-3).forEach((m, k, arr) => {
          const y = s.y + 16 + (3 - arr.length + k) * 13;
          const w = measureText(m) + 8;
          rect(g, s.x + s.w - w - 6, y, w, 11, C.accentLight);
          drawText(g, m, s.x + s.w - 10, y + 2, { color: C.ink, align: 'right' });
        });
        // Input line with current phrase.
        rect(g, s.x + 4, s.y + 60, s.w - 8, 52, flashBad > 0 ? '#ffd9d6' : '#ffffff');
        frame(g, s.x + 4, s.y + 60, s.w - 8, 52, '#c8cfdc');
        drawText(g, 'Type:', s.x + 8, s.y + 63, { color: '#9aa0b0' });
        const phrase = phrases[pi];
        if (phrase) {
          const sc = measureText(phrase, 2) <= s.w - 20 ? 2 : 1;
          let x = s.x + s.w / 2 - measureText(phrase, sc) / 2;
          const y = s.y + 80;
          for (let k = 0; k < phrase.length; k++) {
            const ch = phrase[k];
            const cw = charWidth(ch) * sc;
            if (k === ci) {
              rect(g, x - 1, y - 2, Math.max(cw, 3 * sc) + 2, 9 * sc, '#fff3c4');
              rect(g, x - 1, y + 8 * sc, Math.max(cw, 3 * sc) + 2, sc, C.accent);
            }
            const col = k < ci ? '#2f8a3e' : k === ci ? C.ink : '#a0a6b4';
            drawText(g, ch, x, y, { color: col, scale: sc });
            x += cw + sc;
          }
        }
        // Mouse tiles.
        drawText(g, mouseMode ? 'Mouse mode: extra time granted' : 'or click the next letter:', W / 2, 211, { align: 'center', color: C.dim, shadow: C.border });
        tileRects().forEach((r, k) => {
          panel(g, r.x, r.y, r.w, r.h, { fill: C.panelLight });
          const t = tiles[k];
          drawText(g, t === ' ' ? 'spc' : t, r.x + r.w / 2, r.y + (t === ' ' ? 11 : 8), { align: 'center', scale: t === ' ' ? 1 : 2, color: C.text });
        });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
