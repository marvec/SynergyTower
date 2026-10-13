// The browser/app split (src/engine/platform.js): what each build shows, save mirroring in the app, and the small
// pure helpers behind the phone polish (touch slop, quiet-hours reminders, the on-screen keyboard's diffing).
import { test, expect, afterEach } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const P = await import('../src/engine/platform.js');
const { nearestWithin } = await import('../src/engine/ui.js');
const { outsideQuiet } = await import('../src/engine/reminders.js');
const { createInput } = await import('../src/engine/input.js');

const memStore = () => {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
};

/** A fake Capacitor bridge with the given native plugins. */
function installApp(platform, plugins) {
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      isPluginAvailable: (n) => n in plugins,
      Plugins: plugins,
    },
  };
}
const saved = { window: globalThis.window, localStorage: globalThis.localStorage };
afterEach(() => {
  globalThis.window = saved.window;
  globalThis.localStorage = saved.localStorage;
});

test('the website shows everything; the store apps hide the tip jar, the demo checkout and the store badges', () => {
  expect(P.isNative()).toBe(false);
  expect(P.os()).toBe('web');
  expect([P.features.tips, P.features.shop, P.features.storeBadges]).toEqual([true, true, true]);
  expect(P.plugin('Preferences')).toBeNull();

  installApp('android', {});
  expect(P.isNative()).toBe(true);
  expect(P.os()).toBe('android');
  expect([P.features.tips, P.features.shop, P.features.storeBadges, P.features.serviceWorker]).toEqual([false, false, false, false]);
  expect(P.isTouch()).toBe(true);
});

test('in the app, saves are mirrored to native storage and restored when the WebView lost them', async () => {
  const native = new Map();
  const Preferences = {
    set: async ({ key, value }) => void native.set(key, value),
    get: async ({ key }) => ({ value: native.get(key) ?? null }),
    remove: async ({ key }) => void native.delete(key),
    keys: async () => ({ keys: [...native.keys()] }),
  };
  globalThis.localStorage = memStore();
  installApp('ios', { Preferences });

  const st = P.gameStorage();
  st.setItem('synergytower.slot.abc', '{"a":1}');
  st.setItem('other.key', 'x'); // not the game's: not mirrored
  await Promise.resolve();
  expect(native.get('synergytower.slot.abc')).toBe('{"a":1}');
  expect(native.has('other.key')).toBe(false);

  // iOS cleared the WebView's storage: the next start brings the career back.
  globalThis.localStorage = memStore();
  expect(await P.restoreStorage()).toBe(1);
  expect(localStorage.getItem('synergytower.slot.abc')).toBe('{"a":1}');

  st.removeItem('synergytower.slot.abc');
  await Promise.resolve();
  expect(native.has('synergytower.slot.abc')).toBe(false);
});

test('the first app start copies existing saves into native storage', async () => {
  const native = new Map();
  const Preferences = { set: async ({ key, value }) => void native.set(key, value), keys: async () => ({ keys: [] }) };
  globalThis.localStorage = memStore();
  localStorage.setItem('synergytower.slots.v1', '[]');
  installApp('android', { Preferences });
  await P.restoreStorage();
  expect(native.get('synergytower.slots.v1')).toBe('[]');
});

test('the browser keeps plain localStorage and restoring is a no-op', async () => {
  globalThis.localStorage = memStore();
  expect(P.gameStorage()).toBe(localStorage);
  expect(await P.restoreStorage()).toBe(0);
});

test('a tap just beside a button still hits it; farther away hits nothing', () => {
  const items = [
    { x: 10, y: 10, w: 20, h: 10 },
    { x: 40, y: 10, w: 20, h: 10 },
  ];
  expect(nearestWithin(items, { x: 33, y: 15 }, 6)).toBe(0); // 3 px right of the first, 7 px left of the second
  expect(nearestWithin(items, { x: 37, y: 15 }, 6)).toBe(1);
  expect(nearestWithin(items, { x: 35, y: 40 }, 6)).toBe(-1);
});

test('app reminders due at night move to 08:00', () => {
  const at = (d, h, m = 0) => new Date(2026, 9, d, h, m).getTime();
  expect(outsideQuiet(at(13, 15))).toBe(at(13, 15));
  expect(outsideQuiet(at(13, 23, 30))).toBe(at(14, 8));
  expect(outsideQuiet(at(14, 3))).toBe(at(14, 8));
  expect(outsideQuiet(at(14, 8))).toBe(at(14, 8));
});

test('the on-screen keyboard turns field edits into key presses (typing, autocorrect, Backspace, Enter)', async () => {
  const listeners = {};
  const el = {
    style: {},
    value: '',
    setAttribute() {},
    addEventListener: (t, fn) => (listeners[t] = fn),
    remove() {},
    blur() {},
  };
  globalThis.document = { ...globalThis.document, createElement: () => el, body: { appendChild() {} }, activeElement: null };
  const { SoftKeyboard } = await import('../src/engine/softKeyboard.js');
  const input = createInput();
  const screen = { toClient: () => ({ left: 0, top: 0, width: 100, height: 50 }) };
  const kb = new SoftKeyboard(screen, input, { x: 0, y: 0, w: 10, h: 10 });
  const type = (v) => {
    el.value = el.value.slice(0, 1) + v; // the field keeps its invisible first character
    listeners.input();
  };
  type('ls');
  expect(input.keySeq()).toEqual(['l', 's']);
  input.endFrame();
  type('la'); // a phone keyboard rewrote the word: one Backspace, then the new letter
  expect(input.keySeq()).toEqual(['Backspace', 'a']);
  input.endFrame();
  el.value = ''; // Backspace on an empty command line deletes the hidden character
  listeners.input();
  expect(input.keySeq()).toEqual(['Backspace', 'Backspace', 'Backspace']);
  input.endFrame();
  listeners.keydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
  expect(input.keySeq()).toEqual(['Enter']);
  kb.destroy();
});

test('the portrait dock lists every HUD stat with the StatsDialog tab it opens', async () => {
  const { dockStats } = await import('../src/scenes/portraitDock.js');
  const { newGame } = await import('../src/core/state.js');
  const s = newGame({ playerName: 'Pat' }, 0);
  const rows = dockStats(s, 0);
  expect(rows.map((r) => r[0])).toEqual(['sp', 'stars', 'coffee', 'level', 'so', 'games']);
  expect(rows.find((r) => r[0] === 'stars')[2]).toMatch(/^0\/\d+$/);
});
