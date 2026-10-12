// Business trip (spec 2026-10-12-business-trip): on floors 10 and 30 a colleague offers a drive to a client, once.
// Pure: the drive itself is core/drive.js, the client's office core/clientFloor.js.
import * as E from './economy.js';
import { completeTask, useCoffeeMachine } from './state.js';

export const isTripFloor = (floor) => E.TRIP_FLOORS.includes(floor);

/** 'none' (no trip on this floor) | 'available' | 'missed' (crashed, late or turned back) | 'done' (reached the client). */
export function tripStatus(s, floor) {
  if (!isTripFloor(floor)) return 'none';
  return s.trips?.[floor] || 'available';
}

/** The car leaves: from now on the chance is used up, unless the drive ends at the client (arriveTrip). */
export function departTrip(s, floor) {
  if (tripStatus(s, floor) !== 'available') return { ok: false };
  s.trips = { ...s.trips, [floor]: 'missed' };
  return { ok: true };
}

/** Made it: the visit starts, with a wall-clock limit. */
export function arriveTrip(s, floor, now) {
  s.trips = { ...s.trips, [floor]: 'done' };
  s.trip = { floor, endsAt: now + E.TRIP_VISIT_S * 1000, sp: 0, tasks: 0 };
  return s.trip;
}

export const tripLeft = (s, now) => (s.trip ? Math.max(0, s.trip.endsAt - now) : 0);
export const tripActive = (s, now) => tripLeft(s, now) > 0;

/** The visit is over (time up or left early): returns its summary { floor, sp, tasks }. */
export function endTrip(s) {
  const t = s.trip;
  s.trip = null;
  return t ? { floor: t.floor, sp: t.sp, tasks: t.tasks } : null;
}

/** A task in the client's office: double paperclips, no KPI stars; tallied for the wrap-up. */
export function completeTripTask(s, task, score, now, rng = Math.random) {
  const floor = s.trip?.floor ?? s.floor;
  const r = completeTask(s, task, floor, score, now, rng, { spMult: E.TRIP_SP_MULT, kpi: false });
  if (s.trip) {
    s.trip.sp += r.sp;
    s.trip.tasks++;
  }
  return r;
}

export const BREWER_KEY = 'coffee-machine-trip';

/** The client's coffee brewers (they share one pot): the usual cups, ready again after TRIP_BREWER_S. */
export const useBrewer = (s, now) => useCoffeeMachine(s, s.trip?.floor ?? s.floor, now, { key: BREWER_KEY, cooldownS: E.TRIP_BREWER_S });
