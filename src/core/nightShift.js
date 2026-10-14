// Night shift (spec 2026-10-14-night-shift): on floors 5, 15, 25 and 35 the manager offers a 10-minute shift once a day.
// The office empties and goes dark; station cooldowns are halved and the floor's coffee machine brews every 2 minutes.
// Pure, no DOM: the floor scene (scenes/floorScene.js) runs the walk-out, the darkness and the ending.
import * as E from './economy.js';
import { dayKey } from './daily.js';
import { onHold } from './conduct.js';
import { completeTask, useCoffeeMachine } from './state.js';
import { buildFloor } from './tasks.js';

export const isNightFloor = (floor) => E.NIGHT_FLOORS.includes(floor);

/** The night machine's cooldown key: separate from the day machine's, so a 15-minute day cooldown never blocks it. */
export const BREWER_KEY = 'coffee-machine-night';

/**
 * 'none' (not a night floor) | 'on' (a shift is under way) | 'blocked' (hold, trip, holiday, no badge yet) |
 * 'today' (today's shift is used up) | 'available'.
 */
export function nightStatus(s, floor, now) {
  if (!isNightFloor(floor)) return 'none';
  if (s.nightShift) return 'on';
  if (onHold(s) || s.trip || s.vacation || s.lobby !== 'done') return 'blocked';
  return s.nightShifts?.day === dayKey(now) ? 'today' : 'available';
}

/** Starts the shift: the cooldowns already running on this floor are halved and the night machine is ready at once. */
export function startNightShift(s, floor, now) {
  const st = nightStatus(s, floor, now);
  if (st !== 'available') return { ok: false, reason: st };
  s.nightShifts = { day: dayKey(now), count: (s.nightShifts?.count || 0) + 1 };
  s.nightShift = { floor, endsAt: now + E.NIGHT_SHIFT_S * 1000, tasks: 0, sp: 0, stars: 0, coffee: 0 };
  for (const it of buildFloor(floor).tasks) {
    const id = it.task.id;
    if (s.cooldowns[id] > now) s.cooldowns[id] = now + Math.round((s.cooldowns[id] - now) * E.NIGHT_COOLDOWN_MULT);
  }
  delete s.cooldowns[BREWER_KEY];
  return { ok: true };
}

export const nightLeft = (s, now) => (s.nightShift ? Math.max(0, s.nightShift.endsAt - now) : 0);
export const nightActive = (s, now) => nightLeft(s, now) > 0;

/** A task done at night: the usual pay and KPI stars, half the cooldown; tallied for the summary. */
export function completeNightTask(s, task, score, now, rng = Math.random) {
  const floor = s.nightShift?.floor ?? s.floor;
  const r = completeTask(s, task, floor, score, now, rng, { cooldownMult: E.NIGHT_COOLDOWN_MULT });
  if (s.nightShift) {
    s.nightShift.tasks++;
    s.nightShift.sp += r.sp;
    s.nightShift.stars += r.stars;
  }
  return r;
}

/** The floor's coffee machine at night: the usual cups, ready again after NIGHT_BREWER_S. */
export function useNightBrewer(s, now) {
  const r = useCoffeeMachine(s, s.nightShift?.floor ?? s.floor, now, { key: BREWER_KEY, cooldownS: E.NIGHT_BREWER_S });
  if (r.ok && s.nightShift) s.nightShift.coffee += r.gained;
  return r;
}

/** The shift is over (time up or gone home early): returns its summary { floor, tasks, sp, stars, coffee }. */
export function endNightShift(s) {
  const n = s.nightShift;
  s.nightShift = null;
  return n ? { floor: n.floor, tasks: n.tasks, sp: n.sp, stars: n.stars, coffee: n.coffee } : null;
}

/** Debugging (window.__night): today's shift is on offer again; a shift under way is dropped. */
export function resetNight(s) {
  s.nightShift = null;
  s.nightShifts = { ...s.nightShifts, day: null };
}
