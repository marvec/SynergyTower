// "Come back" notifications, opt-in only. Deliberately sparse: long waits only, at most MAX_PER_DAY a day,
// never at night, and each kind at most once per absence.
// Browser: they fire while the game's tab is open in the background (a closed tab would need a push server).
// App: real local notifications (Capacitor LocalNotifications), scheduled when the app goes to the background, so
// they arrive even after the app was closed; ones due at night are moved to the morning.
import { upcomingReminders } from '../core/reminders.js';
import { tick } from '../core/state.js';
import { track } from './analytics.js';
import { plugin, onAppState } from './platform.js';

const MIN_AWAY_MS = 5 * 60 * 1000; // a quick tab switch never triggers one
const MAX_PER_DAY = 3;
const QUIET_FROM = 22; // local hours [22:00, 08:00) are quiet
const QUIET_TO = 8;
const LOG_KEY = 'synergytower.reminders';

const native = () => plugin('LocalNotifications');
let nativePerm = 'prompt'; // the app's notification permission, read at start (initReminders) and after asking

export const remindersSupported = () => !!native() || (typeof window !== 'undefined' && 'Notification' in window);
const permission = () => (native() ? nativePerm : remindersSupported() ? Notification.permission : 'denied');
const permitted = () => permission() === 'granted';
/** The player (or the browser) refused notifications, so asking again would do nothing. */
export const remindersBlocked = () => permission() === 'denied';

/** True when the player switched reminders on and the browser still allows them. */
export const remindersOn = (s) => !!s?.settings.reminders && permitted();

/** Asks for permission (call from a click). Resolves to 'on', 'denied' or 'unsupported'. */
export async function enableReminders(game) {
  if (!remindersSupported()) return 'unsupported';
  let p = permission();
  if (native()) {
    if (p !== 'granted') p = nativePerm = (await native().requestPermissions().catch(() => ({ display: 'denied' }))).display;
  } else if (p === 'default') p = await Notification.requestPermission().catch(() => 'denied');
  game.state.settings.reminders = p === 'granted';
  game.markDirty();
  if (p !== 'granted') return 'denied';
  track('reminders_on');
  return 'on';
}

export function disableReminders(game) {
  game.state.settings.reminders = false;
  game.markDirty();
}

const quiet = (t) => {
  const h = new Date(t).getHours();
  return h >= QUIET_FROM || h < QUIET_TO;
};
const today = (t) => new Date(t).toDateString();

function sentToday(now) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
    return log.day === today(now) ? log.count : 0;
  } catch {
    return 0;
  }
}
function countSent(now) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify({ day: today(now), count: sentToday(now) + 1 }));
  } catch {
    /* ignore */
  }
}

async function show(r) {
  const opts = { body: r.body, tag: 'synergytower', icon: new URL('./apple-touch-icon.png', location.href).href };
  // Android Chrome only shows notifications through a service worker; the dev server has none.
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  if (reg) return reg.showNotification(r.title, opts);
  const n = new Notification(r.title, opts);
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

/** Schedules reminders whenever the tab is hidden (the app is in the background) and cancels them when the player is back. */
export function initReminders(game) {
  if (native()) return initNative(game);
  if (!remindersSupported()) return;
  let timer = 0;
  let hiddenAt = 0;
  let fired = new Set();

  const schedule = () => {
    clearTimeout(timer);
    const s = game.state;
    if (!document.hidden || !remindersOn(s)) return;
    const now = game.now();
    tick(s, now); // the game loop is paused in a hidden tab
    const next = upcomingReminders(s, now).find((r) => !fired.has(r.kind) && r.at - hiddenAt >= MIN_AWAY_MS);
    if (!next) return;
    // Background tabs throttle timers to about once a minute, which is plenty here.
    timer = setTimeout(() => fire(next), Math.max(1000, next.at - now));
  };
  const fire = async (r) => {
    fired.add(r.kind);
    const now = game.now();
    if (document.hidden && remindersOn(game.state) && !quiet(now) && sentToday(now) < MAX_PER_DAY) {
      countSent(now);
      track('reminder_sent', { kind: r.kind });
      await show(r).catch(() => {});
    }
    schedule();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = game.now();
      fired = new Set();
      schedule();
    } else clearTimeout(timer);
  });
}

// ---- the app: local notifications, scheduled ahead (the WebView doesn't run in the background)
const NATIVE_IDS = { coffee: 1, review: 2 };

/** The time a reminder may be shown: `at`, or 08:00 when `at` falls in the quiet hours. */
export function outsideQuiet(at) {
  if (!quiet(at)) return at;
  const d = new Date(at);
  if (d.getHours() >= QUIET_FROM) d.setDate(d.getDate() + 1);
  d.setHours(QUIET_TO, 0, 0, 0);
  return d.getTime();
}

function initNative(game) {
  const ln = native();
  ln.checkPermissions().then((r) => (nativePerm = r.display)).catch(() => {});
  let pending = []; // what was scheduled at the last trip to the background: [{ id, at }]
  const cancel = async () => {
    const now = game.now();
    // Not delivered yet: they don't count towards today's limit.
    for (const r of pending) if (r.at > now) uncount(r.at);
    pending = [];
    await ln.cancel({ notifications: Object.values(NATIVE_IDS).map((id) => ({ id })) }).catch(() => {});
  };
  onAppState(async (active) => {
    await cancel();
    if (active || !remindersOn(game.state)) return;
    game.saveNow();
    const s = game.state;
    const now = game.now();
    tick(s, now);
    const list = [];
    for (const r of upcomingReminders(s, now)) {
      if (r.at - now < MIN_AWAY_MS) continue;
      const at = outsideQuiet(r.at);
      if (sentToday(at) >= MAX_PER_DAY) continue;
      countSent(at);
      // isExactNotification: false: "about then" is fine, and Android would otherwise send the player to the
      // "Alarms & reminders" settings screen (the app doesn't ask for exact alarms, see AndroidManifest.xml).
      list.push({ id: NATIVE_IDS[r.kind], title: r.title, body: r.body, schedule: { at: new Date(at), allowWhileIdle: true }, isExactNotification: false });
      pending.push({ id: NATIVE_IDS[r.kind], at });
      track('reminder_sent', { kind: r.kind });
    }
    if (list.length) await ln.schedule({ notifications: list }).catch(() => {});
  });
}

function uncount(at) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
    if (log.day === today(at) && log.count > 0) localStorage.setItem(LOG_KEY, JSON.stringify({ day: log.day, count: log.count - 1 }));
  } catch {
    /* ignore */
  }
}
