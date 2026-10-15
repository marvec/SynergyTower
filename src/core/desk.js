// Your desk: decorate it with paperclip-bought knick-knacks; the collection moves with you from floor to floor.
// Each floor's shop offers its own selection from DESK_DECOR (economy.js) plus that floor's Best Employee trophy.
// One item on show per slot. Purely cosmetic, a lasting use for paperclips. State: s.desk = { owned, show }. No DOM.
import * as E from './economy.js';
import { createRng } from './rng.js';

export const hasDesk = (s, floor) => floor >= 1 && floor <= s.maxFloor && (floor > 1 || s.lobby === 'done');

export const myDesk = (s) => s.desk || { owned: [], show: {} };

export const trophyId = (floor) => `trophy-${floor}`;

/** The Christmas party's Secret Santa gift for `year`: a desk decoration no shop sells. */
export const partyGiftId = (year) => `xmas-${year}`;

/** Adds a decoration to the collection (not on show); false if it was owned already. */
export function giveDecor(s, id) {
  const desk = myDesk(s);
  if (desk.owned.includes(id)) return false;
  s.desk = { ...desk, owned: [...desk.owned, id] };
  return true;
}

const ordinal = (n) => {
  const t = n % 100;
  const suf = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suf}`;
};

/** A decoration by id: a catalogue item or a floor trophy ('trophy-<floor>'); null if unknown. */
export function decorItem(id) {
  const m = /^trophy-(\d+)$/.exec(id);
  if (m) {
    const floor = +m[1];
    if (floor < 1 || floor > 40) return null;
    return { id, name: `${ordinal(floor)} Floor's Best Employee`, slot: 'right', cost: E.TROPHY_COST, needs: 'quota', floor };
  }
  return E.DESK_DECOR.find((d) => d.id === id) || null;
}

/** This floor's shop: DESK_OFFER items (some stationery, picked by the floor number), then the floor trophy. */
export function deskOffer(floor) {
  const rng = createRng(floor * 7919 + 13);
  const open = E.DESK_DECOR.filter((d) => (d.minFloor || 1) <= floor);
  const st = rng.sample(open.filter((d) => d.stationery), E.DESK_OFFER_STATIONERY);
  const rest = rng.sample(open.filter((d) => !st.includes(d)), E.DESK_OFFER - st.length);
  const picked = new Set([...st, ...rest]);
  return [...open.filter((d) => picked.has(d)), decorItem(trophyId(floor))];
}

/** A trophy is earned: it needs its floor's KPI star quota. */
export const decorUnlocked = (s, d) => d.needs !== 'quota' || (s.starsByFloor[d.floor] || 0) >= E.starQuota(d.floor);

export function buyDecor(s, floor, id) {
  const d = decorItem(id);
  if (!d) return { ok: false, reason: 'unknown' };
  if (!hasDesk(s, floor)) return { ok: false, reason: 'nodesk' };
  const desk = myDesk(s);
  if (desk.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (!deskOffer(floor).some((o) => o.id === id)) return { ok: false, reason: 'notoffered' };
  if (!decorUnlocked(s, d)) return { ok: false, reason: 'quota' };
  const cost = E.decorCost(d, floor);
  if (s.sp < cost) return { ok: false, reason: 'sp' };
  s.sp -= cost;
  s.desk = { owned: [...desk.owned, id], show: { ...desk.show, [d.slot]: id } };
  return { ok: true, cost };
}

/** Puts an owned decoration on show (replacing the one in its slot) or puts it away. */
export function toggleDecor(s, id) {
  const d = decorItem(id);
  const desk = myDesk(s);
  if (!d || !desk.owned.includes(id)) return { ok: false };
  const show = { ...desk.show };
  const shown = show[d.slot] !== id;
  if (shown) show[d.slot] = id;
  else delete show[d.slot];
  s.desk = { ...desk, show };
  return { ok: true, shown };
}

/** Saves from before the collection moved with you had one desk per floor: merge them (old 'trophy' → that floor's). */
export function mergeOldDesks(desks, maxFloor) {
  const desk = { owned: [], show: {} };
  const fix = (id, floor) => (id === 'trophy' ? trophyId(floor) : id);
  const floors = Object.keys(desks).map(Number).sort((a, b) => a - b);
  for (const f of floors) for (const id of desks[f].owned || []) if (!desk.owned.includes(fix(id, f)) && decorItem(fix(id, f))) desk.owned.push(fix(id, f));
  // What was on show on the highest decorated floor stays on show.
  const top = floors.filter((f) => f <= maxFloor && Object.values(desks[f].show || {}).some(Boolean)).pop();
  if (top) for (const [slot, id] of Object.entries(desks[top].show)) if (id && decorItem(fix(id, top))) desk.show[slot] = fix(id, top);
  return desk;
}
