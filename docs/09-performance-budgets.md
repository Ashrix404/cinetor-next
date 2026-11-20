# 09 — Performance budgets (TV first)

## Target low-spec TV

Android TV 8.0 (API 26), 1 GB RAM, quad-core Cortex-A53, 720p or 1080p panel, system WebView ≈ Chrome 61+ (old TVs often do not update WebView). The TV app must open, scroll and play smoothly on this device with no hang and no D-pad lag.

## Hard budgets (CI fails above them — `scripts/size-budget.mjs`)

| Bundle | JS (gzip) | CSS (gzip) | Other |
|---|---|---|---|
| tv | ≤ 60 KB | ≤ 12 KB | no web fonts, no icon font |
| mobile | ≤ 130 KB | ≤ 30 KB | |
| desktop | ≤ 150 KB | ≤ 30 KB | |

`size-budget.mjs` also scans `dist/tv/**/*.css` and `src/shells/tv/**/*.css` and FAILS when it finds any of: `backdrop-filter`, `filter:`, `box-shadow`, `transition`, `@keyframes` (allowed only inside a block marked `/* splash-allowed */`), `blur(`, `@import url(`. It also fails if `dist/tv` contains `<iframe` or `fonts.googleapis`.

## TV rules (mandatory)

1. **No framework.** Vanilla TS views that build DOM with template strings plus one delegated event listener (same pattern as the prototype).
2. **System font** (`font-family: system-ui, Roboto, sans-serif`). Icons: one inline SVG sprite with ≤ 30 symbols (`<use href="#i-home">`).
3. **Focus style** = `outline: 3px solid #fff; outline-offset: 2px`. No scale, no shadow, no animation.
4. **Scrolling:** `el.scrollIntoView({block:'nearest', inline:'nearest'})` without `behavior: 'smooth'`. No CSS `scroll-behavior`.
5. **Key repeat:** handle at most one arrow move per 80 ms (throttle while a key is held).
6. **Rows:** at most 8 rows on a feed page and at most 12 posters per row, plus the "See all" button in the header. "See all" opens a grid that renders 24 at a time and adds 24 more when focus reaches the last row.
7. **Windowing:** only rows within ±1 of the focused row hold real image URLs; other rows use a placeholder background. Release the image `src` of rows that leave the window.
8. **Images:** posters `w185`, hero `w780`, cast `w185`, stills `w300`. Every `<img>` has `loading="lazy" decoding="async" width height`. Use `<img>` instead of `background-image` for anything that is not the hero.
9. **No YouTube iframe, no trailer, no video on Info.** Video exists only inside the fullscreen player; there is one `<video>` element, created once and reused.
10. **Timers:** one shared 1-second ticker (player progress). Stop every timer on `visibilitychange` → hidden. No `setInterval` that is not cleared.
11. **Network:** cache TMDB responses in `localStorage` with a 30-minute TTL (TV only, max ~1.5 MB) so a cold start paints instantly from cache, then refreshes. Request at most 6 TMDB endpoints for Home.
12. **DOM size:** ≤ 1,500 nodes on any TV page (`scripts/size-budget.mjs` checks the built Home HTML skeleton; a runtime `console.warn` fires above the limit in dev builds).
13. **Splash:** at most 1.4 s, a static logo with one opacity fade, no blur.
14. **Memory:** clear the player's `video.src` and call `video.load()` on exit so the decoder is released.
15. **Android side:** `android:hardwareAccelerated="true"`, no `largeHeap`, landscape only.

## Mobile/desktop rules

- Liquid glass: `backdrop-filter` only on the bottom nav, sheets, dialogs, drawer (mobile) and top bar, sheets, menu (desktop), at 16 px. The background glow is static (no animation). Lists and cards use translucent gradients without blur.
- Hero carousel: animate only `transform` and `opacity`, `will-change: transform` on cards, pause auto-advance when the tab is hidden.
- Images: posters `w342` on mobile and desktop, hero `w780` (mobile) / `w1280` (desktop), `loading="lazy"`.
- Rows render lazily with `content-visibility: auto` plus `contain-intrinsic-size`.

## Manual low-spec check (user, before each release)

1. Install the TV `armeabi-v7a` APK on the slowest TV or box available (or a cheap Android TV stick).
2. Cold start → Home is visible in < 3 s, from cache in < 1.5 s on the second start.
3. Hold → for 5 s on a row: focus keeps moving, no freeze.
4. Open Info → Play → seek ±10 s ×10 → Back: no crash, memory stays stable (Settings › Apps › Cinetor shows no growth after 3 rounds).
