# 01 — Product spec (feature parity with the prototype)

The prototypes in `prototype/` are the approved design. Build every item below exactly as the prototype shows it. Open the file, read the function named in the "Prototype source" column, and port it.

| Prototype file | Becomes |
|---|---|
| `prototype/android/index.html` | `mobile` shell (Android phone APK + phone browsers + iOS browsers) |
| `prototype/web/index.html` | `desktop` shell (wide-screen browsers) |
| `prototype/tv/index.html` | `tv` shell (Android TV APK) |
| `prototype/web/mobile/index.html` | identical to android; ignore (it only proves web mobile = android UI) |

Prototype-only things you must NOT port: the left "Click through the whole app" panel, the jump buttons, the fake phone frame, the fake status bar (9:41), the accent-color dots in the panel, "Replay splash" button, the hub `prototype/index.html`.

Global facts:
- App name: **Cinetor**. Developer line: **Developed by Mythbrix**.
- Version shown in About = real app version from the build (not 5.3.3).
- Theme default: flat dark, neutral white accent. Optional theme: **Liquid glass** (mobile + desktop only, never TV).
- Adult content: TMDB requests always use `include_adult=false`. The "Adult section" is a PIN-gated genre feed (horror/thriller/romance movies), never explicit content.
- Video & Media: Real streaming media powered by the Cloudflare Edge Gateway (`cinetor-api`) connecting Live TV HLS streams, YouTube Music, and verified multi-provider resolvers. Zero mock video.

---

## A. Mobile shell (Android phone + phone browsers incl. iOS)

### A1. App frame
- Edge-to-edge: content draws under status bar and gesture bar; use `env(safe-area-inset-*)` paddings. Status bar icons light.
- Splash: Cinetor C-mark draws itself, play arrow pops, letters C I N E T O R fade in one by one, tagline "Watch · Read · Listen", thin loader line, "Developed by Mythbrix". ~2.6 s, then fade. (Prototype: `playSplash()`.)
- Bottom nav, 5 tabs: Home, Anime, Drama, TV, Settings. Custom SVG icons from `SVP` (home, anime sparkle, drama masks, tv); Settings uses the cog icon. Active tab = pill behind icon.

### A2. Top banner (sticky)
- Sticky bar that does NOT scroll: ≡ menu (left), C-mark + "CINE**TOR**" wordmark (center), search (right). Shown on Home, Anime, Drama, Comics, Adult. (Prototype: `carTop`, CSS `.bbar`.)
- Settings header has the title only, no search icon.

### A3. Side menu (≡)
- Compact 228 px glass panel, slides in from left. Header: logo tile, "CINETOR", "Watch · Read · Listen", close ✕.
- Group "Discover": Music, Comics, Adult Section. Adult Section appears ONLY when enabled in Settings (PIN). No search, no "Your space", no Settings in the menu.

### A4. Feeds (Home, Anime, Drama, Comics, Adult)
- Order: banner → (Drama: option chips K-Drama / C-Drama / J-Drama / Pakistani Drama; Comics: Manga / Manhwa / Manhua) → hero card carousel → genre category chips → rows.
- Hero card carousel (`carousel`, `carSet`, `movieCard`): 7 cards, center card + peeking neighbours, auto-advance every **4 s**, transition **1.1 s cubic-bezier(.25,.6,.3,1)**, z-index transitions, soft edge fade, drag/swipe to move, tapping a neighbour centers it. Card: poster/backdrop, TMDB rating + "TMDB" label + year, 3 genre chips, buttons Play (opens Info) and "+ My" (My Library). Comics card button = Read.
- Category chips: full TMDB genre list per section (`GEN` object in prototype). Selecting a genre shows a grid of real titles of that genre; "All" shows rows.
- Home: "Continue watching" row with ✕ on each card and "Clear all".
- Rows: special rows (Top 10 today, Because you watched …, Recently added, Critically acclaimed, Hidden gems, Binge-worthy, Award winners, Leaving soon, Staff picks) + one row per genre. Every row has "View all" → list page with grid/list toggle.
- Every poster shows a TMDB rating badge (★ 7.4) top-left; Adult posters also show an 18+ tag top-right.

### A5. Info (details) page
- Opens from any poster. Trailer autoplays MUTED inside the top thumbnail area after ~1 s (YouTube trailer key from TMDB `videos`); NO player bar, NO mute button, NO duration badge on it.
- Big round Play button on the thumbnail → plays the mock video INLINE in the same thumbnail area (portrait player), page scrolls to top.
- Metadata: title, ★ rating + "TMDB", year, maturity, runtime, quality, tagline, synopsis with Read more, genre chips, Details table.
- Actions row: Play, My Library, Download. (No Search/Explore/Trailer/Share/Web.)
- Cast row with real photos + names + characters → Person page with two segments **Movies** and **Series** (grids).
- Series: season selector, episode list with thumbnail, name, runtime, **watch progress bar + "NN% watched"**, My Library icon and Download icon per episode. Movies: no season/episode section.
- "For you" row.
- Comics Info: Read / Continue reading button, no trailer, Chapters list with "Page 6 of 12 · 50% read" + progress bar, PDF download icon per chapter.

### A6. Player (mobile) — prototype `vcore`, `ctlRowP`, `pipHtml`
Portrait inline (in Info thumbnail):
- Top-left back; **top-right: background play, quality (HD), speed (1×), PiP, ⋮**; **right-middle: lock**; center: rewind-10 / play-pause / forward-10 (custom SVG icons `rew10`, `fwd10`); **bottom-left: subtitles, episodes (series only), previous, next**; bottom: time, seek bar, duration, fullscreen.
- Swipe down on the video → PiP. Swipe up → fullscreen landscape.
- NO brightness/volume gestures in portrait.
Landscape fullscreen:
- Left-middle lock, right-middle background play, top-right quality / speed / PiP / ⋮, bottom-left subtitles / audio / resize / server / episodes / prev / next, seek bar, fullscreen-exit.
- **Brightness gesture** (vertical drag on left half) and **volume gesture** (vertical drag on right half), with an on-screen level pill. Native APK: real system brightness/volume. Browser: see `docs/05-player.md`.
- Lock hides all controls except the lock button.
PiP: floating 176 px window, draggable anywhere, survives navigation, hover/tap shows expand / play-pause / close.
⋮ sheet: audio delay ±100 ms, subtitle delay ±100 ms, audio, server, resize, subtitle style, background play, decoder HW/SW. All icon-led, no long text.
Series settings: audio, quality and subtitle choices are remembered per series and applied to every season/episode, including next/previous/auto-next. Next/previous cross season boundaries.
No cast button anywhere.

### A7. Subtitles
- Sheet: Off, available tracks, "Generate on this device" (16 languages: English, German, Bangla, Japanese, Chinese, Hindi, Spanish, French, Arabic, Korean, Russian, Portuguese, Turkish, Italian, Indonesian, Urdu) with % progress pill on the video, then auto-select; "Search online" sub-sheet (search input + results list) .
- Style: size (50–220 %), color (6), stroke none/outline/shadow/glow + width 0–5 px, placement top/middle/bottom + offset, background none/soft/solid, live preview. Also reachable in Settings › Player settings › Subtitle style.
- With mock media, generation is simulated: it produces a WebVTT track from the bundled sample text (see `docs/05-player.md`).

### A8. Downloads (mobile)
- Download sheet: Season chips (**Season 1 pre-selected**, other seasons start empty, selection remembered per season), episode checkboxes, quality 2160/1080/720/480/360 with sizes, audio dub list (Original, English, Hindi, Bangla, Spanish, Japanese, Korean, German, French, Chinese dub). Comics: chapters only, saved as PDF.
- Quality and dub chosen are remembered **until the app is closed** (in memory only).
- On start: popup "Download started · N items · 1080p  [View]" → tapping opens Downloads.
- Downloads page: Save location card (path, Change folder, explanation), Parallel connections 16 / 32 / 64, Downloading list (progress, MB/s, pause/resume, cancel), Pause all / Resume all, Downloaded list with file path.
- Files: videos in the main folder; Comics → `Comics/` as PDF; Music → `Music/` as MP3. Default folder `Download/Cinetor/`.
- External downloader option (Preferences): sends the URL to another app instead of the built-in engine.
Details: `docs/06-media-and-downloads.md`.

### A9. Settings
- Library & Downloads: My Library, Downloads.
- Parental control: Adult section (switch → create PIN + confirm; on = PIN on every entry; Change PIN; turn off needs PIN).
- Options: Appearance (Liquid glass switch, accent swatches, launcher icon swatches, dynamic info accent), Player settings (control layout, subtitle style, opening videos, playback, ambient light, external player, notification controls, hide seek buttons), Preferences (as prototype `V.prefs`).
- Data management: sync, clear watch progress (dialog), clear cache, export/restore backup, erase everything (dialog).
- About: version, Check for updates, auto install updates, check on startup, logs, "Developed by Mythbrix".
- No Provider Manager, no Integrations / TMDB key screen.

### A10. Other sections
- TV tab: segmented Live TV | Sports. Live TV: category chips + channel grid (mock channels play the mock clip as LIVE). Sports: Sportzfy-style feed using APP THEME COLORS ONLY — marquee, favorites star, sport circles with count badges, tabs Recent/Live/Upcoming/All/Highlights with counts, compact match cards (no overlapping text), match page (video, VS card, Info/Stats/Lineups, More live now). Data = mock JSON.
- Music (from menu): Spotify-style layout — genre chips, shortcut tiles, Made for you, Recently played, Browse all, mini player, Now playing screen with download.
- Comics (from menu): see A4/A5; reader with vertical pages, floating "6 / 12" pill bottom-center, progress line, prev/next chapter, resume.
- Search: live search (TMDB `search/multi`).
- My Library: saved titles grid.
- Adult Section: PIN screen on every entry, then a feed like Home.

### A11. Update prompt
- On start (and every 6 h) check for a newer release. Dialog: new version, notes, size, [Update now] [Later]. Update now downloads the APK with progress and opens the system installer. Web: "New version available · Reload". Details `docs/08-updates-and-release.md`.

---

## B. Desktop shell (wide browsers) — prototype `prototype/web/index.html`
- Sticky glass top bar: C-mark + CINETOR, nav (Home, Anime, Drama, TV, Music, Comics, Adult only if enabled, My Library, Downloads), back, phone icon (switch to mobile shell), search, settings.
- Hero: backdrop crossfade every 4.5 s, title, TMDB rating, overview, Play / Details / My List, dots.
- Genre chips WRAP (all visible, no hidden horizontal scroll). Rows have ‹ › arrow buttons and visible thin scrollbars; Shift+wheel scrolls.
- Detail page: muted YouTube trailer, metadata, cast → person (Movies/Series), real seasons + episode stills + watch bars, More like this, Download sheet.
- Comics: reading mode (Read / Continue reading, reader overlay, chapter progress), no Play.
- Player overlay: same control set as mobile landscape; keyboard: Space, ←/→ 10 s, Esc.
- Downloads with real folder writing through File System Access API where available; popup with View.
- Auto-switch: viewport < 700 px → mobile shell; `?desktop` forces desktop.

---

## C. TV shell — prototype `prototype/tv/index.html` (must be ULTRA LIGHT)
- Left sidebar: Search, Home, Anime, Drama, TV, Music, My Library, Settings (+ Adult only if enabled). No Comics. No Downloads at all.
- D-pad spatial navigation; focus = white outline (no scale, no shadow, no transition).
- Remote keys: Back (keyCode 4, Escape, Backspace, GoBack, XF86Back, 461, 10009), OK (Enter/23/66), arrows (19–22, 37–40), media play/pause (85/179/415), rewind (89/412), fast-forward (90/417).
- Every sub-page has a visible Back button at top; Back on a root page → focus sidebar → second Back → Home.
- Home: hero, genre chips, Continue watching (Delete key removes), rows with **See all in the row header** (right side).
- TV section: Live TV = channel rows per category (See all in header); Sports = Android-style (circles, tabs, cards).
- Info: hero, cast with photos → person page (Movies/Series), seasons/episodes with watch bars, For you.
- Player: ALWAYS fullscreen, no inline/portrait player, no PiP. Controls: back, title S/E, quality; center rewind/play/forward; bottom subtitles (+generate on device), audio, episodes, prev, next; seek bar (←/→ 10 s when focused). Auto-hide after 4 s. Series settings remembered.
- Settings: Adult section (PIN), About (Developed by Mythbrix). No liquid glass, no theme switch.
- Must run smoothly on low-spec TVs: see `docs/09-performance-budgets.md`.
