import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// the exact file the APK injects into every frame (MainActivity) and the CI stream probe uses
import SHIM from '../../android/app/src/main/res/raw/embed_shim.js?raw';

const WV_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36';

/** Runs the guard against fake browser globals (it only touches these names). */
function run(host: string) {
  class Nav {}
  Object.defineProperty(Nav.prototype, 'userAgent', { get: () => WV_UA, configurable: true });
  const brands = [{ brand: 'Android WebView', version: '131' }, { brand: 'Chromium', version: '131' }];
  const uad = { brands, mobile: true, platform: 'Android', getHighEntropyValues: () => Promise.resolve({ brands, fullVersionList: brands }) };
  Object.defineProperty(Nav.prototype, 'userAgentData', { get: () => uad, configurable: true });
  const nav = new Nav() as { userAgent: string; userAgentData: typeof uad };
  const posted: unknown[] = [];
  const listeners: Record<string, (e: unknown) => void> = {};
  const doc = { body: { innerText: '' }, addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn) };
  const win: Record<string, unknown> = { top: { postMessage: (m: unknown) => posted.push(m) }, open: () => null };
  new Function('location', 'navigator', 'Navigator', 'window', 'document', SHIM)({ hostname: host, protocol: 'https:' }, nav, Nav, win, doc);
  return { nav, win, doc, posted, listeners };
}

describe('embed guard (res/raw/embed_shim.js)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the Android WebView from the page (vidsrc.su "In-App Browser Detected" checks)', async () => {
    const { nav } = run('vidsrc.su');
    expect(nav.userAgent).not.toMatch(/; wv\)/);
    expect(nav.userAgent).not.toMatch(/Version\/\d/);
    expect(nav.userAgent).toContain('Chrome/131.0.0.0 Mobile Safari/537.36');
    expect(nav.userAgentData.brands.some((b) => b.brand === 'Android WebView')).toBe(false);
    const hi = (await nav.userAgentData.getHighEntropyValues()) as { fullVersionList: { brand: string }[] };
    expect(hi.fullVersionList.some((b) => b.brand === 'Android WebView')).toBe(false);
  });
  it('does nothing in the app itself', () => {
    const { nav, win } = run('localhost');
    expect(nav.userAgent).toBe(WV_UA);
    expect((win.open as () => unknown)()).toBeNull();
  });
  it('pop-ups get a dummy window, target=_blank links are not followed', () => {
    const { win, listeners } = run('vidsrc.to');
    const w = (win.open as (u: string) => { closed: boolean; close(): void })('https://ads.example/');
    expect(w).not.toBeNull();
    w.close();
    expect(w.closed).toBe(true);
    const a = { getAttribute: () => '_blank' };
    const ev = { target: { closest: () => a }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.click(ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    const self = { target: { closest: () => ({ getAttribute: () => '_self' }) }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.click(self);
    expect(self.preventDefault).not.toHaveBeenCalled();
  });
  it('reports a long video playing, not a short pre-roll ad', () => {
    const { posted, listeners } = run('vidsrc.su');
    listeners.playing({ target: { tagName: 'VIDEO', duration: 30 } });
    expect(posted).toEqual([]);
    listeners.playing({ target: { tagName: 'VIDEO', duration: 7200 } });
    expect(posted).toEqual([{ __cinetor: 'embed', ev: 'playing', host: 'vidsrc.su' }]);
  });
  it('reports a page that refuses to play here', () => {
    const { posted, doc } = run('vidsrc.su');
    doc.body.innerText = 'Unsupported Browser In-App Browser Detected';
    vi.advanceTimersByTime(1500);
    expect(posted).toEqual([{ __cinetor: 'embed', ev: 'blocked', host: 'vidsrc.su' }]);
  });
});
