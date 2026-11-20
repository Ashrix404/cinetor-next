# 12 — Player architecture (Cinetor v2 → Cinetor Next)

Status: 2026-11-21. Branch `feat/v2-player-architecture`.

## 1. What Cinetor v2 really does

The "v2" app is **not** an Expo / React Native app. The user's v2 (`Ashrix404/cinetor-v2`, local copy
`~/Desktop/My Project/cinetor`) is Kotlin + Jetpack Compose + **Media3** on Android/TV and SvelteKit +
**shaka-player** on web/desktop (Tauri). Its predecessor "Cinetor Beta" (`~/Desktop/My Project/cinetor-beta-ref`)
is Kotlin + Media3 too. No source of an Expo app exists on this machine or in the user's GitHub repos.

v2 never plays third-party embed pages. Its whole playback path is **direct files with headers**:

| Step | v2 file | What it does |
|---|---|---|
| Resolve | `android/.../core/player/GatewaySourceResolver.kt` (`resolve`, `streamFor`, `resolveByTmdbId`) | Asks the user's antiblock gateway `https://antiblock-gateway.vercel.app` (`/api/public/v1/stream/{subjectId}?detail_path&se&ep&full=1`, then `/api/v1/resolve?tmdb=`); gets MovieBox `sources[]{url,resolution,format MP4/HLS/DASH,headers{Referer,Origin,Cookie},isBdix}` + `direct_play_url` (gateway proxy) + captions; dubs fetched in parallel with a 400 ms grace, captions 1 s grace. |
| Sign | `core/data/gateway/GatewayApi.kt` (`GatewaySigner.signHeaders`), web `lib/data/gateway.ts` | Every gateway call carries `X-App-Timestamp` + `X-App-Signature` (HMAC-SHA256 of `GET:path:ts` with a build secret); 401 → clock offset from `serverTime`/`Date`, retry once. |
| Rank | `GatewaySourceResolver.rankGwSources`, beta `data/stream/StreamResolver.rank` | Images / adult links are never videos; Wi-Fi: BDIX first, 1080p > 1440p > 2160p > 720p…; mobile data: adaptive (HLS/DASH) first, files nearest 720p; undecodable HEVC last; optional dual-audio first. |
| Health | `LinkHealth` (same files) | Host answering 403/428/429/451 rests 6 h; 404/410 file skipped 6 h; one HEVC decode failure demotes HEVC for the session. |
| Play (Android) | `core/player/SourceResolver.kt` (`httpFactory`, `toMediaSource`), `CinetorPlayer.kt` | Media3 `DefaultHttpDataSource` with the source's request headers (Referer/Origin/Cookie), HLS/DASH/progressive by type, side-loaded subtitles, cache. On error: next ranked source, then `direct_play_url` (gateway proxy MP4). |
| Play (web) | `web/src/lib/player/engine.ts` (`loadSrc`), `sources.ts` (`playbackOf`, `pickSource`) | Browsers cannot send Referer/Cookie → `/stream/{id}/play?url=` gateway proxy (`gateway-play.ts` `proxyUrl`, `directPlayUrl`); shaka for HLS/DASH, native `<video>` for MP4, Safari native HLS fallback, honest "unsupported" error with an external-player link for local files only. |
| Trailers | `YouTubePlayer.kt`, `lib/player/youtube.ts` | youtube-nocookie embed, the only iframe in v2. |
| Beta extras | beta tests `HostExtractorsTest`, `WebProvidersTest` (sources were stripped from the copy) | Host extractors (packed `eval(function(p,a,c,k,e,d))` unpacker, jwplayer `sources:[{file}]` reader, dood, hubcloud, gdflix, pixeldrain), and a hidden-WebView "page capture" that sniffs the first real `.m3u8`/`.mp4` request (`WebViewCapture.isStream` rejects ads, demo clips, posters). |

## 2. Why Cinetor Next could not copy that path 1:1

* The antiblock gateway now answers every unsigned call with `403 forbidden_client` /
  `unauthorized_missing_or_expired_signature` (curl 2026-11-20). The signing secret is a build secret of v2
  and is not available to this repo (and a public repo must never contain it). **Needs the user**: either add
  the secret as a GitHub Actions secret for cinetor-next (it would still ship inside a public APK), or give
  the Cloudflare gateway (`cinetor-api`) a server-side MovieBox provider.
* `cinetor-api` `/v1/resolve` returns only three embed pages and no direct file for every title.
  `movieapi.zarhosting.dpdns.org` is gone (Vercel `DEPLOYMENT_NOT_FOUND`); the MovieBox H5 BFF
  (`h5-api.aoneroom.com`, `mzfi.me/wefeed-h5api-bff/subject/search`) wants a token (`invalid token`);
  `worker.zendax.me/api/moviebox` answers `JWT token has expired`. Forging MovieBox device tokens /
  signatures or "VIP unlock" parameters is out of scope (access-control circumvention).

So Cinetor Next ports the **architecture** (ranked direct files with headers → native header injection in
the APK / proxy in browsers → engine fallback → automatic failover → accurate states) and keeps the embed
players as the fallback layer, hardened for the APK.

## 3. Cinetor Next playback, all targets

```
fetchStream (core/stream-resolver.ts, gateway /v1/resolve, 10 s ×2, session cache)
  └─ parseResolve → direct: MediaSrc[]  (core/sources.ts: v2 rank + LinkHealth, images/adult/HEVC rules)
                  → embeds: Embed[]     (core/embeds.ts: gateway pages + client players, none dropped)
direct files  → core/direct-play.ts playDirect: per file, core/playback.ts playUrl engines
                (native <video> → hls.js → hls.js through /v1/proxy), 15 s each, first with frames wins
                APK: CinetorNative.setMediaHeaders → MainActivity adds Referer/Origin per CDN host
                browser: MP4 with Referer → /v1/proxy?url=&referer=; HLS → hls.js proxy loader with that referer
embeds        → core/embed-session.ts EmbedSession (shared by mobile, desktop, TV)
                unreachable host (no-cors fetch fails) → next at once
                guard says 'blocked' → next at once (host remembered for the session, ranked last)
                guard 'ready'/'playing' or iframe load → loader off ('playing' host ranked first next time)
                15 s without a sign of life → shown if the host answered, else next; all tried → one error
```

No player/host switcher exists in any UI (user request 2026-11-21): the app picks and switches on its own;
the error card only offers Retry.

### The "In-App Browser Detected / Open in External Browser" screen

Evidence: vidsrc.su (our first-ranked player) bundle `assets/index-BmJUArvC.js` (fetched 2026-11-20):

```js
if(/Android/.test(t)){if(/; wv\)/.test(t)||/\(.*\bwv\b.*\)/.test(t))return!0;
 if(/Version\/\d+\.\d+/.test(t)&&/Chrome\/\d/.test(t))return!0}
 ... r.some(e=>"Android WebView"===e.brand) ... title:"In-App Browser Detected", actionLabel:"Open in External Browser"
```

The Android System WebView UA is `…; wv) … Version/4.0 Chrome/…` and its Client Hints brand list contains
"Android WebView", so the APK always got that screen. Other players checked the same day (vidlink, vidfast,
viduki/vidsrc.wtf, 2embed, vidsrc.to/.sh, autoembed) have no such check; 2embed and viduki detect a
`sandbox` attribute instead ("Sandbox not allowed", `/blocked`), so the web app does not sandbox them.

Fix (APK phone + TV, `android/.../MainActivity.java`):
1. `setUserAgentString(cleanUserAgent(ua))` drops `; wv` and `Version/x.y`.
2. `WebSettingsCompat.setUserAgentMetadata` (androidx.webkit 1.14.0, feature `USER_AGENT_METADATA`) renames
   the "Android WebView" brand to "Google Chrome".
3. `WebViewCompat.addDocumentStartJavaScript(webView, res/raw/embed_shim.js, {"*"})` (feature
   `DOCUMENT_START_SCRIPT`) runs the **embed guard** in every frame (not in the app page): JS-side UA/brand
   cleanup for old WebViews, `window.open` returns a dummy window (pop-up/pop-under ads on the first tap no
   longer navigate the player frame to the ad), `target=_blank`/`_top` links are not followed, and it posts
   `{__cinetor:'embed', ev:'ready'|'playing'|'blocked'}` to the app.
4. Unchanged from U03: sub-frame navigations load in place, foreign main-frame navigations are blocked,
   `intent:`/`market:` in frames are blocked, no automatic windows, real fullscreen custom view.

Probe: `stream-probe.yml` now runs every embed in four modes — `chrome` (phone browser), `webview` (APK UA
before the fix), `apk` (WebView UA + the guard), `sandbox` (iframe sandbox) — and reports frames, video
progress, pop-ups, top navigations, block screens and guard messages.

### Junk / stuck loading (fixed)

* Mobile: the embed loader waited for `!iframeLoaded || loading`; iframe `load` waits for every ad script,
  and the 15 s timer then **switched away from a working player** (churn, ad pages, blank frames). Now one
  loader owned by the session, gone on the first sign of life; after 15 s a reachable player is shown.
* Desktop: direct files went into `<video src>` without engines (no hls.js, no proxy, no timeout), embeds
  had no failover/timeout, a failed resolve left a blank backdrop with no message, and the video loader
  could sit on top of the embed loader. Now the same `playDirect` + `EmbedSession` as mobile, one loader,
  toast on error.
* TV: same session; errors as toasts (TV keeps its size budget, vanilla TS).

## 4. Per target

| | Direct files (gateway `isDirect`) | Embed players |
|---|---|---|
| Android phone APK | `<video>` + native header rules; hls.js fallback | iframe, guard injected, no WebView detection, auto failover |
| Android TV APK | same (old WebViews: guard only if `DOCUMENT_START_SCRIPT`; UA clean always) | same |
| Web (desktop + mobile PWA) | `<video>`/hls.js; Referer via gateway proxy | iframe (sandbox only for hosts proven to play sandboxed), auto failover; a browser cannot hide pop-ups inside cross-origin frames |

## 5. Unverified (needs a real device)

* Guard + UA metadata on real Android System WebView versions (feature support differs by WebView version).
* `shouldInterceptRequest` header injection for `<video>` range requests (worked for the old hakunaymatata rule
  only by assumption; no device test yet).
* Old Android TV WebViews (Chrome 61) without `DOCUMENT_START_SCRIPT`: only the native UA fix applies.

## 6. Downloads (real availability)

* `core/dl-options.ts` (unit tested): the resolver's direct files are merged per quality rung
  (2160/1080/720/480/360, nearest) and audio language (source name / file name: Original, Dual audio,
  Hindi, Bangla, Tamil, Telugu, English, Korean, Japanese, Spanish), with the size the source reports
  (`~` when unknown) and every file that provides the option, best first.
* `core/dl-avail.ts`: the sheet (mobile `dl/sheet.tsx`, desktop `overlays.tsx`) resolves the first selected
  episode once and shows "Checking what can be downloaded…", the real choices, "No downloadable file was
  found" or "Couldn't check" + Retry. The Download button is disabled when nothing is downloadable.
* `core/downloads/index.ts`: each episode is resolved at download time (links expire), the chosen
  quality/audio first, then the same quality in another audio, then the nearest quality; when the engine
  reports an error the next file starts automatically. Files whose CDN wants a Referer are fetched through
  the gateway proxy (Range supported) because neither engine sends per-source headers.
* Not offered yet: HLS-only titles (both engines write one progressive file with Range requests; an HLS
  segment downloader + mux is future work), embed pages (no file to download), torrents.
* Today the gateway returns **no direct file** for any title (section 2), so the sheet honestly says
  nothing is downloadable until a direct source exists.

## 7. Evaluated, not done in this PR

* **Native Media3/ExoPlayer plugin.** It would give per-request headers, MKV/HEVC/DASH and better codecs
  in the APK (what v2 does). But it draws a native view outside the WebView, so the prototype player UI
  (controls, gestures, sheets, subtitles overlay) would have to be rebuilt natively or overlaid, and the
  inline/PiP/fullscreen moves of the shared `<video>` would not work. With zero direct files coming from the
  gateway today, nothing would play through it yet. Recommended next step once a direct source exists:
  a fullscreen-only native player activity used for formats the WebView cannot decode (MKV, HEVC 10-bit, DASH).
* **Gateway providers** (`~/cinetor-gateway`, deployed by the lead). Every keyless MovieBox upstream tried
  on 2026-11-20 is dead or token-gated (section 2); the vega-style providers in
  `COMBINED_DEEP_API_SCRAPE.md` need MovieBox device signatures / VIP flags, Cloudflare clearance cookies or
  per-app keys (kisskh `kkey`). Forging those is access-control circumvention and was not done. No gateway
  file was changed (a backup was taken), so the current gateway keeps working with this app.
