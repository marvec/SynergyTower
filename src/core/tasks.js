// Assigns mini-game tasks to station furniture on a generated floor.
import { createRng } from './rng.js';
import { generateFloor, buildWalkable, bfs, isItemReachable, STATION_GAMES } from './floorgen.js';
import { stationCount, ROOF } from './economy.js';
import { taskTitle } from '../data/taskTitles.js';
import { ACTIVITIES } from '../data/vacation.js';
import { CHORES } from '../data/home.js';

export const ALL_GAMES = [
  'inbox', 'compose', 'typing', 'spreadsheet', 'bingo', 'calendar', 'timing', 'memory',
  'simon', 'math', 'quiz', 'order', 'whack', 'stealth', 'stocks', 'coffee', 'jargon',
  'replyall', 'password', 'cables', 'orgchart', 'meeting', 'pitch', 'fridge', 'expense', 'frogger',
  'karaoke', 'tailgate', 'defender', 'plant', 'chart', 'feedback', 'lostpw',
];
/** The roof's own mini-game (core/roof.js): a cigarette with the smokers. */
export const ROOF_GAMES = ['cigarette'];
/** Every kind of mini-game the "games played" counter, the title and the Generalist badge count: the station games plus
 *  the holiday activities at the vacation hotel, the chores at home and the roof's cigarette (not the HR review). */
export const COUNTED_GAMES = [...ALL_GAMES, ...ACTIVITIES.map((a) => a.game), ...CHORES.map((c) => c.game), ...ROOF_GAMES];

/** Furniture with a computer on it, in order of preference for the terminal. */
const TERMINAL_TYPES = ['desk', 'headsetdesk', 'tradingdesk', 'reception', 'bossdesk'];

/** Desks that can become yours, in order of preference. */
const DESK_TYPES = ['desk', 'headsetdesk', 'tradingdesk', 'bossdesk'];

/** Games played partly on the floor (src/scenes/floorQuest.js): at most one of them per floor. */
const QUEST_GAMES = new Set(['feedback', 'lostpw']);
export const CHECKIN_GAME = 'jargon';
const FLOORS = 40;

const cache = new Map();

/**
 * Full playable floor: layout + walkability + assigned tasks. Deterministic per floor number.
 * Games are spread across the whole tower, so the first call plans all floors at once (~20 ms): each floor takes the
 * games used least so far tower-wide, which round-robins all of them every few floors instead of saving some for later.
 */
export function buildFloor(floor) {
  if (!cache.has(floor)) {
    const usage = new Map(); // game -> { n: times used, last: last floor }
    for (let f = 1; f <= Math.max(FLOORS, floor); f++) cache.set(f, planFloor(f, usage));
  }
  return cache.get(floor);
}

function planFloor(floor, usage) {
  const fl = generateFloor(floor);
  const rng = createRng(floor * 104729 + 7);
  const walk = buildWalkable(fl);
  const sx = Math.floor(fl.spawn.x);
  const sy = Math.floor(fl.spawn.y);
  const dist = bfs(fl, walk, sx, sy);

  const candidates = rng.shuffle(fl.items.filter((it) => it.station && isItemReachable(fl, walk, dist, it)));
  const wanted = stationCount(floor);
  const onFloor = new Map();
  const chosen = [];
  // Greedy variety: pick the game used least across the tower (a fresh repeat on the previous floor counts extra, a second
  // copy on this floor or a second floor quest much more), then a station for it, preferring rooms that have no task yet.
  const roomPenalty = (it) => (chosen.some((c) => c.room === it.room) ? 0.5 : 0);
  const hasQuest = () => chosen.some((c) => QUEST_GAMES.has(c.task.game));
  const assign = (it, game) => {
    candidates.splice(candidates.indexOf(it), 1);
    const variant = onFloor.get(game) || 0;
    onFloor.set(game, variant + 1);
    const u = usage.get(game) || { n: 0, last: -9 };
    usage.set(game, { n: u.n + 1, last: floor });
    const base = (floor - 1) / 39;
    it.task = {
      id: `f${floor}-${it.id}`,
      game,
      title: taskTitle(game, fl.dept, variant + floor),
      difficulty: Math.min(1, Math.max(0, base * 0.85 + rng.float(0, 0.15))),
      seed: floor * 1000 + it.id,
    };
    chosen.push(it);
    return it.task;
  };
  // The ground-floor front desk is the new hire's check-in (state.js `lobby`): always Jargon Detector, a quick and fun
  // first game.
  const frontDesk = floor === 1 && candidates.find((it) => it.station === 'reception');
  if (frontDesk) assign(frontDesk, CHECKIN_GAME).checkin = true;
  while (chosen.length < wanted && candidates.length) {
    const offers = new Map();
    candidates.forEach((it, i) => {
      for (const g of STATION_GAMES[it.station]) {
        if (!offers.has(g)) offers.set(g, []);
        offers.get(g).push(i);
      }
    });
    let bestGame = null;
    let bestScore = Infinity;
    for (const [g, list] of offers) {
      const u = usage.get(g) || { n: 0, last: -9 };
      const score =
        u.n +
        (u.last >= floor - 2 ? 0.6 : 0) +
        (onFloor.get(g) || 0) * 50 +
        (QUEST_GAMES.has(g) && hasQuest() ? 50 : 0) +
        Math.min(...list.map((i) => roomPenalty(candidates[i]))) * 0.5 +
        rng.next() * 0.3;
      if (score < bestScore) {
        bestScore = score;
        bestGame = g;
      }
    }
    let best = -1;
    let bestStation = Infinity;
    for (const i of offers.get(bestGame)) {
      const score = roomPenalty(candidates[i]) + rng.next() * 0.3;
      if (score < bestStation) {
        bestStation = score;
        best = i;
      }
    }
    assign(candidates[best], bestGame);
  }

  // One computer without a task opens the workstation terminal (prefer plain desks, then any desk with a PC).
  const pcs = fl.items.filter((it) => !it.task && TERMINAL_TYPES.includes(it.type) && isItemReachable(fl, walk, dist, it));
  pcs.sort((a, b) => TERMINAL_TYPES.indexOf(a.type) - TERMINAL_TYPES.indexOf(b.type) || a.id - b.id);
  const best = pcs.filter((it) => it.type === pcs[0]?.type);
  if (best.length) rng.pick(best).terminal = true;

  const reachable = [];
  for (let i = 0; i < walk.length; i++) if (dist[i] >= 0) reachable.push(i);
  const npcCount = 4 + Math.floor(floor / 5);
  const npcs = [];
  for (let i = 0; i < npcCount; i++) {
    const t = rng.pick(reachable);
    npcs.push({ x: (t % fl.w) + 0.5, y: Math.floor(t / fl.w) + 0.5, seed: floor * 31 + i });
  }

  // Your own desk (core/desk.js): the first free desk, picked without the RNG so nothing else on the floor moves.
  const free = fl.items.filter((it) => !it.task && !it.terminal && DESK_TYPES.includes(it.type) && isItemReachable(fl, walk, dist, it));
  free.sort((a, b) => DESK_TYPES.indexOf(a.type) - DESK_TYPES.indexOf(b.type) || a.id - b.id);
  const myDesk = free[0] || null;

  // The roof floors' fire-escape window (core/roof.js), also picked without the RNG.
  const fireEscape = ROOF.floors.includes(floor) ? pickFireEscape(fl, walk, dist, floor) : null;

  return { ...fl, walk, dist, tasks: chosen, npcs, myDesk, fireEscape };
}

/** Rooms a smoker sneaks out from, best first; any other room with an outer window will do. */
const ESCAPE_ROOMS = ['kitchen', 'copy', 'restroom', 'meeting'];

/**
 * The fire-escape window: an outer-wall window (row 0, not the elevator lobby: see FloorView.hasWindow) with a reachable
 * free tile below it. Best in a kitchen or copy room; among those, one picked by the floor number. { x, y: 0 } or null.
 */
function pickFireEscape(fl, walk, dist, floor) {
  const spots = [];
  for (let x = 1; x < fl.w - 1; x++) {
    const below = fl.w + x;
    const room = fl.rooms[fl.roomOf[below]];
    if (fl.tiles[x] !== 1 || !walk[below] || dist[below] < 0 || !room || room.type === 'elevator') continue;
    if (!walk[below + fl.w]) continue; // room to stand in front of it
    const rank = ESCAPE_ROOMS.indexOf(room.type);
    spots.push({ x, rank: rank < 0 ? ESCAPE_ROOMS.length : rank });
  }
  if (!spots.length) return null;
  const best = Math.min(...spots.map((p) => p.rank));
  const pool = spots.filter((p) => p.rank === best);
  return { x: pool[(floor * 7) % pool.length].x, y: 0 };
}
