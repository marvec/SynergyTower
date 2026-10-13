// The HUD for a phone held upright. The game stays 480x270 and fills the screen's width at the top; the empty space
// below it becomes a dock of DOM controls: the career stats in readable text and thumb-sized buttons for the HUD
// actions (shop, perks, training, badges, music, menu) plus a Back button (Escape, for phones without one).
// It only shows in portrait on touch screens after the player chose "Play upright" on the turn-sideways card,
// and only while walking a floor; its buttons work while no dialog is open (Back always works).
import * as S from '../core/state.js';
import * as E from '../core/economy.js';
import { formatNum, formatTime } from '../engine/ui.js';
import { titleForFloor } from '../data/departments.js';
import { features } from '../engine/platform.js';

const PORTRAIT = '(orientation: portrait) and (pointer: coarse) and (max-width: 600px)';

const BUTTONS = [
  { key: 'shop', label: 'Shop' },
  { key: 'perks', label: 'Perks' },
  { key: 'train', label: 'Train' },
  { key: 'badges', label: 'Badges' },
  { key: 'music', label: 'Music' },
  { key: 'menu', label: 'Menu' },
];

/** Stats shown in the dock: [key (StatsDialog tab), label, value]. Pure, for tests. */
export function dockStats(s, now) {
  const quota = E.starQuota(s.floor);
  const next = S.msToNextCoffee(s, now);
  const gp = S.gamesPlayed(s);
  return [
    ['sp', 'Paperclips', formatNum(s.sp)],
    ['stars', 'KPI stars', `${s.starsByFloor[s.floor] || 0}/${quota}`],
    ['coffee', 'Coffee', `${s.coffee.value}/${S.coffeeMax(s)}${next > 0 ? ` (+1 in ${formatTime(next)})` : ''}`],
    ['level', 'Seniority', `Level ${s.level}`],
    ['so', 'Stock Options', formatNum(s.so)],
    ['games', 'Games played', `${gp.played}/${gp.total}`],
  ];
}

export function initPortraitDock(game, { onBack, onLayout }) {
  const dock = document.getElementById('dock');
  if (!dock || !window.matchMedia) return;
  const mq = window.matchMedia(PORTRAIT);
  const root = document.documentElement;

  dock.innerHTML = `
    <div class="who"></div>
    <div class="stats"></div>
    <div class="buttons">${BUTTONS.map((b) => `<button type="button" data-key="${b.key}">${b.label}</button>`)
      .join('')}<button type="button" class="back" data-key="back">Back</button></div>`;
  const who = dock.querySelector('.who');
  const stats = dock.querySelector('.stats');
  const floorScene = () => game.scenes().find((sc) => sc.hud?.actions);

  dock.addEventListener('click', (e) => {
    const el = e.target.closest('[data-key]');
    if (!el) return;
    game.audio.unlock();
    const key = el.dataset.key;
    if (key === 'back') return onBack();
    const fs = floorScene();
    if (!fs || game.top !== fs) return; // a dialog is open: it has its own buttons
    game.sfx('click');
    if (el.dataset.stat) {
      import('./statsDialog.js').then(({ StatsDialog }) => game.push(new StatsDialog(game, key)));
    } else fs.hud.actions[key]?.();
  });

  let shown = null;
  let last = '';
  const update = () => {
    const fs = floorScene();
    const on = mq.matches && root.classList.contains('portrait-ok') && !!fs && !!game.state;
    if (on !== shown) {
      shown = on;
      root.classList.toggle('dock-on', on);
      onLayout();
    }
    if (!on) return;
    const s = game.state;
    const view = {
      stats: dockStats(s, game.now()),
      who: `${s.player.name} - ${titleForFloor(s.maxFloor)}, floor ${s.floor} - ${s.corp.name}`,
      music: s.settings.music,
    };
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    stats.replaceChildren(
      ...view.stats.map(([k, label, value]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stat';
        b.dataset.key = k;
        b.dataset.stat = '1';
        b.append(Object.assign(document.createElement('span'), { textContent: label }), Object.assign(document.createElement('b'), { textContent: value }));
        return b;
      }),
    );
    who.textContent = view.who;
    dock.querySelector('[data-key="music"]').textContent = view.music ? 'Music: on' : 'Music: off';
    dock.querySelector('[data-key="shop"]').textContent = features.shop ? 'Shop' : 'Stock Options';
  };
  setInterval(update, 250);
  mq.addEventListener?.('change', update);
  update();
}
