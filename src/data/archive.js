// Text for the archive challenge (core/archive.js, scenes/archive.js). ASCII only (bitmap font).

/** HR's offer, after the usual "come back when you are promotion-ready" note. */
export const ARCHIVE_OFFER = (secs) =>
  'Then again... a personnel folder went missing in the archive, and Legal wants it back today. ' +
  `Take the elevator down to A, find it and bring it up within ${secs / 60} minutes, and I will see what I can do about your promotion paperwork.\n` +
  'It is somewhere at the far end. The lights down there are... a work in progress. I am only asking once.';

/** HR while the folder is still in the archive. */
export const ARCHIVE_WAITING = [
  'The folder will not fetch itself. Elevator, button A.',
  'Archive. Basement. Two minutes once you are down there.',
  'Still here? Legal is asking about that folder.',
];

/** The player, going through a drawer that does not have it (now and then, ARCHIVE.flavorRate). */
export const DRAWER_LINES = [
  'Expense reports from 1997. All approved.',
  'Someone filed a sandwich. In 2009.',
  'Forty copies of the same memo about memos.',
  'A folder labelled "Do not open". Empty.',
  'Mission statements. Every one of them.',
  'Vacation requests, all marked "maybe later".',
  'The minutes of a meeting about shorter meetings.',
  'A stapler. Just the stapler.',
  'Org charts for companies we bought and sold.',
  'Performance reviews. Mostly "meets expectations".',
  'A very old dust bunny. It looks senior.',
  'Signed NDAs about the coffee machine.',
];

export const FOLDER_FOUND = 'Found it! Back to the elevator, quick.';
export const ARCHIVE_TIMEOUT = 'The lights go out for good. Security walks you back up, without the folder. HR will not ask twice.';
export const ARCHIVE_GIVE_UP = 'Leave without the folder? The task is off, and HR will not ask again on this floor.';

/** HR taking the folder: what it did for the promotion (lines for what was missing). */
export const HANDIN_TITLE = 'HR Office · The lost folder';
export const HANDIN_TEXT = (lines) =>
  'You found it! Legal owes us one now, and so does the company. Your promotion paperwork just went through:\n' +
  (lines.length ? lines.join('\n') : '- everything was in order already') +
  '\nLet us get your performance review done.';
