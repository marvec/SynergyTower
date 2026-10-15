// The party's text and songs: carols line up syllable for note, every line is plain ASCII and the curio lists are long enough.
import { test, expect } from 'bun:test';
import { SONGS } from '../src/data/music.js';
import * as D from '../src/data/party.js';
import { ACTIVITY_GAMES } from '../src/core/party.js';

const notes = (song) => song.melody.flatMap((bar) => bar.trim().split(/\s+/)).filter((t) => /^[A-G][#b]?\d$/.test(t)).length;

test('every bar has 16 steps and a chord', () => {
  for (const id of ['xmasparty', 'jinglebells', 'deckhalls', 'wenceslas']) {
    const song = SONGS[id];
    expect(song, id).toBeTruthy();
    expect(song.melody.length).toBe(song.chords.length);
    for (const bar of song.melody) expect(bar.trim().split(/\s+/).length, `${id}: ${bar}`).toBe(16);
  }
});

test('each carol has one syllable per sung note', () => {
  expect(D.CAROLS.map((c) => c.id).sort()).toEqual(['deckhalls', 'jinglebells', 'wenceslas']);
  for (const c of D.CAROLS) expect(c.syllables.length, c.id).toBe(notes(SONGS[c.id]));
});

test('the activities, and plain ASCII text everywhere', () => {
  expect(D.PARTY_ACTIVITIES.map((a) => a.game).sort()).toEqual([...ACTIVITY_GAMES].sort());
  const strings = [];
  const walk = (v) => (typeof v === 'string' ? strings.push(v) : Array.isArray(v) ? v.forEach(walk) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : null);
  walk(Object.fromEntries(Object.entries(D).filter(([, v]) => typeof v !== 'function')));
  walk([D.PARTY_INVITE('Acme', 10), D.CEO_SPEECH('Acme'), D.CEO_SPEECH_YOU('Acme'), D.PARTY_LEAVE('5:00'), D.FIRED_JOKE(2)]);
  walk(D.PARTY_SUMMARY({ result: 'done', activities: 3, total: 5, sp: 1200, drinks: 1, gift: 'xmas-2026' }));
  for (const s of strings) expect(/^[\x20-\x7e\n]*$/.test(s), s).toBe(true);
  expect(D.PARTY_LINES.length).toBeGreaterThanOrEqual(20);
  expect(D.TIPSY_LINES.length).toBeGreaterThanOrEqual(12);
  expect(D.HR_WATCH_LINES.length).toBeGreaterThanOrEqual(10);
  for (const [type, lines] of Object.entries(D.PARTY_QUIPS)) expect(lines.length, type).toBeGreaterThanOrEqual(20);
});

test('the summary mentions the taxi only after a drink', () => {
  expect(D.PARTY_SUMMARY({ result: 'done', activities: 5, total: 5, sp: 900, drinks: 2, gift: null })).toContain('taxi');
  expect(D.PARTY_SUMMARY({ result: 'done', activities: 5, total: 5, sp: 900, drinks: 0, gift: null })).not.toContain('taxi');
});
