import { GATEWAY_BASE } from './config';

export interface ResolvedStream {
  /** direct media file ('' when only embed pages exist) */
  url: string;
  quality: number;
  slug?: string;
  webPlayUrl?: string;
  embedUrl?: string;
  /** every embed page the gateway offers, best first (server switcher) */
  embeds: string[];
  sources: { name: string; quality: number; url: string; type: string; headers?: Record<string, string> }[];
  subtitles: { lang: string; url: string; format: string }[];
}

const DIRECT = /\.(m3u8|mp4|webm|m4v|mkv)(\?|#|$)/i;
/** The gateway labels embed PAGES as `hls`; only a real media file may go into a <video>. */
export const isDirectMedia = (u: string, flag?: boolean) => flag === true || DIRECT.test(u || '');

// In-memory session cache for instant playback on repeat taps (<5ms)
const streamCache = new Map<string, ResolvedStream>();

/** Turn a gateway response into direct media (url) + embed pages (embeds), best first. */
export function parseResolve(data: any): ResolvedStream | null {
  const sources: ResolvedStream['sources'] = Array.isArray(data?.sources) ? data.sources : [];
  const direct = sources.find((x: any) => x?.url && isDirectMedia(x.url, x.isDirect));
  const embeds: string[] = [];
  const add = (u?: string) => u && !isDirectMedia(u) && !embeds.includes(u) && embeds.push(u);
  add(data?.embedUrl);
  sources.forEach((x) => (x?.url && !isDirectMedia(x.url, (x as any).isDirect) ? add(x.url) : 0));
  if (!direct && !embeds.length) return null;
  return {
    url: direct?.url || '',
    quality: direct?.quality || sources[0]?.quality || 1080,
    slug: data.slug,
    webPlayUrl: data.webPlayUrl,
    embedUrl: embeds[0],
    embeds,
    sources,
    subtitles: data.subtitles || [],
  };
}

async function tryFetch(url: string, ms: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
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
  // cold resolves take ~2-3 s; allow a slow network and one retry before giving up
  for (const ms of [12000, 12000]) {
    try {
      const resolved = parseResolve(await tryFetch(url, ms));
      if (resolved) {
        streamCache.set(cacheKey, resolved);
        return resolved;
      }
    } catch {
      /* retry once */
    }
  }
  return null;
}
