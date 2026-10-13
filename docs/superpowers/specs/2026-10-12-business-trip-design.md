# Business trip: a secret level on floors 10 and 30

Status: approved by the /goal (autonomous mode). Decisions the request left open are recorded under "Decisions".

## The request

On floors 10 and 30 a colleague offers a business trip. Accepting starts a short driving mini-game (about 3 minutes) in the
style of Lotus III: The Ultimate Challenge. Arriving puts the player in the client's office, much larger and more complex than
a tower floor. Games there cost the same coffee, the coffee brewer refills every 2 minutes and games pay twice the
paperclips. The visit lasts at most 15 minutes. Crashing during the drive sends the player back to the regular floor and the
opportunity is gone. Follow-up request: the car survives some crashes (about 5) before the trip is cancelled, with a damage
indicator.

## Flow

1. **Offer.** On floors 10 and 30 the first colleague of the floor (`fl.npcs[0]`, so it is always the same person) is the
   account manager. While the trip is still available they now and then call out a teaser when the player is near
   (no marker: it is a secret, but a discoverable one). Talking to them opens the offer dialog: "Grab the keys" / "Not now".
   Not now keeps the offer. No offer while a floor quest or office event runs.
2. **Drive** (`DriveScene`). Briefing card, start lights, then a pseudo-3D road drive through four stages (Downtown,
   Countryside, Motorway, Business Park) with checkpoints that add time, traffic to overtake, curves that push the car out
   and hills. The client's building is just past the finish gate; after the gate the car pulls up and parks in front of its entrance before the arrival card.
   - Crash = hitting a car or a roadside object too fast. Slower bumps only cost speed. A crash dents the car: it stops,
     spins out for 1.2 s (no control, the clock runs on) and is put back on the road, then blinks for 1.5 s during which
     hits are only bumps (no chain crashes into the same tree). "CRASH!" plus a quip and the damage in per cent; the 4th
     warns "ONE MORE AND THE CAR IS DONE". The DMG gauge (5 notches, under the stage name) shows the dents, and from 2
     dents the car smokes. The 5th crash (`WRECK_AT`) wrecks it: "WRECKED!", "Back to the office", the trip is missed.
     Balance: each crash costs ~4 s, so a good driver who crashes four times still arrives (`tests/drive.test.js`).
   - The checkpoint clock running out (Lotus-style) also misses the trip ("the client has left for lunch").
   - Esc pauses: Keep driving / Turn back (turning back misses the trip as well).
   - **Car radio** (added at Martin's request, 2026-10-13): a small radio in the bottom-left corner plays six cover
     versions of Martin's tunes (`tunes.mp3`, transcribed into the tracker format in `src/data/radio.js`: tempo, key,
     chords, bass lines, drum grooves and the main riffs and melodies, cut to their best sections and looped). T or a
     click on the radio tunes to the next one (Track 6 wraps to Track 1); the station is remembered (`settings.radio`).
     M switches the radio off, which is the music setting, so the music stays off afterwards until M again; T or a
     click while it is off switches it back on. Pressing on the radio never drives the car.
   - **Electric hum:** the car is electric, so the engine sound is a gentle hum (a soft motor tone, a faint inverter
     whine rising with speed, a little tyre noise) from the start lights until the car is parked, wrecked or left. It is
     on the sound-effects bus, so the sound setting mutes it, not the radio.
3. **Client office** (`ClientOfficeScene`, a FloorScene subclass). 64×46 tiles (the tower floors are 40×28): two corridors
   joined by a marble atrium, 19 rooms (open plan, meeting rooms, two kitchens, managers, copy rooms, a boardroom, the
   client's speciality room and a reception lobby with the entrance), 20 task stations and more colleagues.
   - Tasks: the same coffee price (game tier), double paperclips, normal XP, no KPI stars (the client does not count
     towards your floor's quota), normal cooldowns.
   - The two coffee brewers each give the usual 3 cups and are ready again after 2 minutes (15 in the tower).
   - A 15-minute clock (wall clock, so it runs on through mini-games and menus) is shown under the HUD. When it runs out,
     a wrap-up card sums up the visit and the player is back on the home floor.
   - The main entrance (a green EXIT sign over the lobby doors) is the way out at any time: walking down into it, or
     Space / a click on it, ends the visit and puts the player straight back on the home floor (no confirmation, the
     summary comes as a toast). Added at Martin's request during implementation.
   - No elevator, HR desk, desk, stand-up, office events, terminal or firing (they are not your colleagues).

## Decisions

- **Once per floor, ever.** `state.trips[floor]` is `'missed'` from the moment the car leaves and becomes `'done'` on
  arrival, so a refresh during the drive cannot buy a second attempt. The offer never comes back on that floor.
- **Time-out during the drive** counts like a crash: Lotus III is a checkpoint race, and without a clock the safe strategy
  would be to crawl. Floor 10 gives 58 s plus 52 s per checkpoint (214 s): a confident driver (~160 s) arrives with about a
  quarter of the clock to spare, a careful one (~180 s) still makes it, a timid one (top speed 70%) runs late. Floor 30
  has 60 + 3 × 53 s against more traffic. `tests/drive.test.js` checks this with the autopilot in `core/drive.js`.
- **Mouse and touch:** hold to accelerate, the car steers towards the pointer; release to coast. Keyboard: Up/W or Space
  accelerate, Down/S brake, Left/Right steer.
- **Floor 30 is harder** than floor 10: more traffic, sharper curves, a different client.
- **Clients** are invented companies: Megafreight Logistics (floor 10, a call-centre company) and Goldvault Capital
  (floor 30, traders). Their offices use their own carpet and wall colours.
- **Save:** `state.trip = { floor, endsAt, sp, tasks }` while visiting. Continuing a career from the title during a visit
  goes back to the client office; an expired visit ends with the summary and the home floor. Client task ids are
  `trip<floor>-<item id>` (their cooldowns and best stars live in the usual maps).
- **Badge:** "Road Warrior: make it to a client on a business trip."
- **Analytics:** `trip {floor, result: arrived|crashed|late|quit, time, stage, crashes}` (`crashed` = wrecked) and `trip_end {floor, sp, tasks}`.
- **Not ported to the C64** (feature-frozen).

## Code

- `src/core/trip.js` (pure): offer status, depart/arrive/end, client tasks (`completeTripTask`), the brewer, time left.
- `src/core/drive.js` (pure): track generation and the driving simulation (`createDrive`), plus an autopilot used by the
  tests to check that a good driver arrives in about 3 minutes with time to spare.
- `src/core/clientFloor.js` (pure): the client office generator; reuses the room furnishing of `floorgen.js`
  (`createPlanner`), which keeps the tower floors byte-identical.
- `src/data/trip.js`: client names, teasers, offer text, crash and wrap-up lines.
- `src/scenes/driveScene.js`, `src/scenes/clientOffice.js`; `MinigameScene` mode `'trip'`; a `drive` song.
- Economy numbers in `economy.js`: `TRIP_FLOORS`, `TRIP_SP_MULT`, `TRIP_VISIT_S`, `TRIP_BREWER_S`, `TRIP_STATIONS`.
