// Game context shared by all scenes: state, persistence, audio, input and the scene stack.
import * as S from './core/state.js';
import { createSlotStore } from './core/slots.js';
import { checkBadges } from './core/achievements.js';
import { track } from './engine/analytics.js';
import { CORP_COLORS, SKIN_TONES, HAIR_COLORS } from './data/corpColors.js';
import { setAccent, C, panel } from './engine/ui.js';
import { drawText } from './engine/font.js';
import { W } from './engine/screen.js';


/** How a career's employee looks: chosen skin/hair, clothes by the highest floor reached ({ skin, hair, hairStyle, colorId, maxFloor }). */
export function careerLook(p) {
  const col = CORP_COLORS.find((c) => c.id === p.colorId) || CORP_COLORS[0];
  const f = p.maxFloor;
  return {
    skin: SKIN_TONES[p.skin] || SKIN_TONES[0],
    hair: HAIR_COLORS[p.hair] || HAIR_COLORS[0],
    hairStyle: p.hairStyle ?? 0,
    shirt: f >= 16 ? '#f4f1e8' : '#dfe6ee',
    jacket: f >= 21 ? col.dark : null,
    pants: f >= 36 ? '#1a1a22' : '#3a3f55',
    tie: f >= 6 ? col.color : null,
    shoes: '#2a1d14',
    badge: true,
    glasses: false,
  };
}

export function createGame({ screen, input, audio }) {
  const stack = [];
  let toasts = [];
  let saveTimer = 0;
  let dirty = false;
  let badgeT = 0;
  let store = null;
  // localStorage can throw (blocked site data), so the store is made on first use inside each try.
  const slots = () => (store ??= createSlotStore(localStorage, { now: () => game.now() }));

  const game = {
    screen,
    input,
    audio,
    state: null,
    now: () => Date.now(),
    time: 0,

    // ---- persistence: one save slot per career (core/slots.js); game.slot is the one being played
    slot: null,
    /** The careers in this browser, last played first ([] when storage is blocked). */
    careers() {
      try {
        return slots().list();
      } catch {
        return [];
      }
    },
    canCreateCareer() {
      try {
        return slots().canCreate();
      } catch {
        return true; // storage blocked: the career just won't be saved
      }
    },
    /** Loads a career into game.state; false if its save is gone or unreadable. */
    loadCareer(id) {
      try {
        const s = slots().load(id);
        if (!s) return false;
        game.slot = id;
        game.setState(s);
        return true;
      } catch {
        return false;
      }
    },
    /** Starts playing a brand-new career in a slot of its own; false when all slots are taken. */
    newCareer(s) {
      let id = null;
      try {
        id = slots().create(s);
        if (!id) return false;
      } catch {
        /* storage full or blocked: play unsaved */
      }
      game.slot = id;
      game.setState(s);
      return true;
    },
    deleteCareer(id) {
      try {
        slots().remove(id);
      } catch {
        /* ignore */
      }
      if (id === game.slot) {
        game.slot = null;
        game.state = null;
        dirty = false;
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
      if (!game.state || !game.slot) return;
      try {
        slots().save(game.slot, game.state);
        dirty = false;
      } catch {
        /* storage full or blocked: keep playing */
      }
    },
    /** Reset career (in-game menu): deletes the career being played. */
    wipeSave() {
      if (game.slot) game.deleteCareer(game.slot);
      game.state = null;
    },

    /** Unlocks earned badges (core/achievements.js) and announces them; several at once get one summary toast. */
    checkBadges() {
      const fresh = checkBadges(game.state, game.now());
      if (!fresh.length) return;
      // Many at once = an older save catching up: one toast, one analytics event.
      if (fresh.length >= 3) {
        track('badge', { id: 'many', n: fresh.length, floor: game.state.maxFloor });
        game.toast(`${fresh.length} badges unlocked! See the badge wall.`, C.gold);
      } else
        for (const b of fresh) {
          track('badge', { id: b.id, floor: game.state.maxFloor });
          game.toast(`Badge unlocked: ${b.name}`, C.gold);
        }
      game.sfx('star');
      game.markDirty();
    },

    // ---- helpers
    corpColor() {
      const id = game.state?.corp.colorId;
      return CORP_COLORS.find((c) => c.id === id) || CORP_COLORS[0];
    },
    playerLook() {
      const s = game.state;
      return careerLook({ ...s.player, colorId: s.corp.colorId, maxFloor: s.maxFloor });
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
      badgeT += dt;
      if (game.state && badgeT > 0.5 && stack.some((sc) => sc.inTower)) {
        badgeT = 0;
        game.checkBadges();
      }
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
