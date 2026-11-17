# itch.io page kit

The page: https://marvec82.itch.io/synergy-tower

Everything needed for SynergyTower's itch.io page. The page links out to https://synergytower.co.uk/ to play, and
hosts the Commodore 64 version as its download. Without a file, itch may leave a link-only page out of browse and
search (quality guidelines: "Please try not to ... put a link to your Steam store page without uploading any files").

| File | What it is |
|---|---|
| `assets/cover.png` | Cover image, 630×500 (itch's recommended size) |
| `assets/banner.png` | Banner for the top of the page, 960×240 |
| `description.html` | The description: open it in a browser and copy it into the editor |
| `push.sh` | Uploads the C64 ZIP with butler |
| `art.js`, `art-page.js`, `build-art.js` | Draw the cover and the banner with the title screen's code |

Re-make the art after the title changes (e.g. the game count): run `bun itch/build-art.js`, open
http://localhost:5318/ in any browser, and the server writes both PNGs to `assets/` and stops.

## 1. Create the project

Dashboard → **Create new project**. Fill in:

| Field | Value |
|---|---|
| Title | SynergyTower |
| Project URL | `synergy-tower` (use the same slug as `ITCH_GAME` in `push.sh`) |
| Short description or tagline | Climb 40 floors of corporate absurdity in 48 office mini-games. Free in your browser. |
| Classification | Games |
| Kind of project | Downloadable (the C64 ZIP; the browser game is a link) |
| Release status | Released |
| Pricing | **$0 or donate**, suggested donation $2 |
| Uploads | Leave empty here, `push.sh` adds the ZIP (or upload `public/c64/synergy-tower-c64.zip` by hand) |
| Description | Paste from `description.html` |
| Genre | Simulation |
| Tags | `pixel-art`, `comedy`, `satire`, `minigames`, `office`, `retro`, `casual`, `commodore-64`, `2d`, `singleplayer` |
| AI generation disclosure | **Yes**: code, graphics, text and audio (Claude wrote the whole game, including the C64 port; itch then tags the page "AI Generated") |
| App store links | None yet (the iOS and Android apps are "coming soon") |
| Custom noun | Leave empty |
| Community | Comments |
| Visibility | **Draft** first; check the page, then switch to Public |

Under **Cover image**, upload `assets/cover.png`. Under **Screenshots**, upload these from
`public/how-to-play/img/` (960×540 each), in this order:

1. `floor.png`: a floor of the tower
2. `mg-bingo.png`: Meeting Buzzword Bingo
3. `mg-pitch.png`: Elevator Pitch
4. `trip-drive.png`: the business trip drive
5. `mg-fridge.png`: Fridge Tetris
6. `night-shift.png`: the night shift
7. `vacation-hotel.png`: the holiday resort
8. `roof.png`: the roof at dusk
9. `home.png`: the home office

Under **Download/donation**: write "Commodore 64 disk images (8 × D64, VICE or a real C64)" as the upload's display
name after the first push.

## 2. Theme the page

Edit project → **Edit theme** (on the page itself):

| Setting | Value |
|---|---|
| Banner | `assets/banner.png` (hide the title text: the banner has the logo) |
| Background | `#1b2147` |
| Inner background | `#262c5a` |
| Text | `#e8dff8` |
| Link | `#f2c14e` |
| Button | `#2f8a3b` |
| Font | Any of the pixel-free defaults; the banner and the screenshots carry the pixel look |

## 3. Upload the C64 version

Once: install butler (https://itch.io/docs/butler/installing.html) and run `butler login`. Then:

```bash
itch/push.sh                                   # pushes public/c64/synergy-tower-c64.zip to marvec82/synergy-tower:c64
ITCH_GAME=<user>/<slug> itch/push.sh           # if the itch username or slug differs
```

Every push makes a new build; the version shown is the date and commit of the ZIP's last change. Run it again after
`bun c64/build.js --publish`.

## 4. Links to the page

The page URL is in `public/llms.txt` (Links), the footer of `public/how-to-play/index.html`, and the JSON-LD `sameAs`
and the crawler text of `src/index.html`. Keep them in step if the URL changes.
