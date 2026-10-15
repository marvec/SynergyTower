// Colleagues' figures follow their first names: women wear skirts, men trousers, gender-neutral names can be either.
import { test, expect, afterAll } from 'bun:test';
import { FIRST_NAMES, WOMEN_NAMES, MEN_NAMES } from '../src/data/people.js';

/** A canvas that records the colour of every pixel filled, honouring translate/scale (enough for bakeCharacter). */
function pixelCanvas(w = 16, h = 16) {
  const px = new Map();
  let t = { a: 1, e: 0, f: 0 };
  const stack = [];
  const ctx = {
    fillStyle: '#000',
    save: () => stack.push({ ...t }),
    restore: () => (t = stack.pop()),
    translate: (x, y) => ((t.e += x * t.a), (t.f += y)),
    scale: (sx) => (t.a *= sx),
    fillRect(x, y, fw, fh) {
      for (let j = 0; j < fh; j++)
        for (let i = 0; i < fw; i++) {
          const X = t.e + t.a * (x + i) - (t.a < 0 ? 1 : 0);
          px.set(`${X},${t.f + y + j}`, ctx.fillStyle);
        }
    },
    drawImage() {},
    clearRect() {},
  };
  const c = { width: w, height: h, style: {}, getContext: () => ctx, px };
  return c;
}
const made = [];
globalThis.document ??= {};
const realCreate = globalThis.document.createElement;
afterAll(() => (globalThis.document.createElement = realCreate)); // other test files share this global
globalThis.document.createElement = () => {
  const c = pixelCanvas();
  made.push(c);
  return c;
};
const { bakeCharacter, CHAR_W, CHAR_H } = await import('../src/engine/art.js');
const { npcLook, npcIdentity, suit } = await import('../src/scenes/floorWorld.js');

const first = (seed) => npcIdentity(seed, 'support').name.split(' ')[0];

test('every first name is a woman\'s, a man\'s or gender-neutral, never two of those', () => {
  for (const n of WOMEN_NAMES) expect(FIRST_NAMES).toContain(n);
  for (const n of MEN_NAMES) expect(FIRST_NAMES).toContain(n);
  expect(WOMEN_NAMES.filter((n) => MEN_NAMES.includes(n))).toEqual([]);
  expect(WOMEN_NAMES).toContain('Karen');
  expect(MEN_NAMES).toContain('Gary');
  const neutral = FIRST_NAMES.filter((n) => !WOMEN_NAMES.includes(n) && !MEN_NAMES.includes(n));
  expect(neutral).toContain('Alex');
  expect(neutral.length).toBeLessThan(FIRST_NAMES.length / 4);
});

test('colleagues with women\'s names wear skirts (no tie), men trousers; neutral names can be either', () => {
  const neutral = { skirt: 0, trousers: 0 };
  for (let seed = 1; seed < 600; seed++) {
    const look = npcLook(seed, 'support');
    const name = first(seed);
    if (WOMEN_NAMES.includes(name)) {
      expect(look.skirt, name).toBeTruthy();
      expect(look.tie).toBeNull();
    } else if (MEN_NAMES.includes(name)) expect(look.skirt, name).toBeFalsy();
    else neutral[look.skirt ? 'skirt' : 'trousers']++;
    expect(npcLook(seed, 'support')).toEqual(look); // the same person every time
  }
  expect(neutral.skirt).toBeGreaterThan(5);
  expect(neutral.trousers).toBeGreaterThan(5);
});

test('a woman figure is drawn with a flared skirt and no trousers, in every direction', () => {
  const look = { skin: '#f1c7a0', hair: '#3a2a1a', hairStyle: 2, shirt: '#d8dfe8', pants: '#123456', skirt: '#a83a5a', tie: null, jacket: null, shoes: '#1a1410' };
  made.length = 0;
  bakeCharacter(look);
  const sheet = made[0].px;
  for (let row = 0; row < 4; row++) {
    for (let f = 0; f < 3; f++) {
      const at = (x, y) => sheet.get(`${f * CHAR_W + x},${row * CHAR_H + y}`);
      const colours = [];
      for (let y = 0; y < CHAR_H; y++) for (let x = 0; x < CHAR_W; x++) colours.push(at(x, y));
      expect(colours).toContain('#a83a5a');
      expect(colours).not.toContain('#123456');
      const width = (y) => [...Array(CHAR_W).keys()].filter((x) => at(x, y) === '#a83a5a').length;
      const rows = [...Array(CHAR_H).keys()].filter((y) => width(y) > 0);
      expect(width(rows.at(-1)), `row ${row} frame ${f}`).toBeGreaterThan(width(rows[0])); // wider at the hem
    }
  }
  // A man keeps his trousers.
  made.length = 0;
  bakeCharacter({ ...look, skirt: null });
  expect([...made[0].px.values()]).toContain('#123456');
});

test('a suit or uniform (auditor, HR, reception) gives a woman a matching skirt and never a tie', () => {
  const her = { ...npcLook(1, 'finance'), skirt: '#7a3b4a', tie: null };
  const him = { ...npcLook(1, 'finance'), skirt: undefined };
  expect(suit(her, '#22242e', { tie: '#5a5f70' })).toMatchObject({ jacket: '#22242e', skirt: '#22242e', tie: null });
  expect(suit(him, '#22242e', { tie: '#5a5f70' })).toMatchObject({ jacket: '#22242e', tie: '#5a5f70' });
  expect(suit(him, '#22242e').skirt).toBeUndefined();
});

test('the player can wear a skirt: in the corporate colour, then matching the jacket, never with a tie', async () => {
  const { careerLook } = await import('../src/game.js');
  const { CORP_COLORS } = await import('../src/data/corpColors.js');
  const col = CORP_COLORS[2];
  const her = (maxFloor) => careerLook({ skin: 0, hair: 0, hairStyle: 1, skirt: true, colorId: col.id, maxFloor });
  expect(her(1)).toMatchObject({ skirt: col.color, tie: null, jacket: null });
  expect(her(12)).toMatchObject({ skirt: col.color, tie: null });
  expect(her(25)).toMatchObject({ skirt: col.dark, jacket: col.dark, tie: null });
  // Trousers, as before (and for saves from before the choice).
  const him = careerLook({ skin: 0, hair: 0, colorId: col.id, maxFloor: 12 });
  expect(him.skirt).toBeFalsy();
  expect(him.tie).toBe(col.color);
});

test('the setup screen offers trousers or a skirt and the new career keeps the choice', async () => {
  const { SetupScene } = await import('../src/scenes/setup.js');
  let made = null;
  const game = { now: () => 0, sfx: () => {}, newCareer: (s) => ((made = s), false) };
  const setup = new SetupScene(game);
  setup.corpField = { value: 'Corp', focus() {} };
  setup.nameField = { value: 'Ann', focus() {} };
  setup.build();
  const labels = setup.buttons.items.map((b) => b.label);
  expect(labels).toContain('Trousers');
  expect(labels).toContain('Skirt');
  expect(setup.look().skirt).toBeFalsy();
  setup.buttons.items.find((b) => b.label === 'Skirt').onClick();
  expect(setup.look()).toMatchObject({ skirt: expect.any(String), tie: null });
  await setup.start();
  expect(made.player.skirt).toBe(true);
  setup.buttons.items.find((b) => b.label === 'Trousers').onClick();
  expect(setup.look().skirt).toBeFalsy();
  await setup.start();
  expect(made.player.skirt).toBe(false);
});

test('every career has its own cast: the same seat, another person; cast 0 is the original one', () => {
  const name = (seed, cast) => npcIdentity(seed, 'support', cast).name;
  let differ = 0;
  for (let seed = 1; seed < 200; seed++) {
    expect(name(seed, 0)).toBe(npcIdentity(seed, 'support').name); // saves from before the cast keep their colleagues
    expect(npcLook(seed, 'support', 0)).toEqual(npcLook(seed, 'support'));
    expect(name(seed, 12345)).toBe(name(seed, 12345)); // the same person all career long
    expect(npcLook(seed, 'support', 12345)).toEqual(npcLook(seed, 'support', 12345));
    if (name(seed, 12345) !== name(seed, 0)) differ++;
  }
  expect(differ).toBeGreaterThan(180);
  // The figure still follows the career's own name.
  for (let seed = 1; seed < 200; seed++) {
    const first = npcIdentity(seed, 'support', 777).name.split(' ')[0];
    if (WOMEN_NAMES.includes(first)) expect(npcLook(seed, 'support', 777).skirt).toBeTruthy();
    if (MEN_NAMES.includes(first)) expect(npcLook(seed, 'support', 777).skirt).toBeFalsy();
  }
});

test('a Santa hat: red with a white trim on the head, in every direction', () => {
  const base = { ...npcLook(3, 'support'), skirt: undefined };
  const pixelAt = (sheet, x, y) => sheet.get(`${x},${y}`);
  made.length = 0;
  bakeCharacter(base);
  const plain = made[0].px;
  made.length = 0;
  bakeCharacter({ ...base, hat: 'santa' });
  const hat = made[0].px;
  for (let row = 0; row < 4; row++) {
    const y = row * CHAR_H;
    expect(pixelAt(hat, 7, y + 1)).toBe('#d8343a'); // the red cap, just above the head
    expect(pixelAt(hat, 7, y + 2)).toBe('#f4f1e8'); // the white trim
    expect(pixelAt(plain, 7, y + 2)).not.toBe('#f4f1e8');
  }
});
