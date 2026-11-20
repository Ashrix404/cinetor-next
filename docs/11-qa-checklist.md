# 11 — QA checklist (run on real devices before every release)

Use the preview link (web), the debug APKs from CI, and the release APKs. Tick each item with the platform letters that passed: P = phone APK, W = web mobile (Android Chrome), I = iPhone Safari, D = desktop browser, T = TV APK.

## General
- [ ] Splash plays once and the app opens (P W I D T)
- [ ] Edge-to-edge: no white bars, content under the status bar is readable, the bottom nav sits above the gesture bar (P W I)
- [ ] TMDB down (airplane mode after the first launch): the cached feed shows, plus an error card with Retry (P W D T)
- [ ] Back: closes sheet → PiP → player → page; on the root, "Press back again to exit" (P T)

## Feeds
- [ ] Hero carousel: 4 s auto, smooth, drag works, neighbor tap centers it (P W I)
- [ ] Desktop hero crossfade, chips wrap, row arrows (D)
- [ ] Every poster shows a TMDB rating badge (P W I D T)
- [ ] Category chip shows a grid of that genre (P W I D T)
- [ ] Continue watching ✕ and Clear all (P W D), Delete key (T)
- [ ] View all / See all opens a full list (P W I D T)

## Info
- [ ] Muted trailer autoplays without a bar or mute button (P W I D); there is no trailer on TV (T)
- [ ] Cast photos → Person → Movies / Series segments (P W I D T)
- [ ] Episodes: watch progress bar + % updates after watching (P W I D T)

## Player
- [ ] Portrait control positions match `docs/05-player.md` (P W I)
- [ ] Swipe down → PiP, swipe up → fullscreen (P W I)
- [ ] PiP drags anywhere and survives navigation (P W I D)
- [ ] Fullscreen brightness/volume gestures: the real system values change (P); video-only brightness and volume (W I)
- [ ] Lock hides everything but the lock (P W I D)
- [ ] Quality/audio/subtitle choice carries to the next episode and the next season (P W I D T)
- [ ] Subtitles: generate (progress pill), online search, style editor (P W I D); generate (T)
- [ ] TV: OK, arrows, Back, play/pause, rewind and fast-forward remote keys (T)

## Downloads (not on TV)
- [ ] Sheet: S1 pre-selected, S2 empty, per-season memory; quality and dub remembered until a cold start (P W D)
- [ ] Popup "Download started · View" opens Downloads (P W D)
- [ ] 16/32/64 changes speed (P), pause/resume, survives app restart as paused (P)
- [ ] Files land in Download/Cinetor, Comics/*.pdf, Music/*.mp3; a changed folder is used (P D)
- [ ] External downloader opens the chooser (P), the intent (W), the share sheet (I)

## Settings / Adult / Updates
- [ ] Adult hidden until enabled; PIN create, confirm, every entry, wrong PIN, change, off (P W I D T)
- [ ] Liquid glass on/off with no freeze (P W I D); no glass option on TV (T)
- [ ] About shows the real version and "Developed by Mythbrix" (P W I D T)
- [ ] Update: install v0.1.0, release v0.1.1 → prompt → download → system installer → app updated, data kept (P T)
- [ ] Wrong sha256 (test build) → "Update failed", the installer never opens (P)
- [ ] Web: new deploy → "New version available · Reload" (W I D)

## Low-spec TV (`docs/09-performance-budgets.md` §Manual check)
- [ ] Cold start < 3 s, warm < 1.5 s
- [ ] Holding an arrow for 5 s: no freeze
- [ ] 3× play/back rounds: memory is stable
- [ ] armeabi-v7a and arm64-v8a APKs both install and run
