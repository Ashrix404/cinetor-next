// Desktop player unit tests: native controls, multi-server switching, and auto-failover.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { dpl, play, switchServer, failoverServer, Player } from '../../src/shells/desktop/player';
import * as streamResolver from '../../src/core/stream-resolver';
import * as directPlay from '../../src/core/direct-play';
import { initialState, MOCK_SEASONS } from '../../src/core/player-model';
import type { Title } from '../../src/core/tmdb';

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 40)));

describe('desktop player server switching', () => {
  let root: HTMLElement;

  const mockTitle: Title = {
    id: 501,
    title: 'Interstellar Odyssey',
    mediaType: 'movie',
    poster: '/poster.jpg',
    backdrop: '/backdrop.jpg',
    rating: 8.8,
    year: '2025',
    overview: 'Deep space mission',
    genreIds: [878, 12],
  };

  const mockServers = [
    { url: 'https://cdn1.example/movie.m3u8', name: 'Server 1 - VidLink 1080p', kind: 'hls' as const, quality: 1080 },
    { url: 'https://cdn2.example/movie.m3u8', name: 'Server 2 - AutoEmbed 1080p', kind: 'hls' as const, quality: 1080 },
    { url: 'https://cdn3.example/movie.mp4', name: 'Server 3 - MovieBox 720p', kind: 'mp4' as const, quality: 720 },
  ];

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    dpl.set({
      on: false,
      title: null,
      live: '',
      st: initialState({ titleId: 0, title: '', mediaType: 'movie' }),
      seasons: MOCK_SEASONS,
      pip: false,
      embedUrl: null,
      loading: false,
      embeds: [],
      servers: [],
      serverIndex: 0,
      server: '',
      switchToast: null,
    });
  });

  afterEach(async () => {
    await flush();
    root.remove();
    vi.restoreAllMocks();
    dpl.set({
      on: false,
      title: null,
      live: '',
      st: initialState({ titleId: 0, title: '', mediaType: 'movie' }),
      seasons: MOCK_SEASONS,
      pip: false,
      embedUrl: null,
      loading: false,
      embeds: [],
      servers: [],
      serverIndex: 0,
      server: '',
      switchToast: null,
    });
  });

  it('renders native controls, server pill, and displays active server', async () => {
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: mockServers[0].url,
      direct: mockServers,
      servers: mockServers,
      server: mockServers[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: mockServers.map((s) => ({ ...s, type: s.kind })),
      subtitles: [],
    });
    vi.spyOn(directPlay, 'playDirect').mockResolvedValue(mockServers[0]);

    await act(() => render(<Player />, root));
    await act(() => play(mockTitle, 1, 1));
    await flush();

    const state = dpl.get();
    expect(state.on).toBe(true);
    expect(state.servers.length).toBe(3);
    expect(state.serverIndex).toBe(0);
    expect(state.server).toBe('Server 1 - VidLink 1080p');

    // Video element must be native HTML5 video
    const video = root.querySelector('video');
    expect(video).not.toBeNull();

    // Server pill in controls
    const serverPills = root.querySelectorAll('button[title="Switch Server"]');
    expect(serverPills.length).toBeGreaterThan(0);
    expect(root.textContent).toContain('Server 1 - VidLink 1080p');
  });

  it('switches server manually with timestamp preservation', async () => {
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: mockServers[0].url,
      direct: mockServers,
      servers: mockServers,
      server: mockServers[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: mockServers.map((s) => ({ ...s, type: s.kind })),
      subtitles: [],
    });
    const playDirectSpy = vi.spyOn(directPlay, 'playDirect').mockResolvedValue(mockServers[0]);

    await act(() => render(<Player />, root));
    await act(() => play(mockTitle, 1, 1));
    await flush();

    const video = root.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 125, writable: true });

    // Switch to Server 2 (index 1)
    playDirectSpy.mockResolvedValue(mockServers[1]);
    await act(() => switchServer(1, 'manual'));
    await flush();

    const state = dpl.get();
    expect(state.serverIndex).toBe(1);
    expect(state.server).toBe('Server 2 - AutoEmbed 1080p');
    expect(state.switchToast).toContain('Switched to Server 2 - AutoEmbed 1080p');
    expect(playDirectSpy).toHaveBeenCalledWith(
      video,
      expect.arrayContaining([expect.objectContaining({ name: 'Server 2 - AutoEmbed 1080p' })]),
      expect.objectContaining({ at: 125 })
    );
  });

  it('performs auto-failover to next server on stall/error', async () => {
    vi.spyOn(streamResolver, 'fetchStream').mockResolvedValue({
      url: mockServers[0].url,
      direct: mockServers,
      servers: mockServers,
      server: mockServers[0].name,
      serverIndex: 0,
      quality: 1080,
      embeds: [],
      sources: mockServers.map((s) => ({ ...s, type: s.kind })),
      subtitles: [],
    });
    const playDirectSpy = vi.spyOn(directPlay, 'playDirect').mockResolvedValue(mockServers[0]);

    await act(() => render(<Player />, root));
    await act(() => play(mockTitle, 1, 1));
    await flush();

    expect(dpl.get().serverIndex).toBe(0);

    // Trigger failover
    playDirectSpy.mockResolvedValue(mockServers[1]);
    await act(() => failoverServer('Network timeout'));
    await flush();

    const state = dpl.get();
    expect(state.serverIndex).toBe(1);
    expect(state.server).toBe('Server 2 - AutoEmbed 1080p');
    expect(state.switchToast).toContain('Auto-failover to Server 2 - AutoEmbed 1080p');
  });
});
