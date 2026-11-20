#!/usr/bin/env bash
# Per-flavor web assets: phone gets dist/mobile, tv gets dist/tv (docs/08-updates-and-release.md §Flavors).
set -euo pipefail
A=android/app/src
rm -rf "$A/phone/assets/public" "$A/tv/assets/public"
mkdir -p "$A/phone/assets" "$A/tv/assets"
mv "$A/main/assets/public" "$A/phone/assets/public"   # mobile bundle
cp -r dist/tv "$A/tv/assets/public"                   # tv bundle
# cap sync writes capacitor.config.json / capacitor.plugins.json next to public; both flavors need them
for f in capacitor.config.json capacitor.plugins.json; do
  [ -f "$A/main/assets/$f" ] && cp "$A/main/assets/$f" "$A/tv/assets/$f" || true
done
