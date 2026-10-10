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
export const coffeeCost = (floor) => 1 + Math.floor((floor - 1) / 13);
export const stationCount = (floor) => Math.min(14, 8 + Math.floor((floor - 1) / 6));

export function stationCooldownMs(floor, perks = {}) {
  const base = 60 * 1.08 ** (floor - 1);
  return Math.round(base * (perks.plant ? 0.85 : 1)) * 1000;
}

export function reviewCooldownMs(floor, perks = {}) {
  return stationCooldownMs(floor, perks) * 2;
}

export function maxCoffee(floor, perks = {}) {
  return 12 + Math.floor(floor / 5) + 2 * (perks.mug || 0);
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
