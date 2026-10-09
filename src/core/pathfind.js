// A* on the walkable tile grid, 8-directional without corner cutting. Pure.
export function findPath(walk, w, h, sx, sy, tx, ty, maxNodes = 4000) {
  if (sx === tx && sy === ty) return [];
  if (!walk[ty * w + tx]) return null;
  const start = sy * w + sx;
  const goal = ty * w + tx;
  const g = new Map([[start, 0]]);
  const came = new Map();
  const open = [{ i: start, f: 0 }];
  const closed = new Set();
  const hdist = (i) => {
    const dx = Math.abs((i % w) - tx);
    const dy = Math.abs(((i / w) | 0) - ty);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  };
  let expanded = 0;
  while (open.length && expanded < maxNodes) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const { i: cur } = open.splice(bi, 1)[0];
    if (cur === goal) {
      const path = [];
      let c = cur;
      while (c !== start) {
        path.push({ x: c % w, y: (c / w) | 0 });
        c = came.get(c);
      }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    expanded++;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!walk[n] || closed.has(n)) continue;
        if (dx && dy && (!walk[cy * w + nx] || !walk[ny * w + cx])) continue;
        const cost = g.get(cur) + (dx && dy ? 1.41 : 1);
        if (cost < (g.get(n) ?? Infinity)) {
          g.set(n, cost);
          came.set(n, cur);
          open.push({ i: n, f: cost + hdist(n) });
        }
      }
  }
  return null;
}
