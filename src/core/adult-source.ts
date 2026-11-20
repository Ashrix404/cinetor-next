// Adult section content source: mature TMDB catalog (include_adult=true, erotic/softcore
// keywords, NC-17 and R-rated romance). Only this module asks TMDB for adult results, and its
// responses are kept in a separate memory-only cache (see `tmdbAdultGet`).
// Verified live on 2026-11-21 (docs/PROGRESS.md "Adult section"): every request below returns
// 20 results per page with posters.
import { adultOnly } from './adult';
import { dedupe } from './catalog';
import { mapTitle, tmdbAdultGet, type Page, type RawItem, type Title } from './tmdb';

/** TMDB keyword ids (looked up with /search/keyword). */
export const KW = { erotic: 256466, eroticDrama: 364719, eroticThriller: 207767, softcore: 155477 };

/** Keywords that may involve minors or incest: excluded server-side (client side also filters). */
export const MINOR_KW = [296608, 6270, 41172, 158752, 325666, 370850, 379038, 361959, 379546, 10683, 355253, 342470, 373436, 299568, 319493, 5808, 382287, 33841, 11792, 285902];

export type AdultReq = [path: string, params: Record<string, string>];

const base = (kind: 'movie' | 'tv'): Record<string, string> => ({
  include_adult: 'true',
  without_genres: kind === 'tv' ? '16,10762,10751' : '16,10751',
  without_keywords: MINOR_KW.join(','),
});
const req = (kind: 'movie' | 'tv', extra: Record<string, string>, pages: number): AdultReq[] =>
  Array.from({ length: pages }, (_, i) => ['/discover/' + kind, { ...base(kind), sort_by: 'popularity.desc', ...extra, page: String(i + 1) }]);

/** Requests for the Adult feed. `light` (TV) uses one page each. */
export function adultSources(light = false): AdultReq[] {
  const n = (x: number) => (light ? 1 : x);
  return [
    ...req('movie', { with_keywords: KW.erotic + '|' + KW.eroticDrama }, n(2)),
    ...req('movie', { with_keywords: String(KW.eroticThriller) }, n(1)),
    ...req('movie', { with_keywords: String(KW.softcore), sort_by: 'vote_count.desc' }, n(2)),
    ...req('movie', { with_keywords: KW.erotic + '|' + KW.eroticDrama, sort_by: 'vote_count.desc' }, n(1)),
    ...req('movie', { certification_country: 'US', certification: 'NC-17' }, n(1)),
    ...req('movie', { certification_country: 'US', certification: 'R', with_genres: '10749' }, n(1)),
    ...req('tv', { with_keywords: KW.erotic + '|' + KW.softcore }, n(1)),
  ];
}

/** Load, map, filter (no minors, no animation) and tag the Adult pool. Interleaves sources. */
export async function loadAdultPool(light = false): Promise<Title[]> {
  const reqs = adultSources(light);
  const r = await Promise.allSettled(reqs.map(([p, q]) => tmdbAdultGet<Page<RawItem>>(p, q)));
  const lists = r.map((x, i) => (x.status === 'fulfilled' ? x.value.results.map((it) => mapTitle(it, reqs[i][0].includes('/tv') ? 'tv' : 'movie')) : []));
  if (!lists.some((l) => l.length)) throw (r.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined)?.reason ?? new Error('No adult titles');
  const mixed: Title[] = [];
  const max = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
  return adultOnly(dedupe(mixed));
}

/**
 * Interface for the player: adult titles play through the normal TMDB-id stream resolver
 * (there is no separate adult stream provider in the gateway, verified: /adult, /nsfw → 404).
 * Use `adultPolicy(t)` from './adult' to decide PiP / background / history.
 */
export { adultPolicy, isAdultTitle } from './adult';
