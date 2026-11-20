// Calls the real TMDB API in CI (only when the TMDB_TOKEN secret is present) and checks every field we read.
import { describe, expect, it } from 'vitest';
import { configureTmdb, tmdbGet } from '../../src/core/tmdb';

const token: string = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TMDB_TOKEN || '';
// `any`: raw API payloads, the point of this test is to prove the fields exist.
type Any = Record<string, any>;

describe.skipIf(!token)('TMDB contract', () => {
  configureTmdb({ token, storage: 'none' });
  const has = (o: Any, keys: string[]) => keys.forEach((k) => expect(o, k).toHaveProperty(k));

  it('trending, tv details, season, person, search, genres', async () => {
    const tr = await tmdbGet<Any>('/trending/all/week');
    expect(tr.results.length).toBeGreaterThan(5);
    has(tr.results[0], ['id', 'media_type', 'poster_path', 'backdrop_path', 'vote_average', 'overview', 'genre_ids']);
    const pop = await tmdbGet<Any>('/tv/popular');
    const tvId = pop.results[0].id;
    has(pop.results[0], ['name', 'first_air_date']);

    const tv = await tmdbGet<Any>('/tv/' + tvId, { append_to_response: 'credits,videos,similar' });
    has(tv, ['name', 'seasons', 'number_of_seasons', 'genres', 'episode_run_time', 'tagline']);
    has(tv.credits, ['cast']);
    has(tv.videos, ['results']);
    has(tv.similar, ['results']);
    const cast = tv.credits.cast[0];
    has(cast, ['id', 'name', 'character', 'profile_path']);

    const s1 = await tmdbGet<Any>('/tv/' + tvId + '/season/1');
    has(s1.episodes[0], ['episode_number', 'name', 'runtime', 'still_path', 'overview']);

    const pc = await tmdbGet<Any>('/person/' + cast.id + '/combined_credits');
    has(pc, ['cast']);
    has(pc.cast[0], ['id', 'media_type']);

    const se = await tmdbGet<Any>('/search/multi', { query: 'avatar' });
    expect(se.results.length).toBeGreaterThan(0);
    has(se.results[0], ['id', 'media_type']);

    const g = await tmdbGet<Any>('/genre/movie/list');
    has(g.genres[0], ['id', 'name']);

    const mv = await tmdbGet<Any>('/movie/popular');
    const m = await tmdbGet<Any>('/movie/' + mv.results[0].id, { append_to_response: 'credits,videos,similar,release_dates' });
    has(m, ['title', 'runtime', 'release_date', 'genres', 'tagline', 'release_dates']);
  }, 30000);
});
