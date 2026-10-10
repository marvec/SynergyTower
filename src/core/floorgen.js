// Deterministic floor-plan generator. Every floor is FLOOR_W × FLOOR_H tiles.
// Layout: outer walls, a 2-tile corridor across the middle, rooms above and below with doors onto it,
// and the elevator lobby fixed at top-centre so floors stack.
import { createRng } from './rng.js';
import { departmentForFloor } from '../data/departments.js';

export const FLOOR_W = 40;
export const FLOOR_H = 28;
export const T_FLOOR = 0;
export const T_WALL = 1;

const TOP = { y0: 1, y1: 11 };
const BOTTOM = { y0: 16, y1: 26 };
const TOP_WALL_Y = 12;
const BOTTOM_WALL_Y = 15;
export const ELEVATOR_ROOM = { x0: 17, x1: 22 };

// Which mini-games a station kind can host. The task assigner picks among these.
export const STATION_GAMES = {
  desk: ['inbox', 'compose', 'typing', 'spreadsheet', 'replyall', 'password', 'whack', 'stealth', 'math', 'cables', 'chart', 'feedback', 'lostpw'],
  whiteboard: ['order', 'calendar', 'jargon', 'defender', 'karaoke'],
  meetingtable: ['bingo', 'calendar', 'order', 'jargon', 'meeting', 'feedback'],
  printer: ['timing'],
  shredder: ['inbox', 'expense'],
  watercooler: ['quiz', 'jargon'],
  espressobar: ['coffee'],
  bossdesk: ['stealth', 'quiz', 'jargon', 'orgchart', 'defender', 'stocks', 'feedback', 'chart'],
  filing: ['memory', 'spreadsheet', 'orgchart', 'expense'],
  serverrack: ['simon', 'whack', 'cables'],
  tradingdesk: ['stocks', 'math', 'expense', 'chart', 'lostpw'],
  reception: ['memory', 'quiz', 'compose', 'tailgate', 'password', 'lostpw'],
  mailshelf: ['inbox', 'memory', 'replyall'],
  headsetdesk: ['quiz', 'typing', 'inbox', 'replyall', 'whack', 'feedback', 'lostpw'],
  gong: ['timing', 'math'],
  easel: ['order', 'memory', 'whack', 'karaoke', 'chart'],
  boardtable: ['bingo', 'stocks', 'order', 'jargon', 'meeting', 'karaoke', 'chart'],
  fridge: ['fridge'],
  kitchentable: ['frogger'],
  directory: ['pitch', 'tailgate'],
  copier: ['cables', 'timing', 'simon'],
  tvscreen: ['karaoke', 'cables', 'stocks', 'chart'],
  bookshelf: ['orgchart'],
  plant: ['plant'],
};

export function generateFloor(floor) {
  const rng = createRng(floor * 7919 + 13);
  const dept = departmentForFloor(floor);
  const tiles = new Uint8Array(FLOOR_W * FLOOR_H).fill(T_FLOOR);
  const roomOf = new Int16Array(FLOOR_W * FLOOR_H).fill(-1);
  const reserved = new Uint8Array(FLOOR_W * FLOOR_H);
  const occupied = new Uint8Array(FLOOR_W * FLOOR_H);
  const idx = (x, y) => y * FLOOR_W + x;
  const setWall = (x, y) => (tiles[idx(x, y)] = T_WALL);
  const rooms = [];
  const items = [];

  // Outer walls + band walls.
  for (let x = 0; x < FLOOR_W; x++) {
    setWall(x, 0);
    setWall(x, FLOOR_H - 1);
    setWall(x, TOP_WALL_Y);
    setWall(x, BOTTOM_WALL_Y);
  }
  for (let y = 0; y < FLOOR_H; y++) {
    setWall(0, y);
    setWall(FLOOR_W - 1, y);
  }

  const addRoom = (type, x0, x1, band, doorCount = 1, doorWidth = 2) => {
    const room = { id: rooms.length, type, x0, x1, y0: band.y0, y1: band.y1, doors: [] };
    rooms.push(room);
    for (let y = room.y0; y <= room.y1; y++) for (let x = x0; x <= x1; x++) roomOf[idx(x, y)] = room.id;
    const wallY = band === TOP ? TOP_WALL_Y : BOTTOM_WALL_Y;
    const inside = band === TOP ? room.y1 : room.y0;
    const width = x1 - x0 + 1;
    for (let d = 0; d < doorCount; d++) {
      const seg = width / doorCount;
      const lo = Math.floor(x0 + seg * d + 1);
      const hi = Math.max(lo, Math.floor(x0 + seg * (d + 1) - doorWidth - 1));
      const dx = rng.int(lo, hi);
      for (let i = 0; i < doorWidth; i++) {
        tiles[idx(dx + i, wallY)] = T_FLOOR;
        reserved[idx(dx + i, inside)] = 1;
        reserved[idx(dx + i, band === TOP ? inside - 1 : inside + 1)] = 1;
      }
      room.doors.push({ x: dx, y: wallY, w: doorWidth });
    }
    return room;
  };
  const vWall = (x, band) => {
    for (let y = band.y0; y <= band.y1; y++) setWall(x, y);
  };

  // --- Top band: left region | elevator lobby | right region.
  vWall(ELEVATOR_ROOM.x0 - 1, TOP);
  vWall(ELEVATOR_ROOM.x1 + 1, TOP);
  const elevatorRoom = addRoom('elevator', ELEVATOR_ROOM.x0, ELEVATOR_ROOM.x1, TOP, 1, 4);
  const regions = [];
  // The ground floor always splits both regions: it needs room for the reception + every required room type.
  const splitRegion = (a, b) => {
    if (floor === 1 || rng.chance(0.6)) {
      const cut = rng.int(a + 6, b - 6);
      vWall(cut, TOP);
      regions.push([a, cut - 1], [cut + 1, b]);
    } else regions.push([a, b]);
  };
  splitRegion(1, ELEVATOR_ROOM.x0 - 2);
  splitRegion(ELEVATOR_ROOM.x1 + 2, FLOOR_W - 2);

  // --- Bottom band.
  const bottomRooms = [];
  if (floor === 1) {
    vWall(13, BOTTOM);
    vWall(26, BOTTOM);
    bottomRooms.push([1, 12, 'auto'], [14, 25, 'reception'], [27, 38, 'auto']);
  } else {
    const count = rng.chance(0.5) ? 3 : 4;
    const total = FLOOR_W - 2 - (count - 1);
    const openW = count === 3 ? rng.int(16, 20) : rng.int(14, 16);
    const rest = total - openW;
    const others = [];
    let left = rest;
    for (let i = 0; i < count - 2; i++) {
      const minOther = 6;
      const w = rng.int(minOther, left - minOther * (count - 2 - i));
      others.push(w);
      left -= w;
    }
    others.push(left);
    const openAt = rng.int(0, count - 1);
    const widths = [...others];
    widths.splice(openAt, 0, openW);
    let x = 1;
    widths.forEach((w, i) => {
      bottomRooms.push([x, x + w - 1, i === openAt ? 'openplan' : 'auto']);
      x += w;
      if (i < widths.length - 1) {
        vWall(x, BOTTOM);
        x++;
      }
    });
  }

  // Assign room types.
  const autoTypes = rng.shuffle(['manager', 'copy', 'restroom', 'meeting']);
  const required = ['kitchen', 'meeting', 'special', 'hr'];
  if (floor === 1) required.push('openplan');
  const slots = [...regions.map((r) => ({ band: TOP, r })), ...bottomRooms.filter((b) => b[2] === 'auto').map((b) => ({ band: BOTTOM, r: b }))];
  const typeQueue = [...required, ...autoTypes];
  rng.shuffle(slots).forEach((slot, i) => {
    const type = typeQueue[i] || 'meeting';
    addRoom(type, slot.r[0], slot.r[1], slot.band);
  });
  for (const b of bottomRooms) {
    if (b[2] === 'openplan') addRoom('openplan', b[0], b[1], BOTTOM, 2);
    if (b[2] === 'reception') addRoom('reception', b[0], b[1], BOTTOM, 1, 8);
  }

  // Ground floor entrance in the outer wall.
  let entrance = null;
  if (floor === 1) {
    for (const x of [19, 20]) {
      tiles[idx(x, FLOOR_H - 1)] = T_FLOOR;
      reserved[idx(x, FLOOR_H - 2)] = 1;
      reserved[idx(x, FLOOR_H - 3)] = 1;
    }
    entrance = { x: 19, y: FLOOR_H - 1, w: 2 };
  }

  // --- Furniture.
  const canPlace = (x, y, w, h, room) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (xx < room.x0 || xx > room.x1 || yy < room.y0 || yy > room.y1) return false;
        const i = idx(xx, yy);
        if (tiles[i] !== T_FLOOR || reserved[i] || occupied[i]) return false;
      }
    return true;
  };
  const place = (room, type, x, y, w = 1, h = 1, opts = {}) => {
    const solid = opts.solid !== false;
    if (solid && !canPlace(x, y, w, h, room)) return null;
    if (!solid && (x < room.x0 || x > room.x1 || y < room.y0 || y > room.y1)) return null;
    const item = { id: items.length, type, x, y, w, h, room: room.id, ...opts, solid };
    if (solid) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) occupied[idx(xx, yy)] = 1;
    items.push(item);
    return item;
  };
  const station = (room, type, kind, x, y, w = 1, h = 1) => place(room, type, x, y, w, h, { station: kind });
  const decor = (room, type, x, y, w = 1, h = 1) => place(room, type, x, y, w, h, { solid: false });

  const fillers = {
    elevator(r) {
      place(r, 'elevator', 19, r.y0, 2, 1, { interact: 'elevator' });
      place(r, 'plant', r.x0, r.y0);
      place(r, 'plant', r.x1, r.y0);
      station(r, 'directory', 'directory', 21, r.y0);
      place(r, 'sofa', r.x0, r.y0 + 4, 1, 2);
      place(r, 'sofa', r.x1, r.y0 + 4, 1, 2);
    },
    openplan(r) {
      for (let y = r.y0 + 1; y + 1 <= r.y1 - 1; y += 3)
        for (let x = r.x0 + 1; x + 1 <= r.x1 - 1; x += 3) {
          const kind = dept.special === 'callcenter' && rng.chance(0.5) ? 'headsetdesk' : 'desk';
          if (station(r, kind === 'headsetdesk' ? 'headsetdesk' : 'desk', kind, x, y, 2, 1)) decor(r, 'chair', x, y + 1);
        }
      station(r, 'plant', 'plant', r.x0, r.y0);
      place(r, 'plant', r.x1, r.y0);
      place(r, 'plant', r.x1, r.y1);
    },
    kitchen(r) {
      place(r, 'counter', r.x0, r.y0, 1, 1);
      place(r, 'coffeemachine', r.x0 + 1, r.y0, 1, 1, { interact: 'coffee' });
      station(r, 'espressobar', 'espressobar', r.x0 + 2, r.y0, 1, 1);
      place(r, 'microwave', r.x0 + 3, r.y0);
      station(r, 'fridge', 'fridge', r.x0 + 4, r.y0);
      station(r, 'watercooler', 'watercooler', r.x1, r.y0);
      const tx = Math.floor((r.x0 + r.x1) / 2) - 1;
      const ty = Math.floor((r.y0 + r.y1) / 2);
      if (station(r, 'kitchentable', 'kitchentable', tx, ty, 2, 1)) {
        decor(r, 'stool', tx - 1, ty);
        decor(r, 'stool', tx + 2, ty);
      }
      station(r, 'plant', 'plant', r.x0, r.y1);
      place(r, 'vending', r.x1, r.y1 - 1, 1, 1);
    },
    meeting(r) {
      const w = Math.min(4, r.x1 - r.x0 - 3);
      const x = Math.floor((r.x0 + r.x1 + 1) / 2 - w / 2);
      const y = Math.floor((r.y0 + r.y1) / 2) - 1;
      if (station(r, 'meetingtable', 'meetingtable', x, y, w, 2)) {
        for (let i = 0; i < w; i++) {
          decor(r, 'chair', x + i, y - 1);
          decor(r, 'chairup', x + i, y + 2);
        }
      }
      station(r, 'whiteboard', 'whiteboard', Math.floor((r.x0 + r.x1) / 2), r.y0, 2, 1);
      place(r, 'plant', r.x0, r.y0);
      place(r, 'plant', r.x1, r.y1);
    },
    hr(r) {
      // HR office: the performance-review desk (gate for promotions) with the HR rep standing behind it.
      const x = Math.floor((r.x0 + r.x1) / 2) - 1;
      const y = r.y0 + 4;
      if (place(r, 'hrdesk', x, y, 3, 1, { interact: 'hr' })) place(r, 'hrrep', x + 1, y - 1);
      place(r, 'poster', Math.max(r.x0 + 2, x), r.y0, 2, 1);
      place(r, 'filing', r.x0, r.y0);
      place(r, 'filing', r.x1, r.y0);
      decor(r, 'chairup', r.x0 + 1, y + 2);
      place(r, 'plant', r.x1, r.y1);
      place(r, 'plant', r.x0, r.y1);
    },
    manager(r) {
      const x = Math.floor((r.x0 + r.x1) / 2) - 1;
      const y = r.y0 + 3;
      if (station(r, 'bossdesk', 'bossdesk', x, y, 3, 1)) decor(r, 'bigchair', x + 1, y - 1);
      station(r, 'bookshelf', 'bookshelf', r.x0, r.y0, 2, 1);
      place(r, 'bookshelf', r.x1 - 1, r.y0, 2, 1);
      place(r, 'sofa', r.x0, r.y1 - 2, 1, 2);
      place(r, 'plant', r.x1, r.y1);
      place(r, 'trophy', r.x0 + 2, r.y0);
    },
    copy(r) {
      station(r, 'printer', 'printer', r.x0 + 1, r.y0, 1, 1);
      station(r, 'copier', 'copier', r.x0 + 3, r.y0, 2, 1);
      station(r, 'shredder', 'shredder', r.x1, r.y0);
      place(r, 'boxes', r.x0, r.y1);
      place(r, 'boxes', r.x0 + 1, r.y1);
      place(r, 'filing', r.x1, r.y1, 1, 1);
    },
    restroom(r) {
      for (let x = r.x0; x <= r.x1 - 1 && x < r.x0 + 6; x += 2) place(r, 'toilet', x, r.y0);
      place(r, 'sink', r.x1, r.y0 + 2);
      place(r, 'sink', r.x1, r.y0 + 4);
      place(r, 'plant', r.x0, r.y1);
    },
    reception(r) {
      station(r, 'reception', 'reception', 18, r.y0 + 2, 4, 1);
      place(r, 'fountain', 15, r.y0 + 5, 2, 2);
      place(r, 'fountain', 23, r.y0 + 5, 2, 2);
      place(r, 'sofa', r.x0, r.y1 - 3, 1, 2);
      place(r, 'sofa', r.x1, r.y1 - 3, 1, 2);
      place(r, 'plant', r.x0, r.y0);
      place(r, 'plant', r.x1, r.y0);
      place(r, 'plant', 17, r.y1);
      place(r, 'plant', 22, r.y1);
    },
    special(r) {
      const sp = dept.special;
      if (sp === 'serverroom' || sp === 'archive' || sp === 'mailroom') {
        const type = sp === 'serverroom' ? 'serverrack' : sp === 'archive' ? 'filing' : 'mailshelf';
        let n = 0;
        for (let y = r.y0; y <= r.y1 - 1; y += 3)
          for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) {
            const it = n < 3 && rng.chance(0.5) ? station(r, type, type, x, y) : place(r, type, x, y);
            if (it?.station) n++;
          }
        if (n === 0) {
          const it = items.find((i) => i.room === r.id && i.type === type);
          if (it) it.station = type;
        }
        if (sp === 'mailroom') place(r, 'boxes', r.x0, r.y1);
      } else if (sp === 'tradingdesk' || sp === 'callcenter' || sp === 'bullpen') {
        const type = sp === 'tradingdesk' ? 'tradingdesk' : 'headsetdesk';
        for (let y = r.y0 + 1; y + 1 <= r.y1 - 1; y += 3)
          for (let x = r.x0 + 1; x + 1 <= r.x1 - 1; x += 3) if (station(r, type, type, x, y, 2, 1)) decor(r, 'chair', x, y + 1);
        if (sp === 'bullpen') station(r, 'gong', 'gong', r.x0, r.y0, 1, 1) || station(r, 'gong', 'gong', r.x1, r.y0, 1, 1);
      } else if (sp === 'studio') {
        station(r, 'easel', 'easel', r.x0 + 1, r.y0 + 1);
        station(r, 'easel', 'easel', r.x0 + 3, r.y0 + 1);
        place(r, 'camera', r.x1 - 1, r.y0 + 3);
        decor(r, 'beanbag', r.x0 + 1, r.y1 - 1);
        decor(r, 'beanbag', r.x0 + 3, r.y1 - 1);
        place(r, 'plant', r.x1, r.y1);
      } else if (sp === 'boardroom') {
        const w = Math.min(6, r.x1 - r.x0 - 3);
        const x = Math.floor((r.x0 + r.x1 + 1) / 2 - w / 2);
        const y = Math.floor((r.y0 + r.y1) / 2) - 1;
        if (station(r, 'boardtable', 'boardtable', x, y, w, 2))
          for (let i = 0; i < w; i++) {
            decor(r, 'bigchair', x + i, y - 1);
            decor(r, 'chairup', x + i, y + 2);
          }
        station(r, 'tvscreen', 'tvscreen', Math.floor((r.x0 + r.x1) / 2), r.y0, 2, 1);
        place(r, 'plant', r.x0, r.y0);
        place(r, 'plant', r.x1, r.y0);
      }
    },
  };
  for (const room of rooms) fillers[room.type]?.(room);

  const spawn = floor === 1 ? { x: 19.5, y: FLOOR_H - 2 } : { x: 19.5, y: TOP.y0 + 1.5 };
  const elevator = items.find((i) => i.interact === 'elevator');
  const hrDesk = items.find((i) => i.interact === 'hr');
  const hrRep = items.find((i) => i.type === 'hrrep');

  return { floor, dept: dept.id, w: FLOOR_W, h: FLOOR_H, tiles, roomOf, rooms, items, spawn, elevator, hrDesk, hrRep, entrance, elevatorRoom: elevatorRoom.id };
}

/** Boolean grid: true = walkable for characters. */
export function buildWalkable(fl) {
  const walk = new Uint8Array(fl.w * fl.h);
  for (let i = 0; i < walk.length; i++) walk[i] = fl.tiles[i] === T_FLOOR ? 1 : 0;
  for (const it of fl.items) {
    if (!it.solid) continue;
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) walk[y * fl.w + x] = 0;
  }
  if (fl.entrance) for (let i = 0; i < fl.entrance.w; i++) walk[fl.entrance.y * fl.w + fl.entrance.x + i] = 0;
  return walk;
}

/** BFS distance map from a tile. Unreachable = -1. */
export function bfs(fl, walk, sx, sy) {
  const dist = new Int32Array(fl.w * fl.h).fill(-1);
  const q = [sy * fl.w + sx];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const x = c % fl.w;
    const y = (c / fl.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= fl.w || ny >= fl.h) continue;
      const n = ny * fl.w + nx;
      if (walk[n] && dist[n] < 0) {
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
  }
  return dist;
}

/** Tiles adjacent to an item (4-neighbourhood of its footprint). */
export function itemNeighbors(fl, it) {
  const out = [];
  for (let x = it.x; x < it.x + it.w; x++) {
    out.push([x, it.y - 1], [x, it.y + it.h]);
  }
  for (let y = it.y; y < it.y + it.h; y++) {
    out.push([it.x - 1, y], [it.x + it.w, y]);
  }
  return out.filter(([x, y]) => x >= 0 && y >= 0 && x < fl.w && y < fl.h);
}

export function isItemReachable(fl, walk, dist, it) {
  return itemNeighbors(fl, it).some(([x, y]) => walk[y * fl.w + x] && dist[y * fl.w + x] >= 0);
}
