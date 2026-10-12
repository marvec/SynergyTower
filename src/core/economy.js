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

export const SO_PACKS = [
  { id: 'pack10', so: 10, price: '€0.99', label: 'Handful' },
  { id: 'pack60', so: 60, price: '€4.99', label: 'Vesting Plan' },
  { id: 'pack140', so: 140, price: '€9.99', label: 'Handshake', tag: 'Popular' },
  { id: 'pack400', so: 400, price: '€24.99', label: 'Parachute', tag: 'Best value' },
];
