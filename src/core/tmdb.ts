// Typed TMDB client: auth (v4 Bearer or v3 api_key), include_adult=false (except `tmdbAdultGet`),
// cache, 429 retry, 401 error.
import { TMDB_API, TMDB_IMG, TMDB_TOKEN } from './config';

export interface Title {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  year: string;
  overview: string;
  genreIds: number[];
  /** Adult section only: TMDB `adult` flag or tagged by the adult source (src/core/adult.ts). */
  adult?: boolean;
}

export class TmdbError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'TmdbError';
  }
}
export class TmdbAuthError extends TmdbError {
  constructor() {
    super(401, 'TMDB token rejected (401)');
    this.name = 'TmdbAuthError';
  }
}

type CacheEntry = { t: number; v: unknown };
interface Opts {
  token: string;
  ttlMs: number;
  storage: 'session' | 'local' | 'none';
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

const opts: Opts = {
  token: TMDB_TOKEN,
  ttlMs: 10 * 60 * 1000,
  storage: 'session',
  fetch: (...a) => fetch(...a),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};
const mem = new Map<string, CacheEntry>();
/** Adult responses: memory only, never in session/local storage, wiped on lock. */
const adultMem = new Map<string, CacheEntry>();
const KEY = 'cinetor:tmdb:';

/** TV uses localStorage with a 30-minute TTL (docs/09-performance-budgets.md rule 11). */
export function configureTmdb(o: Partial<Opts>): void {
  Object.assign(opts, o);
}
export function clearAdultCache(): void {
  adultMem.clear();
}
export function clearTmdbCache(): void {
  mem.clear();
  adultMem.clear();
  const st = store();
  if (!st) return;
  for (let i = st.length - 1; i >= 0; i--) {
    const k = st.key(i);
    if (k && k.startsWith(KEY)) st.removeItem(k);
  }
}
export function hasToken(): boolean {
  return opts.token.length > 0;
}

function store(): Storage | null {
  try {
    if (opts.storage === 'session') return sessionStorage;
    if (opts.storage === 'local') return localStorage;
  } catch {
    /* blocked */
  }
  return null;
}

function cacheGet(k: string): CacheEntry | null {
  const m = mem.get(k);
  if (m) return m;
  try {
    const raw = store()?.getItem(KEY + k);
    if (raw) {
      const e = JSON.parse(raw) as CacheEntry;
      mem.set(k, e);
      return e;
    }
  } catch {
    /* corrupt entry */
  }
  return null;
}
function cachePut(k: string, v: unknown): void {
  const e = { t: Date.now(), v };
  mem.set(k, e);
  try {
    store()?.setItem(KEY + k, JSON.stringify(e));
  } catch {
    /* quota: memory only */
  }
}

/** `include_adult` is always false; only the adult source (`adult = true`) may set it to true. */
export function buildUrl(path: string, params: Record<string, string> = {}, adult = false): string {
  const u = new URL(TMDB_API + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('include_adult', adult ? 'true' : 'false');
  if (opts.token.length <= 60 && opts.token) u.searchParams.set('api_key', opts.token);
  return u.toString();
}

/**
 * GET a TMDB path. Fresh cache → returned without network. On a network error a stale
 * cache entry is returned when one exists, so the app can still paint the last feed.
 */
export function tmdbGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  return get<T>(path, params, false);
}
/** Adult section only (src/core/adult-source.ts): include_adult=true, separate memory cache. */
export function tmdbAdultGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  return get<T>(path, params, true);
}

async function get<T>(path: string, params: Record<string, string> | undefined, adult: boolean): Promise<T> {
  const url = buildUrl(path, params, adult);
  const key = url.replace(/([?&])api_key=[^&]*/, '$1');
  const hit = adult ? adultMem.get(key) || null : cacheGet(key);
  if (hit && Date.now() - hit.t < opts.ttlMs) return hit.v as T;
  const init: RequestInit = opts.token.length > 60 ? { headers: { Authorization: 'Bearer ' + opts.token, accept: 'application/json' } } : {};
  let res: Response;
  try {
    res = await opts.fetch(url, init);
    if (res.status === 429) {
      const ra = Number(res.headers.get('Retry-After'));
      await opts.sleep((Number.isFinite(ra) && ra > 0 ? ra : 2) * 1000);
      res = await opts.fetch(url, init);
    }
  } catch (e) {
    if (hit) return hit.v as T;
    throw e;
  }
  if (res.status === 401) throw new TmdbAuthError();
  if (!res.ok) {
    if (hit) return hit.v as T;
    throw new TmdbError(res.status, 'TMDB HTTP ' + res.status);
  }
  const v = (await res.json()) as T;
  if (adult) adultMem.set(key, { t: Date.now(), v });
  else cachePut(key, v);
  return v;
}

export type ImgSize = 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280';
export function img(path: string | null, size: ImgSize): string {
  return path ? TMDB_IMG + size + path : '';
}

/** Raw TMDB list item (movie, tv or person result). Only the fields we read. */
export interface RawItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  genre_ids?: number[];
  adult?: boolean;
}

export function mapTitle(raw: RawItem, fallback: 'movie' | 'tv' = 'movie'): Title {
  const mt = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : raw.title ? 'movie' : raw.name ? 'tv' : fallback;
  return {
    id: raw.id,
    mediaType: mt,
    title: raw.title || raw.name || '',
    poster: raw.poster_path ?? null,
    backdrop: raw.backdrop_path ?? null,
    rating: Math.round((raw.vote_average || 0) * 10) / 10,
    year: (raw.release_date || raw.first_air_date || '').slice(0, 4),
    overview: raw.overview || '',
    genreIds: raw.genre_ids || [],
    ...(raw.adult === true ? { adult: true } : {}),
  };
}

export interface Page<T> {
  page: number;
  results: T[];
  total_pages: number;
}
