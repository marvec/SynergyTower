# C64 port: feature freeze

The C64 version is **feature-frozen** as of 2026-10-12 (commit `fa92f98`, "C64 port round 4: the whole tower on five disks").

- Do **not** port new browser-game features, mini-games, content, economy changes or balance tweaks to `c64/`
  automatically, even when they land in the shared `src/` modules that `c64/build.js` converts at build time.
- Port something to the C64 only when Martin explicitly asks for that change on the C64.
- Still allowed without asking: bug fixes in the C64 code itself, and keeping the build working when a shared module it
  reads changes shape. Such a fix should keep the C64's frozen behaviour, not pick up the new feature.
- If a browser change would alter the C64 build output (for example via data read from `src/core` or `src/data`), pin the
  frozen value in `c64/` rather than following the browser version, and mention it to Martin.
