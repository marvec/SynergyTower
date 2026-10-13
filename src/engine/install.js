// "Install the app" for the website (PWA): Chrome/Edge/Android hand us an install prompt (beforeinstallprompt),
// iPhone/iPad Safari has none, so there the player gets the Share > Add to Home Screen steps instead.
// Nothing is offered in the store apps or when the game already runs installed.
import { isNative, isStandalone, isIosBrowser } from './platform.js';
import { track } from './analytics.js';

let deferred = null; // the browser's saved install prompt
let installed = false;

export function initInstall() {
  if (typeof window === 'undefined' || isNative()) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // shown from our own button instead of the browser's mini-infobar
    deferred = e;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    track('pwa_installed');
  });
}

/** 'prompt' (the browser can install it), 'ios' (show the Home Screen steps) or null (nothing to offer). */
export function installOffer() {
  if (installed || isNative() || isStandalone()) return null;
  if (deferred) return 'prompt';
  return isIosBrowser() ? 'ios' : null;
}

export const IOS_INSTALL_STEPS =
  'Play full screen and offline, straight from your Home Screen:\n' +
  '1. Tap the Share button (the square with an arrow) in Safari.\n' +
  '2. Choose "Add to Home Screen".\n' +
  'Note: iOS gives the Home Screen app its own storage, so careers started in Safari stay in Safari.';

/** Runs the browser's install prompt (call from a click). Resolves to 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null; // a prompt can only be used once
  track('pwa_prompt');
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    track('pwa_choice', { outcome });
    return outcome;
  } catch {
    return 'unavailable';
  }
}
