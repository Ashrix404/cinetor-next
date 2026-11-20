import { describe, expect, it } from 'vitest';
import { enginesFor, isHlsUrl, proxify } from '../../src/core/playback';
import { isPlaylist, LIVE, mergeGatewayChannels, pickChannel, usableChannelUrl } from '../../src/core/live';
import { buildServers, hostOf, nextUntried } from '../../src/core/embeds';
import { parseResolve } from '../../src/core/stream-resolver';

describe('playback engines', () => {
  const native = { nativeHls: true, mse: true }, chrome = { nativeHls: false, mse: true }, old = { nativeHls: false, mse: false };
  it('detects HLS urls', () => {
    expect(isHlsUrl('https://a/b/master.m3u8?x=1')).toBe(true);
    expect(isHlsUrl('https://a/b.mp4')).toBe(false);
  });
  it('mp4 always goes native', () => expect(enginesFor('https://a/b.mp4', chrome)).toEqual(['native']));
  it('native HLS first, then hls.js, then hls.js through the proxy', () => expect(enginesFor('https://a/x.m3u8', native)).toEqual(['native', 'hls', 'hls-proxy']));
  it('desktop Chrome/Firefox: hls.js then proxy', () => expect(enginesFor('https://a/x.m3u8', chrome)).toEqual(['hls', 'hls-proxy']));
  it('no MSE and no native HLS still tries native (the error card shows)', () => expect(enginesFor('https://a/x.m3u8', old)).toEqual(['native']));
  it('proxify keeps the stream origin as Referer', () => {
    const p = proxify('https://cdn.test/live/a.m3u8');
    expect(p).toContain('/v1/proxy?url=https%3A%2F%2Fcdn.test%2Flive%2Fa.m3u8');
    expect(p).toContain('referer=https%3A%2F%2Fcdn.test%2F');
    expect(proxify('https://cdn.test/a.m3u8', undefined, true)).toMatch(/&_=\d+$/);
  });
});

describe('live channels', () => {
  it('every built-in channel is https HLS on a live host, with a UI category', () => {
    const cats = ['News', 'Entertainment', 'Movies', 'Series', 'Kids', 'Music', 'Sports', 'Documentary', 'Lifestyle', 'Education', 'Religion', 'Comedy', 'Regional', 'Shopping'];
    for (const c of LIVE) {
      expect(usableChannelUrl(c[5]), c[1]).toBe(true);
      expect(cats, c[1]).toContain(c[4]);
    }
    expect(new Set(LIVE.map((c) => c[5])).size).toBe(LIVE.length);
  });
  it('rejects dead, http and non-HLS urls', () => {
    expect(usableChannelUrl('https://tsports.live/live.m3u8')).toBe(false);
    expect(usableChannelUrl('http://1.2.3.4/a/index.m3u8')).toBe(false);
    expect(usableChannelUrl('https://x.test/page.html')).toBe(false);
  });
  it('recognises a real playlist and rejects an HTML page', () => {
    expect(isPlaylist('#EXTM3U\n#EXT-X-VERSION:3')).toBe(true);
    expect(isPlaylist('<!doctype html><html>')).toBe(false);
  });
  it('picks a channel by name, by category hint, else sports', () => {
    expect(pickChannel('BBC News HD')?.[1]).toBe('BBC News HD');
    expect(pickChannel('News 24')?.[4]).toBe('News');
    expect(pickChannel('Cinema One')?.[4]).toBe('Movies');
    expect(pickChannel('Arsenal · Chelsea')?.[4]).toBe('Sports');
  });
  it('merges gateway channels without dead hosts or duplicates', () => {
    const m = mergeGatewayChannels(LIVE, [
      { name: 'T Sports Live', url: 'https://tsports.live/live.m3u8', category: 'Sports' },
      { name: 'Dup', url: LIVE[0][5] },
      { name: 'New One', url: 'https://ok.test/a.m3u8', category: 'Bangla' },
    ]);
    expect(m.length).toBe(LIVE.length + 1);
    expect(m[m.length - 1][4]).toBe('Regional');
  });
});

describe('embed servers', () => {
  it('ranked by probe evidence, one per host (gateway url kept for its host)', () => {
    const s = buildServers(['https://vidlink.pro/movie/603', 'https://vidsrc.to/embed/movie/603', 'https://www.vidlink.pro/x', 'https://autoembed.co/movie/tmdb/603'], 'movie', 603);
    expect(s[0].url).toBe('https://vidsrc.su/movie/603');
    expect(s[1].url).toContain('vidsrc.wtf');
    expect(s[2]).toEqual({ name: 'VidLink', url: 'https://vidlink.pro/movie/603' });
    expect(s[s.length - 1].url).toContain('autoembed.co');
    expect(s.map((x) => hostOf(x.url)).filter((h) => h === 'vidlink.pro').length).toBe(1);
    expect(s.length).toBeGreaterThan(2);
  });
  it('tv urls carry season and episode', () => {
    for (const x of buildServers([], 'tv', 1396, 2, 5)) expect(x.url).toMatch(/1396.*2.*5/);
  });
  it('drops dead hosts', () => {
    expect(buildServers(['https://vidsrc.xyz/embed/movie/1'], 'movie', 1).some((x) => x.url.includes('vidsrc.xyz'))).toBe(false);
  });
  it('failover visits every server once then stops', () => {
    const tried = new Set([0]);
    expect(nextUntried(3, 0, tried)).toBe(1);
    tried.add(1);
    expect(nextUntried(3, 1, tried)).toBe(2);
    tried.add(2);
    expect(nextUntried(3, 2, tried)).toBe(-1);
  });
  it('parseResolve names servers and adds extra players', () => {
    const r = parseResolve(
      { embedUrl: 'https://vidlink.pro/movie/603', sources: [{ name: 'VidSrc Server 2 (1080p)', url: 'https://vidsrc.to/embed/movie/603', isDirect: false }], subtitles: [{ lang: 'en' }] },
      { type: 'movie', id: 603 }
    )!;
    expect(r.servers.find((x) => x.url.includes('vidsrc.to'))?.name).toBe('VidSrc');
    expect(r.embeds.length).toBe(r.servers.length);
    expect(r.subtitles).toEqual([]);
  });
  it('without the gateway there are still servers (the embeds need no gateway)', () => {
    expect(parseResolve({ sources: [] }, { type: 'movie', id: 603 })?.servers.length).toBeGreaterThan(0);
  });
});
