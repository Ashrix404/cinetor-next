// Embed servers (third-party player pages shown in an <iframe>) and the failover rules between them.

export interface Server {
  name: string;
  url: string;
}

type Kind = 'movie' | 'tv' | string;

/** Extra embed players added on the client (the gateway only returns three). Each pattern was loaded in
 * real Chrome by the CI stream-probe (scripts/stream-probe) and produced video frames. */
const EXTRA: { name: string; movie: (id: string) => string; tv: (id: string, s: number, e: number) => string }[] = [
  { name: 'VidFast', movie: (id) => `https://vidfast.pro/movie/${id}`, tv: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}` },
  { name: 'VidSrc CC', movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name: '2Embed', movie: (id) => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
];

/** Hosts proven dead (DNS NXDOMAIN or no player) on 2026-11-20; never offered even if a source lists them. */
const DEAD_HOSTS = /(^|\.)(vidsrc\.xyz|moviesapi\.club|player\.autoembed\.cc|vidking\.net|vidsrc\.vip|player\.videasy\.net|111movies\.com)$/i;

export const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const NICE: Record<string, string> = {
  'vidlink.pro': 'VidLink',
  'vidsrc.to': 'VidSrc',
  'autoembed.co': 'AutoEmbed',
};

/** Gateway embeds first (in gateway order), then the extra players; one entry per host, dead hosts dropped. */
export function buildServers(gatewayEmbeds: string[], kind: Kind, id: number | string, s = 1, e = 1): Server[] {
  const out: Server[] = [];
  const seen = new Set<string>();
  const add = (name: string, url: string) => {
    const h = hostOf(url);
    if (!h || seen.has(h) || DEAD_HOSTS.test(h)) return;
    seen.add(h);
    out.push({ name, url });
  };
  gatewayEmbeds.forEach((u, i) => add(NICE[hostOf(u)] || 'Server ' + (i + 1), u));
  const sid = String(id);
  for (const x of EXTRA) add(x.name, kind === 'tv' || kind === 'anime' ? x.tv(sid, s, e) : x.movie(sid));
  return out;
}

/** Index of the next server to try after `from`, skipping servers already tried; -1 when all were tried. */
export function nextUntried(count: number, from: number, tried: ReadonlySet<number>): number {
  for (let k = 1; k <= count; k++) {
    const i = (from + k) % count;
    if (!tried.has(i)) return i;
  }
  return -1;
}

/** Can this device reach the server at all? An opaque no-cors fetch resolves for any HTTP answer and
 * rejects on DNS / TLS / connection failure (blocked or dead hosts), so dead servers are skipped fast. */
export async function reachable(url: string, ms = 5000): Promise<boolean> {
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: timeoutSignal(ms) });
    return true;
  } catch (e) {
    // a timeout only means "slow"; let the iframe load timer decide. Hard network errors mean unreachable.
    return (e as Error)?.name === 'AbortError' || (e as Error)?.name === 'TimeoutError';
  }
}

/** AbortSignal.timeout needs Chrome 103+; old Android TV WebViews (Chrome 61+) do not have it. */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as { timeout?: unknown }).timeout === 'function') return AbortSignal.timeout(ms);
  if (typeof AbortController === 'undefined') return undefined;
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
