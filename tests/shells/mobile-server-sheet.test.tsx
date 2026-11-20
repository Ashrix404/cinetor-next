import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { PlayerSheet, ServerBody } from '../../src/shells/mobile/player/sheets';
import { pl } from '../../src/shells/mobile/player/store';
import { setUi, ui } from '../../src/shells/mobile/state';

describe('Player Server Selection Sheet', () => {
  beforeAll(() => {
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    HTMLMediaElement.prototype.load = () => {};
    document.documentElement.dataset.shell = 'mobile';
  });

  it('renders ServerBody with available servers and handles server selection', async () => {
    pl.set({
      active: true,
      servers: [
        { name: 'Server 1 - AutoEmbed', quality: 1080, url: 'https://cdn1.test/master.m3u8', isDirect: true },
        { name: 'Server 2 - VidLink', quality: 1080, url: 'https://cdn2.test/master.m3u8', isDirect: true },
        { name: 'Server 3 - MovieBox', quality: 720, url: 'https://cdn3.test/video.mp4', isDirect: true },
      ],
      serverIndex: 0,
    });

    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<ServerBody />, root));

    expect(root.textContent).toContain('Select Server');
    expect(root.textContent).toContain('Server 1 - AutoEmbed');
    expect(root.textContent).toContain('Server 2 - VidLink');
    expect(root.textContent).toContain('Server 3 - MovieBox');

    // First server has active checkmark
    const opts = root.querySelectorAll('.opt');
    expect(opts.length).toBe(3);
    expect(opts[0].classList.contains('on')).toBe(true);
    expect(opts[1].classList.contains('on')).toBe(false);

    // Clicking second server switches active server
    (opts[1] as HTMLElement).click();

    expect(pl.get().serverIndex).toBe(1);
    root.remove();
  });

  it('PlayerSheet renders when ui.sheet is servers or server', async () => {
    pl.set({
      active: true,
      servers: [
        { name: 'Direct Stream Alpha', quality: 1080, url: 'https://alpha.test/m3u8', isDirect: true },
      ],
      serverIndex: 0,
    });

    setUi({ sheet: 'servers' });
    const root = document.createElement('div');
    document.body.appendChild(root);

    await act(() => render(<PlayerSheet land={false} />, root));

    expect(root.querySelector('.plsheet')).not.toBeNull();
    expect(root.textContent).toContain('Direct Stream Alpha');

    // Test alias 'server'
    await act(() => setUi({ sheet: 'server' }));
    expect(root.textContent).toContain('Direct Stream Alpha');

    // Close scrim
    const scrim = root.querySelector('.scrim') as HTMLElement;
    scrim.click();
    expect(ui.get().sheet).toBe(false);

    root.remove();
  });
});
