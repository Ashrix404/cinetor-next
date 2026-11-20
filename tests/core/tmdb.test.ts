import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTmdbCache, configureTmdb, img, mapTitle, tmdbGet, TmdbAuthError } from '../../src/core/tmdb';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const V4 = 'eyJ' + 'x'.repeat(80);

describe('tmdbGet', () => {
  beforeEach(() => {
    clearTmdbCache();
    sessionStorage.clear();
  });
  it('uses a Bearer header for v4 tokens and adds include_adult=false', async () => {
    const f = vi.fn(async () => ok({ results: [] }));
    configureTmdb({ token: V4, fetch: f as unknown as typeof fetch, storage: 'none' });
    await tmdbGet('/trending/all/week', { page: '1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('include_adult=false');
    expect(url).not.toContain('api_key');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ' + V4);
  });
  it('uses api_key for v3 keys', async () => {
    const f = vi.fn(async () => ok({}));
    configureTmdb({ token: 'abc123', fetch: f as unknown as typeof fetch, storage: 'none' });
    await tmdbGet('/genre/movie/list');
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toContain('api_key=abc123');
    expect(url).toContain('include_adult=false');
  });
  it('serves the second call from cache', async () => {
    const f = vi.fn(async () => ok({ n: 1 }));
    configureTmdb({ token: V4, fetch: f as unknown as typeof fetch, storage: 'session', ttlMs: 60000 });
    await tmdbGet('/x');
    const v = await tmdbGet<{ n: number }>('/x');
    expect(v.n).toBe(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('retries once after 429 using Retry-After', async () => {
    const sleep = vi.fn(async () => {});
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? new Response('', { status: 429, headers: { 'Retry-After': '3' } }) : ok({ ok: 1 })));
    configureTmdb({ token: V4, fetch: f as unknown as typeof fetch, sleep, storage: 'none' });
    const v = await tmdbGet<{ ok: number }>('/y');
    expect(v.ok).toBe(1);
    expect(sleep).toHaveBeenCalledWith(3000);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('throws TmdbAuthError on 401', async () => {
    const f = vi.fn(async () => new Response('', { status: 401 }));
    configureTmdb({ token: V4, fetch: f as unknown as typeof fetch, storage: 'none' });
    await expect(tmdbGet('/z')).rejects.toBeInstanceOf(TmdbAuthError);
  });
  it('returns stale cache when the network fails', async () => {
    let fail = false;
    const f = vi.fn(async () => {
      if (fail) throw new TypeError('offline');
      return ok({ v: 7 });
    });
    configureTmdb({ token: V4, fetch: f as unknown as typeof fetch, storage: 'session', ttlMs: 0 });
    await tmdbGet('/s');
    fail = true;
    const v = await tmdbGet<{ v: number }>('/s');
    expect(v.v).toBe(7);
  });
});

describe('mapTitle', () => {
  it('maps a movie', () => {
    const t = mapTitle({ id: 1, title: 'Dune', poster_path: '/p.jpg', backdrop_path: '/b.jpg', vote_average: 7.86, release_date: '2021-09-15', overview: 'o', genre_ids: [878] });
    expect(t).toEqual({ id: 1, mediaType: 'movie', title: 'Dune', poster: '/p.jpg', backdrop: '/b.jpg', rating: 7.9, year: '2021', overview: 'o', genreIds: [878] });
  });
  it('maps a tv show', () => {
    const t = mapTitle({ id: 2, media_type: 'tv', name: 'Dark', first_air_date: '2017-12-01', vote_average: 8.4 });
    expect(t.mediaType).toBe('tv');
    expect(t.title).toBe('Dark');
    expect(t.year).toBe('2017');
    expect(t.poster).toBeNull();
    expect(t.genreIds).toEqual([]);
  });
  it('builds image URLs', () => {
    expect(img('/a.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/a.jpg');
    expect(img(null, 'w342')).toBe('');
  });
});
