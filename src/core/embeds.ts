// Embed servers (third-party player pages shown in an <iframe>) and the failover rules between them.

export interface Server {
  name: string;
  url: string;
}

type Kind = 'movie' | 'tv' | string;

/** Extra embed players added on the client (the gateway only returns three templated URLs).
 * CI stream-probe 2026-11-20 (real Chrome, iframe, two taps): vidsrc.su, vidlink (movies), 2embed and
 * vidsrc.wtf produced advancing video frames; vidsrc.to and vidfast rendered a player but no frames
 * without more taps; the rest showed no player at all. */
const EXTRA: { name: string; movie: (id: string) => string; tv: (id: string, s: number, e: number) => string }[] = [
  { name: 'VidSrc SU', movie: (id) => `https://vidsrc.su/movie/${id}`, tv: (id, s, e) => `https://vidsrc.su/tv/${id}/${s}/${e}` },
  { name: 'VidLink', movie: (id) => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: '2Embed', movie: (id) => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
  { name: 'Viduki', movie: (id) => `https://vidsrc.wtf/api/1/movie/?id=${id}`, tv: (id, s, e) => `https://vidsrc.wtf/api/1/tv/?id=${id}&s=${s}&e=${e}` },
  { name: 'VidSrc', movie: (id) => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: 'VidFast', movie: (id) => `https://vidfast.pro/movie/${id}`, tv: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}` },
];
/** Best first, by the probe evidence above; hosts not listed go last. */
const RANK = ['vidsrc.su', 'vidlink.pro', '2embed.cc', 'vidsrc.wtf', 'vidsrc.to', 'vidfast.pro', 'autoembed.co'];

/** Hosts proven dead on 2026-11-20 (DNS NXDOMAIN, or no player in the probe); never offered. */
const DEAD_HOSTS = /(^|\.)(vidsrc\.xyz|moviesapi\.club|player\.autoembed\.cc|vidking\.net|vidsrc\.vip|player\.videasy\.net|111movies\.com|vidsrc\.cc|embed\.su|vidsrc\.rip|multiembed\.mov)$/i;

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

/** Gateway embeds + extra players, one entry per host, dead hosts dropped, best first (RANK). */
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
  const rank = (u: string) => {
    const i = RANK.indexOf(hostOf(u));
    return i < 0 ? RANK.length : i;
  };
  return out.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x.url) - rank(b.x.url) || a.i - b.i).map((y) => y.x);
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
