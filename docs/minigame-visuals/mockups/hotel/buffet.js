// Lobster (dinner buffet), in-between style: the hotel restaurant, a long table with a cloth and a teal runner, silver
// platters with food you can recognise (2 px sprites), and your plate with a fork.
import { W, H, rect, drawText, header, timerBar } from '../../../../src/engine/mgkit.js';
import { bands, cblob, sprite } from '../kit.js';

const AREA = { x: 40, y: 70, w: 400, h: 150 };

// 2 px food sprites, about 16x10 cells.
const FOOD = {
  lobster: { map: 'c..........c|cc........cc|.cc.rrrr.cc.|..rrrrrrrr..|.rrRrrrrRrr.|..rrrrrrrr..|...r.rr.r...|..r..rr..r..', pal: { r: '#e2504a', R: '#ffffff', c: '#c03a34' } },
  sushi: { map: '.ww..ww..ww.|wwoowwoowwoo|wwoowwoowwoo|kkkkkkkkkkkk|kkkkkkkkkkkk', pal: { w: '#ffffff', o: '#f29c38', k: '#1f3a2a' } },
  cake: { map: '..pp.pp.pp..|.cccccccccc.|.pppppppppp.|.cccccccccc.|.yyyyyyyyyy.|.cccccccccc.', pal: { p: '#f29cd0', c: '#8a4a2a', y: '#f6e8b8' } },
  pineapple: { map: '....g.g.....|.....gg.....|...yyyyyy...|..yoyyoyyo..|..yyyoyyoy..|..yoyyoyyo..|...yyyyyy...', pal: { g: '#2f8a3a', y: '#f2e14e', o: '#c8a020' } },
  icecream: { map: '..pp..bb....|.pppp.bbbb..|.pppp.bbbb..|wwwwwwwwwww.|.wwwwwwwww..|..wwwwwww...', pal: { p: '#f29cd0', b: '#7fc4ff', w: '#e8e4dc' } },
  pizza: { map: 'ccccccccccc|cyyryyyyryc|.yyyyyryyc.|..yryyyyc..|...yyyrc...|....yyc....|.....c.....', pal: { c: '#c8862a', y: '#f2c14e', r: '#c74634' } },
  salad: { map: '..g.lg.r....|.glgggrgg...|gglrgglggg..|.wwwwwwwww..|..wwwwwww...', pal: { g: '#5fd068', l: '#3a9a4a', r: '#e2504a', w: '#ffffff' } },
  mango: { map: '...oo.oo....|..oyyoyyo...|.oyyoyyoyo..|..oyyoyyo...|...oo.oo....', pal: { o: '#f29c38', y: '#f2c14e' } },
};

function room(g) {
  bands(g, 0, 18, W, 40, ['#8a5a36', '#7a4e2e']);
  for (let x = 0; x < W; x += 40) rect(g, x, 18, 2, 40, '#6a4226');
  rect(g, 0, 56, W, 4, '#c8a060');
  rect(g, 0, 60, W, H - 60, '#6e4529');
  for (let y = 60; y < H; y += 14) rect(g, 0, y, W, 2, '#5e3a22');
  // Lanterns along the wall.
  for (const x of [60, 420]) {
    rect(g, x - 1, 18, 2, 8, '#3a2a1a');
    rect(g, x - 6, 26, 12, 14, '#f2c14e');
    rect(g, x - 6, 26, 12, 2, '#c8862a');
    rect(g, x - 6, 38, 12, 2, '#c8862a');
  }
}

function table(g) {
  rect(g, AREA.x - 12, AREA.y - 12, AREA.w + 24, AREA.h + 24, '#d8d0c0');
  rect(g, AREA.x - 12, AREA.y - 12, AREA.w + 24, AREA.h + 20, '#f4f1e8');
  for (let x = AREA.x; x < AREA.x + AREA.w; x += 50) rect(g, x, AREA.y - 12, 2, AREA.h + 20, '#e8e2d4');
  rect(g, AREA.x - 12, AREA.y + AREA.h / 2 - 6, AREA.w + 24, 12, '#5fd0c8');
  rect(g, AREA.x - 12, AREA.y + AREA.h / 2 + 4, AREA.w + 24, 2, '#3ab0a8');
  // A centrepiece: a carved ice swan's flowers.
  cblob(g, 240, AREA.y + AREA.h / 2, 10, 8, '#e86ab0');
  cblob(g, 236, AREA.y + AREA.h / 2 - 2, 4, 4, '#ffe070');
}

function platter(g, x, y, food) {
  cblob(g, x, y + 4, 22, 10, '#8a8e98');
  cblob(g, x, y + 2, 20, 9, '#c8ccd4');
  cblob(g, x - 4, y, 10, 4, '#e8ecf0');
  const f = FOOD[food];
  const w = f.map.split('|')[0].length;
  sprite(g, f.map, f.pal, x - w, y - 10, 2);
}

function plate(g, x, y) {
  cblob(g, x + 2, y + 2, 18, 14, 'rgba(0,0,0,0.25)');
  cblob(g, x, y, 18, 14, '#3b6fb6');
  cblob(g, x, y, 16, 12, '#ffffff');
  cblob(g, x, y, 10, 8, '#ece8e0');
  // Fork.
  rect(g, x + 22, y - 4, 2, 18, '#c8ccd4');
  for (const k of [0, 2, 4]) rect(g, x + 20 + k, y - 12, 1, 8, '#c8ccd4');
  rect(g, x + 20, y - 5, 6, 2, '#c8ccd4');
}

export function buffet(g) {
  room(g);
  table(g);
  const spots = [[90, 100, 'lobster'], [180, 96, 'sushi'], [310, 102, 'cake'], [390, 96, 'pineapple'], [110, 190, 'salad'], [200, 196, 'pizza'], [300, 192, 'icecream'], [390, 190, 'mango']];
  for (const [x, y, f] of spots) platter(g, x, y, f);
  plate(g, 250, 150);
  header(g, 'Lobster', 'Eaten 5/12');
  timerBar(g, 20, 30);
  drawText(g, 'Touch anything on the buffet to eat it', W / 2, 30, { align: 'center', color: '#f6e8b8', shadow: '#3a2414' });
  drawText(g, 'Chef recommends: everything', W / 2, 240, { align: 'center', color: '#f6e8b8', shadow: '#3a2414' });
}
