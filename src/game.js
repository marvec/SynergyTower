// Game context shared by all scenes: state, persistence, audio, input and the scene stack.
import * as S from './core/state.js';
import { CORP_COLORS, SKIN_TONES, HAIR_COLORS } from './data/corpColors.js';
import { setAccent, C, panel } from './engine/ui.js';
import { drawText } from './engine/font.js';
import { W } from './engine/screen.js';

const SAVE_KEY = 'synergytower.save.v1';

export function createGame({ screen, input, audio }) {
  const stack = [];
  let toasts = [];
  let saveTimer = 0;
  let dirty = false;

  const game = {
    screen,
    input,
    audio,
    state: null,
    now: () => Date.now(),
    time: 0,

    // ---- persistence
    hasSave() {
      try {
        return !!localStorage.getItem(SAVE_KEY);
      } catch {
        return false;
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const s = S.deserialize(raw, game.now());
        if (!s) return false;
        game.setState(s);
        return true;
      } catch {
        return false;
      }
    },
    setState(s) {
      game.state = s;
      setAccent(game.corpColor());
      audio.setMusic(s.settings.music);
      audio.setSfx(s.settings.sfx);
      S.tick(s, game.now());
      game.markDirty();
    },
    markDirty() {
      dirty = true;
    },
    saveNow() {
      if (!game.state) return;
      try {
        localStorage.setItem(SAVE_KEY, S.serialize(game.state));
        dirty = false;
      } catch {
        /* storage full or blocked: keep playing */
      }
    },
    wipeSave() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        /* ignore */
      }
      game.state = null;
    },

    // ---- helpers
    corpColor() {
      const id = game.state?.corp.colorId;
      return CORP_COLORS.find((c) => c.id === id) || CORP_COLORS[0];
    },
    playerLook() {
      const s = game.state;
      const col = game.corpColor();
      const f = s.maxFloor;
      return {
        skin: SKIN_TONES[s.player.skin] || SKIN_TONES[0],
        hair: HAIR_COLORS[s.player.hair] || HAIR_COLORS[0],
        hairStyle: s.player.hairStyle ?? 0,
        shirt: f >= 16 ? '#f4f1e8' : '#dfe6ee',
        jacket: f >= 21 ? col.dark : null,
        pants: f >= 36 ? '#1a1a22' : '#3a3f55',
        tie: f >= 6 ? col.color : null,
        shoes: '#2a1d14',
        badge: true,
        glasses: false,
      };
    },
    sfx(name) {
      audio.sfx(name);
    },
    toast(text, color = C.text) {
      toasts.push({ text, color, t: 0 });
      if (toasts.length > 4) toasts.shift();
    },

    // ---- scene stack
    get top() {
      return stack[stack.length - 1];
    },
    push(scene) {
      stack.push(scene);
      scene.enter?.();
      input.consumeKeys();
      input.consumeClick();
    },
    pop() {
      const s = stack.pop();
      s?.exit?.();
      game.top?.resume?.();
      input.consumeKeys();
      input.consumeClick();
      return s;
    },
    /** Replace the whole stack with one scene. */
    set(scene) {
      while (stack.length) stack.pop().exit?.();
      game.push(scene);
    },

    update(dt) {
      game.time += dt;
      if (game.state) S.tick(game.state, game.now());
      game.top?.update(dt);
      toasts.forEach((t) => (t.t += dt));
      toasts = toasts.filter((t) => t.t < 3);
      saveTimer += dt;
      if (dirty && saveTimer > 2) {
        saveTimer = 0;
        game.saveNow();
      }
    },
    render(g) {
      let from = 0;
      for (let i = stack.length - 1; i >= 0; i--)
        if (stack[i].opaque !== false) {
          from = i;
          break;
        }
      for (let i = from; i < stack.length; i++) stack[i].render(g);
      toasts.forEach((t, i) => {
        const a = Math.min(1, (3 - t.t) * 2);
        g.globalAlpha = a;
        const w = Math.min(300, t.text.length * 5 + 16);
        panel(g, W / 2 - w / 2, 22 + i * 16, w, 14, { fill: C.panelDark });
        drawText(g, t.text, W / 2, 25 + i * 16, { align: 'center', color: t.color });
        g.globalAlpha = 1;
      });
    },
  };
  return game;
}
