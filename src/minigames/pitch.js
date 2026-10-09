// Elevator Pitch: alone in the elevator with the CEO. Stop four slot-machine reels to build a pitch
// ([Opener] [Buzz verb] [Thing] [Audience]); words matching the rumoured CEO mood of the moment score big.
import { W, H, C, rect, frame, drawText, measureText, header, timerBar, Floaters, Shake, byDiff, clamp, finish } from '../engine/mgkit.js';
import { drawButton } from '../engine/ui.js';
import { wrapText } from '../engine/font.js';
import { MOODS, SLOTS, REPLIES, ARRIVALS, INTROS, REACTIONS, NEXTS, MOOD_BONUS } from '../data/mg-pitch.js';

const PITCHES = 3;
const PER_REEL = 8;
const ROW = 16;
const CURVE = 1.3; // score = raw^CURVE: random stops land well below 0.35, perfect stays 1
const RW = 110;
const rx = (i) => 12 + i * 115;
const WIN = { y: 165, h: 54 };
const CY = WIN.y + WIN.h / 2; // payline centre
const REELS_Y = 151;
const STOP = { x: 382, y: 227, w: 92, h: 24 };
const SAY = { x: 6, y: 227, w: 370, h: 24 };
const PX = 206; // player sprite x
const CX = 248; // CEO sprite x
const PY = 86; // both sprites' top (2x scale, 30 rows → feet at 146)
const mod = (k, n) => ((k % n) + n) % n;
const inside = (p, x, y, w, h) => p.x >= x && p.y >= y && p.x < x + w && p.y < y + h;

// 7×7 category icons so the player can read the mood match at a glance.
const CAT_ICONS = {
  animals: { map: '..b.b..|..b.b..|b.....b|b.bbb.b|.bbbbb.|.bbbbb.|..bbb..', pal: { b: '#8a5a2b' } },
  ai: { map: '.p.p.p.|pgggggp|.gkkkg.|pgkwkgp|.gkkkg.|pgggggp|.p.p.p.', pal: { p: '#9aa0b8', g: '#2e8540', k: '#12161c', w: '#5fd068' } },
  space: { map: '...k...|..kwk..|..kbk..|.kwwwk.|rkwwwkr|r.kok.r|...o...', pal: { k: '#3b4048', w: '#e8e8f0', b: '#1f70c1', r: '#e2504a', o: '#f29c38' } },
  green: { map: '....gg.|..gggg.|.ggglg.|.gglgg.|.glgg..|.lg....|l......', pal: { g: '#4cbf56', l: '#1d6b2a' } },
  money: { map: '..yyy..|.yyyyy.|.ooooo.|.yyyyy.|.ooooo.|.yyyyy.|.ooooo.', pal: { y: '#f2c14e', o: '#a8761a' } },
  boring: { map: '.sssss.|.swwws.|.sssss.|.swwws.|.sssss.|.swwws.|.sssss.', pal: { s: '#7a7d8d', w: '#c8cad2' } },
  buzz: { map: '...v...|...v...|..vvv..|vvvwvvv|..vvv..|...v...|...v...', pal: { v: '#b15cff', w: '#f4e8ff' } },
};
const iconCache = new Map();
function catIcon(g, cat, x, y) {
  let c = iconCache.get(cat);
  if (!c) {
    const def = CAT_ICONS[cat] || CAT_ICONS.buzz;
    c = document.createElement('canvas');
    c.width = 7;
    c.height = 7;
    const cg = c.getContext('2d');
    def.map.split('|').forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) {
        if (row[xx] === '.') continue;
        cg.fillStyle = def.pal[row[xx]] || '#fff';
        cg.fillRect(xx, yy, 1, 1);
      }
    });
    iconCache.set(cat, c);
  }
  g.drawImage(c, Math.round(x), Math.round(y));
}

/** 12×30 pixel person at scale s. expr: neutral | interested | delighted | bored | annoyed | talk | nervous. */
function person(g, x, y, s, look, expr) {
  const r = (cx, cy, w, h, col) => rect(g, x + cx * s, y + cy * s, w * s, h * s, col);
  r(3, 21, 2, 8, look.pants);
  r(7, 21, 2, 8, look.pants);
  r(2, 29, 3, 1, '#15161c');
  r(7, 29, 3, 1, '#15161c');
  r(2, 10, 8, 11, look.top);
  r(0, 11, 2, 9, look.top);
  r(10, 11, 2, 9, look.top);
  r(0, 20, 2, 1, look.skin);
  r(10, 20, 2, 1, look.skin);
  if (look.ceo) {
    r(3, 10, 1, 7, look.lapel);
    r(8, 10, 1, 7, look.lapel);
    r(4, 10, 4, 1, '#f4f1e8');
    r(5, 10, 2, 1, '#8e1f1a');
    r(5, 11, 2, 6, '#c0392b');
    r(10, 19, 2, 1, '#f2c14e'); // gold watch
  } else {
    r(4, 10, 1, 4, '#e2504a');
    r(7, 10, 1, 4, '#e2504a');
    r(4, 14, 4, 3, '#f4f1e8');
    r(5, 15, 2, 1, C.accent);
  }
  r(5, 9, 2, 1, look.skin);
  r(2, 1, 8, 8, look.skin);
  r(1, 4, 1, 2, look.skin);
  r(10, 4, 1, 2, look.skin);
  if (look.ceo) {
    r(2, 1, 1, 4, look.hair);
    r(9, 1, 1, 4, look.hair);
    r(3, 1, 6, 1, '#f8dcc0');
  } else {
    r(2, 0, 8, 2, look.hair);
    r(2, 2, 1, 2, look.hair);
    r(9, 2, 1, 2, look.hair);
  }
  const eye = '#222';
  const mouth = '#7a3b3b';
  switch (expr) {
    case 'interested':
      r(4, 2, 1, 1, look.brow);
      r(7, 2, 1, 1, look.brow);
      r(4, 4, 1, 2, eye);
      r(7, 4, 1, 2, eye);
      r(5, 6, 2, 2, mouth);
      break;
    case 'delighted':
      r(3, 4, 1, 1, eye);
      r(4, 3, 1, 1, eye);
      r(5, 4, 1, 1, eye);
      r(6, 4, 1, 1, eye);
      r(7, 3, 1, 1, eye);
      r(8, 4, 1, 1, eye);
      r(3, 5, 1, 1, mouth);
      r(8, 5, 1, 1, mouth);
      r(4, 6, 4, 1, mouth);
      r(5, 7, 2, 1, '#c0392b');
      r(2, 6, 1, 1, '#f09090');
      r(9, 6, 1, 1, '#f09090');
      break;
    case 'bored':
      r(3, 4, 2, 1, eye);
      r(6, 4, 2, 1, eye);
      r(3, 3, 2, 1, '#d9a273');
      r(6, 3, 2, 1, '#d9a273');
      r(6, 7, 2, 1, mouth);
      break;
    case 'annoyed':
      r(3, 2, 1, 1, eye);
      r(4, 3, 1, 1, eye);
      r(8, 2, 1, 1, eye);
      r(7, 3, 1, 1, eye);
      r(4, 4, 1, 1, eye);
      r(7, 4, 1, 1, eye);
      r(5, 6, 2, 1, mouth);
      r(4, 7, 1, 1, mouth);
      r(7, 7, 1, 1, mouth);
      r(2, 5, 1, 2, '#e07070');
      r(9, 5, 1, 2, '#e07070');
      break;
    case 'talk':
      r(4, 4, 1, 1, eye);
      r(7, 4, 1, 1, eye);
      r(5, 6, 2, 2, '#3a1a1a');
      break;
    case 'nervous':
      r(4, 4, 1, 1, eye);
      r(7, 4, 1, 1, eye);
      r(4, 6, 4, 1, mouth);
      r(9, 2, 1, 2, '#8ad0ff');
      break;
    default:
      r(4, 4, 1, 1, eye);
      r(7, 4, 1, 1, eye);
      r(5, 6, 2, 1, mouth);
  }
}

function drawElevator(g, floor, anim, arrived) {
  rect(g, 0, 40, W, 104, '#8e97a4');
  for (let x = 0; x < W; x += 2) {
    const h = (x * 37 + (x >> 3) * 11) % 9;
    if (h < 3) rect(g, x, 44, 1, 100, h === 0 ? '#848d99' : '#9aa3b0');
  }
  for (const sx of [100, 380]) {
    rect(g, sx, 44, 1, 100, '#6c7480');
    rect(g, sx + 1, 44, 1, 100, '#b0b8c4');
  }
  // Ceiling with a light strip and an elevator-music speaker.
  rect(g, 0, 40, W, 4, '#3b4048');
  rect(g, 120, 41, 240, 2, '#fff6d0');
  rect(g, 420, 41, 14, 2, '#22252e');
  for (let i = 0; i < 2; i++) {
    const t = (anim * 0.35 + i * 0.5) % 1;
    g.globalAlpha = 1 - t;
    drawNote(g, 424 + i * 10 + Math.round(Math.sin((t + i) * 6) * 3), 46 + Math.round(t * 34));
    g.globalAlpha = 1;
  }
  // Floor.
  rect(g, 0, 144, W, 6, '#4a4038');
  rect(g, 0, 144, W, 1, '#2a241f');
  for (let x = 0; x < W; x += 16) rect(g, x + ((x / 16) % 2 ? 8 : 0), 146, 8, 2, '#554a40');
  // Handrail (behind the door area it is hidden by the door).
  for (const [a, b] of [[0, 194], [286, W]]) {
    rect(g, a, 112, b - a, 2, '#d8dde4');
    rect(g, a, 114, b - a, 1, '#5c636e');
    for (let x = a + 20; x < b - 10; x += 60) rect(g, x, 115, 2, 4, '#5c636e');
  }
  // Door and frame.
  rect(g, 194, 58, 92, 86, '#5c636e');
  rect(g, 194, 58, 92, 1, '#aab2be');
  for (const dx of [198, 241]) {
    rect(g, dx, 62, 41, 82, '#b5bcc6');
    for (let x = 0; x < 41; x += 3) if ((x * 7) % 5 < 2) rect(g, dx + x, 62, 1, 82, '#c3c9d2');
    rect(g, dx, 62, 41, 1, '#d8dde4');
  }
  rect(g, 239, 62, 2, 82, '#3b4048');
  // Floor indicator.
  rect(g, 212, 45, 56, 12, C.border);
  rect(g, 213, 46, 54, 10, '#141008');
  const label = arrived ? 'PH 40' : `^ ${String(floor).padStart(2, '0')}`;
  const lit = !arrived || Math.floor(anim * 4) % 2 === 0;
  drawText(g, label, 240, 47, { align: 'center', color: lit ? '#ffb347' : '#6a4a1a' });
  // Button panel.
  rect(g, 178, 76, 12, 34, '#5c636e');
  rect(g, 179, 77, 10, 32, '#c9ced6');
  for (let i = 0; i < 6; i++) rect(g, 181 + (i % 2) * 4, 80 + Math.floor(i / 2) * 6, 3, 3, i === 0 ? '#ffb347' : '#7a7d8d');
  rect(g, 181, 100, 7, 5, '#e2504a');
}

function drawNote(g, x, y) {
  rect(g, x + 3, y, 1, 5, '#3b4048');
  rect(g, x + 3, y, 3, 1, '#3b4048');
  rect(g, x + 1, y + 4, 3, 2, '#3b4048');
}

function bubble(g, x, y, w, h, tail) {
  rect(g, x + 1, y + 2, w, h, 'rgba(0,0,0,0.25)');
  rect(g, x, y, w, h, C.border);
  rect(g, x + 1, y + 1, w - 2, h - 2, '#ffffff');
  if (tail === 'left') {
    rect(g, x - 3, y + h - 14, 4, 4, '#ffffff');
    rect(g, x - 7, y + h - 11, 4, 3, '#ffffff');
    rect(g, x - 11, y + h - 9, 4, 2, '#ffffff');
  }
}

export default {
  id: 'pitch',
  name: 'Elevator Pitch',
  help: 'Stop each reel (Space/Enter, click STOP or the reel) on the word the CEO will love. Follow the rumour icon!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const speed = byDiff(d, 2.0, 3.6); // words per second
    const autoT = byDiff(d, 5.5, 3.2); // seconds before a reel stops by itself
    const grace = byDiff(d, 0.3, 0.25); // reaction-time forgiveness, in rows
    const fl = new Floaters();
    const shake = new Shake();
    const skins = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];
    const hairs = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#1a1a1a'];
    const you = { skin: rng.pick(skins), hair: rng.pick(hairs), top: C.accent, pants: '#2b2e38', brow: '#2b1d14' };
    const ceo = { ceo: true, skin: '#f2c9a0', hair: '#c8c8c8', brow: '#9a9a9a', top: '#22252e', lapel: '#15171e', pants: '#22252e' };
    const moodOrder = rng.sample(Object.keys(MOODS), PITCHES);
    const climbs = [rng.int(10, 12), rng.int(10, 12), rng.int(10, 12)];
    const floors = [40 - climbs[0] - climbs[1] - climbs[2]];
    for (const c of climbs) floors.push(floors[floors.length - 1] + c);
    const results = [];
    let p = 0;
    let cur = 0;
    let phase = 'intro';
    let phaseT = 0;
    let anim = 0;
    let mood = '';
    let rumour = '';
    let noteFlash = 0;
    let reels = [];
    let say = INTROS[theme?.dept] || 'You have until my floor. Go.';
    let ceoExpr = 'neutral';
    let reactT = 0;
    let talkT = 0;
    let floorVal = floors[0];
    let imp = 0.5;
    const hover = { x: -1, y: -1 };

    function buildReel(slot) {
      const pool = slot.words;
      const moodW = rng.shuffle(pool.filter((w) => w.cat === mood));
      const buzz = rng.shuffle(pool.filter((w) => w.cat === 'buzz'));
      const boring = mood === 'boring' ? [] : rng.shuffle(pool.filter((w) => w.cat === 'boring'));
      const other = rng.shuffle(pool.filter((w) => w.cat !== mood && w.cat !== 'buzz' && w.cat !== 'boring'));
      const pick = [...moodW.slice(0, 1), ...buzz.slice(0, 2), ...boring.slice(0, 1)];
      while (pick.length < PER_REEL) pick.push(other.pop());
      const words = rng.shuffle(pick).map((w) => ({ ...w, a: w.base + (w.cat === mood ? MOOD_BONUS : 0) }));
      const as = words.map((w) => w.a);
      return { words, min: Math.min(...as), max: Math.max(...as), pos: rng.float(0, PER_REEL), speed: speed * rng.float(0.9, 1.12), t: 0, pick: -1, target: 0, auto: false, eager: false };
    }

    function startPitch() {
      mood = moodOrder[p];
      rumour = rng.pick(MOODS[mood].rumours);
      noteFlash = 0.8;
      reels = SLOTS.map(buildReel);
      cur = 0;
      phase = 'intro';
      phaseT = 0;
    }

    function react(expr, t = 1.1) {
      ceoExpr = expr;
      reactT = t;
    }

    function stopReel(auto) {
      const reel = reels[cur];
      const k = Math.round(auto ? reel.pos : reel.pos - grace);
      reel.target = k;
      reel.pick = mod(k, PER_REEL);
      reel.auto = auto;
      const w = reel.words[reel.pick];
      const v = reel.max > reel.min ? (w.a - reel.min) / (reel.max - reel.min) : 1;
      talkT = 0.45;
      if (auto) {
        sfx('bad');
        shake.hit(0.15);
        fl.add(rng.pick(REACTIONS.stall), PX + 12, 76, C.warn);
        react('annoyed');
      } else {
        sfx(v >= 0.75 ? 'good' : 'click');
        react(v >= 0.8 ? 'delighted' : v >= 0.45 ? 'interested' : v >= 0.2 ? 'neutral' : 'bored');
        const band = v >= 0.75 ? 'high' : v >= 0.35 ? 'mid' : 'low';
        fl.add(rng.pick(REACTIONS[band]), CX + 12, 76, band === 'high' ? C.good : band === 'mid' ? C.text : C.dim);
      }
      cur++;
      if (cur < reels.length) reels[cur].t = 0;
      else endPitch();
    }

    function endPitch() {
      let best = 0;
      let worst = 0;
      let got = 0;
      for (const r of reels) {
        const a = r.words[r.pick].a;
        best += r.max;
        worst += r.min;
        got += r.auto || r.eager ? r.min + 0.5 * (a - r.min) : a; // hesitating ("Uhh...") or fidgeting halves the word's effect
      }
      const raw = best > worst ? (got - worst) / (best - worst) : 1;
      const sc = Math.pow(clamp(raw, 0, 1), CURVE);
      results.push(sc);
      const band = sc >= 0.8 ? 'great' : sc >= 0.55 ? 'good' : sc >= 0.3 ? 'meh' : 'bad';
      say = rng.pick(REPLIES[band]);
      react(band === 'great' ? 'delighted' : band === 'good' ? 'interested' : band === 'meh' ? 'bored' : 'annoyed', 3.5);
      sfx(band === 'great' ? 'star' : band === 'good' ? 'coin' : band === 'meh' ? 'blip' : 'fail');
      if (band === 'bad') shake.hit();
      fl.add(`Impression ${Math.round(sc * 100)}%`, 88, 98, band === 'great' ? C.good : band === 'bad' ? C.bad : C.gold);
      phase = 'reply';
      phaseT = 0;
    }

    function floorTarget() {
      if (phase === 'arrive' || phase === 'reply') return floors[p + (phase === 'reply' ? 1 : 0)] ?? 40;
      if (phase === 'spin') return floors[p] + ((floors[p + 1] - floors[p]) * (cur + 0.6 * Math.min(1, reels[cur].t / autoT))) / reels.length;
      return floors[p];
    }

    startPitch();

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        anim += dt;
        fl.update(dt);
        shake.update(dt);
        noteFlash = Math.max(0, noteFlash - dt);
        talkT = Math.max(0, talkT - dt);
        if (reactT > 0 && (reactT -= dt) <= 0) ceoExpr = 'neutral';
        for (const r of reels) {
          if (r.pick < 0) r.pos += r.speed * dt;
          else r.pos += (r.target - r.pos) * Math.min(1, dt * 16);
        }
        floorVal += (floorTarget() - floorVal) * Math.min(1, dt * 2.5);
        const impT = results.length ? results.reduce((a, b) => a + b, 0) / results.length : 0.5;
        imp += (impT - imp) * Math.min(1, dt * 3);
        if (inst.done) return;
        phaseT += dt;
        const ptr = input.pointer;
        hover.x = ptr.x;
        hover.y = ptr.y;
        const clickStop = ptr.clicked && inside(ptr, STOP.x, STOP.y, STOP.w, STOP.h);
        if (phase === 'intro') {
          if (phaseT >= (p === 0 ? 2.2 : 1.4)) {
            phase = 'spin';
            phaseT = 0;
            reels[0].t = 0;
            input.consumeKeys();
          }
        } else if (phase === 'spin') {
          const reel = reels[cur];
          reel.t += dt;
          if (reactT <= 0 && reel.t > autoT * 0.6) ceoExpr = 'bored';
          const clickReel = ptr.clicked && inside(ptr, rx(cur), REELS_Y, RW, 73);
          const press = input.confirm() || clickStop || clickReel;
          if (reel.t >= autoT) stopReel(true);
          else if (press && reel.t < 0.3) {
            // Mashing: the reel has barely started. The CEO notices the fidgeting.
            if (!reel.eager) {
              fl.add('Too eager!', rx(cur) + RW / 2, WIN.y - 2, C.warn);
              sfx('bad');
            }
            reel.eager = true;
            input.consumeKeys();
            input.consumeClick();
          } else if (press) {
            input.consumeKeys();
            input.consumeClick();
            stopReel(false);
          }
        } else if (phase === 'reply') {
          if (phaseT >= 3.2 || (phaseT > 0.7 && (input.confirm() || ptr.clicked))) {
            input.consumeKeys();
            input.consumeClick();
            p++;
            if (p >= PITCHES) {
              phase = 'arrive';
              phaseT = 0;
              say = rng.pick(ARRIVALS);
              react('neutral', 9);
              sfx('ding');
            } else {
              startPitch();
              say = rng.pick(NEXTS);
            }
          }
        } else if (phase === 'arrive') {
          if (phaseT >= 2.6 || (phaseT > 0.9 && (input.confirm() || ptr.clicked))) {
            finish(inst, results.reduce((a, b) => a + b, 0) / results.length);
          }
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, H, C.bg);
        const arrived = phase === 'arrive' || inst.done;
        drawElevator(g, Math.round(floorVal), anim, arrived);
        header(g, theme?.title || 'Elevator Pitch', `Pitch ${Math.min(p + 1, PITCHES)}/${PITCHES}`);
        const spinning = phase === 'spin' && !inst.done;
        timerBar(g, spinning ? autoT - reels[cur].t : phase === 'intro' ? autoT : 0, autoT);

        // Rumour sticky note.
        rect(g, 9, 22, 464, 16, 'rgba(0,0,0,0.3)');
        rect(g, 8, 21, 464, 16, noteFlash > 0 && Math.floor(noteFlash * 10) % 2 ? '#fff6b0' : '#f7e27a');
        rect(g, 8, 21, 464, 2, '#e8cc4a');
        catIcon(g, mood, 13, 26);
        drawText(g, `Rumour: ${rumour}`, 24, 26, { color: C.ink });
        drawText(g, 'CEO likes', 452, 26, { color: '#7a6420', align: 'right' });
        catIcon(g, mood, 457, 26);

        // Impression plaque.
        rect(g, 10, 50, 156, 44, C.border);
        rect(g, 11, 51, 154, 42, '#2a2f45');
        rect(g, 11, 51, 154, 1, '#4a5170');
        drawText(g, `PITCH ${Math.min(p + 1, PITCHES)} OF ${PITCHES}`, 88, 55, { align: 'center', color: C.gold });
        drawText(g, 'CEO IMPRESSION', 88, 67, { align: 'center', color: C.dim });
        const ic = imp < 0.35 ? C.bad : imp < 0.6 ? C.warn : imp < 0.85 ? C.gold : C.good;
        rect(g, 18, 79, 140, 8, C.border);
        rect(g, 19, 80, 138, 6, C.panelDark);
        rect(g, 19, 80, Math.round(138 * clamp(imp, 0, 1)), 6, ic);
        rect(g, 19, 80, Math.round(138 * clamp(imp, 0, 1)), 1, 'rgba(255,255,255,0.35)');

        // The two of them.
        const youExpr = talkT > 0 && Math.floor(talkT * 12) % 2 ? 'talk' : ceoExpr === 'annoyed' || ceoExpr === 'bored' ? 'nervous' : 'neutral';
        person(g, PX, PY, 2, you, youExpr);
        person(g, CX, PY, 2, ceo, ceoExpr);
        if (ceoExpr === 'annoyed' && Math.floor(anim * 3) % 2) {
          rect(g, CX + 22, PY - 4, 3, 2, '#e8e8f0');
          rect(g, CX + 25, PY - 7, 2, 2, '#e8e8f0');
        }
        if (ceoExpr === 'bored' && spinning) drawText(g, 'z', CX + 24 + Math.round(Math.sin(anim * 3) * 2), PY - 6, { color: C.dim });

        // CEO speech bubble.
        if (phase !== 'spin' && say) {
          bubble(g, 292, 46, 180, 50, 'left');
          const lines = wrapText(say, 168);
          const ty = 46 + Math.floor((50 - lines.length * 10) / 2) + 1;
          lines.forEach((l, i) => drawText(g, l, 382, ty + i * 10, { align: 'center', color: C.ink }));
        }

        // Reels.
        rect(g, 6, REELS_Y, 468, 73, C.border);
        rect(g, 7, REELS_Y + 1, 466, 71, '#2a2f45');
        rect(g, 7, REELS_Y + 1, 466, 1, '#4a5170');
        reels.forEach((reel, i) => {
          const x = rx(i);
          const active = spinning && i === cur;
          drawText(g, SLOTS[i].label, x + RW / 2, REELS_Y + 4, { align: 'center', color: active ? C.gold : reel.pick >= 0 ? C.good : C.dim });
          rect(g, x, WIN.y, RW, WIN.h, C.border);
          rect(g, x + 1, WIN.y + 1, RW - 2, WIN.h - 2, '#c9ced8');
          rect(g, x + 1, CY - 8, RW - 2, ROW, reel.pick >= 0 ? '#e4f6df' : '#fdfbf3');
          g.save();
          g.beginPath();
          g.rect(x + 1, WIN.y + 1, RW - 2, WIN.h - 2);
          g.clip();
          const base = Math.round(reel.pos);
          for (let k = base - 2; k <= base + 2; k++) {
            const wd = reel.words[mod(k, PER_REEL)];
            const yy = Math.round(CY + (reel.pos - k) * ROW) - 4;
            const tw = measureText(wd.w) + 10;
            const sx = x + Math.round((RW - tw) / 2);
            catIcon(g, wd.cat, sx, yy);
            drawText(g, wd.w, sx + 10, yy, { color: Math.abs(reel.pos - k) < 0.5 ? C.ink : '#5d616e' });
          }
          g.restore();
          rect(g, x + 1, WIN.y + 1, RW - 2, 2, 'rgba(0,0,0,0.25)');
          rect(g, x + 1, WIN.y + WIN.h - 3, RW - 2, 2, 'rgba(0,0,0,0.25)');
          // Payline markers.
          const mc = active ? '#e2504a' : '#7a7d8d';
          rect(g, x + 1, CY - 2, 2, 4, mc);
          rect(g, x + 3, CY - 1, 1, 2, mc);
          rect(g, x + RW - 3, CY - 2, 2, 4, mc);
          rect(g, x + RW - 4, CY - 1, 1, 2, mc);
          if (spinning && i > cur) rect(g, x + 1, WIN.y + 1, RW - 2, WIN.h - 2, 'rgba(20,24,40,0.35)');
          if (reel.auto || reel.eager) drawText(g, reel.auto ? 'uhh' : 'eager', x + RW - 4, WIN.y + 3, { align: 'right', color: C.bad });
          frame(g, x - 1, WIN.y - 1, RW + 2, WIN.h + 2, active ? C.gold : reel.pick >= 0 ? C.good : C.panelLight);
        });

        // The pitch so far.
        const words = reels.map((r, i) => (r.pick >= 0 ? r.words[r.pick].w : spinning && i === cur ? '...' : '___'));
        bubble(g, SAY.x, SAY.y, SAY.w, SAY.h);
        const lines = wrapText(`You: "${words.join(' ')}"`, SAY.w - 12);
        const ty = lines.length > 1 ? SAY.y + 3 : SAY.y + 8;
        lines.slice(0, 2).forEach((l, i) => drawText(g, l, SAY.x + 6, ty + i * 10, { color: C.ink }));

        const label = phase === 'reply' || phase === 'arrive' ? 'NEXT' : 'STOP';
        drawButton(g, { ...STOP, label, sub: 'Space', color: label === 'STOP' ? '#b83a32' : C.goodBtn, disabled: phase === 'intro' }, spinning, inside(hover, STOP.x, STOP.y, STOP.w, STOP.h));

        drawText(g, 'Space/Enter or click STOP (or the reel). Pick the icon from the rumour!', W / 2, 257, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };
    return inst;
  },
};
