# SynergyTower

A pixel-art, 2.5D browser game about climbing the corporate ladder. You start as a new hire at the bottom of a
40-floor tower, walk each floor, do office chores as mini-games, earn currencies and get promoted floor by floor
until you become CEO.

- 30+ mini-games (spreadsheets, inbox triage, reply-all storms, expense reports, karaoke at the office party...)
- An HR performance review gates every promotion
- Collect paperclips, chat with colleagues, poke around the workstation terminals (some commands are more useful than
  others), and once you are CEO, decide who stays
- All art is drawn in code and all music and sound is synthesized with WebAudio: no external assets
- Works offline (service worker)

## Running it

Requires [Bun](https://bun.sh) 1.3. There are no npm dependencies.

```bash
bun run dev      # dev server with hot reload → http://localhost:5317
bun run build    # static offline-capable build → dist/
bun run preview  # serve dist/ → http://localhost:4317
bun test         # unit + headless smoke tests
```

## Tech

Vanilla ES modules and Canvas 2D at a fixed 480×270 logical resolution, integer-scaled. Core game logic in
`src/core/` is pure (no DOM) so it can be ported later. See `CLAUDE.md` for the architecture and
`docs/superpowers/specs/` for the design spec.

Payments in the game are fake and labelled DEMO.
