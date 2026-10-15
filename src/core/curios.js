// Office curiosities: furniture that reacts when poked, outside the gameplay (spec 2026-10-12-office-curiosities).
// Pure and deterministic: everything comes from the floor number and item id, nothing is saved.
import { createRng, hashString } from './rng.js';
import * as D from '../data/curios.js';
import { HOTEL_QUIPS } from '../data/vacation.js';
import { PARTY_QUIPS } from '../data/party.js';
import { HOME_QUIPS, HOME_FRIDGE } from '../data/home.js';

/** Items that belong to the gameplay (focus brackets, prompt) or are people, never curios. */
const isGameplay = (it) => it.task || it.activity || it.chore || ['elevator', 'coffee', 'hr', 'computer', 'bar'].includes(it.interact) || it.terminal;
const NOT_FURNITURE = new Set(['hrrep', 'receptionist']);
/** The hotel's reception desk is the concierge's (HotelScene talks), not a curio. */
const HOTEL_PEOPLE = new Set(['reception']);

/** The close-up an item opens (even a station with a task, for the task card's Peek button), or null. */
export function closeUpOf(fl, it) {
  if (it.type === 'fridge') return 'fridge';
  if (it.type === 'plant') return 'plant';
  if (it.type === 'vending') return 'vending';
  if (it.type === 'filing' && fl.rooms[it.room]?.type === 'hr') return 'files';
  return null;
}

const quipKey = (fl, it) => (it === fl.myDesk ? 'mydesk' : it.type);
/** The lines for an item: the vacation hotel and your flat have their own (a sofa there is not the meeting-room sofa). */
const quipsOf = (fl, it) => (fl.party ? PARTY_QUIPS[it.type === 'chairup' ? 'chair' : it.type] : fl.hotel ? HOTEL_QUIPS[it.type === 'chairup' ? 'chair' : it.type] : fl.home ? HOME_QUIPS[it.type] : D.QUIPS[quipKey(fl, it)]) || [];

/** What poking a non-gameplay item does: a close-up kind, 'quip', or null (gameplay item, or nothing to say). */
export function curioOf(fl, it) {
  if (isGameplay(it) || NOT_FURNITURE.has(it.type) || (fl.hotel && HOTEL_PEOPLE.has(it.type))) return null;
  const c = closeUpOf(fl, it);
  if (c) return c;
  return quipsOf(fl, it).length ? 'quip' : null;
}

export const itemSeed = (fl, it) => fl.floor * 1009 + it.id * 31 + 7;

/**
 * A random line from a list, shuffle-bag style: every line once before any repeats, and never the same line twice in
 * a row. `memo` ({}) is kept by the caller, one per object.
 */
export function pickLine(list, memo = {}, rand = Math.random) {
  if (!list.length) return '';
  if (!memo.bag?.length || memo.n !== list.length) {
    const bag = list.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // The bag is used from the end; across refills the first line must not repeat the last one said.
    if (bag.length > 1 && bag[bag.length - 1] === memo.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    memo.bag = bag;
    memo.n = list.length;
  }
  memo.last = memo.bag.pop();
  return list[memo.last];
}

/** Something the player says about an item, at random (see pickLine; `memo` is per item). */
export const quipFor = (fl, it, memo, rand) => pickLine(quipsOf(fl, it), memo, rand);

const LABEL_COLORS = ['#e8d36a', '#f2f2f2', '#9fd3f0', '#f0a8c0', '#b8e09a'];
const BOX_COLORS = { box: ['#c94a3b', '#3b7bc9', '#e0e0e0', '#4caf50', '#d9902b'], jar: ['#c9a227', '#e8e0c8', '#b6573b'], bottle: ['#2f8f7f', '#a33b3b', '#6aa8d8'], carton: ['#f2f2f2'], cake: ['#f0c8d8'], bag: ['#c94a3b'] };

/**
 * A fridge: three door notes and 10 items on 3 shelves, one of them the ancient container that moves.
 * Items: { label, detail, shape, color, labelColor, shelf (0 top), ancient }.
 */
export function fridgeContents(seed, home = false) {
  const src = home ? HOME_FRIDGE : { door: D.FRIDGE_DOOR, items: D.FRIDGE_ITEMS, ancient: D.FRIDGE_ANCIENT };
  const r = createRng(seed * 13 + 5);
  const door = r.sample(src.door, 3);
  const items = r.sample(src.items, 9).map(([label, detail, shape], i) => ({
    label,
    detail,
    shape,
    color: r.pick(BOX_COLORS[shape]),
    labelColor: r.pick(LABEL_COLORS),
    shelf: i % 3,
    ancient: false,
  }));
  const [label, detail] = r.pick(src.ancient);
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

// ---------------------------------------------------------------- vending machine
const VEND_ROWS = ['A', 'B', 'C', 'D'];
const MONUMENT_AT = 6; // B3, as the quips say

/**
 * A vending machine: 16 slots A1-D4 { code, name, eat, price, shape, color, soldOut, monument }. One or two are sold
 * out (the first one is always Inspiration), and B3 holds the crisp packet that has been stuck there for years.
 */
export function vendingContents(seed) {
  const r = createRng(seed * 17 + 11);
  const pool = D.VENDING_ITEMS.filter(([name]) => name !== 'Inspiration');
  const picked = r.sample(pool, 15);
  const slots = [];
  for (let i = 0; i < 16; i++) {
    const code = VEND_ROWS[Math.floor(i / 4)] + ((i % 4) + 1);
    if (i === MONUMENT_AT) {
      const [name, eat] = D.VENDING_MONUMENT;
      slots.push({ code, name, eat, price: '--', shape: 'bag', color: '#c94a3b', soldOut: false, monument: true });
      continue;
    }
    const [name, eat, price, shape, color] = picked.pop();
    slots.push({ code, name, eat, price, shape, color, soldOut: false, monument: false });
  }
  const open = slots.filter((s) => !s.monument);
  const sold = r.sample(open, r.int(1, 2));
  sold.forEach((s, i) => {
    s.soldOut = true;
    if (i === 0) [s.name, s.eat, s.price, s.shape, s.color] = D.VENDING_ITEMS.find(([n]) => n === 'Inspiration');
  });
  return { slots };
}

/** What a purchase does, from a roll in [0, 1): mostly it drops, often it gets stuck, now and then something odd. */
export const vendOutcome = (roll) => (roll < 0.55 ? 'drop' : roll < 0.85 ? 'stuck' : roll < 0.95 ? 'wrong' : 'refund');
