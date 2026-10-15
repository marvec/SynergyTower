// Badges: long-term goals checked from the state alone (no event plumbing), shown on the badge wall
// (src/scenes/badgeWall.js). s.badges[id] = when it was unlocked. Pure, no DOM.
import * as E from './economy.js';
import { COUNTED_GAMES, buildFloor } from './tasks.js';
import { DEPARTMENTS } from '../data/departments.js';

const ev = (s, kind) => s.stats.events?.[kind] || 0;
const desk = (s) => s.desk || { owned: [], show: {} };
const isTrophy = (id) => /^trophy-/.test(id || '');
const DEPT_SHORT = { lobby: 'Lobby', support: 'Support', sales: 'Sales', marketing: 'Marketing', it: 'IT', finance: 'Finance', legalhr: 'Legal & HR', exec: 'Executive' };

/** Every task on floors a..b has 3 stars. */
const mastered = (s, a, b) => {
  for (let f = a; f <= b; f++) for (const it of buildFloor(f).tasks) if (s.bestByTask[it.task.id] !== 3) return false;
  return true;
};

export const BADGES = [
  { id: 'first_task', name: 'First Day', desc: 'Finish your first task.', icon: 'check', test: (s) => s.stats.tasksPlayed >= 1 },
  { id: 'checkin', name: 'Signed In', desc: 'Check in at the front desk.', icon: 'lock', test: (s) => s.lobby !== 'checkin' },
  { id: 'perfect', name: 'Overachiever', desc: 'Get 3 stars on a task.', icon: 'star', test: (s) => s.stats.perfectTasks >= 1 },
  { id: 'perfect25', name: 'Employee of the Month', desc: 'Get 3 stars on 25 tasks.', icon: 'star', test: (s) => s.stats.perfectTasks >= 25 },
  { id: 'tasks100', name: 'Workaholic', desc: 'Play 100 tasks.', icon: 'clock', test: (s) => s.stats.tasksPlayed >= 100 },
  { id: 'generalist', name: 'Generalist', desc: 'Try every kind of mini-game.', icon: 'pad', test: (s) => COUNTED_GAMES.every((g) => s.played?.[g]) },
  { id: 'floor10', name: 'Middle Management', desc: 'Reach floor 10.', icon: 'up', test: (s) => s.maxFloor >= 10 },
  { id: 'floor20', name: 'Upper Management', desc: 'Reach floor 20.', icon: 'up', test: (s) => s.maxFloor >= 20 },
  { id: 'floor30', name: 'Executive Material', desc: 'Reach floor 30.', icon: 'up', test: (s) => s.maxFloor >= 30 },
  { id: 'ceo', name: 'Corner Office', desc: 'Become CEO.', icon: 'star', test: (s) => !!s.flags.ceo },
  { id: 'bootstrapped', name: 'Bootstrapped', desc: 'Reach floor 10 without spending Stock Options.', icon: 'so', test: (s) => s.maxFloor >= 10 && s.stats.soSpent === 0 },
  { id: 'level20', name: 'Seasoned', desc: 'Reach Seniority Lv20.', icon: 'xp', test: (s) => s.level >= 20 },
  { id: 'reviews10', name: 'Feedback Loop', desc: 'Pass 10 HR performance reviews.', icon: 'book', test: (s) => Object.values(s.reviews || {}).filter(Boolean).length >= 10 },
  { id: 'hacker', name: 'sudo make me CEO', desc: 'Change floors from a workstation terminal.', icon: 'pad', test: (s) => (s.stats.warps || 0) >= 1 },
  { id: 'restructuring', name: 'Restructuring', desc: 'Fire 10 colleagues.', icon: 'cart', test: (s) => (s.stats.fired || 0) >= 10 },
  { id: 'cleansweep', name: 'Clean Sweep', desc: 'Fire the whole board on floor 40.', icon: 'cart', test: (s) => buildFloor(E.FLOORS).npcs.every((n) => s.fired?.[n.seed]) },
  { id: 'standup', name: 'Daily Scrum', desc: 'Do a daily stand-up.', icon: 'clock', test: (s) => (s.stats.standups || 0) >= 1 },
  { id: 'streak7', name: 'Agile Evangelist', desc: 'Do the daily stand-up 7 days in a row.', icon: 'clock', test: (s) => (s.daily?.best || 0) >= 7 },
  { id: 'drill3', name: 'Safety Officer', desc: 'Reach the fire exit in time in 3 fire drills.', icon: 'up', test: (s) => ev(s, 'drill') >= 3 },
  { id: 'cake3', name: 'Let Them Eat Cake', desc: 'Get to the office cake first 3 times.', icon: 'coffee', test: (s) => ev(s, 'cake') >= 3 },
  { id: 'printer3', name: 'Printer Whisperer', desc: 'Fix 3 printer meltdowns.', icon: 'check', test: (s) => ev(s, 'printer') >= 3 },
  { id: 'audit', name: 'Compliance Champion', desc: 'Help a surprise audit along.', icon: 'book', test: (s) => ev(s, 'audit') >= 1 },
  { id: 'roadwarrior', name: 'Road Warrior', desc: 'Make it to a client on a business trip.', icon: 'up', test: (s) => Object.values(s.trips || {}).includes('done') },
  { id: 'vacation', name: 'Out of Office', desc: 'Take a vacation.', icon: 'coffee', test: (s) => (s.vacations?.count || 0) >= 1 },
  { id: 'homehero', name: 'Domestic Hero', desc: '3 stars on every chore in one home office day.', icon: 'check', test: (s) => (s.stats.homeHero || 0) >= 1 },
  { id: 'alwaysonline', name: 'Always Online', desc: 'A whole home office day without your status going Away.', icon: 'clock', test: (s) => (s.stats.homeOnline || 0) >= 1 },
  { id: 'cameraready', name: 'Camera Ready', desc: "Answer all the boss's video calls on a home office day.", icon: 'star', test: (s) => (s.stats.homeCamera || 0) >= 1 },
  { id: 'decorate', name: 'Home Office', desc: 'Put a decoration on your desk.', icon: 'sp', test: (s) => Object.values(desk(s).show).some(Boolean) },
  { id: 'designer', name: 'Interior Designer', desc: `Collect ${E.DESK_COLLECTOR} desk decorations.`, icon: 'sp', test: (s) => desk(s).owned.filter((id) => !isTrophy(id)).length >= E.DESK_COLLECTOR },
  { id: 'trophy', name: 'Best Employee', desc: "Put a floor's Best Employee trophy on your desk.", icon: 'star', test: (s) => isTrophy(desk(s).show.right) },
  { id: 'caffeine', name: 'Caffeine Addict', desc: 'Use the coffee machine 25 times.', icon: 'coffee', test: (s) => (s.stats.coffeeMachine || 0) >= 25 },
  { id: 'maximiser', name: 'Paperclip Maximiser', desc: 'Hold 1,000,000 paperclips.', icon: 'sp', test: (s) => s.sp >= 1e6 },
  ...DEPARTMENTS.map((d, i) => {
    const a = i * 5 + 1;
    const b = a + 4;
    return { id: `dept_${d.id}`, name: `${DEPT_SHORT[d.id]} Master`, desc: `3 stars on every task on floors ${a}-${b}.`, icon: 'star', dept: true, test: (s) => mastered(s, a, b) };
  }),
];

/** Unlocks every badge whose condition holds now; returns the newly unlocked ones. */
export function checkBadges(s, now) {
  s.badges ||= {};
  const fresh = [];
  for (const b of BADGES) {
    if (s.badges[b.id] || !b.test(s)) continue;
    s.badges[b.id] = now;
    fresh.push(b);
  }
  return fresh;
}
