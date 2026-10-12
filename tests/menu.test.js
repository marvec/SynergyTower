import { test, expect } from 'bun:test';
import { installMockDocument } from './mock-canvas.js';
import { newGame } from '../src/core/state.js';
installMockDocument();
const { createInput } = await import('../src/engine/input.js');
const { PauseMenu } = await import('../src/scenes/overlays.js');

function fakeGame() {
  const stack = [];
  return {
    input: createInput(),
    state: newGame({}, 0),
    audio: { setMusic() {}, setSfx() {} },
    sfx: () => {},
    markDirty: () => {},
    push: (s) => stack.push(s),
    pop: () => stack.pop(),
    get top() {
      return stack[stack.length - 1];
    },
    stack,
  };
}
const labels = (m) => m.buttons.items.map((b) => b.label);

test('the menu keeps audio switches in a Settings submenu and has no badge wall', () => {
  const game = fakeGame();
  const menu = new PauseMenu(game, { onQuit: () => {} });
  game.push(menu);
  menu.build();
  const l = labels(menu);
  expect(l).toContain('Settings');
  expect(l.some((x) => /Music|Sound effects|Reminders|Badge wall/.test(x))).toBe(false);
  for (const b of menu.buttons.items) expect(b.y + b.h).toBeLessThanOrEqual(menu.y + menu.h - 4);

  menu.buttons.items.find((b) => b.label === 'Settings').onClick();
  const settings = game.top;
  expect(settings).not.toBe(menu);
  settings.build();
  expect(labels(settings)).toEqual(expect.arrayContaining(['Music: ON', 'Sound effects: ON', 'Back']));
  settings.buttons.items.find((b) => b.label.startsWith('Music')).onClick();
  expect(game.state.settings.music).toBe(false);
  settings.build();
  expect(labels(settings)).toContain('Music: OFF');
  for (const b of settings.buttons.items) expect(b.y + b.h).toBeLessThanOrEqual(settings.y + settings.h - 4);
  settings.buttons.items.find((b) => b.label === 'Back').onClick();
  expect(game.top).toBe(menu);
});
