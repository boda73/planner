#!/usr/bin/env bash
# Side-by-side "render | real photo" sheets for the reference photos, small enough to read cheaply.
#
#   tools/compare.sh <outdir> [IMG_4010 IMG_4017 ...]      # default: all photos in assets/photos
#   PAGE=index.html EXTRA="&ui=0" tools/compare.sh /tmp/cmp IMG_4010     # render through the app instead of the harness
#
# Output: <outdir>/<id>.jpg  (landscape photos 1280×480, portrait 960×640).
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:?usage: compare.sh <outdir> [photo ids...]}"; shift || true
page="${PAGE:-dev/view.html}"; extra="${EXTRA:-}"
ids=("$@"); [ ${#ids[@]} -eq 0 ] && ids=($(ls assets/photos | sed 's/\.jpg$//'))
mkdir -p "$out/_r"
land=(); port=()
for id in "${ids[@]}"; do
  read -r w h < <(identify -format '%w %h\n' "assets/photos/$id.jpg")
  if [ "$w" -ge "$h" ]; then land+=("$page?photo=$id$extra" "$out/_r/$id.jpg"); else port+=("$page?photo=$id$extra" "$out/_r/$id.jpg"); fi
done
[ ${#land[@]} -gt 0 ] && node tools/shot.cjs --size 640x480 "${land[@]}"
[ ${#port[@]} -gt 0 ] && node tools/shot.cjs --size 480x640 "${port[@]}"
for id in "${ids[@]}"; do
  read -r w h < <(identify -format '%w %h\n' "$out/_r/$id.jpg")
  convert "$out/_r/$id.jpg" \( "assets/photos/$id.jpg" -resize "${w}x${h}!" \) +append -quality 80 "$out/$id.jpg"
done
echo "sheets in $out"
