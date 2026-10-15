// Home office rules (core/home.js): the offer, the presence meter and calls on play time, chores and the coffee maker,
// the end of the day (cooldowns cleared unless sent back), save/load, and the flat itself.
import { test, expect } from 'bun:test';
import * as S from '../src/core/state.js';
import * as HO from '../src/core/home.js';
import * as E from '../src/core/economy.js';
import { buildFloor } from '../src/core/tasks.js';
import { isItemReachable } from '../src/core/floorgen.js';

const NOW = new Date(2026, 9, 15, 10).getTime();
const DAY = 86400000;

function player(floor = 8) {
  const s = S.newGame({ playerName: 'Pat' }, NOW);
  Object.assign(s, { lobby: 'done', floor, maxFloor: floor, level: floor });
  s.coffee = { value: 5, updatedAt: NOW };
  return s;
}
const seq = (...v) => {
  let i = 0;
  return () => v[i++ % v.length];
};

test('offered on floors 8, 18, 28 and 38 only, once a day for all four', () => {
  const s = player();
  expect(HO.HOME.floors).toEqual([8, 18, 28, 38]);
  expect(HO.homeStatus(s, 7, NOW)).toBe('none');
  expect(HO.homeStatus(s, 8, NOW)).toBe('available');
  expect(HO.startHome(s, 8, NOW).ok).toBe(true);
  expect(HO.homeStatus(s, 8, NOW)).toBe('on');
  HO.endHome(s, 'early');
  expect(HO.homeStatus(s, 18, NOW)).toBe('today');
  expect(HO.homeStatus(s, 8, NOW + DAY)).toBe('available');
});

test('no home office during a hold, before check-in, on a trip, holiday, night shift or in the archive', () => {
  const cases = [
    ['hold', (s) => (s.conduct = { strikes: 5, hold: { at: NOW, floor: 8 } })],
    ['badge', (s) => (s.lobby = 'gate')],
    ['away', (s) => (s.trip = { floor: 10 })],
    ['away', (s) => (s.vacation = { endsAt: NOW + 1 })],
    ['away', (s) => (s.nightShift = { floor: 5 })],
    ['away', (s) => (s.archive = { asked: {}, done: {}, task: { floor: 3, inside: true } })],
  ];
  for (const [why, set] of cases) {
    const s = player();
    set(s);
    expect(HO.homeBlock(s)).toBe(why);
    expect(HO.homeStatus(s, 8, NOW)).toBe('blocked');
    expect(HO.startHome(s, 8, NOW).ok).toBe(false);
  }
});

test('1-2 video calls are planned inside the stay, never at the same time', () => {
  for (const r of [0, 0.5, 0.99]) {
    const s = player();
    HO.startHome(s, 8, NOW, () => r);
    const calls = s.home.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(2);
    for (const c of calls) {
      expect(c.at).toBeGreaterThanOrEqual(HO.HOME.callWindow[0] * HO.HOME.stayS);
      expect(c.at).toBeLessThanOrEqual(HO.HOME.callWindow[1] * HO.HOME.stayS);
    }
    if (calls.length === 2) expect(calls[1].at).toBeGreaterThan(calls[0].at);
  }
});

test('the presence meter: dry is a lapse and refills; the computer refills it; three lapses send you back', () => {
  const s = player();
  HO.startHome(s, 8, NOW, () => 0.99); // the calls come late
  s.home.calls = [];
  expect(HO.tickHome(s, HO.HOME.presenceS - 1)).toEqual([]);
  HO.pokeComputer(s);
  expect(s.home.presence).toBe(HO.HOME.presenceS);
  expect(HO.tickHome(s, HO.HOME.presenceS)).toEqual([{ type: 'lapse' }]);
  expect(s.home.presence).toBe(HO.HOME.presenceS);
  HO.tickHome(s, HO.HOME.presenceS);
  expect(HO.sentBack(s)).toBe(false);
  HO.tickHome(s, HO.HOME.presenceS);
  expect(HO.sentBack(s)).toBe(true);
  expect(HO.endHome(s, 'done').result).toBe('sent_back');
});

test('a call rings when its time comes; answered at the computer, or missed (a lapse) after 20 s', () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  s.home.calls = [{ at: 30, state: 'pending', left: 0 }, { at: 60, state: 'pending', left: 0 }];
  expect(HO.tickHome(s, 29)).toEqual([]);
  expect(HO.tickHome(s, 1)).toEqual([{ type: 'ring' }]);
  expect(HO.ringingCall(s)).toBeTruthy();
  expect(HO.pokeComputer(s).answered).toBe(true);
  expect(HO.tickHome(s, 30)).toEqual([{ type: 'ring' }]);
  HO.tickHome(s, HO.HOME.callS - 1);
  expect(s.home.lapses).toBe(0);
  expect(HO.tickHome(s, 1)).toEqual([{ type: 'missed' }]);
  expect(s.home.lapses).toBe(1);
  const sum = HO.endHome(s, 'done');
  expect(sum).toMatchObject({ calls: 2, answered: 1, lapses: 1, cleared: true });
});

test('a call that falls due during a chore rings afterwards with its full 20 s', () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  s.home.calls = [{ at: 30, state: 'pending', left: 0 }];
  HO.tickHome(s, 80, { away: true });
  expect(HO.ringingCall(s).left).toBe(HO.HOME.callS);
  expect(s.home.lapses).toBe(0);
});

test('chores cost a cup and pay XP and some paperclips once a stay, never KPI stars', () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  const sp = s.sp;
  expect(HO.startChore(s, 'dishes', NOW)).toMatchObject({ ok: true, cost: 1 });
  expect(s.coffee.value).toBe(4);
  const r = HO.completeChore(s, 'dishes', 0.9, NOW);
  const full = E.taskReward(8, 3, s.perks);
  expect(r).toMatchObject({ stars: 3, first: true, sp: Math.round(full.sp * HO.HOME.choreSpMult), xp: full.xp });
  expect(s.sp).toBe(sp + r.sp);
  expect(s.starsByFloor[8] || 0).toBe(0);
  expect(s.played.dishes).toBe(1);
  expect(HO.completeChore(s, 'dishes', 0.9, NOW)).toMatchObject({ first: false, sp: 0 });
  // A flop pays nothing and leaves it open.
  expect(HO.completeChore(s, 'bath', 0.1, NOW)).toMatchObject({ stars: 0, first: false });
  expect(HO.choreDone(s, 'bath')).toBe(false);
  s.coffee.value = 0;
  expect(HO.startChore(s, 'vacuum', NOW)).toMatchObject({ ok: false, reason: 'coffee' });
});

test('the coffee maker: free, 3 cups up to the maximum, cooldown by stars; waits for a full mug', () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  const max = S.coffeeMax(s);
  s.coffee.value = max - 2;
  expect(HO.startChore(s, 'brew', NOW)).toMatchObject({ ok: true, cost: 0 });
  expect(s.coffee.value).toBe(max - 2);
  const r = HO.completeChore(s, 'brew', 0.9, NOW);
  expect(r).toMatchObject({ brew: true, coffee: 2, cooldownS: HO.HOME.brewCooldownS[3] });
  expect(s.coffee.value).toBe(max); // never past the maximum
  expect(HO.startChore(s, 'brew', NOW + 1000)).toMatchObject({ ok: false, reason: 'cooldown' });
  expect(HO.startChore(s, 'brew', NOW + 121000)).toMatchObject({ ok: false, reason: 'full' });
  s.coffee.value = 0;
  expect(HO.startChore(s, 'brew', NOW + 121000).ok).toBe(true);
  expect(HO.completeChore(s, 'brew', 0.4, NOW + 121000)).toMatchObject({ coffee: 3, cooldownS: 240 });
  expect(HO.completeChore(s, 'brew', 0, NOW + 400000)).toMatchObject({ coffee: 0, cooldownS: 60 });
  expect(HO.HOME.brewCooldownS.slice(1)).toEqual([240, 180, 120]);
});

test("coming back clears the floor's station cooldowns, unless three lapses sent you back", () => {
  for (const [lapses, cleared] of [[0, true], [2, true], [3, false]]) {
    const s = player();
    const ids = buildFloor(8).tasks.map((it) => it.task.id);
    for (const id of ids) s.cooldowns[id] = NOW + 600000;
    s.cooldowns['f9-1'] = NOW + 600000; // another floor's station keeps its cooldown
    HO.startHome(s, 8, NOW);
    s.home.lapses = lapses;
    const sum = HO.endHome(s, 'early');
    expect(sum.cleared).toBe(cleared);
    expect(sum.result).toBe(cleared ? 'early' : 'sent_back');
    for (const id of ids) expect(!!s.cooldowns[id]).toBe(!cleared);
    expect(s.cooldowns['f9-1']).toBe(NOW + 600000);
    expect(s.home).toBeNull();
  }
});

test('the badge tallies: Domestic Hero, Always Online, Camera Ready', () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  for (const g of HO.CHORE_GAMES) HO.completeChore(s, g, 1, NOW);
  for (const c of s.home.calls) c.state = 'answered';
  HO.endHome(s, 'done');
  expect(s.stats).toMatchObject({ homeHero: 1, homeOnline: 1, homeCamera: 1 });
  // Leaving early is not a whole day online; a 2-star chore is no hero.
  const t = player();
  HO.startHome(t, 8, NOW);
  for (const g of HO.CHORE_GAMES) HO.completeChore(t, g, g === 'bath' ? 0.7 : 1, NOW);
  HO.endHome(t, 'early');
  expect(t.stats.homeHero || 0).toBe(0);
  expect(t.stats.homeOnline || 0).toBe(0);
});

test('a stay survives save and load', () => {
  const s = player();
  HO.startHome(s, 18, NOW, seq(0.3));
  HO.tickHome(s, 40);
  HO.completeChore(s, 'laundry', 0.7, NOW);
  const back = S.deserialize(S.serialize(s), NOW);
  expect(back.home).toEqual(s.home);
  expect(back.homeDays).toEqual(s.homeDays);
  expect(HO.homeActive(back, NOW + 1000)).toBe(true);
  expect(HO.homeActive(back, NOW + HO.HOME.stayS * 1000)).toBe(false);
});

test('the flat: smaller than the screen, three rooms, every chore, the computer and the door reachable', async () => {
  const fl = HO.buildHome();
  expect(fl.w * 16).toBeLessThan(480);
  expect(fl.h * 16).toBeLessThan(270 - 22);
  expect(fl.rooms.map((r) => r.type).sort()).toEqual(['bathroom', 'kitchen', 'living']);
  expect(fl.chores.map((it) => it.chore.game).sort()).toEqual(['bath', 'brew', 'dishes', 'ironing', 'laundry', 'vacuum']);
  expect(fl.npcs).toEqual([]);
  for (const it of [...fl.chores, fl.computer]) expect(isItemReachable(fl, fl.walk, fl.dist, it), it.type).toBe(true);
  const ax = Math.floor(fl.arrive.x);
  const ay = Math.floor(fl.arrive.y);
  expect(fl.walk[ay * fl.w + ax]).toBeTruthy();
  expect(fl.entrance.y).toBe(fl.h - 1);
  // Every piece of furniture in the flat (not the chores or the computer) has lines of its own, at least 20 each;
  // the fridge opens its own close-up.
  const { HOME_QUIPS } = await import('../src/data/home.js');
  const Q = await import('../src/core/curios.js');
  for (const it of fl.items) {
    if (it.chore || it.interact) continue;
    if (it.type === 'fridge') expect(Q.closeUpOf(fl, it)).toBe('fridge');
    else expect(HOME_QUIPS[it.type]?.length ?? 0, it.type).toBeGreaterThanOrEqual(20);
    expect(Q.curioOf(fl, it), it.type).toBeTruthy();
  }
  for (const k of ['sofa', 'hometv', 'houseplant', 'bookshelf', 'homebed']) {
    expect(HOME_QUIPS[k].length).toBeGreaterThanOrEqual(20);
    expect(fl.items.some((it) => it.type === k)).toBe(true);
  }
});

test("the home coffee game is 'brew' (the id 'coffee' is the office's Coffee Run); cooldown 4/3/2 minutes for 1/2/3 stars", async () => {
  const { MINIGAMES } = await import('../src/minigames/index.js');
  const { ALL_GAMES } = await import('../src/core/tasks.js');
  expect(ALL_GAMES).toContain('coffee');
  expect(MINIGAMES.coffee.name).toBe('Coffee Run');
  expect(MINIGAMES.brew.name).toBe('Home Brew');
  expect(HO.CHORES.find((c) => c.game === 'brew').title).toBe('Brew coffee');
  expect([1, 2, 3].map((st) => HO.HOME.brewCooldownS[st] / 60)).toEqual([4, 3, 2]);
});

test('pausing (the menu, a paused mini-game) holds the clocks of every timed stay; nothing else', async () => {
  const s = player();
  HO.startHome(s, 8, NOW);
  s.trip = { floor: 10, endsAt: NOW + 5000 };
  const ends = s.home.endsAt;
  S.holdClocks(s, 2500);
  expect(s.home.endsAt).toBe(ends + 2500);
  expect(s.trip.endsAt).toBe(NOW + 7500);
  expect(s.vacation).toBeNull();
});
