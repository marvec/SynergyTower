// Entry point: wires screen, input, audio and the scene stack, then runs the loop.
import { createScreen } from './engine/screen.js';
import { createInput, attachInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createGame } from './game.js';
import { TitleScene } from './scenes/title.js';
import { initAnalytics } from './engine/analytics.js';
import { initReminders } from './engine/reminders.js';

// Static public files (served from public/, not bundled).
for (const [rel, href, type] of [['manifest', './manifest.webmanifest'], ['icon', './icon.svg', 'image/svg+xml']]) {
  const l = document.createElement('link');
  l.rel = rel;
  l.href = href;
  if (type) l.type = type;
  document.head.appendChild(l);
}

initAnalytics();

const canvas = document.getElementById('game');
const screen = createScreen(canvas);
const input = createInput();
attachInput(input, canvas, screen.toGame);
const audio = createAudio();
const game = createGame({ screen, input, audio });

// Browsers only allow audio after a user gesture.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  // Global hotkeys are off while a scene needs raw keys (mini-games: typing uses every letter).
  if ((e.key === 'm' || e.key === 'M') && game.state && !game.top?.capturesKeys) {
    const s = game.state.settings;
    s.music = !s.music;
    audio.setMusic(s.music);
    game.markDirty();
    game.toast(s.music ? 'Music on' : 'Music off');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') game.saveNow();
});
window.addEventListener('pagehide', () => game.saveNow());

initReminders(game);
game.set(new TitleScene(game));

let last = performance.now();
function frame(t) {
  // The first rAF timestamp can predate the performance.now() above, so clamp a negative dt to 0.
  const dt = Math.max(0, Math.min(0.05, (t - last) / 1000));
  last = t;
  input.beginFrame();
  game.update(dt);
  game.render(screen.g);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.port !== '5317') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Handy for debugging in the console. __step advances frames even when the tab is hidden (rAF paused).
window.__game = game;
window.__step = (frames = 1, dt = 1 / 30) => {
  for (let i = 0; i < frames; i++) {
    input.beginFrame();
    game.update(dt);
    game.render(screen.g);
    input.endFrame();
  }
  return game.top?.constructor.name;
};

// Dev-only helpers (src/debug.js: __trip, __vacation, __mg): the production build defines __DEV__ = false (scripts/build.js), so this
// import is dropped from the bundle and the helpers never ship. The dev server leaves __DEV__ undefined.
if (typeof __DEV__ === 'undefined' || __DEV__) import('./debug.js').then((m) => m.installDebug(game));
