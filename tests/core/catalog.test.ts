import { describe, expect, it } from 'vitest';
import {
  buildFeed,
  byGenre,
  COMIC_OPTIONS,
  DRAMA_OPTIONS,
  dedupe,
  GEN,
  genresOf,
  setGenreMap,
  sourcesFor,
  specialTitles,
} from '../../src/core/catalog';
import type { Title } from '../../src/core/tmdb';

const t = (id: number, title: string, genreIds: number[] = [], poster: string | null = '/p.jpg', backdrop: string | null = '/b.jpg'): Title => ({
  id,
  mediaType: 'movie',
  title,
  poster,
  backdrop,
  rating: 7,
  year: '2024',
  overview: '',
  genreIds,
});

describe('catalog', () => {
  it('dedupes by title and drops items without poster', () => {
    const out = dedupe([t(1, 'A'), t(2, 'A'), t(3, 'B', [], null), t(4, 'C'), t(5, '', [], '/p.jpg')]);
    expect(out.map((x) => x.title)).toEqual(['A', 'C']);
  });

  it('every row has at most 14 unique items', () => {
    const pool = Array.from({ length: 80 }, (_, i) => t(i, 'T' + i, [28]));
    const feed = buildFeed('home', undefined, pool);
    for (const r of feed.rows) {
      expect(r.items.length).toBeLessThanOrEqual(14);
      expect(new Set(r.items.map((x) => x.title)).size).toBe(r.items.length);
    }
    expect(feed.hero).toHaveLength(7);
    expect(feed.genres).toEqual(GEN.home);
    expect(feed.rows[0].title).toBe('Trending');
    expect(feed.rows.some((r) => r.title === 'Because you watched T0')).toBe(true);
    expect(feed.rows.some((r) => r.title === 'Top Action')).toBe(true);
  });

  it('handles custom because title in specialTitles', () => {
    const specials = specialTitles('Interstellar');
    expect(specials[1]).toBe('Because you watched Interstellar');
    expect(specials[0]).toBe('Top 10 today');
  });

  it('the genre filter uses genreIds and normalizes names', () => {
    setGenreMap([
      { id: 28, name: 'Action' },
      { id: 878, name: 'Science Fiction' },
      { id: 10751, name: 'Kids' },
    ]);
    const item = t(1, 'SciFi Kid', [878, 10751]);
    expect(genresOf(item)).toEqual(['Sci-Fi', 'Family']);

    const pool = [t(1, 'A1', [28]), t(2, 'S1', [878]), t(3, 'A2', [28]), t(4, 'A3', [28, 878]), t(5, 'A4', [28]), t(6, 'S2', [878]), t(7, 'S3', [878]), t(8, 'X', [])];
    const feed = buildFeed('home', undefined, pool);
    expect(byGenre(feed, 'Action').map((x) => x.title)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(byGenre(feed, 'Sci-Fi').map((x) => x.title)).toEqual(['S1', 'A3', 'S2', 'S3']);
    expect(byGenre(feed, 'Nope')).toEqual([]);
  });

  it('uses the prototype sources across all sections', () => {
    // anime
    expect(sourcesFor('anime', undefined)[0][0]).toEqual(['/discover/tv', { sort_by: 'popularity.desc', with_genres: '16', with_original_language: 'ja', page: '1' }]);
    // drama options
    expect(sourcesFor('drama', 'K-Drama')[0][0][1]).toMatchObject({ with_original_language: 'ko' });
    expect(sourcesFor('drama', 'C-Drama')[0][0][1]).toMatchObject({ with_original_language: 'zh' });
    expect(sourcesFor('drama', 'J-Drama')[0][0][1]).toMatchObject({ with_original_language: 'ja', with_genres: '18' });
    expect(sourcesFor('drama', 'Pakistani Drama')[1][0][1]).toMatchObject({ with_original_language: 'hi' });
    // comics options
    expect(sourcesFor('comics', 'Manga')[0][0][1]).toMatchObject({ with_genres: '16', with_original_language: 'ja' });
    expect(sourcesFor('comics', 'Manhwa')[0][0][1]).toMatchObject({ with_original_language: 'ko' });
    expect(sourcesFor('comics', 'Manhua')[0][0][1]).toMatchObject({ with_original_language: 'zh' });
    // adult
    expect(sourcesFor('adult', undefined)[0][0][1]).toMatchObject({ include_adult: 'true' });
    // light mode reduces pages
    expect(sourcesFor('home', undefined, true)[0]).toHaveLength(3);
  });

  it('exports expected options constants', () => {
    expect(DRAMA_OPTIONS).toEqual(['K-Drama', 'C-Drama', 'J-Drama', 'Pakistani Drama']);
    expect(COMIC_OPTIONS).toEqual(['Manga', 'Manhwa', 'Manhua']);
  });

  it('falls back to pool slice when backdrops are unavailable', () => {
    const noBackdropPool = Array.from({ length: 10 }, (_, i) => t(i, 'NB' + i, [28], '/p.jpg', null));
    const feed = buildFeed('home', undefined, noBackdropPool);
    expect(feed.hero).toHaveLength(7);
    expect(feed.hero[0].title).toBe('NB0');
  });
});
