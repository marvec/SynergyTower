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

export const MINIGAMES = Object.fromEntries(
  [inbox, compose, typing, spreadsheet, bingo, calendar, timing, memory, simon, math, quiz, order, whack, stealth, stocks, coffee].map((m) => [m.id, m]),
);
