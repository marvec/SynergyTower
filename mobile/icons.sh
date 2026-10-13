#!/bin/sh
# Regenerates the app icons and splash screens from ../public/icon.svg (32x32 pixel art).
# Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick). Run from mobile/: sh icons.sh
set -e
SVG=../public/icon.svg
BG='#1b1e2b'      # the icon's own background (public/icon.svg)
SPLASH='#0d0f18'  # the game's page background (src/style.css)
TMP=$(mktemp -d)
art() { rsvg-convert -w "$1" -h "$1" "$SVG" -o "$2"; }

# iOS: one 1024 icon (no alpha channel, as App Store Connect requires) and the splash.
art 1024 "$TMP/i.png"
magick "$TMP/i.png" -background "$BG" -alpha remove -alpha off ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
art 512 "$TMP/s.png"
for f in ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png; do
  magick -size 2732x2732 "xc:$SPLASH" "$TMP/s.png" -gravity center -composite -alpha off "$f"
done

# Android: legacy square/round launcher icons, adaptive foreground (art in the 66/108 safe zone), splash.
RES=android/app/src/main/res
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  dir=${d%%:*}; n=${d##*:}
  art "$n" "$RES/mipmap-$dir/ic_launcher.png"
  art "$n" "$TMP/r.png"
  magick "$TMP/r.png" -alpha set \( -size "${n}x${n}" xc:none -fill white -draw "circle $((n/2)),$((n/2)) $((n/2)),0" \) -compose DstIn -composite "$RES/mipmap-$dir/ic_launcher_round.png"
  fg=$((n * 108 / 48)); inner=$((fg * 66 / 108))
  art "$inner" "$TMP/f.png"
  magick -size "${fg}x${fg}" xc:none "$TMP/f.png" -gravity center -composite "$RES/mipmap-$dir/ic_launcher_foreground.png"
done
for f in "$RES"/drawable*/splash.png; do
  size=$(magick identify -format '%wx%h' "$f"); w=${size%x*}; h=${size#*x}
  m=$(( (w < h ? w : h) / 4 ))
  art "$m" "$TMP/a.png"
  magick -size "$size" "xc:$SPLASH" "$TMP/a.png" -gravity center -composite -alpha off "$f"
done
rm -rf "$TMP"
echo "Icons and splash screens updated."
