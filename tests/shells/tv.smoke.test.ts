// Boots the TV shell, walks every view with remote keys, opens the player.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mockFetch } from './tmdb-mock';
import { configureTmdb } from '../../src/core/tmdb';

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const key = (keyCode: number, key = 'Unidentified') => dispatchEvent(new KeyboardEvent('keydown', { keyCode, key } as KeyboardEventInit));

describe('tv shell smoke', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => mockFetch(String(u))));
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    document.documentElement.dataset.shell = 'tv';
    document.body.innerHTML = '<div id="app"></div>';
  });
  it('navigates with the remote', async () => {
    await import('../../src/shells/tv/main');
    configureTmdb({ token: 'k'.repeat(80), storage: 'none', fetch: (u) => Promise.resolve(mockFetch(String(u))) });
    const { S } = await import('../../src/shells/tv/state');
    const views = ['home', 'anime', 'drama', 'tv', 'music', 'library', 'settings', 'search'];
    for (const v of views) {
      const nv = document.querySelector<HTMLElement>(`#side [data-go="${v}"]`)!;
      nv.click();
      await wait();
      expect(S.view).toBe(v);
    }
    document.querySelector<HTMLElement>('#side [data-go="home"]')!.click();
    await wait(80);
    expect(document.querySelectorAll('#main .pt').length).toBeGreaterThan(5);
    expect(document.querySelectorAll('*').length).toBeLessThan(1500);
    // arrows move focus, OK opens info
    key(40); await wait(100); key(40); await wait(100);
    document.querySelector<HTMLElement>('#main .rail .pt')!.click();
    await wait(80);
    expect(S.view).toBe('info');
    expect(document.querySelector('#main')!.textContent).toContain('Season 1');
    // play an episode → fullscreen player with one <video>
    document.querySelector<HTMLElement>('#main .ep')!.click();
    await wait();
    expect(document.querySelectorAll('#player video').length).toBe(1);
    key(85); key(90); key(89);
    key(4); // Back closes the player
    await wait();
    expect(document.querySelector('#player')).toBeNull();
    key(4); await wait();
    expect(S.view).toBe('home');
    // TV sports tab
    document.querySelector<HTMLElement>('#side [data-go="tv"]')!.click();
    await wait();
    document.querySelector<HTMLElement>('[data-v="Sports"]')!.click();
    await wait();
    expect(document.querySelector('#main')!.textContent).toContain('Highlights');
  }, 30000);
});
