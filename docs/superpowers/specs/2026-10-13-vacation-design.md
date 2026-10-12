# Vacation: a secret level on floor 20

Status: approved by the /goal (autonomous mode). Decisions the request left open are recorded under "Decisions".

## The request

On floor 20 one of the colleagues is the player's own boss. Talking to them, the player can request vacation for 5000
paperclips. It takes them to an ultra-all-inclusive tropical 5-star hotel with easy holiday mini-games (no office games);
each gives an extra coffee that the player keeps back at the office. The stay lasts at most 15 minutes and the hotel exit
leaves early. Inside: sleep in your own room, dinner at the restaurant buffet (eat anything by touching it). Outside: the
garden, the pool (bounce a ball), and through the garden to the sea: swim, or sunbathe. More activities of the same kind
are welcome.

## Flow

1. **The boss.** On floor 20 the first colleague (`fl.npcs[0]`, always the same person) is "Your Manager". Now and then,
   when the player is near, they call out a hint about unused holiday ("Your leave balance is looking very healthy...").
   Talking to them opens the leave request: "Go on vacation (5000)" / "Not now". Without the paperclips the
   button is disabled and the text says how many are missing. No offer while a floor quest or office event runs.
2. **Paradise Palms Resort** (`HotelScene`, a FloorScene subclass on `buildHotel()`, 48×42 tiles, `foreign`).
   - Inside the hotel (top): the lobby with the reception and the main entrance (EXIT sign; walking up into it, or
     Space/click, ends the stay at once), your suite (bed), the restaurant (buffet).
   - Through the terrace doors: the garden with palms, the pool and its deck, a tiki pool bar and a spa cabana; below it
     the beach (sun loungers, a sandcastle spot, a lifeguard chair) and a wooden jetty into the sea.
   - The player wears a holiday shirt; guests in summer clothes wander around and say holiday things.
   - A 15-minute wall clock under the HUD. When it runs out, a wrap-up card ("Back to work") and the player is back on
     floor 20.
3. **Activities** (`MinigameScene` mode `'vacation'`): free (no coffee cost), no paperclips, XP or KPI stars. Finishing one
   with at least 1 star (score ≥ 0.35) gives +1 coffee on top of the pot (it may go over the maximum, like the coffee
   machine, so it stays with you until you drink it). Each activity pays its coffee once per stay; one with 0 stars can be
   tried again. A done activity shows a tick instead of the coffee cup; it can still be played again just for fun (no coffee).

| Activity | Where | Mini-game (super easy, ~25-30 s) |
|---|---|---|
| Sleep in | your suite, the bed | `sleep`: sheep jump over the fence, press as each one is in the air to count it (wide window) |
| Dinner buffet | restaurant | `buffet`: dishes slide along the buffet, move the plate (mouse or arrows) and touch them to eat |
| Pool ball | pool deck | `beachball`: keep a slow beach ball in the air by moving under it |
| Swim | the jetty ladder | `swim`: tap (Space/click) to stroke out to the buoy and back, gentle waves |
| Sunbathe | a sun lounger on the beach | `sunbathe`: turn over when the tan is golden, before it burns (wide window), 4 turns |
| Pool bar cocktail | tiki bar | `cocktail`: catch the falling fruit in the glass, skip nothing (no bad items) |
| Massage | spa cabana | `massage`: tap the knots as they appear on the back; they wait patiently |
| Sandcastle | beach | `sandcastle`: drop each sand layer as the bucket swings over the castle (generous overlap) |

## Decisions

- **Once a day.** The boss approves one vacation per local calendar day (`state.vacations.day`, as the stand-up's
  `dayKey`). Paying 5000 paperclips every time keeps it a treat; the daily limit keeps coffee from being farmed.
- **Floor 20 only, any time.** The player can come back down to floor 20 later and still ask.
- **Coffee only.** No paperclips or XP: it is a holiday. The coffee bonus goes over the maximum and regeneration simply
  waits until the pot is below the maximum again (existing rule), so it is not lost.
- **Save:** `state.vacation = { endsAt, done: { <game>: true }, coffee }` while away. Continuing a career from the title
  during a stay goes back to the hotel; an expired stay ends with a toast and floor 20.
- **Foreign floor:** no office events, stand-up, firing, trips, elevator, HR, desk, terminal or brewers in the hotel.
- **Badge:** "Out of Office: take a vacation."
- **Analytics:** `vacation_start {floor}`, `vacation_activity {game, stars}` and `vacation_end {coffee, activities, early}`.
- **Secret:** the player guide, `llms.txt` and the crawler text only say that floor 20 hides a secret getaway, not how.
- **Not ported to the C64** (feature-frozen).

## Code

- `src/core/vacation.js` (pure): offer status, request (pay + start), activity completion, time left, end, debug reset.
- `src/core/hotel.js` (pure): the hotel map, built with floorgen's `createPlanner`; sea and pool are a new non-walkable
  tile `T_WATER`; `fl.ground` overrides floor styles per tile (grass, sand, deck, path, pool, sea); outdoor boundary walls
  are hedges (`fl.hedgeFrom`).
- `src/data/vacation.js`: hotel name, boss lines, offer text, guest lines, activity cards, wrap-up lines.
- `src/minigames/{sleep,buffet,beachball,swim,sunbathe,cocktail,massage,sandcastle}.js`, registered in `MINIGAMES` but
  not in `STATION_GAMES`/`GAME_TIER` (never assigned to office stations).
- `src/scenes/hotel.js`; `MinigameScene` mode `'vacation'`; a `tropical` song; new tiles and furniture in `art.js`.
- Economy numbers in `economy.js`: `VACATION_FLOOR`, `VACATION_COST`, `VACATION_S`, `VACATION_COFFEE`.
