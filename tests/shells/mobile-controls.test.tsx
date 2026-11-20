import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { Vcore, ServerToast } from '../../src/shells/mobile/player/controls';
import { pl } from '../../src/shells/mobile/player/store';
import { ui } from '../../src/shells/mobile/state';

describe('Player Mobile Controls & Server HUD', () => {
  beforeAll(() => {
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    document.documentElement.dataset.shell = 'mobile';
  });

  it('renders ServerToast with glass HUD and auto-clears after timer', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<ServerToast />, root));
    expect(root.textContent).toBe('');

    // Trigger server toast
    await act(() => {
      pl.set({ serverToast: 'VidLink 1080p' });
    });
    await act(() => render(<ServerToast />, root));

    expect(root.textContent).toContain('Server: VidLink 1080p');
    expect(root.querySelector('.sw-toast')).toBeTruthy();

    // Fast forward 3 seconds
    await act(() => {
      vi.advanceTimersByTime(3000);
    });
    await act(() => render(<ServerToast />, root));

    expect(root.querySelector('.sw-toast')).toBeFalsy();
    expect(pl.get().serverToast).toBeNull();

    root.remove();
    vi.useRealTimers();
  });

  it('renders Server pill in top and bottom bar in portrait mode and opens sheet', async () => {
    pl.set({
      active: true,
      servers: [
        { name: 'Server 1 - AutoEmbed', quality: 1080, url: 'https://cdn1.test/master.m3u8', isDirect: true },
        { name: 'Server 2 - VidLink', quality: 1080, url: 'https://cdn2.test/master.m3u8', isDirect: true },
      ],
      serverIndex: 0,
      st: { ...pl.get().st, locked: false, mediaType: 'movie' },
    });

    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<Vcore land={false} onFs={() => {}} />, root));

    // Both top bar and bottom-left row have Server pill
    const srvPills = Array.from(root.querySelectorAll('.pi')).filter(
      (el) => el.getAttribute('aria-label')?.includes('Server')
    );
    expect(srvPills.length).toBeGreaterThanOrEqual(2);
    expect(srvPills[0].textContent).toContain('Server 1');

    // Clicking Server pill triggers sheet('servers')
    (srvPills[0] as HTMLElement).click();
    expect(ui.get().sheet).toBe('servers');

    root.remove();
  });

  it('renders Server pill in landscape mode with native HUD controls', async () => {
    pl.set({
      active: true,
      embedUrl: 'https://player.example.com/embed/123',
      servers: [
        { name: 'Server 1 - AutoEmbed', quality: 1080, url: 'https://cdn1.test/master.m3u8', isDirect: true },
        { name: 'Server 2 - VidLink', quality: 1080, url: 'https://cdn2.test/master.m3u8', isDirect: true },
      ],
      serverIndex: 1,
      st: { ...pl.get().st, locked: false, mediaType: 'tv' },
    });

    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<Vcore land={true} onFs={() => {}} />, root));

    // Native HUD controls always render even when embedUrl is present
    expect(root.querySelector('.pl.c')).toBeTruthy(); // play / rew10 / fwd10
    expect(root.querySelector('.seek')).toBeTruthy(); // seek bar

    const srvPills = Array.from(root.querySelectorAll('.pi')).filter(
      (el) => el.getAttribute('aria-label')?.includes('Server')
    );
    expect(srvPills.length).toBeGreaterThanOrEqual(2);
    expect(srvPills[0].textContent).toContain('Server 2');

    root.remove();
  });

  it('renders Switch Server option in PlayErr when multiple servers exist', async () => {
    pl.set({
      active: true,
      err: 'Playback failed on current server',
      servers: [
        { name: 'Server 1', quality: 1080, url: 'https://cdn1.test/1.m3u8', isDirect: true },
        { name: 'Server 2', quality: 1080, url: 'https://cdn2.test/2.m3u8', isDirect: true },
      ],
      serverIndex: 0,
    });

    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<Vcore land={false} onFs={() => {}} />, root));

    const errCard = root.querySelector('.vg-err');
    expect(errCard).toBeTruthy();
    expect(errCard?.textContent).toContain('Switch Server');

    const switchBtn = Array.from(errCard?.querySelectorAll('b') || []).find((b) =>
      b.textContent?.includes('Switch Server')
    );
    expect(switchBtn).toBeTruthy();
    switchBtn?.click();
    expect(ui.get().sheet).toBe('servers');

    root.remove();
  });
});
