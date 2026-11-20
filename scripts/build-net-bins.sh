#!/usr/bin/env bash
# Builds the two network helper executables for every ABI (CI only, AGENTS rule 1):
#   libciadpi.so = ByeDPI v0.17.3 (hufrea/byedpi, MIT) — "AntiDPI mode" local SOCKS5 proxy
#   libusque.so  = usque v4.2.1 (Diniboy1123/usque, MIT) — "WARP mode" local HTTP proxy (MASQUE)
# They are Android PIE executables packaged as .so so Android extracts them to nativeLibraryDir.
set -euo pipefail
NDK_VER=27.1.12297006
BYEDPI_REV=7efde1b1296eaaa187b70e951894dde17527489c   # v0.17.3
USQUE_REV=6aa03fc97d12848dce34eedbd187fb1077b5d1ea    # v4.2.1
OUT="$PWD/android/app/src/main/jniLibs"
WORK="${RUNNER_TEMP:-/tmp}/netbins"
NDK="$ANDROID_HOME/ndk/$NDK_VER"
if [ ! -d "$NDK" ]; then
  set +o pipefail
  yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "ndk;$NDK_VER" >/dev/null
  set -o pipefail
fi
[ -d "$NDK" ] || { echo "NDK $NDK_VER not installed"; exit 1; }
TC="$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin"
mkdir -p "$WORK"
fetch() { # repo rev dir
  if [ ! -d "$3/.git" ]; then git clone -q "https://github.com/$1.git" "$3"; fi
  git -C "$3" checkout -q "$2"
  [ "$(git -C "$3" rev-parse HEAD)" = "$2" ] || { echo "wrong revision for $1"; exit 1; }
}
fetch hufrea/byedpi "$BYEDPI_REV" "$WORK/byedpi"
fetch Diniboy1123/usque "$USQUE_REV" "$WORK/usque"

declare -A TRIPLE=([arm64-v8a]=aarch64-linux-android24 [armeabi-v7a]=armv7a-linux-androideabi24 [x86]=i686-linux-android24 [x86_64]=x86_64-linux-android24)
declare -A GOARCH=([arm64-v8a]=arm64 [armeabi-v7a]=arm [x86]=386 [x86_64]=amd64)
for abi in arm64-v8a armeabi-v7a x86 x86_64; do
  mkdir -p "$OUT/$abi"
  t=${TRIPLE[$abi]}
  ( cd "$WORK/byedpi" && "$TC/clang" --target="$t" -D_DEFAULT_SOURCE -I. -std=c99 -O2 -fPIE -pie -Wno-unused -Wno-unused-parameter \
      -Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384 -Wl,-z,relro -Wl,-z,now \
      -o "$OUT/$abi/libciadpi.so" packets.c main.c conev.c proxy.c desync.c mpool.c extend.c )
  "$TC/llvm-strip" --strip-all "$OUT/$abi/libciadpi.so"
  ( cd "$WORK/usque" && GOOS=android GOARCH=${GOARCH[$abi]} GOARM=7 CGO_ENABLED=1 CC="$TC/$t-clang" \
      go build -trimpath -ldflags '-s -w -extldflags=-Wl,-z,max-page-size=16384' -o "$OUT/$abi/libusque.so" . )
  echo "$abi: $(stat -c %s "$OUT/$abi/libciadpi.so") B byedpi, $(stat -c %s "$OUT/$abi/libusque.so") B usque"
done
