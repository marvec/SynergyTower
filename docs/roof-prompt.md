# The roof: feature prompt

Feature: the roof (a secret level), one roof for the whole tower, reached from floors 2, 12, 22, 32 (ROOF_FLOORS).

Discovery: on each of these floors one outer-wall window (row 0, FloorView.hasWindow true, a reachable floor tile
below it, picked deterministically without the RNG like fl.myDesk so floors stay unchanged) is the fire-escape
window, with cigarette butts on its sill. One colleague on the floor has a quip hinting at it ("Dave's on the roof
again. Don't ask me how."). It reacts to Space/fire/click like the office curiosities (no focus brackets, no prompt;
gameplay targets win). Blocked like the other secrets (hold, before check-in, trip, holiday, night shift, home office,
archive, party, and while the guard has closed the roof today): a short "It's stuck." line instead.

Getting there: the player walks into the window and is gone; a short climb scene up the fire escape with a floor
counter running to 40, the joke line scaled by distance (from floor 2: "38 floors. The smokers do this every day.");
skippable with Space/click. The way back: the fire escape to the floor and tile you came from, or the cradle (below).

RoofScene: a `foreign` FloorScene subclass on buildRoof() (src/core/roof.js, floorgen's createPlanner, 40x28).
It must read as a roof: gravel/tar ground styles, a parapet all round instead of walls, air-conditioning units, a
water tank, an antenna mast, a stairwell shack with the roof door, the fire-escape ladder head, a smokers' bench with
a sand bucket, pigeons, the company's beehives ("our ESG strategy"), the window cleaners' cradle on its rail at the
parapet. Roof props are curios (ROOF_QUIPS, read when fl.roof, at least 20 per type). The skyline is drawn behind the
top parapet so it shows above the map. The sky follows the local time: day, sunset (around 18-20 h), night in the
title screen colours with lit windows in the city; at night use darkLighting with a few roof lamps. Song: a new relaxed
`rooftop`.

Pay telescope: a coin-op telescope at the parapet (a few paperclips per look, from economy.js) opens a close-up
(like scenes/closeUp.js): a wide procedural skyline (deterministic, parallax layers, same time of day as the roof),
panned with arrows/drag/swipe, zoomed with the telescope. Easter eggs to spot (click or Space on them, or centre them):
the client's office from the business trip, the holiday hotel's beach on the horizon, a hot-air balloon, someone
waving from a window across the street, a rival tower with its own logo. Spotting them all is a badge ("Spotter").

Window cleaners' cradle: interacting with it rides it down the outside of the tower: a facade view scrolling past
the floors' windows (each floor's lit interior, a colleague or two at their desks, waving or startled), down to the
roof floor you came from, where you climb back in through the fire-escape window. Skippable.

Facilities guard: now and then (random, every 1-3 min of roof time) a guard steps out of the roof door, walks a
patrol round the roof and goes back in after 30-60 s. He ignores the smokers (he came for a cigarette himself) but
not you: get within a few tiles of him in his line of sight (walls and tall props block it) and he catches you. A "?"
over his head with a short grace moment before the catch; hiding behind the AC units and the water tank works.
Caught: he walks you down the stairs (a short card, "The roof is closed to staff."), you're back on the roof floor,
and the window stays stuck for the rest of the local day (state.roof.closedDay). No HR strike.

Smokers: 3-4 colleagues (tower NPCs of the floor you came from, by cast; never the fired) stand round the bench
chatting with speech bubbles. Talking to one opens a card: Small talk / Take a cigarette / No thanks / Bye.
Small talk gives office gossip (when the next office event is due, which station's cooldown ends soonest, a party
hint in December). The archive hint: if the next floor up (3, 13, 23, 33) is an archive floor whose folder is not
handed in yet, one smoker confesses after a shared cigarette (any result) or after "No thanks" plus small talk:
"I nicked an HR folder and stuffed it in the archive. Row C, cabinet 7. Don't tell HR." For that the drawer must exist
beforehand: archiveDrawer(state, floor) derives it deterministically from the career (cast/seed) and the floor
among folderDrawers(), and acceptArchive uses it instead of the rng (the archive is the same, only the choice moves);
check what that does to saves with an archive task running (keep their task.drawer). The archive gets row letters and
cabinet numbers: signs at each cabinet row's end and numbers on the cabinet tops, readable in the player's light
(drawn over the dark like the searched-drawer tick). Smoking itself pays nothing: no paperclips, XP, KPI stars or
coffee. "No thanks" counts towards a "Fresh Air" badge.

Mini-game `cigarette` (src/minigames/cigarette.js, the mini-game contract, MinigameScene mode 'roof', free,
counted: add it to COUNTED_GAMES, so the count becomes 48 everywhere): hold Space / fire / mouse / touch to draw.
An ember heat meter has a sweet spot; too little draw and it goes out (relight with a lighter in the wind, costs
time), too much and you cough (screen shake), and burning it to the filter burns your fingers (ends it). Tap a second
key (or a click) to flick ash off before it gets long enough to fall on your tie. Wind gusts push the heat. The
cigarette's length is the clock (~45-60 s). Score = share of time in the sweet spot, minus drops; a perfect player
>= 0.85, an idle one ~0; peek() for the tests. Give it a GAME_TIER only if it ever becomes a station game (it isn't).

State and the rest: state.roof = { closedDay, spotted: {...}, ... } plus what's needed to resume; Continue on a save
made on the roof puts you back on the roof floor at the window. Badges ("Fresh Air", "Smoke Break Networker",
"Spotter", maybe "Not Today" for a guard patrol survived close by). Analytics: roof_enter, roof_smoke {stars},
roof_decline, roof_hint {floor}, roof_telescope, roof_spotted {what}, roof_cradle, roof_caught. Console helpers in
src/debug.js: __roof() / __roof(22) / __roof('up') / __roof('guard'). Tests: the fire-escape window exists and is
reachable on all four floors and the floors are otherwise unchanged; the blocked states; the archive hint names the
drawer that acceptArchive then uses; the guard catches within reach and line of sight only; the mini-game's
perfect/idle players; the quip counts. Update the 47 -> 48 count (title, Generalist, guide, llms.txt, index.html
metadata, OG image), the guide (decide with me how much of the secret it tells), and CLAUDE.md. The C64 port is
frozen.

Mockup the roof (day and night), the telescope view and the cradle ride first and show me before implementing.
