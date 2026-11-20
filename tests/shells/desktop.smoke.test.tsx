// Renders the desktop shell and visits every page and overlay.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { mockFetch } from './tmdb-mock';
import { configureTmdb } from '../../src/core/tmdb';

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));

describe('desktop shell smoke', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => mockFetch(String(u))));
    configureTmdb({ token: 'k'.repeat(80), storage: 'none', fetch: (u) => Promise.resolve(mockFetch(String(u))) });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    document.documentElement.dataset.shell = 'desktop';
  });
  it('renders pages, player, reader, download sheet', async () => {
    const { App } = await import('../../src/shells/desktop/app');
    const st = await import('../../src/shells/desktop/state');
    const pl = await import('../../src/shells/desktop/player');
    const root = document.createElement('div');
    document.body.appendChild(root);
    await act(() => render(<App />, root));
    await flush();
    expect(root.querySelector('.top')).not.toBeNull();
    expect(root.querySelectorAll('.pt').length).toBeGreaterThan(5);
    const t = { id: 1001, mediaType: 'tv' as const, title: 'Show 1', poster: '/p', backdrop: '/b', rating: 7, year: '2024', overview: '', genreIds: [18] };
    for (const r of ['anime', 'drama', 'comics', 'tv', 'music', 'search', 'settings', 'library', 'downloads']) {
      await act(() => st.root(r));
      await flush();
    }
    await act(() => st.go('detail', { t }));
    await flush();
    expect(root.textContent).toContain('Episodes');
    await act(() => st.go('person', { id: 7, name: 'Ann Lee' }));
    await flush();
    await act(() => st.setUi({ dls: { t, comic: false, season: 1 } }));
    await flush();
    expect(root.textContent).toContain('Season 1 pre-selected');
    await act(() => st.setUi({ dls: null, reader: { t, ch: 214 } }));
    await flush();
    await act(() => st.setUi({ reader: null }));
    await act(() => pl.play(t, 1, 1));
    await flush();
    expect(root.querySelector('.pl video, .pl iframe')).not.toBeNull(); // video, or an embed player when no direct file exists
  }, 30000);
});
