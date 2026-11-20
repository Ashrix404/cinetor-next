// Direct media playback for every shell: native <video>, hls.js (loaded on demand), and the gateway
// proxy for streams that do not send CORS headers. Each attempt has a timeout, so a dead stream
// never leaves the player waiting forever.
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

// ---- hls.js loader -------------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
type HlsCtor = any; // hls.js is loaded at runtime from the CDN; no type package is bundled
let hlsP: Promise<HlsCtor> | null = null;
export function loadHlsJs(): Promise<HlsCtor> {
  const w = globalThis as any;
  if (w.Hls) return Promise.resolve(w.Hls);
  if (hlsP) return hlsP;
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

let token = 0;
/**
 * Play `url` in `v`, trying each engine in order with a timeout. Resolves with the engine that
 * produced frames; rejects when every engine failed (caller shows the error card / next embed player).
 * A newer call cancels an older one (its promise rejects with 'cancelled').
 */
export async function playUrl(
  v: HTMLVideoElement,
  url: string,
  o: { at?: number; timeoutMs?: number; autoplay?: boolean; referer?: string } = {}
): Promise<Engine> {
  const my = ++token;
  const ms = o.timeoutMs ?? 15000;
  let last: Error = new Error('no engine');
  for (const eng of enginesFor(url, mediaEnv(v))) {
    if (my !== token) throw new Error('cancelled');
    detach(v);
    try {
      let fatal: (e: Error) => void = () => {};
      if (eng === 'native') {
        v.src = url;
      } else {
        const Hls = await loadHlsJs();
        if (my !== token) throw new Error('cancelled');
        if (!Hls.isSupported()) throw new Error('hls.js unsupported');
        hls = new Hls(eng === 'hls-proxy' ? { loader: proxyLoader(Hls, o.referer), enableWorker: true } : { enableWorker: true });
        hls.on(Hls.Events.ERROR, (_e: unknown, d: any) => d?.fatal && fatal(new Error('hls ' + d.details)));
        hls.loadSource(url);
        hls.attachMedia(v);
      }
      if (o.at && o.at > 1) {
        const seek = () => {
          try {
            v.currentTime = o.at!;
          } catch {
            /* not seekable yet */
          }
        };
        v.addEventListener('loadedmetadata', seek, { once: true });
      }
      if (o.autoplay !== false) void v.play().catch(() => {});
      await waitFrames(v, ms, (cb) => (fatal = cb));
      if (my !== token) throw new Error('cancelled');
      return eng;
    } catch (e) {
      last = e as Error;
      if (last.message === 'cancelled') throw last;
    }
  }
  if (my === token) detach(v);
  throw last;
}

/** Cancel a pending playUrl (e.g. the player closed or switched to an embed). */
export function cancelPlay(v?: HTMLVideoElement) {
  token++;
  detach(v);
}
