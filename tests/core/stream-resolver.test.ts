import { describe, expect, it } from 'vitest';
import { isDirectMedia, parseResolve } from '../../src/core/stream-resolver';
import { seekDelta } from '../../src/core/player-model';

const gw = {
  embedUrl: 'https://vidlink.pro/movie/603',
  sources: [
    { name: 'VidLink', quality: 1080, url: 'https://vidlink.pro/movie/603', type: 'hls', isDirect: false },
    { name: 'VidSrc', quality: 1080, url: 'https://vidsrc.to/embed/movie/603', type: 'hls', isDirect: false },
  ],
};

describe('stream resolver', () => {
  it('never treats an embed page as a direct file', () => {
    const r = parseResolve(gw)!;
    expect(r.url).toBe('');
    expect(r.embeds.map((x) => x.url)).toEqual(['https://vidlink.pro/movie/603', 'https://vidsrc.to/embed/movie/603']);
  });
  it('picks a real media file and still keeps embeds as fallback', () => {
    const r = parseResolve({ ...gw, sources: [...gw.sources, { name: 'CDN', quality: 720, url: 'https://x.test/a/master.m3u8?t=1', type: 'hls' }] })!;
    expect(r.url).toBe('https://x.test/a/master.m3u8?t=1');
    expect(r.embeds.length).toBe(2);
  });
  it('returns null when nothing is playable', () => {
    expect(parseResolve({ sources: [] })).toBeNull();
    expect(parseResolve(null)).toBeNull();
  });
  it('isDirectMedia', () => {
    expect(isDirectMedia('https://a/b.mp4')).toBe(true);
    expect(isDirectMedia('https://vidsrc.to/embed/tv/1/1/1')).toBe(false);
    expect(isDirectMedia('https://a/play', true)).toBe(true);
  });
});

describe('seek gesture', () => {
  it('maps drag distance to seconds', () => {
    expect(seekDelta(100, 400)).toBe(30);
    expect(seekDelta(-200, 400)).toBe(-60);
    expect(seekDelta(5, 0)).toBe(600);
  });
});
