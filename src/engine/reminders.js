// Browser "come back" notifications, opt-in only. They fire while the game's tab is open in the background
// (a closed tab would need a push server). Deliberately sparse: long waits only, at most MAX_PER_DAY a day,
// never at night, and each kind at most once per absence.
import { upcomingReminders } from '../core/reminders.js';
import { tick } from '../core/state.js';
import { track } from './analytics.js';

const MIN_AWAY_MS = 5 * 60 * 1000; // a quick tab switch never triggers one
const MAX_PER_DAY = 3;
const QUIET_FROM = 22; // local hours [22:00, 08:00) are quiet
const QUIET_TO = 8;
const LOG_KEY = 'synergytower.reminders';

export const remindersSupported = () => typeof window !== 'undefined' && 'Notification' in window;
const permitted = () => remindersSupported() && Notification.permission === 'granted';

/** True when the player switched reminders on and the browser still allows them. */
export const remindersOn = (s) => !!s?.settings.reminders && permitted();

/** Asks for permission (call from a click). Resolves to 'on', 'denied' or 'unsupported'. */
export async function enableReminders(game) {
  if (!remindersSupported()) return 'unsupported';
  let p = Notification.permission;
  if (p === 'default') p = await Notification.requestPermission().catch(() => 'denied');
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

/** Schedules reminders whenever the tab is hidden and cancels them when the player is back. */
export function initReminders(game) {
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
