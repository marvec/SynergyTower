# SynergyTower

A pixel-art, 2.5D browser game about climbing the corporate ladder. You start as a new hire at the bottom of a
40-floor tower, walk each floor, do office chores as mini-games, earn currencies and get promoted floor by floor
until you become CEO.

- 33 mini-games (spreadsheets, inbox triage, reply-all storms, expense reports, karaoke at the office party...), some of them
  played across the whole floor (track down a colleague for their 360 review, hunt the whiteboards for your lost password)
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

## Privacy

The game is played at [synergytower.co.uk](https://synergytower.co.uk/). It sets no cookies and has no accounts.

- **Your save** stays in your browser (`localStorage`). It is never uploaded.
- **Analytics** use two cookieless services: [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
  counts page visits, and [Umami](https://umami.is/) counts visits plus a few anonymous gameplay events (career
  started, mini-game played with its stars, HR review passed or failed, promotion with the floor number, poster opened,
  feedback form opened or sent, coffee link clicked, reminders switched on or shown). Neither stores anything in your browser or builds a profile of
  you; visitors are counted from a hash of the IP address and browser that changes daily. Analytics only run on
  synergytower.co.uk (never on localhost or in a self-hosted copy), and blocking them does not affect the game.
- **The feedback form** sends your message, the topic, your email if you enter one, and a short note on where you are in
  the game (floor, level, and your in-game player and company names) to the author by email (via [Resend](https://resend.com/)). It is protected by Google
  reCAPTCHA v3, which loads only when you open the form and is subject to Google's
  [Privacy Policy](https://policies.google.com/privacy) and [Terms](https://policies.google.com/terms).
- **Reminders** are off unless you switch them on (Menu, or when you first run out of coffee). They are ordinary
  browser notifications scheduled inside the open game tab: no push server, nothing leaves your device. At most 3 a
  day, never between 22:00 and 08:00, and only for waits of 5 minutes or more (coffee pot full, HR review retry ready).
- **External links** (Buy Me a Coffee) open in a new tab and are only followed when you click them.

## License

Copyright © 2026 Martin Večeřa.

SynergyTower is free software: you can redistribute it and/or modify it under the terms of the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; see [LICENSE](LICENSE) for
the full text.
