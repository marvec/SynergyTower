import { test, expect } from 'bun:test';
import { createSlotStore, MAX_SLOTS, LEGACY_KEY, INDEX_KEY, slotKey } from '../src/core/slots.js';
import { newGame, serialize } from '../src/core/state.js';

/** localStorage stand-in. */
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
let ids = 0;
function store(storage, clock = { t: 1000 }) {
  return { clock, st: createSlotStore(storage, { now: () => clock.t, newId: () => `id${++ids}` }) };
}
const career = (name, maxFloor = 1) => {
  const s = newGame({ corpName: `${name} Corp`, playerName: name }, 0);
  s.maxFloor = s.floor = maxFloor;
  return s;
};

test('no saves: an empty list, room for a new career', () => {
  const { st } = store(memStorage());
  expect(st.list()).toEqual([]);
  expect(st.canCreate()).toBe(true);
});

test('careers are listed from the last played', () => {
  const { st, clock } = store(memStorage());
  const a = st.create(career('Ann'));
  clock.t = 2000;
  const b = st.create(career('Bob', 7));
  expect(st.list().map((e) => e.name)).toEqual(['Bob', 'Ann']);
  clock.t = 3000;
  st.save(a, st.load(a));
  expect(st.list().map((e) => e.id)).toEqual([a, b]);
  const bob = st.list()[1];
  expect(bob).toMatchObject({ name: 'Bob', corp: 'Bob Corp', maxFloor: 7, lastPlayed: 2000 });
});

test('careers saved in the same millisecond: the later one counts as last played', () => {
  const { st } = store(memStorage());
  st.create(career('Ann'));
  st.create(career('Bob'));
  expect(st.list().map((e) => e.name)).toEqual(['Bob', 'Ann']);
});

test('each career loads its own state only', () => {
  const { st } = store(memStorage());
  const a = st.create(career('Ann', 3));
  const b = st.create(career('Bob', 9));
  expect(st.load(a).player.name).toBe('Ann');
  expect(st.load(b).maxFloor).toBe(9);
  expect(st.load('nope')).toBeNull();
});

test('deleting a career removes its save and its entry', () => {
  const storage = memStorage();
  const { st } = store(storage);
  const a = st.create(career('Ann'));
  st.create(career('Bob'));
  st.remove(a);
  expect(st.list().map((e) => e.name)).toEqual(['Bob']);
  expect(storage.getItem(slotKey(a))).toBeNull();
});

test(`at most ${MAX_SLOTS} careers`, () => {
  const { st } = store(memStorage());
  for (let i = 0; i < MAX_SLOTS; i++) expect(st.create(career(`P${i}`))).toBeTruthy();
  expect(st.canCreate()).toBe(false);
  expect(st.create(career('One too many'))).toBeNull();
  expect(st.list().length).toBe(MAX_SLOTS);
  st.remove(st.list()[0].id);
  expect(st.canCreate()).toBe(true);
});

test('the old single save becomes the first career, once', () => {
  const old = career('Martin', 9);
  old.sp = 4638;
  const storage = memStorage({ [LEGACY_KEY]: serialize(old) });
  const { st } = store(storage);
  const list = st.list();
  expect(list.length).toBe(1);
  expect(st.load(list[0].id).sp).toBe(4638);
  expect(storage.getItem(LEGACY_KEY)).toBeNull();
  st.remove(list[0].id);
  expect(store(storage).st.list()).toEqual([]); // deleting it does not bring it back
});

test('a damaged index heals: entries without a save are dropped, a broken index starts over', () => {
  const storage = memStorage();
  const { st } = store(storage);
  const a = st.create(career('Ann'));
  storage.removeItem(slotKey(a));
  expect(st.list()).toEqual([]);
  storage.setItem(INDEX_KEY, '{not json');
  expect(store(storage).st.list()).toEqual([]);
});

test('the summary has what the picker shows', () => {
  const { st } = store(memStorage());
  const s = career('Ann', 12);
  s.level = 8;
  s.sp = 1234;
  s.starsByFloor = { 1: 3, 2: 2 };
  s.badges = { first: 1, second: 2 };
  s.player.hairStyle = 2;
  s.player.skirt = true;
  const id = st.create(s);
  expect(st.list()[0]).toMatchObject({ id, level: 8, sp: 1234, stars: 5, badges: 2, hairStyle: 2, skirt: true, floor: 12 });
});
