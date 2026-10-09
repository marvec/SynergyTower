// Assigns mini-game tasks to station furniture on a generated floor.
import { createRng } from './rng.js';
import { generateFloor, buildWalkable, bfs, isItemReachable, STATION_GAMES } from './floorgen.js';
import { stationCount } from './economy.js';
import { taskTitle } from '../data/taskTitles.js';

export const ALL_GAMES = [
  'inbox', 'compose', 'typing', 'spreadsheet', 'bingo', 'calendar', 'timing', 'memory',
  'simon', 'math', 'quiz', 'order', 'whack', 'stealth', 'stocks', 'coffee',
];

const cache = new Map();

/** Full playable floor: layout + walkability + assigned tasks. Deterministic per floor number. */
export function buildFloor(floor) {
  if (cache.has(floor)) return cache.get(floor);
  const fl = generateFloor(floor);
  const rng = createRng(floor * 104729 + 7);
  const walk = buildWalkable(fl);
  const sx = Math.floor(fl.spawn.x);
  const sy = Math.floor(fl.spawn.y);
  const dist = bfs(fl, walk, sx, sy);

  const candidates = rng.shuffle(fl.items.filter((it) => it.station && isItemReachable(fl, walk, dist, it)));
  const wanted = stationCount(floor);
  const used = new Map();
  const usedTitles = new Map();
  const chosen = [];
  // Greedy variety: each pick prefers the station whose best game is least used so far.
  while (chosen.length < wanted && candidates.length) {
    let best = -1;
    let bestGame = null;
    let bestScore = Infinity;
    candidates.forEach((it, i) => {
      for (const g of STATION_GAMES[it.station]) {
        const sameRoomPenalty = chosen.some((c) => c.room === it.room) ? 0.5 : 0;
        const score = (used.get(g) || 0) + sameRoomPenalty + rng.next() * 0.3;
        if (score < bestScore) {
          bestScore = score;
          best = i;
          bestGame = g;
        }
      }
    });
    const it = candidates.splice(best, 1)[0];
    used.set(bestGame, (used.get(bestGame) || 0) + 1);
    const variant = usedTitles.get(bestGame) || 0;
    usedTitles.set(bestGame, variant + 1);
    const base = (floor - 1) / 39;
    it.task = {
      id: `f${floor}-${it.id}`,
      game: bestGame,
      title: taskTitle(bestGame, fl.dept, variant + floor),
      difficulty: Math.min(1, Math.max(0, base * 0.85 + rng.float(0, 0.15))),
      seed: floor * 1000 + it.id,
    };
    chosen.push(it);
  }

  const reachable = [];
  for (let i = 0; i < walk.length; i++) if (dist[i] >= 0) reachable.push(i);
  const npcCount = 4 + Math.floor(floor / 5);
  const npcs = [];
  for (let i = 0; i < npcCount; i++) {
    const t = rng.pick(reachable);
    npcs.push({ x: (t % fl.w) + 0.5, y: Math.floor(t / fl.w) + 0.5, seed: floor * 31 + i });
  }

  const built = { ...fl, walk, dist, tasks: chosen, npcs };
  cache.set(floor, built);
  return built;
}
