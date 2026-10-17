// Title screen: animated tower at dusk, logo, continue / new career.
import { W, H } from '../engine/screen.js';
import { C, ButtonSet, rect, frame, drawLink, openCoffee } from '../engine/ui.js';
import { track } from '../engine/analytics.js';
import { openFeedback } from '../engine/feedback.js';
import { drawText, measureText } from '../engine/font.js';
import { CORP_COLORS } from '../data/corpColors.js';
import { drawSky, drawSkyline, drawTower, towerHeight, TOWER_W } from './cityscape.js';
import { howToDialog, Dialog } from './overlays.js';
import { titleForFloor } from '../data/departments.js';
import { features, openExternal, isTouch } from '../engine/platform.js';
import { installOffer, promptInstall, IOS_INSTALL_STEPS } from '../engine/install.js';
import { COUNTED_GAMES } from '../core/tasks.js';

// Every kind of mini-game the games-played counter counts: office stations and holiday activities (not the HR review).
export const GAME_COUNT = COUNTED_GAMES.length;

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.buttons = new ButtonSet();
    this.refresh();
  }
  /** The last played career is loaded (its colours, music settings and name on the title); none if there are none. */
  refresh() {
    const game = this.game;
    const careers = game.careers();
    if (!careers.some((c) => c.id === game.slot && game.state)) {
      game.slot = null;
      game.state = null;
      careers.some((c) => game.loadCareer(c.id));
    }
    this.anyCareer = careers.length > 0;
    this.savedInfo = null;
    this.build();
  }
  build() {
    const b = this.buttons;
    b.clear();
    const x = 40;
    let y = 136;
    if (this.anyCareer) {
      const s = this.game.state;
      b.add({ x, y, w: 150, h: 20, label: 'Continue career', color: C.goodBtn, onClick: () => this.pickCareer() });
      y += 26;
      if (s) this.savedInfo = `${s.player.name} · ${titleForFloor(s.maxFloor)} · F${s.maxFloor}`;
    }
    b.add({ x, y, w: 150, h: 20, label: this.anyCareer ? 'New career' : 'Start your career', onClick: () => (this.game.canCreateCareer() ? this.newGame() : this.pickCareer()) });
    y += 26;
    b.add({ x, y, w: 150, h: 20, label: 'How to play', color: C.panelLight, onClick: () => this.game.push(howToDialog(this.game)) });
    y += 28;
    // Other platforms: the C64 version's download page; the phone apps aren't out yet. Centred under the menu.
    // The app shows only the C64 badge: it is the App Store / Google Play version already.
    const stores = STORES.filter((s) => features.storeBadges || s.id === 'c64');
    const widths = stores.map((s) => 17 + Math.max(measureText(s.top), measureText(s.name)));
    let bx = Math.max(4, Math.round(x + 75 - (widths.reduce((a, w) => a + w, 0) + 3 * (stores.length - 1)) / 2));
    stores.forEach((s, i) => {
      b.add({ x: bx, y, w: widths[i], h: 22, store: s, draw: drawStoreBadge, onClick: () => this.openStore(s) });
      bx += widths[i] + 3;
    });
  }
  openStore(s) {
    track('store_click', { store: s.id });
    if (s.url) openExternal(s.url);
    else this.game.toast(`Coming soon to ${s.name}!`, C.gold);
  }
  /** The website as an installed app (engine/install.js): the browser's prompt, or the steps on iPhone/iPad. */
  install(offer) {
    track('install_click', { how: offer });
    if (offer === 'ios') return this.game.push(new Dialog(this.game, { title: 'Install SynergyTower', w: 300, text: IOS_INSTALL_STEPS, button: 'Got it' }));
    promptInstall().then((r) => r === 'accepted' && this.game.toast('Installing... find SynergyTower on your home screen.', C.gold));
  }
  enter() {
    this.game.audio.play('title');
  }
  resume() {
    this.game.audio.play('title');
    this.refresh(); // back from the picker: a career may have been deleted
  }
  /** The character picker: every saved career, last played first. */
  async pickCareer() {
    const { CareerPicker } = await import('./careerPicker.js');
    this.game.push(
      new CareerPicker(this.game, {
        onPick: (id) => {
          if (id === this.game.slot || this.game.loadCareer(id)) this.continue();
          else this.game.toast('That career could not be loaded.', C.bad);
        },
        onNew: () => this.newGame(),
      }),
    );
  }
  async continue() {
    const { FloorScene } = await import('./floorScene.js');
    const s = this.game.state;
    if (!s.flags.introSeen) {
      const { ExteriorScene } = await import('./exterior.js');
      return this.game.set(new ExteriorScene(this.game));
    }
    // Saved on the roof: back at the fire-escape window of the floor it was reached from.
    if (s.roof?.on) {
      const RF = await import('../core/roof.js');
      const floor = RF.resumeRoof(s);
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, floor, { arrival: 'roof' }));
      return this.game.toast('You climbed back down the fire escape.', C.dim);
    }
    // The Christmas party under way: back to the hall while its clock runs (whatever the date), else it is over.
    if (s.party) {
      const PA = await import('../core/party.js');
      if (PA.partyActive(s, this.game.now())) {
        const { PartyScene } = await import('./party.js');
        return this.game.set(new PartyScene(this.game));
      }
      const sum = PA.endParty(s, 'done');
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, sum.floor));
      return this.game.toast(`The Christmas party is over: +${sum.sp} paperclips.`, C.gold);
    }
    // Saved in the basement archive mid-search: that run counts as failed (its clock is not saved), back upstairs.
    if (s.archive?.task?.inside) {
      const A = await import('../core/archive.js');
      A.resumeArchive(s);
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, s.floor));
      return this.game.toast('You lost track of time in the archive. The folder search is off for good.', C.warn);
    }
    // A business trip under way: back to the client's office while its clock runs, else the visit is over.
    if (s.trip) {
      const T = await import('../core/trip.js');
      if (T.tripActive(s, this.game.now())) {
        const { ClientOfficeScene } = await import('./clientOffice.js');
        return this.game.set(new ClientOfficeScene(this.game, s.trip.floor));
      }
      const sum = T.endTrip(s);
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, sum.floor));
      return this.game.toast(`The client visit is over: +${sum.sp} paperclips in ${sum.tasks} tasks.`, C.gold);
    }
    // On vacation: back to the hotel while the stay lasts, else the holiday is over (back on the boss's floor).
    if (s.vacation) {
      const V = await import('../core/vacation.js');
      if (V.vacationActive(s, this.game.now())) {
        const { HotelScene } = await import('./hotel.js');
        return this.game.set(new HotelScene(this.game));
      }
      const sum = V.endVacation(s);
      this.game.saveNow();
      const E = await import('../core/economy.js');
      this.game.set(new FloorScene(this.game, E.VACATION_FLOOR));
      return this.game.toast(`The holiday is over: ${sum.coffee} extra coffee to show for it.`, C.coffee);
    }
    // Working from home: back to the flat while the day lasts, else it is over (back on the manager's floor, its
    // cooldowns cleared unless three lapses sent you back).
    if (s.home) {
      const HO = await import('../core/home.js');
      if (HO.homeActive(s, this.game.now())) {
        const { HomeScene } = await import('./home.js');
        return this.game.set(new HomeScene(this.game));
      }
      const sum = HO.endHome(s, 'done');
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, sum.floor));
      return this.game.toast(sum.cleared ? 'The home office day is over. Rested: every station on this floor is ready.' : 'The home office day is over.', C.gold);
    }
    // A night shift under way: the dark floor while its clock runs; else (or saved on another floor) it is over.
    if (s.nightShift) {
      const N = await import('../core/nightShift.js');
      if (N.nightActive(s, this.game.now()) && s.floor === s.nightShift.floor) return this.game.set(new FloorScene(this.game, s.floor));
      const sum = N.endNightShift(s);
      this.game.saveNow();
      this.game.set(new FloorScene(this.game, s.floor));
      return this.game.toast(`The night shift is over: ${sum.tasks} tasks, +${sum.sp} paperclips.`, C.gold);
    }
    // A new hire who has not made it past the lobby turnstiles yet comes back in through the front door.
    const arrival = s.lobby !== 'done' && s.floor === 1 ? 'entrance' : 'elevator';
    this.game.set(new FloorScene(this.game, s.floor, { arrival }));
  }
  async newGame() {
    const { SetupScene } = await import('./setup.js');
    this.game.set(new SetupScene(this.game));
  }
  update(dt) {
    this.t += dt;
    this.buttons.update(this.game.input, (n) => this.game.sfx(n));
  }
  render(g) {
    const groundY = H - 18;
    drawSky(g, W, H, 'dusk', this.t);
    drawSkyline(g, W, groundY, 'night', this.t * 4);
    // Read game.state every frame: the picker on top can delete the career that is loaded.
    const s = this.game.state;
    const corp = s ? this.game.corpColor() : CORP_COLORS[Math.floor(this.t / 3) % CORP_COLORS.length];
    const name = s ? s.corp.name : corp.name + ' Corp';
    // Tower slowly scrolls to show it is tall.
    const th = towerHeight();
    const pan = (Math.sin(this.t * 0.25) + 1) / 2;
    const gy = groundY + (th - H + 60) * pan;
    drawTower(g, W - TOWER_W - 60, gy, corp, { corpName: name, mode: 'night', t: this.t });
    rect(g, 0, groundY, W, 18, '#20232e');
    rect(g, 0, groundY, W, 2, '#3a3f4e');
    // Logo.
    const wob = Math.round(Math.sin(this.t * 2) * 2);
    drawText(g, 'SYNERGY', 40, 28 + wob, { scale: 4, color: C.gold, shadow: '#000' });
    drawText(g, 'TOWER', 40, 64 - wob, { scale: 4, color: '#ffffff', shadow: '#000' });
    drawText(g, 'Climb 40 floors of corporate absurdity.', 42, 100, { color: '#e8dff8', shadow: '#000' });
    drawText(g, `Prove your skills in ${GAME_COUNT} challenging tasks!`, 42, 110, { color: C.gold, shadow: '#000' });
    if (this.savedInfo && s) drawText(g, this.savedInfo, 42, 124, { color: C.so, shadow: '#000' });
    this.buttons.render(g);
    // Bottom line: the facts on the left, links on the right (Install app only where the website can be installed).
    const offer = installOffer();
    const keys = !isTouch() && !offer ? ' · M toggles music' : '';
    drawText(g, `v1.0 · works offline · no cookies${keys}`, 4, H - 11, { color: '#8890b0' });
    let lx = W - 4;
    const link = (text, fn) => {
      drawLink(g, this.game.input, text, lx, H - 11, fn);
      lx -= measureText(text) + 14;
    };
    if (features.tips) link('Buy author a coffee', openCoffee);
    link('Feedback', sendFeedback);
    if (offer) link('Install app', () => this.install(offer));
  }
}

const sendFeedback = () => openFeedback('title screen');

// Store badges below the menu: black with a grey outline like the real ones, a 9×9 pixel logo, two lines of text.
const STORES = [
  { id: 'c64', top: 'Download for', name: 'Commodore 64', url: '/c64/', art: [
    '.........', '.........', '.........', 'MMMMMMMMM', 'MkkkkkkRM', 'MkkkkkkOM', 'MkkkkkkYM', 'MMMMMMMMM', '.........'] },
  { id: 'appstore', top: 'Coming soon', name: 'App Store', art: [
    '.....W...', '....W....', '.WWW.WWW.', 'WWWWWWWW.', 'WWWWWWW..', 'WWWWWWW..', 'WWWWWWWW.', '.WWWWWWW.', '..WW.WW..'] },
  { id: 'googleplay', top: 'Coming soon', name: 'Google Play', art: [
    'B........', 'BG.......', 'BGGG.....', 'BGGGG....', 'BYYYYY...', 'BRRRR....', 'BRRR.....', 'BR.......', 'B........'] },
];
const ART_COLORS = { M: '#c9b98f', k: '#5a5244', R: '#e2504a', O: '#f29c38', Y: '#f2c14e', W: '#ffffff', B: '#3b8bf0', G: '#34c759' };

function drawStoreBadge(g, b, focused, hovered) {
  const s = b.store;
  rect(g, b.x, b.y, b.w, b.h, '#a8acbc');
  rect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, hovered ? '#24262e' : '#000');
  if (focused) frame(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, C.gold);
  s.art.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && rect(g, b.x + 3 + c, b.y + 6 + r, 1, 1, ART_COLORS[ch])));
  const soon = !s.url;
  drawText(g, s.top, b.x + 14, b.y + 3, { color: soon ? C.gold : '#c8ccd8' });
  drawText(g, s.name, b.x + 14, b.y + 12, { color: soon ? '#c8ccd8' : '#ffffff' });
}
