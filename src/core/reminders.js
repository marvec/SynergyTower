// "Come back" reminders: which game timers finish while the player is away. Pure (no DOM), so the browser
// notifications and a future native app can share it. Only long, meaningful waits are worth a notification.
import * as E from './economy.js';
import * as S from './state.js';
import { memoNumber, memoStatus } from './memo.js';
import { MEMO_REMINDER } from '../data/memo.js';

/** The Daily Memo reminder comes at this local hour, for that day's Memo. */
const MEMO_HOUR = 10;

/** The next MEMO_HOUR o'clock after `now`. */
function nextMemoTime(now) {
  const d = new Date(now);
  d.setHours(MEMO_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Upcoming reminders, soonest first: [{ kind, at, title, body }]. */
export function upcomingReminders(s, now) {
  const out = [];
  const max = S.coffeeMax(s);
  if (S.coffeeRegenOn(s) && s.coffee.value < max) {
    const at = now + S.msToNextCoffee(s, now) + (Math.ceil(max - s.coffee.value) - 1) * E.coffeeRegenMs(s.perks);
    out.push({ kind: 'coffee', at, title: 'The coffee pot is full again', body: `${max} cups ready. Your desk misses you, ${s.player.name}.` });
  }
  const f = s.maxFloor;
  const reviewAt = s.cooldowns[S.reviewKey(f)] || 0;
  if (reviewAt > now && !s.reviews?.[f] && S.promotionStatus(s).ready) {
    out.push({ kind: 'review', at: reviewAt, title: 'HR has cleared their calendar', body: `Ready to retry your floor ${f} performance review?` });
  }
  // The Daily Memo: today's at 10:00 while it waits, or tomorrow's (today's is done, or 10:00 has passed).
  let memoAt = nextMemoTime(now);
  if (memoStatus(s, memoAt) === 'done') memoAt = nextMemoTime(memoAt);
  if (memoStatus(s, memoAt) === 'pending') out.push({ kind: 'memo', at: memoAt, ...MEMO_REMINDER(memoNumber(memoAt)) });
  return out.sort((a, b) => a.at - b.at);
}
