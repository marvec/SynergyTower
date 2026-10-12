# Save slots (several careers per browser)

Autonomous design (Martin set a /goal); the decisions below are mine.

## Goal

Several careers side by side. "Continue career" on the title screen lists every saved career, last played first, as a
horizontal row of cards; from there the player plays one, deletes one, starts a new career or goes back. At most 100
careers. The in-game menu stays as it is: switching careers means quitting to the title.

## Decisions

- **Storage**: one key per career (`synergytower.slot.<id>`, the same JSON as before) plus a small index
  (`synergytower.slots.v1`) of summaries: name, corporation and colour, looks, floor, level, paperclips, stars, badge
  count, last played. The picker draws from the index alone, so 100 careers do not mean parsing 100 saves.
- **Pure core** `src/core/slots.js` over any getItem/setItem/removeItem storage (localStorage, a Map in tests, a
  native store in a later port). The index heals itself: entries whose save is gone are dropped, an unreadable
  index starts over.
- **Migration**: the old single save (`synergytower.save.v1`) becomes the first career the first time the index is read,
  then the old key is removed. Deleting that career later does not bring it back (the index exists by then).
- **Last played** = the last save of that career (autosave every couple of seconds while playing). Ties (same
  millisecond) go to the career saved later.
- **Title**: loads the last played career as before (tower colours, name line, music settings). "Continue career"
  always opens the picker, even with one career, so the list is where careers are chosen. "New career" goes to the
  setup screen, or to the picker when all 100 slots are taken.
- **Picker** (`src/scenes/careerPicker.js`): cards are employee ID badges like the one on the new-career screen (corp
  colour band, portrait in the career's current outfit, name, job title, floor and level, stars / paperclips / badges,
  last played). Four on screen, scrolling to the selection. Keys: left/right (or wheel) pick, Enter plays, Del deletes,
  N new career, Esc back; mouse: click a card to select it, click it again to play, buttons below. Delete asks twice
  ("Really delete?") and moving to another card cancels. All slots taken: New career is disabled and the note
  "Delete a character to create a new one" shows above the buttons.
- **Setup screen**: Esc (outside the text fields) goes back to the title.
- **In-game**: only the career being played is loaded; nothing in the tower reads the other slots. Reset career in the
  menu deletes only the current career.
