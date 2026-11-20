import { describe, expect, it } from 'vitest';
import { enginesFor, isHlsUrl, proxify, preserveTimestamp, restoreTimestamp, getActiveEngine, getActiveHls } from '../../src/core/playback';
import { isPlaylist, LIVE, mergeGatewayChannels, pickChannel, usableChannelUrl } from '../../src/core/live';
import { buildEmbeds, hostOf, nextUntried } from '../../src/core/embeds';
import { parseResolve } from '../../src/core/stream-resolver';
import { playDirect } from '../../src/core/direct-play';
import type { MediaSrc } from '../../src/core/sources';

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
  it('preserves timestamp from video element or fallback', () => {
    expect(preserveTimestamp(null, 15)).toBe(15);
    const fakeVideo = { currentTime: 42.5 } as HTMLVideoElement;
    expect(preserveTimestamp(fakeVideo, 0)).toBe(42.5);
    const zeroVideo = { currentTime: 0 } as HTMLVideoElement;
    expect(preserveTimestamp(zeroVideo, 30)).toBe(30);
    const nanVideo = { currentTime: NaN } as HTMLVideoElement;
    expect(preserveTimestamp(nanVideo, 20)).toBe(20);
  });
  it('restores timestamp on ready or loadedmetadata', () => {
    let sought = 0;
    const readyVideo = {
      readyState: 2,
      set currentTime(val: number) { sought = val; },
      get currentTime() { return sought; },
      addEventListener: () => {},
    } as unknown as HTMLVideoElement;
    restoreTimestamp(readyVideo, 85);
    expect(sought).toBe(85);

    let eventCb: (() => void) | undefined;
    let notReadySought = 0;
    const notReadyVideo = {
      readyState: 0,
      set currentTime(val: number) { notReadySought = val; },
      get currentTime() { return notReadySought; },
      addEventListener: (_ev: string, cb: () => void) => { eventCb = cb; },
    } as unknown as HTMLVideoElement;
    restoreTimestamp(notReadyVideo, 120);
    expect(notReadySought).toBe(0);
    eventCb?.();
    expect(notReadySought).toBe(120);
  });
  it('tracks active engine and hls instance', () => {
    expect(getActiveEngine()).toBeNull();
    expect(getActiveHls()).toBeNull();
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

describe('embed players', () => {
  it('ranked by probe evidence, one per host (gateway url kept for its host)', () => {
    const s = buildEmbeds(['https://vidlink.pro/movie/603', 'https://vidsrc.to/embed/movie/603', 'https://www.vidlink.pro/x', 'https://autoembed.co/movie/tmdb/603'], 'movie', 603);
    expect(s[0].url).toBe('https://vidsrc.su/movie/603');
    expect(s[1].url).toContain('vidsrc.wtf');
    expect(s[2]).toEqual({ url: 'https://vidlink.pro/movie/603' });
    expect(s.findIndex((x) => x.url.includes('autoembed.co'))).toBe(6);
    expect(s.map((x) => hostOf(x.url)).filter((h) => h === 'vidlink.pro').length).toBe(1);
    expect(s.length).toBeGreaterThan(2);
  });
  it('tv urls carry season and episode', () => {
    for (const x of buildEmbeds([], 'tv', 1396, 2, 5)) expect(x.url).toMatch(/1396.*2.*5/);
  });
  it('keeps hosts that were dead in the probe, as the last resort', () => {
    const r = buildEmbeds(['https://vidsrc.xyz/embed/movie/1'], 'movie', 1);
    const i = r.findIndex((x) => x.url.includes('vidsrc.xyz'));
    expect(i).toBeGreaterThan(r.findIndex((x) => x.url.includes('vidfast.pro')));
    expect(i).toBeGreaterThan(r.findIndex((x) => x.url.includes('vidrock.net')));
  });
  it('failover visits every player once then stops', () => {
    const tried = new Set([0]);
    expect(nextUntried(3, 0, tried)).toBe(1);
    tried.add(1);
    expect(nextUntried(3, 1, tried)).toBe(2);
    tried.add(2);
    expect(nextUntried(3, 2, tried)).toBe(-1);
  });
  it('parseResolve keeps gateway embeds and adds extra players, no display names', () => {
    const r = parseResolve(
      { embedUrl: 'https://vidlink.pro/movie/603', sources: [{ name: 'VidSrc 2 (1080p)', url: 'https://vidsrc.to/embed/movie/603', isDirect: false }], subtitles: [{ lang: 'en' }] },
      { type: 'movie', id: 603 }
    )!;
    expect(r.embeds.some((x) => x.url.includes('vidsrc.to'))).toBe(true);
    expect(r.embeds.every((x) => Object.keys(x).join() === 'url')).toBe(true);
    expect(r.direct).toEqual([]);
    expect(r.subtitles).toEqual([]);
  });
  it('without the gateway there are still embed players (they need no gateway)', () => {
    expect(parseResolve({ sources: [] }, { type: 'movie', id: 603 })?.embeds.length).toBeGreaterThan(0);
  });
});

describe('direct-play multi-server fallback', () => {
  it('throws when direct media list is empty', async () => {
    const v = {} as HTMLVideoElement;
    await expect(playDirect(v, [])).rejects.toThrow('no direct source');
  });

  it('aborts when alive() check returns false', async () => {
    const v = {} as HTMLVideoElement;
    const list: MediaSrc[] = [{ url: 'https://cdn.test/1.m3u8', kind: 'hls', quality: 1080, name: 'S1' }];
    await expect(playDirect(v, list, { alive: () => false })).rejects.toThrow('cancelled');
  });
});
