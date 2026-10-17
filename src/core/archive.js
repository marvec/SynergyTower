// The archive challenge: on floors 3, 13, 23 and 33 HR asks a player who is not promotion-ready yet to fetch a lost
// employee folder from the archive in the basement (elevator button "A") within five minutes. Handing the folder in at
// HR grants exactly what the promotion still lacks. HR asks only once per floor: declined, failed or done, it is gone.
// Pure, no DOM: scenes/archive.js runs the basement.
//
// state.archive = { asked: { floor: true }, done: { floor: true }, task: null | { floor, drawer, inside, found, folder } }
//   asked       HR has made the offer on that floor (accepted or not): it never comes again there
//   done        the folder was handed in on that floor
//   task.floor  the floor it was accepted on (always the career's highest floor then); the folder goes back there
//   task.drawer the drawer (item id on buildArchive()) holding the folder: archiveDrawer, fixed per career and floor
//               (the roof's smokers know it beforehand), stored when the task is accepted
//   task.inside true while the player is in the archive. Saved like that, a reload counts as the run failing
//               (the clock lives in the scene, not the save): see resumeArchive.
//   task.found  the folder is in hand, still in the archive (until the elevator)
//   task.folder true once the folder is out of the archive: then the A button is gone and HR takes it
import * as E from './economy.js';
import { promotionStatus, castOf } from './state.js';
import { onHold } from './conduct.js';
import { createPlanner, buildWalkable, bfs, FLOOR_W, FLOOR_H } from './floorgen.js';
import { DEPARTMENTS } from '../data/departments.js';
import { createRng, hashString } from './rng.js';

/** Everything tunable about the archive challenge. */
export const ARCHIVE = {
  floors: [3, 13, 23, 33], // HR offers it on these floors
  timeLimitS: 5 * 60, // the clock in the archive, counted from arrival
  urgentS: 15, // the last seconds: the clock turns red and ticks
  searchS: 1, // going through one drawer
  minFolderDist: 0.6, // the folder's drawer is at least this share of the floor's longest side away from the elevator
  ambient: null, // the basement's base light; null = the night shift's (LIGHTING.ambient)
  fog: false, // fog of war in the archive (engine/lighting.js)
  flavorRate: 0.3, // chance that an empty drawer gets a line from the player
};

export const isArchiveFloor = (floor) => ARCHIVE.floors.includes(floor);

/** The career's archive record (saves from before it get an empty one). */
export function archive(s) {
  if (!s.archive) s.archive = { asked: {}, done: {}, task: null };
  s.archive.asked ||= {};
  return s.archive;
}

export const archiveTask = (s) => s.archive?.task || null;
/** The elevator shows its A button while the folder is still down there. */
export const archiveOpen = (s) => !!s.archive?.task && !s.archive.task.folder;
/** The player has the folder (in the archive or back upstairs) and has not handed it in yet. */
export const carryingFolder = (s) => !!(s.archive?.task?.found || s.archive?.task?.folder);

/**
 * Does HR on `floor` offer the archive task now? Only on an eligible floor that is the career's highest (where the
 * review would be), before the player is promotion-ready, only once per floor (whatever comes of it), and not while a
 * task is under way, during a compliance hold, a trip, a holiday or a night shift.
 */
export function archiveOffer(s, floor) {
  return !s.archive?.asked?.[floor] && canTakeArchive(s, floor);
}

/** Everything archiveOffer asks except whether HR has asked already (the offer on screen can still be accepted). */
function canTakeArchive(s, floor) {
  if (!isArchiveFloor(floor) || floor !== s.maxFloor || s.floor !== floor) return false;
  if (s.archive?.done?.[floor] || s.archive?.task) return false;
  if (onHold(s) || s.trip || s.vacation || s.nightShift || s.lobby !== 'done') return false;
  const st = promotionStatus(s);
  return !st.top && !st.ready && !st.checks.review;
}

/** HR has made the offer on `floor`: it is not made there again, accepted or not. */
export function markAsked(s, floor) {
  const a = archive(s);
  a.asked = { ...a.asked, [floor]: true };
}

/**
 * The drawer the folder lost on `floor` is in: one of the far drawers, fixed by the career's cast and the floor, so a
 * smoker on the roof below (core/roof.js archiveHint) can name it before HR has even asked.
 */
export function archiveDrawer(s, floor) {
  const far = folderDrawers(buildArchive());
  return far[hashString(`folder:${castOf(s)}:${floor}`) % far.length].id;
}

/** Accepts the task on `floor` (offered there, so marked as asked): the folder is in its drawer (archiveDrawer). */
export function acceptArchive(s, floor) {
  if (!canTakeArchive(s, floor)) return { ok: false };
  markAsked(s, floor);
  archive(s).task = { floor, drawer: archiveDrawer(s, floor), inside: false, found: false, folder: false };
  return { ok: true };
}

/** The player steps out of the elevator in the archive: the clock starts (in the scene). */
export function enterArchive(s) {
  const t = archiveTask(s);
  if (!t || t.folder) return false;
  t.inside = true;
  return true;
}

/** A drawer gone through in the archive: true (and the folder in hand) if it was the one. */
export function takeFolder(s, drawerId) {
  const t = archiveTask(s);
  if (!t?.inside || t.found || t.drawer !== drawerId) return false;
  t.found = true;
  return true;
}

/** Back in the elevator with the folder in hand: success, the A button goes away. */
export function leaveWithFolder(s) {
  const t = archiveTask(s);
  if (!t?.inside || !t.found) return false;
  t.inside = false;
  t.folder = true;
  return true;
}

/** Time ran out (or the player gave up, or a save made in the archive was reloaded): the task is gone for this floor, no other penalty. */
export function failArchive(s) {
  const t = archiveTask(s);
  if (s.archive) s.archive.task = null;
  return t;
}

/**
 * Loading a career: a save made in the archive (task.inside) counts as the run failing. Returns the failed task's floor,
 * or null when there was nothing to fail.
 */
export function resumeArchive(s) {
  const t = archiveTask(s);
  if (!t?.inside) return null;
  failArchive(s);
  return t.floor;
}

/** What handing the folder in would grant now: exactly what promotionStatus still misses, nothing more. */
export function missingForPromotion(s) {
  const st = promotionStatus(s);
  return {
    stars: Math.max(0, st.quota - st.stars),
    levels: Math.max(0, st.levelReq - st.level),
    sp: Math.max(0, st.fee - st.sp),
  };
}

/**
 * The folder handed in at HR on the task's floor: grants the missing stars, levels and paperclips (XP is kept below
 * the new level's threshold, so no extra level follows), marks the floor done for good. { ok, granted }.
 */
export function handInFolder(s, floor) {
  const t = archiveTask(s);
  if (!t?.folder || t.floor !== floor) return { ok: false };
  const granted = floor === s.maxFloor ? missingForPromotion(s) : { stars: 0, levels: 0, sp: 0 };
  if (granted.stars) s.starsByFloor[floor] = (s.starsByFloor[floor] || 0) + granted.stars;
  if (granted.levels) {
    s.level += granted.levels;
    s.xp = Math.min(s.xp, E.xpToNext(s.level) - 1);
  }
  s.sp += granted.sp;
  const a = archive(s);
  a.done = { ...a.done, [floor]: true };
  a.task = null;
  return { ok: true, granted };
}

// ------------------------------------------------------------------ the archive's floor plan
/** The cross aisles (columns without cabinets): the walls' sides, the middle under the elevator, two more. */
const CROSS = [1, 2, 11, 12, 19, 20, 27, 28, 37, 38];
/** Cabinet rows (each one tile deep, facing down), with three-tile aisles between them; the top rows are the landing. */
export const CABINET_ROWS = [4, 8, 12, 16, 20, 24];
const ELEVATOR = { x: 19, y: 1, w: 2 };

let cached = null;

/**
 * The archive: one large room the size of a floor, its elevator where every floor has it (top centre), and rows of
 * tall HR filing cabinets (`archivecab`, one drawer stack per tile) with aisles between them. Deterministic.
 */
export function buildArchive() {
  return (cached ||= generateArchive());
}

function generateArchive() {
  const W = FLOOR_W;
  const H = FLOOR_H;
  const dept = DEPARTMENTS.find((d) => d.id === 'legalhr');
  const P = createPlanner(W, H, createRng(4040), dept);
  const { idx, setWall, rooms, roomOf, items, place } = P;
  for (let x = 0; x < W; x++) {
    setWall(x, 0);
    setWall(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    setWall(0, y);
    setWall(W - 1, y);
  }
  const room = { id: 0, type: 'archive', x0: 1, x1: W - 2, y0: 1, y1: H - 2, doors: [] };
  rooms.push(room);
  for (let y = room.y0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) roomOf[idx(x, y)] = room.id;
  const elevator = place(room, 'elevator', ELEVATOR.x, ELEVATOR.y, ELEVATOR.w, 1, { interact: 'elevator' });
  for (const y of CABINET_ROWS) for (let x = room.x0; x <= room.x1; x++) if (!CROSS.includes(x)) place(room, 'archivecab', x, y, 1, 1, { drawer: true });
  // A few boxes nobody has opened since the merger, on the landing by the elevator.
  place(room, 'boxes', 16, 1);
  place(room, 'boxes', 23, 1);
  const fl = {
    floor: 0, archive: true, foreign: true, dept: dept.id, w: W, h: H, tiles: P.tiles, roomOf, rooms, items,
    look: { carpet: ['#3a3d44', '#40434a'], wall: '#6a6e78' }, noWindows: true,
    elevator, hrDesk: null, hrRep: null, receptionist: null, turnstile: null, entrance: null, posters: [], myDesk: null, tasks: [], npcs: [],
  };
  fl.drawers = items.filter((it) => it.drawer);
  fl.walk = buildWalkable(fl);
  fl.dist = bfs(fl, fl.walk, ELEVATOR.x, ELEVATOR.y + 1);
  return fl;
}

/** Distance in tiles from the elevator's doors to a drawer's middle. */
export function elevatorDistance(fl, it) {
  const e = fl.elevator;
  return Math.hypot(it.x + it.w / 2 - (e.x + e.w / 2), it.y + it.h / 2 - (e.y + e.h));
}

/** The drawers far enough from the elevator to hold the folder (ARCHIVE.minFolderDist of the longest side). */
export function folderDrawers(fl) {
  const min = ARCHIVE.minFolderDist * Math.max(fl.w, fl.h);
  return fl.drawers.filter((it) => elevatorDistance(fl, it) >= min);
}

const ROW_LETTERS = 'ABCDEFGH';
/** A cabinet's row letter (A at the top) and its number in the row (1 at the left): { row, n, text: 'Row C, cabinet 7' }. */
export function drawerLabel(it) {
  const i = CABINET_ROWS.indexOf(it.y);
  const n = buildArchive().drawers.filter((d) => d.y === it.y && d.x <= it.x).length;
  const row = ROW_LETTERS[i] || '?';
  return { row, n, text: `Row ${row}, cabinet ${n}` };
}

/** The archive's ceiling lights, in tiles: a sparse grid over the aisles (the lighting decides which flicker). */
export function archiveLamps(fl) {
  const out = [];
  for (const y of [2.5, 10.5, 18.5, 26]) for (const x of [6, 15.5, 24.5, 33]) out.push([x, y, 40]);
  return out.filter(([x, y]) => x < fl.w && y < fl.h);
}
