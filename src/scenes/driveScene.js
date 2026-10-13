// The business-trip drive (spec 2026-10-12-business-trip): a Lotus III-style pseudo-3D road. The simulation is
// core/drive.js; this scene projects the road segment by segment (scanline rows, so the pixels stay crisp), draws the
// roadside, traffic and the player's car, runs the brief → start lights → drive → result flow and hands over to the
// client's office (arrived) or back to the home floor (crashed, late or turned back).
import { W, H } from '../engine/screen.js';
import { C, rect, panel, dim, ButtonSet } from '../engine/ui.js';
import { drawText, wrapText } from '../engine/font.js';
import { track } from '../engine/analytics.js';
import { buildTrack, createDrive, SEG, MAX_SPEED, KMH, STAGES, SPRITES, CHECKPOINT_TIME, WRECK_AT } from '../core/drive.js';
import * as T from '../core/trip.js';
import { CLIENTS, DRIVE_HELP, CRASH_LINES, DENT_LINES, LAST_DENT, LATE_LINES, ARRIVE_LINES, ROAD_SIGNS } from '../data/trip.js';
import { STAGE_LOOK, RAIL, playerCar, trafficCar, roadside, bannerText, backdrop } from './driveArt.js';

const ROAD_W = 2000; // world units from the centre line to the road edge (core x = 1)
const PLAYER_Z = 6 * SEG; // the camera sits this far behind the car
const CAM_H = 1940;
const K = 84; // projection scale: the road is ~280 px wide under the car
const HZ = 116; // horizon row on a flat road
const DRAW = 240; // segments drawn ahead
// The motorway crash barrier, in world units: across from the centre line (road half-widths), beam height, post width.
const RAIL_X = 1.2;
const RAIL_LO = 170;
const RAIL_HI = 290;
const RAIL_POST_W = 60;
const BILLBOARDS = ['SYNERGY', 'KPI COLA', 'LEVERAGE', 'BUY BONDS', 'PIVOT NOW'];

export class DriveScene {
  capturesKeys = true; // no global hotkeys (M) while driving

  /** floor: the trip floor (10 or 30); the client and the track come from it. */
  constructor(game, floor) {
    this.game = game;
    this.floor = floor;
    this.client = CLIENTS[floor];
    this.hard = floor >= 30 ? 1 : 0;
    this.track = buildTrack(floor, this.hard);
    this.drive = createDrive(this.track);
    this.phase = 'brief';
    this.t = 0;
    this.time = 0;
    this.buttons = new ButtonSet();
    this.message = null; // { text, sub, t }
    this.shake = 0;
    this.dentAt = -9; // this.time of the last crash the car survived
    this.bgX = 0;
    this.particles = [];
    this.result = null; // 'crashed' | 'late' | 'quit' | 'arrived'
    this.line = '';
    this.buildBrief();
  }

  enter() {
    this.game.audio.play('drive');
  }

  // ------------------------------------------------------------------ flow
  buildBrief() {
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 70, y: H / 2 + 34, w: 140, h: 20, label: 'Start the engine', color: C.goodBtn, onClick: () => this.startLights() });
  }
  startLights() {
    this.buttons.clear();
    this.phase = 'lights';
    this.t = 0;
    this.lit = 0;
  }
  pause() {
    this.phase = 'paused';
    this.buttons.clear();
    this.buttons.add({ x: W / 2 - 95, y: H / 2 + 14, w: 90, h: 18, label: 'Keep driving', onClick: () => this.resumeDrive() });
    this.buttons.add({ x: W / 2 + 5, y: H / 2 + 14, w: 90, h: 18, label: 'Turn back', color: C.bad, onClick: () => this.end('quit') });
  }
  resumeDrive() {
    this.buttons.clear();
    this.phase = 'drive';
  }

  /** The drive is over: crashed / late / quit (the trip is missed) or arrived (the visit starts now). */
  end(result) {
    const game = this.game;
    this.result = result;
    this.phase = result === 'quit' ? 'result' : 'outro';
    this.t = 0;
    track('trip', { floor: this.floor, result, time: Math.round(this.drive.elapsed), stage: this.drive.stage + 1, crashes: this.drive.crashes });
    if (result === 'arrived') {
      T.arriveTrip(game.state, this.floor, game.now());
      game.markDirty();
      game.saveNow();
      this.line = pick(ARRIVE_LINES);
      game.sfx('levelup');
      game.audio.play('fanfare', 'drive');
    } else {
      this.line = pick(result === 'crashed' ? CRASH_LINES : result === 'late' ? LATE_LINES : ['You turn the car around. The client will not be told why.']);
      game.sfx(result === 'crashed' ? 'crash' : 'fail');
      if (result === 'crashed') this.shake = 0.6;
    }
    if (this.phase === 'result') this.buildResult();
  }

  buildResult() {
    this.buttons.clear();
    const ok = this.result === 'arrived';
    this.buttons.add({
      x: W / 2 - 70,
      y: H / 2 + 12,
      w: 140,
      h: 20,
      label: ok ? 'Go inside' : 'Back to the office',
      color: ok ? C.goodBtn : C.panelLight,
      onClick: () => (ok ? this.goInside() : this.goHome()),
    });
  }

  async goInside() {
    if (this.leaving) return;
    this.leaving = true;
    const { ClientOfficeScene } = await import('./clientOffice.js');
    this.game.set(new ClientOfficeScene(this.game, this.floor));
  }

  async goHome() {
    if (this.leaving) return;
    this.leaving = true;
    const { FloorScene } = await import('./floorScene.js');
    this.game.set(new FloorScene(this.game, this.floor, { arrival: 'elevator' }));
    this.game.toast('Back at the office. The business trip is off.', C.dim);
  }

  // ------------------------------------------------------------------ loop
  controls() {
    const input = this.game.input;
    const p = input.pointer;
    let steer = (input.down('ArrowRight') ? 1 : 0) - (input.down('ArrowLeft') ? 1 : 0);
    let accel = input.down('ArrowUp') || input.down('Space');
    const brake = input.down('ArrowDown');
    // Mouse / touch: hold to drive, the car steers towards the pointer.
    if (p.down && p.y > 24) {
      accel = true;
      steer = Math.max(-1, Math.min(1, (p.x - W / 2) / 70));
    }
    return { accel, brake, steer };
  }

  update(dt) {
    const input = this.game.input;
    const d = this.drive;
    this.t += dt;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.message) {
      this.message.t -= dt;
      if (this.message.t <= 0) this.message = null;
    }
    this.updateParticles(dt);

    if (this.phase === 'brief' || this.phase === 'result') {
      this.buttons.update(input, (n) => this.game.sfx(n));
      if (this.phase === 'brief' && input.back()) this.goHome();
      return;
    }
    if (this.phase === 'paused') {
      if (input.back()) return this.resumeDrive();
      this.buttons.update(input, (n) => this.game.sfx(n));
      return;
    }
    if (this.phase === 'lights') {
      const lit = Math.min(4, Math.floor(this.t / 0.8) + 1);
      if (lit !== this.lit) {
        this.lit = lit;
        this.game.sfx(lit === 4 ? 'start' : 'blip');
      }
      if (this.t >= 2.4) {
        this.phase = 'drive';
        this.say('GO!', '', 1);
      }
      return;
    }
    if (this.phase === 'drive') {
      if (input.back()) return this.pause();
      d.update(dt, this.controls());
      for (const e of d.events) this.onEvent(e);
    } else if (this.phase === 'outro') {
      d.update(dt, {});
      if (this.t > (this.result === 'arrived' ? 2.4 : 1.8)) {
        this.phase = 'result';
        this.buildResult();
      }
    }
    // Backdrop scrolls against the curve; dust off the road.
    const seg = d.segAt(d.d);
    this.bgX += seg.curve * (d.speed / MAX_SPEED) * dt * 18;
    if ((d.offroad && d.speed > 600) || (this.phase === 'outro' && this.result === 'crashed' && this.t < 1.2)) this.dust(this.result === 'crashed' ? '#8a8a90' : '#a08a5a');
    // A dented car smokes: now and then at 2 crashes, steadily at the last one it can take.
    if (this.phase === 'drive' && d.crashes >= 2 && Math.random() < (d.crashes - 1) * dt * 4) this.smoke();
  }

  onEvent(e) {
    const g = this.game;
    if (e === 'bump') {
      g.sfx('bad');
      this.shake = 0.25;
    } else if (e === 'scrape') {
      if (this.time - (this.scrapeAt || 0) > 0.25) g.sfx('skid');
      this.scrapeAt = this.time;
      this.spark();
    } else if (e === 'checkpoint') {
      g.sfx('levelup');
      this.say('CHECKPOINT', `EXTENDED TIME +${CHECKPOINT_TIME[this.hard]} · ${STAGES[this.drive.stage].name.toUpperCase()}`, 2.2);
    } else if (e === 'crash') {
      const d = this.drive;
      g.sfx('crash');
      this.shake = 0.5;
      this.dentAt = this.time;
      for (let k = 0; k < 6; k++) this.dust('#8a8a90');
      const left = WRECK_AT - d.crashes;
      this.say('CRASH!', left === 1 ? LAST_DENT : `${pick(DENT_LINES)} · DAMAGE ${Math.round(d.damage * 100)}%`, 1.8);
    } else if (e === 'wreck') this.end('crashed');
    else if (e === 'late') this.end('late');
    else if (e === 'arrived') this.end('arrived');
  }

  say(text, sub = '', t = 1.6) {
    this.message = { text, sub, t };
  }

  dust(color) {
    if (this.particles.length > 40) return;
    this.particles.push({ x: W / 2 + (Math.random() - 0.5) * 50, y: H - 20, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, t: 0.6, color });
  }
  smoke() {
    if (this.particles.length > 40) return;
    const dark = this.drive.crashes >= WRECK_AT - 1;
    this.particles.push({ x: W / 2 - 4 + Math.random() * 8, y: H - 30, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 14, t: 0.9, color: dark ? '#4a4d57' : '#9a9ca6' });
  }
  spark() {
    const side = Math.sign(this.drive.x) || 1;
    for (let k = 0; k < 3; k++) this.particles.push({ x: W / 2 + side * 30, y: H - 30, vx: -side * (20 + Math.random() * 60), vy: -30 - Math.random() * 40, t: 0.3, color: k ? '#f2c14e' : '#fff6c8' });
  }
  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.t -= dt;
    }
    this.particles = this.particles.filter((p) => p.t > 0);
  }

  // ------------------------------------------------------------------ render
  render(g) {
    const d = this.drive;
    const stage = STAGES[Math.min(d.stage, STAGES.length - 1)];
    const look = STAGE_LOOK[stage.id];
    g.save();
    if (this.shake > 0) g.translate(Math.round((Math.random() - 0.5) * 8 * this.shake), Math.round((Math.random() - 0.5) * 4 * this.shake));
    this.drawBackground(g, stage.id, look);
    const segs = this.drawRoad(g, look);
    this.drawObjects(g, segs);
    this.drawPlayer(g);
    for (const p of this.particles) rect(g, p.x, p.y, 3, 3, p.color);
    g.restore();
    this.drawHud(g, stage);
    if (this.phase === 'lights') this.drawLights(g);
    if (this.message) this.drawMessage(g);
    if (this.phase === 'brief') this.drawBrief(g);
    else if (this.phase === 'paused') {
      dim(g, 0.55);
      panel(g, W / 2 - 110, H / 2 - 30, 220, 70, { title: 'Paused' });
      drawText(g, 'Turning back means no client visit.', W / 2, H / 2 - 8, { align: 'center' });
      this.buttons.render(g);
    } else if (this.phase === 'result') this.drawResult(g);
  }

  drawBackground(g, stageId, look) {
    const bands = look.sky;
    const bh = Math.ceil(HZ / bands.length);
    bands.forEach((c, i) => rect(g, 0, i * bh, W, bh + 1, c));
    if (look.sun) {
      rect(g, 360, 50, 18, 14, look.sun);
      rect(g, 357, 53, 24, 8, look.sun);
    }
    const { far, near } = backdrop(stageId);
    const fx = -(((this.bgX * 0.4) % 960) + 960) % 960;
    const nx = -(((this.bgX * 0.8) % 960) + 960) % 960;
    g.drawImage(far, fx, HZ - 58);
    g.drawImage(far, fx + 960, HZ - 58);
    g.drawImage(near, nx, HZ - 34);
    g.drawImage(near, nx + 960, HZ - 34);
    rect(g, 0, HZ + 4, W, H - HZ, look.verge[0]);
  }

  /** Projects and fills the road row by row, nearest first. Returns the projected segments for the objects pass. */
  drawRoad(g, look) {
    const d = this.drive;
    const segs = this.track.segments;
    const camZ = d.d - PLAYER_Z;
    const camX = d.x * ROAD_W;
    const pseg = d.segAt(d.d);
    const pp = (d.d % SEG) / SEG;
    const camY = pseg.y0 + (pseg.y1 - pseg.y0) * pp + CAM_H;
    const base = Math.max(0, Math.floor(camZ / SEG));
    const bp = (camZ - base * SEG) / SEG;
    let x = 0;
    let dx = -(segs[base].curve * bp);
    let maxY = H;
    const out = [];
    for (let n = 0; n < DRAW && base + n < segs.length; n++) {
      const seg = segs[base + n];
      const z1 = Math.max(40, seg.i * SEG - camZ);
      const z2 = Math.max(41, (seg.i + 1) * SEG - camZ);
      const p1 = { x: W / 2 + ((x - camX) * K) / z1, y: HZ + ((camY - seg.y0) * K) / z1, w: (ROAD_W * K) / z1, s: K / z1 };
      const p2 = { x: W / 2 + ((x + dx - camX) * K) / z2, y: HZ + ((camY - seg.y1) * K) / z2, w: (ROAD_W * K) / z2, s: K / z2 };
      x += dx;
      dx += seg.curve;
      out.push({ seg, p1, p2, clip: maxY });
      if (p2.y >= maxY || p2.y >= p1.y) continue;
      const top = Math.max(0, Math.ceil(p2.y));
      const bot = Math.min(maxY, Math.ceil(p1.y));
      const light = Math.floor(seg.i / 3) % 2 === 0;
      const verge = look.verge[light ? 0 : 1];
      const rumble = look.rumble[light ? 0 : 1];
      for (let y = top; y < bot; y++) {
        const t = (p1.y - y) / (p1.y - p2.y);
        const cx = p1.x + (p2.x - p1.x) * t;
        const w = p1.w + (p2.w - p1.w) * t;
        rect(g, 0, y, W, 1, verge);
        rect(g, cx - w * 1.12, y, w * 2.24, 1, rumble);
        rect(g, cx - w, y, w * 2, 1, seg.finish || seg.checkpoint ? (light ? '#e8e8e8' : '#2a2a30') : look.road);
        if (light) {
          const lw = Math.max(1, w * 0.025);
          rect(g, cx - w / 3 - lw / 2, y, lw, 1, look.lane);
          rect(g, cx + w / 3 - lw / 2, y, lw, 1, look.lane);
        }
      }
      maxY = top;
    }
    return out;
  }

  /** Roadside sprites, gantries and traffic, farthest first, clipped behind hill crests. */
  drawObjects(g, segs) {
    const d = this.drive;
    const byI = new Map(segs.map((s) => [s.seg.i, s]));
    const carsBy = new Map();
    for (const car of d.cars) {
      const i = Math.floor(car.d / SEG);
      if (!byI.has(i)) continue;
      if (!carsBy.has(i)) carsBy.set(i, []);
      carsBy.get(i).push(car);
    }
    for (let k = segs.length - 1; k >= 0; k--) {
      const { seg, p1, p2, clip } = segs[k];
      if (seg.i * SEG - (d.d - PLAYER_Z) < 100) continue; // at or behind the camera
      if (seg.checkpoint || seg.finish || seg.i === 4) this.drawGantry(g, seg, p1, clip);
      if (seg.barrier) this.drawBarrier(g, seg, p1, p2, clip);
      for (const sp of seg.sprites) {
        const opts = sp.kind === 'billboard' ? { text: BILLBOARDS[seg.i % BILLBOARDS.length] } : sp.kind === 'sign' ? { text: ROAD_SIGNS[Math.floor(seg.i / 240) % ROAD_SIGNS.length] } : sp.kind === 'client' ? { text: this.client.short } : {};
        const art = roadside(sp.kind, opts);
        if (!art) continue;
        const w = art.worldW * p1.s;
        const h = (w * art.canvas.height) / art.canvas.width;
        const sx = p1.x + sp.x * p1.w;
        // Objects stand beside the road: their inner edge at sp.x.
        const left = sp.kind === 'client' || SPRITES[sp.kind]?.solid === false ? sx - w / 2 : sp.x < 0 ? sx - w : sx;
        blit(g, art.canvas, left, p1.y - h, w, h, clip);
      }
      for (const car of carsBy.get(seg.i) || []) {
        const f = (car.d % SEG) / SEG;
        const cx = p1.x + (p2.x - p1.x) * f;
        const cy = p1.y + (p2.y - p1.y) * f;
        const cw = p1.w + (p2.w - p1.w) * f;
        const art = trafficCar(car.color);
        const w = cw * 0.44;
        const h = (w * art.height) / art.width;
        blit(g, art, cx + car.x * cw - w / 2, cy - h, w, h, clip);
      }
    }
  }

  /**
   * The motorway crash barrier along this segment, both sides: a steel beam from this segment's near edge to its far
   * edge, so neighbouring segments join up into one rail, and a post every other segment.
   */
  drawBarrier(g, seg, p1, p2, clip) {
    for (const side of [-1, 1]) {
      const a = p1.x + side * RAIL_X * p1.w;
      const b = p2.x + side * RAIL_X * p2.w;
      const band = (lo, hi, color) =>
        fillQuad(g, [{ x: a, y: p1.y - hi * p1.s }, { x: b, y: p2.y - hi * p2.s }, { x: b, y: p2.y - lo * p2.s }, { x: a, y: p1.y - lo * p1.s }], color, clip);
      if (seg.i % 2 === 0) {
        const pw = Math.max(1, RAIL_POST_W * p1.s);
        const top = p1.y - RAIL_LO * p1.s;
        if (top < clip) rect(g, a - pw / 2, top, pw, Math.min(clip, p1.y) - top, RAIL.post);
      }
      band(RAIL_LO, RAIL_HI, RAIL.beam);
      band(RAIL_LO, RAIL_LO + (RAIL_HI - RAIL_LO) * 0.3, RAIL.edge);
    }
  }

  /** Two posts and a banner across the road: the start line, the checkpoints and the client's gate. */
  drawGantry(g, seg, p, clip) {
    const h = 3400 * p.s;
    const w = p.w * 1.3;
    const post = Math.max(1, p.w * 0.04);
    const color = seg.finish ? '#2e8540' : seg.checkpoint ? '#1f5fa8' : '#7a2b2b';
    const text = seg.finish ? this.client.short.toUpperCase() : seg.checkpoint ? 'CHECKPOINT' : 'START';
    const y0 = p.y - h;
    if (y0 >= clip) return;
    for (const sx of [p.x - w, p.x + w - post]) rect(g, sx, y0, post, Math.min(h, clip - y0), '#4a4f5a');
    const banner = bannerText(text, color);
    const bh = Math.max(2, h * 0.16);
    if (y0 + bh <= clip) g.drawImage(banner, Math.round(p.x - w), Math.round(y0), Math.round(w * 2), Math.round(bh));
    if (seg.i === 4 && this.phase === 'lights') this.startLamps = { x: p.x, y: y0 + bh, s: bh };
  }

  drawPlayer(g) {
    const d = this.drive;
    const spinning = d.spin > 0 && d.status === 'drive';
    const crashed = (this.result === 'crashed' && this.phase !== 'brief') || spinning;
    // Shaken up after a crash (no new damage yet): the car blinks.
    if (!spinning && d.grace > 0 && d.status === 'drive' && Math.floor(this.time * 10) % 2) return;
    const t = spinning ? this.time - this.dentAt : this.t;
    let steer = Math.round(d.steer);
    let flip = false;
    if (crashed) {
      const f = Math.floor(t / 0.09) % 4;
      steer = [-1, 0, 1, 0][f];
      flip = f === 3;
    }
    const art = playerCar(steer, d.braking || (this.phase !== 'drive' && d.speed > 0 && this.phase !== 'lights'));
    const bounce = d.offroad && d.speed > 0 ? Math.round(Math.random() * 2) : Math.round(Math.sin(this.time * 30) * (d.speed / MAX_SPEED) * 0.6);
    const x = Math.round(W / 2 - 32 + (crashed ? Math.sin(t * 9) * 12 : 0));
    const y = H - 34 - bounce;
    rect(g, x + 2, H - 7, 60, 4, 'rgba(0,0,0,0.35)');
    if (flip) {
      g.save();
      g.translate(x + 64, y);
      g.scale(-1, 1);
      g.drawImage(art, 0, 0);
      g.restore();
    } else g.drawImage(art, x, y);
  }

  drawLights(g) {
    const L = this.startLamps;
    const cx = L ? L.x : W / 2;
    const y = L ? Math.max(30, L.y + 2) : 60;
    panel(g, cx - 34, y, 68, 20, { fill: '#16181e' });
    for (let k = 0; k < 3; k++) {
      const on = this.lit > k;
      const green = this.lit >= 4;
      rect(g, cx - 26 + k * 20, y + 4, 12, 12, green ? '#3be05a' : on ? '#f03a30' : '#3a2020');
    }
  }

  drawHud(g, stage) {
    const d = this.drive;
    // Clock (Lotus-style, top centre).
    rect(g, W / 2 - 34, 2, 68, 28, 'rgba(13,15,24,0.88)');
    drawText(g, 'TIME', W / 2, 4, { align: 'center', color: C.dim });
    const secs = Math.ceil(d.time);
    const low = secs <= 10 && this.phase === 'drive';
    if (!low || Math.floor(this.time * 4) % 2) drawText(g, String(secs), W / 2, 13, { align: 'center', scale: 2, color: low ? C.bad : C.gold, shadow: C.border });
    // Stage and the car's damage (left): one notch per crash, the last one wrecks it.
    rect(g, 2, 2, 120, 28, 'rgba(13,15,24,0.88)');
    drawText(g, `STAGE ${Math.min(d.stage + 1, 4)}/4`, 6, 4, { color: C.text });
    drawText(g, stage.name.toUpperCase(), 6, 12, { color: C.gold });
    const hit = this.time - this.dentAt < 1.2 && Math.floor(this.time * 8) % 2;
    drawText(g, 'DMG', 6, 21, { color: hit ? C.bad : C.dim });
    for (let k = 0; k < WRECK_AT; k++) {
      const on = k < d.crashes;
      rect(g, 26 + k * 19, 22, 17, 5, on ? (k >= WRECK_AT - 2 ? C.bad : C.warn) : '#2a2f45');
    }
    // Speed and gear (right).
    const kmh = Math.round((d.speed / MAX_SPEED) * KMH);
    const gearIdx = Math.min(4, Math.floor((d.speed / MAX_SPEED) * 5)); // five gears; the top one revs all the way up
    const gear = d.speed < 50 ? 'N' : String(1 + gearIdx);
    // Number and gear on top, the rev counter on a row of its own underneath (the big digits never reach it).
    rect(g, W - 122, 2, 120, 28, 'rgba(13,15,24,0.88)');
    drawText(g, String(kmh), W - 52, 4, { align: 'right', scale: 2, color: C.text, shadow: C.border });
    drawText(g, 'KM/H', W - 48, 4, { color: C.dim });
    drawText(g, `G${gear}`, W - 48, 12, { color: C.so });
    const rev = (d.speed / MAX_SPEED) * 5 - gearIdx;
    for (let k = 0; k < 12; k++) rect(g, W - 118 + k * 9, 23, 8, 4, k / 12 < rev ? (k >= 9 ? C.bad : C.good) : '#2a2f45');
    // Route to the client.
    const bx = 130;
    const bw = W - 260;
    const by = 34;
    rect(g, bx, by, bw, 4, 'rgba(13,15,24,0.75)');
    for (const st of this.track.stages.slice(1)) rect(g, bx + Math.round((st.start / this.track.finish) * bw), by - 1, 1, 6, C.dim);
    rect(g, bx, by + 1, Math.round(bw * d.progress), 2, C.gold);
    rect(g, bx + Math.round(bw * d.progress) - 2, by - 1, 4, 6, '#c8242c');
    drawText(g, this.client.short.toUpperCase(), bx + bw + 4, by - 1, { color: C.dim, shadow: C.border });
    if (this.phase === 'drive' && this.time < 8) drawText(g, 'Esc: pause', W - 4, H - 10, { align: 'right', color: 'rgba(255,255,255,0.5)' });
  }

  drawMessage(g) {
    const m = this.message;
    if (Math.floor(m.t * 6) % 2 === 0 && m.t < 0.6) return;
    drawText(g, m.text, W / 2, 70, { align: 'center', scale: 3, color: C.gold, shadow: C.border });
    if (m.sub) drawText(g, m.sub, W / 2, 98, { align: 'center', color: C.text, shadow: C.border });
  }

  drawBrief(g) {
    dim(g, 0.55);
    const x = W / 2 - 150;
    const y = H / 2 - 70;
    panel(g, x, y, 300, 132, { title: `Business trip · ${this.client.name}` });
    const warn = wrapText(`Crashes at speed dent the car (DMG). The ${ordinal(WRECK_AT)} one wrecks it, and the deal with it.`, 276);
    const lines = [
      ...wrapText('Drive to the client before the clock runs out: each checkpoint adds time. Overtake the traffic and keep off the verge.', 276),
      '',
      ...wrapText(DRIVE_HELP, 276),
      '',
      ...warn,
    ];
    lines.forEach((l, i) => drawText(g, l, x + 12, y + 22 + i * 10, { color: i >= lines.length - warn.length ? C.warn : C.text }));
    this.buttons.render(g);
  }

  drawResult(g) {
    dim(g, 0.6);
    const ok = this.result === 'arrived';
    const x = W / 2 - 140;
    const y = H / 2 - 70;
    const title = { arrived: 'ARRIVED!', crashed: 'WRECKED!', late: 'OUT OF TIME', quit: 'TURNED BACK' }[this.result];
    panel(g, x, y, 280, 108, { title, titleColor: ok ? C.goodBtn : '#7a2b2b' });
    const body = ok
      ? [this.line, `Time to spare: ${Math.ceil(this.drive.time)} s. Car damage: ${Math.round(this.drive.damage * 100)}%.`, `Next: 15 minutes at ${this.client.name}.`, 'Double paperclips, coffee every 2 minutes.']
      : [this.line, '', 'The business trip is off for good. Back to the office it is.'];
    let yy = y + 22;
    body.forEach((l, i) => {
      for (const w of l ? wrapText(l, 256) : ['']) {
        drawText(g, w, W / 2, yy, { align: 'center', color: i === 0 ? C.gold : C.text });
        yy += 11;
      }
    });
    this.buttons.render(g);
  }
}

/** Draws a scaled sprite, cropping the rows below `clip` (hidden behind a hill crest). */
/**
 * Fills a convex polygon (screen points) row by row with whole pixels, rows from `clip` down left out (hidden behind a
 * nearer hill crest). A sliver thinner than a row still gets its row, so a far rail stays unbroken.
 */
function fillQuad(g, pts, color, clip) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) (lo = Math.min(lo, p.y)), (hi = Math.max(hi, p.y));
  const y0 = Math.max(0, Math.floor(lo));
  const y1 = Math.min(clip, H, Math.max(y0 + 1, Math.ceil(hi)));
  g.fillStyle = color;
  for (let y = y0; y < y1; y++) {
    const yc = Math.min(Math.max(y + 0.5, lo), hi);
    let xa = Infinity;
    let xb = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      if ((p.y <= yc && q.y >= yc) || (q.y <= yc && p.y >= yc)) {
        const x = p.y === q.y ? Math.min(p.x, q.x) : p.x + ((yc - p.y) / (q.y - p.y)) * (q.x - p.x);
        const x2 = p.y === q.y ? Math.max(p.x, q.x) : x;
        xa = Math.min(xa, x);
        xb = Math.max(xb, x2);
      }
    }
    if (xa > xb) continue;
    const l = Math.floor(xa);
    g.fillRect(l, y, Math.max(1, Math.ceil(xb) - l), 1);
  }
}

function blit(g, canvas, x, y, w, h, clip) {
  if (w < 1 || h < 1 || y >= clip) return;
  const vis = Math.min(h, clip - y);
  const sh = (canvas.height * vis) / h;
  if (sh < 0.5) return;
  g.drawImage(canvas, 0, 0, canvas.width, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(vis));
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ordinal = (n) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n - 1] || `${n}th`;
