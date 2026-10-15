// The Christmas party hall (spec 2026-10-15-christmas-party): one big room, the elevator doors in the top wall. The stage
// (Carol Karaoke) top left, the DJ booth (Dance-Off) over the dance floor in the middle, the bar along the right wall (the
// bartender behind it), the buffet on the left, the tree with the Secret Santa table bottom left, the photo booth bottom
// right, party tables along the bottom. Deterministic and cached; the guests come from partyGuests.
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs } from './floorgen.js';
import { buildFloor } from './tasks.js';
import * as E from './economy.js';
import { DEPARTMENTS } from '../data/departments.js';
import { PARTY_ACTIVITIES } from '../data/party.js';

export const HALL_W = 44;
export const HALL_H = 28;
const DOOR_X = 21;
const DANCE = { x0: 17, x1: 26, y0: 9, y1: 16 };

let cached = null;

export function buildPartyHall() {
  return (cached ||= generateHall());
}

function generateHall() {
  const W = HALL_W;
  const H = HALL_H;
  const dept = DEPARTMENTS.find((d) => d.id === 'exec');
  const P = createPlanner(W, H, createRng(1224), dept);
  const { tiles, idx, setWall, rooms, roomOf, items, place, decor } = P;
  const ground = new Array(W * H).fill('parquet');
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    setWall(0, y);
    setWall(W - 1, y);
  }
  for (const x of [DOOR_X, DOOR_X + 1]) tiles[idx(x, 0)] = 0;
  const entrance = { x: DOOR_X, y: 0, w: 2 };
  const room = { id: rooms.length, type: 'hall', x0: 1, x1: W - 2, y0: 1, y1: H - 2, doors: [] };
  rooms.push(room);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) roomOf[idx(x, y)] = room.id;
  for (let y = DANCE.y0; y <= DANCE.y1; y++) for (let x = DANCE.x0; x <= DANCE.x1; x++) ground[idx(x, y)] = 'dancefloor';

  const activity = (type, game, x, y, w = 1, h = 1) => {
    const a = PARTY_ACTIVITIES.find((v) => v.game === game);
    return place(room, type, x, y, w, h, { activity: { id: `party-${game}`, game, title: a.title, difficulty: E.PARTY.difficulty, seed: 9100 + items.length } });
  };

  // The stage with its microphone; the DJ booth over the dance floor.
  place(room, 'stage', 2, 1, 7, 2);
  activity('micstand', 'carols', 5, 4);
  activity('djbooth', 'dance', 20, 6, 4, 1);
  // The bar along the right wall, the bartender behind it; the punch bowl at its end.
  const bar = place(room, 'partybar', 39, 6, 1, 8, { interact: 'bar' });
  items.push({ id: items.length, type: 'receptionist', x: 40, y: 9, w: 2, h: 1, room: room.id, solid: true });
  const receptionist = items[items.length - 1];
  place(room, 'punchbowl', 36, 3, 2, 1);
  // The buffet on the left; the tree and the Secret Santa table bottom left; the photo booth bottom right.
  activity('buffet', 'buffet', 2, 10, 6, 1);
  const tree = place(room, 'xmastree', 2, 19, 3, 2);
  activity('santatable', 'giftwrap', 6, 21, 3, 1);
  activity('photobooth', 'photobooth', 38, 20, 3, 2);
  // Party tables with chairs, poinsettias in the corners.
  for (const x of [14, 20, 26, 32]) {
    if (!place(room, 'partytable', x, 22, 2, 1)) continue;
    for (let i = 0; i < 2; i++) {
      decor(room, 'chair', x + i, 21);
      decor(room, 'chairup', x + i, 23);
    }
  }
  for (const [x, y] of [[10, 1], [33, 1], [42, 1], [1, 26], [12, 26], [31, 26], [42, 26]]) place(room, 'poinsettia', x, y);

  const fl = {
    floor: 0, party: true, foreign: true, dept: dept.id, w: W, h: H, tiles, roomOf, rooms, items, entrance, ground,
    look: { carpet: ['#6a2433', '#5e202e'], wall: '#6a2433' },
  };
  fl.arrive = { x: DOOR_X + 1, y: 2.5 };
  Object.assign(fl, { elevator: null, hrDesk: null, turnstile: null, posters: [], myDesk: null, tasks: [], npcs: [] });
  fl.receptionist = receptionist; // the bartender's spot (PartyScene.frontDesk)
  fl.hrRep = { x: 36, y: 15 }; // HR keeps an eye on the bar
  fl.bar = bar;
  fl.tree = tree;
  fl.disco = { x: (DANCE.x0 + DANCE.x1 + 1) / 2, y: (DANCE.y0 + DANCE.y1 + 1) / 2 };
  fl.activities = items.filter((it) => it.activity);
  fl.danceSpots = [[19.5, 10.5], [24.5, 10.5], [18.5, 13.5], [25.5, 13.5], [20.5, 15.5], [23.5, 15.5]].map(([x, y]) => ({ x, y }));
  fl.mingleSpots = [[12.5, 8.5], [31.5, 8.5], [10.5, 17.5], [33.5, 17.5], [17.5, 25.5], [28.5, 25.5], [35.5, 12.5], [8.5, 7.5]].map(([x, y]) => ({ x, y }));
  fl.walk = buildWalkable(fl);
  // Behind the counter is the bartender's: nobody walks round its ends to stand there.
  for (let y = bar.y; y < bar.y + bar.h; y++) for (let x = bar.x + bar.w; x < W - 1; x++) fl.walk[idx(x, y)] = 0;
  fl.dist = bfs(fl, fl.walk, DOOR_X, 1);
  return fl;
}

/**
 * Who comes to the party in `year`: up to PARTY.guests colleagues from the floors you know (1..maxFloor), each with their
 * own department, never one the CEO fired; the first PARTY.dancers stand on the dance floor. The same on every load.
 */
export function partyGuests(s, year) {
  const hall = buildPartyHall();
  const fired = s.fired || {};
  const pool = [];
  for (let f = 1; f <= Math.min(s.maxFloor, E.FLOORS); f++) {
    const fl = buildFloor(f);
    for (const n of fl.npcs) if (!fired[n.seed]) pool.push({ seed: n.seed, dept: fl.dept });
  }
  const rng = createRng(year * 7919 + (s.cast || 0));
  const picked = rng.sample(pool, Math.min(E.PARTY.guests, pool.length));
  const dancers = Math.min(E.PARTY.dancers, hall.danceSpots.length);
  return picked.map((g, i) => {
    const dancer = i < dancers;
    const spot = dancer ? hall.danceSpots[i] : hall.mingleSpots[(i - dancers) % hall.mingleSpots.length];
    return { ...g, x: spot.x, y: spot.y, dancer };
  });
}
