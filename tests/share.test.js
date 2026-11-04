// Sharing a result (src/engine/share.js): the app's share sheet, Web Share on phones, the clipboard, then a box.
import { test, expect, afterEach } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
installMockDocument();
const { shareText, shareBoxOpen } = await import('../src/engine/share.js');

const TEXT = 'SynergyTower Memo #212 · Spreadsheet\n★★☆ 0.78\nsynergytower.co.uk';
const saved = { window: globalThis.window, navigator: globalThis.navigator, document: globalThis.document };
const setNavigator = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
afterEach(() => {
  globalThis.window = saved.window;
  setNavigator(saved.navigator);
  globalThis.document = saved.document;
});

/** A game that records toasts. */
const fakeGame = () => ({ toasts: [], toast(t) { this.toasts.push(t); } });
/** A phone (coarse pointer) or a desktop browser. */
const browser = (touch) => (globalThis.window = { matchMedia: (q) => ({ matches: touch && q.includes('coarse') }) });
/** The app with a native Share plugin. */
const app = (Share) =>
  (globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: (n) => n === 'Share', Plugins: { Share } } });
/** A DOM just big enough for the share box. */
function fakeDom() {
  const body = { kids: [], appendChild: (c) => body.kids.push(c) };
  const make = (tag) => {
    const e = { tag, kids: [], listeners: {}, appendChild: (c) => e.kids.push(c), addEventListener: (k, f) => (e.listeners[k] = f), focus() {}, select: () => (e.selected = true) };
    e.remove = () => body.kids.splice(body.kids.indexOf(e), 1);
    return e;
  };
  globalThis.document = { body, createElement: make };
  return body;
}
const find = (e, tag) => (e.tag === tag ? e : e.kids.map((k) => find(k, tag)).find(Boolean));
const clipboard = (log, fail = false) => ({ writeText: async (t) => (fail ? Promise.reject(new Error('denied')) : void log.push(['clip', t])) });

test('in the app the native share sheet gets the text', async () => {
  const got = [];
  app({ share: async (o) => void got.push(o.text) });
  setNavigator({});
  expect(await shareText(fakeGame(), TEXT)).toBe('native');
  expect(got).toEqual([TEXT]);
});

test('a cancelled native sheet stops there: no toast, no clipboard', async () => {
  const log = [];
  app({ share: async () => Promise.reject(new Error('Share canceled')) });
  setNavigator({ clipboard: clipboard(log) });
  const game = fakeGame();
  expect(await shareText(game, TEXT)).toBe('cancelled');
  expect(log).toEqual([]);
  expect(game.toasts).toEqual([]);
});

test('a phone browser uses Web Share', async () => {
  const log = [];
  browser(true);
  setNavigator({ share: async (o) => void log.push(['share', o.text]), clipboard: clipboard(log) });
  expect(await shareText(fakeGame(), TEXT)).toBe('share');
  expect(log).toEqual([['share', TEXT]]);
});

test('closing the Web Share sheet is a cancel: no toast, no clipboard', async () => {
  const log = [];
  browser(true);
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  setNavigator({ share: async () => Promise.reject(abort), clipboard: clipboard(log) });
  const game = fakeGame();
  expect(await shareText(game, TEXT)).toBe('cancelled');
  expect(log).toEqual([]);
  expect(game.toasts).toEqual([]);
});

test('a failing Web Share falls back to the clipboard', async () => {
  const log = [];
  browser(true);
  setNavigator({ share: async () => Promise.reject(new Error('NotAllowedError')), clipboard: clipboard(log) });
  const game = fakeGame();
  expect(await shareText(game, TEXT)).toBe('clipboard');
  expect(log).toEqual([['clip', TEXT]]);
  expect(game.toasts.length).toBe(1);
});

test('a desktop browser copies, even when it has Web Share', async () => {
  const log = [];
  browser(false);
  setNavigator({ share: async () => void log.push(['share']), clipboard: clipboard(log) });
  const game = fakeGame();
  expect(await shareText(game, TEXT)).toBe('clipboard');
  expect(log).toEqual([['clip', TEXT]]);
  expect(game.toasts.length).toBe(1);
});

test('with nothing else, or a refused clipboard, a box shows the exact text selected', async () => {
  for (const nav of [{}, { clipboard: clipboard([], true) }]) {
    const body = fakeDom();
    browser(false);
    setNavigator(nav);
    const game = fakeGame();
    expect(await shareText(game, TEXT)).toBe('dialog');
    expect(game.toasts).toEqual([]);
    const area = find(body.kids[0], 'textarea');
    expect(area.value).toBe(TEXT);
    expect(area.readOnly).toBe(true);
    expect(area.selected).toBe(true);
    expect(shareBoxOpen()).toBe(true);
    body.kids[0].listeners.keydown({ key: 'Escape', stopPropagation() {} });
    expect(body.kids.length).toBe(0);
    expect(shareBoxOpen()).toBe(false);
  }
});
