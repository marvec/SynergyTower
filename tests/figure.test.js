// The Elevator Pitch figure, shared by the mini-games: poses, skirt, swimwear, the back view, the career look.
import { test, expect } from 'bun:test';
import { recordingCanvas } from './mock-canvas.js';
const { person, figureLook, DEFAULT_PLAYER } = await import('../src/engine/figure.js');

const LOOK = { skin: '#f2c9a0', hair: '#5a3620', top: '#dfe6ee', pants: '#3a3f55' };
const fills = (calls) => new Set(calls.map((c) => c.fill));

test('the default figure is 12x30 cells: head on top, shoes at the bottom', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 1, LOOK);
  const ys = calls.map((c) => c.y);
  expect(Math.min(...ys)).toBe(0);
  expect(Math.max(...calls.map((c) => c.y + c.h))).toBe(30);
  expect(Math.max(...calls.map((c) => c.x + c.w))).toBe(12);
});

test('a skirt is drawn in its colour; trousers are not', () => {
  const a = recordingCanvas();
  person(a.ctx, 0, 0, 2, { ...LOOK, skirt: '#2f8f7f' });
  expect(fills(a.calls).has('#2f8f7f')).toBe(true);
  const b = recordingCanvas();
  person(b.ctx, 0, 0, 2, LOOK);
  expect(fills(b.calls).has('#2f8f7f')).toBe(false);
});

test('arms up puts the hands above the head', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 100, 2, LOOK, { pose: 'armsUp' });
  const skinTop = Math.min(...calls.filter((c) => c.fill === LOOK.skin).map((c) => c.y));
  expect(skinTop).toBeLessThan(100);
});

test('swimwear: trunks show bare skin on the chest, a suit shows the corporate colour', () => {
  const t = recordingCanvas();
  person(t.ctx, 0, 0, 2, { ...LOOK, corp: '#2f8f7f' }, { swim: 'trunks' });
  expect(fills(t.calls).has(LOOK.top)).toBe(false);
  expect(fills(t.calls).has('#2f8f7f')).toBe(true);
  const s = recordingCanvas();
  person(s.ctx, 0, 0, 2, { ...LOOK, corp: '#2f8f7f', long: true }, { swim: 'suit' });
  expect(fills(s.calls).has('#2f8f7f')).toBe(true);
});

test('the back view shows hair and no eyes', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 2, LOOK, { view: 'back' });
  expect(fills(calls).has('#222')).toBe(false);
  expect(fills(calls).has(LOOK.hair)).toBe(true);
});

test('a Santa hat is red with a white trim', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 2, { ...LOOK, collar: '#111111', hat: 'santa' }); // a collar that is not the trim's white
  const has = (x, y, w, h, fill) => calls.some((c) => c.x === x && c.y === y && c.w === w && c.h === h && c.fill === fill);
  expect(has(4, -2, 16, 4, '#d8343a')).toBe(true); // the cap
  expect(has(2, 2, 20, 4, '#f4f1e8')).toBe(true); // the trim over the brow
  expect(has(20, 0, 4, 4, '#f4f1e8')).toBe(true); // the bobble
});

test('figureLook: a skirt career gets long hair and the skirt; a jacket becomes the top with shirt lapels', () => {
  const skirt = figureLook({ skin: '#a86b42', hair: '#2b1d14', hairStyle: 0, shirt: '#dfe6ee', jacket: null, pants: '#3a3f55', tie: null, skirt: '#c03030' }, '#c03030');
  expect(skirt).toMatchObject({ skin: '#a86b42', hair: '#2b1d14', top: '#dfe6ee', skirt: '#c03030', long: true, corp: '#c03030' });
  const suit = figureLook({ skin: '#f2c9a0', hair: '#7a4a22', hairStyle: 1, shirt: '#f4f1e8', jacket: '#22242e', pants: '#1a1a22', tie: '#2a6ad1' }, '#2a6ad1');
  expect(suit).toMatchObject({ top: '#22242e', lapel: '#f4f1e8', tie: '#2a6ad1', long: false });
  expect(DEFAULT_PLAYER.skin).toBeTruthy();
});

test('the pitch outfits stay: the employee wears red tabs and a bib, the CEO a red tie and a gold watch', () => {
  const you = recordingCanvas();
  person(you.ctx, 0, 0, 2, { ...LOOK, bib: true }, 'talk');
  expect(fills(you.calls).has('#e2504a')).toBe(true);
  expect(fills(you.calls).has('#3a1a1a')).toBe(true); // the talking mouth, expr given as the 6th argument
  const ceo = recordingCanvas();
  person(ceo.ctx, 0, 0, 2, { ...LOOK, ceo: true, lapel: '#15171e' }, { expr: 'neutral' });
  expect(fills(ceo.calls).has('#f2c14e')).toBe(true);
  expect(fills(ceo.calls).has('#c0392b')).toBe(true);
});

test('every pose stays inside its box (arms reach 7 cells above the head and 6-7 to the sides) with the feet on the ground', () => {
  const s = 2;
  for (const look of [LOOK, { ...LOOK, skirt: '#2f8f7f', long: true }]) {
    for (const pose of ['stand', 'walkA', 'walkB', 'armsUp', 'waveL', 'waveR', 'crouch', 'danceA', 'danceB']) {
      const { ctx, calls } = recordingCanvas();
      person(ctx, 0, 100, s, look, { pose, expr: 'smile' });
      expect(calls.every((c) => c.fill !== undefined)).toBe(true);
      expect(Math.min(...calls.map((c) => c.x))).toBeGreaterThanOrEqual(-6 * s);
      expect(Math.max(...calls.map((c) => c.x + c.w))).toBeLessThanOrEqual(19 * s);
      expect(Math.min(...calls.map((c) => c.y))).toBeGreaterThanOrEqual(100 - 7 * s);
      expect(Math.max(...calls.map((c) => c.y + c.h))).toBe(100 + 30 * s); // a foot on the ground
    }
  }
});

test('a crouch drops the head, a dance raises one arm', () => {
  const stand = recordingCanvas();
  person(stand.ctx, 0, 100, 2, LOOK);
  const crouch = recordingCanvas();
  person(crouch.ctx, 0, 100, 2, LOOK, { pose: 'crouch' });
  const topOf = (calls) => Math.min(...calls.filter((c) => c.fill === LOOK.hair).map((c) => c.y));
  expect(topOf(crouch.calls)).toBeGreaterThan(topOf(stand.calls));
  const dance = recordingCanvas();
  person(dance.ctx, 0, 100, 2, LOOK, { pose: 'danceA' });
  expect(Math.min(...dance.calls.filter((c) => c.fill === LOOK.skin).map((c) => c.y))).toBeLessThan(100);
});

test('a crouch bends the knees apart in a skirt too, under the skirt', () => {
  const legsOf = (pose) => {
    const { ctx, calls } = recordingCanvas();
    person(ctx, 0, 0, 1, { ...LOOK, skirt: '#2f8f7f', long: true }, { pose });
    return calls.filter((c) => c.fill === LOOK.skin && c.y >= 24 && c.h > 1).map((c) => c.x).sort((a, b) => a - b);
  };
  expect(legsOf('stand')).toEqual([3, 7]);
  expect(legsOf('crouch')).toEqual([2, 8]); // over the crouching shoes (x 1 and 8), like trousers
});

test('the faces: every expression draws eyes and a mouth; "interested" works for looks without a brow colour', () => {
  for (const expr of ['neutral', 'interested', 'delighted', 'bored', 'annoyed', 'talk', 'nervous', 'smile', 'sing']) {
    const { ctx, calls } = recordingCanvas();
    person(ctx, 0, 0, 1, LOOK, { expr });
    expect(calls.some((c) => c.fill === undefined)).toBe(false);
    expect(fills(calls).has('#222')).toBe(true);
  }
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 1, LOOK, { expr: 'interested' }); // LOOK has no brow (not built by figureLook)
  const brows = calls.filter((c) => c.y === 2 && c.w === 1 && (c.x === 4 || c.x === 7));
  expect(brows.length).toBe(2);
  expect(brows[0].fill).not.toBe(LOOK.hair);
  expect(brows[0].fill).not.toBe(LOOK.skin);
});

test('swimmers keep their skin legs below the hips (the water tints them)', () => {
  for (const swim of ['trunks', 'suit']) {
    const { ctx, calls } = recordingCanvas();
    person(ctx, 0, 0, 1, { ...LOOK, corp: '#2f8f7f' }, { swim, pose: 'armsUp' });
    const legs = calls.filter((c) => c.fill === LOOK.skin && c.y >= 21 && c.x >= 3 && c.x < 9 && c.w === 2);
    expect(legs.length).toBe(2);
    expect(Math.max(...legs.map((c) => c.y + c.h))).toBe(29);
  }
});

test('swimsuit torso is the corporate colour from the shoulders to the hips, as in the approved Pool Ball mockup', () => {
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 1, { ...LOOK, corp: '#2f8f7f', long: true }, { swim: 'suit', pose: 'armsUp' }); // top and corp differ
  const torso = calls.find((c) => c.x === 2 && c.y === 10 && c.w === 8 && c.h === 11);
  expect(torso.fill).toBe('#2f8f7f');
  // the sleeves are bare arms
  expect(calls.some((c) => c.x === 0 && c.w === 2 && c.fill === LOOK.skin)).toBe(true);
  expect(calls.some((c) => c.fill === LOOK.top)).toBe(false);
});

test('swimwear without a corporate colour (an NPC look) falls back to the top, never an undefined fill', () => {
  for (const swim of ['trunks', 'suit']) {
    const { ctx, calls } = recordingCanvas();
    person(ctx, 0, 0, 2, LOOK, { swim });
    expect(calls.some((c) => c.fill === undefined)).toBe(false);
    expect(calls.some((c) => c.fill === LOOK.top)).toBe(true);
  }
});

test('figureLook falls back to the default player for missing fields', () => {
  const f = figureLook({ jacket: null }, undefined);
  expect(f.skin).toBe(DEFAULT_PLAYER.skin);
  expect(f.hair).toBe(DEFAULT_PLAYER.hair);
  expect(f.top).toBe(DEFAULT_PLAYER.top);
  expect(f.pants).toBe(DEFAULT_PLAYER.pants);
  expect(f.corp).toBe(DEFAULT_PLAYER.corp);
  expect(typeof f.brow).toBe('string');
  expect(() => figureLook({}, '#123456')).not.toThrow();
});

test('longTop: the top hangs over the skirt\'s waistband (rows 19-20), the skirt starts at row 21; without it at row 19', () => {
  const rowsOf = (look) => {
    const { ctx, calls } = recordingCanvas();
    person(ctx, 0, 0, 1, look);
    return calls.filter((c) => c.x === 2 && c.w === 8 && c.fill === '#2f8f7f').map((c) => c.y);
  };
  expect(rowsOf({ ...LOOK, skirt: '#2f8f7f' })).toEqual([19]);
  expect(rowsOf({ ...LOOK, skirt: '#2f8f7f', longTop: true })).toEqual([21]);
  const { ctx, calls } = recordingCanvas();
  person(ctx, 0, 0, 1, { ...LOOK, skirt: '#2f8f7f', longTop: true });
  const last = (x, y) => calls.filter((c) => c.x <= x && x < c.x + c.w && c.y <= y && y < c.y + c.h).at(-1).fill;
  expect(last(5, 19)).toBe(LOOK.top);
  expect(last(5, 20)).toBe(LOOK.top);
  expect(last(5, 21)).toBe('#2f8f7f');
});
