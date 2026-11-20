// Direct media sources (real .m3u8 / .mp4 files + the headers their CDN wants), ported from the
// Cinetor v2 player (docs/12-player-architecture.md):
// - v2 `GatewaySourceResolver.rankGwSources` / `StreamResolver.rank`: images and adult links are never
//   videos; on Wi-Fi the sharpest file first (1080p, then 1440p/2160p, then 720p and below), on mobile
//   data adaptive HLS first and files nearest 720p; HEVC goes last.
// - v2 `LinkHealth`: a host that refused (403/428/429/451) rests 6 h, a missing file (404/410) is skipped 6 h.
// - v2 web `proxyUrl` / docs/gateway.md: a browser cannot send Referer/Origin, so a source with headers is
//   played through the gateway proxy; the APK plays it directly and the WebView adds the headers
//   (MainActivity media header rules, registered with CinetorNative.setMediaHeaders).
import { proxify } from './playback';

export type Kind = 'hls' | 'mp4';
export interface MediaSrc {
  url: string;
  kind: Kind;
  quality: number;
  name: string;
  headers?: Record<string, string>;
  /** bytes, when the gateway reported it */
  size?: number;
  server?: string;
  serverId?: string;
  proxyUrl?: string;
  isDirect?: boolean;
}

const IMAGE = /\.(jpe?g|png|webp|gif|bmp|svg)$|\/null$/i;
const ADULT = /(porn|xvideos|xnxx|xhamster|redtube|youporn|spankbang|eporner|onlyfans|brazzers|\bsex\b|xxx)/i;
const HEVC = /(x265|hevc|h\.?265|10[ -]?bit|hdr10?\b)/i;

const path = (u: string) => (u || '').split('?')[0];
export const isImageLink = (u: string) => IMAGE.test(path(u)) || path(u).includes('image.tmdb.org');
export const isAdultLink = (u: string) => ADULT.test(path(u));
export const isHevc = (s: Pick<MediaSrc, 'url' | 'name'>) => HEVC.test(s.name + ' ' + path(s.url));
export const kindOf = (url: string, type?: string): Kind =>
  /hls|m3u8/i.test(type || '') || /\.m3u8(\?|#|$)/i.test(url) || /\/(playlist|manifest|master)(\?|$)/i.test(url) ? 'hls' : 'mp4';

export const hostOf = (u: string) => {
  const m = /^[a-z]+:\/\/([^/?#:]+)/i.exec(u || '');
  return m ? m[1].toLowerCase() : '';
};

/** v2 LinkHealth: what playing taught about hosts and files, for this session. */
export class LinkHealth {
  static REST_MS = 6 * 60 * 60 * 1000;
  private hosts = new Map<string, number>();
  private links = new Map<string, number>();
  constructor(private now: () => number = Date.now) {}
  failed(url: string, code: number) {
    const until = this.now() + LinkHealth.REST_MS;
    if ([403, 428, 429, 451].includes(code)) this.hosts.set(hostOf(url), until);
    else if ([404, 410].includes(code)) this.links.set(path(url), until);
  }
  refused(url: string) {
    const t = this.now();
    return (this.hosts.get(hostOf(url)) || 0) > t || (this.links.get(path(url)) || 0) > t;
  }
  reset() {
    this.hosts.clear();
    this.links.clear();
  }
}
export const linkHealth = new LinkHealth();

/** v2 Wi-Fi order: 1080p, 1440p, 2160p, 720p, 480p, 360p, unknown. */
function wifiRank(h: number) {
  if (h >= 1000 && h <= 1300) return 0;
  if (h > 1300 && h <= 1600) return 1;
  if (h > 1600) return 2;
  if (h >= 700) return 3;
  if (h >= 450) return 4;
  if (h >= 1) return 5;
  return 6;
}
/** v2 mobile-data order: 720p, 480p, 1080p, 360p, unknown, the rest. */
function mobileFit(h: number) {
  if (h >= 700 && h <= 800) return 0;
  if (h >= 450 && h <= 600) return 1;
  if (h >= 1000 && h <= 1100) return 2;
  if (h >= 300 && h < 450) return 3;
  if (h === 0) return 4;
  return 5;
}

/** Best first. Refused hosts / dead links drop out unless nothing else is left (v2 `ifEmpty`). */
export function rankSources(list: MediaSrc[], o: { mobile?: boolean; health?: LinkHealth; hevcOk?: boolean } = {}): MediaSrc[] {
  const health = o.health || linkHealth;
  const seen = new Set<string>();
  const uniq = list.filter((s) => s && s.url && !seen.has(s.url) && (seen.add(s.url), true) && !isImageLink(s.url) && !isAdultLink(s.url));
  const usable = uniq.filter((s) => !health.refused(s.url));
  const pool = usable.length ? usable : uniq;
  const key = (s: MediaSrc): number[] =>
    o.mobile ? [s.kind === 'hls' ? 0 : 1, mobileFit(s.quality)] : [wifiRank(s.quality), -s.quality, s.kind === 'hls' ? 1 : 0];
  const sorted = pool.map((s, i) => ({ s, i, k: key(s) })).sort((a, b) => {
    for (let j = 0; j < a.k.length; j++) if (a.k[j] !== b.k[j]) return a.k[j] - b.k[j];
    return a.i - b.i;
  });
  const out = sorted.map((x) => x.s);
  return o.hevcOk ? out : [...out.filter((s) => !isHevc(s)), ...out.filter(isHevc)];
}

/** Gateway JSON source -> MediaSrc (null when it is not a real media file). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw gateway JSON, validated field by field
export function toMediaSrc(x: any, isDirect: (u: string, flag?: boolean) => boolean): MediaSrc | null {
  if (!x || typeof x.url !== 'string' || !isDirect(x.url, x.isDirect)) return null;
  const headers = x.headers && typeof x.headers === 'object' ? (x.headers as Record<string, string>) : undefined;
  const out: MediaSrc = { url: x.url, kind: kindOf(x.url, x.type), quality: Number(x.quality) || 0, name: String(x.name || 'Direct'), headers };
  if (Number(x.size) > 0) out.size = Number(x.size);
  if (x.server) out.server = String(x.server);
  if (x.proxyUrl) out.proxyUrl = String(x.proxyUrl);
  if (typeof x.isDirect === 'boolean') out.isDirect = x.isDirect;
  return out;
}

/** Only these headers matter to a CDN; the rest (User-Agent, Cookie) are the WebView's own business. */
export function cdnHeaders(h?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(h || {})) if (/^(referer|origin)$/i.test(k) && h![k]) out[k.toLowerCase() === 'referer' ? 'Referer' : 'Origin'] = h![k];
  return out;
}

/** What the <video> gets. APK: the file itself (the WebView adds the headers natively).
 * Browser: an MP4 that needs a Referer goes through the gateway proxy (v2 web `proxyUrl`); an HLS
 * playlist stays as it is (relative segment paths must resolve against the CDN) and playUrl's
 * 'hls-proxy' engine sends every request through the proxy with `referer`. */
export function playTarget(s: MediaSrc, native: boolean): { url: string; referer?: string } {
  const ref = cdnHeaders(s.headers).Referer;
  if (native || !ref) return { url: s.url };
  return s.kind === 'hls' ? { url: s.url, referer: ref } : { url: proxify(s.url, ref), referer: ref };
}

/** Gateway / video element errors that tell LinkHealth something (MediaError has no HTTP code). */
export function httpCodeOf(message: string): number {
  const m = /HTTP (\d{3})/.exec(message || '');
  return m ? Number(m[1]) : 0;
}

/** Is the phone on mobile data? (Network Information API; unknown = Wi-Fi, like v2 `NetworkState`). */
export function onMobileData(): boolean {
  const c = (globalThis.navigator as unknown as { connection?: { type?: string; saveData?: boolean } } | undefined)?.connection;
  return !!c && (c.type === 'cellular' || c.saveData === true);
}
