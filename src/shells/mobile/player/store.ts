// Player store + one shared <video> element (created once, moved between inline / fullscreen / PiP).
import { initialState, next as nextR, prev as prevR, type PlayerState, type Seasons, MOCK_SEASONS } from '../../../core/player-model';
import { createStore } from '../../../core/store';
import type { Title } from '../../../core/tmdb';
import type { Quality } from '../../../core/series-settings';
import { cur, library, series } from '../state';
import { isNative } from '../../../core/platform';
import { fetchStream } from '../../../core/stream-resolver';
import { pickChannel } from '../../../core/live';
import { cancelPlay, playUrl } from '../../../core/playback';
import { playDirect } from '../../../core/direct-play';
import type { MediaSrc } from '../../../core/sources';
import { EmbedSession, ERR_NONE } from '../../../core/embed-session';
import type { Embed } from '../../../core/embeds';

export interface Pl {
  active: boolean;
  pip: boolean;
  px: number | null;
  py: number | null;
  live: boolean;
  hue: number;
  title: Title | null;
  /** live channel / match label when `live` */
  label: string;
  st: PlayerState;
  seasons: Seasons;
  /** subtitle tracks that exist per title id: generated / online / embedded */
  tracks: Record<number, { code: string; src: 'auto' | 'online' | 'emb' }[]>;
  gen: { titleId: number; code: string; p: number } | null;
  /** set when playing a downloaded file (offline) */
  local: string | null;
  embedUrl: string | null;
  /** every embed player for the title (automatic failover, never shown) + the one in use */
  embeds: Embed[];
  alt: number;
  /** set when nothing could be played (never leave a black screen) */
  err: string | null;
  loading: boolean;
}
export const pl = createStore<Pl>('pl', {
  active: false, pip: false, px: null, py: null, live: false, hue: 215, title: null, label: '',
  st: initialState({ titleId: 0, title: '', mediaType: 'movie' }), seasons: MOCK_SEASONS, tracks: {}, gen: null, local: null,
  embedUrl: null, embeds: [], alt: 0, err: null, loading: false
}, false);
/** Position ticks live in their own store so only the seek bar re-renders. */
export const ptime = createStore('ptime', { pos: 0, dur: 0 }, false);
/** Controls visibility: tap empty space toggles, auto-hide 3 s after showing while playing. */
export const ctl = createStore('ctl', { hidden: false }, false);
let ctlTimer: ReturnType<typeof setTimeout> | undefined;
export function showCtl() {
  ctl.set({ hidden: false });
  clearTimeout(ctlTimer);
  ctlTimer = setTimeout(() => {
    const s = pl.get();
    if (s.active && s.st.playing && !s.pip) ctl.set({ hidden: true });
  }, 3000);
}
export function toggleCtl() {
  if (ctl.get().hidden) showCtl();
  else (clearTimeout(ctlTimer), ctl.set({ hidden: true }));
}
/** A single tap on the video / empty space toggles the controls (portrait and landscape). */
export function onPlayerTap(e: MouseEvent) {
  const t = e.target as HTMLElement;
  if (t.closest('.pi,.ibtn,.sk,.big,.ptrk,.seek,.grp,.sheet,.scrim,.genpill,.vg-pill,.vg-btn,.vg-back,.vg-fs,.vg-play,.vg-seekbtn,.vg-trk,.vg-time,.vg-err')) return showCtl();
  toggleCtl();
}

let video: HTMLVideoElement | null = null;
export function getVideo(): HTMLVideoElement {
  if (video) return video;
  const v = document.createElement('video');
  v.playsInline = true;
  v.preload = 'auto';
  v.setAttribute('playsinline', '');
  v.addEventListener('timeupdate', onTime);
  v.addEventListener('loadedmetadata', () => {
    ptime.set({ dur: v.duration || 0 });
    patch({ dur: v.duration || 0 });
  });
  v.addEventListener('ended', () => {
    const s = pl.get();
    if (s.live) return;
    if (s.st.mediaType === 'tv') next();
    else patch({ playing: false });
  });
  v.addEventListener('playing', () => (pl.set({ loading: false, err: null }), patch({ playing: true })));
  v.addEventListener('pause', () => pl.get().st.playing && !starting && patch({ playing: false }));
  v.addEventListener('waiting', () => pl.get().active && !pl.get().embedUrl && pl.set({ loading: true }));
  v.addEventListener('canplay', () => !starting && pl.set({ loading: false }));
  v.addEventListener('error', () => {
    if (starting || !v.getAttribute('src')) return; // start-up errors are handled by playUrl; '' = cleared on purpose
    const s = pl.get();
    if (s.live || s.local) return pl.set({ loading: false, err: s.live ? 'This channel stopped. Tap Retry.' : 'This file could not be played' });
    if (s.embeds.length) return playEmbeds(0); // direct file failed mid-way: fall back to the embed players
    pl.set({ loading: false, err: ERR_NONE });
  });
  video = v;
  return v;
}

let lastSave = 0;
function onTime() {
  const v = getVideo(), s = pl.get();
  ptime.set({ pos: v.currentTime, dur: v.duration || 0 });
  if (!s.live && s.title && Date.now() - lastSave > 3000 && v.duration) {
    lastSave = Date.now();
    library.setProgress(s.title, s.st.season, s.st.episode, v.currentTime / v.duration);
  }
}

export function patch(p: Partial<PlayerState>) {
  const s = pl.get();
  pl.set({ st: { ...s.st, ...p } });
  if ('playing' in p) keepAwake(!!p.playing);
}
/** Keep the screen on while playing (APK). */
function keepAwake(on: boolean) {
  if (!isNative()) return;
  void import('../../../native/cinetor-native').then(({ CinetorNative }) => CinetorNative.keepScreenOn({ on }).catch(() => {}));
}

function load(q: Quality, at = 0, play = true) {
  const local = pl.get().local;
  if (!local) return;
  const v = getVideo();
  if (v.src !== local) v.src = local;
  const seek = () => {
    try {
      v.currentTime = at;
    } catch {}
  };
  if (v.readyState >= 1) seek();
  else v.addEventListener('loadedmetadata', seek, { once: true });
  v.playbackRate = pl.get().st.speed;
  if (play) v.play().then(() => keepAwake(true), () => patch({ playing: false }));
}

let currentResolveKey = '';
/** true while playUrl is trying engines (its own timeouts decide; the <video> error listener stays quiet) */
let starting = false;
/** Start direct media (one live URL, or a title's ranked files one after another) with engine fallback
 * + timeout; `onFail` runs when nothing produced frames. */
function startDirect(src: string | MediaSrc[], at: number, onFail: (why: string) => void) {
  const v = getVideo();
  starting = true;
  v.playbackRate = pl.get().st.speed;
  const key = currentResolveKey;
  const run = typeof src === 'string' ? playUrl(v, src, { at, timeoutMs: 15000 }) : playDirect(v, src, { at, alive: () => currentResolveKey === key });
  run.then(
    () => {
      starting = false;
      v.playbackRate = pl.get().st.speed;
      pl.set({ loading: false, err: null });
      if (v.paused) patch({ playing: false }); // autoplay blocked: show Play, the user taps it
      else keepAwake(true);
    },
    (e: Error) => {
      if (e.message === 'cancelled') return;
      starting = false;
      onFail(e.message);
    }
  );
}

/** Prototype `startAt`: start a title/episode with the series memory applied. */
export function startAt(t: Title, season: number, episode: number, o: { seasons?: Seasons; hue?: number; local?: string } = {}) {
  const keep = pl.get().st, mem = series.load(t.id);
  const st = initialState({
    titleId: t.id, title: t.title, mediaType: t.mediaType, season, episode, speed: keep.speed, fit: keep.fit, hwDecoder: keep.hwDecoder,
    quality: mem.quality, audio: mem.audio, sub: mem.sub, mode: 'inline',
  });
  pl.set({
    active: true, pip: false, live: false, title: t, label: '', hue: o.hue ?? pl.get().hue,
    st, seasons: o.seasons || pl.get().seasons, local: o.local || null, embedUrl: null, embeds: [], alt: 0, err: null, loading: !o.local
  });
  const resume = library.progress(t.id, season, episode);
  const atPos = resume > 0.02 && resume < 0.97 ? resume * 120 : 0;
  const v0 = getVideo();
  cancelPlay(v0); // also drops an hls.js instance left from a live channel
  stopEmbeds(); // a pending failover of the previous title must not touch this one

  if (o.local) {
    load(st.quality, atPos);
    return;
  }

  const key = `${t.id}:${season}:${episode}`;
  currentResolveKey = key;
  void fetchStream(t.id, t.title, t.mediaType, season, episode).then((res) => {
    if (currentResolveKey !== key) return;
    if (!res) return pl.set({ loading: false, err: 'Could not load this title. Check your connection.' });
    pl.set({ embeds: res.embeds, alt: 0 });
    if (res.direct.length) {
      // real media files (v2 path): play them in the shared <video>; if none gets frames, use the embed players
      startDirect(res.direct, atPos, () => {
        if (currentResolveKey !== key) return;
        if (res.embeds.length) playEmbeds(0);
        else pl.set({ loading: false, err: ERR_NONE });
      });
      return;
    }
    playEmbeds(0);
  });
}

/** An embed page that shows no sign of life after this long: shown anyway when its host answered,
 * replaced by the next untried player when it did not (core/embed-session.ts). */
export const EMBED_LOAD_MS = 15000;
let session: EmbedSession | null = null;
/** The embed guard inside the iframe (APK) reports ready / playing / blocked. */
if (typeof addEventListener === 'function') addEventListener('message', (e: MessageEvent) => session?.message(e.data));

/** Embed players for the current title, starting at `i` (automatic failover). */
function playEmbeds(i: number, fresh = false) {
  starting = false;
  cancelPlay(getVideo());
  const list = pl.get().embeds;
  if (!session || session.embeds !== list) {
    session?.stop();
    session = new EmbedSession(list, (v) => pl.set(v), { loadMs: EMBED_LOAD_MS });
  }
  session.start(i, fresh);
}
function stopEmbeds() {
  session?.stop();
  session = null;
}
/** VideoHost calls this when the iframe fired `load` (the page answered). */
export function embedLoaded() {
  session?.loaded();
}
/** Start the current title again (after an error). */
export function retryPlay() {
  const s = pl.get();
  if (s.live) return startLive(s.label, s.hue);
  if (s.title) startAt(s.title, s.st.season, s.st.episode, { hue: s.hue });
}

/** Live channel / match: plays the real live HLS stream (native HLS, hls.js, or hls.js via the gateway proxy). */
export function startLive(label: string, hue: number, streamUrl?: string) {
  const channel = pickChannel(label);
  const url = streamUrl || channel?.[5] || '';
  const st = initialState({ titleId: -1, title: label, mediaType: 'live', quality: 720, mode: 'fullscreen' });
  stopEmbeds();
  currentResolveKey = '';
  pl.set({ active: true, pip: false, live: true, title: null, label, hue, st, local: null, embedUrl: null, embeds: [], alt: 0, err: null, loading: true });
  if (!url) return pl.set({ loading: false, err: 'No channel to play' });
  startDirect(url, 0, () => pl.set({ loading: false, err: 'This channel is offline right now. Try another channel.' }));
}

export function togglePlay() {
  const v = getVideo(), s = pl.get().st;
  if (s.playing) v.pause();
  else v.play().catch(() => {});
  patch({ playing: !s.playing });
}
export function seekBy(d: number) {
  const v = getVideo();
  const wasPlaying = pl.get().st.playing;
  v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
  if (wasPlaying && v.paused) void v.play().catch(() => {});
}
export function seekTo(t: number) {
  const v = getVideo();
  const wasPlaying = pl.get().st.playing;
  v.currentTime = Math.max(0, Math.min(v.duration || t, t));
  ptime.set({ pos: v.currentTime });
  if (wasPlaying && v.paused) void v.play().catch(() => {});
  showCtl();
}
export function seekFrac(f: number) {
  const v = getVideo();
  const wasPlaying = pl.get().st.playing;
  if (v.duration) v.currentTime = Math.max(0, Math.min(1, f)) * v.duration;
  if (wasPlaying && v.paused) void v.play().catch(() => {});
}
export function setQuality(q: Quality) {
  const v = getVideo(), at = v.currentTime, playing = pl.get().st.playing;
  patch({ quality: q });
  saveSeries();
  if (!pl.get().local) load(q, at, playing); // a downloaded file has one quality
}
export function setSpeed(sp: PlayerState['speed']) {
  patch({ speed: sp });
  getVideo().playbackRate = sp;
}
export function saveSeries() {
  const s = pl.get();
  if (s.title && !s.live) series.save(s.title.id, { quality: s.st.quality, audio: s.st.audio, sub: s.st.sub });
}
function goEp(st: PlayerState) {
  const s = pl.get();
  if (!s.title) return;
  if (st.season === s.st.season && st.episode === s.st.episode) {
    if (st.pos === 0) seekFrac(0);
    if (!st.playing) (getVideo().pause(), patch({ playing: false }));
    return;
  }
  startAt(s.title, st.season, st.episode);
}
export const next = () => goEp(nextR({ ...pl.get().st, pos: ptime.get().pos }, pl.get().seasons));
export const prev = () => goEp(prevR({ ...pl.get().st, pos: ptime.get().pos }, pl.get().seasons));

export function stop() {
  const v = getVideo();
  starting = false;
  currentResolveKey = '';
  stopEmbeds();
  cancelPlay(v); // also releases the decoder
  pl.set({ active: false, pip: false, embedUrl: null, embeds: [], err: null, loading: false });
  keepAwake(false);
}
export function toPip() {
  pl.set({ pip: true });
  patch({ mode: 'pip', locked: false });
}

/** Hardware Back on the player: PiP closes first, then a fullscreen/inline player stops. */
export function closePlayerForBack(): boolean {
  const s = pl.get();
  if (!s.active) return false;
  if (s.pip || cur().name === 'info') {
    stop(); // PiP first, then the inline player on Info
    return true;
  }
  return false; // the fullscreen player is a route; the router pops it
}
