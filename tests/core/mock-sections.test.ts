import { describe, expect, it } from 'vitest';
import { crestOf, HILITES, matchesFor, spCounts, SPORT } from '../../src/core/sports';
import { channelsIn, LIVE_ALL } from '../../src/core/live';
import { genrePlaylists, trackUrl } from '../../src/core/music';

describe('sports (prototype counts)', () => {
  it('counts per sport equal the prototype', () => {
    expect(spCounts('All').All).toBe(18);
    expect(spCounts('Basketball').All).toBe(4);
    expect(spCounts('Cricket').All).toBe(9);
    expect(spCounts('Motorsports').All).toBe(2);
    expect(spCounts('WWE').All).toBe(2);
    expect(spCounts('Football').All).toBe(1);
    expect(spCounts('All').Upcoming).toBe(4);
    expect(spCounts('All').Live).toBe(9);
    expect(spCounts('All').Highlights).toBe(4);
  });
  it('lists by tab', () => {
    expect(matchesFor('All', 'Upcoming').map((m) => m.id)).toEqual([10, 14, 16, 18]);
    expect(matchesFor('Cricket', 'Highlights')).toEqual([]);
    expect(matchesFor('All', 'Highlights')).toHaveLength(HILITES.length);
    expect(SPORT).toHaveLength(18);
  });
  it('crests use flags or team initials', () => {
    expect(crestOf('India')).toHaveProperty('flag');
    expect(crestOf('San Antonio Spurs')).toEqual({ short: 'SAS', hue: 0, variant: 1 });
    expect(crestOf('Some Team')).toMatchObject({ short: 'ST' });
  });
});

describe('live + music', () => {
  it('channels by category', () => {
    expect(LIVE_ALL.length).toBe(16 + 14 * 2);
    expect(channelsIn('News').every((c) => c[4] === 'News')).toBe(true);
  });
  it('genre playlists and track urls', () => {
    expect(genrePlaylists('Jazz').length).toBeGreaterThan(0);
    expect(genrePlaylists('Nope')).toEqual([]);
    expect(trackUrl('Static Bloom')).toMatch(/music\/track-[1-5]\.mp3$/);
  });
});
