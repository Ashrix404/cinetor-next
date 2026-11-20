import { GATEWAY_BASE, MEDIA_BASE } from './config';
import { clipFor } from './player-model';
import type { Quality } from './series-settings';

export interface ResolvedStream {
  url: string;
  quality: number;
  sources: { name: string; quality: number; url: string; type: string }[];
  subtitles: { lang: string; url: string; format: string }[];
}

export const fallbackClip = (q: Quality) => MEDIA_BASE + clipFor(q);

// In-memory session cache for instant playback on repeat taps (<5ms)
const streamCache = new Map<string, ResolvedStream>();

export async function fetchStream(
  titleId: number | string,
  titleName: string,
  type = 'movie',
  season = 1,
  episode = 1
): Promise<ResolvedStream | null> {
  const cacheKey = `${type}:${titleId}:${season}:${episode}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  try {
    const url = `${GATEWAY_BASE}/v1/resolve?id=${titleId}&title=${encodeURIComponent(titleName)}&type=${type}&season=${season}&episode=${episode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.sources?.length > 0) {
      const resolved: ResolvedStream = {
        url: data.sources[0].url,
        quality: data.sources[0].quality,
        sources: data.sources,
        subtitles: data.subtitles || []
      };
      streamCache.set(cacheKey, resolved);
      return resolved;
    }
  } catch {}
  return null;
}
