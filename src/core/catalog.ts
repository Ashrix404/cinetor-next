// Section feeds, ported from the prototype `loadTmdb`, `feedRows`, `genPick` and `GEN`.
import { mapTitle, tmdbGet, type Page, type RawItem, type Title } from './tmdb';

export type Section = 'home' | 'anime' | 'drama' | 'comics' | 'adult';
export interface Row { id: string; title: string; items: Title[] }
export interface Feed { hero: Title[]; rows: Row[]; genres: string[]; pool: Title[] }

/** Genre chip lists per section (prototype `GEN`). */
export const GEN: Record<string, string[]> = {
  home: ['Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Supernatural', 'Thriller', 'War', 'Western'],
  anime: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'],
  drama: ['Romance', 'Thriller', 'Crime', 'Family', 'Comedy', 'Medical', 'Legal', 'Historical', 'Fantasy', 'Mystery', 'Melodrama', 'Revenge', 'Youth', 'Office', 'Political', 'Horror', 'Action', 'Sci-Fi'],
  comics: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Martial Arts', 'Mystery', 'Psychological', 'Romance', 'School Life', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Tragedy', 'Cultivation', 'Historical'],
  adult: ['Romance', 'Drama', 'Comedy', 'Thriller', 'Fantasy', 'Mature', 'Classic', 'Foreign', 'Indie', 'Short'],
  music: ['Pop', 'Hip-Hop', 'Rock', 'Indie', 'Electronic', 'Jazz', 'Classical', 'RnB', 'Country', 'Lo-fi', 'Metal', 'Folk', 'K-Pop', 'Bollywood', 'Latin', 'Blues', 'Reggae', 'Podcasts'],
  tv: ['News', 'Entertainment', 'Movies', 'Series', 'Kids', 'Music', 'Sports', 'Documentary', 'Lifestyle', 'Education', 'Religion', 'Comedy', 'Regional', 'Shopping'],
  sport: ['Football', 'Cricket', 'Basketball', 'Tennis', 'Baseball', 'Hockey', 'Rugby', 'Volleyball', 'Badminton', 'Table Tennis', 'Golf', 'Boxing', 'MMA', 'Wrestling', 'Formula 1', 'Athletics', 'Kabaddi', 'Esports'],
};

export const DRAMA_OPTIONS = ['K-Drama', 'C-Drama', 'J-Drama', 'Pakistani Drama'] as const;
export const COMIC_OPTIONS = ['Manga', 'Manhwa', 'Manhua'] as const;

/** Prototype `SPECIAL`. The second title uses the last watched title. */
export function specialTitles(because: string): string[] {
  return ['Top 10 today', 'Because you watched ' + because, 'Recently added', 'Critically acclaimed', 'Hidden gems', 'Binge-worthy', 'Award winners', 'Leaving soon', 'Staff picks'];
}
const GEN_PREFIX = ['Top', 'Trending in', 'Best of', 'Popular in', 'Fresh in'];

/** TMDB genre name → prototype genre names (prototype `GNORM`). */
const GNORM: Record<string, string[]> = { 'Science Fiction': ['Sci-Fi'], Music: ['Musical'], 'Sci-Fi & Fantasy': ['Sci-Fi', 'Fantasy'], 'Action & Adventure': ['Action', 'Adventure'], 'War & Politics': ['War', 'Political'], Soap: ['Melodrama'], Kids: ['Family'] };
let genreNames: Map<number, string[]> = new Map();

export function setGenreMap(list: { id: number; name: string }[]): void {
  const m = new Map(genreNames);
  for (const g of list) m.set(g.id, GNORM[g.name] || [g.name]);
  genreNames = m;
}
export function genresOf(t: Title): string[] {
  return [...new Set(t.genreIds.flatMap((id) => genreNames.get(id) || []))];
}
async function loadGenres(): Promise<void> {
  if (genreNames.size) return;
  const r = await Promise.allSettled(['movie', 'tv'].map((k) => tmdbGet<{ genres: { id: number; name: string }[] }>('/genre/' + k + '/list')));
  for (const x of r) if (x.status === 'fulfilled') setGenreMap(x.value.genres);
}

/** Dedupe by title, keep only items with a poster. */
export function dedupe(list: Title[]): Title[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    if (!t.title || !t.poster || seen.has(t.title)) return false;
    seen.add(t.title);
    return true;
  });
}

type Req = [string, Record<string, string>?];
const pages = (path: string, n: number, extra: Record<string, string> = {}): Req[] => Array.from({ length: n }, (_, i) => [path, { ...extra, page: String(i + 1) }]);
const disc = (kind: 'tv' | 'movie', extra: Record<string, string>, n: number) => pages('/discover/' + kind, n, { sort_by: 'popularity.desc', ...extra });

async function list(reqs: Req[]): Promise<Title[]> {
  const r = await Promise.allSettled(reqs.map(([p, q]) => tmdbGet<Page<RawItem>>(p, q)));
  const ok = r.filter((x): x is PromiseFulfilledResult<Page<RawItem>> => x.status === 'fulfilled');
  if (!ok.length) throw (r[0] as PromiseRejectedResult).reason;
  return dedupe(ok.flatMap((x, i) => x.value.results.map((it) => mapTitle(it, reqs[i][0].includes('/tv') ? 'tv' : 'movie'))));
}

export interface LoadOpts {
  /** TV: fewer pages (≤ 6 endpoints for Home). */
  light?: boolean;
  /** Title for the "Because you watched …" row. */
  because?: string;
}

/** Requests per section, matching the prototype `loadTmdb`. */
export function sourcesFor(section: Section, option: string | undefined, light = false): Req[][] {
  const n = (x: number) => (light ? 1 : x);
  switch (section) {
    case 'home':
      return [[...pages('/trending/all/week', n(2)), ...pages('/movie/popular', n(3)), ...pages('/tv/popular', n(3))]];
    case 'anime':
      return [[...disc('tv', { with_genres: '16', with_original_language: 'ja' }, n(3)), ...disc('movie', { with_genres: '16', with_original_language: 'ja' }, n(2))]];
    case 'drama': {
      const o = option || 'K-Drama';
      if (o === 'C-Drama') return [disc('tv', { with_original_language: 'zh' }, n(3))];
      if (o === 'J-Drama') return [disc('tv', { with_original_language: 'ja', with_genres: '18' }, n(3))];
      if (o === 'Pakistani Drama') return [disc('tv', { with_original_language: 'ur' }, n(2)), disc('tv', { with_original_language: 'hi' }, n(2))];
      return [disc('tv', { with_original_language: 'ko' }, n(3))];
    }
    case 'comics': {
      const o = option || 'Manga';
      if (o === 'Manhwa') return [disc('tv', { with_original_language: 'ko' }, n(3))];
      if (o === 'Manhua') return [disc('tv', { with_original_language: 'zh' }, n(3))];
      return [disc('tv', { with_genres: '16', with_original_language: 'ja' }, n(3))];
    }
    case 'adult':
      return [[...disc('movie', { with_genres: '27' }, n(2)), ...disc('movie', { with_genres: '53' }, n(2)), ...disc('movie', { with_genres: '10749' }, n(2))]];
  }
}

/** Fixed rows per section (prototype V.home / V.anime / DRAMA / COMICS rows). */
function sectionRows(section: Section, option: string | undefined): string[] {
  if (section === 'home') return ['Trending', 'New releases'];
  if (section === 'anime') return ['Trending anime', 'This season', 'Top rated'];
  if (section === 'drama') {
    const o = option || 'K-Drama';
    const second: Record<string, string> = { 'K-Drama': 'K-Drama romance', 'C-Drama': 'Costume epics', 'J-Drama': 'Workplace', 'Pakistani Drama': 'Family sagas' };
    return ['Trending ' + o, second[o] || 'Popular'];
  }
  if (section === 'comics') {
    const o = option || 'Manga';
    const second: Record<string, string> = { Manga: 'New chapters', Manhwa: 'Webtoon picks', Manhua: 'Updated today' };
    return ['Popular ' + o, second[o] || 'New chapters'];
  }
  return [];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Prototype `genPick`: real genre matches when ≥ 4, else a stable spread over the pool. */
export function pickGenre(pool: Title[], genres: string[], ci: number): Title[] {
  const g = genres[ci];
  const hit = pool.filter((t) => genresOf(t).includes(g));
  if (hit.length >= 4) return hit;
  const n = genres.length;
  return pool.filter((_, i) => [i % n, (i * 7 + 3) % n, (i * 13 + 5) % n].includes(ci));
}

/** Build a feed from an already loaded pool (pure, unit tested). */
export function buildFeed(section: Section, option: string | undefined, pool: Title[], because?: string): Feed {
  const genres = GEN[section];
  const rows: Row[] = [];
  sectionRows(section, option).forEach((title, j) => {
    rows.push({ id: slug(title), title, items: pool.slice(j * 5, j * 5 + 14) });
  });
  specialTitles(because || pool[0]?.title || '').forEach((title, k) => {
    rows.push({ id: 'sp-' + k, title, items: pool.filter((_, i) => (i + k) % 9 === 0).slice(0, 9) });
  });
  genres.forEach((g, ci) => {
    rows.push({ id: 'g-' + slug(g), title: GEN_PREFIX[ci % 5] + ' ' + g, items: pickGenre(pool, genres, ci).slice(0, 8) });
  });
  const hero = pool.filter((t) => t.backdrop).slice(0, 7);
  return { hero: hero.length >= 3 ? hero : pool.slice(0, 7), rows: rows.filter((r) => r.items.length > 0), genres, pool };
}

/** Grid for a selected genre chip (prototype `catView`: up to 12 titles). */
export function byGenre(feed: Feed, genre: string): Title[] {
  const ci = feed.genres.indexOf(genre);
  if (ci < 0) return [];
  return pickGenre(feed.pool, feed.genres, ci).slice(0, 12);
}

export async function loadSection(section: Section, option?: string, o: LoadOpts = {}): Promise<Feed> {
  await loadGenres();
  const groups = sourcesFor(section, option, o.light);
  let pool: Title[] = [];
  if (section === 'drama' && (option || '') === 'Pakistani Drama') {
    const ur = await list(groups[0]).catch(() => [] as Title[]);
    pool = ur.length >= 6 ? ur : await list(groups[1]);
  } else {
    pool = await list(groups[0]);
  }
  return buildFeed(section, option, pool, o.because);
}
