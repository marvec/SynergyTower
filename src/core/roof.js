// The roof, a secret level (docs/roof-prompt.md): one roof for the whole tower, reached through a fire-escape window
// on floors 2, 12, 22 and 32 (fl.fireEscape, picked in planFloor). Smokers from the floor below stand by the bench and
// know where the folder on the archive floor above was hidden; a pay telescope looks over the city; the window
// cleaners' cradle rides down the facade; a facilities guard now and then comes out of the roof door, and being caught
// closes the window for the rest of the day. Nothing up here pays. Pure, no DOM: scenes/roof.js runs it.
//
// state.roof = { visits, on, closedDay, spotted: { egg: true }, hints: { floor: label }, smokes, declined, escapes, caught }
//   on         { floor } while the player is on the roof (Continue puts them back at that floor's window)
//   closedDay  the local day (daily.js dayKey) the guard caught the player: the window stays stuck until tomorrow
//   spotted    the telescope's easter eggs found (Spotter badge: all of EGGS)
//   hints      the archive floors whose drawer a smoker has named (the label, for the record)
//   escapes    times the guard saw the player ("?") and lost them again (Not Today)
import * as E from './economy.js';
import { dayKey } from './daily.js';
import { onHold } from './conduct.js';
import { castOf } from './state.js';
import { buildFloor } from './tasks.js';
import { createRng } from './rng.js';
import { createPlanner, buildWalkable, bfs, T_WALL } from './floorgen.js';
import { DEPARTMENTS } from '../data/departments.js';
import * as A from './archive.js';
import { ROOF_EGGS } from './achievements.js';

export const ROOF = E.ROOF;
/** The telescope's easter eggs (the Spotter badge's list). */
export const EGGS = ROOF_EGGS;

export const isRoofFloor = (floor) => ROOF.floors.includes(floor);

/** The career's roof record (saves from before it get an empty one). */
export function roof(s) {
  s.roof ||= {};
  const r = s.roof;
  r.visits ||= 0;
  r.spotted ||= {};
  r.hints ||= {};
  r.smokes ||= 0;
  r.declined ||= 0;
  r.escapes ||= 0;
  r.caught ||= 0;
  r.on ??= null;
  r.closedDay ??= null;
  return r;
}

/**
 * Why the fire-escape window will not open now, or null: 'hold' (compliance hold), 'badge' (not checked in yet),
 * 'away' (a trip, holiday, night shift, home office day or party under way, or the archive), 'closed' (the guard caught
 * you today).
 */
export function roofBlock(s, now) {
  if (onHold(s)) return 'hold';
  if (s.lobby !== 'done') return 'badge';
  if (s.trip || s.vacation || s.nightShift || s.home || s.party || s.archive?.task?.inside) return 'away';
  if (s.roof?.closedDay && s.roof.closedDay === dayKey(now)) return 'closed';
  return null;
}

/** Out of the window on `floor` and up the fire escape. { ok, reason }. */
export function enterRoof(s, floor, now) {
  if (!isRoofFloor(floor)) return { ok: false, reason: 'floor' };
  const why = roofBlock(s, now);
  if (why) return { ok: false, reason: why };
  const r = roof(s);
  r.on = { floor };
  r.visits++;
  return { ok: true };
}

/** Back down (the fire escape or the cradle): the floor the player came from. */
export function leaveRoof(s) {
  const r = roof(s);
  const floor = r.on?.floor ?? s.floor;
  r.on = null;
  return floor;
}

/** The guard caught the player: walked down the stairs, and the window is stuck for the rest of the local day. */
export function catchOnRoof(s, now) {
  const floor = leaveRoof(s);
  const r = roof(s);
  r.closedDay = dayKey(now);
  r.caught++;
  return floor;
}

/** Loading a career saved on the roof: back at that floor's window. The floor, or null when not on the roof. */
export function resumeRoof(s) {
  if (!s.roof?.on) return null;
  return leaveRoof(s);
}

/** A cigarette smoked (any result): counted like any mini-game, pays nothing. */
export function completeSmoke(s, game, score) {
  const r = roof(s);
  r.smokes++;
  s.played[game] = (s.played[game] || 0) + 1;
  return { roof: true, stars: E.starsFromScore(score), score };
}

/** "No thanks" to a cigarette (Fresh Air badge). */
export function declineSmoke(s) {
  roof(s).declined++;
}

/** The guard had seen the player ("?") and lost them again. */
export function escapeGuard(s) {
  roof(s).escapes++;
}

/** A telescope easter egg spotted: true if it is new. */
export function spot(s, egg) {
  const r = roof(s);
  if (!EGGS.includes(egg) || r.spotted[egg]) return false;
  r.spotted = { ...r.spotted, [egg]: true };
  return true;
}

export const allSpotted = (s) => EGGS.every((e) => s.roof?.spotted?.[e]);

/**
 * The archive tip for a player who came up from `from`: the next floor up is an archive floor (3, 13, 23, 33) whose
 * folder can still be fetched (not handed in, not given up on, not found yet). { floor, drawer, label } or null. A
 * task already under way keeps the drawer it was given (saves from before archiveDrawer).
 */
export function archiveHint(s, from) {
  const floor = from + 1;
  if (!A.isArchiveFloor(floor)) return null;
  const a = s.archive || {};
  if (a.done?.[floor]) return null;
  const t = a.task?.floor === floor ? a.task : null;
  if (a.asked?.[floor] && !t) return null; // declined or failed: the folder is out of reach for good
  if (t && (t.found || t.folder)) return null;
  const drawer = t ? t.drawer : A.archiveDrawer(s, floor);
  return { floor, drawer, label: A.drawerLabel(A.buildArchive().items[drawer]).text };
}

/** A smoker named the drawer: kept with the career. */
export function noteHint(s, hint) {
  const r = roof(s);
  const fresh = !r.hints[hint.floor];
  r.hints = { ...r.hints, [hint.floor]: hint.label };
  return fresh;
}

/**
 * Who smokes on the roof when the player comes up from `from`: 3 or 4 colleagues of that floor (by cast, never one the
 * CEO fired), the same every visit. [{ seed, dept, x, y }] at the bench.
 */
export function smokersFor(s, from) {
  const fl = buildFloor(from);
  const fired = s.fired || {};
  const pool = fl.npcs.filter((n) => !fired[n.seed]);
  const rng = createRng(from * 131 + castOf(s));
  const n = Math.min(pool.length, rng.chance(0.5) ? 3 : 4);
  const spots = buildRoof().smokeSpots;
  return rng.sample(pool, n).map((p, i) => ({ seed: p.seed, dept: fl.dept, ...spots[i] }));
}

/** The sky over the roof at local time `now`: 'day', 'dusk' (sunset, 18-20 h) or 'night' (20-6 h). */
export function skyMode(now) {
  const h = new Date(now).getHours();
  if (h >= 20 || h < 6) return 'night';
  if (h >= 18) return 'dusk';
  return 'day';
}

// ------------------------------------------------------------------ the guard
/** Tiles that block the guard's view (and the night's light): the parapet and every tall prop (`it.tall`). */
export function roofOpaque(fl) {
  const o = new Uint8Array(fl.w * fl.h);
  for (let i = 0; i < o.length; i++) o[i] = fl.tiles[i] === T_WALL ? 1 : 0;
  for (const it of fl.items) if (it.tall) for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) o[y * fl.w + x] = 1;
  return o;
}

/** Nothing opaque on the straight line between two points (tiles), the end tiles themselves aside. */
export function lineClear(opaque, w, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / 0.2);
  const start = Math.floor(ay) * w + Math.floor(ax);
  const end = Math.floor(by) * w + Math.floor(bx);
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const t = Math.floor(ay + (by - ay) * k) * w + Math.floor(ax + (bx - ax) * k);
    if (t !== start && t !== end && opaque[t]) return false;
  }
  return true;
}

/**
 * Does the guard (at gx, gy, facing fx, fy) see the player at (px, py)? Within ROOF.guardNear all round, or within
 * ROOF.guardSight in front of him (his field of view, ROOF.guardCone), and only with nothing tall in between.
 */
export function guardSees(opaque, w, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const d = Math.hypot(dx, dy);
  if (d > ROOF.guardSight) return false;
  if (d > ROOF.guardNear) {
    const f = Math.hypot(guard.fx, guard.fy) || 1;
    if ((dx * guard.fx + dy * guard.fy) / (d * f) < ROOF.guardCone) return false;
  }
  return lineClear(opaque, w, guard.x, guard.y, player.x, player.y);
}

// ------------------------------------------------------------------ the roof's plan
export const ROOF_W = 40;
export const ROOF_H = 28;
const SHACK = { x: 3, y: 10, w: 5, h: 3 };

let cached = null;

/**
 * The roof: gravel inside a parapet, paving slabs on the paths and by the smokers' bench. Along the top parapet the
 * fire-escape ladder head, the pay telescope and the window cleaners' cradle; the stairwell shack with the roof door on
 * the left, air-conditioning units, the water tank, the antenna mast, the beehives, pigeons and lamps. Deterministic.
 */
export function buildRoof() {
  return (cached ||= generateRoof());
}

function generateRoof() {
  const W = ROOF_W;
  const H = ROOF_H;
  const dept = DEPARTMENTS.find((d) => d.id === 'lobby');
  const P = createPlanner(W, H, createRng(4141), dept);
  const { tiles, idx, setWall, rooms, roomOf, items, place, decor } = P;
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    setWall(0, y);
    setWall(W - 1, y);
  }
  const room = { id: 0, type: 'roof', x0: 1, x1: W - 2, y0: 1, y1: H - 2, doors: [] };
  rooms.push(room);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) roomOf[idx(x, y)] = room.id;
  const ground = new Array(W * H).fill('gravel');
  const slabs = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ground[idx(x, y)] = 'roofslab';
  };
  slabs(1, 1, 38, 2); // along the top parapet: ladder, telescope, cradle
  slabs(2, 13, 9, 14); // in front of the roof door
  slabs(9, 3, 10, 26); // a walkway down the left
  slabs(10, 14, 36, 14); // and across the middle
  slabs(15, 18, 24, 22); // the smokers' corner

  const tall = { tall: true };
  // Along the top parapet.
  const ladder = place(room, 'ladderhead', 6, 1, 1, 1, { interact: 'ladder' });
  const telescope = place(room, 'telescope', 19, 1, 1, 1, { interact: 'telescope' });
  const cradle = place(room, 'cradle', 28, 1, 4, 1, { interact: 'cradle' });
  // The stairwell shack with the roof door (the guard's way out).
  const shack = place(room, 'roofshack', SHACK.x, SHACK.y, SHACK.w, SHACK.h, tall);
  // Air conditioning, the water tank on its legs, the antenna mast.
  for (const [x, y] of [[13, 6], [16, 6], [25, 9], [24, 16], [27, 16], [12, 21]]) place(room, 'acunit', x, y, 2, 2, tall);
  place(room, 'watertank', 32, 5, 3, 3, tall);
  place(room, 'antenna', 35, 21, 1, 1);
  // The smokers' bench and its sand bucket; the company's beehives ("our ESG strategy").
  place(room, 'roofbench', 17, 18, 3, 1);
  place(room, 'sandbucket', 21, 18);
  for (const x of [29, 31, 33]) place(room, 'beehive', x, 24);
  for (const [x, y] of [[14, 12], [27, 4], [6, 23], [36, 15]]) decor(room, 'pigeons', x, y);
  const lampAt = [[11, 4], [23, 12], [37, 8], [8, 20], [26, 21], [37, 25]];
  for (const [x, y] of lampAt) place(room, 'rooflamp', x, y);

  const fl = {
    floor: 0, roof: true, foreign: true, dept: dept.id, w: W, h: H, tiles, roomOf, rooms, items, ground,
    look: { carpet: ['#8a8c90', '#86888c'], wall: '#b4b2aa' }, noWindows: true, lowWalls: true,
    elevator: null, hrDesk: null, hrRep: null, receptionist: null, turnstile: null, entrance: null, posters: [], myDesk: null, tasks: [], npcs: [],
  };
  fl.ladder = ladder;
  fl.telescope = telescope;
  fl.cradle = cradle;
  fl.shack = shack;
  fl.door = { x: SHACK.x + 2.5, y: SHACK.y + SHACK.h + 0.6 }; // where the guard steps out
  fl.arrive = { x: ladder.x + 0.5, y: 2.6 };
  fl.spawn = { x: ladder.x + 0.5, y: 2.6 };
  fl.smokeSpots = [[16.5, 19.7], [18.5, 20.5], [20.6, 20.2], [22.4, 19.2]].map(([x, y]) => ({ x, y }));
  fl.lamps = lampAt.map(([x, y]) => [x + 0.5, y + 0.2, 34]);
  fl.patrol = [[9.5, 15.5], [16.5, 10.5], [22.5, 4.5], [30.5, 10.5], [36.5, 12.5], [30.5, 22.5], [22.5, 25.5], [10.5, 24.5], [14.5, 16.5]].map(([x, y]) => ({ x, y }));
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, ladder.x, 2);
  fl.opaque = roofOpaque(fl);
  return fl;
}
