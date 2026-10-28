# Mini-game visual review (2026-10-18)

**Implemented 2026-10-21:** the second pass is in the game (see `docs/superpowers/plans/2026-10-19-minigame-art.md`); `mockups/` is kept as the reference.

All 54 mini-games were captured on the dev server (`__mg(id, 0.6)`, about 4 s into play, `img/current/<id>.png`) and
sorted by how much visual detail they have. The six games singled out for a redo have mockups in `img/`: stills
drawn with the game's own engine (bitmap font, `header`/`timerBar`, `bakeCharacter`) at 480x270, scaled 2x. At the time
of this review the game code was unchanged (the mockups came first). The mockups' drawing code is in `mockups/` (`kit.js`
holds the helpers; see "Building it" below).

## Tiers

### A: illustrated scenes (the bar to aim for)
Elevator Pitch, Meeting Survival, Coffee Crossing, Desk Plant Survival, Badge Tailgate, Fridge Tetris, Cable Spaghetti,
Expense Fraud Detective, PowerPoint Karaoke, Org Chart Shuffle, Reply-All Apocalypse, Meeting Buzzword Bingo, Schedule
the Meeting.

What they have in common:
- every object has a 1 px dark outline, a highlight edge and a shadow edge (`panel`, art.js `box`);
- people have consistent proportions (pitch.js `person()`, 12x30 at 2x; or the floors' sprites);
- the background tells you where you are with 3-6 props (whiteboard, clock, plant, window, elevator doors);
- small idle animation (talking mouths, swinging clock hands, blinking LEDs).

### B: clean "office software" (fine as is)
Inbox Triage, Write the Email, Rapid Reply, Fix the Spreadsheet, Name Badge Memory, Server Rack Sequence, Expense
Report, Corporate Quiz, Slide Deck Order, Whack-a-Bug, Quarterly Ticker, Coffee Run, Jargon Decoder, Password Policy,
Decline, Magic Chart, 360 Feedback, Lost Password, Performance Review, Compliance Training, Perfect Timing.

A monitor or dialog on the shared `backdrop()` (blue wall, brown desk). Flat on purpose and readable. Cheap wins, if any:
- `backdrop(g, { dept })` could add a department touch along the desk (mug, sticky notes, a plant, a window for exec),
  so a dozen games stop sharing the same empty wall;
- Name Badge Memory: card backs with the corporate logo instead of the text "ID".

### B-: a scene, but primitive figures
**Boss Alert.** The layout is right (hallway, your cubicle, your screen, legend), but the walkers are box people, the
hallway is a flat band, and the cubicle and you are a few rectangles. Mockup below.

### C: placeholder art
Most of these are the newest games: the hotel, home office, party and roof sets.
- **Hotel:** Counting Sheep, Lobster, Pool Ball, Swim to the Buoy, Golden Brown, Pina Colada, Deep Tissue, Sandcastle.
- **Home office:** Dust Buster, Squeaky Clean, Separate Cycles, Pressing Matters, Just Right, Home Brew.
- **Party:** Gift Wrapping, Photo Booth, Dance-Off, Carol Karaoke.
- **Roof:** Smoke Break.

Shared problems:
1. Flat fills with no outline or shading (the A games always outline and shade).
2. People are 3-5 rectangles with wrong proportions: Deep Tissue's head is a quarter of the shoulders' width with
   no face, Pool Ball's swimmer is a head on a box, and Smoke Break's hand is two blocks.
3. Empty single-colour bands for sky, sea and sand, with nothing that says "hotel", "kitchen" or "roof".
4. No depth: no ground shadows, no foreground or background.
5. Objects are boxes: the bucket, plate, iron, washing machines, gift and ball.

## Mockups, second pass: the in-between style (the proposal)

The first pass (below) was too detailed for the rest of the game. The second pass (`img/mid-*.png`) keeps its
scenery and simplifies it:
- **People** are the Elevator Pitch figure (`mockups/person.js`, a copy of pitch.js `person()` extended with a skirt,
  a tie, raised arms, a back view and swimwear): 12x30 cells, flat colours, a big head, 2 px pixels. The massage
  guest is the same idea from above on a 4 px grid.
- **The player's figure** follows the trousers/skirt choice: short hair and swim trunks, or long hair and a swimsuit,
  in the corporate colour (`mid-poolball-trousers/skirt`, `mid-massage-trousers/skirt`).
- **Backgrounds** are flat bands instead of dithered gradients. Detail is 2 px, objects have at most a light and a
  shadow tone, and there is no 1 px noise. In the code, this is `setStyle('mid')` in `mockups/kit.js`.
- **Hands** (the massage, Smoke Break) use 2 px cells and three flat tones.
- **Boss Alert's** walkers are pitch figures; the boss is the pitch's CEO type.

| Game | Proposal |
|---|---|
| Deep Tissue | `mid-massage-trousers.png`, `mid-massage-skirt.png` |
| Pool Ball | `mid-poolball-trousers.png`, `mid-poolball-skirt.png` |
| Sandcastle | `mid-sandcastle.png`, `mid-sandcastle-done.png` |
| Squeaky Clean | `mid-dishes.png` |
| Smoke Break | `mid-cigarette-dusk.png`, `mid-cigarette-night.png` |
| Boss Alert | `mid-bossalert.png` |

Deep Tissue is zoomed in to a 6 px grid, cropped at the waist by the towel, so the knots get the back: about
`BACK = { x: 196, y: 124, w: 88, h: 104 }`. The masseur's hands use 3 px cells to match. Smoke Break's hand is a 3 px
cell sprite in two layers: the index finger is drawn after the cigarette, over the filter's top edge. Boss Alert's boss
has plain eyes, not glasses.

### The other placeholder games (same style)

| Set | Game | Proposal | Gameplay constants |
|---|---|---|---|
| Hotel | Counting Sheep | `mid-sleep.png`, `mid-sleep-skirt.png` | none |
| Hotel | Lobster | `mid-buffet.png` | none |
| Hotel | Swim to the Buoy | `mid-swim.png`, `mid-swim-skirt.png` | none |
| Hotel | Golden Brown | `mid-sunbathe.png`, `mid-sunbathe-skirt.png` | none |
| Hotel | Pina Colada | `mid-cocktail.png` | none |
| Home | Dust Buster | `mid-vacuum.png` | none (the furniture stays outside the spawn area) |
| Home | Separate Cycles | `mid-laundry.png` | none |
| Home | Pressing Matters | `mid-ironing.png` | creases should spawn on the shirt's shape, not its whole rect |
| Home | Just Right | `mid-bath.png` | water colour from blue to soft pink; bubbles inside the oval tub |
| Home | Home Brew | `mid-brew.png` | none |
| Party | Gift Wrapping | `mid-giftwrap.png` | none |
| Party | Photo Booth | `mid-photobooth.png`, `mid-photobooth-skirt.png` | the pose card is taller (display only) |
| Party | Dance-Off | `mid-dance.png`, `mid-dance-skirt.png` | none |
| Party | Carol Karaoke | `mid-carols.png` | none |

Their code is in `mockups/hotel/`, `mockups/home/` and `mockups/party/`, with the entries `index-hotel.js`,
`index-home.js` and `index-party.js` (each installs `window.__mockShot_<set>`).

## Mockups, first pass (too detailed, kept for reference)

| Game | Before | After | What changed |
|---|---|---|---|
| Deep Tissue | `before-massage.png` | `massage-a.png` (spa, daylight), `massage-b.png` (candlelit, slate floor) | Real anatomy from above: the head is a third of the shoulders' width (back of the head, ears, a bun), neck, shoulder caps, arms with hands, shoulder blades, spine and dimples. Skin is shaded in 4 tones with a Bayer dither. A padded table with a face cradle and a draped towel; knots are swollen, glowing patches with tension marks. The masseur's hands are 22x30 with fingers and tunic cuffs. Props: rolled towels, a candle on stones, a bowl with petals, an orchid, oil. |
| Pool Ball | `before-beachball.png` | `poolball.png` | The hotel behind the pool (hazed so the ball reads against it), palms, loungers and parasols, a tiled deck and coping, water in a depth gradient with caustics and a lane line, a ladder. The swimmer stands waist-deep with real proportions, sunglasses and a ripple ring; the legs show through the water. The ball is a round sphere with six turning panels. **New:** its shadow on the water shows where it will land. |
| Sandcastle | `before-sandcastle.png` | `sandcastle.png`, `sandcastle-done.png` | Dithered sky with gulls, an island and a sail, rolling surf, wet and dry sand with grain, shells, a starfish, footprints, a parasol and towel, a spade. The pail is tapered, with a rim, handle and highlight, held by a kid's arm. Tiers have tapered sides, crenellations, windows and a door; the finished castle gets a flag and shells. |
| Squeaky Clean | `before-dishes.png` | `dishes.png` | A kitchen: subway tiles, a window with curtains and a herb pot, a mug shelf, a speckled worktop, cabinet doors with a tea towel. A steel sink heaped with suds, a gooseneck tap, washing-up liquid. The plate is round with a blue patterned rim and a well, with ketchup, egg and crumbs on it. The sponge has two layers (yellow foam, green scourer) and throws bubbles. The drying rack holds slanted plates, with a drip tray, a cutlery cup and a green arrow over the free slot. |
| Smoke Break | `before-cigarette.png` | `cigarette-dusk.png`, `cigarette-night.png` | The roof's skyline in two sky moods (the backdrop could follow RoofScene's `skyMode`: day, dusk, night): sunset clouds or stars and moon, two building layers with lit windows, a water tower, an antenna with a blinking light. A concrete parapet with a tin ashtray and a coffee cup. A real hand: suit sleeve, shirt cuff with a cufflink, the cigarette between index and middle finger, the other fingers curled. The cigarette is shaded as a cylinder (cork filter with a gold ring, paper, cracked ash), the ember glows (at night it lights the fingers) and the smoke curls. |
| Boss Alert | `before-stealth.png` | `bossalert.png` | A furnished hallway: ceiling lights, wallpaper, a chair rail and wainscot, carpet tiles, HR and CEO doors with name plates, a SYNERGY poster, a city window, a water cooler, a clock, a plant. Colleagues are the floors' own sprites (`bakeCharacter`, 2x), so the boss is recognisable from the tower; a decoy wears a suit with a blue tie. Your cubicle is seen over your shoulder: fabric partitions with notes, you from behind with headphones, your monitor with a rear-view mirror on its corner. A real Solitaire window, and the legend as a mugshot against a height chart. |

## Gameplay constants the mockups assume

These are proposals and would move hit areas, so the matching tests need a re-run:

- **Deep Tissue:** knots spawn in the back's shape, about `BACK = { x: 172, y: 96, w: 136, h: 104 }` (today
  150/60/180/160, which includes the head area). The masseur's hands are bigger (`REACH` could grow to 20).
- **Pool Ball:** `WATER` 214 (today 200) and `HANDS` 160 (today 182), so the swimmer stands taller and the ball meets
  raised hands. Draw the ball's shadow on the water.
- **Smoke Break:** the hand is drawn 1.7x around the grip point. The HEAT/ASH gauges move to the right
  (`mx` 420), because the sleeve takes the bottom left. `CIG.len` could drop from 250 to 200 so the cigarette and the
  fingers are closer in scale.
- **Boss Alert:** `FEET_Y` 112 (today 104) gives more floor in front of the wall; the walkers are 2x floor sprites,
  and the boss faces you (the down row) when looking.
- **Sandcastle** and **Squeaky Clean:** no changes. The rack's free slot sits between two plates; the arrow marks it.

Re-run `tests/holiday.test.js` (attentive and idle players), `tests/chores.test.js`, the roof tests and
`MG=... bun test tests/minigames.test.js` after any of these.

## Suggestions for the other C games

- **Counting Sheep:** fluffy sheep (a cloud body, black face and legs) leaping a proper fence; a meadow under a
  dithered night sky; the bed seen through a bedroom window frame; the count in a thought bubble.
- **Lobster (buffet):** a tablecloth with folds, chafing dishes with lids and steam, recognisable food (lobster,
  shrimp, fruit), a plate you carry; the hotel restaurant behind.
- **Swim to the Buoy:** a crawl stroke (alternating arms, a wake), a striped buoy on its rope, the jetty's planks, the
  hotel beach behind; reuse the Pool Ball water.
- **Golden Brown:** a human figure lying on the towel (not slabs), sunglasses and a hat, a parasol's shadow, sand grain;
  the tan gauge as a sun thermometer.
- **Pina Colada:** a hurricane glass with an umbrella and a straw, fruit that reads as fruit, a bar counter, the
  sunset reflected in the sea.
- **Dust Buster:** dust bunnies as fluffy grey balls with eyes, a robot vacuum or an upright with a cord, a patterned
  rug, furniture edges along the walls.
- **Separate Cycles:** clothes that read as clothes (T-shirt, socks, jeans, a hoodie), front-loading machines with
  round glass doors, a laundry basket.
- **Pressing Matters:** a tapered ironing board, an iron with steam puffs, a shirt with a collar and sleeves instead of
  a rectangle; creases as wrinkle lines that flatten.
- **Just Right:** a clawfoot tub, chrome taps, water with foam, the rubber duck, a tiled wall, a thermometer gauge.
- **Home Brew:** the grinder, kettle and mugs as shaded objects with steam, the steps as a recipe card.
- **Gift Wrapping:** patterned paper, a ribbon and bow, a tape dispenser, the tree in the corner.
- **Photo Booth:** the booth's curtain and flash, the strip of photos printing out.
- **Dance-Off:** a lit dance floor, the disco ball, the DJ booth; dancers as 3x floor sprites with dance poses.
- **Carol Karaoke:** a choir in Santa hats, the lyrics on a screen, candles and a tree; lanes styled as a music staff.

Shared scenery would make the sets cheap. The hotel's sky, sea and sand serve Pool Ball, Swim, Sandcastle, Golden
Brown and Pina Colada; one flat backdrop serves the home chores; the party hall's colours serve the party games.

## Building it

- `mockups/kit.js` is a draft art kit for `mgkit.js`:
  - `gradient`: Bayer-dithered, the night lighting's look;
  - `blob` / `shaded`: ellipses with a rim, base and light;
  - `tonePx`: dithered 4-tone shading;
  - `sprite`: string-map sprites;
  - `glow`, `vignette`, `planks`, `speckle`, `line`.
- The mockups paint per pixel, which is fine for a still. In a game, bake static backgrounds once in `create()`
  into an offscreen canvas (as the floors do) and draw only the moving parts per frame.
- People: use the floors' `bakeCharacter` at 2-3x where colleagues appear (hallways, the party), pitch.js `person()` for
  stage-sized figures, and dedicated larger anatomy only for close-ups (massage, hands).
- Order by how often players see each game: Boss Alert (a station game), then Smoke Break, Deep Tissue, Pool Ball,
  Sandcastle, Squeaky Clean, then the rest of the hotel, home, party sets.

Regenerating the mockups needs the dev server and a page with a career:
`bun build docs/minigame-visuals/mockups/index.js --format iife` → evaluate in the page → `__mockShot('massage-a')`
returns a 960x540 PNG data URL.
