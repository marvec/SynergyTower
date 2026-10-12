// Random office events: short floor-wide happenings (fire drill, printer meltdown, cake in the kitchen, surprise audit).
// Pure rules here: when one may start, which fit a floor, where things are, and what winning pays. The floor scene runs
// them (src/scenes/officeEvent.js). No DOM.
import * as E from './economy.js';
import { CORRIDOR } from './floorgen.js';

export const EVENT_KINDS = ['drill', 'printer', 'cake', 'audit'];

/** ctx: { onFloorS: seconds on this floor, busy: a floor quest or event is running }. */
export function canStartEvent(s, now, { onFloorS, busy }) {
  if (s.lobby !== 'done' || busy || onFloorS < E.EVENT_MIN_ON_FLOOR_S) return false;
  return now >= (s.events?.nextAt ?? 0);
}

export function scheduleNext(s, now, rng) {
  s.events = { ...s.events, nextAt: now + Math.round(rng.float(E.EVENT_GAP_MIN_S, E.EVENT_GAP_MAX_S)) * 1000 };
}

/** The furniture an event happens at: the printer that melts down, the table the cake lands on. */
export function eventTarget(fl, kind) {
  if (kind === 'printer') return fl.items.find((it) => it.type === 'printer') || fl.items.find((it) => it.type === 'copier') || null;
  if (kind === 'cake') return fl.items.find((it) => it.type === 'kitchentable') || fl.items.find((it) => it.type === 'counter') || null;
  return null;
}

export function availableEvents(fl) {
  const list = ['drill'];
  if (eventTarget(fl, 'printer')) list.push('printer');
  if (eventTarget(fl, 'cake')) list.push('cake');
  if (fl.tasks.length >= 3) list.push('audit');
  return list;
}

export const pickEvent = (rng, list) => rng.pick(list);

/** Fire drill assembly point: the two tiles at the corridor end farther from the player's x. */
export function fireExit(fl, px) {
  const left = px > fl.w / 2;
  const x0 = left ? 1 : fl.w - 3;
  return { side: left ? 'left' : 'right', x0, x1: x0 + 1, y0: CORRIDOR.y0, y1: CORRIDOR.y1 };
}

export const inExit = (ex, x, y) => x >= ex.x0 && x < ex.x1 + 1 && y >= ex.y0 && y < ex.y1 + 1;

/** What winning an event pays on this floor: { sp, xp, coffee }. */
export function eventReward(kind, floor, perks = {}) {
  if (kind === 'cake') return { sp: 0, xp: 0, coffee: E.EVENT_CAKE_COFFEE };
  if (kind === 'audit') return { sp: 0, xp: E.taskReward(floor, 2, perks).xp, coffee: 0 };
  const r = E.taskReward(floor, 1, perks);
  return { sp: r.sp, xp: r.xp, coffee: 0 };
}

/** Applies a finished event: a win pays and counts in stats.events[kind]. Returns the reward, or null for a loss. */
export function applyEventResult(s, kind, won, floor) {
  if (!won) return null;
  const r = eventReward(kind, floor, s.perks);
  s.sp += r.sp;
  s.coffee.value += r.coffee; // the cake may top the pot over
  const lv = E.addXp(s.level, s.xp, r.xp);
  s.level = lv.level;
  s.xp = lv.xp;
  s.so += lv.levelsGained;
  s.stats.events = { ...s.stats.events, [kind]: (s.stats.events?.[kind] || 0) + 1 };
  return { ...r, levelsGained: lv.levelsGained };
}
