import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as E from '../src/core/economy.js';
import * as A from '../src/core/achievements.js';
import { buildFloor, ALL_GAMES } from '../src/core/tasks.js';
import { buyDecor, deskOffer, trophyId } from '../src/core/desk.js';

const player = () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  s.lobby = 'done';
  return s;
};
const ids = (list) => list.map((b) => b.id);

test('badges have unique ids, names and descriptions that fit the wall', () => {
  expect(new Set(ids(A.BADGES)).size).toBe(A.BADGES.length);
  expect(A.BADGES.length).toBe(37);
  for (const b of A.BADGES) {
    expect(b.name.length).toBeLessThanOrEqual(24);
    expect(b.desc.length).toBeLessThanOrEqual(56);
  }
});

test('a new hire has nothing; check-in and the first task unlock their badges once', () => {
  const s = S.newGame({ corpName: 'Acme', colorId: 'bigblue', playerName: 'Pat' }, 0);
  expect(A.checkBadges(s, 1)).toEqual([]);
  s.lobby = 'gate';
  s.stats.tasksPlayed = 1;
  expect(ids(A.checkBadges(s, 5))).toEqual(['first_task', 'checkin']);
  expect(s.badges.first_task).toBe(5);
  expect(A.checkBadges(s, 6)).toEqual([]);
});

test('progress badges follow the state', () => {
  const s = player();
  s.maxFloor = 20;
  s.level = 20;
  s.stats.perfectTasks = 25;
  s.stats.tasksPlayed = 100;
  s.stats.warps = 1;
  s.stats.coffeeMachine = 25;
  s.sp = 1e6;
  for (const g of S.COUNTED_GAMES) s.played[g] = 1;
  const got = ids(A.checkBadges(s, 1));
  for (const id of ['floor10', 'floor20', 'level20', 'perfect', 'perfect25', 'tasks100', 'generalist', 'hacker', 'caffeine', 'maximiser'])
    expect(got).toContain(id);
  expect(got).not.toContain('floor30');
  expect(got).not.toContain('ceo');
});

test('Generalist means every kind of mini-game the counter shows, the holiday activities included', async () => {
  const { ACTIVITIES } = await import('../src/data/vacation.js');
  const s = player();
  for (const g of ALL_GAMES) s.played[g] = 1;
  expect(ids(A.checkBadges(s, 1))).not.toContain('generalist');
  for (const a of ACTIVITIES) s.played[a.game] = 1;
  expect(ids(A.checkBadges(s, 2))).toContain('generalist');
});

test('reaching floor 10 without spending Stock Options; old saves never qualify', () => {
  const s = player();
  s.maxFloor = 10;
  s.stats.soSpent = 1;
  expect(ids(A.checkBadges(s, 1))).not.toContain('bootstrapped');
  const t = player();
  t.maxFloor = 10;
  expect(ids(A.checkBadges(t, 1))).toContain('bootstrapped');
  const old = player();
  delete old.stats.soSpent;
  const back = S.deserialize(JSON.stringify(old), 0);
  expect(back.stats.soSpent).toBe(-1);
  back.maxFloor = 10;
  expect(ids(A.checkBadges(back, 1))).not.toContain('bootstrapped');
});

test('spending Stock Options is counted', () => {
  const s = player();
  s.so = 100;
  s.cooldowns.x = 1e9;
  S.skipCooldown(s, 'x', 0);
  s.coffee.value = 0;
  S.refillCoffee(s, 0);
  S.buyPerk(s, 'stapler');
  expect(s.stats.soSpent).toBe(E.SKIP_COOLDOWN_SO + E.REFILL_COFFEE_SO + E.PERKS.find((p) => p.id === 'stapler').baseCost);
  S.useCoffeeMachine(s, 1, 0);
  expect(s.stats.coffeeMachine).toBe(1);
});

test('firing badges: ten colleagues, and the whole floor-40 board', () => {
  const s = player();
  s.stats.fired = 10;
  expect(ids(A.checkBadges(s, 1))).toContain('restructuring');
  expect(ids(A.checkBadges(s, 1))).not.toContain('cleansweep');
  for (const n of buildFloor(40).npcs) s.fired[n.seed] = true;
  expect(ids(A.checkBadges(s, 2))).toContain('cleansweep');
});

test('stand-up, event and desk badges', () => {
  const s = player();
  s.stats.standups = 1;
  s.daily = { day: '2026-10-12', streak: 7, best: 7 };
  s.stats.events = { drill: 3, cake: 3, printer: 3, audit: 1 };
  s.sp = 1e9;
  s.maxFloor = 40;
  for (let f = 1; f <= 40 && s.desk.owned.length < E.DESK_COLLECTOR; f++) for (const d of deskOffer(f)) if (!d.needs) buyDecor(s, f, d.id);
  s.starsByFloor[3] = E.starQuota(3);
  expect(buyDecor(s, 3, trophyId(3)).ok).toBe(true);
  const got = ids(A.checkBadges(s, 1));
  for (const id of ['standup', 'streak7', 'drill3', 'cake3', 'printer3', 'audit', 'decorate', 'designer', 'trophy']) expect(got).toContain(id);
});

test('department mastery: 3 stars on every task of its five floors', () => {
  const s = player();
  for (let f = 26; f <= 30; f++) for (const it of buildFloor(f).tasks) s.bestByTask[it.task.id] = 3;
  const one = buildFloor(26).tasks[0].task.id;
  s.bestByTask[one] = 2;
  expect(ids(A.checkBadges(s, 1))).not.toContain('dept_finance');
  s.bestByTask[one] = 3;
  expect(ids(A.checkBadges(s, 2))).toEqual(['dept_finance']);
});
