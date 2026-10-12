// The business-trip drive (spec 2026-10-12-business-trip), in the spirit of Lotus III: a pseudo-3D road of short segments
// with curves and hills, four stages with checkpoints that add time, traffic to overtake and roadside objects to avoid.
// Pure simulation: the scene (src/scenes/driveScene.js) projects and draws it. Units: x is across the road (-1..1 = the
// asphalt, beyond is the verge), d is the distance along the track in world units (SEG per segment).
import { createRng } from './rng.js';

export const SEG = 200;
export const MAX_SPEED = SEG * 60; // world units per second
export const KMH = 240; // the speedometer at MAX_SPEED
const ACCEL = MAX_SPEED / 5;
const BRAKE = MAX_SPEED * 0.9;
const DECEL = MAX_SPEED / 6;
const OFFROAD_DECEL = MAX_SPEED / 1.6;
export const OFFROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.3;
const STEER = 2; // road widths per second at full speed
export const PLAYER_W = 0.22; // half the car's width, in road half-widths
export const CAR_LEN = SEG * 1.6;
export const LANES = [-0.62, 0, 0.62];
/** Hitting something faster than this (relative speed, a share of MAX_SPEED) is a crash; slower is a bump. */
export const CRASH_CAR = 0.32;
export const CRASH_OBJECT = 0.4;
/** Crashes the car can take: each one dents it (damage += 1/WRECK_AT), this one wrecks it. */
export const WRECK_AT = 5;
/** After a crash the car spins out for SPIN_S seconds (no control, the clock runs on), then GRACE_S of bumps only. */
export const SPIN_S = 1.2;
export const GRACE_S = 1.5;
const RECOVER_X = 0.7; // a crash off the road puts the car back this far from the centre line
export const BARRIER_X = 1.12;
const STEP = 1 / 60;

export const STAGES = [
  { id: 'downtown', name: 'Downtown' },
  { id: 'country', name: 'Countryside' },
  { id: 'motorway', name: 'Motorway' },
  { id: 'park', name: 'Business Park' },
];
/** Segments per stage; a good driver averages ~210 km/h, so the whole drive takes about 3 minutes. */
export const STAGE_SEGS = 2000;
/** Seconds on the clock at the start and added at each checkpoint (Lotus-style), easy → hard. */
export const START_TIME = [58, 60];
export const CHECKPOINT_TIME = [52, 53];

/** Roadside objects: half-width in road half-widths (for collisions); `solid` ones can wreck the car. */
export const SPRITES = {
  lamp: { w: 0.06, solid: true },
  tree: { w: 0.18, solid: true },
  pine: { w: 0.14, solid: true },
  bush: { w: 0.16, solid: false },
  billboard: { w: 0.3, solid: true },
  house: { w: 0.5, solid: true },
  tower: { w: 0.6, solid: true },
  sign: { w: 0.08, solid: true },
  chevronL: { w: 0.1, solid: true },
  chevronR: { w: 0.1, solid: true },
  palm: { w: 0.1, solid: true },
  cone: { w: 0.06, solid: false },
  rail: { w: 0.05, solid: false }, // the motorway barrier itself is segment.barrier
  client: { w: 0.9, solid: false },
};

const ease = {
  in: (a, b, p) => a + (b - a) * p ** 2,
  inOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5),
};

/**
 * Builds the track: `hard` 0..1 (floor 10 → 0, floor 30 → 1) sharpens the curves and adds traffic.
 * Returns { segments: [{ i, curve, y0, y1, stage, sprites: [{ kind, x }], barrier }], stages: [{ id, name, start, end }],
 * finish (segment index), cars: [{ d, x, lane, speed, color }] }.
 */
export function buildTrack(seed, hard = 0) {
  const rng = createRng(seed * 7717 + 3);
  const segments = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].y1 : 0);
  let stage = 0;
  const add = (curve, y) => {
    const i = segments.length;
    segments.push({ i, curve, y0: lastY(), y1: y, stage, sprites: [], barrier: false });
  };
  const road = (enter, hold, leave, curve, height = 0) => {
    const y0 = lastY();
    const y1 = y0 + height * SEG;
    const n = enter + hold + leave;
    for (let k = 0; k < enter; k++) add(ease.in(0, curve, k / enter), ease.inOut(y0, y1, k / n));
    for (let k = 0; k < hold; k++) add(curve, ease.inOut(y0, y1, (enter + k) / n));
    for (let k = 0; k < leave; k++) add(ease.inOut(curve, 0, k / leave), ease.inOut(y0, y1, (enter + hold + k) / n));
  };
  const curveFor = (s) => {
    // Easy 2, medium 4, hard 6: holding a medium curve takes ~205 km/h, a hard one ~130.
    const r = rng.next();
    const hardShare = s === 2 ? 0 : 0.08 + 0.22 * hard;
    const c = r < hardShare ? 6 : r < hardShare + 0.4 ? 4 : r < hardShare + 0.4 + 0.2 * (1 - hard) ? 2 : 3;
    return rng.chance(0.5) ? c : -c;
  };
  const stages = [];
  for (stage = 0; stage < STAGES.length; stage++) {
    const start = segments.length;
    road(0, 60, 0, 0); // every stage starts on a straight (the checkpoint)
    while (segments.length - start < STAGE_SEGS - 120) {
      const kind = rng.next();
      const hills = stage === 1 ? 1 : stage === 3 ? 0.4 : stage === 0 ? 0.25 : 0.15;
      const h = rng.chance(0.55 * hills) ? rng.pick([-1, 1]) * rng.int(10, stage === 1 ? 50 : 25) : 0;
      if (kind < 0.3) road(25, rng.int(40, 120), 25, 0, h);
      else if (kind < 0.8) road(rng.int(20, 40), rng.int(40, 110), rng.int(20, 40), curveFor(stage), h);
      else {
        // S-bend
        const c = curveFor(stage);
        road(25, rng.int(30, 60), 25, c, h);
        road(25, rng.int(30, 60), 25, -Math.sign(c) * Math.min(4, Math.abs(c)), -h);
      }
    }
    road(30, STAGE_SEGS - (segments.length - start) - 30, 0, 0, 0); // ends level and straight
    stages.push({ ...STAGES[stage], start, end: segments.length });
  }
  stage = STAGES.length - 1;
  const finish = segments.length;
  road(0, 300, 0, 0); // the run-out past the client's building
  for (const st of stages) scenery(rng, segments, st);
  const last = stages[stages.length - 1];
  segments[finish].finish = true;
  // The client's building stands where the car rolls to a stop after the finish gate.
  segments[finish + 48].sprites.push({ kind: 'client', x: 0 });
  for (const st of stages.slice(1)) segments[st.start].checkpoint = true;
  segments[last.end - 1].sprites = segments[last.end - 1].sprites.filter((sp) => !SPRITES[sp.kind].solid);

  const cars = [];
  const count = Math.round(42 + 34 * hard);
  const colors = ['#d23b3b', '#3b6fd2', '#f2c14e', '#e8e8e8', '#2f8f4f', '#7a3bb6', '#222630', '#e08a2b'];
  for (let k = 0; k < count; k++) {
    const lane = rng.int(0, 2);
    const d = (40 + ((finish - 80) * (k + rng.float(0.1, 0.9))) / count) * SEG;
    cars.push({ d, x: LANES[lane], lane, speed: MAX_SPEED * rng.float(0.3, 0.55), color: rng.pick(colors), weave: rng.float(3, 9) });
  }
  return { segments, stages, finish, cars, hard };
}

function scenery(rng, segments, st) {
  const put = (i, kind, x) => segments[i]?.sprites.push({ kind, x });
  for (let i = st.start; i < st.end; i++) {
    const seg = segments[i];
    const side = rng.chance(0.5) ? 1 : -1;
    if (st.id === 'downtown') {
      if (i % 10 === 0) put(i, 'lamp', -1.5), put(i, 'lamp', 1.5);
      if (i % 30 === 15) put(i, 'tower', side * rng.float(2.6, 3.6));
      if (i % 30 === 5) put(i, 'tower', -side * rng.float(2.6, 3.6));
      if (rng.chance(0.012)) put(i, 'billboard', side * 1.9);
    } else if (st.id === 'country') {
      if (rng.chance(0.09)) put(i, rng.chance(0.6) ? 'tree' : 'pine', side * rng.float(1.55, 3.5));
      if (rng.chance(0.04)) put(i, 'bush', side * rng.float(1.3, 2.2));
      if (rng.chance(0.004)) put(i, 'house', side * rng.float(2.8, 3.6));
    } else if (st.id === 'motorway') {
      seg.barrier = true;
      put(i, 'rail', -1.2), put(i, 'rail', 1.2);
      if (i % 20 === 0) put(i, 'lamp', -1.45), put(i, 'lamp', 1.45);
      if (i % 240 === 120) put(i, 'sign', 1.7);
    } else {
      if (i % 9 === 0) put(i, 'palm', -1.55), put(i, 'palm', 1.55);
      if (i % 50 === 25) put(i, 'tower', side * rng.float(2.6, 3.4));
      if (rng.chance(0.01)) put(i, 'billboard', side * 1.95);
    }
    // Chevrons warn of a curve ahead on the outside of the bend.
    const ahead = segments[i + 12];
    if (ahead && Math.abs(ahead.curve) >= 4 && Math.abs(seg.curve) < 1 && i % 4 === 0 && st.id !== 'motorway') put(i, ahead.curve > 0 ? 'chevronR' : 'chevronL', ahead.curve > 0 ? 1.4 : -1.4);
  }
}

/**
 * A drive along `track`. update(dt, { accel, brake, steer -1..1 }) advances it; `events` lists what happened during
 * the last update ('bump', 'crash', 'wreck', 'checkpoint', 'scrape', 'arrived', 'late'). status: 'drive' → 'crashed'
 * (wrecked) | 'late' | 'arrived'. `crashes` counts the crashes, `damage` 0..1 is the share of WRECK_AT, `spin` and
 * `grace` are the seconds left of the spin-out and of the grace period after it.
 */
export function createDrive(track) {
  const hard = track.hard >= 0.5 ? 1 : 0;
  const rng = createRng(track.finish * 13 + 1);
  const cars = track.cars.map((c) => ({ ...c }));
  const drive = {
    track,
    cars,
    d: 0,
    x: 0,
    speed: 0,
    time: START_TIME[hard],
    elapsed: 0,
    stage: 0,
    status: 'drive',
    steer: 0,
    braking: false,
    crashes: 0,
    spin: 0,
    grace: 0,
    get damage() {
      return Math.min(1, drive.crashes / WRECK_AT);
    },
    offroad: false,
    events: [],
    get finishD() {
      return track.finish * SEG;
    },
    get progress() {
      return Math.min(1, drive.d / drive.finishD);
    },
    segAt(d) {
      const s = track.segments;
      return s[Math.max(0, Math.min(s.length - 1, Math.floor(d / SEG)))];
    },
    update(dt, controls = {}) {
      drive.events = [];
      while (dt > 1e-6) {
        const h = Math.min(STEP, dt);
        step(h, controls);
        dt -= h;
      }
    },
  };

  /** A crash dents the car and spins it out; the last one the car can take wrecks it. */
  const crash = () => {
    drive.crashes++;
    if (drive.crashes >= WRECK_AT) {
      drive.status = 'crashed';
      drive.events.push('wreck');
      return;
    }
    drive.speed = 0;
    drive.spin = SPIN_S;
    drive.grace = SPIN_S + GRACE_S;
    drive.events.push('crash');
  };

  function step(dt, c) {
    const live = drive.status === 'drive';
    const spinning = drive.spin > 0;
    const ctl = live && !spinning;
    drive.spin = Math.max(0, drive.spin - dt);
    drive.grace = Math.max(0, drive.grace - dt);
    const seg = drive.segAt(drive.d);
    const sp = drive.speed / MAX_SPEED;
    const steer = ctl ? Math.max(-1, Math.min(1, c.steer || 0)) : 0;
    drive.steer = steer;
    drive.braking = ctl && !!c.brake;
    // Spinning out: the car is put back on the road (Lotus-style) while it comes to its senses.
    if (spinning && live) {
      const tx = Math.max(-RECOVER_X, Math.min(RECOVER_X, drive.x));
      drive.x += Math.sign(tx - drive.x) * Math.min(Math.abs(tx - drive.x), dt * 3);
    }
    // Steering bites with speed; curves push the car outwards.
    const dx = dt * STEER * sp;
    drive.x += steer * dx - dx * sp * seg.curve * CENTRIFUGAL;
    if (!ctl) drive.speed -= BRAKE * 0.6 * dt;
    else if (c.accel) drive.speed += ACCEL * (1 - 0.35 * sp) * dt;
    else if (c.brake) drive.speed -= BRAKE * dt;
    else drive.speed -= DECEL * dt;
    drive.offroad = Math.abs(drive.x) > 1;
    if (drive.offroad && drive.speed > OFFROAD_LIMIT) drive.speed = Math.max(OFFROAD_LIMIT, drive.speed - OFFROAD_DECEL * dt);
    if (seg.barrier && Math.abs(drive.x) > BARRIER_X) {
      drive.x = Math.sign(drive.x) * BARRIER_X;
      drive.speed *= 1 - 2.5 * dt;
      if (live && !drive.events.includes('scrape')) drive.events.push('scrape');
    }
    drive.x = Math.max(-3.6, Math.min(3.6, drive.x));
    drive.speed = Math.max(0, Math.min(MAX_SPEED, drive.speed));
    const before = drive.d;
    drive.d += drive.speed * dt;

    for (const car of cars) {
      car.d += car.speed * dt;
      car.weave -= dt;
      if (car.weave <= 0) {
        car.weave = rng.float(4, 10);
        if (rng.chance(0.5)) car.lane = Math.max(0, Math.min(2, car.lane + (rng.chance(0.5) ? 1 : -1)));
      }
      const tx = LANES[car.lane];
      car.x += Math.sign(tx - car.x) * Math.min(Math.abs(tx - car.x), 0.35 * dt);
    }
    if (!live) return;

    // Roadside objects in the segments just crossed (none while spinning: the car is being put back on the road).
    const canCrash = drive.grace <= 0;
    for (let i = Math.floor(before / SEG); i <= Math.floor(drive.d / SEG) && !spinning; i++) {
      for (const s of track.segments[i]?.sprites || []) {
        const def = SPRITES[s.kind];
        if (!def.solid || Math.abs(drive.x - s.x) >= def.w + PLAYER_W) continue;
        if (canCrash && drive.speed > CRASH_OBJECT * MAX_SPEED) {
          drive.d = before;
          crash();
          return tick(dt);
        }
        drive.speed = 0;
        drive.d = before;
        drive.x += drive.x < s.x ? -0.08 : 0.08;
        drive.events.push('bump');
        return;
      }
    }
    // Traffic: running into the back of a car.
    for (const car of cars) {
      const gap = car.d - drive.d;
      if (spinning || gap <= 0 || gap > CAR_LEN || Math.abs(car.x - drive.x) >= PLAYER_W * 2) continue;
      if (canCrash && drive.speed - car.speed > CRASH_CAR * MAX_SPEED) {
        drive.d = car.d - CAR_LEN * 1.1;
        crash();
        break;
      }
      if (drive.speed > car.speed) {
        drive.speed = car.speed * 0.8;
        drive.d = car.d - CAR_LEN;
        drive.x += drive.x < car.x ? -0.06 : 0.06;
        drive.events.push('bump');
      }
    }

    tick(dt);
  }

  /** The clock, the checkpoints and the finish. */
  function tick(dt) {
    if (drive.status !== 'drive') return;
    drive.elapsed += dt;
    drive.time -= dt;
    const st = track.stages[drive.stage + 1];
    if (st && drive.d >= st.start * SEG) {
      drive.stage++;
      drive.time += CHECKPOINT_TIME[hard];
      drive.events.push('checkpoint');
    }
    if (drive.d >= drive.finishD) {
      drive.status = 'arrived';
      drive.events.push('arrived');
    } else if (drive.time <= 0) {
      drive.time = 0;
      drive.status = 'late';
      drive.events.push('late');
    }
  }
  return drive;
}

/**
 * A careful driver for the tests: keeps to the lane with the most room, slows down for curves it could not hold and for
 * cars it cannot pass, steers against the curve. `skill` < 1 lifts off earlier and drives slower (a cautious player).
 * `memo` ({}) keeps the chosen lane between frames. Returns controls for drive.update.
 */
export function autopilot(drive, skill = 1, memo = {}) {
  const segs = drive.track.segments;
  const i = Math.floor(drive.d / SEG);
  const sp = drive.speed / MAX_SPEED;
  // The nearest slower car ahead around a given x: { gap (world units), speed }.
  const carAhead = (x, w = PLAYER_W * 2.3) => {
    let best = { gap: Infinity, speed: 0 };
    for (const car of drive.cars) {
      const gap = car.d - drive.d;
      if (gap > -CAR_LEN * 0.8 && gap < 80 * SEG && Math.abs(car.x - x) < w && car.speed < drive.speed + 200 && gap < best.gap) best = { gap, speed: car.speed };
    }
    return best;
  };
  const room = LANES.map((lx) => carAhead(lx).gap);
  memo.lane ??= 1;
  // Change lanes (one at a time) when another has clearly more room.
  if (room[memo.lane] < 50 * SEG) {
    let best = memo.lane;
    for (const k of [memo.lane - 1, memo.lane + 1]) if (k >= 0 && k <= 2 && room[k] > room[best] + 8 * SEG) best = k;
    memo.lane = best;
  }
  const target = LANES[memo.lane];
  let curve = 0;
  for (let k = 0; k < 20; k++) curve = Math.max(curve, Math.abs(segs[i + k]?.curve || 0));
  const here = segs[i]?.curve || 0;
  // Leave some steering for lane changes: hold a curve with at most ~70% lock.
  const allowed = Math.min(skill, (0.7 * skill) / (CENTRIFUGAL * Math.max(curve, 0.01)));
  // A car right in front that we are closing on: brake in time to match its speed (earlier while still changing lanes).
  const ahead = carAhead(drive.x, PLAYER_W * 2.2);
  const closing = Math.max(0, drive.speed - ahead.speed);
  const stopDist = (closing * closing) / (2 * BRAKE) + CAR_LEN * 1.5 + (Math.abs(target - drive.x) > 0.05 ? 2 * SEG : 0);
  const mustBrake = ahead.gap < stopDist;
  const need = sp * here * CENTRIFUGAL;
  const steer = Math.max(-1, Math.min(1, need + (target - drive.x) * 4));
  return {
    steer,
    accel: !mustBrake && sp < allowed - 0.01,
    brake: mustBrake || sp > allowed + 0.08,
  };
}
