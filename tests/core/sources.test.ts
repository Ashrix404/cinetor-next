import { describe, expect, it } from 'vitest';
import { cdnHeaders, httpCodeOf, isAdultLink, isHevc, isImageLink, kindOf, LinkHealth, playTarget, rankSources, toMediaSrc, type MediaSrc } from '../../src/core/sources';
import { isDirectMedia, parseResolve } from '../../src/core/stream-resolver';

const src = (url: string, quality: number, kind: MediaSrc['kind'] = 'mp4', name = 'x'): MediaSrc => ({ url, quality, kind, name });

describe('direct sources (v2 ranking)', () => {
  it('Wi-Fi: 1080p first, then 1440p/2160p, then 720p and below', () => {
    const r = rankSources([src('https://a/360.mp4', 360), src('https://a/2160.mp4', 2160), src('https://a/720.mp4', 720), src('https://a/1080.mp4', 1080)], { mobile: false, health: new LinkHealth() });
    expect(r.map((x) => x.quality)).toEqual([1080, 2160, 720, 360]);
  });
  it('mobile data: adaptive HLS first, then the file nearest 720p', () => {
    const r = rankSources([src('https://a/1080.mp4', 1080), src('https://a/480.mp4', 480), src('https://a/720.mp4', 720), src('https://a/m.m3u8', 0, 'hls')], { mobile: true, health: new LinkHealth() });
    expect(r.map((x) => x.url)).toEqual(['https://a/m.m3u8', 'https://a/720.mp4', 'https://a/480.mp4', 'https://a/1080.mp4']);
  });
  it('images, adult links and duplicates are never videos; HEVC goes last', () => {
    const r = rankSources([src('https://a/p.jpg', 1080), src('https://xvideos.example/a.mp4', 1080), src('https://a/x265.mp4', 1080, 'mp4', 'HEVC'), src('https://a/h264.mp4', 720), src('https://a/h264.mp4', 720)], { health: new LinkHealth() });
    expect(r.map((x) => x.url)).toEqual(['https://a/h264.mp4', 'https://a/x265.mp4']);
    expect(isImageLink('https://image.tmdb.org/t/p/w500/a')).toBe(true);
    expect(isAdultLink('https://cdn.example/sexy-movie.mp4')).toBe(false);
    expect(isHevc({ url: 'https://a/Movie.10bit.mkv', name: '' })).toBe(true);
  });
  it('LinkHealth: a refusing host rests 6 h, a missing file is skipped, unless nothing else is left', () => {
    let now = 0;
    const h = new LinkHealth(() => now);
    h.failed('https://bad.example/a.mp4', 403);
    h.failed('https://ok.example/gone.mp4', 404);
    expect(h.refused('https://bad.example/other.mp4')).toBe(true);
    expect(h.refused('https://ok.example/gone.mp4?t=2')).toBe(true);
    expect(h.refused('https://ok.example/fine.mp4')).toBe(false);
    expect(rankSources([src('https://bad.example/a.mp4', 1080), src('https://ok.example/fine.mp4', 480)], { health: h }).map((x) => x.url)).toEqual(['https://ok.example/fine.mp4']);
    expect(rankSources([src('https://bad.example/a.mp4', 1080)], { health: h }).length).toBe(1);
    now = LinkHealth.REST_MS + 1;
    expect(h.refused('https://bad.example/a.mp4')).toBe(false);
  });
  it('kind, headers and HTTP codes', () => {
    expect(kindOf('https://a/x/master.m3u8?t=1')).toBe('hls');
    expect(kindOf('https://a/play', 'hls')).toBe('hls');
    expect(kindOf('https://a/v.mp4')).toBe('mp4');
    expect(cdnHeaders({ Referer: 'https://r/', 'User-Agent': 'x', origin: 'https://r', Cookie: 'a' })).toEqual({ Referer: 'https://r/', Origin: 'https://r' });
    expect(httpCodeOf('Gateway HTTP 429')).toBe(429);
    expect(httpCodeOf('timeout')).toBe(0);
  });
  it('playTarget: APK plays the file itself, a browser proxies an MP4 that needs a Referer and keeps HLS for the proxy engine', () => {
    const mp4: MediaSrc = { url: 'https://cdn.example/v.mp4', kind: 'mp4', quality: 720, name: 'x', headers: { Referer: 'https://ref.example/' } };
    const hls: MediaSrc = { ...mp4, url: 'https://cdn.example/m.m3u8', kind: 'hls' };
    expect(playTarget(mp4, true)).toEqual({ url: mp4.url });
    expect(playTarget(mp4, false).url).toContain('/v1/proxy?url=' + encodeURIComponent(mp4.url));
    expect(playTarget(mp4, false).url).toContain('referer=' + encodeURIComponent('https://ref.example/'));
    expect(playTarget(hls, false)).toEqual({ url: hls.url, referer: 'https://ref.example/' });
    expect(playTarget({ ...mp4, headers: undefined }, false)).toEqual({ url: mp4.url });
  });
  it('toMediaSrc only accepts real media files', () => {
    expect(toMediaSrc({ url: 'https://vidsrc.to/embed/movie/1', type: 'hls', isDirect: false }, isDirectMedia)).toBeNull();
    expect(toMediaSrc({ url: 'https://c/a.m3u8', quality: '1080', name: 'C', headers: { Referer: 'https://r/' } }, isDirectMedia)).toEqual({ url: 'https://c/a.m3u8', kind: 'hls', quality: 1080, name: 'C', headers: { Referer: 'https://r/' } });
  });
  it('parseResolve returns every direct file best first, the embeds after', () => {
    const r = parseResolve(
      { sources: [{ name: 'A', quality: 480, url: 'https://c/a480.mp4', isDirect: true }, { name: 'B', quality: 1080, url: 'https://c/b1080.mp4', isDirect: true }, { name: 'E', url: 'https://vidsrc.to/embed/movie/1', isDirect: false }] },
      { type: 'movie', id: 1 }
    )!;
    expect(r.direct.map((x) => x.quality)).toEqual([1080, 480]);
    expect(r.url).toBe('https://c/b1080.mp4');
    expect(r.embeds.length).toBeGreaterThan(0);
  });
});
