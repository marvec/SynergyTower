# SynergyTower for the Commodore 64 (proof of concept)

Floor 1 of the real game on a `.d64`. The layout comes from the JS floor generator, and the playfield scrolls
smoothly under a fixed HUD while colleagues wander. Four of the floor's eight stations are playable: Name Badge
Memory, Jargon Decoder, Meeting Buzzword Bingo and Boss Alert, each loaded from disk when you start it. A
custom fast loader keeps the SID playing during loads.

```bash
brew install cc65 vice
bun c64/build.js --run                 # build c64/build/synergy.d64 and start VICE
bun c64/build.js --autoplay=stealth --shots=30,45   # test disk: walks to that station and plays it perfectly
```

Controls: joystick in port 2, or WASD / cursor keys + SPACE or RETURN. Jargon Decoder also takes keys 1-3.

## What the build does

`build.js` (Bun) imports the game's own modules and converts them:

| From the JS game | To |
|---|---|
| `buildFloor(1)`: tiles, rooms, furniture, stations, NPCs, posters | char map + colour map + walk/interact grid + header (`tools/floor.js`) |
| furniture drawn as fat-pixel rectangles (`tools/art.js`) | multicolour chars, composited onto the floor under them, deduplicated |
| the bitmap font (`src/engine/font.js`) | chars 32-126 of the charset (ASCII = screen code) |
| tracker songs (`src/data/music.js`, `compileSong`) | 3-voice SID streams: lead, bass, drums + effects (`tools/music.js`) |
| economy (`taskReward`, `taskCoffeeCost`, `starQuota`, ...) | constants in `gen/floor.inc` |
| mini-game content (`src/data/mg-jargon.js`, `mg-bingo.js`) | string tables, wrapped to the C64's 40 columns (`tools/mgdata.js`) |

It then assembles everything with ca65/ld65 and packs the data files with its own LZ packer (`tools/lz.js`). It
also writes the disk image itself (`tools/d64.js`), so it controls sector placement and knows where every file
starts.

## Disk and boot

| File | Loaded by | Contents |
|---|---|---|
| `synergy` | KERNAL (`LOAD"*",8,1`), 5 blocks | boot: uploads the drive code, fast-loads `main` |
| `main` | fast loader | the resident program, LZ-packed, unpacked to `$0801` |
| `floor01` | fast loader | floor 1 |
| `mg.memory`, `mg.jargon`, `mg.bingo`, `mg.stealth` | fast loader | mini-game overlays for `$4000` |

The boot file runs its copy of the loader from `$c400`, then unpacks `main` over itself.

## Memory map ($01 = $36: BASIC ROM out, KERNAL + I/O in)

| Address | Contents |
|---|---|
| `$0002-$003f`, `$0080-$008f` | zero page (`$02-$13` shared with overlays, see `src/api.inc`; resident part in `src/zp.inc`) |
| `$0801-$3fff` | resident: engine, API jump table at `$0810`, charset/sprites/music data (~9 KB) |
| `$4000-$5fff` | mini-game overlay slot (`mg.*` files) |
| `$6000-$7fff` | load buffer for packed files |
| `$8000-$8fff` | current floor (`floor01`, unpacked) |
| `$c000` / `$c400` | the two screens (VIC bank 3); the playfield alternates between them, mini-games use `$c000` |
| `$c800` | charset |
| `$e000` | sprites, in RAM under the KERNAL: 12 person frames, plus the boss frames Boss Alert copies to `$e300` |

## Tricks in use

- **Fast loader with a 2-bit transfer** (`src/drive.s`, `src/loader.s`):
  - The drive code is uploaded with `M-W`. Files are fetched by the track and sector known at build time, so
    there is no directory search.
  - The C64 toggles ATN and the drive puts two bits on CLK and DATA, answering within 13 µs. The C64 sets the
    pace of every step, so raster IRQs and bad lines can't break a transfer, and the music keeps playing (the
    KERNAL's `ACPTR` waits with interrupts off).
  - The drive sets the ATN-acknowledge bit with every value, so the 1541's hardware auto-acknowledge never
    pulls DATA by itself.
  - Fast-loaded files use a sector interleave of 13, measured so the drive is ready just as the next sector
    arrives.
- **Smooth vertical scrolling under a fixed HUD**:
  - A second raster IRQ, just below the HUD, sets YSCROLL. This delays the playfield's first bad line by 0-7
    lines, so the map moves by single pixels and the gap stays black (the VIC's idle byte `$ffff` is 0).
    YSCROLL = 2 would start a bad line on the HUD's last line, so that case goes 1, then 2 one line later.
  - When the camera crosses a char row, the new rows' chars are drawn into the hidden screen by an unrolled,
    self-modified loop. Next frame the screens swap, and the colour RAM is copied in 4-row groups right after
    the beam leaves the playfield, staying ahead of it all the way down.
  - Worst frame measured in VICE: done by raster line 217 of the 250 available.
- **Load timing from the CIA time-of-day clock**, which runs on mains ticks and stays right while interrupts
  are off.
- **Overlays with a fixed ABI**:
  - A jump table in the resident part (`API_*`: print, centred print, box, timer bar, random, ...) and a
    3-entry header at `$4000`, so each mini-game links on its own.
  - `src/mgkit.s` is the overlays' shared kit, like `src/engine/mgkit.js`.
  - An overlay that is still in memory is not loaded again.
- **Multicolour and hires chars on one screen**: colour RAM bit 3 picks the mode per cell, so text and icons stay
  sharp next to multicolour furniture.
- **Oblique walls**: a wall's cap is drawn into the floor cell above it, as in the browser version.
- **Expanded multicolour sprites** for Boss Alert's walkers. The boss's dark suit is the shared outline colour
  and his tie is the sprite's own colour.

## Measured in VICE (true drive emulation)

| | |
|---|---|
| boot file | 1.1 KB, 5 blocks: the only KERNAL load |
| boot to floor 1 | ~7 s after the boot file starts: drive code upload + `main` (26 blocks) + `floor01` |
| main program | 9.2 KB, 6.2 KB packed |
| overlays (packed) | Memory 1.5 KB, Jargon 2.8 KB (16 of the 60 buzzwords), Bingo 1.9 KB, Boss Alert 1.8 KB |
| overlay load | 0.9-1.5 s for 6-8 blocks, music playing: a block takes ~50 ms to send and ~60 ms of DOS work. The same 7 blocks took 1.3-1.5 s with the first 1-bit loader and ~5 s with the KERNAL (music frozen) |
| disk | ~600 of 664 blocks free |

## Next steps

- Read GCR in the drive instead of going through the DOS job queue (most of the remaining ~60 ms per block).
- A sprite multiplexer for busier floors, the HR review, the elevator and all 40 floors (~1.3 KB each).
- The other floor-1 games (Write the Email, Lost Password, Tailgate, Defender) and saving to disk.
