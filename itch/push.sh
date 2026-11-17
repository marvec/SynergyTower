#!/usr/bin/env bash
# Uploads the C64 version (public/c64/synergy-tower-c64.zip) to the itch.io page with butler, itch's upload tool.
# The browser game itself is not uploaded: the page links to https://synergytower.co.uk/.
#
# Once:   install butler (https://itch.io/docs/butler/installing.html) and run `butler login`.
# Then:   itch/push.sh            (after `bun c64/build.js --publish` has refreshed the ZIP)
# Target: ITCH_GAME=<itch-user>/<project-url-slug> itch/push.sh   (default below)
set -euo pipefail
cd "$(dirname "$0")/.."

GAME="${ITCH_GAME:-marvec82/synergy-tower}"
ZIP=public/c64/synergy-tower-c64.zip
CHANNEL=c64 # not windows/linux/mac/android, so itch does not tag it with a PC platform

command -v butler >/dev/null || { echo "butler is not installed: https://itch.io/docs/butler/installing.html" >&2; exit 1; }
[ -f "$ZIP" ] || { echo "$ZIP is missing: run bun c64/build.js --publish" >&2; exit 1; }

# The version shown on itch: the date and the commit of the last change to the ZIP.
VERSION="$(git log -1 --format='%cs-%h' -- "$ZIP")"
butler push "$ZIP" "$GAME:$CHANNEL" --userversion "$VERSION"
butler status "$GAME"
