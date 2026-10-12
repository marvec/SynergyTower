// Your desk on every floor you have reached: decorate it with paperclip-bought knick-knacks (DESK_DECOR in economy.js),
// one on show per slot. Purely cosmetic, a lasting use for paperclips. State: s.desks[floor] = { owned, show }. No DOM.
import * as E from './economy.js';

export const hasDesk = (s, floor) => floor >= 1 && floor <= s.maxFloor && (floor > 1 || s.lobby === 'done');

export const deskOf = (s, floor) => s.desks?.[floor] || { owned: [], show: {} };

const decor = (id) => E.DESK_DECOR.find((d) => d.id === id);

/** The trophy is earned: it needs the floor's KPI star quota. */
export const decorUnlocked = (s, floor, d) => d.needs !== 'quota' || (s.starsByFloor[floor] || 0) >= E.starQuota(floor);

export function buyDecor(s, floor, id) {
  const d = decor(id);
  if (!d) return { ok: false, reason: 'unknown' };
  if (!hasDesk(s, floor)) return { ok: false, reason: 'nodesk' };
  const desk = deskOf(s, floor);
  if (desk.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (!decorUnlocked(s, floor, d)) return { ok: false, reason: 'quota' };
  const cost = E.decorCost(d, floor);
  if (s.sp < cost) return { ok: false, reason: 'sp' };
  s.sp -= cost;
  s.desks = { ...s.desks, [floor]: { owned: [...desk.owned, id], show: { ...desk.show, [d.slot]: id } } };
  return { ok: true, cost };
}

/** Puts an owned decoration on show (replacing the one in its slot) or puts it away. */
export function toggleDecor(s, floor, id) {
  const d = decor(id);
  const desk = deskOf(s, floor);
  if (!d || !desk.owned.includes(id)) return { ok: false };
  const show = { ...desk.show };
  const shown = show[d.slot] !== id;
  if (shown) show[d.slot] = id;
  else delete show[d.slot];
  s.desks = { ...s.desks, [floor]: { ...desk, show } };
  return { ok: true, shown };
}
