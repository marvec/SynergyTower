// Where the game runs: a browser tab, an installed PWA, or the Capacitor app for iOS/Android (mobile/).
// The same bundle ships everywhere, so platform differences are decided here at runtime, never at build time.
// Native plugins are reached through the bridge Capacitor injects (window.Capacitor), so the web bundle has no
// npm dependency; their native halves are installed in mobile/package.json.

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

/** True inside the iOS/Android app. */
export const isNative = () => !!cap()?.isNativePlatform?.();
/** 'ios', 'android' or 'web'. */
export const os = () => (isNative() ? cap().getPlatform() : 'web');

/** An installed PWA (home-screen / desktop app window) rather than a browser tab. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone);
}

/** A phone or tablet: touch is the main input (no hover, coarse pointer). */
export function isTouch() {
  if (typeof window === 'undefined') return false;
  return isNative() || !!window.matchMedia?.('(pointer: coarse)').matches;
}

/** iPhone/iPad Safari (no install prompt there: the player adds it via Share > Add to Home Screen). */
export function isIosBrowser() {
  if (typeof navigator === 'undefined' || isNative()) return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/**
 * What this build may show. The app stores don't allow links to outside payments (the tip jar), a simulated
 * purchase screen next to their own billing, or download badges for the stores themselves.
 */
export const features = {
  get tips() {
    return !isNative();
  },
  get shop() {
    return !isNative();
  },
  get storeBadges() {
    return !isNative();
  },
  get serviceWorker() {
    return !isNative() && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  },
};

/** A native plugin proxy (e.g. 'Preferences', 'LocalNotifications'), or null in the browser / when not installed. */
export function plugin(name) {
  const c = cap();
  if (!isNative() || !c.isPluginAvailable?.(name)) return null;
  // The bridge keeps registered plugins in Capacitor.Plugins; register on first use (registering twice warns).
  return c.Plugins?.[name] || c.registerPlugin(name);
}

/** Opens an outside web page: a new tab in the browser, the in-app browser sheet in the app. */
export function openExternal(url) {
  const browser = plugin('Browser');
  if (browser) return void browser.open({ url: new URL(url, 'https://synergytower.co.uk/').href }).catch(() => {});
  window.open(url, '_blank', 'noopener');
}

// ---- saves: localStorage everywhere; the app also mirrors it to native storage (Capacitor Preferences),
// because iOS may clear a WebView's localStorage under storage pressure.
const MIRROR_PREFIX = 'synergytower.';

/**
 * The game's synchronous key-value store (getItem/setItem/removeItem, see core/slots.js). In the browser this is
 * localStorage itself; in the app every write is also sent to Preferences.
 */
export function gameStorage() {
  const prefs = plugin('Preferences');
  if (!prefs) return localStorage;
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem(k, v) {
      localStorage.setItem(k, v);
      if (k.startsWith(MIRROR_PREFIX)) prefs.set({ key: k, value: String(v) }).catch(() => {});
    },
    removeItem(k) {
      localStorage.removeItem(k);
      if (k.startsWith(MIRROR_PREFIX)) prefs.remove({ key: k }).catch(() => {});
    },
  };
}

/** App start: copies saves back from native storage when the WebView lost them. A no-op in the browser. */
export async function restoreStorage() {
  const prefs = plugin('Preferences');
  if (!prefs) return 0;
  let restored = 0;
  try {
    const { keys } = await prefs.keys();
    for (const k of keys) {
      if (!k.startsWith(MIRROR_PREFIX) || localStorage.getItem(k) !== null) continue;
      const { value } = await prefs.get({ key: k });
      if (value != null) {
        localStorage.setItem(k, value);
        restored++;
      }
    }
    // The first app start after an update from a version without the mirror: copy what is there.
    if (!keys.length)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(MIRROR_PREFIX)) await prefs.set({ key: k, value: localStorage.getItem(k) });
      }
  } catch {
    /* native storage unavailable: localStorage alone */
  }
  return restored;
}

/** Marks <html> with the platform (CSS hooks) and sets up the app shell: splash, back button. */
export function initPlatform({ onBack } = {}) {
  const root = document.documentElement;
  root.dataset.platform = os();
  if (isTouch()) root.classList.add('touch');
  if (isStandalone()) root.classList.add('standalone');
  if (!isNative()) return;
  // Status and navigation bars are hidden by the SystemBars config (mobile/capacitor.config.json).
  plugin('SplashScreen')?.hide().catch(() => {});
  // Android's back button/gesture acts like Escape (menus, close dialogs); the app never quits by accident.
  plugin('App')?.addListener('backButton', () => onBack?.());
}

/** Calls fn(active) when the app goes to the background (false) or comes back (true). Browser: page visibility. */
export function onAppState(fn) {
  const app = plugin('App');
  if (app) app.addListener('appStateChange', ({ isActive }) => fn(isActive));
  else document.addEventListener('visibilitychange', () => fn(document.visibilityState === 'visible'));
}

/** A short haptic tap on phones (stars, wrong answers). Silent where unsupported. */
export function haptic(kind = 'light') {
  const h = plugin('Haptics');
  if (h) return void h.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
}

/** The system asks for less motion (prefers-reduced-motion): no swaying views (the party's tipsy sway). */
export function reducedMotion() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
