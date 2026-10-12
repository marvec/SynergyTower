// The C64 game table: every mini-game on the disk (the floor-1 and floor-2 station games + the HR review), with
// the overlay that implements it and help text worded for joystick and keyboard. Names, tiers (coffee cost)
// and rules come from the JS game (src/minigames/*.js, src/core/economy.js).
import { MINIGAMES } from '../../src/minigames/index.js';
import { gameTier } from '../../src/core/economy.js';
import { asc } from './floor.js';

/** id -> { src: overlay source in src/, help: C64 controls (wrapped to 38 columns on the task card) }. */
export const C64_GAMES = {
  jargon: { src: 'mg_jargon.s', help: 'The boss says a buzzword. Pick what it REALLY means. Up/down + FIRE, or keys 1-4.' },
  bingo: { src: 'mg_bingo.s', help: 'When someone says a word on your card, press FIRE while it is said. Complete the lines!' },
  cables: { src: 'mg_cables.s', help: 'Re-patch every cable to the socket with its colour. Pick a port, then a socket.' },
  coffee: { src: 'mg_coffee.s', help: 'Memorise every order, then rebuild each one. Joystick + FIRE, or keys 1-4.' },
  memory: { src: 'mg_memory.s', help: 'Flip two badges at a time and match the pairs. Joystick + FIRE.' },
  tailgate: { src: 'mg_tailgate.s', help: 'Stop people without a badge (green BEEP) or VISITOR sticker before they pass the gate. FIRE stops the marked one.' },
  frogger: { src: 'mg_frogger.s', help: 'Carry your coffee from the kitchen to your desk. The joystick hops. Dodge the traffic!' },
  expense: { src: 'mg_expense.s', help: 'Check each receipt: APPROVE (right) the legit ones, REJECT (left) the fraud. Watch for duplicates!' },
  calendar: { src: 'mg_calendar.s', help: 'Find the slot where everyone is free. Left/right to choose, FIRE to book.' },
  pitch: { src: 'mg_pitch.s', help: 'Stop each reel with FIRE on the word the CEO will love. Follow the rumour icon!' },
  replyall: { src: 'mg_replyall.s', help: 'Someone hit Reply All. Delete the RE: replies (up/down + FIRE) before the inbox overflows. Never delete starred mail!' },
  plant: { src: 'mg_plant.s', help: 'Keep water and light in the green bands and squash pests. Keys 1 water, 2 blinds, 3 spray, or joystick + FIRE.' },
  chart: { src: 'mg_chart.s', help: 'Tune the knobs, sliders and switches until the chart climbs to the target. Left/right pick, up/down adjust.' },
  fridge: { src: 'mg_fridge.s', help: 'Fit the lunches into the fridge and fill whole shelves to clear them. Left/right move, up rotates, FIRE drops.' },
  lostpw: { src: 'mg_lostpw.s', help: 'You are locked out! Your password is your pet\'s name, and a photo of your pet is on a whiteboard on this floor. Find it, then log back in.' },
  whack: { src: 'mg_whack.s', help: 'Hit the targets as they pop up: joystick + FIRE, or keys 1-9. Spare the decoys!' },
  stealth: { src: 'mg_stealth.s', help: 'Press FIRE to alt-tab right before the BOSS (red tie) passes your desk. False alarms cost you.' },
  quiz: { src: 'mg_quiz.s', help: 'Pick the best answer before time runs out. Up/down + FIRE, or keys 1-4.' },
  math: { src: 'mg_math.s', help: 'Add up the receipts and pick the right amount. Joystick + FIRE, or keys 1-4.' },
  simon: { src: 'mg_simon.s', help: 'Watch the lights, then repeat them: keys 1-6, or left/right + FIRE. Each round adds one more.' },
  timing: { src: 'mg_timing.s', help: 'First MASH FIRE to fill the bar, then press FIRE when the needle is in the green zone. Yellow = half.' },
  inbox: { src: 'mg_inbox.s', help: 'Sort each item into the right bin before its timer runs out. Left / down / right, or keys 1-3.' },
  typing: { src: 'mg_typing.s', help: 'Type each phrase exactly, letter by letter, before the time runs out. Typos cost accuracy.' },
  order: { src: 'mg_order.s', help: 'Pick the steps of each process in the right order to build the deck. Keys 1-6, or up/down + FIRE.' },
  orgchart: { src: 'mg_orgchart.s', help: 'Surprise reorg! Put each badge in the chart so every clue on the memo holds. FIRE picks up / drops, then SUBMIT.' },
  password: { src: 'mg_password.s', help: 'Type a new password that passes every rule, RETURN submits; a new rule follows. Or joystick + FIRE on the keys.' },
  spreadsheet: { src: 'mg_spreadsheet.s', help: 'Flag every row whose Total is not the sum of its Q columns: up/down + FIRE. FIRE on SUBMIT hands it in.' },
  compose: { src: 'mg_compose.s', help: 'Fill each blank in the email with the right corporate phrase. Joystick + FIRE, or keys 1-4.' },
  karaoke: { src: 'mg_karaoke.s', help: 'Present slides you have never seen: pick the narration that matches the chart. Joystick + FIRE, or keys 1-4.' },
  meeting: { src: 'mg_meeting.s', help: 'Stay awake: FIRE sips coffee (not too often, or you get the jitters). Nod with N or up ONLY at buzzwords.' },
  feedback: { src: 'mg_feedback.s', help: 'Find the colleague on this floor and chat with them, then fill in their 360 form here: joystick + FIRE, or keys 1-4.' },
  stocks: { src: 'mg_stocks.s', help: 'BUY (up or 1) when the price is low, SELL (down or 2) when it is high. Reach the profit target before the bell!' },
  defender: { src: 'mg_defender.s', help: 'Pick a defence (keys 1-4, or FIRE on the bar), then place it on the calendar with the joystick + FIRE.' },
  review: { src: 'mg_review.s', help: 'Tell HR what they want to hear. Score 60% to pass. Up/down + FIRE, or keys 1-4.' },
};

/** Games in table order: the floors' station games first (as they appear), then the review. */
export function gameList(floorTasks) {
  const ids = [];
  for (const id of floorTasks) if (!ids.includes(id)) ids.push(id);
  ids.push('review');
  return ids.map((id, index) => ({ id, index, name: MINIGAMES[id].name, tier: gameTier(id), file: `mg.${id}`, help: 'Not on the C64 yet.', ...C64_GAMES[id] }));
}

const str = (s) => `.byte ${asc(s).join(', ')}, 0`;

/** gen/games.s: name, coffee cost and tier per game (where each overlay sits differs per disk side: the side's
 * directory, build.js). Games without a C64 port yet (no C64_GAMES entry) have `src` undefined. */
export function gamesAsm(list, enc = str) {
  const out = ['; generated by c64/build.js (tools/games.js)', `G_COUNT = ${list.length}`, `G_REVIEW = ${list.length - 1}`, `G_LOSTPW = ${list.find((g) => g.id === 'lostpw')?.index ?? 255}`, `G_FEEDBACK = ${list.find((g) => g.id === 'feedback')?.index ?? 255}`];
  const col = (name, f) => out.push(`${name}: .byte ${list.map(f).join(', ')}`);
  col('game_name_lo', (g) => `<gname${g.index}`);
  col('game_name_hi', (g) => `>gname${g.index}`);
  col('game_help_lo', (g) => `<ghelp${g.index}`);
  col('game_help_hi', (g) => `>ghelp${g.index}`);
  col('game_cost', (g) => (g.id === 'review' ? 2 : g.tier));
  col('game_tier', (g) => g.tier);
  for (const g of list) out.push(`gname${g.index}: ${enc(g.name)}`); // (ghelpN: in the far texts, gen/far.s)
  return out.join('\n') + '\n';
}
