// Entry point: wires screen, input, audio and the scene stack, then runs the loop.
import { createScreen } from './engine/screen.js';
import { createInput, attachInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { createGame } from './game.js';
import { TitleScene } from './scenes/title.js';

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
  if ((e.key === 'm' || e.key === 'M') && game.state) {
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

if ('serviceWorker' in navigator && location.port !== '3000') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Handy for debugging in the console.
window.__game = game;
