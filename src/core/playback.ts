// Direct media playback for every shell: native <video>, hls.js (loaded on demand), and the gateway
// proxy for streams that do not send CORS headers. Each attempt has a timeout, so a dead stream
// never leaves the player waiting forever. Automatic HLS.js error recovery, seamless engine failover,
// and timestamp preservation across engine and server switches.
import { GATEWAY_BASE } from './config';

/** hls.js 1.7.4 (verified on npm 2026-11-20). Loaded from jsDelivr only when the browser has no native
 * HLS, so the bundles stay inside their size budgets. The SRI hash pins the exact npm file. */
export const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.light.min.js';
export const HLS_JS_SRI = 'sha384-vpNtFjJmrPAaL9LfqByx3MxTVjqrtQ6Ue6UVNnFeghNrhE0uvpydDr3tkTVcBgDz';

export type Engine = 'native' | 'hls' | 'hls-proxy';

export const isHlsUrl = (u: string) => /\.m3u8(\?|#|$)/i.test(u || '') || /\/(playlist|manifest|master)(\?|$)/i.test(u || '');

/** Gateway proxy URL (adds CORS + Referer). `fresh` defeats the proxy's 1 h cache for live playlists. */
export function proxify(url: string, referer?: string, fresh = false): string {
  let ref = referer;
  if (!ref) {
    try {
      ref = new URL(url).origin + '/';
    } catch {
      ref = '';
    }
  }
  return `${GATEWAY_BASE}/v1/proxy?url=${encodeURIComponent(url)}` + (ref ? `&referer=${encodeURIComponent(ref)}` : '') + (fresh ? `&_=${Date.now()}` : '');
}

/** Order of engines to try for one URL. Pure, so it is unit tested.
 * - mp4 & co.: native only (a <video> needs no CORS).
 * - HLS with native support (Safari, Android WebView/Chrome): native first, then hls.js, then hls.js via the proxy.
 * - HLS without native support (desktop Chrome/Firefox): hls.js, then hls.js via the proxy.
 * Probe 2026-11-20: some CDNs send no CORS header (Ekushey, 30A, beIN, CNN segments) -> only the proxy
 * works in hls.js; some fail native (Cricket Gold, Rajdhani) -> hls.js works. Hence all three, in order. */
export function enginesFor(url: string, env: { nativeHls: boolean; mse: boolean }): Engine[] {
  if (!isHlsUrl(url)) return ['native'];
  const out: Engine[] = [];
  if (env.nativeHls) out.push('native');
  if (env.mse) out.push('hls');
  if (env.mse) out.push('hls-proxy');
  return out.length ? out : ['native'];
}

export function mediaEnv(v: HTMLVideoElement) {
  const nativeHls = !!v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl') !== '';
  const g = globalThis as unknown as { MediaSource?: { isTypeSupported?(t: string): boolean }; ManagedMediaSource?: unknown };
  const mse = !!(g.MediaSource?.isTypeSupported?.('video/mp4; codecs="avc1.42E01E,mp4a.40.2"') || g.ManagedMediaSource);
  return { nativeHls, mse };
}

// ---- Timestamp Preservation Helpers -------------------------------------------------------------
/** Safely extract current timestamp from a video element, or return fallback. */
export function preserveTimestamp(v?: HTMLVideoElement | null, fallback = 0): number {
  if (!v) return fallback;
  try {
    const cur = v.currentTime;
    if (typeof cur === 'number' && !isNaN(cur) && cur > 0) {
      return cur;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Restore playback timestamp onto a video element once metadata or canplay is available. */
export function restoreTimestamp(v: HTMLVideoElement, at: number): void {
  if (!v || typeof at !== 'number' || isNaN(at) || at <= 0) return;
  const seek = () => {
    try {
      if (Math.abs(v.currentTime - at) > 0.3) {
        v.currentTime = at;
      }
    } catch {
      /* not seekable yet */
    }
  };
  if (v.readyState >= 1) {
    seek();
  } else {
    v.addEventListener('loadedmetadata', seek, { once: true });
    v.addEventListener('canplay', seek, { once: true });
  }
}

// ---- hls.js loader -------------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
type HlsCtor = any; // hls.js is loaded at runtime from the CDN; no type package is bundled
let hlsP: Promise<HlsCtor> | null = null;
export function loadHlsJs(): Promise<HlsCtor> {
  const w = globalThis as any;
  if (w.Hls) return Promise.resolve(w.Hls);
  if (hlsP) return hlsP;
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));
  hlsP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = HLS_JS_URL;
    s.integrity = HLS_JS_SRI;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = () => (w.Hls ? res(w.Hls) : rej(new Error('hls.js missing')));
    s.onerror = () => {
      hlsP = null;
      rej(new Error('hls.js could not load'));
    };
    document.head.appendChild(s);
  });
  return hlsP;
}

/** hls.js loader class that sends every request through the gateway proxy but keeps the real URL
 * as the base, so relative segment paths still resolve against the stream's host. */
function proxyLoader(Hls: HlsCtor, referer?: string) {
  const Base = Hls.DefaultConfig.loader;
  return class extends Base {
    load(ctx: any, cfg: any, cb: any) {
      const orig = ctx.url;
      ctx.url = proxify(orig, referer, !!ctx.type || isHlsUrl(orig));
      const ok = cb.onSuccess;
      cb.onSuccess = (r: any, st: any, c: any, n: any) => {
        r.url = orig;
        c.url = orig;
        ok(r, st, c, n);
      };
      super.load(ctx, cfg, cb);
    }
  };
}

// ---- attach --------------------------------------------------------------------------------------
let hls: any = null;
let activeEngine: Engine | null = null;

export function getActiveHls() {
  return hls;
}

export function getActiveEngine(): Engine | null {
  return activeEngine;
}

/** Stop any hls.js instance bound to the shared <video>. */
export function detach(v?: HTMLVideoElement) {
  if (hls) {
    try {
      hls.destroy();
    } catch {
      /* already gone */
    }
    hls = null;
  }
  activeEngine = null;
  if (v) {
    v.pause();
    v.removeAttribute('src');
    try {
      v.load();
    } catch {
      /* ignore */
    }
  }
}

/** Resolve when the video has real frames (loadeddata/playing), reject on error or after `ms`. */
function waitFrames(v: HTMLVideoElement, ms: number, onFatal: (cb: (e: Error) => void) => void): Promise<void> {
  return new Promise((res, rej) => {
    let done = false;
    const end = (e?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      v.removeEventListener('loadeddata', okF);
      v.removeEventListener('playing', okF);
      v.removeEventListener('error', errF);
      e ? rej(e) : res();
    };
    const okF = () => end();
    const errF = () => end(new Error('media error ' + (v.error?.code ?? '')));
    const t = setTimeout(() => end(new Error('timeout')), ms);
    v.addEventListener('loadeddata', okF);
    v.addEventListener('playing', okF);
    v.addEventListener('error', errF);
    onFatal((e) => end(e));
    if (v.readyState >= 2) end();
  });
}

export interface PlayUrlOptions {
  at?: number;
  timeoutMs?: number;
  autoplay?: boolean;
  referer?: string;
  stallTimeoutMs?: number;
  onEngineChange?: (engine: Engine) => void;
  onFailover?: (engine: Engine, fromEngine: Engine, err: Error) => void;
  onStall?: () => void;
  onError?: (err: Error) => void;
}
export type PlayOptions = PlayUrlOptions;

let token = 0;

/**
 * Play `url` in `v`, trying each engine in order with a timeout. Resolves with the engine that
 * produced frames; rejects when every engine failed (caller shows the error card / next embed player).
 * Seamlessly fails over from native to hls.js to hls-proxy with automatic recovery and timestamp preservation.
 * A newer call cancels an older one (its promise rejects with 'cancelled').
 */
export async function playUrl(
  v: HTMLVideoElement,
  url: string,
  o: PlayUrlOptions = {}
): Promise<Engine> {
  const my = ++token;
  const ms = o.timeoutMs ?? 15000;
  const stallMs = o.stallTimeoutMs ?? 8000;
  let targetTime = preserveTimestamp(v, o.at ?? 0);
  let last: Error = new Error('no engine');
  let prevEng: Engine | null = null;

  // Track timestamp updates while frames play
  const timeListener = () => {
    if (v.currentTime > 0) {
      targetTime = Math.max(targetTime, v.currentTime);
    }
  };
  v.addEventListener('timeupdate', timeListener);

  try {
    for (const eng of enginesFor(url, mediaEnv(v))) {
      if (my !== token) throw new Error('cancelled');

      // Preserve position right before detaching previous engine
      targetTime = Math.max(targetTime, preserveTimestamp(v));
      detach(v);

      if (prevEng && o.onFailover) {
        try {
          o.onFailover(eng, prevEng, last);
        } catch {
          /* ignore callback error */
        }
      }

      try {
        let fatal: (e: Error) => void = () => {};
        let stallCleanup = () => {};

        if (eng === 'native') {
          activeEngine = 'native';
          v.src = url;
        } else {
          const Hls = await loadHlsJs();
          if (my !== token) throw new Error('cancelled');
          if (!Hls.isSupported()) throw new Error('hls.js unsupported');

          const hlsConfig: any = {
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            startPosition: targetTime > 0 ? targetTime : -1,
          };
          if (eng === 'hls-proxy') {
            hlsConfig.loader = proxyLoader(Hls, o.referer);
          }

          const hlsInstance = new Hls(hlsConfig);
          hls = hlsInstance;
          activeEngine = eng;

          let mediaRecoveries = 0;
          let networkRecoveries = 0;

          hlsInstance.on(Hls.Events.ERROR, (_e: unknown, d: any) => {
            if (!d) return;
            if (d.fatal) {
              if (d.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveries < 2) {
                networkRecoveries++;
                try {
                  hlsInstance.startLoad();
                  return;
                } catch {
                  /* failover */
                }
              } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
                mediaRecoveries++;
                try {
                  hlsInstance.recoverMediaError();
                  return;
                } catch {
                  /* failover */
                }
              }
              fatal(new Error('hls ' + (d.details || d.type)));
            }
          });

          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(v);

          if (targetTime > 0) {
            hlsInstance.once(Hls.Events.MANIFEST_PARSED, () => {
              restoreTimestamp(v, targetTime);
            });
          }
        }

        // Restore target timestamp across metadata/canplay
        if (targetTime > 0) {
          restoreTimestamp(v, targetTime);
        }

        if (o.autoplay !== false) {
          void v.play().catch(() => {});
        }

        // Stall monitoring
        if (stallMs > 0) {
          let stallTimer: any = null;
          const resetStall = () => {
            if (stallTimer) {
              clearTimeout(stallTimer);
              stallTimer = null;
            }
          };
          const onWaiting = () => {
            resetStall();
            stallTimer = setTimeout(() => {
              if (my !== token) return;
              if (hls && (activeEngine === 'hls' || activeEngine === 'hls-proxy')) {
                try {
                  hls.recoverMediaError();
                } catch {
                  /* ignore */
                }
              }
              o.onStall?.();
            }, stallMs);
          };
          v.addEventListener('waiting', onWaiting);
          v.addEventListener('playing', resetStall);
          v.addEventListener('timeupdate', resetStall);
          stallCleanup = () => {
            resetStall();
            v.removeEventListener('waiting', onWaiting);
            v.removeEventListener('playing', resetStall);
            v.removeEventListener('timeupdate', resetStall);
          };
        }

        await waitFrames(v, ms, (cb) => (fatal = cb));
        stallCleanup();

        if (my !== token) throw new Error('cancelled');

        if (targetTime > 0) {
          restoreTimestamp(v, targetTime);
        }
        o.onEngineChange?.(eng);
        prevEng = eng;
        return eng;
      } catch (e) {
        last = e as Error;
        prevEng = eng;
        if (last.message === 'cancelled') throw last;
      }
    }
    if (my === token) detach(v);
    throw last;
  } finally {
    v.removeEventListener('timeupdate', timeListener);
  }
}

/** Cancel a pending playUrl (e.g. the player closed or switched to an embed). */
export function cancelPlay(v?: HTMLVideoElement) {
  token++;
  detach(v);
}
