# PROGRESS (agents update this file every session)

## Status

| Task | State | Branch / PR | CI | Notes |
|---|---|---|---|---|
| SETUP | done 2026-11-20 | main | — | repos created; cinetor-next is PUBLIC (free Actions); cinetor-releases public + Pages on gh-pages; secrets set: TMDB_TOKEN, ANDROID_KEYSTORE_B64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, RELEASE_REPO_TOKEN (fine-grained PAT, push access to cinetor-releases verified) |
| T00 orientation | done 2026-11-20 | PR #1 | — | docs read, dependencies verified, repo secrets checked |
| T01 tooling | done 2026-11-20 | PR #3 | green | tooling, 3 shells, CI, bootstrap |
| T02 android-scaffold | done 2026-11-20 | PR #4 | green | 10 APKs, codes 10-14 |
| T03 keystore | done | — | — | generated locally with openssl (PKCS12), not in CI |
| T04 mock-media | done 2026-11-20 | PR #5 | green | clips + music + 16 VTT on Pages |
| T05 core-base | todo | | | config, platform, store, router |
| T06 tmdb-client | todo | | | TMDB client |
| T07 catalog-feeds | todo | | | Catalog feeds |
| T08 library-store | todo | | | Library, progress, series settings, PIN |
| T09 player-model | todo | | | Player model and subtitles |
| T10 mock-sections | todo | | | Mock section data |
| T11 mobile-frame | todo | | | App frame (mobile) |
| T12 mobile-feed-blocks | todo | | | Feed building blocks (mobile) |
| T13 mobile-sections | todo | | | Sections (mobile) |
| T14 mobile-info | todo | | | Info page (mobile) |
| T15 mobile-portrait-player | todo | | | Portrait player + PiP (mobile) |
| T16 mobile-fullscreen-player | todo | | | Fullscreen player (mobile) |
| T17 mobile-subtitles | todo | | | Subtitles UI (mobile) |
| T18 mobile-downloads | todo | | | Downloads UI (mobile) |
| T19 mobile-settings | todo | | | Settings (mobile) |
| T20 mobile-tv-tab | todo | | | TV tab (mobile) |
| T21 mobile-music | todo | | | Music (mobile) |
| T22 mobile-comics | todo | | | Comics (mobile) |
| T23 desktop-frame | todo | | | Frame (desktop) |
| T24 desktop-pages | todo | | | Pages (desktop) |
| T25 tv-frame | todo | | | Frame (TV) |
| T26 tv-feeds | todo | | | Feeds (TV) |
| T27 tv-info-player | todo | | | Info + Player (TV) |
| T28 tv-other | todo | | | Other (TV) |
| T29 tv-performance | todo | | | Performance (TV) |
| T30 native-plugin | todo | | | CinetorNative plugin (part 1) |
| T31 download-engine | todo | | | Download engine |
| T32 updater | todo | | | Updater |
| T33 native-polish | todo | | | Native polish |
| T34 release-workflow | todo | | | release.yml |
| T35 pwa | todo | | | PWA |
| T36 first-release | todo | | | First release |
| T37 tmdb-proxy | todo | | | (optional) TMDB proxy |

## Open questions

1. **GitHub Secrets Status:** Checked via `gh secret list --repo Ashrix404/cinetor-next`. All 6 requested secrets are present (`TMDB_TOKEN`, `RELEASE_REPO_TOKEN`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). None are missing. Needs confirmation if the TMDB token in GitHub Secrets has already been rotated from the one previously shared in chat.
2. **Keystore file extension & format:** `docs/03-github-setup.md` mentions `cinetor.p12` / `cinetor.p12.b64` (openssl PKCS12), whereas the command block references `cinetor.jks.b64` and `release.yml` references `$RUNNER_TEMP/cinetor.jks` with `storeType "pkcs12"`. Java keystores support PKCS12 content inside `.jks` extension, but naming should be kept consistent to avoid confusion.
3. **(ANSWERED in T02: splits work, 10 APKs)** **Multi-ABI splits without native libraries:** `docs/04-implementation-plan.md` T02 acceptance requires 5 phone APKs + 5 TV APKs (`universal`, `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`). However, `docs/08-updates-and-release.md` line 61 notes that because there are no native `.so` files, AGP might only generate the universal APK. T02 will check if AGP generates ABI splits when no native libs are present.
4. **(ANSWERED in T02: minSdk 24, compile/target 36)** **Android target / compile SDK:** `docs/02-architecture.md` specifies minSdk 26, compile/target SDK 37 for Capacitor 8. Real values must be verified from the generated `android/variables.gradle` during T02.
5. **Background media playback in Android WebView:** `docs/05-player.md` and `docs/07-native-plugin.md` highlight potential pausing of media on `onPause` by WebView. `keepAliveForPlayback` is kept conditional pending empirical tests in T33.

## Verification log

| Date | Thing checked | Command / link | Result |
|---|---|---|---|
| 2026-11-20 | `preact` version | `curl -s https://registry.npmjs.org/preact/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `11.2.0` (matches docs) |
| 2026-11-20 | `vite` version | `curl -s https://registry.npmjs.org/vite/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.3.8` (matches docs) |
| 2026-11-20 | `@preact/preset-vite` version | `curl -s https://registry.npmjs.org/@preact/preset-vite/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `2.10.6` (matches docs) |
| 2026-11-20 | `typescript` version | `curl -s https://registry.npmjs.org/typescript/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `7.0.2` (matches docs) |
| 2026-11-20 | `vitest` version | `curl -s https://registry.npmjs.org/vitest/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `5.1.1` (matches docs) |
| 2026-11-20 | `happy-dom` version | `curl -s https://registry.npmjs.org/happy-dom/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `21.0.4` (matches docs) |
| 2026-11-20 | `@capacitor/core` version | `curl -s https://registry.npmjs.org/@capacitor/core/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.6.2` (matches docs) |
| 2026-11-20 | `@capacitor/cli` version | `curl -s https://registry.npmjs.org/@capacitor/cli/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.6.2` (matches docs) |
| 2026-11-20 | `@capacitor/android` version | `curl -s https://registry.npmjs.org/@capacitor/android/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.6.2` (matches docs) |
| 2026-11-20 | `@capacitor/app` version | `curl -s https://registry.npmjs.org/@capacitor/app/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.1.2` (matches docs) |
| 2026-11-20 | `@capacitor/status-bar` version | `curl -s https://registry.npmjs.org/@capacitor/status-bar/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.0.4` (matches docs) |
| 2026-11-20 | `@capacitor/screen-orientation` version | `curl -s https://registry.npmjs.org/@capacitor/screen-orientation/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.0.2` (matches docs) |
| 2026-11-20 | `@capacitor/share` version | `curl -s https://registry.npmjs.org/@capacitor/share/latest \| python3 -c "import sys,json;print(json.load(sys.stdin)['version'])"` | `8.0.3` (matches docs) |
| 2026-11-20 | `androidx.documentfile:documentfile` | `curl -s https://dl.google.com/android/maven2/androidx/documentfile/documentfile/maven-metadata.xml` | `1.1.0` (matches docs) |
| 2026-11-20 | GitHub Secrets check | `gh secret list --repo Ashrix404/cinetor-next` | 6 secrets set: `TMDB_TOKEN`, `RELEASE_REPO_TOKEN`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. None missing. |

## Task notes

<!-- For each task: plan (files, signatures, prototype functions quoted), decisions, real CI results, acceptance ticks. -->

### T01 tooling — done 2026-11-20 (Claude Code)
- Files as planned + `scripts/assemble-site.mjs` (assembles `dist/site/` from `dist/mobile` → `m/`, `dist/desktop` → `d/`, `web/*`, writes `version.json`, replaces `__VERSION__` in `sw.js`). Not in the T01 file list; needed for `build:web`.
- `bootstrap.yml` fix: the doc's `git add -A package-lock.json android` fails as a whole when `android/` does not exist, so nothing gets committed; now adds each path only if it exists. It was merged to `main` first (PR #2) because `workflow_dispatch` needs the workflow on the default branch.
- Acceptance: [x] bootstrap `task=lock` committed `package-lock.json` (run 44711643282). [x] CI green: typecheck, example test, 3 builds, size (tv 0.1 KB, mobile 4.8 KB, desktop 4.8 KB gz). [x] artifact `site` has `index.html`, `m/`, `d/`, `version.json`. Preview `preview/task/T01-tooling/m/` → 200.

### T02 android-scaffold — done 2026-11-20 (Claude Code)
- Generated by `bootstrap.yml task=android` (run 44712053785). Real template values (`android/variables.gradle`): **minSdk 24, compileSdk 36, targetSdk 36** (docs said 26/37; kept the generated values). AGP 8.13.0, Gradle 8.14.3. Generated `file_paths.xml` has `<external-path name="my_images" path="." />` and `<cache-path name="my_cache_images" path="." />` (covers `cache/updates/`).
- ABI splits DO produce per-ABI APKs without native libs (open question 3 answered): 5 phone + 5 TV APKs, versionCodes 10 (universal), 11, 12, 13, 14.
- `aapt2 dump badging` prints `leanback-launchable-activity`, so `check-apks.sh` greps `leanback-launch`.
- `android-assets.sh` also copies `capacitor.config.json`/`capacitor.plugins.json` into the tv flavor assets.
- Added `android:hardwareAccelerated="true"` to the main manifest (perf rule 15).
- Acceptance: [x] 5 phone + 5 TV APKs (run 44712267459). [x] TV badging has leanback launcher + touchscreen not required. [x] `data-shell` tv/mobile checked per APK.

### T04 mock-media — done 2026-11-20 (Claude Code)
- `mock-media.yml` runs on push to `main` (paths `media/**`) and on dispatch; run after merge of PR #5 published to `gh-pages/media/`.
- VTT files: 15 cues each over 120 s with the prototype `LANGS` sample line (header line `Language: <code>`).
- Acceptance: [x] `curl -sI …/media/clip-720p.mp4` → `HTTP/2 200`, `accept-ranges: bytes`, `access-control-allow-origin: *`, 16,997,210 bytes. [x] `media/index.json` lists 24 files with bytes + sha256.

### T05 core-base — 2026-11-20 (Claude Code)
- `config.ts` (env constants), `platform.ts` (`isNative` via `globalThis.Capacitor` so the TV bundle does not import `@capacitor/core`), `store.ts`, `router.ts` (+ `createExitGuard` for "Press back again to exit").

## Releases

| Version | Date | Notes |
|---|---|---|
