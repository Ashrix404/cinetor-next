// Fake TMDB + media server for shell smoke tests.
const item = (i: number, tv: boolean) => ({
  id: 1000 + i, media_type: tv ? 'tv' : 'movie', [tv ? 'name' : 'title']: (tv ? 'Show ' : 'Movie ') + i,
  poster_path: '/p' + i + '.jpg', backdrop_path: '/b' + i + '.jpg', vote_average: 7.1, overview: 'Overview ' + i,
  [tv ? 'first_air_date' : 'release_date']: '2024-01-0' + ((i % 9) + 1), genre_ids: [18, 28, 16][i % 3] ? [[18, 28, 16][i % 3]] : [], popularity: 100 - i,
});
export function mockFetch(url: string): Response {
  const u = new URL(url);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.hostname.includes('themoviedb')) {
    const p = u.pathname.replace('/3', '');
    if (p.startsWith('/genre/')) return json({ genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }, { id: 16, name: 'Animation' }] });
    if (/^\/(tv|movie)\/\d+\/season\/\d+$/.test(p)) return json({ episodes: Array.from({ length: 6 }, (_, i) => ({ episode_number: i + 1, name: 'Ep ' + (i + 1), runtime: 44, still_path: '/s.jpg', overview: '' })) });
    if (/^\/(tv|movie)\/\d+$/.test(p)) {
      const tv = p.startsWith('/tv');
      return json({ ...item(1, tv), runtime: 100, episode_run_time: [44], tagline: 'Tag', genres: [{ id: 18, name: 'Drama' }], seasons: tv ? [{ season_number: 1, episode_count: 6 }, { season_number: 2, episode_count: 4 }] : undefined,
        credits: { cast: [{ id: 7, name: 'Ann Lee', character: 'Hero', profile_path: '/a.jpg' }], crew: [{ job: 'Director', name: 'Dee', department: 'Directing' }] },
        videos: { results: [{ site: 'YouTube', type: 'Trailer', key: 'abc' }] }, similar: { results: [item(5, tv), item(6, tv)] } });
    }
    if (/^\/person\/\d+$/.test(p)) return json({ name: 'Ann Lee', profile_path: '/a.jpg', known_for_department: 'Acting', biography: 'Bio' });
    if (p.endsWith('/combined_credits')) return json({ cast: [item(1, false), item(2, true)] });
    return json({ page: 1, total_pages: 1, results: Array.from({ length: 20 }, (_, i) => item(i, p.includes('/tv') || i % 2 === 0)) });
  }
  if (url.endsWith('.vtt')) return new Response('WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nHello\n');
  if (url.endsWith('version.json')) return json({ version: '0.0.0-dev' });
  return new Response('', { status: 404 });
}
