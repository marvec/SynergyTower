# Office Christmas Party: design

Status: agreed in chat on 2026-10-15. Code name `party`.

## Intent

A once-a-year treat for players who come back to the game in December. Unlike the floor-bound special events (archive 3/13/23/33,
night shift 5/15/25/35, home office 8/18/28/38, trip 10/30, holiday 20), this one is tied to the calendar, not to a floor.
It is a party: confetti, a disco ball, colleagues hanging out and dancing. It should be generous, never a grind.

## When and how

- **Window:** local dates 6–23 December inclusive (`month === 11`, `6 <= date <= 23`). Outside it there is no party and no
  invitation.
- **Once per career per calendar year:** `state.parties[year] = 'done'` as soon as a party starts. A career that misses the
  window misses that year's party.
- **Who can go:** checked in (`lobby === 'done'`), not on compliance hold, not away (trip, holiday, night shift, home office,
  inside the archive). Reasons are named like the home office's: `'hold'`, `'badge'`, `'away'`.
- **Invitation:** in the window, the first time a tower FloorScene is entered (not foreign, not at night, no floor quest or
  office event running), the "Fun Committee" invitation card opens once per year (`state.partyInvite = year`): **Go now**
  starts the party; **Later** closes it with a toast that the elevator has a party button.
- **Elevator:** while the party is available, the elevator panel shows a red **P · Christmas party** button (like the
  archive's A button). Going from there starts it the same way.
- **Starting:** `startParty(s, floor, now)`: marks the year done, pays the year-end bonus (1 Stock Option, `PARTY.bonusSo`),
  counts `stats.parties`, opens `state.party`. The party hall replaces the floor (`game.set(new PartyScene(game))`).

## The stay

- **10 minutes** of wall clock (`PARTY.stayS = 600`), held while paused (`party` joins `TIMED` in state.js).
- **Leaving:** through the elevator doors at the top of the hall (confirm dialog) at any time. Time up: back on the floor.
- **Back on the floor:** the floor the party was started from, with a summary card (activities done, paperclips, the gift,
  drinks; "We called you a taxi." after any drink).
- **Saved mid-party:** the title's continue goes back to the hall while the clock runs, else it ends the party with a toast.

## The party hall

`buildPartyHall()` (core/partyHall.js), 44 x 28 tiles, deterministic, cached, built with floorgen's `createPlanner` like the
hotel and the flat. One big room with the entrance (elevator doors, 2 tiles) in the top wall.

- **Dance floor** in the middle (ground style `dancefloor`), the **DJ booth** (Dance-Off) above it.
- **Stage** with a microphone stand, top left (Carol Karaoke).
- **Bar** along the right wall with a bartender behind it (drinks, see below).
- **Buffet** along the left wall (Christmas Buffet).
- **Christmas tree** bottom left with the **Secret Santa table** in front of it (Gift Wrapping).
- **Photo booth** bottom right (Photo Booth).
- Round party tables with chairs at the bottom, a punch bowl, potted poinsettias.
- New furniture types: `djbooth`, `stage`, `micstand`, `partybar`, `xmastree`, `santatable`, `photobooth`, `partytable`,
  `punchbowl`, `poinsettia`, each with curio lines in `PARTY_QUIPS` (data/party.js, read when `fl.party`), at least 20 each.

## Atmosphere

- **Lighting:** the hall is dim and warm (engine/lighting.js through a new scenes/partyLights.js): string lights along the walls
  blink in colours, the tree's lights twinkle, and 6 coloured disco spots (dynamic lights) sweep in circles over the dance
  floor. The disco ball is drawn over the lighting above the dance floor, with sparkles.
- **Confetti:** screen-space particles: a burst on arrival, at the end of the CEO's speech (with a lighting flash), after every
  activity with at least 1 star, and a small one now and then over the dance floor.
- **Santa hats:** a new character look field `hat: 'santa'` (bakeCharacter, all four directions). The player and about 60% of
  the guests wear one at the party.
- **Music:** the song `xmasparty` (original, upbeat) in the hall; Dance-Off is timed to its tempo.

## Guests

- **Colleagues you know:** up to 14 guests drawn from the tower NPCs of floors 1..maxFloor (`buildFloor(f).npcs`), seeded by year
  and the career's cast, never a colleague the CEO fired. Each keeps their own department (FloorScene learns an optional
  per-NPC `dept`), so names, roles and looks match the office.
- **Dancers:** the first 6 stand on the dance floor and bounce in time (`DanceBrain`: no walking, a hop on each beat, turning
  now and then; `Actor.hop` draws them that many px higher). The rest wander the hall.
- **The HR rep** stands by the bar and keeps an eye on things (`HR_WATCH_LINES`).
- **Talking:** guests say party lines (`PARTY_LINES`), sillier ones while you are tipsy (`TIPSY_LINES`). The coffee-break chat
  (drink asks) does not exist at the party: the hall is foreign, so there is no `chatNpc`.
- **Fired colleagues:** if the CEO has let anyone go, an arrival toast jokes that security has a list.
- **The CEO's speech:** once per party on arrival (`party.speech`), a Dialog with jargon lines (`CEO_SPEECH`), ending
  "Cheers!" with the confetti cannon. If you are the CEO (`flags.ceo`), you give it (`CEO_SPEECH_YOU`).

## Activities (mini-games)

All free (no coffee), MinigameScene mode `'party'`, difficulty `PARTY.difficulty` (0.3). Each pays **once per party** at 1 star
or more: `round(taskReward(maxFloor, 3).sp * PARTY.spMult)` paperclips (`spMult = 2`). No XP, no KPI stars, no coffee.

| Activity | Where | Game id | New? |
|---|---|---|---|
| Dance-Off | DJ booth | `dance` | new |
| Gift Wrapping (Secret Santa) | Secret Santa table | `giftwrap` | new |
| Carol Karaoke | stage | `carols` | new |
| Christmas Buffet | buffet | `buffet` | reused, Christmas dishes when `theme.dept === 'party'` |
| Photo Booth | photo booth | `photobooth` | new |

- **Dance-Off:** arrows (four lanes) scroll up to a target line on the beat of `xmasparty`; hit them with the arrow keys or by
  tapping the lane pads. Perfect/good windows; combo confetti. About 40 s.
- **Gift Wrapping:** three gifts; for each, cut the paper at the mark, tape the seam in the band, tie the bow as the ring
  closes. Nine timed presses. A well-wrapped gift reads nicely on the result.
- **Carol Karaoke:** a carol in the public domain (`jinglebells`, `deckhalls`, `wenceslas`: Good King Wenceslas; the tracker is 4/4 only, so no 3/4 carols such as We Wish You a Merry Christmas), its melody split into three pitch
  lanes; keep your voice marker (Up/Down, or tap a lane) on the sung note's lane while the lyrics scroll. Score = time on the
  right lane / sung time. The host plays the carol from the start of play (`inst.song`).
- **Christmas Buffet:** the hotel's buffet with Christmas dishes (turkey, mince pie, gingerbread, pudding, sprouts,
  stollen, candy cane, roast potatoes).
- **Photo Booth:** four shots; each shows a pose (arrow) and counts down; hold that arrow when the flash fires.
- New games are **not** in `COUNTED_GAMES` (the Generalist badge must not need December); the buffet already is.

## Secret Santa gift

Gift Wrapping at 1 star or more (once per party) brings your own Secret Santa gift: the year's exclusive desk decoration
`xmas-<year>` ("Christmas tree <year>", slot left), added to your collection. Never sold in a shop. Its baubles' colours
follow the year. `decorItem` knows the id pattern like the floor trophies.

## The bar

- Free drinks: mulled wine, eggnog, Synergy Punch. Each raises `party.tipsy` by 1, up to `PARTY.maxTipsy` (3); then the
  bartender refuses ("I think you've had enough. Here's some water."). **Water** sobers you up at once.
- Tipsiness wears off by 1 level per `PARTY.soberS` (120) seconds of party play time (`tickParty`; a mini-game's play time
  counts when it ends, like the home office).
- **No reward and no economy effect.** It only makes things sillier and harder:
  - in the hall the view sways (camera offset, `tipsy` px at most, slow) and at level 3 a faint double image;
  - in party mini-games the host sways the picture the same way and adds the double image at level 3.
  - With the system's reduced-motion setting (`reducedMotion()` in platform.js) there is no sway, only the double image.
- No input lag.
- `PartyBar` (a Modal): the three drinks and water; drinks disabled at 3 with the bartender's line.

## Badges

- **Party Animal:** go to a Christmas party (`stats.parties >= 1`).
- **Tipsy:** 3 drinks at one party (`stats.partyTipsy`).
- **Designated Driver:** a party without a drink, every activity at 1 star or more (`stats.partyDesignated`).

## Debugging (dev server only, src/debug.js)

`__party()`: this year's party again (reset), the invitation on the current floor, ignoring the date. `__party('hall')`: straight
into the hall. `__party('tipsy')`: in the hall with 3 drinks.

## Analytics

`party_invite {action: shown|go}`, `party_start`, `party_activity {game, stars}`, `party_drink {kind}`,
`party_end {result: done|early, activities, sp, drinks}`; all with `floor` = maxFloor, as usual.

## Docs

Player guide section "Christmas party" (with 2 screenshots: the hall, Dance-Off), llms.txt, index.html feature list,
CLAUDE.md section, mobile/README.md note to tick "infrequent/mild alcohol references" in the store questionnaires.

## Out of scope

The C64 port (feature-frozen), snow on the title/exterior, other holidays, real gifts between players.
