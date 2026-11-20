import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as player from '../../src/shells/tv/player';
import * as playback from '../../src/core/playback';
import * as streamResolver from '../../src/core/stream-resolver';
import type { Title } from '../../src/core/tmdb';

describe('tv player native & server switching', () => {
  const dummyTitle: Title = {
    id: 42,
    title: 'Test Movie',
    mediaType: 'movie',
    overview: 'Test',
    poster: '/p.jpg',
    backdrop: '/b.jpg',
    rating: 8.5,
    year: '2026',
    genreIds: [28],
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="tv"></div>';
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    HTMLMediaElement.prototype.load = vi.fn();
  });

  afterEach(() => {
    player.close();
    vi.restoreAllMocks();
  });

  it('initializes native <video> and never mounts an iframe', async () => {
    const directSources = [
      { name: 'Server 1 - AutoEmbed', quality: 1080, url: 'https://cdn1.test/stream1.m3u8', kind: 'hls' as const },
      { name: 'Server 2 - VidLink', quality: 1080, url: 'https://cdn2.test/stream2.m3u8', kind: 'hls' as const },
    ];
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: 'https://cdn1.test/stream1.m3u8',
      direct: directSources,
      servers: directSources,
      server: directSources[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: [],
      subtitles: [],
    });

    vi.spyOn(playback, 'playUrl').mockResolvedValue('native');
    const toastSpy = vi.fn();

    player.play({ t: dummyTitle }, toastSpy);

    // Verify root player created
    const root = document.getElementById('player');
    expect(root).not.toBeNull();

    // Verify exactly one <video> element and zero <iframe> elements
    const videos = root!.querySelectorAll('video');
    const iframes = root!.querySelectorAll('iframe');
    expect(videos.length).toBe(1);
    expect(iframes.length).toBe(0);

    // Wait microtask for stream resolution
    await Promise.resolve();
    await Promise.resolve();

    expect(player.P).not.toBeNull();
    expect(player.P!.servers.length).toBe(2);
    expect(player.P!.serverIdx).toBe(0);
    expect(player.P!.servers[0].name).toBe('Server 1 - AutoEmbed');

    // UI shows server button and badge
    expect(root!.querySelector('[data-m="server"]')).not.toBeNull();
    expect(root!.textContent).toContain('Server 1 - AutoEmbed');
  });

  it('switches server manually through menu, preserves timestamp and toasts', async () => {
    const directSources = [
      { name: 'Server 1 - AutoEmbed', quality: 1080, url: 'https://cdn1.test/stream1.m3u8', kind: 'hls' as const },
      { name: 'Server 2 - VidLink', quality: 1080, url: 'https://cdn2.test/stream2.m3u8', kind: 'hls' as const },
      { name: 'Server 3 - MovieBox', quality: 720, url: 'https://cdn3.test/stream3.mp4', kind: 'mp4' as const },
    ];
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: 'https://cdn1.test/stream1.m3u8',
      direct: directSources,
      servers: directSources,
      server: directSources[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: [],
      subtitles: [],
    });

    const playUrlSpy = vi.spyOn(playback, 'playUrl').mockResolvedValue('native');
    const toastSpy = vi.fn();

    player.play({ t: dummyTitle }, toastSpy);
    await Promise.resolve();
    await Promise.resolve();

    // Simulate current playback time
    const video = document.querySelector<HTMLVideoElement>('#player video')!;
    Object.defineProperty(video, 'currentTime', { value: 125, writable: true });

    // Open server menu
    player.menu('server');
    const menuEl = document.querySelector<HTMLElement>('#player .menu');
    expect(menuEl).not.toBeNull();
    expect(menuEl!.textContent).toContain('Server 1 - AutoEmbed');
    expect(menuEl!.textContent).toContain('Server 2 - VidLink');
    expect(menuEl!.textContent).toContain('Server 3 - MovieBox');

    // Pick Server 2 (index 1)
    player.pick('server', '1');

    expect(player.P!.serverIdx).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith('Switched to Server 2 - VidLink');
    expect(playUrlSpy).toHaveBeenCalledWith(
      expect.anything(),
      'https://cdn2.test/stream2.m3u8',
      expect.objectContaining({ at: 125 })
    );

    // Menu closes after picking
    expect(document.querySelector('#player .menu')).toBeNull();
    expect(document.querySelector('#player')!.textContent).toContain('Server 2 - VidLink');
  });

  it('triggers auto-failover to next server on error with preserved timestamp', async () => {
    const directSources = [
      { name: 'Primary Server', quality: 1080, url: 'https://cdn1.test/stream1.m3u8', kind: 'hls' as const },
      { name: 'Backup Server', quality: 1080, url: 'https://cdn2.test/stream2.m3u8', kind: 'hls' as const },
    ];
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: 'https://cdn1.test/stream1.m3u8',
      direct: directSources,
      servers: directSources,
      server: directSources[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: [],
      subtitles: [],
    });

    const playUrlSpy = vi.spyOn(playback, 'playUrl').mockResolvedValue('native');
    const toastSpy = vi.fn();

    player.play({ t: dummyTitle }, toastSpy);
    await Promise.resolve();
    await Promise.resolve();

    expect(player.P!.serverIdx).toBe(0);

    const video = document.querySelector<HTMLVideoElement>('#player video')!;
    Object.defineProperty(video, 'currentTime', { value: 75, writable: true });

    // Trigger video error event
    video.dispatchEvent(new Event('error'));
    await Promise.resolve();
    await Promise.resolve();

    expect(player.P!.serverIdx).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-failover to Backup Server'));
    expect(playUrlSpy).toHaveBeenLastCalledWith(
      expect.anything(),
      'https://cdn2.test/stream2.m3u8',
      expect.objectContaining({ at: 75 })
    );
  });
});
