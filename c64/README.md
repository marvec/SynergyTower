# SynergyTower for the Commodore 64

Floors 1 and 2 of the real game on one `.d64`, with the same career as the browser version: title screen and
career setup, the street intro, the lobby check-in, every station's mini-game on both floors, the HR performance
review and the promotion to floor 2, the elevator, the workstation terminal, colleagues to talk to, posters,
coffee, perks, training, the (demo) Stock Option shop and a save game on the disk. Everything is converted from
the game's own modules at build time. Web links (the contact form, the tip jar) are shown as addresses.

```bash
brew install cc65 vice
bun c64/build.js --run                 # build c64/build/synergy.d64 and start VICE
bun c64/build.js --autoplay=bingo --shots=45,60   # test disk: skips the title, plays that station perfectly
bun c64/build.js --autoplay=promote    # test disk: promotion-ready, takes the HR review, rides up to floor 2
```

Controls: joystick in port 2, or WASD / cursor keys, FIRE / SPACE / RETURN. On the floor: RUN/STOP menu, B shop,
P perks, T training, S your numbers, M music, H how to play, G give up a floor quest. Mini-games also take their
number keys. The terminal: type, RETURN runs, cursor up/down history, F1 completes, the pound key types "|".

## The mini-games

| Floor 1 (Grand Lobby) | Floor 2 (Mailroom) |
|---|---|
| Jargon Decoder (the check-in at the front desk) | Schedule the Meeting |
| Meeting Buzzword Bingo | Elevator Pitch |
| Cable Spaghetti | Reply-All Apocalypse |
| Coffee Run | Desk Plant Survival |
| Name Badge Memory | Magic Chart |
| Badge Tailgate | Fridge Tetris |
| Coffee Crossing | Lost Password (a floor quest: find your pet's photo on the whiteboards, then log in) |
| Expense Fraud Detective | Whack-a-Bug |

Plus the HR Performance Review on both floors. Each is a port of the JS game at the difficulty floors 1-2 use,
with its rules, timings, scoring and content; the differences (40 columns, 16 colours, 8 sprites, no mouse) are
listed in each overlay's header comment. Every overlay has a test bot (`--autoplay=<id>`) that plays it by reading its
state; all reach 3 stars in our runs except the Fridge Tetris bot, which sometimes overfills the fridge.

## What the build does

`build.js` (Bun) imports the game's own modules and converts them:

| From the JS game | To |
|---|---|
| `buildFloor(1)`, `buildFloor(2)`: tiles, rooms, furniture, stations, colleagues, posters, turnstiles | char map + colour map + walk/interact grid + header with names and strings (`tools/floor.js`) |
| furniture drawn as fat-pixel rectangles (`tools/art.js`) | multicolour chars, composited onto the floor under them, deduplicated |
| the bitmap font (`src/engine/font.js`) | chars 32-126 of the charset (ASCII = screen code); the title logo in quarter blocks |
| tracker songs (`src/data/music.js`) | 3-voice SID streams: lead, bass, drums + effects (`tools/music.js`) |
| economy (`taskReward`, `xpToNext`, `keycardFee`, cooldowns, perks...) | tables in `gen/econ.s` |
| colleague lines, help texts, dialog texts | byte-pair compressed strings (`tools/bpe.js`) |
| mini-game content (`src/data/mg-*.js`), terminal (`src/core/terminal.js`) | data tables per overlay (`tools/mgdata.js`, `tools/mg/*.js`, `tools/termdata.js`) |

It assembles everything with ca65/ld65, packs it with its own LZ packer (`tools/lz.js`) and writes the disk image
itself (`tools/d64.js`), so it controls sector placement and knows where every file starts.

## Disk and boot

| File | Loaded by | Contents |
|---|---|---|
| `synergy` | KERNAL (`LOAD"*",8,1`), 5 blocks | boot: uploads the drive code, fast-loads the rest |
| `chars`, `far`, `main2`, `main` | fast loader, at boot | charset; sprites + long texts under the KERNAL; the resident program's parts |
| `floor01`, `floor02` | fast loader | the floors |
| `sys.title`, `sys.term` | fast loader | title / setup / intro overlay; the terminal |
| `mg.*` | fast loader | one overlay per mini-game, loaded when you start it (kept while you stay with it) |
| `save` | the drive code writes it in place | the career: one block |

## Memory map ($01 = $36: BASIC ROM out, KERNAL + I/O in)

| Address | Contents |
|---|---|
| `$0002-$003f`, `$0080-$008f` | zero page (`$02-$13` shared with overlays, see `src/api.inc`; resident part in `src/zp.inc`) |
| `$02a7-$02ff`, `$033c-$03fb` | context for overlays (HR review, floor quest), button labels |
| `$0801-$3fff` | resident part 1: engine, API jump table at `$0810`, multiplexer, HUD, host, economy, save, music |
| `$4000-$5fff` | overlay slot (`mg.*`, `sys.title`) |
| `$6000-$7fff` | load buffer for packed files |
| `$8000-$93ff` | the current floor |
| `$9400-$94ff` | the career state (`src/state.inc`) = the save block |
| `$9500-$bfff` | resident part 2: dialogs, menus, elevator, game table, economy tables, strings |
| `$c000` / `$c400` | the two screens (VIC bank 3); the playfield alternates between them |
| `$c800` | charset |
| `$e000-$fff9` | RAM under the KERNAL: 12 person frames, overlay sprites at `$e300`, long texts (read with the KERNAL banked out) |

The terminal is bigger than the overlay slot: it is unpacked in place over `$4000-$93ff` (slot, load buffer and
floor) from a packed copy loaded to the top of that area, and the floor is loaded again when you leave it.

## Tricks in use

- **Fast loader with a 2-bit transfer** (`src/drive.s`, `src/loader.s`): the C64 toggles ATN and the drive puts two
  bits on CLK and DATA, answering within 13 µs. The C64 sets the pace, so raster IRQs can't break a transfer and
  the music keeps playing. Files are fetched by track and sector (no directory search), with an interleave of 13.
  The drive code also has a write command: the save game is a block the build reserves, written through the
  DOS's job queue.
- **Sprite multiplexer**: up to 16 actors (colleagues, the receptionist, the HR rep, quest whiteboards) share the 8
  sprites. Each frame they are sorted by height; sprites lower down reuse a hardware sprite from a raster IRQ on
  the line where its previous occupant ends, and lower actors get the higher priority (they stand in front).
- **Smooth vertical scrolling under a fixed 3-row HUD**: a raster IRQ below the HUD sets YSCROLL; new map rows are
  drawn into the hidden screen, the screens swap, and the colour RAM is copied ahead of the beam.
- **Byte-pair text compression**: bytes 128-255 stand for pairs of symbols, expanded on the way to the screen
  (~38% smaller for this game's text). The terminal has its own table.
- **A seconds clock in the raster IRQ** for coffee refills and cooldowns (deadlines in the save game).
- **Overlays with a fixed ABI**: a jump table in the resident part (`API_*`) and a header at `$4000`, so each
  mini-game links on its own. `src/mgkit.s` is their shared kit, like `src/engine/mgkit.js`.
- **Multicolour and hires chars on one screen**: colour RAM bit 3 picks the mode per cell.
- **Oblique walls**: a wall's cap is drawn into the floor cell above it, as in the browser version.

## Differences from the browser version

- Floors 3-40 are not on the disk: the elevator and the terminal say so and point to synergytower.co.uk.
  Firing colleagues (floor 40) and the CEO ending are out of reach for the same reason.
- Web links can't be opened: the feedback form (synergytower.co.uk/feedback) and the tip jar are shown as addresses.
- No real-time clock: coffee and cooldowns run while the C64 runs (the browser counts time away too).
- Skin, hair colour and hair style show on the badge, not on the walking sprite (all people share two of the
  sprites' colours).
- The C64 has no mouse: everything is joystick or keys.

## Measured in VICE (true drive emulation)

| | |
|---|---|
| boot to the title | ~33 s after the boot file starts (its 5 blocks via the KERNAL, then ~120 blocks fast) |
| mini-game load | 1-3 s for 6-25 blocks, music playing |
| terminal | ~6.5 s to load (60 blocks), the floor reloads in ~1 s after |
| save | ~0.5 s (one block written in place) |
| disk | 210 of 664 blocks free |

## Next steps

- Read GCR in the drive instead of going through the DOS job queue (most of the remaining ~60 ms per block).
- More floors: each floor file is ~1.5 KB packed; the departments' music and mini-games fill the rest of the disk.
