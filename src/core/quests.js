// Floor quests: tasks played on the floor itself (find a colleague, search the whiteboards) before the desk part.
// Pure helpers, no DOM.

/**
 * Picks `count` reachable floor tiles, spread out across the floor, for temporary props (mobile whiteboards).
 * Prefers tiles backed by a wall or furniture (something blocked right above), keeps away from the `avoid` points
 * (e.g. the player and the quest station) and from the elevator lobby.
 */
export function placeProps(fl, rng, count, avoid = []) {
  const { w, h, walk, dist } = fl;
  const cands = [];
  for (let y = 4; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!walk[i] || dist[i] < 0) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r ?? 4))) continue;
      // Keep corridors usable: at least three walkable neighbours.
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => walk[(y + dy) * w + x + dx]).length;
      if (open < 3) continue;
      cands.push({ x, y, backed: !walk[(y - 1) * w + x] });
    }
  }
  const pool = cands.some((c) => c.backed) && cands.filter((c) => c.backed).length >= count * 3 ? cands.filter((c) => c.backed) : cands;
  const out = [];
  while (out.length < count && pool.length) {
    // Farthest-point sampling over a random sample keeps it fast and still varied.
    let best = null;
    let bestD = -1;
    for (let k = 0; k < 40; k++) {
      const c = rng.pick(pool);
      const d = out.length ? Math.min(...out.map((o) => Math.hypot(o.x - c.x, o.y - c.y))) : rng.next();
      if (d > bestD) {
        bestD = d;
        best = c;
      }
    }
    out.push(best);
    pool.splice(pool.indexOf(best), 1);
  }
  return out.map(({ x, y }) => ({ x, y }));
}

/** Speed bonus 0..1: full when at least `fullAt` of the time limit is still left. */
export function speedBonus(left, limit, fullAt = 0.45) {
  return Math.max(0, Math.min(1, left / (limit * fullAt)));
}
