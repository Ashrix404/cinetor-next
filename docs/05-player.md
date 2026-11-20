# 05 — Player, gestures, subtitles

## State (src/core/player-model.ts)

```ts
export interface PlayerState {
  titleId: number; title: string; mediaType: 'movie' | 'tv' | 'live';
  season: number; episode: number;           // 1-based; movies use 1/1
  pos: number; dur: number; playing: boolean; speed: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
  quality: 2160 | 1080 | 720 | 480 | 360;     // mock files exist for 1080/720/480; 2160→1080, 360→480
  audio: string; sub: string;                // sub: 'Off' or language code
  fit: 'Fit' | 'Fill' | 'Zoom'; locked: boolean; bgPlay: boolean;
  mode: 'inline' | 'fullscreen' | 'pip';     // TV: always 'fullscreen'
  audioDelayMs: number; subDelayMs: number; hwDecoder: boolean;
}
```
`next`/`prev` cross seasons the way the prototype `nextEp` and `prevEp` do it (6 mock episodes per season, 3 seasons, or the real season and episode counts from TMDB when they are known). Every change to quality, audio or sub calls `seriesSettings.save(titleId, {quality, audio, sub})`. Starting any episode loads those settings.

## Control layouts (exact)

| Area | Portrait inline (mobile) | Fullscreen (mobile/desktop) | TV fullscreen |
|---|---|---|---|
| Top-left | back (stop inline) | back (exit fullscreen) | back |
| Top-right | bg play, quality, speed, PiP, ⋮ | quality, speed, PiP, ⋮ | quality |
| Left-middle | — | lock | — |
| Right-middle | lock | bg play | — |
| Center | rew10, play/pause, fwd10 | rew10, play/pause, fwd10 | rew10, play/pause, fwd10 |
| Bottom-left | subtitles, episodes*, prev*, next* | subtitles, audio, resize, server, episodes*, prev*, next* | subtitles, audio, episodes*, prev*, next* |
| Bottom | time, seek, duration, fullscreen | time, seek, duration, fullscreen-exit | seek (focusable, ←/→ 10 s) |

`*` = series only (hidden for movies and live). No text labels on controls, icons only. There is no cast button. Use the custom rew10/fwd10 SVG from prototype `SVP`.

## Gestures

- Portrait inline: swipe down → PiP, swipe up → fullscreen. NO brightness/volume gestures here.
- Fullscreen (mobile APK + mobile browsers): vertical drag on the left half = brightness, on the right half = volume. Show a pill with an icon and a % value. Ignore drags that start on a control.

| Platform | Brightness | Volume |
|---|---|---|
| Android APK | `CinetorNative.setBrightness({value})` (window brightness, reset to system on exit) | `CinetorNative.setVolume({value})` (STREAM_MUSIC, no system UI) |
| Android Chrome (web) | CSS: `video{filter:brightness(b)}` with b in 0.3–1.5 plus a dim overlay below 1 | `video.volume = v` |
| iOS Safari (web) | same CSS method | `video.volume` is read-only on iOS. Use Web Audio: `ctx.createMediaElementSource(video)` → `GainNode` → destination. The AudioContext must start inside a user gesture. The video needs `crossOrigin="anonymous"` (GitHub Pages sends `Access-Control-Allow-Origin: *`). |
| Desktop | mouse wheel over the left or right half does the same; keyboard ↑/↓ = volume | same |

Say this in About › Help: in a browser, brightness only changes the video picture, not the phone screen.

## Fullscreen and orientation

- APK: lock landscape with `@capacitor/screen-orientation` `lock({orientation:'landscape'})` on enter and `unlock()` on exit; also hide the status bar.
- Android Chrome: `element.requestFullscreen()` then `screen.orientation.lock('landscape')` (allowed only in fullscreen; catch errors).
- iPhone Safari: `requestFullscreen` on a div is not supported. Use the "pseudo fullscreen" from the prototype (fixed 100dvh overlay) and show a "rotate your phone" hint in portrait. Do NOT call `webkitEnterFullscreen()`, because that drops our controls.
- TV: the player is always fullscreen; `requestFullscreen` is best effort.

## PiP

In-app floating window (prototype `pipHtml`): 176 px wide, 16:9, drag anywhere inside the app, clamp to the viewport. It survives route changes; expand returns to the Info page of that title; close stops. Web bonus (desktop only): a "browser PiP" item in ⋮ that calls `video.requestPictureInPicture()` when supported.

## Background play

- The prototype's headphones button is an audio-only mode (dark overlay with a headphones icon).
- APK: when bgPlay is on and the app goes to the background, playback must continue. Risk: the Android WebView may pause media in `onPause`. T33 must test this. If it pauses, add the plugin method `keepAliveForPlayback(on)` that starts a foreground service with a media notification and tells the bridge to skip `webView.onPause()`. Write the real result in PROGRESS.md.
- Web: register Media Session handlers (play, pause, seekbackward, seekforward, previoustrack, nexttrack) and set metadata with the poster. Browsers may still pause when hidden; that is accepted.

## Quality, audio, server, resize

- Quality switch = change `video.src` to `clip-<q>p.mp4`, then restore `currentTime` and the playing state.
- Audio tracks: mock clips have one track. The audio menu is UI-only and is remembered per series. Do not pretend to switch real tracks.
- Server: UI-only list (1, 2, 3).
- Resize: CSS `object-fit` contain / cover / zoom (`transform: scale(1.25)`).

## Subtitles

- Tracks are WebVTT files in `media/subtitles/<lang>.vtt`, loaded as `<track>`, and rendered by our own overlay (not the browser), so the style editor works everywhere.
- "Generate on this device" = `simulateGeneration(lang)`: progress 0→100 % over about 4 s (pill on the video), then load `<lang>.vtt` and select it. Label it honestly in the code: simulated for the mock build.
- Online search: list built from `media/index.json` subtitle entries filtered by the query; picking one loads that VTT.
- Style model and CSS: port prototype `subCss` (size 50–220 %, 6 colors, stroke none/outline/shadow/glow with width 0–5, placement top/middle/bottom with offset −40..80, background 0/40/80).
