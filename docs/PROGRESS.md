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
| T05 core-base | done 2026-11-20 | PR #6 | green | unit tested |
| T06 tmdb-client | done 2026-11-20 | PR #7 | green | unit tested |
| T07 catalog-feeds | done 2026-11-20 | PR #8 | green | unit tested |
| T08 library-store | done 2026-11-20 | PR #9 | green | unit tested |
| T09 player-model | done 2026-11-20 | PR #10 | green | unit tested |
| T10 mock-sections | done 2026-11-20 | PR #11 | green | counts = prototype |
| T11 mobile-frame | done 2026-11-20 | PR #12 | green | frame, splash, nav, drawer, feeds, carousel |
| T12 mobile-feed-blocks | done 2026-11-20 | PR #12 | green | frame, splash, nav, drawer, feeds, carousel |
| T13 mobile-sections | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T14 mobile-info | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T15 mobile-portrait-player | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T16 mobile-fullscreen-player | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T17 mobile-subtitles | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T18 mobile-downloads | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T19 mobile-settings | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T20 mobile-tv-tab | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T21 mobile-music | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T22 mobile-comics | done 2026-11-20 | PR #13 | green | mobile screens, smoke-tested |
| T23 desktop-frame | done 2026-11-20 | PR #14 | green | desktop shell |
| T24 desktop-pages | done 2026-11-20 | PR #14 | green | desktop shell |
| T25 tv-frame | done 2026-11-20 | PR #15 | green | TV shell, 28 KB JS |
| T26 tv-feeds | done 2026-11-20 | PR #15 | green | TV shell, 28 KB JS |
| T27 tv-info-player | done 2026-11-20 | PR #15 | green | TV shell, 28 KB JS |
| T28 tv-other | done 2026-11-20 | PR #15 | green | TV shell, 28 KB JS |
| T29 tv-performance | done 2026-11-20 | PR #15 | green | TV shell, 28 KB JS |
| T30 native-plugin | done 2026-11-20 | PR #16, #17 | green | Java plugin compiles; device test pending |
| T31 download-engine | done 2026-11-20 | PR #16, #17 | green | Java plugin compiles; device test pending |
| T32 updater | done 2026-11-20 | PR #16, #17 | green | Java plugin compiles; device test pending |
| T33 native-polish | done 2026-11-20 | PR #16, #17 | green | Java plugin compiles; device test pending |
| T34 release-workflow | done 2026-11-20 | PR #18 | green | release.yml |
| T35 pwa | done 2026-11-20 | PR #18 | green | PWA |
| T36 first-release | in_progress | tag v0.1.0 | release run 44722456728 green | v0.1.0 published; device QA + v0.1.1 update test need the user |
| T37 tmdb-proxy | skipped | — | — | optional, needs the user's OK |

## Open questions

1. **(OPEN — user)** Rotate the TMDB token in the TMDB dashboard and update the `TMDB_TOKEN` secret. **GitHub Secrets Status:** Checked via `gh secret list --repo Ashrix404/cinetor-next`. All 6 requested secrets are present (`TMDB_TOKEN`, `RELEASE_REPO_TOKEN`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). None are missing. Needs confirmation if the TMDB token in GitHub Secrets has already been rotated from the one previously shared in chat.
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

### T05–T10 core — done 2026-11-20 (Claude Code)
- T05: see above. T06: `tmdb.ts` (`configureTmdb` lets TV switch to localStorage + 30 min TTL; stale cache is returned on network/HTTP errors so feeds still paint offline). Contract test ran against the real API in CI and passed (all fields we read exist).
- T07: `catalog.ts` — `Feed` also carries `pool` (needed by `byGenre`). Genre ids map to prototype names through `GNORM`; `pickGenre` = prototype `genPick` (real matches when ≥ 4, else stable spread). `light` option = 1 page per source (TV: Home uses 3 list endpoints + 2 genre lists).
- T08: `library.ts`, `series-settings.ts` (keyed by series; accepts `Show|s|e` keys), `pin.ts` (`pinHash` identical to prototype, plus the keypad flow `pinPress` = prototype `pinDone`).
- T09: `player-model.ts` (reducers, `next`/`prev` cross seasons; real season sizes when known), `subtitles.ts` (`parseVtt`, `subtitleCss` = prototype `subCss`, `simulateGeneration` — labelled SIMULATED, loads hosted VTT, falls back to the bundled sample line).
- T10: `sports.ts` (counts verified: All 18, Basketball 4, Cricket 9, Motorsports 2, WWE 2, Football 1, Upcoming 4), `live.ts`, `music.ts`.

### T11–T35 — built 2026-11-20 by Claude Code (agy could not finish)
- **Mobile (T11–T22)** `src/shells/mobile/`: CSS ported from the prototype (`app.css`, `glass.css`); Preact components per prototype function; one shared `<video>` moved between inline / fullscreen / PiP; downloads through `src/core/downloads/` (web engine: parallel Range fetch, ~6 connections per host; native engine in Java). Smoke test `tests/shells/mobile.smoke.test.tsx` renders every route with a mocked TMDB.
- **Desktop (T23–T24)** `src/shells/desktop/` ported from the React+htm prototype; smoke test included.
- **TV (T25–T29)** `src/shells/tv/` vanilla TS: 30-symbol SVG sprite, spatial nav (80 ms throttle), full key map (unit test), ≤ 8 rows × 12 posters + header See all, `<img loading=lazy>` with ±1 row windowing, one `<video>` reused and released, one 1 s ticker paused when hidden, TMDB cache in localStorage 30 min, 1.4 s splash. Bundle: JS 28 KB / CSS 3 KB gzip. Smoke test walks the views with key events and checks < 1500 DOM nodes.
- **Native (T30–T33)** `android/app/src/main/java/com/mythbrix/cinetor/plugins/`: CinetorNativePlugin, Downloads (Range segments, downloads.json, reload as paused), FileSink (SAF / MediaStore / legacy), DownloadService (dataSync) + Notify, Updater (sha256 while streaming, delete on mismatch, FileProvider install, unknown-sources flow). Compiles in CI; **not yet tested on a device**.
- **User decision 2026-11-20:** brightness/volume gestures only in the APK (window brightness + STREAM_MUSIC); removed from all browsers (docs/05 updated).
- **Honest gaps / UNVERIFIED (need a real device):** background playback in the APK WebView (`keepAliveForPlayback` is a no-op until proven needed); web downloads after a reload restart from 0 ("Paused · restart needed") even with OPFS; UI parity was checked by smoke tests, not by eye — check the preview links on a phone/TV.
- **T34/T35:** `release.yml` (tag `v*` → signed 5+5 APKs, `latest.json`, GitHub release in cinetor-releases, site on gh-pages with `keep_files`), `scripts/collect-release.mjs`, PWA (`web/manifest.webmanifest`, `web/sw.js`, PNG icons, iOS meta, SW update toast, version.json poll).

### U01 user requests round — 2026-11-20 (Claude Code, PR #20)
- Requested by the user (overrides AGENTS rule 7 for these items): Downloads page redesign (settings sheet with save location + parallel connections, TMDB thumbnails, in-app offline playback via `Capacitor.convertFileSrc(content uri)` / OPFS copy on web), player controls tap-to-hide + auto-hide after 3 s, bigger landscape controls, lock moved inward (camera cut-out), swipeable rows (were `overflow:hidden`), translucent overlay bottom nav, music bar above the nav + close button, music chips under the top banner, fixed-size download sheet with ellipsis titles, popup View button layout, softer iOS-like liquid glass (no 0.5 px hairlines, color-mix fallbacks for old WebViews), C-mark launcher icons (phone + TV).
- **Network modes (vega-app parity):** WARP mode (usque http-proxy, one-time `usque register -a`), AntiDPI mode (ByeDPI SOCKS5 + the 4 vega presets + custom args), DNS over HTTPS (Cloudflare, Google, AdGuard, Custom, Off; RFC 8484). All app traffic goes through a local Java proxy (`NetProxy`): WebView via `androidx.webkit.ProxyController`, native downloads/updater via `java.net.Proxy`. Web/desktop show the honest note that browsers cannot do this. TV: OK toggles WARP/AntiDPI and cycles DoH providers (Custom needs typing, so not on TV).
- **UNVERIFIED (device test needed):** WARP registration and tunnel on real networks; WebView PROXY_OVERRIDE needs a recent Android System WebView (old TVs: only native traffic uses the mode); `_capacitor_content_` range playback of MediaStore files.

### U02 player/streams round — 2026-11-20 (Claude Code)
- **Root cause of black player:** gateway `sources[].url` are embed *pages* (`isDirect:false`, mislabeled `hls`); the app put them into `<video src>`. `parseResolve` now only plays real media (`.m3u8/.mp4/...`) in `<video>`; every embed goes to a server list (`pl.servers`) with a Server switcher, "Taking long? Try another server", Retry and an error card (never a black screen). Resolve timeout 12 s ×2.
- Gestures (`player/gestures.ts`, portrait + landscape): single tap toggles controls immediately (double-tap removed); slide left/right seeks (preview pill, commit on release); long hold = 2× (restored on release); brightness/volume vertical drags stay APK-only.
- Glass: floating rounded nav/top bar/sheets; `.scr` no longer isolates (it hid the download sheet footer under the nav). Download sheet always above nav, footer un-clipped.
- Splash: native launch screen now the same #050506 (no image) + in-app splash border removed = one continuous splash.
- **UNVERIFIED (device):** embed servers inside the APK WebView; 2× / seek feel on a real phone.

### U03 player UI = prototype — 2026-11-20 (Claude Code, branch fix/player-ui-proto)
- Ported prototype `vcore(land)` / `pBtn` / `sheetHtml` (prototype/android/index.html) 1:1 into `player/controls.tsx`, replacing the vega-style bar (`.vg-*`): `.pl.t` back + `.grp` pills (portrait: bg play, quality, speed, PiP, ⋮; landscape: quality, speed, PiP, ⋮), `.pl.rm` lock (right middle portrait / left middle landscape, moved inward), `.pl.rm.bgp` bg play (landscape), `.pl.c` rew10 · play · fwd10, `.pl.bl` (portrait: subs, episodes*, prev*, next*; landscape: subs, audio, resize, server, episodes*, prev*, next*), `.pl.b` seek row with fullscreen / fullscreen-exit (docs/05 layout table). Server sheet added (real gateway servers, else prototype 1/2/3); ⋮ sheet got the server row.
- Fixes: `.vid` got an inline `position:relative` from VideoHost, so the `<video>` collapsed to 0 px height (CSS `!important` fix, VideoHost untouched); hidden controls never catch taps; embed (iframe) mode keeps Back / Server / Fullscreen always visible (`controlsHidden`), touch-action auto there; gestures: pointer capture, `pointercancel` undoes (no commit), long-press context menu blocked, `<video>` has `pointer-events:none`; safe-area insets on landscape top/bottom/sides and sheets; rounded floating glass pills + sheets.
- Desktop player: no 340 ms double-click delay; mouse click = play/pause (prototype web), touch tap = toggle controls; hidden `.ui` no longer clickable; embed bar always visible with real server switch + browser fullscreen; server button in bottom-left row (docs/05).
- Pure logic `src/core/player-gesture.ts` + `tests/core/player-gesture.test.ts`.
- **UNVERIFIED (device):** gesture feel / pointer capture inside the APK WebView and iOS Safari; embed iframes with the bar on top.

## Releases

| Version | Date | Notes |
|---|---|---|

| Version | Date | Run | Notes |
|---|---|---|---|
| v0.1.0 | 2026-11-20 | release 44722456728 | 5 phone + 5 TV signed APKs (codes 1000–1004), latest.json, site + PWA on https://ashrix404.github.io/cinetor-releases/ |

