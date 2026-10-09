// Calendar Defender: lane tower defence on your Friday afternoon. Meeting invites march from the right toward your
// Focus Time; spend Excuses (they regenerate) on Decliners, Out-of-Office walls, Double-bookings and Headphones.
import { W, C, rect, frame, panel, drawText, header, timerBar, face, Floaters, Shake, byDiff, clamp, finish } from '../engine/mgkit.js';
import { wrapText } from '../engine/font.js';
import { INVITES, INVITES_DEPT, KILL_LINES, LEAK_LINES } from '../data/mg-defender.js';

const LANES = 5;
const LANE_H = 34;
const GY = 32; // top of the lanes
const GX = 48; // first grid column
const CW = 42;
const NCOL = 10;
const FOCUS_X = 46; // invites reaching this x leak into your focus time
const BAR_Y = 207;

const TOWERS = [
  { key: 'decline', name: 'Decline', cost: 2, hp: 4, color: '#c0392b' },
  { key: 'ooo', name: 'Out of Office', cost: 3, hp: 14, life: 20, color: '#d9a020' },
  { key: 'dbl', name: 'Double-booked', cost: 3, color: '#8a5ad0' },
  { key: 'phones', name: 'Headphones', cost: 4, color: '#2f8a6a' },
];
const KINDS = {
  short: { hp: 3, speed: 20, w: 44, col: '#4fa3e0', weight: 1 },
  std: { hp: 6, speed: 16, w: 58, col: '#3b6fb6', weight: 1 },
  long: { hp: 11, speed: 12, w: 70, col: '#d9822b', weight: 2 },
  recur: { hp: 6, speed: 15, w: 58, col: '#8a5ad0', weight: 1 },
  mini: { hp: 2, speed: 22, w: 34, col: '#a88ae0', weight: 0.5 },
  boss: { hp: 30, speed: 10, w: 76, col: '#b8202c', weight: 4 },
};
const TIMES = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

const laneY = (l) => GY + l * LANE_H;
const colX = (c) => GX + c * CW;
const btnRect = (i) => ({ x: 92 + i * 96, y: BAR_Y, w: 92, h: 40 });
const inR = (p, r) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export default {
  id: 'defender',
  name: 'Calendar Defender',
  help: 'Defend your Focus Time from meeting invites. Pick a defence (1-4 or click the bar), then place it on the calendar (click, or arrows + SPACE).',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const waveDur = byDiff(d, 45, 60);
    const limit = waveDur + 22;
    const regen = byDiff(d, 1.5, 2.1);
    const speedMul = byDiff(d, 0.9, 1.2);
    const hpMul = 1 + 1.3 * Math.pow(clamp(d, 0, 1), 0.7);
    const splits = d >= 0.5;
    const fl = new Floaters();
    const shake = new Shake();
    const deptLabels = INVITES_DEPT[theme?.dept] || [];

    // --- Wave schedule: a trickle that thickens, then the final wave with the CEO All-Hands.
    const count = Math.round(byDiff(d, 16, 32));
    const spawns = [];
    let lastLane = -1;
    for (let k = 0; k < count; k++) {
      const f = k / count;
      const t = 3 + Math.pow(f, 0.85) * (waveDur - 8) + rng.float(-0.6, 0.6);
      let lane = rng.int(0, LANES - 1);
      if (lane === lastLane) lane = (lane + rng.int(1, LANES - 1)) % LANES;
      lastLane = lane;
      const r = rng.next();
      let kind = 'std';
      if (f < 0.25) kind = r < 0.6 ? 'short' : 'std';
      else if (r < 0.25) kind = 'short';
      else if (r < 0.5 + 0.1 * d) kind = 'std';
      else if (splits && r < 0.75) kind = 'recur';
      else kind = f > 0.4 ? 'long' : 'std';
      spawns.push({ t, lane, kind });
    }
    spawns.push({ t: waveDur - 4, lane: rng.int(1, 3), kind: 'boss' });
    spawns.sort((a, b) => a.t - b.t);
    const bossHp = Math.round(byDiff(d, 26, 70));
    let totalW = 0;
    for (const s of spawns) totalW += KINDS[s.kind].weight + (s.kind === 'recur' && splits ? 2 * KINDS.mini.weight : 0);

    let time = 0;
    let next = 0; // next spawn index
    let excuse = 5;
    let regenT = 0;
    let lives = 5;
    let killedW = 0;
    let leaks = 0;
    let sel = 0;
    const cur = { c: 1, l: 2 };
    let anim = 0;
    let endT = -1;
    let banner = '';
    const invites = [];
    const towers = []; // { type, c, l, hp, cool, life }
    const bullets = [];
    const waves = []; // headphone shockwaves { l, t }

    const towerAt = (c, l) => towers.find((t) => t.c === c && t.l === l);
    const score = () => clamp(killedW / totalW - 0.04 * leaks, 0, 1);

    function spawnInvite(kind, lane, x) {
      const k = KINDS[kind];
      const pool = kind === 'std' ? [...INVITES.std, ...deptLabels] : INVITES[kind];
      const hp = kind === 'boss' ? bossHp : Math.max(1, Math.round(k.hp * hpMul));
      invites.push({ kind, lane, x, w: k.w, hp, max: hp, speed: k.speed * speedMul * rng.float(0.92, 1.08), label: rng.pick(pool), hit: 0, chew: 0 });
    }

    function kill(inv) {
      inv.dead = true;
      killedW += KINDS[inv.kind].weight;
      sfx(inv.kind === 'boss' ? 'star' : 'coin');
      fl.add(inv.kind === 'boss' ? 'All-Hands cancelled!' : rng.pick(KILL_LINES), inv.x + inv.w / 2, laneY(inv.lane) + 4, inv.kind === 'boss' ? C.gold : C.good);
      if (inv.kind === 'recur' && splits) {
        spawnInvite('mini', inv.lane, inv.x);
        spawnInvite('mini', inv.lane, inv.x + 30);
        fl.add('It recurs!', inv.x + inv.w / 2, laneY(inv.lane) + 16, '#c8a8ff');
      }
    }

    function damage(inv, n) {
      if (inv.dead) return;
      inv.hp -= n;
      inv.hit = 0.12;
      if (inv.hp <= 0) kill(inv);
    }

    function reject(text) {
      regenT = 0; // spamming excuses ruins your credibility
      sfx('bad');
      fl.add(text, clamp(colX(cur.c) + CW / 2, 60, 420), laneY(cur.l) + 4, C.bad);
    }

    function place(c, l) {
      const tp = TOWERS[sel];
      if (excuse < tp.cost) return reject('Not enough excuses!');
      if (tp.key === 'phones') {
        excuse -= tp.cost;
        sfx('ding');
        waves.push({ l, t: 0.6 });
        fl.add('Headphones on!', colX(c) + CW / 2, laneY(l) + 6, C.so);
        for (const inv of [...invites]) if (inv.lane === l && inv.x < W - 4) damage(inv, Math.round(8 * hpMul));
        return;
      }
      if (towerAt(c, l)) return reject('Slot taken!');
      excuse -= tp.cost;
      sfx('ding');
      towers.push({ type: tp.key, c, l, hp: tp.hp || 0, max: tp.hp || 0, cool: 0.3, life: tp.life || 0, hit: 0 });
    }

    function end(text) {
      if (endT >= 0) return;
      banner = text;
      endT = 1.2;
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        for (const wv of waves) wv.t -= dt;
        while (waves.length && waves[0].t <= 0) waves.shift();
        if (inst.done) return;
        if (endT >= 0) {
          endT -= dt;
          if (endT <= 0) finish(inst, score());
          return;
        }
        time += dt;
        // Excuses regenerate.
        regenT += dt;
        if (excuse >= 12) regenT = 0;
        while (regenT >= regen) {
          regenT -= regen;
          excuse = Math.min(12, excuse + 1);
        }
        // Spawning.
        while (next < spawns.length && spawns[next].t <= time) {
          const s = spawns[next++];
          spawnInvite(s.kind, s.lane, W + 2);
          if (s.kind === 'boss') {
            sfx('door');
            shake.hit(0.3);
            fl.add('CEO ALL-HANDS INCOMING', 260, laneY(s.lane) - 4, C.bad);
          }
        }
        // Towers.
        for (const t of towers) {
          t.hit = Math.max(0, t.hit - dt);
          if (t.type === 'decline') {
            t.cool -= dt;
            const x0 = colX(t.c) + CW / 2;
            if (t.cool <= 0 && invites.some((v) => !v.dead && v.lane === t.l && v.x + v.w > x0 && v.x < W - 6)) {
              t.cool = 1;
              bullets.push({ x: x0 + 6, l: t.l });
              sfx('type');
            }
          } else if (t.type === 'ooo') {
            t.life -= dt;
            if (t.life <= 0) t.hp = 0;
          }
        }
        // Bullets.
        for (const b of bullets) {
          b.x += 150 * dt;
          const v = invites.find((v) => !v.dead && v.lane === b.l && b.x + 6 >= v.x && b.x <= v.x + v.w);
          if (v) {
            b.gone = true;
            damage(v, 1);
          } else if (b.x > W) b.gone = true;
        }
        // Invites walk, get blocked by walls/decliners, chew through them.
        for (const v of invites) {
          if (v.dead) continue;
          v.hit = Math.max(0, v.hit - dt);
          const block = towers.find((t) => t.l === v.lane && t.type !== 'dbl' && t.hp > 0 && v.x <= colX(t.c) + CW - 8 && v.x >= colX(t.c) - 4);
          if (block) {
            block.hp -= (v.kind === 'boss' ? 3 : 1) * dt;
            block.hit = 0.1;
            v.chew += dt;
            continue;
          }
          const slow = towers.some((t) => t.type === 'dbl' && t.l === v.lane && v.x < colX(t.c) + CW * 2 && v.x + v.w > colX(t.c));
          v.x -= v.speed * (slow ? 0.45 : 1) * dt;
          if (v.x <= FOCUS_X) {
            v.dead = true;
            v.leaked = true;
            leaks++;
            lives--;
            sfx('bad');
            shake.hit(0.3);
            fl.add(rng.pick(LEAK_LINES), 70, laneY(v.lane) + 8, C.bad);
          }
        }
        for (let i = towers.length - 1; i >= 0; i--) {
          const t = towers[i];
          if (t.type !== 'dbl' && t.hp <= 0) {
            towers.splice(i, 1);
            fl.add(t.type === 'ooo' ? 'Back from holiday' : 'Caved in', colX(t.c) + CW / 2, laneY(t.l) + 6, C.warn);
          }
        }
        for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].gone) bullets.splice(i, 1);
        for (let i = invites.length - 1; i >= 0; i--) if (invites[i].dead) invites.splice(i, 1);
        if (lives <= 0) return end('FRIDAY RUINED');
        if (next >= spawns.length && !invites.length) return end(leaks ? 'Weekend saved!' : 'Calendar clear!');
        if (time >= limit) return end("It's 17:30. Go home.");

        // --- Input: tower choice.
        for (let i = 0; i < TOWERS.length; i++) if (input.pressedExact(String(i + 1))) (sel = i), sfx('blip');
        const p = input.pointer;
        for (let i = 0; i < TOWERS.length; i++) {
          if (p.clicked && inR(p, btnRect(i))) {
            sel = i;
            sfx('blip');
            input.consumeClick();
          }
        }
        // Cell cursor.
        if (input.pressed('ArrowLeft')) cur.c = Math.max(0, cur.c - 1);
        if (input.pressed('ArrowRight')) cur.c = Math.min(NCOL - 1, cur.c + 1);
        if (input.pressed('ArrowUp')) cur.l = Math.max(0, cur.l - 1);
        if (input.pressed('ArrowDown')) cur.l = Math.min(LANES - 1, cur.l + 1);
        const inGrid = p.x >= GX && p.x < GX + NCOL * CW && p.y >= GY && p.y < GY + LANES * LANE_H;
        if (inGrid && (p.moved || p.clicked)) {
          cur.c = Math.floor((p.x - GX) / CW);
          cur.l = Math.floor((p.y - GY) / LANE_H);
        }
        if (input.confirm() || (p.clicked && inGrid)) place(cur.c, cur.l);
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, 270, '#20243a');
        header(g, theme?.title || 'Calendar Defender', `Lives ${lives}  Stopped ${Math.round(score() * 100)}%`);
        timerBar(g, limit - time, limit);
        // Calendar grid.
        rect(g, 0, 19, W, 12, '#2a2f45');
        drawText(g, 'FOCUS', 23, 21, { align: 'center', color: C.good });
        for (let c = 0; c < NCOL; c++) drawText(g, TIMES[c], colX(c) + 3, 21, { color: C.dim });
        for (let l = 0; l < LANES; l++) {
          const y = laneY(l);
          rect(g, GX, y, NCOL * CW, LANE_H, l % 2 ? '#eef1f6' : '#e2e7ef');
          for (let c = 0; c < NCOL; c++) {
            rect(g, colX(c), y, 1, LANE_H, '#c4cbd8');
            rect(g, colX(c) + CW / 2, y + LANE_H / 2, 1, 1, '#c4cbd8');
          }
          rect(g, GX, y + LANE_H - 1, NCOL * CW, 1, '#b4bccb');
        }
        // Focus Time zone.
        rect(g, 0, GY, FOCUS_X, LANES * LANE_H, '#2f6b3a');
        rect(g, FOCUS_X - 2, GY, 2, LANES * LANE_H, C.good);
        for (let l = 0; l < LANES; l++) {
          const y = laneY(l);
          const lost = l >= lives; // dim desks as lives drain
          rect(g, 6, y + 20, 34, 6, lost ? '#4a3a2a' : '#8a6a4a');
          face(g, 17, y + 6, 37 + l * 11);
          rect(g, 16, y + 6, 14, 2, lost ? '#555' : '#222'); // headphones band
          rect(g, 15, y + 8, 2, 4, lost ? '#555' : C.so);
          rect(g, 29, y + 8, 2, 4, lost ? '#555' : C.so);
          if (lost) drawText(g, 'zz', 36, y + 4, { color: C.bad });
        }
        // Double-booked zones under everything else.
        for (const t of towers)
          if (t.type === 'dbl') {
            g.fillStyle = 'rgba(138,90,208,0.18)';
            g.fillRect(colX(t.c), laneY(t.l), Math.min(CW * 2, GX + NCOL * CW - colX(t.c)), LANE_H - 1);
          }
        for (const t of towers) drawTower(g, t, anim);
        for (const v of invites) drawInvite(g, v, anim);
        for (const b of bullets) {
          const y = laneY(b.l) + 12;
          rect(g, b.x - 1, y - 1, 15, 10, C.border);
          rect(g, b.x, y, 13, 8, '#e2504a');
          drawText(g, 'NO', b.x + 7, y, { align: 'center', color: '#fff' });
        }
        for (const wv of waves) {
          const k = 1 - wv.t / 0.6;
          g.fillStyle = `rgba(126,224,195,${0.5 * (1 - k)})`;
          g.fillRect(GX, laneY(wv.l), NCOL * CW, LANE_H);
          drawText(g, 'SHHHHH!', GX + k * NCOL * CW * 0.8, laneY(wv.l) + 12, { color: '#0f3d2e' });
        }
        // Cursor + placement preview.
        if (endT < 0) {
          const tp = TOWERS[sel];
          const x = colX(cur.c);
          const y = laneY(cur.l);
          const okP = excuse >= tp.cost && (tp.key === 'phones' || !towerAt(cur.c, cur.l));
          if (tp.key === 'phones') frame(g, GX, y, NCOL * CW, LANE_H, okP ? 'rgba(47,138,106,0.8)' : 'rgba(226,80,74,0.6)');
          frame(g, x - 1, y - 1, CW + 2, LANE_H + 2, okP ? C.gold : C.bad);
          frame(g, x, y, CW, LANE_H, C.border);
        }

        // Bottom bar: excuses + defences.
        panel(g, 4, BAR_Y, 84, 40);
        drawText(g, 'Excuses', 46, BAR_Y + 4, { align: 'center', color: C.dim });
        drawText(g, String(excuse), 46, BAR_Y + 14, { align: 'center', color: C.gold, scale: 2 });
        rect(g, 10, BAR_Y + 32, 72, 4, C.border);
        rect(g, 11, BAR_Y + 33, Math.round(70 * (excuse >= 12 ? 1 : regenT / regen)), 2, C.gold);
        TOWERS.forEach((tp, i) => {
          const r = btnRect(i);
          const can = excuse >= tp.cost;
          panel(g, r.x, r.y, r.w, r.h, { fill: i === sel ? C.panelLight : C.panel });
          if (i === sel) frame(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, C.gold);
          rect(g, r.x + 3, r.y + 3, 9, 9, C.accent);
          drawText(g, String(i + 1), r.x + 8, r.y + 4, { align: 'center' });
          drawTowerIcon(g, tp.key, r.x + 5, r.y + 16);
          drawText(g, tp.name, r.x + 25, r.y + 8, { color: can ? C.text : C.dim });
          drawText(g, `${tp.cost} excuses`, r.x + 25, r.y + 22, { color: can ? C.gold : C.bad });
        });
        if (endT >= 0) {
          rect(g, 120, 100, 240, 34, C.border);
          rect(g, 121, 101, 238, 32, lives > 0 ? '#2f6b3a' : '#7a2b2b');
          drawText(g, banner, 240, 110, { align: 'center', color: C.text, shadow: C.border, scale: banner.length > 16 ? 1 : 2 });
        }
        drawText(g, '1-4 or click: pick defence  |  click cell or arrows + SPACE: place', W / 2, 256, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };

    function drawInvite(g, v, t) {
      const k = KINDS[v.kind];
      const x = Math.round(v.x);
      const y = laneY(v.lane) + 3;
      const h = LANE_H - 8;
      const walk = v.chew > 0 ? 0 : Math.floor(t * 8 + v.x) % 2;
      // Little legs.
      rect(g, x + 8 + walk * 2, y + h, 2, 3, C.border);
      rect(g, x + v.w - 12 - walk * 2, y + h, 2, 3, C.border);
      rect(g, x, y, v.w, h, C.border);
      rect(g, x + 1, y + 1, v.w - 2, h - 2, v.hit > 0 ? '#ffffff' : k.col);
      rect(g, x + 1, y + 1, 3, h - 2, 'rgba(0,0,0,0.25)');
      rect(g, x + 4, y + 1, v.w - 5, 1, 'rgba(255,255,255,0.35)');
      if (v.kind === 'boss') {
        rect(g, x + v.w / 2 - 7, y - 5, 14, 5, C.gold);
        rect(g, x + v.w / 2 - 7, y - 7, 2, 2, C.gold);
        rect(g, x + v.w / 2 - 1, y - 7, 2, 2, C.gold);
        rect(g, x + v.w / 2 + 5, y - 7, 2, 2, C.gold);
      }
      if (v.kind === 'recur' || v.kind === 'mini') {
        frame(g, x + v.w - 8, y + 2, 5, 5, '#fff');
        rect(g, x + v.w - 4, y + 2, 2, 2, k.col);
      }
      const lines = wrapText(v.label, v.w - 8).slice(0, 2);
      lines.forEach((ln, i) => drawText(g, ln, x + 5, y + 2 + i * 9, { color: '#fff' }));
      if (v.hp < v.max) {
        rect(g, x + 4, y + h - 3, v.w - 8, 2, 'rgba(0,0,0,0.4)');
        rect(g, x + 4, y + h - 3, Math.round((v.w - 8) * (v.hp / v.max)), 2, C.good);
      }
    }

    return inst;
  },
};

function drawTowerIcon(g, key, x, y) {
  if (key === 'decline') {
    rect(g, x, y, 16, 11, C.border);
    rect(g, x + 1, y + 1, 14, 9, '#c0392b');
    drawText(g, 'NO', x + 8, y + 2, { align: 'center', color: '#fff' });
    rect(g, x + 7, y + 11, 2, 6, '#6b4a32');
  } else if (key === 'ooo') {
    rect(g, x + 7, y + 4, 2, 14, '#8a5a2a');
    rect(g, x + 1, y, 14, 3, '#3a9a3a');
    rect(g, x + 3, y + 3, 4, 2, '#3a9a3a');
    rect(g, x + 9, y + 3, 4, 2, '#3a9a3a');
    rect(g, x, y + 16, 16, 2, '#f2d14e');
  } else if (key === 'dbl') {
    rect(g, x, y + 2, 11, 12, C.border);
    rect(g, x + 1, y + 3, 9, 10, '#8a5ad0');
    rect(g, x + 5, y + 5, 11, 12, C.border);
    rect(g, x + 6, y + 6, 9, 10, '#f27fb8');
    rect(g, x + 6, y + 6, 9, 2, '#c0392b');
  } else {
    rect(g, x + 2, y + 2, 12, 3, '#222');
    rect(g, x + 1, y + 4, 2, 4, '#222');
    rect(g, x + 13, y + 4, 2, 4, '#222');
    rect(g, x, y + 8, 4, 7, C.so);
    rect(g, x + 12, y + 8, 4, 7, C.so);
  }
}

function drawTower(g, t, anim) {
  const x = colX(t.c);
  const y = laneY(t.l);
  const flash = t.hit > 0 && Math.floor(anim * 20) % 2 === 0;
  if (t.type === 'decline') {
    rect(g, x + 6, y + 22, 30, 8, '#6b4a32'); // desk
    rect(g, x + 6, y + 22, 30, 1, '#8a6a4a');
    face(g, x + 8, y + 9, 5 + t.c * 7 + t.l * 3);
    const bob = Math.floor(anim * 4 + t.c) % 2;
    rect(g, x + 22, y + 4 + bob, 16, 10, C.border);
    rect(g, x + 23, y + 5 + bob, 14, 8, flash ? '#fff' : '#e2504a');
    drawText(g, 'NO', x + 30, y + 5 + bob, { align: 'center', color: '#fff' });
    rect(g, x + 29, y + 14 + bob, 2, 8, '#6b4a32');
  } else if (t.type === 'ooo') {
    // Palm tree + out-of-office sign: a wall.
    rect(g, x + 4, y + 6, 34, 22, C.border);
    rect(g, x + 5, y + 7, 32, 20, flash ? '#fff' : '#f2d14e');
    rect(g, x + 5, y + 7, 32, 2, '#fff6c8');
    drawText(g, 'OOO', x + 21, y + 10, { align: 'center', color: '#5a3e00' });
    rect(g, x + 7, y + 20, 28 * (t.life / 20), 3, '#c98d1e');
    rect(g, x + 34, y + 2, 2, 10, '#8a5a2a');
    rect(g, x + 30, y, 10, 2, '#3a9a3a');
  } else if (t.type === 'dbl') {
    rect(g, x + 6, y + 5, 18, 18, C.border);
    rect(g, x + 7, y + 6, 16, 16, '#8a5ad0');
    rect(g, x + 16, y + 10, 18, 18, C.border);
    rect(g, x + 17, y + 11, 16, 16, '#f27fb8');
    rect(g, x + 17, y + 11, 16, 3, '#c0392b');
    drawText(g, 'x2', x + 25, y + 16, { align: 'center', color: '#3a1a40' });
  }
  if (t.max && t.hp < t.max) {
    rect(g, x + 6, y + LANE_H - 4, 30, 2, 'rgba(0,0,0,0.4)');
    rect(g, x + 6, y + LANE_H - 4, Math.round(30 * clamp(t.hp / t.max, 0, 1)), 2, C.warn);
  }
}
