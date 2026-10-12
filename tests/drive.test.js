import { test, expect } from 'bun:test';
import { buildTrack, createDrive, autopilot, SEG, MAX_SPEED, STAGES, OFFROAD_LIMIT, LANES } from '../src/core/drive.js';

const run = (track, controls, maxS = 400) => {
  const d = createDrive(track);
  const memo = {};
  const log = { bumps: 0, checkpoints: 0 };
  for (let n = 0; d.status === 'drive' && n < maxS * 60; n++) {
    d.update(1 / 60, typeof controls === 'function' ? controls(d, memo) : controls);
    if (d.events.includes('bump')) log.bumps++;
    if (d.events.includes('checkpoint')) log.checkpoints++;
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
  }
});

test('crawling along misses the meeting: the clock runs out', () => {
  const { d } = run(buildTrack(10, 0), (d, memo) => autopilot(d, 0.7, memo));
  expect(d.status).toBe('late');
  expect(d.time).toBe(0);
});

test('flooring it without steering ends in a wreck', () => {
  const { d } = run(buildTrack(10, 0), { accel: true });
  expect(d.status).toBe('crashed');
});

test('running into the back of a car at speed wrecks the car; a slow bump only costs speed', () => {
  const lone = (gapSegs) => {
    const t = buildTrack(10, 0);
    for (const seg of t.segments) Object.assign(seg, { curve: 0, sprites: [] }); // only the car to hit
    t.cars = [{ d: gapSegs * SEG, x: 0, lane: 1, speed: MAX_SPEED * 0.1, color: '#fff', weave: 999 }];
    return t;
  };
  const fast = run(lone(150), { accel: true, steer: 0 }, 20).d;
  expect(fast.status).toBe('crashed');
  const slow = createDrive(lone(14));
  let bumped = false;
  for (let n = 0; n < 60 * 4 && !bumped; n++) {
    slow.update(1 / 60, { accel: true });
    bumped = slow.events.includes('bump');
  }
  expect(bumped).toBe(true);
  expect(slow.status).toBe('drive');
  expect(slow.speed).toBeLessThan(MAX_SPEED * 0.1);
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
