#!/usr/bin/env bash
# Builds the mock media (docs/06-media-and-downloads.md §Mock media). CI only.
set -euo pipefail
OUT=media/out; mkdir -p "$OUT/subtitles" "$OUT/music"
mk() { # $1=height $2=crf
  ffmpeg -y -loglevel error -f lavfi -i "testsrc2=size=$(( $1*16/9 ))x$1:rate=30" \
         -f lavfi -i "sine=frequency=440:sample_rate=48000" \
         -t 120 -c:v libx264 -preset veryfast -crf "$2" -pix_fmt yuv420p \
         -c:a aac -b:a 96k -movflags +faststart "$OUT/clip-$1p.mp4"
}
mk 1080 30; mk 720 30; mk 480 32
i=0; for f in 262 294 330 349 392; do i=$((i+1))
  ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=$f:duration=60" -c:a libmp3lame -b:a 128k "$OUT/music/track-$i.mp3"
done
cp media/subtitles/*.vtt "$OUT/subtitles/"
python3 media/make-index.py "$OUT" > "$OUT/index.json"
ls -la "$OUT" "$OUT/music" | head -20
