// Save slots: up to MAX_SLOTS careers side by side, each saved under its own key, plus a small index of summaries
// so the character picker can list them without parsing every save. Pure: works on any storage with
// getItem/setItem/removeItem (localStorage in the browser, a Map in tests, a native store in a port).
import { serialize, deserialize } from './state.js';

export const MAX_SLOTS = 100;
export const INDEX_KEY = 'synergytower.slots.v1';
/** The single save from before slots; moved into the first slot the first time the index is read. */
export const LEGACY_KEY = 'synergytower.save.v1';
export const slotKey = (id) => `synergytower.slot.${id}`;

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);

/** What the character picker shows about a career. */
export function summarize(s) {
  return {
    name: s.player.name,
    corp: s.corp.name,
    colorId: s.corp.colorId,
    skin: s.player.skin ?? 0,
    hair: s.player.hair ?? 0,
    hairStyle: s.player.hairStyle ?? 0,
    floor: s.floor,
    maxFloor: s.maxFloor,
    level: s.level,
    sp: Math.floor(s.sp || 0),
    stars: sum(s.starsByFloor),
    badges: Object.keys(s.badges || {}).length,
    createdAt: s.createdAt || 0,
  };
}

const randomId = () => Math.random().toString(36).slice(2, 10);

export function createSlotStore(storage, { now = () => Date.now(), newId = randomId } = {}) {
  const writeIndex = (entries) => storage.setItem(INDEX_KEY, JSON.stringify(entries));

  function readIndex() {
    const raw = storage.getItem(INDEX_KEY);
    if (raw == null) return migrate();
    try {
      const entries = JSON.parse(raw);
      return Array.isArray(entries) ? entries.filter((e) => e && e.id) : [];
    } catch {
      return [];
    }
  }

  /** First run with slots: the old single save (if any) becomes a career of its own. */
  function migrate() {
    const entries = [];
    const old = storage.getItem(LEGACY_KEY);
    const s = old && deserialize(old, now());
    if (s) {
      const id = newId();
      storage.setItem(slotKey(id), old);
      entries.push({ id, ...summarize(s), lastPlayed: now() });
    }
    writeIndex(entries);
    if (old) storage.removeItem(LEGACY_KEY);
    return entries;
  }

  const store = {
    /** Every career, last played first. Entries whose save went missing are dropped. */
    list() {
      const entries = readIndex();
      const alive = entries.filter((e) => storage.getItem(slotKey(e.id)) != null);
      if (alive.length !== entries.length) writeIndex(alive);
      // Saving moves an entry to the end of the index, so on a tie the later entry is the more recent one.
      return alive.reverse().sort((a, b) => b.lastPlayed - a.lastPlayed);
    },
    canCreate: () => store.list().length < MAX_SLOTS,
    load(id) {
      const raw = storage.getItem(slotKey(id));
      return raw ? deserialize(raw, now()) : null;
    },
    /** Writes the career and refreshes its summary; it becomes the last played. */
    save(id, s) {
      storage.setItem(slotKey(id), serialize(s));
      const entries = readIndex().filter((e) => e.id !== id);
      entries.push({ id, ...summarize(s), lastPlayed: now() });
      writeIndex(entries);
    },
    /** A new career's slot id, or null when all MAX_SLOTS are taken. */
    create(s) {
      if (!store.canCreate()) return null;
      const id = newId();
      store.save(id, s);
      return id;
    },
    remove(id) {
      storage.removeItem(slotKey(id));
      writeIndex(readIndex().filter((e) => e.id !== id));
    },
  };
  return store;
}
