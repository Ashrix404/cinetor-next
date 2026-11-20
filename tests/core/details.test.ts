import { describe, expect, it } from 'vitest';
import { mapDetails } from '../../src/core/details';
import type { Title } from '../../src/core/tmdb';

const tv: Title = { id: 1, mediaType: 'tv', title: 'Dark', poster: '/p', backdrop: '/b', rating: 8.4, year: '2017', overview: '', genreIds: [] };

describe('mapDetails', () => {
  it('maps a tv show', () => {
    const d = mapDetails(tv, {
      overview: 'Time travel.', tagline: 'Everything is connected', episode_run_time: [52], genres: [{ id: 18, name: 'Drama' }],
      seasons: [{ season_number: 0, episode_count: 3 }, { season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 8 }],
      created_by: [{ name: 'Baran bo Odar' }], content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
      credits: { cast: [{ id: 9, name: 'Louis', character: 'Jonas', profile_path: '/l.jpg' }], crew: [] },
      videos: { results: [{ site: 'YouTube', type: 'Teaser', key: 't1' }, { site: 'YouTube', type: 'Trailer', key: 'tr' }] },
      similar: { results: [{ id: 2, name: 'X', poster_path: '/x' }, { id: 3, name: 'Y', poster_path: null }] },
      first_air_date: '2017-12-01',
    });
    expect(d.seasons).toEqual([10, 8]);
    expect(d.trailerKey).toBe('tr');
    expect(d.maturity).toBe('TV-MA');
    expect(d.runtime).toBe(52);
    expect(d.cast[0]).toEqual({ id: 9, name: 'Louis', character: 'Jonas', photo: '/l.jpg' });
    expect(d.similar.map((x) => x.title)).toEqual(['X']);
    expect(d.facts[0]).toEqual(['Created by', 'Baran bo Odar']);
  });
  it('maps a movie with no extras', () => {
    const d = mapDetails({ ...tv, mediaType: 'movie' }, { runtime: 120 });
    expect(d.seasons).toEqual([]);
    expect(d.trailerKey).toBeNull();
    expect(d.maturity).toBe('PG-13');
    expect(d.runtime).toBe(120);
  });
});
