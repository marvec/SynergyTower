// Dev-only console helpers. Loaded by main.js on the dev server only: the production build drops the import (__DEV__).
import * as T from './core/trip.js';
import * as V from './core/vacation.js';
import * as E from './core/economy.js';
import * as CD from './core/conduct.js';
import * as N from './core/nightShift.js';
import { MinigameScene } from './scenes/minigameScene.js';
import { LIGHTING, VIEWS } from './engine/lighting.js';

export function installDebug(game) {
  /** Launch any mini-game, e.g. __mg('spreadsheet', 0.5). Needs a loaded career. It pays real rewards, hence dev only. */
  window.__mg = (gameId, difficulty = 0.5) => {
    game.push(new MinigameScene(game, { id: `debug-${gameId}`, game: gameId, title: `Debug: ${gameId}`, difficulty, seed: 1 }, null));
    return gameId;
  };

  /**
   * Debug: the business trip again, as often as you like. On floor 10 or 30: __trip() resets it and starts the drive,
   * __trip('client') skips the drive and goes straight into the client's office. Elsewhere: __trip(10) / __trip(30, 'client')
   * also rides there first.
   */
  window.__trip = async (a, b) => {
    const s = game.state;
    if (!s) return 'no career loaded';
    const floor = typeof a === 'number' ? a : s.floor;
    const mode = typeof a === 'string' ? a : b;
    if (!T.isTripFloor(floor)) return 'business trips leave from floors 10 and 30: try __trip(10)';
    T.resetTrip(s, floor);
    s.maxFloor = Math.max(s.maxFloor, floor);
    s.floor = floor;
    game.saveNow();
    if (mode === 'client') {
      T.departTrip(s, floor);
      T.arriveTrip(s, floor, game.now());
      const { ClientOfficeScene } = await import('./scenes/clientOffice.js');
      game.set(new ClientOfficeScene(game, floor));
      return `client office, floor ${floor}`;
    }
    const { FloorScene } = await import('./scenes/floorScene.js');
    const fs = new FloorScene(game, floor);
    game.set(fs);
    await fs.startTrip();
    return `drive from floor ${floor}`;
  };

  /**
   * Debug: the vacation again, as often as you like and always free (no paperclips). __vacation() goes to floor 20 and
   * opens your manager's leave request; __vacation('hotel') goes straight to the hotel. A stay under way is dropped.
   */
  window.__vacation = async (mode) => {
    const s = game.state;
    if (!s) return 'no career loaded';
    V.resetVacation(s);
    s.maxFloor = Math.max(s.maxFloor, E.VACATION_FLOOR);
    s.floor = E.VACATION_FLOOR;
    if (mode === 'hotel') {
      V.requestVacation(s, E.VACATION_FLOOR, game.now(), 0);
      game.saveNow();
      const { HotelScene } = await import('./scenes/hotel.js');
      game.set(new HotelScene(game));
      return 'hotel';
    }
    game.saveNow();
    const { FloorScene } = await import('./scenes/floorScene.js');
    const fs = new FloorScene(game, E.VACATION_FLOOR);
    game.set(fs);
    if (fs.bossNpc) fs.askVacation(fs.bossNpc, 0);
    return 'floor 20: leave request';
  };

  /**
   * Debug: the night shift again, as often as you like. __night() opens your manager's offer on the nearest night floor
   * at or below your highest floor (5 at least), __night(15) on floor 15; __night('dark') / __night(15, 'dark') skips the
   * offer and the walk-out, straight into the dark office. Today's shift (and one under way) is reset first.
   */
  window.__night = async (a, b) => {
    const s = game.state;
    if (!s) return 'no career loaded';
    const below = E.NIGHT_FLOORS.filter((f) => f <= s.maxFloor);
    const floor = typeof a === 'number' ? a : below.at(-1) || E.NIGHT_FLOORS[0];
    const mode = typeof a === 'string' ? a : b;
    if (!N.isNightFloor(floor)) return `night shifts run on floors ${E.NIGHT_FLOORS.join(', ')}: try __night(15)`;
    N.resetNight(s);
    s.maxFloor = Math.max(s.maxFloor, floor);
    s.floor = floor;
    if (mode === 'dark') N.startNightShift(s, floor, game.now());
    game.saveNow();
    const { FloorScene } = await import('./scenes/floorScene.js');
    const fs = new FloorScene(game, floor);
    game.set(fs);
    if (mode === 'dark') return `floor ${floor}: night shift (${N.nightStatus(s, floor, game.now())})`;
    if (fs.nightBoss) fs.askNight(fs.nightBoss);
    return `floor ${floor}: night shift offer`;
  };

  /**
   * Debug: the coffee break chat (core/conduct.js) on this floor, with a clean conduct record. __conduct() opens the
   * chat colleague's card; __conduct(4) starts with 4 strikes (they said no already), so the next ask starts the hold;
   * __conduct('hold') goes straight to the compliance hold.
   */
  window.__conduct = async (arg) => {
    const s = game.state;
    if (!s) return 'no career loaded';
    s.conduct = { strikes: 0, refused: {}, reported: {}, hold: null, trained: false, holds: 0, demotions: 0 };
    const { FloorScene } = await import('./scenes/floorScene.js');
    const fs = new FloorScene(game, s.floor);
    game.set(fs);
    const n = fs.chatNpc;
    if (!n) return 'nobody to chat with on this floor';
    if (arg === 'hold') {
      s.conduct.strikes = E.HOLD_STRIKES;
      s.conduct.hold = { at: game.now(), floor: s.floor };
      game.saveNow();
      return 'compliance hold: visit the HR office';
    }
    if (typeof arg === 'number') {
      s.conduct.refused[n.seed] = 1 + arg;
      s.conduct.strikes = Math.min(arg, E.HOLD_STRIKES - 1);
    }
    game.saveNow();
    fs.player.x = n.a.x;
    fs.player.y = n.a.y + 0.9;
    fs.snapCamera();
    fs.openChat(n);
    return `${n.id.name}, ${CD.askState(s, n.seed) || 'no drinks'}`;
  };

  /**
   * Debug: the night lighting (engine/lighting.js). __light() shows the settings; __light('levels', 6), __light('mode',
   * 'tile'), __light('dither', false), __light('fog', true), __light('ambient', 0.05) change them; __light('flash') flashes.
   * The backslash key cycles the view: final, unlit, the light buffer alone.
   */
  window.__light = (key, value) => {
    const lighting = game.top?.lighting;
    if (key === 'flash') return lighting ? (lighting.flash(0.6), 'flash') : 'no lighting on this scene';
    if (key != null) {
      LIGHTING[key] = value;
      if (key === 'ambient' && lighting) lighting.setAmbient(value);
      if (key === 'fog' && lighting) lighting.seen = null;
    }
    return { ...LIGHTING };
  };
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backslash') return;
    LIGHTING.view = VIEWS[(VIEWS.indexOf(LIGHTING.view) + 1) % VIEWS.length];
    game.toast(`Lighting view: ${LIGHTING.view}`);
  });
}
