// All progression numbers live here. Pure functions — unit-tested in tests/economy.test.js.
export const FLOORS = 40;
export const STAR_MULT = [0.3, 1, 1.5, 2.2];
export const TRAINING_SP_PER_XP = 4;
export const SKIP_COOLDOWN_SO = 1;
export const REFILL_COFFEE_SO = 3;
export const COFFEE_MACHINE_COOLDOWN_S = 15 * 60;
export const COFFEE_MACHINE_AMOUNT = 3;
export const STARTING = { sp: 50, xp: 0, level: 1, so: 5 };
/** HR performance review: score needed to pass. Failing locks the review for reviewCooldownMs. */
export const REVIEW_PASS_SCORE = 0.6;

export function starsFromScore(score) {
  if (score < 0.35) return 0;
  if (score < 0.6) return 1;
  if (score < 0.85) return 2;
  return 3;
}

export function taskReward(floor, stars, perks = {}) {
  const m = STAR_MULT[stars];
  const spBonus = 1 + 0.08 * (perks.monitor || 0) + (perks.stapler ? 0.1 : 0);
  const xpBonus = 1 + 0.08 * (perks.chair || 0);
  return {
    sp: Math.round(25 * 1.17 ** (floor - 1) * m * spBonus),
    xp: Math.round(15 * 1.15 ** (floor - 1) * m * xpBonus),
  };
}

export const starQuota = (floor) => 8 + 2 * (floor - 1);
export const levelRequiredForFloor = (floor) => floor;
export const xpToNext = (level) => Math.round(18 * 1.15 ** (level - 1) * (3 + level));
export const keycardFee = (floor) => Math.round(25 * 1.17 ** (floor - 1) * (2 + floor));
/**
 * Mini-game complexity: 1 simple (reflex / one choice per round), 2 medium, 3 complex (puzzles, multi-step, floor quests).
 * It sets the coffee cost (1-3 cups) and the cooldown: simple games are cheap but come back slowly, complex ones the reverse.
 */
export const GAME_TIER = {
  timing: 1, stealth: 1, whack: 1, quiz: 1, jargon: 1, bingo: 1, math: 1, pitch: 1, tailgate: 1, inbox: 1, calendar: 1,
  typing: 2, compose: 2, memory: 2, simon: 2, order: 2, replyall: 2, meeting: 2, stocks: 2, frogger: 2, karaoke: 2, coffee: 2,
  expense: 2, plant: 2,
  spreadsheet: 3, cables: 3, orgchart: 3, fridge: 3, defender: 3, chart: 3, password: 3, feedback: 3, lostpw: 3,
};
export const gameTier = (game) => GAME_TIER[game] || 2;
export const taskCoffeeCost = (game) => gameTier(game);
export const REVIEW_COFFEE = 2;
/** The lobby turnstiles charge this once, on the new hire's first way in. */
export const TURNSTILE_COFFEE = 1;
/** Daily stand-up: a free quick favour once a day. Pays double paperclips, a cup and sometimes a Stock Option. */
export const STANDUP_COFFEE = 1;
export const STANDUP_SO_CHANCE = 0.2;
export const STANDUP_STREAK_SO = 7; // every 7th day in a row pays a Stock Option for sure
/** Random office events (core/events.js): quiet time on a floor first, then a gap between events. */
export const EVENT_MIN_ON_FLOOR_S = 40;
export const EVENT_GAP_MIN_S = 6 * 60;
export const EVENT_GAP_MAX_S = 10 * 60;
export const EVENT_CAKE_COFFEE = 2;
export const AUDIT_LOCK_S = 90;
/**
 * Business trip (core/trip.js, spec 2026-10-12-business-trip): a colleague on these floors offers it once. The client's
 * office pays double paperclips, its coffee brewers are ready again after 2 minutes and the visit lasts 15 minutes.
 */
export const TRIP_FLOORS = [10, 30];
export const TRIP_SP_MULT = 2;
export const TRIP_VISIT_S = 15 * 60;
export const TRIP_BREWER_S = 2 * 60;
export const TRIP_STATIONS = 20;
/**
 * Vacation (core/vacation.js, spec 2026-10-13-vacation): the boss on floor 20 signs a leave request once a day. The stay
 * at the hotel lasts 15 minutes; each holiday activity (at least 1 star) gives a coffee on top of the pot, once per stay.
 */
export const VACATION_FLOOR = 20;
export const VACATION_COST = 5000;
export const VACATION_S = 15 * 60;
export const VACATION_COFFEE = 1;
/**
 * Conduct (core/conduct.js): every time the player asks a colleague out is a strike; HOLD_STRIKES strikes put them on
 * compliance hold until they take the training at HR. Failing it demotes.
 */
export const HOLD_STRIKES = 5;
export const COMPLIANCE_PASS_SCORE = 0.7;
export const COOLDOWN_TIER_MULT = { 1: 4, 2: 1.5, 3: 0.75 };
export const stationCount = (floor) => Math.min(14, 8 + Math.floor((floor - 1) / 6));

export function baseCooldownMs(floor, perks = {}) {
  const base = 60 * 1.08 ** (floor - 1);
  return Math.round(base * (perks.plant ? 0.85 : 1)) * 1000;
}

export function stationCooldownMs(floor, perks = {}, game) {
  return Math.round((baseCooldownMs(floor, perks) * COOLDOWN_TIER_MULT[gameTier(game)]) / 1000) * 1000;
}

export function reviewCooldownMs(floor, perks = {}) {
  return baseCooldownMs(floor, perks) * 2;
}

export function maxCoffee(floor, perks = {}) {
  return 6 + Math.floor(floor / 5) + 2 * (perks.mug || 0);
}

export function coffeeRegenMs(perks = {}) {
  return Math.round(120000 * (1 - 0.1 * (perks.espresso || 0)));
}

/** Applies XP, returning the new level/xp and how many levels were gained. */
export function addXp(level, xp, gained) {
  let l = level;
  let x = xp + gained;
  let ups = 0;
  while (x >= xpToNext(l) && l < 99) {
    x -= xpToNext(l);
    l++;
    ups++;
  }
  return { level: l, xp: x, levelsGained: ups };
}

/** Coffee regeneration since `updatedAt`; returns the new value and the timestamp the leftover progress counts from. */
export function regenCoffee(value, updatedAt, now, max, regenMs) {
  if (value >= max) return { value, updatedAt: now };
  const ticks = Math.floor((now - updatedAt) / regenMs);
  if (ticks <= 0) return { value, updatedAt };
  const nv = Math.min(max, value + ticks);
  return { value: nv, updatedAt: nv >= max ? now : updatedAt + ticks * regenMs };
}

export const PERKS = [
  { id: 'mug', name: 'Bigger Mug', desc: '+2 max coffee', currency: 'sp', max: 5, baseCost: 150, growth: 3.2 },
  { id: 'espresso', name: 'Espresso Machine', desc: '-10% coffee regen time', currency: 'sp', max: 5, baseCost: 250, growth: 3.3 },
  { id: 'chair', name: 'Ergonomic Chair', desc: '+8% XP from tasks', currency: 'sp', max: 5, baseCost: 300, growth: 3.4 },
  { id: 'monitor', name: 'Second Monitor', desc: '+8% paperclips from tasks', currency: 'sp', max: 5, baseCost: 300, growth: 3.4 },
  { id: 'stapler', name: 'Golden Stapler', desc: '+10% paperclips, forever', currency: 'so', max: 1, baseCost: 40, growth: 1 },
  { id: 'plant', name: 'Corner Office Plant', desc: '-15% task cooldowns', currency: 'so', max: 1, baseCost: 60, growth: 1 },
];

export function perkCost(perk, currentLevel) {
  return Math.round(perk.baseCost * perk.growth ** currentLevel);
}

/**
 * Your desk on each floor (core/desk.js): decorations bought with paperclips, one on show per slot. Prices grow with the
 * floor like task rewards, so every new desk is worth decorating. The trophy needs the floor's KPI star quota.
 */
export const DESK_DECOR = [
  // Slot top = on the monitor, left/right = the desk corners. minFloor: offered from that floor up.
  { id: 'notes', name: 'Sticky notes', slot: 'top', cost: 15, stationery: true },
  { id: 'duck', name: 'Rubber duck', slot: 'top', cost: 25 },
  { id: 'snowglobe', name: 'Snow globe', slot: 'top', cost: 60, minFloor: 6 },
  { id: 'bobble', name: 'CEO bobblehead', slot: 'top', cost: 100, minFloor: 11 },
  { id: 'crane', name: 'Origami crane', slot: 'top', cost: 80, minFloor: 16 },
  { id: 'pencup', name: 'Pen cup', slot: 'left', cost: 15, stationery: true },
  { id: 'highlighters', name: 'Highlighters', slot: 'left', cost: 20, stationery: true },
  { id: 'tray', name: 'Paper tray', slot: 'left', cost: 25, stationery: true },
  { id: 'plant', name: 'Desk plant', slot: 'left', cost: 30 },
  { id: 'cactus', name: 'Cactus', slot: 'left', cost: 45 },
  { id: 'lamp', name: 'Desk lamp', slot: 'left', cost: 75, minFloor: 6 },
  { id: 'organizer', name: 'Desk organiser', slot: 'left', cost: 90, minFloor: 11, stationery: true },
  { id: 'bonsai', name: 'Bonsai tree', slot: 'left', cost: 150, minFloor: 21 },
  { id: 'globe', name: 'Desk globe', slot: 'left', cost: 200, minFloor: 26 },
  { id: 'clips', name: 'Paperclip holder', slot: 'right', cost: 10, stationery: true },
  { id: 'mug', name: 'Coffee mug', slot: 'right', cost: 20 },
  { id: 'stapler', name: 'Red stapler', slot: 'right', cost: 20, stationery: true },
  { id: 'tape', name: 'Tape dispenser', slot: 'right', cost: 25, stationery: true },
  { id: 'photo', name: 'Family photo', slot: 'right', cost: 40 },
  { id: 'calculator', name: 'Calculator', slot: 'right', cost: 50, minFloor: 6, stationery: true },
  { id: 'punch', name: 'Hole punch', slot: 'right', cost: 60, minFloor: 11, stationery: true },
  { id: 'espresso', name: 'Espresso machine', slot: 'right', cost: 180, minFloor: 21 },
  { id: 'penset', name: 'Fountain pen set', slot: 'right', cost: 250, minFloor: 31, stationery: true },
];
export const DESK_OFFER = 7; // items on sale per floor, at least DESK_OFFER_STATIONERY of them stationery
export const DESK_OFFER_STATIONERY = 3;
export const DESK_COLLECTOR = 12; // decorations for the Interior Designer badge
export const TROPHY_COST = 200; // every floor also sells its own Best Employee trophy (needs the floor's star quota)
export const decorCost = (d, floor) => Math.round(d.cost * 1.17 ** (floor - 1));

export const SO_PACKS = [
  { id: 'pack10', so: 10, price: '€0.99', label: 'Handful' },
  { id: 'pack60', so: 60, price: '€4.99', label: 'Vesting Plan' },
  { id: 'pack140', so: 140, price: '€9.99', label: 'Handshake', tag: 'Popular' },
  { id: 'pack400', so: 400, price: '€24.99', label: 'Parachute', tag: 'Best value' },
];
