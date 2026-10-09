// Coffee Crossing (Corporate Frogger): carry a full cup from the kitchen to your desk across office "lanes" of
// speed-walking managers, rolling chairs, mail carts and Roombas. Collisions spill coffee; deliver as much as you can.
import { W, C, rect, drawText, measureText, header, timerBar, Floaters, Shake, Countdown, byDiff, clamp, lerp, finish } from '../engine/mgkit.js';

const TW = 16; // tile width
const TH = 20; // tile height (oblique view: rows are a bit taller than wide)
const COLS = 24;
const FX = 48; // field left edge
const FW = COLS * TW; // 384
const LOOP = FW + 48; // traffic wraps over this length (24 px off-screen on each side)
const HOP = 0.1; // hop animation, seconds

const SHIRTS = ['#3b6fb6', '#b63b3b', '#3bb66a', '#b6973b', '#7a3bb6', '#c86a9a', '#4a9aa0', '#d07a2a'];
const HAIRS = ['#2b1d14', '#7a4a22', '#d9b25c', '#a33b20', '#1a1a1a', '#9a9aa0'];
const SKINS = ['#f2c9a0', '#d9a273', '#a86b42', '#6b4228'];
const PANTS = ['#2b2e38', '#3a3f55', '#4a3a2a', '#22252e'];

// Obstacle kinds: collision width (px), speed multiplier, density multiplier.
const KINDS = {
  manager: { w: 9, speed: 1.45, dens: 1 },
  chair: { w: 11, speed: 1.1, dens: 1 },
  cart: { w: 30, speed: 0.6, dens: 0.7 },
  roomba: { w: 11, speed: 0.55, dens: 1.1 },
  boxes: { w: 12, speed: 0.8, dens: 1 },
  dog: { w: 11, speed: 1.6, dens: 0.8 },
};

const QQ_LINES = [
  'Quick question?', 'Got a sec?', 'Quick sync?', 'Can I borrow you?', 'Did you get my email?', 'While I have you...',
  'Just a quick one!', 'Not urgent, but...', 'Ooh, is that coffee?', 'Circle back on Q3?', 'Do you know the Wi-Fi?',
  'Who owns the printer?', 'Are you free at 4:45?', 'Small favour?', 'Saw your Slack status!', 'Real quick, promise.',
  'Can you join a 2-min call?', 'Tiny thing, huge impact.', 'Who moved my stapler?', 'Is this meeting optional?',
  'Wanna see my cat pics?', 'Have you done the survey?',
];
const QQ_BYE = ["...I'll email you.", 'Let me loop in Dave.', 'Ok, ping me!', 'Never mind, found it.', 'Love this chat!'];
const SPILL = ['Splash!', 'My shirt!', 'Splash!', 'Latte art!', 'Spillage!', 'Ow, hot!', 'Splash!', 'Not the carpet!'];
const DESK_BUMP = ["That's Dave's desk.", 'Not your desk!', 'Hot-desk taken.', "That's the CFO's plant.", 'Wrong cubicle.', 'Occupied.'];
const DELIVERED = ['Ahh, caffeine.', 'Productivity restored.', 'Fuel acquired.', 'Sip of victory.', 'Brain: online.', 'Hydrated-ish.'];
const DEPT_NOTE = {
  lobby: 'Mind the mail carts.',
  support: 'Headset zone ahead.',
  sales: 'Beware: quota chasers.',
  marketing: 'Rebrand in progress.',
  it: 'Cables everywhere.',
  finance: 'Audit traffic: heavy.',
  legalhr: 'Walk, do not run.',
  exec: 'Executive fast lane.',
};

export default {
  id: 'frogger',
  name: 'Coffee Crossing',
  help: 'Carry your coffee from the kitchen to your desk. Arrows hop (hold to keep going) or click beside you. Dodge traffic!',
  create({ difficulty: d, rng, theme, sfx = () => {} }) {
    const fl = new Floaters();
    const shake = new Shake();
    const half = Math.round(byDiff(d, 3, 4));
    const R = 2 * half + 3; // goal + lanes + median + lanes + kitchen
    const Y0 = 24 + Math.floor(((11 - R) * TH) / 2);
    const MEDIAN = half + 1;
    const KITCHEN = R - 1;
    const required = Math.round(byDiff(d, 2, 3));
    const total = new Countdown(byDiff(d, 50, 45));
    const spillAmt = byDiff(d, 0.22, 0.3);
    const slotW = Math.round(byDiff(d, 5, 3));
    const baseSpeed = byDiff(d, 26, 50);
    const rowKind = (r) => (r === 0 ? 'goal' : r === MEDIAN ? 'median' : r === KITCHEN ? 'kitchen' : 'lane');

    // Median decor (blocked tiles).
    const decor = new Map();
    const decorCount = Math.round(byDiff(d, 4, 6));
    for (const c of rng.sample([...Array(COLS).keys()], decorCount)) decor.set(c, rng.pick(['plant', 'cabinet', 'cooler', 'printer', 'plant']));

    // Lanes.
    const pool = ['manager', 'chair', 'cart', 'roomba', 'boxes'];
    if (d >= 0.4) pool.push('dog', 'manager');
    const lanes = {};
    let prev = '';
    let dir = rng.chance(0.5) ? 1 : -1;
    for (let r = 1; r < KITCHEN; r++) {
      if (rowKind(r) !== 'lane') continue;
      let kind = rng.pick(pool);
      if (kind === prev) kind = rng.pick(pool.filter((k) => k !== prev));
      prev = kind;
      const K = KINDS[kind];
      const maxN = Math.max(1, Math.floor(LOOP / (K.w + 58)));
      const n = clamp(Math.round(byDiff(d, 2, 3.4) * K.dens * rng.float(0.85, 1.15)), 1, maxN);
      const spacing = LOOP / n;
      const off = rng.float(0, spacing);
      const obs = [];
      for (let i = 0; i < n; i++) {
        obs.push({
          kind,
          x: ((off + i * spacing + rng.float(-0.12, 0.12) * spacing) % LOOP) - 24,
          w: K.w,
          phase: rng.float(0, 6.28),
          shirt: rng.pick(SHIRTS),
          hair: rng.pick(HAIRS),
          skin: rng.pick(SKINS),
          pants: rng.pick(PANTS),
          cat: kind === 'roomba' && rng.chance(0.3),
          yap: rng.float(0, 2),
        });
      }
      lanes[r] = { kind, dir, speed: baseSpeed * K.speed * rng.float(0.88, 1.12), obs };
      dir = -dir;
    }
    const laneRows = Object.keys(lanes).map(Number);

    // "Quick question?" colleague: wanders lanes and homes in on yours.
    const qq = {
      row: rng.pick(laneRows),
      x: rng.chance(0.5) ? -10 : FW + 10,
      dir: 1,
      speed: byDiff(d, 20, 32),
      shiftT: byDiff(d, 3.5, 2),
      tele: 0,
      target: 0,
      gone: 0,
      leaving: false,
      shirt: '#3bb66a',
      hair: '#d9b25c',
      skin: rng.pick(SKINS),
      pants: '#3a3f55',
    };
    qq.dir = qq.x < 0 ? 1 : -1;

    const p = { col: COLS >> 1, row: KITCHEN, fx: 0, fy: 0, hopT: 0, face: 0, stun: 0, freeze: 0, inv: 0.6, coffee: 1, lastSafe: KITCHEN };
    let slot = 0;
    const newSlot = () => (slot = rng.int(1, COLS - slotW - 1));
    newSlot();
    const delivered = [];
    let celebrate = 0;
    let buffer = null;
    let heldKey = null;
    let keyRep = 0;
    let mouseRep = 0;
    let bubble = null; // { text, t }
    let puddles = [];
    let anim = 0;
    const note = DEPT_NOTE[theme?.dept] || 'Mind the traffic.';
    let noteT = 3;

    const colX = (c) => FX + c * TW + TW / 2;
    const rowY = (r) => Y0 + r * TH + TH - 3; // feet line
    const isFree = (r, c) => {
      if (c < 0 || c >= COLS || r < 0 || r >= R) return false;
      if (r === 0) return c >= slot && c < slot + slotW;
      if (r === MEDIAN) return !decor.has(c);
      return true;
    };
    const nearestFree = (r, c) => {
      for (let k = 0; k < COLS; k++) {
        if (isFree(r, c + k)) return c + k;
        if (isFree(r, c - k)) return c - k;
      }
      return c;
    };
    const score = () => delivered.reduce((a, b) => a + b, 0) / required;
    const busy = () => p.stun > 0 || p.freeze > 0 || celebrate > 0 || inst.done;

    function hop(dx, dy) {
      if (busy()) return;
      if (p.hopT > 0) {
        buffer = [dx, dy];
        return;
      }
      const nc = p.col + dx;
      const nr = p.row + dy;
      p.face = dx ? dx : dy < 0 ? 0 : 2;
      if (!isFree(nr, nc)) {
        if (nr === 0 && nc >= 0 && nc < COLS) {
          fl.add(rng.pick(DESK_BUMP), colX(nc), rowY(0) - 14, C.warn);
          sfx('click');
        }
        return;
      }
      p.fx = colX(p.col);
      p.fy = rowY(p.row);
      p.col = nc;
      p.row = nr;
      p.hopT = HOP;
      sfx('step');
      const k = rowKind(nr);
      if (k === 'median' || k === 'kitchen') p.lastSafe = nr;
      if (k === 'goal') deliver();
    }

    function deliver() {
      p.hopT = 0;
      delivered.push(p.coffee);
      sfx('coin');
      fl.add(`${Math.round(p.coffee * 100)}% delivered!`, colX(p.col), rowY(0) - 16, C.good);
      fl.add(rng.pick(DELIVERED), colX(p.col), rowY(0) - 4, C.gold);
      if (delivered.length >= required) return finish(inst, score());
      celebrate = 0.9;
    }

    function nextRound() {
      for (const r of laneRows) lanes[r].speed *= 1.08;
      p.col = COLS >> 1;
      p.row = KITCHEN;
      p.lastSafe = KITCHEN;
      p.coffee = 1;
      p.inv = 0.8;
      p.hopT = 0;
      newSlot();
      puddles = puddles.slice(-6);
      sfx('ding');
      fl.add('Refill! Next cup.', colX(p.col), rowY(KITCHEN) - 16, C.coffee);
    }

    function spill() {
      p.coffee = Math.max(0, p.coffee - spillAmt);
      p.stun = 0.6;
      p.hopT = 0;
      buffer = null;
      sfx('bad');
      shake.hit(0.3);
      puddles.push({ x: colX(p.col), y: rowY(p.row) });
      fl.add(rng.pick(SPILL), colX(p.col), rowY(p.row) - 18, C.bad);
    }

    function afterStun() {
      if (p.coffee <= 0.001) {
        p.row = KITCHEN;
        p.lastSafe = KITCHEN;
        p.coffee = 1;
        fl.add('Cup empty! Back to the kitchen.', W / 2, rowY(KITCHEN) - 20, C.warn);
      } else p.row = p.lastSafe;
      p.col = nearestFree(p.row, p.col);
      p.inv = 1.2;
    }

    function hitQQ() {
      p.freeze = 1.5;
      p.hopT = 0;
      buffer = null;
      bubble = { text: rng.pick(QQ_LINES), t: 1.5 };
      qq.x = colX(p.col) - FX + (qq.dir > 0 ? -11 : 11);
      sfx('blip');
    }

    function updateQQ(dt) {
      if (qq.gone > 0) {
        qq.gone -= dt;
        if (qq.gone <= 0) {
          qq.row = rng.pick(laneRows);
          qq.dir = rng.chance(0.5) ? 1 : -1;
          qq.x = qq.dir > 0 ? -12 : FW + 12;
          qq.leaving = false;
        }
        return;
      }
      if (p.freeze > 0 && bubble) return; // chatting
      const px = colX(p.col) - FX;
      if (!qq.leaving) {
        // Slight x-homing when sharing a lane.
        if (qq.row === p.row && Math.abs(px - qq.x) < 140) qq.dir = px > qq.x ? 1 : -1;
        // Lane hops toward the player (telegraphed).
        if (qq.tele > 0) {
          qq.tele -= dt;
          if (qq.tele <= 0 && lanes[qq.target]) qq.row = qq.target;
        } else {
          qq.shiftT -= dt;
          if (qq.shiftT <= 0) {
            qq.shiftT = byDiff(d, 3.5, 2) * rng.float(0.8, 1.2);
            const dr = Math.sign(p.row - qq.row);
            const tgt = qq.row + dr;
            if (dr && Math.abs(p.row - qq.row) <= 3 && lanes[tgt]) {
              qq.target = tgt;
              qq.tele = 0.55;
            }
          }
        }
      }
      qq.x += qq.dir * (qq.leaving ? 70 : qq.speed) * dt;
      if (qq.x < -24 || qq.x > FW + 24) {
        if (qq.leaving) qq.gone = byDiff(d, 3, 1.8);
        else qq.dir = -qq.dir;
      }
    }

    const inst = {
      done: false,
      score: 0,
      update(dt, input) {
        fl.update(dt);
        shake.update(dt);
        anim += dt;
        noteT = Math.max(0, noteT - dt);
        if (inst.done) return;
        if (total.update(dt)) return finish(inst, score());

        // Traffic.
        for (const r of laneRows) {
          const ln = lanes[r];
          for (const o of ln.obs) {
            let v = ln.speed;
            if (o.kind === 'dog') v *= 1 + 0.55 * Math.sin(anim * 3 + o.phase);
            if (o.kind === 'roomba') v *= Math.sin(anim * 1.3 + o.phase) > 0.85 ? 0.2 : 1;
            o.x += ln.dir * v * dt;
            if (o.x > FW + 24) o.x -= LOOP;
            if (o.x < -24) o.x += LOOP;
            if (o.kind === 'dog') {
              o.yap -= dt;
              if (o.yap <= 0) {
                o.yap = rng.float(1.2, 2.4);
                if (Math.abs(r - p.row) <= 2 && o.x > 0 && o.x < FW) fl.add(rng.pick(['Yap!', 'Woof!', 'Yip!']), FX + o.x, rowY(r) - 14, C.paper);
              }
            }
          }
        }
        updateQQ(dt);

        // Player timers.
        if (celebrate > 0) {
          celebrate -= dt;
          if (celebrate <= 0) nextRound();
          return;
        }
        p.inv = Math.max(0, p.inv - dt);
        if (p.hopT > 0) {
          p.hopT = Math.max(0, p.hopT - dt);
          if (p.hopT === 0 && buffer) {
            const b = buffer;
            buffer = null;
            hop(b[0], b[1]);
          }
        }
        if (p.stun > 0) {
          p.stun -= dt;
          if (p.stun <= 0) afterStun();
        }
        if (p.freeze > 0) {
          p.freeze -= dt;
          if (bubble) bubble.t -= dt;
          if (p.freeze <= 0) {
            fl.add(rng.pick(QQ_BYE), FX + qq.x, rowY(qq.row) - 20, C.dim);
            bubble = null;
            qq.leaving = true;
            qq.dir = qq.x < colX(p.col) - FX ? -1 : 1;
            p.inv = Math.max(p.inv, 0.5);
          }
        }

        // Keyboard: press = hop, hold = repeat.
        const KEYS = [['ArrowUp', 0, -1], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0]];
        let pressedNow = false;
        for (const [k, dx, dy] of KEYS) {
          if (input.pressed(k)) {
            hop(dx, dy);
            heldKey = [k, dx, dy];
            keyRep = 0.22;
            pressedNow = true;
            break;
          }
        }
        if (!pressedNow && heldKey) {
          if (!input.down(heldKey[0])) heldKey = null;
          else {
            keyRep -= dt;
            if (keyRep <= 0) {
              keyRep = 0.14;
              hop(heldKey[1], heldKey[2]);
            }
          }
        }
        // Mouse: click beside the player to hop toward it; hold to keep hopping.
        const ptr = input.pointer;
        const towardPointer = () => {
          const dx = (ptr.x - colX(p.col)) / TW;
          const dy = (ptr.y - (rowY(p.row) - 6)) / TH;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          if (Math.abs(dx) > Math.abs(dy)) hop(Math.sign(dx), 0);
          else hop(0, Math.sign(dy));
        };
        if (ptr.clicked) {
          towardPointer();
          mouseRep = 0.22;
        } else if (ptr.down) {
          mouseRep -= dt;
          if (mouseRep <= 0) {
            mouseRep = 0.14;
            towardPointer();
          }
        }

        // Collisions.
        if (p.stun <= 0 && p.inv <= 0 && celebrate <= 0 && !inst.done) {
          const px = colX(p.col) - FX;
          const ln = lanes[p.row];
          if (ln && ln.obs.some((o) => Math.abs(o.x - px) < o.w / 2 + 4)) spill();
          else if (p.freeze <= 0 && qq.gone <= 0 && !qq.leaving && qq.row === p.row && Math.abs(qq.x - px) < 8) hitQQ();
        }
      },
      render(g) {
        g.save();
        shake.apply(g);
        rect(g, 0, 0, W, 270, '#23263a');
        // Side walls.
        rect(g, 0, 18, FX - 2, 252, '#2f3348');
        rect(g, FX + FW + 2, 18, W - FX - FW - 2, 252, '#2f3348');
        rect(g, FX - 2, Y0 - 2, FW + 4, R * TH + 4, C.border);
        // Rows.
        for (let r = 0; r < R; r++) drawRowBg(g, r);
        for (const pu of puddles) {
          rect(g, pu.x - 6, pu.y - 2, 12, 3, '#6b4a2a');
          rect(g, pu.x - 4, pu.y - 3, 7, 1, '#8a6038');
        }
        // Actors, row by row (lower rows overlap upper ones).
        for (let r = 0; r < R; r++) {
          if (r === MEDIAN) drawDecor(g, r);
          if (r === 0) drawDesks(g);
          const ln = lanes[r];
          if (ln) {
            g.save();
            g.beginPath();
            g.rect(FX, Y0 - 12, FW, R * TH + 12);
            g.clip();
            for (const o of ln.obs) drawObstacle(g, o, FX + Math.round(o.x), rowY(r), ln.dir, anim);
            if (qq.gone <= 0 && qq.row === r) drawQQ(g);
            g.restore();
          } else if (qq.gone <= 0 && qq.row === r) drawQQ(g);
          if (p.row === r) drawPlayer(g);
        }
        // Speech bubble for the quick question.
        if (bubble) {
          const bx = clamp(colX(p.col), FX + 50, FX + FW - 50);
          const by = rowY(p.row) - 34;
          const w = Math.max(60, measureText(bubble.text) + 10);
          rect(g, bx - w / 2, by, w, 13, C.border);
          rect(g, bx - w / 2 + 1, by + 1, w - 2, 11, '#ffffff');
          rect(g, colX(p.col) - 1, by + 13, 3, 3, '#ffffff');
          drawText(g, bubble.text, bx, by + 3, { align: 'center', color: C.ink });
        }
        drawSidePanels(g);
        header(g, theme?.title || 'Coffee Crossing', `Cups ${delivered.length}/${required}`);
        timerBar(g, total.left, total.total);
        if (noteT > 0) drawText(g, note, FX + FW / 2, Y0 + R * TH - 12, { align: 'center', color: C.gold, shadow: C.border });
        drawText(g, 'Arrows hop (hold = keep going)  |  click or hold beside you', W / 2, 256, { align: 'center', color: C.dim });
        fl.render(g);
        g.restore();
      },
    };

    // --- Rendering helpers (closures over the layout) ---
    function drawRowBg(g, r) {
      const y = Y0 + r * TH;
      const k = rowKind(r);
      if (k === 'lane') {
        rect(g, FX, y, FW, TH, '#5f6475');
        for (let c = 0; c < COLS; c++) if ((c + r) % 2) rect(g, FX + c * TW, y, TW, TH, '#646a7c');
        for (let x = FX + ((r * 7) % 12); x < FX + FW; x += 12) rect(g, x, y + 4 + ((x >> 2) % 3) * 5, 1, 1, '#6f7588');
        if (rowKind(r + 1) === 'lane') for (let x = FX + 4; x < FX + FW; x += 16) rect(g, x, y + TH - 1, 8, 1, '#7a8094');
        // Direction chevrons at the edges.
        const dr = lanes[r].dir;
        const ex = dr > 0 ? FX + FW - 8 : FX + 4;
        rect(g, ex + (dr > 0 ? 0 : 2), y + 8, 2, 1, '#7a8094');
        rect(g, ex + 1, y + 9, 2, 1, '#7a8094');
        rect(g, ex + (dr > 0 ? 0 : 2), y + 10, 2, 1, '#7a8094');
      } else if (k === 'median') {
        rect(g, FX, y, FW, TH, '#8a7458');
        for (let x = FX; x < FX + FW; x += 32) rect(g, x, y, 1, TH, '#7a6448');
        rect(g, FX, y + 6, FW, 1, '#7a6448');
        rect(g, FX, y + 13, FW, 1, '#7a6448');
        rect(g, FX, y, FW, 1, '#a8916f');
      } else if (k === 'kitchen') {
        for (let c = 0; c < COLS; c++)
          for (let h = 0; h < 2; h++) rect(g, FX + c * TW + h * 8, y, 8, 10, (c + h) % 2 ? '#d8d8d0' : '#a8aab0'), rect(g, FX + c * TW + h * 8, y + 10, 8, 10, (c + h) % 2 ? '#a8aab0' : '#d8d8d0');
        drawText(g, 'KITCHEN', FX + FW - 4, y + 6, { align: 'right', color: '#6a6c74' });
      } else {
        rect(g, FX, y, FW, TH, '#4a5068');
        rect(g, FX + slot * TW, y, slotW * TW, TH, '#3a6a9a');
      }
    }

    function drawDesks(g) {
      const y = Y0;
      for (let c = 0; c < COLS; c++) {
        const x = FX + c * TW;
        if (c >= slot && c < slot + slotW) continue;
        rect(g, x, y + 2, TW, 12, '#7a5236');
        rect(g, x, y + 2, TW, 1, '#9a6a46');
        rect(g, x, y + 14, TW, 4, '#5a3a26');
        if (c % 2 === 0) {
          rect(g, x + 4, y - 4, 9, 7, '#2b2e38');
          rect(g, x + 5, y - 3, 7, 5, (c * 13) % 3 ? '#7fb4ea' : '#9adf9a');
        } else {
          rect(g, x + 5, y + 4, 6, 4, '#efe9d9');
          if (c % 4 === 1) rect(g, x + 2, y + 2, 3, 4, '#3bb66a');
        }
      }
      // Your desk.
      const sx = FX + slot * TW;
      const sw = slotW * TW;
      rect(g, sx, y, sw, 1, C.gold);
      const blink = Math.floor(anim * 3) % 2;
      for (let x = sx + 2; x < sx + sw - 2; x += 6) rect(g, x, y + TH - 2, 3, 1, blink ? C.gold : '#c89a2e');
      drawText(g, slotW >= 4 ? 'MY DESK' : 'ME', sx + sw / 2, y + 2, { align: 'center', color: C.gold, shadow: C.border });
      // Coaster waiting for the cup.
      rect(g, sx + sw / 2 - 4, y + 12, 8, 3, '#c8a070');
    }

    function drawDecor(g, r) {
      const fy = rowY(r);
      for (const [c, kind] of decor) {
        const x = FX + c * TW;
        if (kind === 'plant') {
          rect(g, x + 4, fy - 6, 8, 6, '#b0603a');
          rect(g, x + 4, fy - 6, 8, 1, '#d07a4a');
          rect(g, x + 2, fy - 14, 12, 8, '#2f8a3a');
          rect(g, x + 5, fy - 18, 6, 5, '#3fae4f');
          rect(g, x + 3, fy - 12, 2, 2, '#5fd068');
        } else if (kind === 'cabinet') {
          rect(g, x + 2, fy - 16, 12, 16, '#8a8f9e');
          rect(g, x + 2, fy - 16, 12, 1, '#b0b5c4');
          rect(g, x + 2, fy - 8, 12, 1, '#6a6f7e');
          rect(g, x + 7, fy - 13, 3, 1, '#2b2e38');
          rect(g, x + 7, fy - 5, 3, 1, '#2b2e38');
        } else if (kind === 'cooler') {
          rect(g, x + 4, fy - 9, 8, 9, '#d8d8e0');
          rect(g, x + 5, fy - 17, 6, 8, '#7fc4ff');
          rect(g, x + 6, fy - 16, 1, 5, '#c8e8ff');
          rect(g, x + 6, fy - 6, 2, 1, C.bad);
        } else {
          rect(g, x + 1, fy - 10, 14, 10, '#c8c8d0');
          rect(g, x + 1, fy - 10, 14, 2, '#e8e8f0');
          rect(g, x + 3, fy - 13, 10, 3, '#efe9d9');
          rect(g, x + 11, fy - 7, 2, 1, C.good);
        }
      }
    }

    function drawPlayer(g) {
      let x = colX(p.col);
      let y = rowY(p.row);
      if (p.hopT > 0) {
        const t = 1 - p.hopT / HOP;
        x = lerp(p.fx, x, t);
        y = lerp(p.fy, y, t) - Math.round(Math.sin(t * Math.PI) * 3);
      }
      x = Math.round(x);
      y = Math.round(y);
      if (p.inv > 0 && Math.floor(anim * 12) % 2) return;
      rect(g, x - 5, y - 1, 10, 2, 'rgba(0,0,0,0.3)');
      if (p.stun > 0) {
        // Splat: lying down, cup tipped over.
        rect(g, x - 7, y - 4, 12, 4, C.accent);
        rect(g, x + 4, y - 5, 5, 5, '#f2c9a0');
        rect(g, x + 4, y - 5, 5, 2, '#2b1d14');
        rect(g, x - 10, y - 3, 3, 3, '#ffffff');
        drawText(g, '*', x + 4, y - 14, { color: C.gold });
        return;
      }
      const step = p.hopT > 0 ? 1 : 0;
      const pal = { shirt: C.accent, hair: '#2b1d14', skin: '#f2c9a0', pants: '#2b2e38' };
      if (p.face === 0 || p.face === 2) {
        // Front/back view.
        rect(g, x - 3, y - 3, 2, 3 - step, pal.pants);
        rect(g, x + 1, y - 3, 2, 3, pal.pants);
        rect(g, x - 4, y - 8, 8, 5, pal.shirt);
        rect(g, x - 3, y - 12, 6, 4, pal.skin);
        rect(g, x - 3, y - 13, 6, p.face === 0 ? 4 : 2, pal.hair);
        if (p.face === 2) rect(g, x - 2, y - 10, 1, 1, '#111'), rect(g, x + 1, y - 10, 1, 1, '#111');
        drawCup(g, x + 4, y - 9);
      } else {
        drawPerson(g, x, y, p.face, { ...pal }, step ? 1 : 0);
        drawCup(g, x + p.face * 5 - 1, y - 9);
      }
      if (p.freeze > 0) {
        rect(g, x - 1, y - 20, 2, 4, C.gold);
        rect(g, x - 1, y - 15, 2, 1, C.gold);
      }
    }

    function drawCup(g, x, y) {
      rect(g, x - 1, y, 4, 4, '#ffffff');
      rect(g, x - 1, y, 4, 1, p.coffee > 0.05 ? '#6b4428' : '#cccccc');
      rect(g, x + 3, y + 1, 1, 2, '#dddddd');
      if (p.coffee > 0.5 && Math.floor(anim * 4) % 2) rect(g, x, y - 2, 1, 1, '#c8c8d0');
    }

    function drawQQ(g) {
      const x = FX + Math.round(qq.x);
      const y = rowY(qq.row);
      const talking = p.freeze > 0 && bubble;
      drawPerson(g, x, y, talking ? (qq.x < colX(p.col) - FX ? 1 : -1) : qq.dir, qq, talking ? 0 : Math.floor(anim * 6) % 2);
      // Laptop held open.
      rect(g, x + qq.dir * 3 - 2, y - 7, 5, 3, '#c8c8d0');
      if (!qq.leaving) {
        const bob = Math.floor(anim * 3) % 2;
        drawText(g, qq.tele > 0 ? '!' : '?', x, y - 22 - bob, { align: 'center', color: qq.tele > 0 ? C.bad : C.gold, shadow: C.border });
      }
    }

    function drawSidePanels(g) {
      // Coffee meter (left).
      drawText(g, 'COFFEE', FX / 2 - 1, 30, { align: 'center', color: C.coffee });
      const cx = 9;
      const cy = 44;
      const ch = 44;
      rect(g, cx, cy, 28, ch, C.border);
      rect(g, cx + 1, cy + 1, 26, ch - 2, '#f4f1e8');
      rect(g, cx + 3, cy + 3, 22, ch - 6, '#3a3030');
      const lvl = Math.round((ch - 6) * p.coffee);
      if (lvl > 0) {
        rect(g, cx + 3, cy + ch - 3 - lvl, 22, lvl, '#6b4428');
        rect(g, cx + 3, cy + ch - 3 - lvl, 22, 1, '#c08552');
      }
      rect(g, cx + 28, cy + 10, 5, 3, C.border);
      rect(g, cx + 31, cy + 12, 2, 16, C.border);
      rect(g, cx + 28, cy + 26, 5, 3, C.border);
      if (p.coffee > 0.3) for (let i = 0; i < 3; i++) rect(g, cx + 6 + i * 7, cy - 4 - ((Math.floor(anim * 4) + i) % 3), 1, 2, '#c8c8d0');
      drawText(g, `${Math.round(p.coffee * 100)}%`, FX / 2 - 1, cy + ch + 4, { align: 'center', color: p.coffee > 0.6 ? C.text : p.coffee > 0.3 ? C.warn : C.bad });
      // Coffee machine next to the kitchen row.
      const my = rowY(KITCHEN);
      rect(g, 10, my - 26, 26, 26, '#4a4d5a');
      rect(g, 10, my - 26, 26, 3, '#6a6d7a');
      rect(g, 14, my - 20, 18, 6, '#22252e');
      rect(g, 16, my - 18, 3, 2, C.good);
      rect(g, 20, my - 12, 6, 2, '#2b2e38');
      rect(g, 20, my - 7, 6, 6, '#ffffff');
      drawText(g, 'BREW', 23, my - 36, { align: 'center', color: C.dim });
      // Deliveries (right).
      const rx = FX + FW + 2 + (W - FX - FW - 2) / 2;
      drawText(g, 'CUPS', rx, 30, { align: 'center', color: C.gold });
      for (let i = 0; i < required; i++) {
        const y = 44 + i * 34;
        const v = delivered[i];
        rect(g, rx - 7, y, 14, 16, C.border);
        rect(g, rx - 6, y + 1, 12, 14, v !== undefined ? '#f4f1e8' : '#4a4d5a');
        if (v !== undefined) {
          const h = Math.round(12 * v);
          if (h > 0) rect(g, rx - 5, y + 14 - h, 10, h, '#6b4428');
          drawText(g, `${Math.round(v * 100)}%`, rx, y + 19, { align: 'center', color: C.text });
        } else drawText(g, i === delivered.length ? 'now' : '...', rx, y + 19, { align: 'center', color: C.dim });
      }
    }

    return inst;
  },
};

// Side-view pixel person (~8x13), facing `dir` (1 right, -1 left), feet at y.
function drawPerson(g, x, y, dir, o, step) {
  rect(g, x - 4, y - 1, 9, 2, 'rgba(0,0,0,0.3)');
  rect(g, x - 3, y - 4, 2, 4 - step, o.pants);
  rect(g, x + 1, y - 4, 2, 3 + step, o.pants);
  rect(g, x - 3, y - 9, 7, 5, o.suit ? '#22252e' : o.shirt);
  if (o.suit) rect(g, x + dir * 2, y - 9, 1, 4, o.tie || '#e2304a');
  rect(g, x + (dir > 0 ? 1 : -1), y - 8, 2, 3, 'rgba(0,0,0,0.2)');
  rect(g, x - 2, y - 13, 6, 4, o.skin);
  rect(g, x - 2, y - 14, 6, 2, o.hair);
  rect(g, x + (dir > 0 ? -2 : 3), y - 13, 1, 2, o.hair);
  rect(g, x + (dir > 0 ? 2 : -1), y - 12, 1, 1, '#111');
}

function drawObstacle(g, o, x, y, dir, t) {
  const step = Math.floor(t * (o.kind === 'manager' ? 10 : 6) + o.phase) % 2;
  switch (o.kind) {
    case 'manager':
      drawPerson(g, x, y, dir, { ...o, suit: true, tie: '#e2304a' }, step);
      rect(g, x + dir * 3, y - 13, 1, 3, '#111'); // phone at ear
      if (step) rect(g, x - dir * 7, y - 6, 2, 1, '#c8c8d0'); // speed lines
      break;
    case 'boxes':
      drawPerson(g, x, y, dir, o, step);
      rect(g, x + dir * 3 - 4, y - 16, 8, 9, '#b08850');
      rect(g, x + dir * 3 - 4, y - 16, 8, 1, '#d0a870');
      rect(g, x + dir * 3 - 1, y - 16, 2, 9, '#c8a060');
      break;
    case 'chair': {
      const spin = Math.floor(t * 8 + o.phase) % 2;
      rect(g, x - 5, y - 1, 11, 2, 'rgba(0,0,0,0.3)');
      for (let i = -4; i <= 4; i += 4) rect(g, x + i + spin, y - 2, 2, 2, '#111');
      rect(g, x, y - 5, 1, 3, '#555a66');
      rect(g, x - 5, y - 7, 11, 3, '#2b2e38');
      rect(g, x - 5, y - 7, 11, 1, '#4a4d5a');
      rect(g, x - dir * 5, y - 14, 2, 8, '#2b2e38');
      break;
    }
    case 'cart': {
      // Cart in front, pusher behind.
      const cx = x + dir * 5;
      rect(g, cx - 11, y - 1, 22, 2, 'rgba(0,0,0,0.3)');
      rect(g, cx - 10, y - 3, 3, 3, '#111');
      rect(g, cx + 7, y - 3, 3, 3, '#111');
      rect(g, cx - 10, y - 10, 20, 7, '#8a8f9e');
      rect(g, cx - 10, y - 10, 20, 1, '#b0b5c4');
      rect(g, cx - 8, y - 14, 6, 4, '#efe9d9');
      rect(g, cx - 1, y - 15, 5, 5, '#b08850');
      rect(g, cx + 5, y - 13, 4, 3, '#efe9d9');
      drawPerson(g, x - dir * 10, y, dir, o, step);
      break;
    }
    case 'roomba': {
      rect(g, x - 5, y - 4, 11, 4, '#2b2e38');
      rect(g, x - 4, y - 5, 9, 1, '#4a4d5a');
      rect(g, x + dir * 3, y - 4, 1, 1, Math.floor(t * 3) % 2 ? C.good : '#1a4a1a');
      if (o.cat) {
        rect(g, x - 3, y - 9, 6, 4, '#e09040');
        rect(g, x + dir * 2 - 1, y - 11, 3, 3, '#e09040');
        rect(g, x + dir * 2 - 1, y - 12, 1, 1, '#e09040');
        rect(g, x - dir * 4, y - 10 + step, 1, 3, '#e09040');
      }
      break;
    }
    case 'dog': {
      rect(g, x - 5, y - 1, 11, 2, 'rgba(0,0,0,0.3)');
      rect(g, x - 4, y - 3, 1, 2 + step, '#5a3a20');
      rect(g, x + 3, y - 3, 1, 3 - step, '#5a3a20');
      rect(g, x - 4, y - 7, 8, 4, '#a8703a');
      rect(g, x + dir * 4 - 1, y - 9, 4, 4, '#a8703a');
      rect(g, x + dir * 5, y - 8, 1, 1, '#111');
      rect(g, x + dir * 4 - 1, y - 10, 2, 2, '#5a3a20');
      rect(g, x - dir * 5, y - 9 + step, 1, 3, '#a8703a');
      break;
    }
  }
}
