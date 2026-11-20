import { GATEWAY_BASE } from './config';
import { buildEmbeds, timeoutSignal, type Embed } from './embeds';
import { onMobileData, rankSources, toMediaSrc, type MediaSrc } from './sources';

export interface ResolvedStream {
  /** best direct media file ('' when only embed pages exist) = direct[0].url */
  url: string;
  /** every real media file (+ the headers its CDN wants), best first (v2 ranking + LinkHealth) */
  direct: MediaSrc[];
  quality: number;
  slug?: string;
  webPlayUrl?: string;
  embedUrl?: string;
  /** every embed player page (gateway + verified extra players), best first (automatic failover) */
  embeds: Embed[];
  sources: { name: string; quality: number; url: string; type: string; headers?: Record<string, string> }[];
  subtitles: { lang: string; url: string; format: string }[];
}

const DIRECT = /\.(m3u8|mp4|webm|m4v|mkv)(\?|#|$)/i;
/** The gateway labels embed PAGES as `hls`; only a real media file may go into a <video>. */
export const isDirectMedia = (u: string, flag?: boolean) => flag === true || DIRECT.test(u || '');

// In-memory session cache for instant playback on repeat taps (<5ms)
const streamCache = new Map<string, ResolvedStream>();

/** Turn a gateway response into direct media (direct, url) + embed player pages (embeds), best first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw gateway JSON, validated field by field
export function parseResolve(data: any, ctx?: { type: string; id: number | string; season?: number; episode?: number }): ResolvedStream | null {
  const sources: ResolvedStream['sources'] = Array.isArray(data?.sources) ? data.sources : [];
  const ranked = rankSources(sources.map((x) => toMediaSrc(x, isDirectMedia)).filter((x): x is MediaSrc => !!x), { mobile: onMobileData() });
  const direct = ranked[0];
  const pages: string[] = [];
  const add = (u?: string) => u && !isDirectMedia(u) && !pages.includes(u) && pages.push(u);
  add(data?.embedUrl);
  sources.forEach((x) => (x?.url && !isDirectMedia(x.url, (x as any).isDirect) ? add(x.url) : 0));
  const embeds = ctx ? buildEmbeds(pages, ctx.type, ctx.id, ctx.season, ctx.episode) : pages.map((url) => ({ url }));
  if (!direct && !embeds.length) return null;
  return {
    url: direct?.url || '',
    direct: ranked,
    quality: direct?.quality || sources[0]?.quality || 1080,
    slug: data?.slug,
    webPlayUrl: data?.webPlayUrl,
    embedUrl: embeds[0]?.url,
    embeds,
    sources,
    subtitles: Array.isArray(data?.subtitles) ? data.subtitles.filter((x: { url?: string }) => x?.url) : [],
  };
}

async function tryFetch(url: string, ms: number) {
  const res = await fetch(url, { signal: timeoutSignal(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function fetchStream(
  titleId: number | string,
  titleName: string,
  type = 'movie',
  season = 1,
  episode = 1
): Promise<ResolvedStream | null> {
  const cacheKey = `${type}:${titleId}:${season}:${episode}`;
  const hit = streamCache.get(cacheKey);
  if (hit) return hit;
  const url = `${GATEWAY_BASE}/v1/resolve?id=${titleId}&title=${encodeURIComponent(titleName)}&type=${type}&season=${season}&episode=${episode}`;
  // cold resolves take 2-4 s (measured 2026-11-20); allow a slow network and one retry before giving up
  for (const ms of [10000, 10000]) {
    try {
      const resolved = parseResolve(await tryFetch(url, ms), { type, id: titleId, season, episode });
      if (resolved) {
        streamCache.set(cacheKey, resolved);
        return resolved;
      }
    } catch {
      /* retry once */
    }
  }
  // gateway unreachable: the embed players do not need it, so still use them (never a dead end)
  const fallback = parseResolve({ sources: [] }, { type, id: titleId, season, episode });
  if (fallback) streamCache.set(cacheKey, fallback);
  return fallback;
}
