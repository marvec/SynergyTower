// Pina Colada, in-between style: the sunset in flat bands with its reflection, palm silhouettes, a thatched roof with a
// fringe, a bamboo bar counter, fruit you can recognise (2 px sprites) and a hurricane glass with an umbrella.
import { W, H, rect, header, timerBar } from '../../../../src/engine/mgkit.js';
import { bands, cblob, sprite } from '../kit.js';

const FLOOR_Y = 228;

const FRUIT = {
  pineapple: { map: '..g.g..|...g...|.yyyyy.|yoyyoyy|yyoyyoy|yoyyoyy|.yyyyy.', pal: { g: '#2f8a3a', y: '#f2e14e', o: '#c8a020' } },
  orange: { map: '...g...|.ooooo.|ooOoooo|oOooooo|ooooooo|ooooooo|.ooooo.', pal: { g: '#5fd068', o: '#f29c38', O: '#ffc070' } },
  cherry: { map: '....g..|...gg..|..g..g.|.g....g|rr...rr|rRr..rRr|rrr..rrr', pal: { g: '#3a8a3a', r: '#c8302a', R: '#ff8080' } },
  coconut: { map: '.bbbbb.|bwwwwwb|bwwwwwb|bwwwwwb|bbbbbbb|.bbbbb.', pal: { b: '#6a4228', w: '#f4f1e8' } },
  lime: { map: '.lllll.|lgggggl|lgwgwgl|lggwggl|lgwgwgl|lgggggl|.lllll.', pal: { l: '#3a9a3a', g: '#8ade6a', w: '#e8ffd8' } },
};

function palmSilhouette(g, x, flip) {
  const c = '#3a2440';
  for (let k = 0; k < 160; k += 4) rect(g, Math.round(x + (flip ? -1 : 1) * (k * k) / 1600), FLOOR_Y - k - 4, 6, 4, c);
  const top = FLOOR_Y - 164;
  const cx = Math.round(x + (flip ? -16 : 16));
  for (const [dx, dy, w] of [[-30, 6, 28], [4, 6, 28], [-22, 0, 18], [6, 0, 18], [-8, -4, 18], [-36, 12, 10], [30, 12, 10]]) rect(g, cx + dx, top + dy, w, 4, c);
}

export function cocktail(g, t) {
  bands(g, 0, 18, W, 132, ['#c84a78', '#e85d75', '#f07a68', '#f29c38', '#f2b448', '#f2c14e']);
  cblob(g, 330, 132, 30, 30, '#fff6c8');
  bands(g, 0, 150, W, FLOOR_Y - 150, ['#2a86c7', '#2478b8', '#206aa8']);
  for (let i = 0; i < 10; i++) rect(g, 300 + ((i * 13) % 40) - i, 154 + i * 7, 60 - i * 4, 2, '#f6c87a');
  palmSilhouette(g, 40, false);
  palmSilhouette(g, 438, true);
  // Thatched roof with a ragged fringe.
  rect(g, 0, 14, W, 18, '#c9a14a');
  for (let x = 0; x < W; x += 8) rect(g, x, 18 + (x % 16 ? 4 : 8), 4, 2, '#a8862f');
  for (let x = 0; x < W; x += 4) rect(g, x, 32, 2, 4 + ((x * 7) % 10), '#a8862f');
  // Bar counter: a wooden top, bamboo front.
  rect(g, 0, FLOOR_Y, W, 8, '#b98a5a');
  rect(g, 0, FLOOR_Y, W, 2, '#d8a870');
  for (let x = 0; x < W; x += 12) {
    rect(g, x, FLOOR_Y + 8, 10, H - FLOOR_Y - 8, '#c8a050');
    rect(g, x, FLOOR_Y + 8, 2, H - FLOOR_Y - 8, '#e0c070');
    rect(g, x, FLOOR_Y + 20, 10, 2, '#8a6a30');
    rect(g, x, FLOOR_Y + 34, 10, 2, '#8a6a30');
  }
  // Falling fruit.
  const fall = [[120, 60, 'pineapple'], [210, 120, 'cherry'], [300, 90, 'orange'], [380, 150, 'lime'], [160, 170, 'coconut']];
  for (const [x, y, f] of fall) {
    const dark = Object.fromEntries(Object.keys(FRUIT[f].pal).map((k) => [k, '#1a1a22']));
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) sprite(g, FRUIT[f].map, dark, x - 7 + ox, y - 7 + oy, 2);
    sprite(g, FRUIT[f].map, FRUIT[f].pal, x - 7, y - 7, 2);
  }
  // The hurricane glass: wide bowl, a waist, a foot; pina colada, a pineapple wedge, straw and umbrella.
  const x = 240;
  const top = FLOOR_Y - 40;
  const glass = '#e8f8ff';
  const rows = [16, 16, 15, 14, 12, 10, 8, 6, 6, 7, 9, 10, 10, 9, 7, 5, 3, 3, 3, 3];
  rows.forEach((hw, i) => {
    rect(g, x - hw - 2, top + i * 2, (hw + 2) * 2, 2, '#1a1a22');
  });
  rows.forEach((hw, i) => {
    rect(g, x - hw, top + i * 2, hw * 2, 2, i > 5 && i < 16 ? '#f6e8b8' : glass);
    if (i > 5 && i < 16) rect(g, x - hw, top + i * 2, 2, 2, '#fffbe8');
  });
  rect(g, x - 10, FLOOR_Y - 2, 20, 2, '#1a1a22');
  rect(g, x - 8, FLOOR_Y - 4, 16, 2, glass);
  rect(g, x - 18, top - 2, 6, 6, '#f2e14e');
  rect(g, x - 18, top - 2, 6, 2, '#2f8a3a');
  rect(g, x + 6, top - 20, 2, 26, '#e2504a');
  rect(g, x + 8, top - 20, 6, 2, '#e2504a');
  for (let k = 0; k < 6; k++) rect(g, x - 8 + k * 2, top - 20 + k * 2, 16 - k * 4 > 0 ? 18 - k * 4 : 2, 2, k % 2 ? '#e85d75' : '#ffb0c0');
  rect(g, x - 1, top - 14, 2, 14, '#8a5a3a');
  header(g, 'Pina Colada', 'Fruit 4/10');
  timerBar(g, 18, 30);
}
