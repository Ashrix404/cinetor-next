import { GATEWAY_BASE } from './config';
import { buildEmbeds, timeoutSignal, type Embed } from './embeds';
import { onMobileData, rankSources, toMediaSrc, type MediaSrc } from './sources';
import { proxify } from './playback';

export type StreamServer = MediaSrc;

export interface ResolvedStream {
  /** best direct media file ('' when only embed pages exist) = direct[0].url */
  url: string;
  /** every real media file (+ the headers its CDN wants), best first (v2 ranking + LinkHealth) */
  direct: MediaSrc[];
  /** multi-server streams: all direct media files first (ranked), followed by fallback embed servers */
  servers: MediaSrc[];
  /** name of the primary/active server (e.g. "Server 1 - AutoEmbed Master 1080p") */
  server: string;
  /** default active server index (0) */
  serverIndex: number;
  quality: number;
  slug?: string;
  webPlayUrl?: string;
  embedUrl?: string;
  /** every embed player page (gateway + verified extra players), best first (automatic failover) */
  embeds: Embed[];
  sources: {
    name: string;
    quality: number;
    url: string;
    type: string;
    headers?: Record<string, string>;
    proxyUrl?: string;
    isDirect?: boolean;
    server?: string;
    size?: number;
  }[];
  subtitles: { lang: string; url: string; format: string }[];
}

const DIRECT = /\.(m3u8|mp4|webm|m4v|mkv)(\?|#|$)/i;
/** The gateway labels embed PAGES as `hls`; only a real media file may go into a <video>. */
export const isDirectMedia = (u: string, flag?: boolean): boolean => {
  if (flag === true) return true;
  if (flag === false) return false;
  if (!u) return false;
  return DIRECT.test(u) || /\/(playlist|manifest|master)(\?|$)/i.test(u) || /\/v1\/proxy\?url=/i.test(u);
};

export function detectServer(s: { name?: string; url?: string; server?: string }): string {
  if (s.server && s.server.trim()) return s.server.trim();
  const combo = `${s.name || ''} ${s.url || ''}`.toLowerCase();
  if (combo.includes('moviebox') || combo.includes('mzfi.me') || combo.includes('movieapi')) return 'MovieBox';
  if (combo.includes('autoembed')) return 'AutoEmbed';
  if (combo.includes('vidlink')) return 'VidLink';
  if (combo.includes('vidsrc')) return 'VidSrc';
  if (combo.includes('pixeldrain')) return 'Pixeldrain';
  if (combo.includes('r2') || combo.includes('cloudflare')) return 'Cloudflare R2';
  if (combo.includes('vegahub') || combo.includes('hubcloud')) return 'VegaHub';
  if (combo.includes('hianime')) return 'HiAnime';
  if (combo.includes('kisskh')) return 'KissKh';
  if (combo.includes('multiembed')) return 'MultiEmbed';
  if (combo.includes('2embed')) return '2Embed';
  if (combo.includes('anime')) return 'AnimeStream';
  if (combo.includes('drama')) return 'DramaStream';
  return 'Direct';
}

export function formatServerLabel(idx: number, name: string, srv: string, quality: number, isDirect: boolean): string {
  const num = idx + 1;
  const m = /^Server\s+\d+\s*[-:]\s*(.+)$/i.exec(name);
  if (m) return `Server ${num} - ${m[1].trim()}`;

  const provider = srv || detectServer({ name, url: '' });
  const qStr = isDirect && quality > 0 ? ` ${quality}p` : '';
  const typeStr = isDirect ? '' : ' (Embed)';
  let tag = name || provider;
  tag = tag.replace(/^Direct\s+HLS\s*\((.*?)\)/i, '$1').replace(/^Fast\s+Direct\s*/i, '').trim();
  if (!tag.toLowerCase().includes(provider.toLowerCase())) {
    tag = `${provider} ${tag}`.trim();
  }
  if (qStr && tag.includes(qStr.trim())) {
    return `Server ${num} - ${tag}${typeStr}`;
  }
  return `Server ${num} - ${tag}${qStr}${typeStr}`;
}

// In-memory session cache for instant playback on repeat taps (<5ms)
const streamCache = new Map<string, ResolvedStream>();

export function clearStreamCache(key?: string): void {
  if (key) streamCache.delete(key);
  else streamCache.clear();
}

export function getStreamCache(): Map<string, ResolvedStream> {
  return streamCache;
}

/** Turn a gateway response into direct media (direct, url) + multi-server list (servers) + embed player pages (embeds), best first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw gateway JSON, validated field by field
export function parseResolve(data: any, ctx?: { type: string; id: number | string; season?: number; episode?: number }): ResolvedStream | null {
  const sources: ResolvedStream['sources'] = Array.isArray(data?.sources) ? data.sources : [];
  const ranked = rankSources(
    sources.map((x) => toMediaSrc(x, isDirectMedia)).filter((x): x is MediaSrc => !!x),
    { mobile: onMobileData() }
  );
  const direct = ranked[0];
  const pages: string[] = [];
  const add = (u?: string) => u && !isDirectMedia(u) && !pages.includes(u) && pages.push(u);
  add(data?.embedUrl);
  sources.forEach((x) => (x?.url && !isDirectMedia(x.url, (x as any).isDirect) ? add(x.url) : 0));
  const embeds = ctx ? buildEmbeds(pages, ctx.type, ctx.id, ctx.season, ctx.episode) : pages.map((url) => ({ url }));

  if (!direct && !embeds.length && !ranked.length) return null;

  // Build multi-server list: direct servers first, then embed fallbacks
  const servers: MediaSrc[] = [];
  let srvIdx = 0;

  for (const d of ranked) {
    const srv = detectServer(d);
    const label = formatServerLabel(srvIdx, d.name, srv, d.quality, true);
    const proxyUrl = d.proxyUrl || (d.headers?.Referer ? proxify(d.url, d.headers.Referer) : undefined);
    servers.push({
      ...d,
      name: label,
      server: srv,
      serverId: `srv-${srvIdx + 1}`,
      proxyUrl,
      isDirect: true,
    });
    srvIdx++;
  }

  for (const emb of embeds) {
    const matched = sources.find((s) => s.url === emb.url);
    const srv = detectServer({ name: matched?.name, url: emb.url });
    const q = matched?.quality || 1080;
    const label = formatServerLabel(srvIdx, matched?.name || `${srv} Embed`, srv, q, false);
    servers.push({
      url: emb.url,
      kind: 'hls',
      quality: q,
      name: label,
      server: srv,
      serverId: `srv-${srvIdx + 1}`,
      isDirect: false,
    });
    srvIdx++;
  }

  const primaryServer = servers[0]?.name || '';

  return {
    url: direct?.url || '',
    direct: ranked,
    servers,
    server: primaryServer,
    serverIndex: 0,
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
