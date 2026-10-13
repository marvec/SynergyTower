import { test, expect } from 'bun:test';
import { buildTrack, createDrive, autopilot, SEG, MAX_SPEED, STAGES, OFFROAD_LIMIT, LANES, WRECK_AT, SPIN_S, CAR_LEN } from '../src/core/drive.js';

const run = (track, controls, maxS = 400) => {
  const d = createDrive(track);
  const memo = {};
  const log = { bumps: 0, checkpoints: 0, crashes: 0 };
  for (let n = 0; d.status === 'drive' && n < maxS * 60; n++) {
    d.update(1 / 60, typeof controls === 'function' ? controls(d, memo) : controls);
    if (d.events.includes('bump')) log.bumps++;
    if (d.events.includes('checkpoint')) log.checkpoints++;
    if (d.events.includes('crash')) log.crashes++;
  }
  return { d, log };
};

test('the track has four stages with checkpoints, a finish at the client, and is the same every time', () => {
  const t = buildTrack(10, 0);
  expect(t.stages.map((s) => s.id)).toEqual(STAGES.map((s) => s.id));
  expect(t.finish).toBe(t.stages[3].end);
  expect(t.segments[t.finish].finish).toBe(true);
  expect(t.segments.slice(t.finish, t.finish + 60).some((seg) => seg.sprites.some((s) => s.kind === 'client'))).toBe(true);
  expect(t.stages.slice(1).every((s) => t.segments[s.start].checkpoint)).toBe(true);
  expect(t.segments.filter((s) => s.stage === 2).every((s) => s.barrier)).toBe(true);
  expect(JSON.stringify(buildTrack(10, 0))).toBe(JSON.stringify(t));
});

test('floor 30 is harder: more traffic and sharper curves', () => {
  const easy = buildTrack(10, 0);
  const hard = buildTrack(30, 1);
  const sharp = (t) => t.segments.filter((s) => Math.abs(s.curve) >= 5.9).length;
  expect(hard.cars.length).toBeGreaterThan(easy.cars.length);
  expect(sharp(hard)).toBeGreaterThan(sharp(easy));
});

test('a good driver reaches the client in about 3 minutes, without crashing and with time to spare', () => {
  for (const [seed, hard] of [[10, 0], [30, 1]]) {
    const { d, log } = run(buildTrack(seed, hard), (d, memo) => autopilot(d, 1, memo));
    expect(d.status).toBe('arrived');
    expect(d.elapsed).toBeGreaterThan(150);
    expect(d.elapsed).toBeLessThan(210);
    expect(d.time).toBeGreaterThan(10);
    expect(log.checkpoints).toBe(3);
    expect(d.progress).toBe(1);
    expect(d.crashes).toBe(0);
    expect(d.damage).toBe(0);
  }
});

test('crawling along misses the meeting: the clock runs out', () => {
  const { d } = run(buildTrack(10, 0), (d, memo) => autopilot(d, 0.7, memo));
  expect(d.status).toBe('late');
  expect(d.time).toBe(0);
});

test('flooring it without steering never gets there: crash after crash until the clock runs out', () => {
  const { d, log } = run(buildTrack(10, 0), { accel: true });
  expect(d.status).not.toBe('arrived');
  expect(log.crashes).toBeGreaterThanOrEqual(3);
  expect(d.damage).toBeGreaterThan(0.5);
});

// A flat, empty track with one slow car on it.
const lone = (gapSegs) => {
  const t = buildTrack(10, 0);
  for (const seg of t.segments) Object.assign(seg, { curve: 0, sprites: [] }); // only the car to hit
  t.cars = [{ d: gapSegs * SEG, x: 0, lane: 1, speed: MAX_SPEED * 0.1, color: '#fff', weave: 999 }];
  return t;
};
/** Puts the traffic car right in front of the player and drives into it at full speed. */
const rearEnd = (d) => {
  Object.assign(d.cars[0], { d: d.d + 3 * SEG, x: d.x });
  d.speed = MAX_SPEED;
  d.update(0.2, { accel: true });
};

test('running into the back of a car at speed damages the car; a slow bump only costs speed', () => {
  const fast = run(lone(150), { accel: true, steer: 0 }, 20).d;
  expect(fast.crashes).toBe(1);
  expect(fast.status).toBe('drive');
  const slow = createDrive(lone(14));
  let bumped = false;
  for (let n = 0; n < 60 * 4 && !bumped; n++) {
    slow.update(1 / 60, { accel: true });
    bumped = slow.events.includes('bump');
  }
  expect(bumped).toBe(true);
  expect(slow.status).toBe('drive');
  expect(slow.crashes).toBe(0);
  expect(slow.speed).toBeLessThan(MAX_SPEED * 0.1);
});

test('the car takes four crashes; the fifth wrecks it', () => {
  expect(WRECK_AT).toBe(5);
  const d = createDrive(lone(100));
  for (let k = 1; k <= WRECK_AT; k++) {
    rearEnd(d);
    expect(d.crashes).toBe(k);
    expect(d.damage).toBeCloseTo(k / WRECK_AT);
    if (k < WRECK_AT) {
      expect(d.events).toContain('crash');
      expect(d.status).toBe('drive');
      d.update(SPIN_S + 3, {}); // spin out, then the grace period passes
    } else {
      expect(d.events).toContain('wreck');
      expect(d.status).toBe('crashed');
    }
  }
});

test('a good driver can afford four crashes and still make it in time', () => {
  for (const [seed, hard] of [[10, 0], [30, 1]]) {
    const at = [30, 65, 100, 135];
    const { d } = run(buildTrack(seed, hard), (d, memo) => {
      if (d.elapsed > at[0] && d.spin === 0) {
        at.shift();
        rearEnd(d);
      }
      return autopilot(d, 1, memo);
    });
    expect(d.crashes).toBe(4);
    expect(d.status).toBe('arrived');
  }
});

test('a crash stops and spins the car while the clock runs on; then a short grace period with no new damage', () => {
  const d = createDrive(lone(100));
  rearEnd(d);
  expect(d.speed).toBe(0);
  expect(d.spin).toBeGreaterThan(0);
  const time = d.time;
  d.update(SPIN_S / 2, { accel: true, steer: 1 });
  expect(d.speed).toBe(0); // no control while spinning
  expect(d.time).toBeCloseTo(time - SPIN_S / 2);
  d.update(SPIN_S / 2 + 0.2, { accel: true });
  expect(d.spin).toBe(0);
  expect(d.speed).toBeGreaterThan(0);
  rearEnd(d); // straight into the next car while still shaken up: only a bump
  expect(d.events).toContain('bump');
  expect(d.crashes).toBe(1);
});

test('crashing into the roadside puts the car back on the road', () => {
  const t = lone(100);
  t.cars = [];
  t.segments[60].sprites.push({ kind: 'tree', x: 1.6 });
  const d = createDrive(t);
  d.d = 50 * SEG;
  d.x = 1.5;
  d.speed = MAX_SPEED * 0.8;
  d.update(0.5, { accel: true });
  expect(d.crashes).toBe(1);
  d.update(SPIN_S + 0.1, {});
  expect(Math.abs(d.x)).toBeLessThanOrEqual(0.8);
  expect(d.status).toBe('drive');
});

test('the verge slows the car down; the motorway barrier keeps it on the road', () => {
  const t = buildTrack(10, 0);
  t.cars = [];
  const d = createDrive(t);
  d.speed = MAX_SPEED;
  d.x = 1.3;
  d.update(2, { accel: true });
  expect(d.speed).toBeLessThanOrEqual(OFFROAD_LIMIT + 1);
  const m = createDrive(t);
  m.d = t.stages[2].start * SEG + 10 * SEG;
  m.stage = 2;
  m.speed = MAX_SPEED * 0.8;
  m.update(1, { accel: true, steer: 1 });
  expect(m.x).toBeLessThanOrEqual(1.12);
  expect(m.status).toBe('drive');
  expect(m.speed).toBeLessThan(MAX_SPEED * 0.8);
});

test('passing a checkpoint adds time on the clock', () => {
  const t = buildTrack(10, 0);
  t.cars = [];
  const d = createDrive(t);
  d.d = t.stages[1].start * SEG - 5;
  d.x = LANES[1];
  d.speed = MAX_SPEED / 2;
  const before = d.time;
  d.update(0.1, { accel: true });
  expect(d.events).toContain('checkpoint');
  expect(d.stage).toBe(1);
  expect(d.time).toBeGreaterThan(before + 40);
});

test("after the finish gate the car pulls up in front of the client's building, however fast or wide it arrives", () => {
  const t = buildTrack(10, 0);
  const at = t.segments.findIndex((seg) => seg.sprites.some((s) => s.kind === 'client')) * SEG;
  for (const [speed, x] of [[MAX_SPEED, 0], [MAX_SPEED, 0.95], [MAX_SPEED * 0.1, -1.6]]) {
    const d = createDrive(t);
    d.cars.length = 0;
    d.d = d.finishD - 20;
    d.speed = speed;
    d.x = x;
    d.update(1 / 60, { accel: true });
    expect(d.status).toBe('arrived');
    let stopped = Infinity;
    for (let n = 0; n < 8 * 60; n++) {
      d.update(1 / 60, {});
      if (d.speed === 0 && stopped === Infinity) stopped = n / 60;
    }
    expect(stopped).toBeLessThan(4.5); // parked well before the outro is over
    expect(d.speed).toBe(0);
    expect(d.d + CAR_LEN).toBeLessThan(at - SEG); // in front of it, not in it
    expect(d.d).toBeGreaterThan(at - 12 * SEG); // and right at the door
    expect(Math.abs(d.x)).toBeLessThanOrEqual(0.6); // facing the building, not beside it
  }
});
