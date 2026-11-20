import { GATEWAY_BASE } from './config';
import { buildServers, timeoutSignal, type Server } from './embeds';

export interface ResolvedStream {
  /** direct media file ('' when only embed pages exist) */
  url: string;
  quality: number;
  slug?: string;
  webPlayUrl?: string;
  embedUrl?: string;
  /** every embed page (gateway + verified extra players), best first (server switcher) */
  embeds: string[];
  /** the same embed pages with display names */
  servers: Server[];
  sources: { name: string; quality: number; url: string; type: string; headers?: Record<string, string> }[];
  subtitles: { lang: string; url: string; format: string }[];
}

const DIRECT = /\.(m3u8|mp4|webm|m4v|mkv)(\?|#|$)/i;
/** The gateway labels embed PAGES as `hls`; only a real media file may go into a <video>. */
export const isDirectMedia = (u: string, flag?: boolean) => flag === true || DIRECT.test(u || '');

// In-memory session cache for instant playback on repeat taps (<5ms)
const streamCache = new Map<string, ResolvedStream>();

/** Turn a gateway response into direct media (url) + embed pages (embeds), best first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw gateway JSON, validated field by field
export function parseResolve(data: any, ctx?: { type: string; id: number | string; season?: number; episode?: number }): ResolvedStream | null {
  const sources: ResolvedStream['sources'] = Array.isArray(data?.sources) ? data.sources : [];
  const direct = sources.find((x: any) => x?.url && isDirectMedia(x.url, x.isDirect));
  const embeds: string[] = [];
  const add = (u?: string) => u && !isDirectMedia(u) && !embeds.includes(u) && embeds.push(u);
  add(data?.embedUrl);
  sources.forEach((x) => (x?.url && !isDirectMedia(x.url, (x as any).isDirect) ? add(x.url) : 0));
  const servers = ctx ? buildServers(embeds, ctx.type, ctx.id, ctx.season, ctx.episode) : embeds.map((url, i) => ({ name: 'Server ' + (i + 1), url }));
  if (!direct && !servers.length) return null;
  const named = servers.map((x) => ({ ...x, name: sources.find((y) => y.url === x.url && y.name)?.name.replace(/\s*\(.*?\)|\s*Server \d+|\s*Fast HD Stream/g, '').trim() || x.name }));
  return {
    url: direct?.url || '',
    quality: direct?.quality || sources[0]?.quality || 1080,
    slug: data?.slug,
    webPlayUrl: data?.webPlayUrl,
    embedUrl: named[0]?.url,
    embeds: named.map((x) => x.url),
    servers: named,
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
  // gateway unreachable: the embed players do not need it, so still offer them (never a dead end)
  const fallback = parseResolve({ sources: [] }, { type, id: titleId, season, episode });
  if (fallback) streamCache.set(cacheKey, fallback);
  return fallback;
}
