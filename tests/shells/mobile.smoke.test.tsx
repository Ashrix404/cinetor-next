// Renders the whole mobile shell and visits every route; fails on any thrown error.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { mockFetch } from './tmdb-mock';
import { configureTmdb } from '../../src/core/tmdb';

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

describe('mobile shell smoke', () => {
  const errors: unknown[] = [];
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => mockFetch(String(u))));
    configureTmdb({ token: 'k'.repeat(80), storage: 'none', fetch: (u) => Promise.resolve(mockFetch(String(u))) });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    addEventListener('error', (e) => errors.push(e.error));
    document.documentElement.dataset.shell = 'mobile';
  });

  it('renders every screen without throwing', async () => {
    const { App } = await import('../../src/shells/mobile/app');
    const st = await import('../../src/shells/mobile/state');
    const player = await import('../../src/shells/mobile/player/store');
    const root = document.createElement('div');
    document.body.appendChild(root);
    await act(() => render(<App />, root));
    await flush();
    expect(root.querySelector('.nav')).not.toBeNull();
    expect(root.textContent).toContain('CINE');
    const t = { id: 1001, mediaType: 'tv' as const, title: 'Show 1', poster: '/p', backdrop: '/b', rating: 7, year: '2024', overview: '', genreIds: [18] };
    const m = { ...t, id: 1002, mediaType: 'movie' as const, title: 'Movie 2' };
    const routes: [string, Record<string, unknown>?][] = [
      ['anime'], ['drama'], ['comics'], ['tv'], ['settings'], ['music'], ['nowplaying', { title: 'Static Bloom', hue: 10 }], ['watch', { id: 1 }],
      ['info', { t }], ['info', { t: m }], ['info', { t, kind: 'comic' }], ['reader', { t, ch: 214 }], ['person', { id: 7, name: 'Ann Lee' }],
      ['list', { title: 'Trending', items: [t, m] }], ['search'], ['library'], ['downloads'], ['appearance'], ['playerset'], ['substyle'],
      ['prefs'], ['data'], ['adultset'], ['about'],
    ];
    for (const [name, params] of routes) {
      await act(() => st.nav(name, params || {}));
      await flush();
      expect(root.querySelector('#app'), name).not.toBeNull();
    }
    await act(() => st.nav('tv', {}, { root: true }));
    await act(() => st.setOpt('tv', 'Sports'));
    await flush();
    expect(root.textContent).toContain('Highlights');
    // Home feed rows from the mocked TMDB
    await act(() => st.nav('home', {}, { root: true }));
    await flush();
    expect(root.querySelectorAll('.poster').length).toBeGreaterThan(5);
    // inline player → sheets → fullscreen → PiP
    await act(() => st.nav('info', { t }));
    await flush();
    await act(() => player.startAt(t, 1, 1));
    await flush();
    expect(root.querySelector('.ivp')).not.toBeNull();
    for (const s of ['subs', 'subsearch', 'substyle', 'quality', 'server', 'episodes', 'settings', 'audio']) {
      await act(() => st.setUi({ sheet: s }));
      await flush();
      expect(root.querySelector('.sheet'), s).not.toBeNull();
    }
    await act(() => st.setUi({ sheet: false }));
    await act(() => st.nav('player'));
    await flush();
    expect(root.querySelector('#app.land')).not.toBeNull();
    await act(() => st.back());
    await act(() => player.toPip());
    await flush();
    expect(root.querySelector('.pip')).not.toBeNull();
    // download sheet
    const dl = await import('../../src/shells/mobile/dl/sheet');
    await act(() => dl.openDlAll(t, 'series', 1));
    await flush();
    expect(root.querySelector('.dlsheet')).not.toBeNull();
    // PIN create flow opens
    await act(() => st.nav('adultset'));
    await flush();
    expect(errors).toEqual([]);
  }, 30000);
});
