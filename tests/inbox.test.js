import { test, expect } from 'bun:test';
import { POOLS, card } from '../src/minigames/inbox.js';
import { measureText } from '../src/engine/font.js';

const rng = { pick: (a) => a[0], int: (a) => a };

test('every bin shows a rule that fits inside it', () => {
  for (const [dept, pool] of Object.entries(POOLS)) {
    expect(pool.hints, dept).toHaveLength(3);
    for (const h of pool.hints) expect(measureText(h), `${dept}: ${h}`).toBeLessThanOrEqual(94);
  }
});

test('a mail that names its sender shows it on the From line', () => {
  const d = POOLS.default;
  expect(card(d, 0, 'Boss: Can you send the Q3 deck?', rng)).toEqual({ from: 'From: Boss', text: 'Can you send the Q3 deck?' });
  expect(card(d, 1, 'Comms: Meet our new VP', rng).from).toBe('From: Comms');
  // Spam comes from a dodgy address, even when it looks like a reply.
  expect(card(d, 2, 'Re: Re: Re: invoice.exe', rng)).toEqual({ from: 'From: ' + d.from[2][0], text: 'Re: Re: Re: invoice.exe' });
});

test('every reply and archive mail names its sender', () => {
  for (const cat of [0, 1]) for (const t of POOLS.default.items[cat]) expect(t, t).toMatch(/^[A-Z][A-Za-z]+: ./);
});

test('other departments label their cards with a number', () => {
  expect(card(POOLS.support, 1, 'Outage across Europe', rng)).toEqual({ from: 'Ticket #1000', text: 'Outage across Europe' });
});
