// Office curiosities: furniture that reacts when poked, outside the gameplay (spec 2026-10-12-office-curiosities).
// Pure and deterministic: everything comes from the floor number and item id, nothing is saved.
import { createRng, hashString } from './rng.js';
import * as D from '../data/curios.js';

/** Items that belong to the gameplay (focus brackets, prompt) or are people, never curios. */
const isGameplay = (it) => it.task || ['elevator', 'coffee', 'hr'].includes(it.interact) || it.terminal;
const NOT_FURNITURE = new Set(['hrrep', 'receptionist']);

/** The close-up an item opens (even a station with a task, for the task card's Peek button), or null. */
export function closeUpOf(fl, it) {
  if (it.type === 'fridge') return 'fridge';
  if (it.type === 'plant') return 'plant';
  if (it.type === 'filing' && fl.rooms[it.room]?.type === 'hr') return 'files';
  return null;
}

const quipKey = (fl, it) => (it === fl.myDesk ? 'mydesk' : it.type);

/** What poking a non-gameplay item does: a close-up kind, 'quip', or null (gameplay item, or nothing to say). */
export function curioOf(fl, it) {
  if (isGameplay(it) || NOT_FURNITURE.has(it.type)) return null;
  const c = closeUpOf(fl, it);
  if (c) return c;
  return D.QUIPS[quipKey(fl, it)]?.length ? 'quip' : null;
}

export const itemSeed = (fl, it) => fl.floor * 1009 + it.id * 31 + 7;

/** The n-th thing the player says about an item (cycles; each object starts somewhere else in the list). */
export function quipFor(fl, it, n) {
  const list = D.QUIPS[quipKey(fl, it)] || [];
  if (!list.length) return '';
  return list[(itemSeed(fl, it) + n) % list.length];
}

const LABEL_COLORS = ['#e8d36a', '#f2f2f2', '#9fd3f0', '#f0a8c0', '#b8e09a'];
const BOX_COLORS = { box: ['#c94a3b', '#3b7bc9', '#e0e0e0', '#4caf50', '#d9902b'], jar: ['#c9a227', '#e8e0c8', '#b6573b'], bottle: ['#2f8f7f', '#a33b3b', '#6aa8d8'], carton: ['#f2f2f2'], cake: ['#f0c8d8'], bag: ['#c94a3b'] };

/**
 * A fridge: three door notes and 10 items on 3 shelves, one of them the ancient container that moves.
 * Items: { label, detail, shape, color, labelColor, shelf (0 top), ancient }.
 */
export function fridgeContents(seed) {
  const r = createRng(seed * 13 + 5);
  const door = r.sample(D.FRIDGE_DOOR, 3);
  const items = r.sample(D.FRIDGE_ITEMS, 9).map(([label, detail, shape], i) => ({
    label,
    detail,
    shape,
    color: r.pick(BOX_COLORS[shape]),
    labelColor: r.pick(LABEL_COLORS),
    shelf: i % 3,
    ancient: false,
  }));
  const [label, detail] = r.pick(D.FRIDGE_ANCIENT);
  // The ancient one lives at the back of the bottom shelf, where nobody looks.
  items.push({ label, detail, shape: 'box', color: '#6f8a3a', labelColor: '#d8d0a8', shelf: 2, ancient: true });
  return { door, items };
}

/** A plant: name, care tag, watering log, and maybe a worm, a lost object in the soil, or plastic leaves. */
export function plantInfo(seed) {
  const r = createRng(seed * 29 + 3);
  const name = r.pick(D.PLANT_NAMES);
  const roll = r.next();
  const plastic = roll < 0.15;
  const worm = !plastic && roll < 0.55;
  const find = !plastic && !worm && roll < 0.8 ? r.pick(D.PLANT_FINDS) : null;
  return {
    name,
    tag: r.pick(D.PLANT_TAGS).replace('{name}', name),
    log: r.pick(D.WATER_LOGS),
    plastic,
    worm,
    wormLine: r.pick(D.WORM_LINES),
    find,
    leaves: r.int(7, 11),
  };
}

// ---------------------------------------------------------------- HR personnel files
const DRAWERS = ['A-H', 'I-Q', 'R-Z'];
const surname = (name) => name.split(' ').slice(-1)[0];
/** Drawer index by surname initial; anything before I (digits, symbols) goes in the first one. */
const drawerOf = (name) => {
  const c = surname(name)[0].toUpperCase();
  return c < 'I' ? 0 : c < 'R' ? 1 : 2;
};

/** HR filing drawers for these people ({ name, role, seed, ... }): by surname, plus a MISC drawer. */
export function fileDrawers(people) {
  const sorted = [...people].sort((a, b) => surname(a.name).localeCompare(surname(b.name)) || a.name.localeCompare(b.name));
  const drawers = DRAWERS.map((label, i) => ({ label, files: sorted.filter((p) => drawerOf(p.name) === i) }));
  drawers.push({ label: 'MISC', files: D.MISC_FILES.map(([name, role, lines]) => ({ name, role, misc: lines })) });
  return drawers;
}

const SHOE_EU = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];

/**
 * A colleague's personnel file. `lines` is the printable body, the rest is there for the drawing (stamp, doodle, ring)
 * and for tests. Misc files (person.misc) keep their own lines.
 */
export function personnelFile(person, { floor = 1, year = 2026 } = {}) {
  if (person.file) return person.file; // prepared elsewhere (the player's own, see playerFile)
  const r = createRng((person.seed ?? hashString(person.name)) * 41 + 17);
  if (person.misc) {
    return { name: person.name, role: person.role, no: `${String(r.int(1, 99999)).padStart(5, '0')}-M`, lines: person.misc, doodle: r.pick(D.DOODLES), ring: { x: r.int(20, 80), y: r.int(10, 60) }, stamp: 'ARCHIVED', stars: 0 };
  }
  const [rating, stars] = r.pick(D.RATINGS);
  const since = year - (person.years ?? r.int(1, 20));
  const f = {
    name: person.name,
    role: person.role,
    no: `${String(r.int(1, 99999)).padStart(5, '0')}-${String.fromCharCode(65 + r.int(0, 25))}`,
    since,
    desk: r.pick(D.DESKS),
    coffee: r.pick(D.COFFEE_ORDERS),
    shoe: r.pick(SHOE_EU),
    rating,
    stars,
    strengths: r.sample(D.STRENGTHS, 2),
    growth: r.pick(D.GROWTH),
    notes: [person.note || r.pick(D.EXTRA_NOTES), r.pick(D.EXTRA_NOTES)].filter((n, i, a) => a.indexOf(n) === i),
    incident: r.pick(D.INCIDENTS),
    emergency: r.pick(D.EMERGENCY),
    doodle: r.pick(D.DOODLES),
    ring: { x: r.int(20, 80), y: r.int(10, 60) },
    stamp: person.fired ? 'LET GO' : r.chance(0.5) ? 'CONFIDENTIAL' : 'REVIEWED',
  };
  if (f.notes.length < 2) f.notes.push(D.EXTRA_NOTES[(D.EXTRA_NOTES.indexOf(f.notes[0]) + 1) % D.EXTRA_NOTES.length]);
  f.lines = [
    `With us since ${f.since}. Floor ${person.floor ?? floor}.`,
    `Desk: ${f.desk}`,
    `Coffee: ${f.coffee}`,
    `Shoe size: ${f.shoe} (EU)`,
    `Review FY${year}: ${f.rating}`,
    `Strengths: ${f.strengths.map((x) => x.replace(/\.$/, '')).join('; ')}`,
    `Growth area: ${f.growth}`,
    `Notes: ${f.notes.join(' ')}`,
    `Incidents: ${f.incident}`,
    `Emergency contact: ${f.emergency}`,
  ];
  if (person.fired) f.lines.push('Status: Let go by the CEO personally. Took the plant.');
  return f;
}

/** The player's own file, from their real career (the HR rep files everyone, including you). */
export function playerFile(s) {
  const st = s.stats || {};
  const played = Object.values(s.played || {}).reduce((a, b) => a + b, 0);
  const stars = Object.values(s.starsByFloor || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const name = s.player?.name || 'New Hire';
  const rating = s.maxFloor >= 40 ? 'Is the CEO. Rating themselves: excellent' : s.maxFloor >= 20 ? 'Rising star (do not tell them)' : 'Promising. Keep an eye on them.';
  const lines = [
    `Highest floor: ${s.maxFloor}. Current floor: ${s.floor}.`,
    `Tasks done: ${st.tasksPlayed || 0} (${st.perfectTasks || 0} flawless). Mini-games tried: ${Object.keys(s.played || {}).length}.`,
    `Coffee: Yes. (Machine visits: ${st.coffeeMachine || 0})`,
    `KPI stars collected: ${stars}. Paperclips hoarded: ${Math.floor(s.sp || 0)}.`,
    `Review: ${rating}`,
    `Daily stand-ups attended: ${st.standups || 0}. Badges: ${Object.keys(s.badges || {}).length}.`,
    st.fired ? `Colleagues let go: ${st.fired}. HR has noted this. Twice.` : 'Has not fired anyone. Yet.',
    played > 50 ? 'Notes: Plays every game twice. Suspiciously keen.' : 'Notes: New. Still says "good morning" to everyone.',
    'Notes: Seen opening the fridge and filing cabinets. Curious type.',
  ];
  return { name, role: 'You', you: true, no: '00001-Y', lines, doodle: 'sun', ring: { x: 60, y: 30 }, stamp: 'TOP SECRET', stars: Math.min(5, 1 + Math.floor(s.maxFloor / 8)) };
}
