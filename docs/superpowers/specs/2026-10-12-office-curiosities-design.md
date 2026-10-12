# Office curiosities (Larry-style poking around)

Autonomous design (Martin set a /goal and asked not to pause); the decisions below are mine.

## Goal

Most things in the office react when the player pokes them, in a polite Leisure Suit Larry / Neverhood way, without
the gold focus brackets or the SPACE prompt: those stay reserved for gameplay (stations with a task, the elevator, the
coffee machine, HR desk, terminal, posters, turnstile, your desk). Discovery is the fun: walk up and press Space, or
click the object.

## Decisions

- **Two levels of reaction.**
  - *Quips*: most furniture (chairs, sofas, toilets, vending machine, printers without a task, server racks...) makes
    the player say a line in a speech bubble. Each object type has several lines; poking the same object again gives
    the next line (picked from the object's own seed, so two fridges do not say the same thing first).
  - *Close-ups*: three objects open a full-screen detail view drawn in code:
    - **Fridge**: door notes and magnets, three shelves of labelled lunches; one ancient container always wobbles,
      lifts its lid and blinks. Arrow keys / mouse pick an item, its label and "unnecessary details" show underneath.
    - **Plant**: pot, care tag with a name, an over-watering log; some plants have a worm that pokes out of the soil
      (click it and it waves), some hide a lost object in the soil, some are plastic.
    - **HR filing cabinets** (only in the HR office): drawers A-H / I-Q / R-Z / MISC; each holds folders for the floor's
      real colleagues (same names and roles as on the floor), the HR rep, and the player. A folder opens a personnel
      file: employee number, start year, desk, coffee order, shoe size, review rating, strengths, growth areas,
      notes, incidents, emergency contact, a margin doodle and a coffee ring. The player's own file uses real stats.
      MISC holds the office plant's review, the Stapler Incident and similar.
- **Content is deterministic**: generated from floor number + item id (`createRng`), so the same fridge always holds
  the same things. No state is saved and nothing touches the economy.
- **Stations with a task** that also have a close-up (fridge, plant) get a "Peek" button on the task card, so the
  fridge can still be opened on floors where it hosts Fridge Tetris.
- **Priority**: gameplay targets always win the focus/click; a curio is used only when nothing gameplay is in reach
  (Space) or under the pointer (click). Curios work during quests and events (they are harmless), and are not
  counted for badges.
- **Code layout**: `src/data/curios.js` (all text), `src/core/curios.js` (pure: which objects are curios, line
  selection, fridge/plant/personnel-file generators), `src/scenes/closeUp.js` (the three overlays),
  FloorScene wiring. Tests in `tests/curios.test.js`.
