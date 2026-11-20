# 04 — Implementation plan

> For agents: do ONE task per session, in order. Follow `AGENTS.md` §2 for every task. A task is done only when its acceptance boxes are ticked in `docs/PROGRESS.md` and CI is green.

**Goal:** ship Cinetor Next on Android phone (APK), Android TV (APK) and the web (desktop and mobile browsers, iOS included). Every feature and screen must match `prototype/`, the app must update itself, and everything must build in GitHub Actions.

**Architecture:** one TypeScript codebase with `src/core` (tested, no DOM) and three shells (`mobile` Preact, `desktop` Preact, `tv` vanilla). Capacitor 8 packs the APKs, and a small custom Java plugin (`CinetorNative`) does the native work. See `docs/02-architecture.md`.

**Spec:** `docs/01-product-spec.md` + `prototype/`.

## Global constraints

- No local builds. CI only (`AGENTS.md` rule 1).
- Use only the dependency versions in `docs/02-architecture.md`.
- TMDB requests always send `include_adult=false`.
- TV bundle budgets are in `docs/09-performance-budgets.md` (JS ≤ 60 KB gzip, CSS ≤ 12 KB gzip). CI fails above the budget.
- Strings and labels are copied from the prototype, in US English.
- APK ids: `com.mythbrix.cinetor` (phone), `com.mythbrix.cinetor.tv` (TV). Version source: the git tag `vX.Y.Z`. `baseCode = X*10000 + Y*100 + Z`.

## Review focus (failure modes most likely to hurt users)

1. **TMDB fails** (no network, 401 bad token, 429 rate limit). The app must show the cached feed or a friendly error card with Retry, never a blank screen. Tests are in T06.
2. **Back navigation on Android/TV.** The hardware Back must close the sheet, PiP, player, then pop the page, and on the root page it must exit only after a second press with the toast "Press back again to exit". Tests are in T05 (router) and T25 (TV keys).
3. **The update downloads a wrong or corrupt APK.** sha256 mismatch → delete the file and show "Update failed, try again", and never open the installer. Tests are in T32.
4. **Downloads survive app restart.** Paused or running items must reload as paused with correct bytes, and resume with HTTP Range. Tests are in T31.
5. **Low-spec TV:** a long row must not freeze the D-pad. Rows render at most 12 posters plus "See all", and images lazy-load. Size and DOM budget checks are in T29.

---

## Phase 0 — Bootstrap (CI does all builds)

### T01: Tooling, three empty shells, CI
**Files:** `package.json`, `tsconfig.json`, `vite.mobile.config.ts`, `vite.desktop.config.ts`, `vite.tv.config.ts`, `vitest.config.ts`, `src/shells/{mobile,desktop}/main.tsx`, `src/shells/tv/main.ts`, `src/shells/*/index.html`, `web/index.html`, `scripts/size-budget.mjs`, `.github/workflows/ci.yml`, `.github/workflows/bootstrap.yml`, `.gitignore`, `docs/PROGRESS.md`.
- `package.json` scripts: `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `build:mobile`, `build:desktop`, `build:tv`, `build:web` (all three plus assembling `dist/site/`, see `docs/02-architecture.md` web layout), `size` (`node scripts/size-budget.mjs`).
- Each shell renders one line, "Cinetor <shell> shell OK", so the build can be proven. Each shell `index.html` has `<html data-shell="mobile|desktop|tv">`.
- `vite.tv.config.ts`: `build.target: ['es2017','chrome61']`, `build.cssTarget: 'chrome61'`, no Preact plugin, `build.modulePreload: false`, `base: './'`.
- Mobile and desktop configs: `base: './'`, the Preact preset, `build.target: 'es2020'`.
- `bootstrap.yml` (workflow_dispatch, input `task`): when `task=lock`, it runs `npm install --no-audit --no-fund` and commits `package-lock.json` back to the current branch (permissions `contents: write`).
- `ci.yml` follows `docs/08-updates-and-release.md` §ci.yml. It starts with the jobs `web` and `size`; `android` is added in T02.

**Acceptance**
- [ ] `gh workflow run bootstrap.yml -f task=lock --ref task/T01-tooling` commits `package-lock.json`.
- [ ] CI is green: typecheck, an example unit test, all 3 builds, the size check.
- [ ] The CI artifact `site` contains `index.html`, `m/`, `d/`.

### T02: Android project via CI, flavors and multi-ABI
**Files:** `capacitor.config.ts`, `android/**` (generated), `android/app/build.gradle` (edit), `android/app/src/tv/AndroidManifest.xml`, `android/app/src/tv/res/drawable/banner.xml` + `ic_cmark.xml` (vector, see `docs/08-updates-and-release.md`), `scripts/android-assets.sh`, `scripts/check-apks.sh`, `.github/workflows/bootstrap.yml` (add `task=android`), `ci.yml` (add the `android` job).
- `bootstrap.yml task=android`: `npx cap add android` → commit `android/`.
- Add flavors `phone` and `tv`, ABI splits, signing from env, and the asset overlay exactly as `docs/08-updates-and-release.md` §Flavors describes.
- The CI `android` job runs `assemblePhoneDebug assembleTvDebug`, then `aapt2 dump badging` for every APK (10 APKs), then uploads the artifacts.

**Acceptance**
- [ ] CI shows 5 phone APKs + 5 TV APKs (`universal`, `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`).
- [ ] The badging of the TV APKs contains `leanback-launcher` and `uses-feature-not-required: name='android.hardware.touchscreen'`.
- [ ] `unzip -p <tv apk> assets/public/index.html | grep 'data-shell="tv"'` succeeds; the phone APK has `data-shell="mobile"`.

### T03: Keystore workflow
**Files:** `.github/workflows/keystore.yml`. The workflow_dispatch job generates `cinetor.jks` with `keytool -genkeypair -alias cinetor -keyalg RSA -keysize 4096 -validity 36500` and random 32-char passwords from `openssl rand`. It writes `secrets.txt`, base64-encodes the jks, and uploads the artifact `cinetor-keystore` with retention 1 day. It never prints secrets to the log.

**Acceptance**
- [ ] The user ran it and set the 4 secrets (`docs/03-github-setup.md` Step 4).

### T04: Mock media
**Files:** `media/build-media.sh`, `media/subtitles/*.vtt` (16 languages, text from the prototype `LANGS` sample lines), `.github/workflows/mock-media.yml`.
- Follow `docs/06-media-and-downloads.md` §Mock media exactly (ffmpeg commands, file names, `media/index.json`).
- Publish to the `gh-pages` branch of `cinetor-releases` under `media/` with `keep_files: true`.

**Acceptance**
- [ ] `curl -sI https://ashrix404.github.io/cinetor-releases/media/clip-720p.mp4` returns `200`, `accept-ranges: bytes`, `access-control-allow-origin: *`.
- [ ] `media/index.json` lists every file with its size and sha256.

---

## Phase 1 — Core (pure TypeScript, unit tested)

### T05: config, platform, store, router
**Files:** `src/core/{config,platform,store,router}.ts`, `tests/core/{store,router}.test.ts`.
**Produces:** the interfaces in `docs/02-architecture.md` §Core contracts; `platform`: `isNative(): boolean`, `isTv(): boolean`, `isIOS(): boolean`, `canPickFolder(): boolean`.
- Router tests: push/pop order; `root()` clears the stack; `pop()` on the root returns `false`; subscribers are called once per change.
- Store tests: persistence round-trip; the corrupt JSON in storage falls back to `initial`.

### T06: TMDB client
**Files:** `src/core/tmdb.ts`, `tests/core/tmdb.test.ts`, `tests/core/tmdb.contract.test.ts`.
- `tmdbGet` uses a v4 Bearer token if its length > 60, otherwise a v3 `api_key`. It always adds `include_adult=false`. It keeps a memory cache plus sessionStorage with a 10-minute TTL. For 429 it retries once after `Retry-After` seconds (default 2). For 401 it throws `TmdbAuthError`.
- `mapTitle(raw): Title` maps both movie and tv results.
- Unit tests use a mocked `fetch`: Bearer vs api_key, `include_adult=false` present, cache hit, 429 retry, 401 error, mapping of a movie and a tv sample.
- The contract test (runs only when `TMDB_TOKEN` exists) calls `/trending/all/week`, `/tv/{id}?append_to_response=credits,videos,similar`, `/tv/{id}/season/1`, `/person/{id}/combined_credits`, `/search/multi?query=avatar`, `/genre/movie/list`, and asserts that the fields we read exist.

### T07: Catalog feeds
**Files:** `src/core/catalog.ts`, `tests/core/catalog.test.ts`.
**Produces:** `loadSection(section: 'home'|'anime'|'drama'|'comics'|'adult', option?: string): Promise<Feed>`, where `Feed = { hero: Title[]; rows: Row[]; genres: string[] }` and `Row = { id: string; title: string; items: Title[] }`; and `byGenre(feed, genre): Title[]`.
- The sources match the prototype `loadTmdb` (home: trending + popular; anime: `discover/tv?with_genres=16&with_original_language=ja`; drama: K=ko, C=zh, J=ja + genre 18, Pakistani=ur→hi fallback; comics: anime/ko/zh as proxies; adult: movie genres 27, 53, 10749).
- Row titles: the special rows plus `Top|Trending in|Best of|Popular in|Fresh in <Genre>` as in the prototype `feedRows`.
- Genre lists come from the prototype `GEN`.
- Tests: deduplication by title, each row ≤ 14 items, the genre filter uses `genreIds`.

### T08: Library, progress, series settings, PIN
**Files:** `src/core/{library,series-settings,pin}.ts` + tests.
- `pinHash(pin: string): string` must equal the prototype's `pinHash` (keep it compatible). `enableAdult(pin)`, `verify(pin)`, `disableAdult(pin)`, `changePin(old, new)`.
- Tests: wrong PIN rejected; disabling clears the hash; the series settings for `"Show|..."` apply to S2E1 after S1E6; the watch progress clamps to 0..1; continue watching removes and clears.

### T09: Player model and subtitles
**Files:** `src/core/player-model.ts`, `src/core/subtitles.ts` + tests.
- `PlayerState` (`docs/05-player.md`) and pure reducers `play`, `pause`, `seekBy`, `next`, `prev` (crossing seasons, 6 eps/season mock), `setQuality`, `setSub`, `setAudio`, `lock`, `pip`.
- `parseVtt(text): Cue[]`, `simulateGeneration(lang, onProgress): Promise<string>` (resolves to VTT from the bundled sample), `subtitleCss(style, mode)` (port of the prototype `subCss`).

### T10: Mock section data
**Files:** `src/core/{sports,live,music}.ts` + tests.
- Port the prototype `SPORT`, `HILITES`, `FLAGS`, `TEAMS`, `spCounts`, `upSoon` as-is. Test that the counts equal the prototype (All 18, Basketball 4, Cricket 9, Motorsports 2, WWE 2, Football 1; Upcoming 4).

---

## Phase 2 — Mobile shell (port `prototype/android/index.html`)

For every UI task, port markup and CSS 1:1 from the named prototype functions. Put shared tokens in `src/shells/mobile/tokens.css`. Acceptance for UI tasks = CI green + the user checks the PR preview link on a phone (`docs/08-updates-and-release.md` §Preview).

| Task | Scope | Prototype source |
|---|---|---|
| **T11** App frame | tokens, edge-to-edge safe areas, splash, bottom nav (custom SVG icons), sticky banner, side menu (compact, Adult only if enabled), theme switch + `glass.css` (optimized version: blur only on nav, sheet, dialog and drawer, static glow) | `playSplash`, `navBar`, `carTop`, `drawerHtml`, CSS `.bbar`, `.dwr`, "Liquid glass" block |
| **T12** Feed building blocks | `Poster` (TMDB badge), `Row` (+View all), `ListPage` (grid/list), `HeroCarousel` (4 s, 1.1 s easing, z-index transition, edge fade, drag), `Chips`, Home + Continue watching (✕ / Clear all) | `poster`, `row`, `V.list`, `carousel`, `carSet`, `CONTf` |
| **T13** Sections | Anime, Drama options, Adult (PIN keypad screen, gating), Search, My Library | `V.anime`, `V.drama`, `pinHtml`, `V.search`, `V.library` |
| **T14** Info page | muted trailer (YouTube nocookie iframe, no controls), metadata, actions, cast → Person (Movies/Series), seasons/episodes with watch bars, For you | `V.info`, `V.person`, `trailerHtml` |
| **T15** Portrait player + PiP | control layout A6, swipe down→PiP, swipe up→fullscreen, draggable PiP that survives navigation | `vcore(false)`, `pipHtml`, swipe handlers |
| **T16** Fullscreen player | landscape layout, lock, ⋮ sheet, series settings, next/prev, brightness and volume gestures (`docs/05-player.md`) | `vcore(true)`, `sheetBody` |
| **T17** Subtitles UI | sheet, generate on device (progress pill), online search, style editor + Settings page | `subsBody`, `subsearchBody`, `substyleBody` |
| **T18** Downloads UI | download sheet (S1 preselected, per-season memory), session memory, popup with View, Downloads page | `dlSheet`, `dlPop`, `V.downloads` |
| **T19** Settings | all pages, About (Check for updates calls the updater from T32; until then a stub) | `V.settings`, `V.appearance`, `V.playerset`, `V.prefs`, `V.data`, `V.about`, `V.adultset` |
| **T20** TV tab | Live TV + Sports + match page, theme colors only, compact text | `V.tv`, `V.live`, `V.sports`, `V.watch` |
| **T21** Music | Spotify-style page, Now playing, music download | `V.music`, `V.nowplaying` |
| **T22** Comics | feed, chapters, reader with page pill, resume | `V.comics`, `V.reader`, `updReader` |

Each UI task: components in `src/shells/mobile/<area>/`, ≤ 300 lines per file, no inline styles except CSS variables.

---

## Phase 3 — Desktop shell (port `prototype/web/index.html`)

| Task | Scope |
|---|---|
| **T23** Frame | top bar, nav (Adult only when enabled), router, hero crossfade, chips wrap, rows with arrows, theme switch, `web/index.html` width router, mobile/desktop switch |
| **T24** Pages | Detail, Person, player overlay (shared `player-model`), Downloads (File System Access + fallback), Comics reading mode, Music, TV/Sports, Settings, PIN |

---

## Phase 4 — TV shell (port `prototype/tv/index.html`, vanilla TS, ultra light)

| Task | Scope |
|---|---|
| **T25** Frame | sidebar, spatial nav (`spatial-nav.ts`), key map (`keys.ts`, every key code in spec C), Back rules, lightweight splash (≤ 1.4 s, no blur) |
| **T26** Feeds | Home/Anime/Drama, rows with header See all, list page, Continue watching (Delete key) |
| **T27** Info + Player | info, person, seasons/episodes; fullscreen-only player, media keys, series settings, subtitles generate |
| **T28** Other | TV section (live rows by category, sports), music, search, library, settings with PIN, About |
| **T29** Performance | apply `docs/09-performance-budgets.md`: lazy images, row windowing, no transitions, CI budget gate, low-spec checklist |

---

## Phase 5 — Native and updates

| Task | Scope |
|---|---|
| **T30** `CinetorNative` plugin (part 1) | Java plugin + TS wrapper: brightness, volume, openExternal chooser, uiMode, supportedAbis, versionCode. Follow `docs/07-native-plugin.md`. |
| **T31** Download engine | native parallel Range engine (16/32/64), pause/resume/persist, foreground notification, MediaStore Downloads + SAF folder picker, Comics/ and Music/ subfolders; web engine with the same interface (`docs/06-media-and-downloads.md`) |
| **T32** Updater | `latest.json` check (start + every 6 h), ABI pick, dialog (mobile + TV remote-friendly), APK download with progress + sha256 verify + install, unknown-sources permission flow; web SW update toast (`docs/08-updates-and-release.md` §Updater) |
| **T33** Native polish | edge-to-edge (status bar overlay), Back button rules via `@capacitor/app`, orientation lock in fullscreen, keep screen on while playing |

---

## Phase 6 — Release

| Task | Scope |
|---|---|
| **T34** `release.yml` | tag `v*` → build web + signed APKs (2 flavors × 5 ABIs) → sha256 → GitHub release in `cinetor-releases` → `latest.json` + site to `gh-pages` (keep `media/`) |
| **T35** PWA | `manifest.webmanifest`, `sw.js` (precache shell, network-first for TMDB, cache-first for images), iOS meta tags, install hint |
| **T36** First release | tag `v0.1.0`, run `docs/11-qa-checklist.md`, fix, tag `v0.1.1`, and verify the in-app update from 0.1.0 → 0.1.1 on a phone and a TV |
| **T37** (optional) TMDB proxy | Cloudflare Worker that hides the token; needs the user's OK |
