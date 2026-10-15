// Game context shared by all scenes: state, persistence, audio, input and the scene stack.
import * as S from './core/state.js';
import { createSlotStore } from './core/slots.js';
import { checkBadges } from './core/achievements.js';
import { track } from './engine/analytics.js';
import { gameStorage, haptic } from './engine/platform.js';
import { CORP_COLORS, SKIN_TONES, HAIR_COLORS } from './data/corpColors.js';
import { setAccent, C, panel } from './engine/ui.js';
import { drawText, measureText } from './engine/font.js';
import { W } from './engine/screen.js';


/** How a career's employee looks: chosen skin/hair, clothes by the highest floor reached ({ skin, hair, hairStyle, skirt, colorId, maxFloor }). */
export function careerLook(p) {
  const col = CORP_COLORS.find((c) => c.id === p.colorId) || CORP_COLORS[0];
  const f = p.maxFloor;
  const look = {
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
  // A skirt takes the tie's corporate colour, and matches the jacket once there is one.
  if (p.skirt) Object.assign(look, { skirt: look.jacket || col.color, tie: null });
  return look;
}

const HAPTICS = { bad: 'light', fail: 'medium', crash: 'heavy', levelup: 'medium', cash: 'light' };

export function createGame({ screen, input, audio }) {
  const stack = [];
  let toasts = [];
  let shown = []; // the scenes drawn in the last frame (toasts keep clear of their clock panels)
  let saveTimer = 0;
  let dirty = false;
  let badgeT = 0;
  let store = null;
  // localStorage can throw (blocked site data), so the store is made on first use inside each try.
  // In the app, gameStorage() also mirrors the saves to native storage (engine/platform.js).
  const slots = () => (store ??= createSlotStore(gameStorage(), { now: () => game.now() }));

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
      // The app adds a buzz to the big moments (a no-op in the browser), with the sound effects setting.
      const buzz = HAPTICS[name];
      if (buzz && game.state?.settings.sfx !== false) haptic(buzz);
    },
    toast(text, color = C.text) {
      toasts.push({ text, color, t: 0 });
      if (toasts.length > 4) toasts.shift();
    },

    // ---- scene stack
    get top() {
      return stack[stack.length - 1];
    },
    /** The scenes from the bottom up (a copy). */
    scenes() {
      return [...stack];
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
      // Paused (the menu, a paused mini-game): the trip, holiday, night shift and home office clocks stand still.
      if (game.state && stack.some((sc) => sc.pausesClocks)) S.holdClocks(game.state, dt * 1000);
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
      shown = stack.slice(from);
      for (const b of game.toastBoxes()) {
        g.globalAlpha = Math.min(1, (3 - b.t) * 2);
        panel(g, b.x, b.y, b.w, b.h, { fill: C.panelDark });
        drawText(g, b.text, b.x + b.w / 2, b.y + 3, { align: 'center', color: b.color });
        g.globalAlpha = 1;
      }
    },
    /**
     * Where the toasts go: centred under the HUD, one row each. A timed stay's clock panel (the scenes drawn last frame
     * mark it, FloorScene.markPanel) keeps them clear: centred in the room left of it if they all fit there, else below it.
     */
    toastBoxes() {
      const p = shown.map((sc) => sc.hudPanel).find(Boolean);
      const widths = toasts.map((t) => Math.min(W - 8, measureText(t.text) + 16)); // the box holds the whole line
      let cx = W / 2;
      let y0 = 22;
      if (p) {
        const room = p.x - 8; // from 4 px in to 4 px short of the panel
        if (Math.max(...widths) <= room) cx = 4 + room / 2;
        else y0 = p.y + p.h + 3;
      }
      return toasts.map((t, i) => ({ x: Math.round(cx - widths[i] / 2), y: y0 + i * 16, w: widths[i], h: 14, text: t.text, color: t.color, t: t.t }));
    },
  };
  return game;
}
