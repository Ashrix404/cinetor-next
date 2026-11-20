// Embed players (third-party player pages shown in an <iframe>) and the failover rules between them.
// Nothing here is ever shown to the user: the app picks and switches players on its own.

export interface Embed {
  url: string;
}

type Kind = 'movie' | 'tv' | string;

/** Extra embed players added on the client (the gateway only returns three templated URLs).
 * CI stream-probe 2026-11-20, two runs (real Chrome, iframe, two taps): vidsrc.su and vidsrc.wtf produced
 * advancing frames for movie 603, tv 1396, anime 37854 and new movie 1084242 in both runs; vidlink only for
 * movie 603 (its tv/new files are h265, HTTP 428 in Chrome Linux); 2embed in run 1 only (run 2: ads);
 * vidsrc.to and vidfast rendered a player but no frames; the rest showed no player at all. */
const EXTRA: { movie: (id: string) => string; tv: (id: string, s: number, e: number) => string }[] = [
  { movie: (id) => `https://vidsrc.su/movie/${id}`, tv: (id, s, e) => `https://vidsrc.su/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
  { movie: (id) => `https://vidsrc.wtf/api/1/movie/?id=${id}`, tv: (id, s, e) => `https://vidsrc.wtf/api/1/tv/?id=${id}&s=${s}&e=${e}` },
  { movie: (id) => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidfast.pro/movie/${id}`, tv: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidsrc.sh/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.sh/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidrock.net/movie/${id}`, tv: (id, s, e) => `https://vidrock.net/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://player.autoembed.me/embed/movie/${id}`, tv: (id, s, e) => `https://player.autoembed.me/embed/tv/${id}/${s}/${e}` },
  // last resort (no player / no DNS in the 2026-11-20 probe; kept, never removed: hosts come back)
  { movie: (id) => `https://vidsrc.xyz/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://embed.su/embed/movie/${id}`, tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidsrc.rip/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.rip/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://vidsrc.vip/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.vip/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
  { movie: (id) => `https://player.videasy.net/movie/${id}`, tv: (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://111movies.com/movie/${id}`, tv: (id, s, e) => `https://111movies.com/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://www.vidking.net/embed/movie/${id}`, tv: (id, s, e) => `https://www.vidking.net/embed/tv/${id}/${s}/${e}` },
  { movie: (id) => `https://moviesapi.club/movie/${id}`, tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { movie: (id) => `https://player.autoembed.cc/embed/movie/${id}`, tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
];
/** Best first, by the probe evidence above; hosts not listed go last. */
const RANK = ['vidsrc.su', 'vidsrc.wtf', 'vidlink.pro', '2embed.cc', 'vidsrc.to', 'vidfast.pro', 'autoembed.co'];

/** Hosts with no player / no DNS on 2026-11-20: still kept, as the very last resort (low priority).
 * An unreachable one costs one failed no-cors fetch (DNS error) before the next is tried. */
const LOW_HOSTS = /(^|\.)(vidsrc\.xyz|moviesapi\.club|player\.autoembed\.cc|vidking\.net|vidsrc\.vip|player\.videasy\.net|111movies\.com|vidsrc\.cc|embed\.su|vidsrc\.rip|multiembed\.mov)$/i;

export const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Gateway embeds + extra players, one entry per host, nothing dropped, best first (RANK, unknown hosts,
 * then LOW_HOSTS; and what this session learned: a player that played first, one that refused last). */
export function buildEmbeds(gatewayEmbeds: string[], kind: Kind, id: number | string, s = 1, e = 1): Embed[] {
  const out: Embed[] = [];
  const seen = new Set<string>();
  const add = (url: string) => {
    const h = hostOf(url);
    if (!h || seen.has(h)) return;
    seen.add(h);
    out.push({ url });
  };
  gatewayEmbeds.forEach(add);
  const sid = String(id);
  for (const x of EXTRA) add(kind === 'tv' || kind === 'anime' ? x.tv(sid, s, e) : x.movie(sid));
  const rank = (u: string) => {
    const i = RANK.indexOf(hostOf(u));
    const h = embedHealth.get(hostOf(u));
    const base = i >= 0 ? i : LOW_HOSTS.test(hostOf(u)) ? RANK.length + 10 : RANK.length;
    return (h === 'playing' ? -100 : h === 'blocked' ? 100 : 0) + base;
  };
  return out.map((x, i) => ({ x, i })).sort((a, b) => rank(a.x.url) - rank(b.x.url) || a.i - b.i).map((y) => y.x);
}

/** Index of the next player to try after `from`, skipping players already tried; -1 when all were tried. */
export function nextUntried(count: number, from: number, tried: ReadonlySet<number>): number {
  for (let k = 1; k <= count; k++) {
    const i = (from + k) % count;
    if (!tried.has(i)) return i;
  }
  return -1;
}

/** Can this device reach the host at all? An opaque no-cors fetch resolves for any HTTP answer and
 * rejects on DNS / TLS / connection failure (blocked or dead hosts), so dead players are skipped fast. */
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

// ---- embed guard / health ------------------------------------------------------------------------
/** What the embed guard (android/app/src/main/res/raw/embed_shim.js, injected by the APK into every
 * frame) reports: 'ready' (DOM parsed), 'playing' (a real video plays), 'blocked' (the page refuses
 * to play here, e.g. "In-App Browser Detected"). */
export type EmbedEvent = 'ready' | 'playing' | 'blocked';
export function embedEvent(data: unknown): { ev: EmbedEvent; host: string } | null {
  const d = data as { __cinetor?: unknown; ev?: unknown; host?: unknown } | null;
  if (!d || typeof d !== 'object' || d.__cinetor !== 'embed') return null;
  if (d.ev !== 'ready' && d.ev !== 'playing' && d.ev !== 'blocked') return null;
  return { ev: d.ev, host: typeof d.host === 'string' ? d.host.replace(/^www\./, '') : '' };
}

/** Session memory per embed host (v2 LinkHealth idea, for embed pages). */
export const embedHealth = new Map<string, 'playing' | 'blocked'>();

/** iframe sandbox for the web app: no pop-ups, no top-window navigation (ad hijacks), no downloads.
 * Only for hosts that still play inside it (stream-probe "sandbox" mode); vidsrc.su and viduki
 * detect any sandbox and refuse to play. The APK never sandboxes (its native guard does the job). */
export const EMBED_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-orientation-lock';
const SANDBOX_OK = new Set<string>([]);
export function sandboxFor(url: string, native: boolean): string | undefined {
  return !native && SANDBOX_OK.has(hostOf(url)) ? EMBED_SANDBOX : undefined;
}
