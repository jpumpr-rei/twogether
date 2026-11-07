#!/bin/bash
# Generates the iOS launch ("splash") images in public/splash/ — a solid brand-orange
# screen with the app name — at the exact pixel size of each iPhone screen. Without
# these, iOS shows a plain black screen while a home-screen web app starts up.
#
# Needs macOS (uses the built-in `sips` to render SVG to PNG). Re-run after changing
# the color or text below, and keep the list in sync with `startupImage` in
# src/app/layout.tsx. iOS only picks up new splash images when the app is removed and
# re-added to the home screen.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=public/splash
COLOR="#f97316"
TEXT="twogether"
mkdir -p "$OUT"
rm -f "$OUT"/splash-*.png

# width x height in physical pixels, then CSS width / height / pixel ratio
while read -r W H CSSW CSSH RATIO; do
  FONT=$((W * 12 / 100))
  BASE=$((H / 2 + FONT * 35 / 100))
  SPACING=$((FONT / 60 > 1 ? FONT / 60 : 1))
  SVG="$(mktemp -t splash).svg"
  cat > "$SVG" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="$W" height="$H" viewBox="0 0 $W $H">
  <rect width="$W" height="$H" fill="$COLOR"/>
  <text x="$((W / 2))" y="$BASE" fill="#ffffff" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="$FONT" font-weight="500" letter-spacing="$SPACING" text-anchor="middle">$TEXT</text>
</svg>
EOF
  sips -s format png "$SVG" --out "$OUT/splash-${W}x${H}.png" > /dev/null
  rm -f "$SVG"
  echo "splash-${W}x${H}.png  (${CSSW}x${CSSH} @${RATIO}x)"
done <<'SIZES'
1320 2868 440 956 3
1260 2736 420 912 3
1206 2622 402 874 3
1290 2796 430 932 3
1179 2556 393 852 3
1284 2778 428 926 3
1170 2532 390 844 3
1125 2436 375 812 3
1242 2688 414 896 3
828 1792 414 896 2
1242 2208 414 736 3
750 1334 375 667 2
SIZES

# sips writes poorly compressed PNGs; shrink them (needs Node).
node scripts/shrink-png.mjs "$OUT"/splash-*.png
