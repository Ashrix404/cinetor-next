// Title details for the Info page (TMDB details + credits + videos + similar), season episodes, person credits.
import { mapTitle, tmdbGet, type RawItem, type Title } from './tmdb';

export interface CastMember { id: number; name: string; character: string; photo: string | null }
export interface Episode { n: number; name: string; runtime: number; still: string | null }
export interface Details {
  title: Title;
  runtime: number;
  genres: string[];
  tagline: string;
  overview: string;
  maturity: string;
  cast: CastMember[];
  trailerKey: string | null;
  similar: Title[];
  /** episode count per season (index 0 = season 1); empty for movies */
  seasons: number[];
  facts: [string, string][];
}

type Raw = Record<string, any>; // raw TMDB payload (fields verified by tests/core/tmdb.contract.test.ts)

export function mapDetails(t: Title, d: Raw): Details {
  const tv = t.mediaType === 'tv';
  const crew: Raw[] = d.credits?.crew || [];
  const vids: Raw[] = d.videos?.results || [];
  const trailer = vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || vids.find((v) => v.site === 'YouTube');
  const seasons = tv ? (d.seasons || []).filter((s: Raw) => s.season_number > 0 && s.episode_count > 0).map((s: Raw) => s.episode_count as number) : [];
  const rating = tv
    ? (d.content_ratings?.results || []).find((r: Raw) => r.iso_3166_1 === 'US')?.rating
    : (d.release_dates?.results || []).find((r: Raw) => r.iso_3166_1 === 'US')?.release_dates?.find((x: Raw) => x.certification)?.certification;
  const names = (a: Raw[] | undefined, k = 'name') => (a || []).map((x) => x[k]).filter(Boolean).slice(0, 2).join(', ');
  const director = tv ? names(d.created_by) : names(crew.filter((c) => c.job === 'Director'));
  const writers = names(crew.filter((c) => c.department === 'Writing'));
  const released = (tv ? d.first_air_date : d.release_date) || '';
  const facts: [string, string][] = [
    [tv ? 'Created by' : 'Director', director],
    ['Writers', writers],
    ['Studio', names(d.production_companies)],
    ['Country', names(d.production_countries)],
    ['Language', names(d.spoken_languages, 'english_name')],
    ['Released', released ? new Date(released).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
  ].filter((f): f is [string, string] => !!f[1]);
  return {
    title: { ...t, overview: d.overview || t.overview, backdrop: d.backdrop_path ?? t.backdrop, poster: d.poster_path ?? t.poster },
    runtime: (tv ? (d.episode_run_time || [])[0] : d.runtime) || 0,
    genres: (d.genres || []).map((g: Raw) => g.name as string),
    tagline: d.tagline || '',
    overview: d.overview || t.overview,
    maturity: rating || (tv ? 'TV-14' : 'PG-13'),
    cast: ((d.credits?.cast || []) as Raw[]).slice(0, 12).map((c) => ({ id: c.id, name: c.name, character: c.character || '', photo: c.profile_path || null })),
    trailerKey: trailer ? trailer.key : null,
    similar: ((d.similar?.results || []) as RawItem[]).map((x) => mapTitle(x, t.mediaType)).filter((x) => x.poster).slice(0, 12),
    seasons,
    facts,
  };
}

export async function loadDetails(t: Title): Promise<Details> {
  const extra = t.mediaType === 'tv' ? 'credits,videos,similar,content_ratings' : 'credits,videos,similar,release_dates';
  const d = await tmdbGet<Raw>(`/${t.mediaType}/${t.id}`, { append_to_response: extra });
  return mapDetails(t, d);
}

export async function loadSeason(id: number, n: number): Promise<Episode[]> {
  const d = await tmdbGet<Raw>(`/tv/${id}/season/${n}`);
  return ((d.episodes || []) as Raw[]).map((e) => ({ n: e.episode_number, name: e.name || 'Episode ' + e.episode_number, runtime: e.runtime || 0, still: e.still_path || null }));
}

export interface Person { name: string; photo: string | null; dept: string; bio: string; movies: Title[]; series: Title[] }
export async function loadPerson(id: number): Promise<Person> {
  const [pd, cr] = await Promise.all([tmdbGet<Raw>('/person/' + id), tmdbGet<Raw>('/person/' + id + '/combined_credits')]);
  const seen = new Set<string>();
  const items = ((cr.cast || []) as Raw[])
    .filter((x) => x.poster_path && (x.title || x.name))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .filter((x) => (seen.has(x.media_type + x.id) ? false : (seen.add(x.media_type + x.id), true)))
    .map((x) => mapTitle(x as RawItem));
  return { name: pd.name, photo: pd.profile_path || null, dept: pd.known_for_department || '', bio: pd.biography || '', movies: items.filter((x) => x.mediaType === 'movie'), series: items.filter((x) => x.mediaType === 'tv') };
}

export async function searchMulti(q: string): Promise<Title[]> {
  const d = await tmdbGet<{ results: RawItem[] }>('/search/multi', { query: q });
  return d.results.filter((x) => (x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path).map((x) => mapTitle(x));
}
