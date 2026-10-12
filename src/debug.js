// Dev-only console helpers. Loaded by main.js on the dev server only: the production build drops the import (__DEV__).
import * as T from './core/trip.js';

export function installDebug(game) {
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
}
