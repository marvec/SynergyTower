# SynergyTower for the Commodore 64

The whole tower of the real game on four disks: 40 floors in 8 departments, all 33 mini-games plus the HR
performance review, promotions from unpaid intern to CEO, the CEO's personnel decisions and the ending. The same
career as the browser version: title screen and career setup, the street intro, the lobby check-in, colleagues to
talk to, posters, coffee, perks, training, the (demo) Stock Option shop, the elevator, the workstation terminal and
a save game. Everything is converted from the game's own modules at build time. Web links (the contact form, the
tip jar) are shown as addresses.

```bash
brew install cc65 vice
bun c64/build.js --run                 # build the disk images and start VICE with disk 1 side A
bun c64/build.js --sides=1,3           # build only these sides (side 1 is always built: it carries the program)
bun c64/build.js --autoplay=bingo --shots=45,60   # test disk: skips the title, plays that game perfectly
bun c64/build.js --autoplay=promote    # test disk: promotion-ready, takes the HR review, rides up to floor 2
bun c64/build.js --autoplay=ceo        # test disks: floor 40, one star short of CEO (see "Testing"); --fire: fires a colleague on arrival
```

Controls: joystick in port 2, or WASD / cursor keys, FIRE / SPACE / RETURN. On the floor: RUN/STOP menu, B shop,
P perks, T training, S your numbers, M music, H how to play, G give up a floor quest. Mini-games also take their
number keys (and the typing games the whole keyboard). The terminal: type, RETURN runs, cursor up/down history,
F1 completes a command, the up arrow types "~", RUN/STOP or `exit` leaves.

## The disks

| Image | Side | Floors | Department |
|---|---|---|---|
| `synergy-1a.d64` | 1 (boot) | 1-5 | Lobby & Mailroom |
| `synergy-1b.d64` | 2 | 6-10 | Customer Support |
| `synergy-2a.d64` | 3 | 11-15 | Sales |
| `synergy-2b.d64` | 4 | 16-20 | Marketing |
| `synergy-3a.d64` | 5 | 21-25 | IT |
| `synergy-3b.d64` | 6 | 26-30 | Finance |
| `synergy-4a.d64` | 7 | 31-35 | Legal & HR |
| `synergy-4b.d64` | 8 | 36-40 | Executive Suite (and the CEO ending) |

Boot from disk 1 side A (`LOAD"*",8,1`). When the elevator (or the terminal's `systemctl isolate`) takes you to a
floor on another side, the game asks for it ("Please insert disk 2, side A") and checks that it got the right one.
Every side carries its floors, its department image (charset, colleague lines, a directory of the side's files and
the template its floors are packed against, always at the same track/sector), every mini-game of its floors built with that department's content, the terminal
and a save game. The title screen is on side 1 only (quitting to the title asks for it).

Saving: the career (three blocks: `save` and `save3`) is written to the save of the side in the drive, with a save counter and a career id. Continuing
from side 1 follows the trail: if the newest save says you were on floor 23, the game asks for disk 3 side A and
takes over the newer save it finds there (only one of the same career).

## The mini-games

All 33 station games of the browser version, each with the full difficulty range of the 40 floors (the browser's
`difficulty` 0-1 as 0-255) and its content per department: Jargon Decoder, Meeting Buzzword Bingo, Cable Spaghetti,
Coffee Run, Name Badge Memory, Badge Tailgate, Coffee Crossing, Expense Fraud Detective, Schedule the Meeting,
Elevator Pitch, Reply-All Apocalypse, Desk Plant Survival, Magic Chart, Fridge Tetris, Lost Password and 360 Feedback
(floor quests: the first half is played on the floor against the clock), Whack-a-Bug, Org Chart Reorg, Corporate
Quiz, Server Rack Sequence, Meeting Survival, Perfect Timing, Inbox Zero, Slide Karaoke, Boss Alert, Compose the
Email, Calendar Defender, Process Order, Password Policy, Fix the Spreadsheet, Speed Typing, Quarterly Ticker and
Expense Report, plus the HR Performance Review.

Each is a port of the JS game with its rules, timings, scoring and content; the differences (40 columns, 16 colours,
8 sprites, no mouse, 8 KB per game) are listed in each overlay's header comment. Every overlay has a test bot
(`--autoplay=<id>`, with `--dept=<id>` and `--diff=<0-255>`) that plays it by reading its state: all reach 3 stars at
both ends of the difficulty range.

## What the build does

`build.js` (Bun) imports the game's own modules and converts them:

| From the JS game | To |
|---|---|
| `buildFloor(1..40)`: tiles, rooms, furniture, stations, colleagues, posters, turnstiles | char map + colour map + walk/interact grid + header with names, strings and the floor's economy row (`tools/floor.js`) |
| furniture drawn as fat-pixel rectangles (`tools/art.js`) | multicolour chars, composited onto the floor under them, deduplicated per department |
| the bitmap font (`src/engine/font.js`) | chars 32-126 of the charset (ASCII = screen code); the title logo in quarter blocks |
| tracker songs (`src/data/music.js`) | 3-voice SID streams: lead, bass, drums + effects (`tools/music.js`) |
| economy (`taskReward`, `xpToNext`, `keycardFee`, cooldowns, perks...) | per-floor rows in the floor files, 40-floor tables (24-bit) in part 3 |
| colleague lines, help texts, dialog texts, titles | byte-pair compressed strings (`tools/bpe.js`) |
| mini-game content (`src/data/mg-*.js`), terminal (`src/core/terminal.js`) | data tables per overlay and department (`tools/mgdata.js`, `tools/mg/*.js`, `tools/termdata.js`) |

It assembles everything with ca65/ld65, packs it with its own packer (`tools/lz.js`: bit-oriented LZ with gamma
codes, a repeat-offset match and an optimal parse; ~70% of the input) and writes the disk images itself
(`tools/d64.js`), so it controls sector placement and knows where every file starts.

## Memory map ($01 = $36: BASIC ROM out, KERNAL + I/O in)

| Address | Contents |
|---|---|
| `$0002-$003f`, `$0080-$008f` | zero page (`$02-$13` shared with overlays, see `src/api.inc`; resident part in `src/zp.inc`) |
| `$0200-$0257`, `$02a7-$02ff`, `$033c-$03fb` | multiplexer tables, context for overlays (HR review, floor quests), button labels |
| `$0801-$3fff` | resident part 1: engine, API jump table at `$0810`, multiplexer, HUD, floor, economy, save, side handling, music |
| `$4000-$5fff` | overlay slot (`mg.*`, `sys.term`, `sys.title`, `sys.end`); packed floors and department images load here too, and the floor template is unpacked here while a floor unpacks |
| `$6000-$63ff` | spill: the packed tail of an overlay unpacked in place, the game screen's colours while paused |
| `$6400-$7fff` | resident part 3: menus, elevator, floor picker, the CEO, 40-floor tables, dialog texts (side 1, at boot) |
| `$8000-$93ff` | the current floor |
| `$9400-$95fb` | the career state, two pages (`src/state.inc`): the career, and the cooldowns of any floor (a list of 50) |
| `$9600-$beff` | resident part 2: dialogs, task cards, mini-game host, game table, strings |
| `$bf00-$bffd` | state page 3: the best stars of all 434 stations of the tower, a nibble each (the `save3` block) |
| `$c000` / `$c400` | the two screens (VIC bank 3); the playfield alternates between them (overlays may use `$c400`: the terminal keeps its history and buffers there) |
| `$c800` | charset (the side's department image) |
| `$d000-$dfff` | RAM under the I/O: the side's directory and colleague lines (read with `$01 = $34`) |
| `$e000-$fdbf` | RAM under the KERNAL: person frames, overlay sprites, game help texts, perks, all songs; after them, up to `$fdc0`, the side's floor template (packed) |
| `$fdc0-$fdff` | the box a fired colleague carries out |
| `$fe00-$feff` | your hair's 4 sprite frames |

## Tricks in use

- **Fast loader with a 2-bit transfer** (`src/drive.s`, `src/loader.s`): the C64 toggles ATN and the drive puts two
  bits on CLK and DATA, answering within 13 µs. The C64 sets the pace, so raster IRQs can't break a transfer and
  the music keeps playing. Files are fetched by track and sector (no directory search), with an interleave of 13.
  The drive code also has a write command (the save blocks, written through the DOS's job queue, with their
  links). A failed read is retried after a head bump, which is what a disk swap needs.
- **Disk sides** (`src/side.s`): all sides have the same disk ID; the department image at a fixed track/sector says
  which side is in the drive.
- **Sprite multiplexer**: up to 16 actors share the 8 sprites, sorted by height every frame.
- **Smooth vertical scrolling under a fixed 3-row HUD**, with double-buffered screens.
- **Byte-pair text compression**: bytes 128-255 stand for pairs of symbols, expanded on the way to the screen.
- **Breadth-first route map**: a fired colleague walks out along a distance map of the floor from the elevator,
  built in the top of the overlay slot (`src/leave.s`; a floor quest's overlay stays below it).
- **In-place unpacking**: overlays unpack over their own packed copy, so no load buffer is needed.
- **Floors as differences from a template**: the floors of a side share their walls, corridors, lobby and much of
  their header, so each is packed against a template (the grids and header tables of the side's most typical floor,
  `tools/lz.js` with a dictionary). The department image carries the template; it stays packed under the KERNAL,
  and a floor load unpacks it into the overlay slot, then the floor, whose matches reach back into it as if it stood
  right before `$8000` (`lz_unpack_dict`). That saves about 3 blocks per side.
- **The directory track's spare sectors**: when a side is full, files continue on track 18 after the directory
  (the DOS never puts files there, the fast loader doesn't care). Side 1 needs this in test builds.
- **A seconds clock in the raster IRQ** for coffee refills and cooldowns (deadlines in the save game).
- **Overlays with a fixed ABI**: a jump table in the resident part (`API_*`) and a header at `$4000`.

## Differences from the browser version

- Web links can't be opened: the feedback form (synergytower.co.uk/feedback) and the tip jar are shown as addresses.
- No real-time clock: coffee and cooldowns run while the C64 runs (the browser counts time away too).
- Your skin tone is the skin of everyone on the floor (all people share two of the sprites' colours); your hair
  colour and style ride on your head as an extra sprite.
- The ending's tower doesn't pan; the fireworks are character bursts.
- The terminal fits a mini-game's 8 KB: it has all the browser's commands and their replies (some shortened), but no
  pipes or `&&` chains, `ls` without `-l`, `grep` only as a joke, a smaller file system, and `systemctl` lists the
  floor targets without their names. `systemctl isolate levelNN.target` still takes you to any floor.
- The C64 has no mouse: everything is joystick or keys.

## Testing

`--autoplay=<game|promote|terminal|hr|elevator|ceo>` builds a test disk that skips the title and plays; `--shots=`
takes headless VICE screenshots at those seconds. `tools/vmon.py` drives VICE's remote monitor (breakpoints by label,
memory dumps, screenshots, `@frames N`), and `--pre=LABEL:commands` runs commands once at a label, e.g. a disk swap:

```bash
bun c64/build.js --autoplay=ceo
python3 c64/tools/vmon.py run_ending+3 "@frames 45" "screenshot \"/tmp/end.png\" 2" --secs=400 \
  --pre='swap_prompt:attach "c64/build/synergy-4b.d64" 8' --d64=c64/build/synergy-1a.d64
```

(Test builds don't wait for FIRE at the swap prompt. `run_ending` itself sits at `$a800`, where the BASIC ROM also
runs while VICE autostarts, hence the `+3`.)

## Measured in VICE (true drive emulation)

| | |
|---|---|
| reset to the title | ~37 s (with VICE's autostart: the boot file's 6 blocks via the KERNAL, then ~120 blocks fast) |
| loading | ~0.15 s per block (a 14-block overlay in 2.2 s), music playing; unpacking adds ~0.1 s per KB |
| mini-game start | 2-4 s the first time (the overlay stays loaded while you replay it) |
| disk swap | ~8 s after FIRE: the department image and the side's save (~6 s, the first read after a swap retries after a head bump), then the floor |
| terminal | ~5 s to open (an 8 KB overlay), back to the floor at once |
| disks | 4 images; side 1 is full (a few blocks free, plus spare sectors on track 18), the others 109-140 blocks free |
