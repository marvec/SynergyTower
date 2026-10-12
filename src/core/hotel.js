// The vacation hotel (spec 2026-10-13-vacation): a tropical five-star resort. The hotel building runs along the top
// (your suite, the lobby with the main entrance, the restaurant); terrace doors open onto the garden with the pool, the
// tiki bar and the spa cabana, then the beach and a jetty into the sea. Water is T_WATER (seen, not walked on); the
// outdoor floor styles come from `ground`, and the outdoor boundary walls are hedges (`hedgeFrom`). Deterministic.
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs, T_FLOOR, T_WATER } from './floorgen.js';
import { VACATION_FLOOR } from './economy.js';
import { DEPARTMENTS } from '../data/departments.js';
import { ACTIVITIES } from '../data/vacation.js';

export { ACTIVITIES };
export const HOTEL_W = 48;
export const HOTEL_H = 42;
const WALL_Y = 12; // the hotel's back wall, onto the garden
const GARDEN = { y0: 13, y1: 27 };
const BEACH = { y0: 28, y1: 33 };
const SEA_Y = 34;
const SUITE = { x0: 1, x1: 14 };
const LOBBY = { x0: 16, x1: 31 };
const RESTAURANT = { x0: 33, x1: 46 };
const POOL = { x0: 28, x1: 36, y0: 16, y1: 20 };
const JETTY = { x0: 23, x1: 24, y1: 38 };
const ENTRANCE_X = 23;

let cached = null;

export function buildHotel() {
  return (cached ||= generateHotel());
}

function generateHotel() {
  const W = HOTEL_W;
  const H = HOTEL_H;
  const rng = createRng(20262013);
  const dept = DEPARTMENTS.find((d) => d.id === 'exec');
  const P = createPlanner(W, H, rng, dept);
  const { tiles, roomOf, idx, setWall, rooms, items, place, decor } = P;
  const ground = new Array(W * H).fill(null);
  const area = (type, x0, x1, y0, y1) => {
    const room = { id: rooms.length, type, x0, x1, y0, y1, doors: [] };
    rooms.push(room);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) roomOf[idx(x, y)] = room.id;
    return room;
  };
  const open = (x, y) => (tiles[idx(x, y)] = T_FLOOR);
  const paint = (style, x0, x1, y0, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ground[idx(x, y)] = style;
  };

  // The building: outer walls, the back wall onto the garden, the walls between the three rooms (doors at rows 9-10).
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, WALL_Y);
  }
  for (let y = 0; y < SEA_Y; y++) {
    setWall(0, y);
    setWall(W - 1, y);
  }
  for (let y = 1; y < WALL_Y; y++) {
    setWall(SUITE.x1 + 1, y);
    setWall(RESTAURANT.x0 - 1, y);
  }
  for (const y of [9, 10]) {
    open(SUITE.x1 + 1, y);
    open(RESTAURANT.x0 - 1, y);
  }
  // Terrace doors: the suite's balcony, the lobby's garden doors, the restaurant's terrace.
  for (const x of [6, 7, 22, 23, 24, 25, 39, 40]) open(x, WALL_Y);
  for (const x of [ENTRANCE_X, ENTRANCE_X + 1]) open(x, 0);
  const entrance = { x: ENTRANCE_X, y: 0, w: 2 };

  // The sea along the bottom (a jetty runs out into it) and the pool in the garden.
  for (let y = SEA_Y; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x >= JETTY.x0 && x <= JETTY.x1 && y <= JETTY.y1) continue;
      tiles[idx(x, y)] = T_WATER;
      ground[idx(x, y)] = y === SEA_Y ? 'surf' : 'sea';
    }
  for (let y = POOL.y0; y <= POOL.y1; y++)
    for (let x = POOL.x0; x <= POOL.x1; x++) {
      tiles[idx(x, y)] = T_WATER;
      ground[idx(x, y)] = 'pool';
    }

  const suite = area('suite', SUITE.x0, SUITE.x1, 1, WALL_Y - 1);
  const lobby = area('hotellobby', LOBBY.x0, LOBBY.x1, 1, WALL_Y - 1);
  const restaurant = area('restaurant', RESTAURANT.x0, RESTAURANT.x1, 1, WALL_Y - 1);
  const garden = area('garden', 1, W - 2, GARDEN.y0, GARDEN.y1);
  const beach = area('beach', 1, W - 2, BEACH.y0, BEACH.y1);
  const jetty = area('jetty', JETTY.x0, JETTY.x1, SEA_Y, JETTY.y1);
  paint('grass', 1, W - 2, GARDEN.y0, GARDEN.y1);
  paint('path', 6, 40, GARDEN.y0, GARDEN.y0);
  paint('path', ENTRANCE_X, ENTRANCE_X + 1, GARDEN.y0, GARDEN.y1);
  paint('deck', POOL.x0 - 1, POOL.x1 + 1, POOL.y0 - 1, POOL.y1 + 1);
  paint('pool', POOL.x0, POOL.x1, POOL.y0, POOL.y1);
  paint('sand', 1, W - 2, BEACH.y0, BEACH.y1);
  paint('deck', JETTY.x0, JETTY.x1, SEA_Y, JETTY.y1);

  const activity = (room, type, game, x, y, w = 1, h = 1) => {
    const a = ACTIVITIES.find((v) => v.game === game);
    return place(room, type, x, y, w, h, { activity: { id: `hol-${game}`, game, title: a.title, difficulty: 0, seed: 7000 + items.length } });
  };

  // Your suite: the bed, nightstands, a wardrobe, the suitcase you never unpacked.
  activity(suite, 'hotelbed', 'sleep', 5, 1, 3, 2);
  place(suite, 'nightstand', 4, 1);
  place(suite, 'nightstand', 8, 1);
  place(suite, 'wardrobe', 12, 1, 2, 1);
  place(suite, 'pottedpalm', 1, 1);
  place(suite, 'suitcase', 2, 5);
  place(suite, 'sofa', 1, 8, 1, 2);
  place(suite, 'pottedpalm', 14, 11);
  decor(suite, 'rug', 5, 5, 3, 2);

  // The lobby: reception (with a receptionist behind it), fountains, sofas, potted palms.
  place(lobby, 'reception', 18, 3, 4, 1);
  items.push({ id: items.length, type: 'receptionist', x: 19, y: 2, w: 2, h: 1, room: lobby.id, solid: true });
  const receptionist = items[items.length - 1];
  place(lobby, 'fountain', 18, 7, 2, 2);
  place(lobby, 'fountain', 28, 7, 2, 2);
  place(lobby, 'sofa', LOBBY.x0, 4, 1, 2);
  place(lobby, 'sofa', LOBBY.x1, 4, 1, 2);
  for (const [x, y] of [[LOBBY.x0, 1], [LOBBY.x1, 1], [20, 11], [27, 11]]) place(lobby, 'pottedpalm', x, y);
  place(lobby, 'bellcart', 28, 3);

  // The restaurant: the buffet along the back wall, tables for two.
  activity(restaurant, 'buffet', 'buffet', 36, 1, 6, 1);
  for (const [x, y] of [[35, 5], [41, 5], [35, 8], [42, 8]]) {
    if (!place(restaurant, 'diningtable', x, y, 2, 1)) continue;
    for (let i = 0; i < 2; i++) {
      decor(restaurant, 'chair', x + i, y - 1);
      decor(restaurant, 'chairup', x + i, y + 1);
    }
  }
  for (const [x, y] of [[RESTAURANT.x0, 1], [RESTAURANT.x1, 1], [RESTAURANT.x1, 11]]) place(restaurant, 'pottedpalm', x, y);

  // The garden: the pool (with the beach ball on the deck), the tiki bar, the spa cabana, palms and a hammock.
  activity(garden, 'beachball', 'beachball', 32, POOL.y1 + 1);
  activity(garden, 'tikibar', 'cocktail', 41, 16, 3, 1);
  for (let i = 0; i < 3; i++) decor(garden, 'stool', 41 + i, 17);
  activity(garden, 'massage', 'massage', 8, 18, 2, 1);
  place(garden, 'torch', 6, 17);
  place(garden, 'torch', 11, 17);
  place(garden, 'hammock', 12, 23, 3, 1);
  for (const [x, y] of [[29, 23], [31, 23], [34, 23]]) place(garden, 'lounger', x, y, 1, 2);
  for (const [x, y] of [[2, 15], [15, 15], [19, 18], [45, 21], [3, 24], [18, 25], [38, 26], [44, 26], [9, 26], [27, 26]]) place(garden, 'palm', x, y);
  for (const [x, y] of [[4, 20], [16, 21], [26, 18], [38, 22], [21, 14], [30, 14], [44, 14]]) decor(garden, 'flowers', x, y);

  // The beach: sun loungers under parasols, a sandcastle spot, the lifeguard; the swim ladder at the end of the jetty.
  activity(beach, 'sunbed', 'sunbathe', 8, 29, 1, 2);
  for (const x of [5, 11, 14, 17]) place(beach, 'sunbed', x, 29, 1, 2);
  activity(beach, 'sandcastle', 'sandcastle', 33, 30);
  place(beach, 'lifeguard', 40, 29);
  place(beach, 'palm', 2, 28);
  place(beach, 'palm', 45, 28);
  activity(jetty, 'swimladder', 'swim', JETTY.x0, JETTY.y1, 2, 1);

  const look = { carpet: ['#2f7f86', '#33878e'], wall: '#e6d3ad' };
  const fl = {
    floor: VACATION_FLOOR, hotel: true, foreign: true, look, dept: dept.id, w: W, h: H, tiles, roomOf, rooms, items, entrance, ground,
    hedgeFrom: WALL_Y + 1,
  };
  fl.arrive = { x: ENTRANCE_X + 1, y: 1.7 };
  Object.assign(fl, { elevator: null, hrDesk: null, hrRep: null, receptionist, turnstile: null, posters: [], myDesk: null, tasks: [] });
  fl.activities = items.filter((it) => it.activity);
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, ENTRANCE_X, 1);

  // Guests on holiday, anywhere they can walk to.
  const reachable = [];
  for (let i = 0; i < fl.walk.length; i++) if (fl.dist[i] >= 0) reachable.push(i);
  fl.npcs = [];
  for (let i = 0; i < 12; i++) {
    const t = rng.pick(reachable);
    fl.npcs.push({ x: (t % W) + 0.5, y: Math.floor(t / W) + 0.5, seed: 90000 + i });
  }
  return fl;
}
