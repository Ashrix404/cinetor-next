# 02 — Architecture

## Why this stack (light and simple)

- **TypeScript + plain CSS.** No heavy UI framework.
- **Preact** (≈4 KB) for the `mobile` and `desktop` shells, with JSX compiled by Vite.
- **Vanilla TypeScript, no framework** for the `tv` shell. Low-spec TVs need the smallest possible JS.
- **Vite** builds three separate bundles (one per shell) in CI only.
- **Capacitor** wraps the web bundles into Android APKs (phone and TV). There are no cross-platform UI layers and no Flutter or React Native.
- iOS is served as a **web app / PWA**. We do not build a native iOS app, because that needs a Mac and Apple signing.

## Dependencies (allowed list, verified on the npm registry 2026-11-20)

Dependencies for media playback, edge streaming gateway integration, network modes, and player capabilities are officially approved (user override 2026-11-20). The core stack:

| Package | Version | Used by |
|---|---|---|
| `preact` | 11.2.0 | mobile, desktop |
| `vite` | 8.3.8 | build (dev dep) |
| `@preact/preset-vite` | 2.10.6 | build (dev dep) |
| `typescript` | 7.0.2 | typecheck (dev dep) |
| `vitest` | 5.1.1 | unit tests (dev dep) |
| `happy-dom` | 21.0.4 | test DOM (dev dep) |
| `@capacitor/core` | 8.6.2 | native bridge |
| `@capacitor/cli` | 8.6.2 | sync (dev dep) |
| `@capacitor/android` | 8.6.2 | Android project |
| `@capacitor/app` | 8.1.2 | back button, app version, app state |
| `@capacitor/status-bar` | 8.0.4 | edge-to-edge status bar |
| `@capacitor/screen-orientation` | 8.0.2 | landscape lock in the fullscreen player |
| `@capacitor/share` | 8.0.3 | share and "send to another app" fallback |

Streaming runtime (user authorised 2026-11-20): `hls.js` **1.7.4** (npm, Apache-2.0), NOT bundled. `src/core/playback.ts` loads `https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.light.min.js` (117 KB gz, sha384 SRI pinned to the npm file) only when a browser cannot play HLS natively or a stream needs the gateway proxy, so the size budgets hold. CI-only diagnostic: `playwright` 1.65.1 installed with `--no-save` inside `stream-probe.yml`.

Everything else native (brightness, volume, download engine, APK install, external app chooser, storage folder picker) is in our own small Java plugin `CinetorNative` (`docs/07-native-plugin.md`). That means no unverified third-party plugins.

Android native libraries (Google Maven, verified): `androidx.documentfile:documentfile:1.1.0` (SAF folder writing), `androidx.webkit:webkit:1.14.0` (ProxyController for the network modes; added with the user's OK 2026-11-20).

Network helper executables (user's OK 2026-11-20, vega-app parity; built from source in CI by `scripts/build-net-bins.sh`, pinned commits, MIT): `byedpi` v0.17.3 (`libciadpi.so`, AntiDPI mode) and `usque` v4.2.1 (`libusque.so`, WARP mode). Because of these, the APKs now DO contain native code per ABI. The rest (`androidx.core` FileProvider, `androidx.appcompat`) comes with the Capacitor template.

CI toolchain: Node **26 LTS**, Temurin JDK **21**, Android SDK from `android-actions/setup-android`. The Capacitor 8 template uses minSdk **26**, compile and target SDK **37**. Read the real values from the generated `android/variables.gradle`, never type them from memory.

## Repository layout (source repo)

```
cinetor-next/
├─ AGENTS.md                  agent rules
├─ docs/                      this documentation + PROGRESS.md
├─ prototype/                 approved HTML prototypes (read-only reference)
├─ package.json  package-lock.json  tsconfig.json
├─ vite.mobile.config.ts      builds dist/mobile/  (Preact)
├─ vite.desktop.config.ts     builds dist/desktop/ (Preact)
├─ vite.tv.config.ts          builds dist/tv/      (vanilla, old-WebView target)
├─ capacitor.config.ts
├─ web/                       static web-only files: index.html (shell router), manifest.webmanifest, sw.js, icons/
├─ src/
│  ├─ core/                   framework-free TypeScript shared by all shells (unit tested)
│  │  ├─ config.ts            build-time constants (VERSION, VERSION_CODE, TMDB token placeholder, URLs)
│  │  ├─ tmdb.ts              typed TMDB client + cache + image URL helper
│  │  ├─ catalog.ts           section feeds (home, anime, drama options, comics, adult, genres)
│  │  ├─ store.ts             tiny observable store + persistence (localStorage / Capacitor Preferences-free)
│  │  ├─ router.ts            stack router (push, pop, root) used by all shells
│  │  ├─ library.ts           My Library, continue watching, watch progress
│  │  ├─ series-settings.ts   per-series audio/quality/subtitle memory
│  │  ├─ pin.ts               Adult PIN hash, enable/disable/verify
│  │  ├─ player-model.ts      playback state machine (no DOM)
│  │  ├─ subtitles.ts         VTT parsing, style model, simulated generation
│  │  ├─ downloads/           engine interface + web engine + native bridge + file naming + PDF maker
│  │  ├─ updater.ts           latest.json check, version compare, ABI pick
│  │  ├─ sports.ts            mock sports data + counters (from prototype SPORT/HILITES)
│  │  ├─ live.ts              mock channels
│  │  ├─ music.ts             mock playlists
│  │  └─ platform.ts          isNative, isTv, isIOS, capabilities
│  ├─ native/
│  │  └─ cinetor-native.ts    TypeScript wrapper for the Java plugin (registerPlugin)
│  ├─ shells/
│  │  ├─ mobile/              Preact components + mobile.css (+ glass.css)
│  │  ├─ desktop/             Preact components + desktop.css (+ glass.css)
│  │  └─ tv/                  vanilla TS views + tv.css + spatial-nav.ts + keys.ts
│  └─ assets/icons.ts         inline SVG strings (C-mark, nav icons, rew10/fwd10, …)
├─ android/                   generated by Capacitor IN CI, then committed (see plan T02)
│  └─ app/src/{main,phone,tv}/…
├─ media/                     scripts + sources for mock media (built in CI, never committed as binaries)
└─ .github/workflows/         ci.yml, bootstrap.yml, mock-media.yml, release.yml
```

## Shells and entry points

| Build | Entry | Output | Loaded by |
|---|---|---|---|
| mobile | `src/shells/mobile/main.tsx` | `dist/mobile/` | phone APK, phone browsers |
| desktop | `src/shells/desktop/main.tsx` | `dist/desktop/` | wide browsers |
| tv | `src/shells/tv/main.ts` | `dist/tv/` | TV APK only |

Web deploy layout (`dist/site/`):
```
index.html        tiny router: width < 700 px → ./m/ else ./d/ (?desktop / ?mobile override)
m/                mobile bundle
d/                desktop bundle
media/            mock media (kept between deploys)
latest.json       update manifest
version.json      web build version for the service worker update prompt
sw.js, manifest.webmanifest, icons/
```

APK assets: the phone flavor packs `dist/mobile/` and the TV flavor packs `dist/tv/` (`docs/08-updates-and-release.md` §Flavors).

## Core contracts (names every task must use)

```ts
// src/core/router.ts
export type Route = { name: string; params?: Record<string, unknown> };
export interface Router { stack(): Route[]; push(r: Route): void; pop(): boolean; root(name: string): void; subscribe(fn: () => void): () => void }

// src/core/store.ts
export function createStore<T extends object>(key: string, initial: T, persist: boolean): Store<T>;
export interface Store<T> { get(): T; set(patch: Partial<T>): void; subscribe(fn: (s: T) => void): () => void }

// src/core/tmdb.ts
export interface Title { id: number; mediaType: 'movie' | 'tv'; title: string; poster: string | null; backdrop: string | null; rating: number; year: string; overview: string; genreIds: number[] }
export function tmdbGet<T>(path: string, params?: Record<string, string>): Promise<T>;
export function img(path: string | null, size: 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280'): string;

// src/core/downloads/engine.ts
export type DlKind = 'video' | 'comic' | 'music';
export interface DlItem { id: string; titleId: number; kind: DlKind; title: string; season: number; episode: number; quality: number; audio: string; url: string; bytesDone: number; bytesTotal: number; status: 'queued' | 'running' | 'paused' | 'done' | 'error'; path: string }
export interface DownloadEngine { start(item: DlItem, connections: 16 | 32 | 64): Promise<void>; pause(id: string): Promise<void>; resume(id: string): Promise<void>; cancel(id: string): Promise<void>; onProgress(fn: (it: DlItem, bytesPerSec: number) => void): () => void }

// src/core/updater.ts
export interface ReleaseManifest { version: string; versionCode: number; minVersionCode: number; notes: string; publishedAt: string; apk: Record<'phone' | 'tv', Record<'arm64-v8a' | 'armeabi-v7a' | 'x86' | 'x86_64' | 'universal', { url: string; sha256: string; size: number }>>; web: { version: string } }
export function isNewer(m: ReleaseManifest, currentCode: number): boolean;
export function pickApk(m: ReleaseManifest, flavor: 'phone' | 'tv', abis: string[]): { url: string; sha256: string; size: number };
```

## Data flow

TMDB → `tmdb.ts` (fetch, memory + sessionStorage cache) → `catalog.ts` builds feeds → shells render. Stream resolution → Cloudflare Edge Gateway (`cinetor-api.sofasraful.workers.dev/v1/resolve` / `v1/live` / `v1/music`) aggregates MovieBox direct streams, verified embed players, and live HLS channels for universal instant playback (<2-3s). Persistent user data → `store.ts` → localStorage (web) / WebView localStorage (APK).

## TMDB token

- The token is injected at build time from the GitHub secret `TMDB_TOKEN` as `import.meta.env.VITE_TMDB_TOKEN`. It is never in the repo.
- Any token shipped in client code can be read by users. For a prototype this is accepted. Before a public launch, put a tiny proxy in front (Phase 9, optional T38).
- The token pasted in chat earlier must be rotated in the TMDB dashboard before the first release.

## Multi-ABI (phone and TV)

- The app has NO native `.so` libraries (Capacitor + Java only), so one **universal** APK runs on every ABI.
- We still ship per-ABI APKs because the user asked for them: Gradle `splits.abi` with `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` and `universalApk true`, for BOTH flavors.
- versionCode per ABI = `baseCode * 10 + abiDigit` (universal 0, armeabi-v7a 1, arm64-v8a 2, x86 3, x86_64 4). The updater compares `baseCode` (= `floor(code / 10)`).
- The updater picks the APK for `Build.SUPPORTED_ABIS[0]` and falls back to universal.
- CI proves every APK installs by checking `aapt2 dump badging` output for each file (no emulator).
