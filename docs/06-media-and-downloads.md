# 06 — Mock media and downloads

## Mock media (built in CI by `mock-media.yml`, hosted on the release repo's GitHub Pages)

Base URL (constant `MEDIA_BASE` in `src/core/config.ts`): `https://ashrix404.github.io/cinetor-releases/media/`

`media/build-media.sh` (runs on `ubuntu-latest` after `sudo apt-get update && sudo apt-get install -y ffmpeg`):

```bash
#!/usr/bin/env bash
set -euo pipefail
OUT=media/out; mkdir -p "$OUT/subtitles" "$OUT/music"
mk() { # $1=height $2=crf
  ffmpeg -y -f lavfi -i "testsrc2=size=$(( $1*16/9 ))x$1:rate=30" \
         -f lavfi -i "sine=frequency=440:sample_rate=48000" \
         -t 120 -c:v libx264 -preset veryfast -crf "$2" -pix_fmt yuv420p \
         -c:a aac -b:a 96k -movflags +faststart "$OUT/clip-$1p.mp4"
}
mk 1080 30; mk 720 30; mk 480 32
i=0; for f in 262 294 330 349 392; do i=$((i+1))
  ffmpeg -y -f lavfi -i "sine=frequency=$f:duration=60" -c:a libmp3lame -b:a 128k "$OUT/music/track-$i.mp3"
done
cp media/subtitles/*.vtt "$OUT/subtitles/"
python3 media/make-index.py "$OUT" > "$OUT/index.json"   # name, path, bytes, sha256 for every file
```

`media/make-index.py` walks the folder and prints JSON: `{"files":[{"path":"clip-720p.mp4","bytes":123,"sha256":"…"}]}`.

Publishing step in `mock-media.yml` (verified action `peaceiris/actions-gh-pages@v4`):

```yaml
- uses: peaceiris/actions-gh-pages@v4
  with:
    personal_token: ${{ secrets.RELEASE_REPO_TOKEN }}
    external_repository: Ashrix404/cinetor-releases
    publish_branch: gh-pages
    publish_dir: media/out
    destination_dir: media
    keep_files: true
```

Usage in the app:
- Every movie and episode plays `clip-<quality>p.mp4`. Live TV channels and sports play `clip-720p.mp4` with a LIVE badge (seek bar hidden).
- Music tracks play `music/track-N.mp3`.
- Downloads fetch these same files, so the download engine moves real bytes over real HTTP Range requests.

## Download engine

Shared interface: `DownloadEngine` in `docs/02-architecture.md`. The UI never talks to a platform directly; it uses `getEngine()` from `src/core/downloads/index.ts`, which returns the native engine in the APK and the web engine in browsers. TV has no downloads.

### File naming (`src/core/downloads/naming.ts`, unit tested)

| Kind | Folder | Name |
|---|---|---|
| video | `<root>/` | `<Title.With.Dots>.S<s>E<e>.<q>p.mp4` (movies: `<Title>.<q>p.mp4`) |
| comic | `<root>/Comics/` | `<Title> - Chapter <n>.pdf` |
| music | `<root>/Music/` | `<Track name>.mp3` |

Strip characters other than letters, digits, space, `-`, `.`, `_`. Default root: `Download/Cinetor`.

Comic PDFs are made by `makePdf(title, pages)` (port of the prototype function, unit tested: output starts with `%PDF-1.4` and ends with `%%EOF`). The engine saves the bytes; nothing is fetched for comics.

### Native engine (APK) — inside `CinetorNative` (see `docs/07-native-plugin.md`)

1. HEAD the URL (or `GET` with `Range: bytes=0-0`) to read the length and `Accept-Ranges`.
2. If ranges are supported, split into `min(connections, ceil(length / 256 KiB))` segments. If not, use one connection.
3. Each segment is a thread with `HttpURLConnection` and `Range: bytes=a-b`. It writes with `RandomAccessFile.seek` into a temp file in `getExternalFilesDir("partial")`.
4. Save state (segment offsets, status) to `files/downloads.json` every second and on pause.
5. Pause interrupts the threads and keeps the offsets. Resume restarts from the offsets. After an app restart, running items load as paused.
6. When done: verify the length, then move to the destination:
   - default (API 29+): MediaStore `Downloads` with `RELATIVE_PATH = "Download/Cinetor[/Comics|/Music]"`.
   - API 26–28: the public `Downloads/Cinetor/...` directory, which needs `WRITE_EXTERNAL_STORAGE` with `maxSdkVersion="28"`.
   - a user-picked folder: SAF tree URI (`ACTION_OPEN_DOCUMENT_TREE`, persisted permission) with `DocumentFile`. Subfolders `Comics`/`Music` are created when missing.
7. A foreground service (`foregroundServiceType="dataSync"`) runs while any download is active. Its notification shows the total % and has Pause all and Resume all actions. Ask for `POST_NOTIFICATIONS` on API 33+.
8. Events go to JS with `notifyListeners("downloadProgress", {id, bytesDone, bytesTotal, bytesPerSec, status})` at most every 500 ms.

### Web engine (browsers)

- Use parallel `fetch` with `Range` headers and an `AbortController` per segment. Browsers allow about 6 connections per host, so the 16/32/64 setting only works fully in the APK. The web Downloads page must say this in the connections card's description.
- Store finished chunks in OPFS (`navigator.storage.getDirectory()`) when available, otherwise in memory. Without OPFS, a reload loses partial data, and the item comes back as "Paused · restart needed".
- Saving:
  - Desktop Chrome/Edge: File System Access `showDirectoryPicker()` (Change folder). Write into the chosen folder plus `Comics/`/`Music/`.
  - Android Chrome: `a[download]` → the phone's Downloads folder.
  - iOS Safari: `a[download]` opens the download prompt (it saves to the Files app); in standalone PWA mode, first try `navigator.share({files:[file]})` (where `canShare` allows it), else open the blob URL.
- The Downloads page still shows the logical path (`Download/Cinetor/...`). Under it, show where the browser really saved the file.

### External downloader (Preferences → "External downloader")

When it is on, the Download button skips the engine and hands the URL to another app:

| Platform | How |
|---|---|
| APK | `CinetorNative.openExternal({url, mime:'video/mp4', title})` → `Intent.ACTION_VIEW` + `Intent.createChooser` (ADM, 1DM, VLC and others appear) |
| Android Chrome | navigate to `intent://<host><path>#Intent;scheme=https;type=video/mp4;action=android.intent.action.VIEW;S.title=<title>;end` |
| iOS Safari | `navigator.share({url, title})`; fallback `window.open(url)` |
| Desktop | `a[download]` |

### UI rules (from the prototype)

- Download sheet: Season 1 pre-selected, other seasons start empty, and each season remembers its own selection. Quality and dub are remembered in memory until the app is closed (a cold start resets them to 1080p and Original).
- Starting a download shows the popup "Download started · N items · <q>p" with [View] for 4.5 s. Tapping it opens Downloads.
- The Downloads page has: the Save location card, the Parallel connections chips (16/32/64, persisted), the Downloading list (%, MB/s, pause/resume, cancel), Pause all / Resume all, the Downloaded list with paths, and a "Saved · <path>" toast on completion.
