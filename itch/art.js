// The itch.io page art: the cover (630x500) and the banner (960x240), drawn with the title screen's own code at a
// small logical size and scaled 2x nearest-neighbour. `bun itch/build-art.js` writes them to itch/assets/.
import { drawText, measureText } from '../src/engine/font.js';
import { rect, C } from '../src/engine/ui.js';
import { drawSky, drawSkyline, drawTower, towerHeight, TOWER_W } from '../src/scenes/cityscape.js';
import { CORP_COLORS } from '../src/data/corpColors.js';
import { COUNTED_GAMES } from '../src/core/tasks.js';

const GAME_COUNT = COUNTED_GAMES.length;

const SCALE = 2;
const CORP = CORP_COLORS[0]; // Big Blue, the default career colours
const T = 1.3; // a fixed animation time: the stars and the spire light are the same on every run

function logical(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const out = document.createElement('canvas');
  out.width = w * SCALE;
  out.height = h * SCALE;
  const og = out.getContext('2d');
  og.imageSmoothingEnabled = false;
  og.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

const shadow = '#000';

/** 315x250 logical: logo top left, the tower on the right, the pitch at the bottom. */
export function cover() {
  return logical(315, 250, (g, w, h) => {
    const groundY = h - 14;
    drawSky(g, w, h, 'dusk', T);
    drawSkyline(g, w, groundY, 'night', 37);
    // Show the top of the tower: the sign and the upper floors.
    drawTower(g, w - TOWER_W - 6, 40 + towerHeight(), CORP, { corpName: 'Synergy Corp', mode: 'night', t: T });
    rect(g, 0, groundY, w, 14, '#20232e');
    rect(g, 0, groundY, w, 2, '#3a3f4e');
    drawText(g, 'SYNERGY', 10, 12, { scale: 4, color: C.gold, shadow });
    drawText(g, 'TOWER', 10, 46, { scale: 4, color: '#ffffff', shadow });
    drawText(g, 'Climb 40 floors of', 12, 84, { color: '#e8dff8', shadow });
    drawText(g, 'corporate absurdity.', 12, 94, { color: '#e8dff8', shadow });
    drawText(g, `${GAME_COUNT} office mini-games`, 12, 108, { color: C.gold, shadow });
    const foot = 'Free · in your browser · no sign-up';
    rect(g, 0, groundY + 2, w, 12, '#20232e');
    drawText(g, foot, Math.round((w - measureText(foot)) / 2), groundY + 4, { color: '#c8cce0' });
  });
}

/** 480x120 logical: a wide strip for the top of the page. */
export function banner() {
  return logical(480, 120, (g, w, h) => {
    const groundY = h - 4;
    drawSky(g, w, h, 'dusk', T);
    drawSkyline(g, w, groundY + 72, 'night', 11); // only the tops of the back row, below the text
    drawTower(g, w - TOWER_W - 24, 30 + towerHeight(), CORP, { corpName: 'Synergy Corp', mode: 'night', t: T });
    rect(g, 0, groundY, w, 4, '#20232e');
    drawText(g, 'SYNERGY', 20, 16, { scale: 4, color: C.gold, shadow });
    drawText(g, 'TOWER', 20 + measureText('SYNERGY ', 4), 16, { scale: 4, color: '#ffffff', shadow });
    drawText(g, 'Climb 40 floors of corporate absurdity.', 22, 50, { color: '#e8dff8', shadow });
    drawText(g, `${GAME_COUNT} office mini-games, from new hire to CEO.`, 22, 61, { color: C.gold, shadow });
  });
}
