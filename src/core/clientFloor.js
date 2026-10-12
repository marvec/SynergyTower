// The client's office at the end of a business trip (spec 2026-10-12-business-trip): one big floor, much larger than the
// tower's. Two corridors run its full width, joined in the middle by a marble atrium; rooms line both sides of each
// corridor, with a boardroom at the top and the reception lobby (and the way out) at the bottom. Deterministic per trip floor.
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs, isItemReachable, STATION_GAMES, T_FLOOR } from './floorgen.js';
import { TRIP_STATIONS } from './economy.js';
import { departmentForFloor, DEPARTMENTS } from '../data/departments.js';
import { taskTitle } from '../data/taskTitles.js';
import { CLIENTS } from '../data/trip.js';

export const CLIENT_W = 64;
export const CLIENT_H = 46;
// Room bands, top to bottom: A above corridor 1 (rows 12-13), B below it, C above corridor 2 (rows 31-32), D below it.
const A = { y0: 1, y1: 10, wallY: 11, above: true };
const B = { y0: 15, y1: 21, wallY: 14, above: false };
const CB = { y0: 23, y1: 29, wallY: 30, above: true };
const D = { y0: 34, y1: 44, wallY: 33, above: false };
const ATRIUM = { x0: 26, x1: 37, y0: 14, y1: 30 };
const BOARD = { x0: 25, x1: 38 };
const LOBBY = { x0: 24, x1: 39 };
const ENTRANCE_X = 31;
/** Floor quests need the tower's whiteboards and colleagues: not at the client's. */
const NO_GAMES = new Set(['feedback', 'lostpw']);
const SIDE_TYPES = ['openplan', 'openplan', 'openplan', 'openplan', 'meeting', 'meeting', 'meeting', 'kitchen', 'kitchen', 'manager', 'manager', 'copy', 'copy', 'restroom', 'special', 'special'];

const cache = new Map();

/** The client's office for the trip offered on `floor` (10 or 30). */
export function buildClientFloor(floor) {
  if (!cache.has(floor)) cache.set(floor, generateClientFloor(floor));
  return cache.get(floor);
}

function generateClientFloor(floor) {
  const client = CLIENTS[floor];
  const rng = createRng(floor * 6007 + 41);
  const dept = DEPARTMENTS.find((d) => d.id === client.dept) || departmentForFloor(floor);
  const P = createPlanner(CLIENT_W, CLIENT_H, rng, dept);
  const { tiles, roomOf, idx, setWall, rooms, items, addRoom, vWall, place, station, decor, fillers, reserved } = P;
  const inAtrium = (x) => x >= ATRIUM.x0 && x <= ATRIUM.x1;

  for (let x = 0; x < CLIENT_W; x++) {
    setWall(x, 0);
    setWall(x, CLIENT_H - 1);
    for (const y of [A.wallY, B.wallY, 22, CB.wallY, D.wallY]) if (!(inAtrium(x) && y !== A.wallY && y !== D.wallY)) setWall(x, y);
  }
  for (let y = 0; y < CLIENT_H; y++) {
    setWall(0, y);
    setWall(CLIENT_W - 1, y);
  }
  vWall(BOARD.x0 - 1, A);
  vWall(BOARD.x1 + 1, A);
  for (const band of [B, CB]) {
    vWall(ATRIUM.x0 - 1, band);
    vWall(ATRIUM.x1 + 1, band);
  }
  vWall(LOBBY.x0 - 1, D);
  vWall(LOBBY.x1 + 1, D);

  // Side regions of each band, each split in two rooms.
  const slots = [];
  const split = (a, b, band) => {
    const cut = rng.int(a + 9, b - 9);
    vWall(cut, band);
    slots.push({ band, r: [a, cut - 1] }, { band, r: [cut + 1, b] });
  };
  split(1, BOARD.x0 - 2, A);
  split(BOARD.x1 + 2, CLIENT_W - 2, A);
  for (const band of [B, CB]) {
    split(1, ATRIUM.x0 - 2, band);
    split(ATRIUM.x1 + 2, CLIENT_W - 2, band);
  }
  split(1, LOBBY.x0 - 2, D);
  split(LOBBY.x1 + 2, CLIENT_W - 2, D);
  const types = rng.shuffle(SIDE_TYPES);
  rng.shuffle(slots).forEach((slot, i) => addRoom(types[i], slot.r[0], slot.r[1], slot.band, types[i] === 'openplan' ? 2 : 1));
  const board = addRoom('boardroom', BOARD.x0, BOARD.x1, A, 2);
  const lobby = addRoom('reception', LOBBY.x0, LOBBY.x1, D, 1, 8);
  const atrium = addRoom('atrium', ATRIUM.x0, ATRIUM.x1, { y0: ATRIUM.y0, y1: ATRIUM.y1 }, 0);

  // The way in (and out): a double door in the bottom wall of the lobby.
  for (const x of [ENTRANCE_X, ENTRANCE_X + 1]) {
    tiles[idx(x, CLIENT_H - 1)] = T_FLOOR;
    for (let y = D.y0; y < CLIENT_H - 1; y++) if (y >= CLIENT_H - 4 || y <= D.y0 + 1) reserved[idx(x, y)] = 1;
  }
  const entrance = { x: ENTRANCE_X, y: CLIENT_H - 1, w: 2 };

  for (const room of rooms) {
    if (room === board) fillers.special(room, 'boardroom');
    else if (room === lobby) furnishLobby(room);
    else if (room === atrium) furnishAtrium(room);
    else fillers[room.type]?.(room);
  }

  function furnishLobby(r) {
    const cx = ENTRANCE_X + 1;
    station(r, 'reception', 'reception', cx - 2, r.y0 + 4, 4, 1);
    place(r, 'fountain', cx - 7, r.y0 + 6, 2, 2);
    place(r, 'fountain', cx + 5, r.y0 + 6, 2, 2);
    place(r, 'sofa', r.x0, r.y0 + 3, 1, 2);
    place(r, 'sofa', r.x1, r.y0 + 3, 1, 2);
    place(r, 'sofa', r.x0, r.y1 - 3, 1, 2);
    place(r, 'sofa', r.x1, r.y1 - 3, 1, 2);
    station(r, 'directory', 'directory', r.x0 + 2, r.y0);
    station(r, 'plant', 'plant', r.x1 - 1, r.y0);
    place(r, 'plant', r.x0, r.y1);
    place(r, 'plant', r.x1, r.y1);
    place(r, 'plant', cx - 3, r.y1);
    place(r, 'plant', cx + 2, r.y1);
    place(r, 'vending', r.x1 - 2, r.y1);
  }

  function furnishAtrium(r) {
    // Keep rows next to the corridors clear (the atrium opens onto both); the middle has the fountain and a coffee bar.
    const cx = (r.x0 + r.x1 + 1) / 2; // 32
    place(r, 'fountain', cx - 1, 21, 2, 2);
    for (const [x, y] of [[r.x0, 16], [r.x1, 16], [r.x0, 28], [r.x1, 28], [cx - 3, 19], [cx + 2, 19], [cx - 3, 24], [cx + 2, 24]]) place(r, 'plant', x, y);
    place(r, 'sofa', r.x0, 19, 1, 2);
    place(r, 'sofa', r.x1, 19, 1, 2);
    station(r, 'watercooler', 'watercooler', r.x0, 24);
    station(r, 'espressobar', 'espressobar', r.x1, 24);
    if (station(r, 'kitchentable', 'kitchentable', r.x0 + 2, 26, 2, 1)) {
      decor(r, 'stool', r.x0 + 1, 26);
      decor(r, 'stool', r.x0 + 4, 26);
    }
    if (station(r, 'kitchentable', 'kitchentable', r.x1 - 3, 17, 2, 1)) {
      decor(r, 'stool', r.x1 - 4, 17);
      decor(r, 'stool', r.x1 - 1, 17);
    }
    station(r, 'easel', 'easel', r.x0 + 2, 16);
  }

  const fl = { floor, trip: floor, client, look: client.look, dept: dept.id, w: CLIENT_W, h: CLIENT_H, tiles, roomOf, rooms, items, entrance };
  fl.spawn = { x: ENTRANCE_X + 1, y: CLIENT_H - 2.2 };
  Object.assign(fl, { elevator: null, hrDesk: null, hrRep: null, receptionist: null, turnstile: null, posters: [], myDesk: null });
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, ENTRANCE_X, CLIENT_H - 2);

  // Tasks: the most varied set of games the stations allow, spread over the rooms.
  const candidates = rng.shuffle(items.filter((it) => it.station && isItemReachable(fl, fl.walk, fl.dist, it)));
  const used = new Map();
  fl.tasks = [];
  const base = (floor - 1) / 39;
  while (fl.tasks.length < TRIP_STATIONS && candidates.length) {
    let best = null;
    let bestScore = Infinity;
    for (const it of candidates)
      for (const game of STATION_GAMES[it.station]) {
        if (NO_GAMES.has(game)) continue;
        const score = (used.get(game) || 0) * 10 + (fl.tasks.some((t) => t.room === it.room) ? 1 : 0) + rng.next();
        if (score < bestScore) {
          bestScore = score;
          best = { it, game };
        }
      }
    if (!best) break;
    const { it, game } = best;
    candidates.splice(candidates.indexOf(it), 1);
    const variant = used.get(game) || 0;
    used.set(game, variant + 1);
    it.task = {
      id: `trip${floor}-${it.id}`,
      game,
      title: taskTitle(game, dept.id, variant + floor + 7),
      difficulty: Math.min(1, Math.max(0, base * 0.85 + rng.float(0, 0.15))),
      seed: 50000 + floor * 1000 + it.id,
    };
    fl.tasks.push(it);
  }

  const reachable = [];
  for (let i = 0; i < fl.walk.length; i++) if (fl.dist[i] >= 0) reachable.push(i);
  fl.npcs = [];
  for (let i = 0; i < 12 + Math.floor(floor / 5); i++) {
    const t = rng.pick(reachable);
    fl.npcs.push({ x: (t % fl.w) + 0.5, y: Math.floor(t / fl.w) + 0.5, seed: 70000 + floor * 100 + i });
  }
  return fl;
}
