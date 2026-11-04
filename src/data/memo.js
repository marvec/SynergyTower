// Daily Memo text (core/memo.js): the lobby noticeboard, its card, the result and the reminder. ASCII only (bitmap
// font); the share text lives in core/memo.js. Pure data.
export const MEMO_TITLE = 'Daily Memo';
export const MEMO_WARNING = 'One attempt. Leaving counts as giving up.';
export const MEMO_BLURB = 'Everyone in the tower gets the same task today. Share your result and compare.';
export const MEMO_TOAST = (n) => `Memo #${n} is on the lobby noticeboard`;
export const MEMO_PAUSE = 'Give up? It was your one attempt.';
/** The result panel's title by stars. */
export const MEMO_RESULT_TITLES = ['Noted', 'Acknowledged', 'Well received', 'Memo of the day!'];
export const MEMO_DONE = 'Done for today. A new Memo comes at midnight.';
/** What the player says at the noticeboard when the Memo is not open. */
export const MEMO_STUCK = {
  badge: 'No badge, no memo. Check in at the front desk first.',
  night: 'Nobody reads memos at night.',
  none: 'Just an old fire drill notice. No Memo yet.',
};
export const MEMO_REMINDER = (n) => ({ title: `Memo #${n} is on the noticeboard`, body: 'Same task for everyone today. One attempt. How will you do?' });
