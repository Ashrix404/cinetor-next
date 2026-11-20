import { describe, expect, it } from 'vitest';
import {
  clearStreamCache,
  detectServer,
  formatServerLabel,
  getStreamCache,
  isDirectMedia,
  parseResolve,
} from '../../src/core/stream-resolver';
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
    expect(r.direct).toEqual([]);
    expect(r.servers.every((s) => s.isDirect === false)).toBe(true);
  });

  it('picks a real media file and still keeps embeds as fallback', () => {
    const r = parseResolve({
      ...gw,
      sources: [
        ...gw.sources,
        { name: 'AutoEmbed Master', quality: 1080, url: 'https://x.test/a/master.m3u8?t=1', type: 'hls', isDirect: true },
        { name: 'MovieBox Direct', quality: 720, url: 'https://x.test/b/video.mp4', type: 'mp4', isDirect: true },
      ],
    })!;
    expect(r.url).toBe('https://x.test/a/master.m3u8?t=1');
    expect(r.direct.length).toBe(2);
    expect(r.embeds.length).toBe(2);
    // Direct servers first, then embed fallbacks
    expect(r.servers.length).toBe(4);
    expect(r.servers[0].isDirect).toBe(true);
    expect(r.servers[0].url).toBe('https://x.test/a/master.m3u8?t=1');
    expect(r.servers[1].isDirect).toBe(true);
    expect(r.servers[1].url).toBe('https://x.test/b/video.mp4');
    expect(r.servers[2].isDirect).toBe(false);
    expect(r.servers[3].isDirect).toBe(false);
    expect(r.serverIndex).toBe(0);
    expect(r.server).toContain('Server 1');
  });

  it('returns null when nothing is playable', () => {
    expect(parseResolve({ sources: [] })).toBeNull();
    expect(parseResolve(null)).toBeNull();
  });

  it('isDirectMedia identifies direct video files, manifests, and proxy URLs', () => {
    expect(isDirectMedia('https://a/b.mp4')).toBe(true);
    expect(isDirectMedia('https://a/b.m3u8')).toBe(true);
    expect(isDirectMedia('https://cdn.test/stream/master?token=123')).toBe(true);
    expect(isDirectMedia('https://cdn.test/hls/manifest.m3u8')).toBe(true);
    expect(isDirectMedia('https://gateway.cinetor.app/v1/proxy?url=https%3A%2F%2Fcdn.test%2Fa')).toBe(true);
    expect(isDirectMedia('https://vidsrc.to/embed/tv/1/1/1')).toBe(false);
    expect(isDirectMedia('https://a/play', true)).toBe(true);
    expect(isDirectMedia('https://a/b.mp4', false)).toBe(false);
    expect(isDirectMedia('')).toBe(false);
  });

  it('detectServer detects provider name from server field, source name, or url', () => {
    expect(detectServer({ server: 'AutoEmbed' })).toBe('AutoEmbed');
    expect(detectServer({ name: 'MovieBox Direct', url: 'https://mzfi.me/stream/1' })).toBe('MovieBox');
    expect(detectServer({ name: 'AutoEmbed HLS', url: 'https://autoembed.co/stream.m3u8' })).toBe('AutoEmbed');
    expect(detectServer({ name: 'VidLink Direct', url: 'https://vidlink.pro/play' })).toBe('VidLink');
    expect(detectServer({ name: 'VidSrc Pro', url: 'https://vidsrc.to/embed/1' })).toBe('VidSrc');
    expect(detectServer({ name: 'Pixeldrain 1080p', url: 'https://pixeldrain.com/api/file/xyz' })).toBe('Pixeldrain');
    expect(detectServer({ name: 'Cloudflare Stream', url: 'https://r2.cinetor.net/movie.mp4' })).toBe('Cloudflare R2');
    expect(detectServer({ name: 'VegaHub Mirror', url: 'https://hubcloud.club/video' })).toBe('VegaHub');
    expect(detectServer({ name: 'HiAnime Episode', url: 'https://hianime.to/watch' })).toBe('HiAnime');
    expect(detectServer({ name: 'KissKh Stream', url: 'https://kisskh.co/watch' })).toBe('KissKh');
    expect(detectServer({ name: 'MultiEmbed Fast', url: 'https://multiembed.mov/direct' })).toBe('MultiEmbed');
    expect(detectServer({ name: 'Custom Stream', url: 'https://unknown.cdn/media.mp4' })).toBe('Direct');
  });

  it('formatServerLabel constructs readable server labels with numbering and quality', () => {
    expect(formatServerLabel(0, 'AutoEmbed Direct', 'AutoEmbed', 1080, true)).toBe('Server 1 - AutoEmbed Direct 1080p');
    expect(formatServerLabel(1, 'MovieBox 720p', 'MovieBox', 720, true)).toBe('Server 2 - MovieBox 720p');
    expect(formatServerLabel(2, 'VidLink Embed', 'VidLink', 1080, false)).toBe('Server 3 - VidLink Embed (Embed)');
    expect(formatServerLabel(0, 'Server 5 - Custom Name', 'Direct', 1080, true)).toBe('Server 1 - Custom Name');
  });

  it('clearStreamCache and getStreamCache manage in-memory session cache', () => {
    const cache = getStreamCache();
    cache.set('test:key', { url: 'https://a/b.mp4', direct: [], servers: [], server: 'Server 1', serverIndex: 0, quality: 1080, embeds: [], sources: [], subtitles: [] });
    expect(cache.has('test:key')).toBe(true);
    clearStreamCache('test:key');
    expect(cache.has('test:key')).toBe(false);

    cache.set('key1', { url: '', direct: [], servers: [], server: '', serverIndex: 0, quality: 720, embeds: [], sources: [], subtitles: [] });
    cache.set('key2', { url: '', direct: [], servers: [], server: '', serverIndex: 0, quality: 720, embeds: [], sources: [], subtitles: [] });
    clearStreamCache();
    expect(cache.size).toBe(0);
  });

  it('preserves proxyUrl or generates proxy fallback when headers require it', () => {
    const r = parseResolve({
      sources: [
        {
          name: 'Restricted Stream',
          quality: 1080,
          url: 'https://restricted.cdn/stream.m3u8',
          type: 'hls',
          isDirect: true,
          headers: { Referer: 'https://restricted.cdn/' },
        },
        {
          name: 'Pre-proxied Stream',
          quality: 720,
          url: 'https://other.cdn/stream.m3u8',
          proxyUrl: 'https://gateway.cinetor.app/v1/proxy?url=https%3A%2F%2Fother.cdn%2Fstream.m3u8',
          type: 'hls',
          isDirect: true,
        },
      ],
    })!;

    expect(r.servers[0].proxyUrl).toContain('/v1/proxy?url=');
    expect(r.servers[1].proxyUrl).toBe('https://gateway.cinetor.app/v1/proxy?url=https%3A%2F%2Fother.cdn%2Fstream.m3u8');
  });
});

describe('seek gesture', () => {
  it('maps drag distance to seconds', () => {
    expect(seekDelta(100, 400)).toBe(30);
    expect(seekDelta(-200, 400)).toBe(-60);
    expect(seekDelta(5, 0)).toBe(600);
  });
});
