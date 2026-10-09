// Entry point: wires screen, input, audio and the scene stack, then runs the loop.
import { createScreen } from './engine/screen.js';
import { createInput, attachInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createGame } from './game.js';
import { TitleScene } from './scenes/title.js';
import { MinigameScene } from './scenes/minigameScene.js';

// Static public files (served from public/, not bundled).
for (const [rel, href, type] of [['manifest', '/manifest.webmanifest'], ['icon', '/icon.svg', 'image/svg+xml']]) {
  const l = document.createElement('link');
  l.rel = rel;
  l.href = href;
  if (type) l.type = type;
  document.head.appendChild(l);
}

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

game.set(new TitleScene(game));

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  input.beginFrame();
  game.update(dt);
  game.render(screen.g);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.port !== '5317') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
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

/** Debug: launch any mini-game, e.g. __mg('spreadsheet', 0.5). Needs a loaded career. */
window.__mg = (game_id, difficulty = 0.5) => {
  game.push(new MinigameScene(game, { id: `debug-${game_id}`, game: game_id, title: `Debug: ${game_id}`, difficulty, seed: 1 }, null));
  return game_id;
};
