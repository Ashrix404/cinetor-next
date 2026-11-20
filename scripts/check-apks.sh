#!/usr/bin/env bash
# Verifies the APKs of one build: count, badging, TV launcher, correct web bundle per flavor.
set -euo pipefail
DIR="${1:?usage: check-apks.sh <apk dir>}"
AAPT2=$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)aapt2
[ -x "$AAPT2" ] || { echo "aapt2 not found"; exit 1; }
fail=0
printf '%-44s %-26s %-10s %s\n' FILE PACKAGE CODE SIZE
for bt in debug release; do
  mapfile -t apks < <(find "$DIR" -name "*-$bt.apk" -o -name "*-$bt-unsigned.apk" | sort)
  [ ${#apks[@]} -eq 0 ] && continue
  if [ ${#apks[@]} -ne 10 ]; then echo "ERROR: $bt has ${#apks[@]} APKs, expected 10"; fail=1; fi
  for apk in "${apks[@]}"; do
    b=$("$AAPT2" dump badging "$apk")
    pkg=$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$b")
    code=$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$b" | head -1)
    printf '%-44s %-26s %-10s %s\n' "$(basename "$apk")" "$pkg" "$code" "$(stat -c %s "$apk")"
    shell=$(unzip -p "$apk" assets/public/index.html | grep -o 'data-shell="[a-z]*"' | head -1 || true)
    case "$(basename "$apk")" in
      *-tv-*)
        grep -q "leanback-launch" <<<"$b" || { echo "ERROR: $apk has no leanback-launcher"; fail=1; }
        grep -q "uses-feature-not-required: name='android.hardware.touchscreen'" <<<"$b" || { echo "ERROR: $apk touchscreen is required"; fail=1; }
        [ "$shell" = 'data-shell="tv"' ] || { echo "ERROR: $apk has $shell, expected tv"; fail=1; } ;;
      *-phone-*)
        [ "$shell" = 'data-shell="mobile"' ] || { echo "ERROR: $apk has $shell, expected mobile"; fail=1; } ;;
    esac
  done
done
exit $fail
