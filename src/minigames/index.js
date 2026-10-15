// Registry of all mini-games, keyed by id. Each module follows the contract in src/engine/mgkit.js.
import inbox from './inbox.js';
import compose from './compose.js';
import typing from './typing.js';
import spreadsheet from './spreadsheet.js';
import bingo from './bingo.js';
import calendar from './calendar.js';
import timing from './timing.js';
import memory from './memory.js';
import simon from './simon.js';
import math from './math.js';
import quiz from './quiz.js';
import order from './order.js';
import whack from './whack.js';
import stealth from './stealth.js';
import stocks from './stocks.js';
import coffee from './coffee.js';
import jargon from './jargon.js';
import frogger from './frogger.js';
import meeting from './meeting.js';
import plant from './plant.js';
import password from './password.js';
import orgchart from './orgchart.js';
import replyall from './replyall.js';
import expense from './expense.js';
import tailgate from './tailgate.js';
import cables from './cables.js';
import fridge from './fridge.js';
import defender from './defender.js';
import pitch from './pitch.js';
import karaoke from './karaoke.js';
import chart from './chart.js';
import feedback from './feedback.js'; // floor quest: find the colleague first
import lostpw from './lostpw.js'; // floor quest: search the whiteboards first
import review from './review.js'; // HR performance review: opened from the HR desk, never assigned to stations
import compliance from './compliance.js'; // compliance training: the HR desk during a compliance hold (core/conduct.js)
// Holiday activities at the vacation hotel (core/hotel.js): never assigned to office stations.
import sleep from './sleep.js';
import buffet from './buffet.js';
import beachball from './beachball.js';
import swim from './swim.js';
import sunbathe from './sunbathe.js';
import cocktail from './cocktail.js';
import massage from './massage.js';
import sandcastle from './sandcastle.js';
// Chores in your flat on a home office day (core/home.js): never assigned to office stations.
import vacuum from './vacuum.js';
import dishes from './dishes.js';
import laundry from './laundry.js';
import ironing from './ironing.js';
import bath from './bath.js';
import brew from './brew.js';
// Christmas party (core/party.js): never assigned to office stations.
import giftwrap from './giftwrap.js';
import photobooth from './photobooth.js';
import dance from './dance.js';

export const MINIGAMES = Object.fromEntries(
  [
    inbox, compose, typing, spreadsheet, bingo, calendar, timing, memory, simon, math, quiz, order, whack, stealth, stocks, coffee, jargon,
    replyall, password, cables, orgchart, meeting, pitch, fridge, expense, frogger, karaoke, tailgate, defender, plant, chart, feedback, lostpw,
    review, compliance, sleep, buffet, beachball, swim, sunbathe, cocktail, massage, sandcastle,
    vacuum, dishes, laundry, ironing, bath, brew,
    // Christmas party
    giftwrap,
    photobooth,
    dance,
  ].map((m) => [m.id, m]),
);
