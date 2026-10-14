// Night shift text (spec 2026-10-14-night-shift). Pure data, ASCII only (bitmap font).

/** What your manager calls out now and then on floors 5, 15, 25 and 35 while today's shift is still on offer. */
export const NIGHT_TEASERS = [
  'Anyone fancy some overtime? The machines run faster when nobody is watching.',
  'The office is very peaceful after dark. Just saying.',
  'I need someone brave for the night shift. Brave and caffeinated.',
  'After hours the printers stop jamming. Mostly.',
  'Somebody has to keep the lights on. Well, off. You know what I mean.',
  'Night owls get the fast coffee machine all to themselves.',
  'The cleaners say the night shift is the best shift. They would know.',
  'No meetings after six. Imagine what you could get done.',
];

export const NIGHT_OFFER = (minutes) =>
  '"Everybody is going home. Could you hold the fort tonight? Somebody has to keep the numbers moving."\n' +
  `For ${minutes} minutes the office is all yours: the machines are ready again twice as fast and the coffee ` +
  'machine brews every 2 minutes. HR, the floor quests and the stand-ups are closed until morning. ' +
  'One shift a day: going home early still uses it up.';

/** Your manager afterwards (today's shift is done). */
export const NIGHT_AFTER = [
  'You look like you slept under your desk. Respect.',
  'The cleaners told me about you. All good things. Mostly.',
  'One night shift a day. Even heroes need sleep.',
  'Did you leave the lights on? The bill says you left the lights on.',
  'Great work last night. The coffee machine has never been so tired.',
  'Go home and sleep. Come back tomorrow night if you miss it.',
];

/** Your manager's goodbye as everyone heads for the elevator. */
export const NIGHT_GOODBYE = [
  'Lock up when you are done. Or do not. The guards like a challenge.',
  'See you in the morning. Do not let the printer bite.',
  'The lights are on a timer. Good luck!',
  'Have fun. Do not touch my stapler.',
];

/** Why there is no shift right now (nightStatus 'blocked', or something else going on). */
export const NIGHT_REFUSALS = {
  hold: 'Not with that compliance hold on your file. HR first.',
  badge: 'No badge, no night shift. Check in at reception.',
  away: 'You are not even supposed to be here right now.',
  busy: 'Finish what you are doing first, then we talk overtime.',
};

/** Ending the shift at the elevator before the time is up. */
export const NIGHT_GO_HOME = (left) => `${left} of the shift left. Head home now? Today's night shift is used up either way.`;

/** The morning after: the summary card on the daytime floor. */
export const NIGHT_SUMMARY_TITLE = { early: 'Home early', done: 'Good morning!' };
export const NIGHT_SUMMARY_LINES = {
  early: ['You sneak out before the cleaners arrive.', 'A short night is still a night.', 'The night bus home was empty. So was the office.'],
  done: ['The sun comes up and your colleagues trickle in.', 'Your colleagues find the place spotless. Suspiciously so.', 'Somebody brought croissants. Not for you, but still.'],
};
export const NIGHT_SUMMARY = (sum, line) =>
  `${line}\n` +
  `Night shift: ${sum.tasks} task${sum.tasks === 1 ? '' : 's'}, +${sum.sp} paperclips, ${sum.stars} KPI star${sum.stars === 1 ? '' : 's'}, ` +
  `${sum.coffee} coffee brewed.`;
