import { describe, expect, it } from 'vitest';
import { EmbedSession, ERR_NONE, ERR_OFFLINE, type EmbedView } from '../../src/core/embed-session';
import { buildEmbeds, embedEvent, embedHealth, sandboxFor } from '../../src/core/embeds';

const E = [{ url: 'https://a.example/1' }, { url: 'https://b.example/1' }, { url: 'https://c.example/1' }];

/** Manual timers + a controllable reachability answer per url. */
function rig(reach: Record<string, boolean | undefined> = {}) {
  const timers: { fn: () => void; on: boolean }[] = [];
  const views: EmbedView[] = [];
  const pending: Record<string, (ok: boolean) => void> = {};
  const s = new EmbedSession(E, (v) => views.push(v), {
    loadMs: 1000,
    reach: (u) => (u in reach ? Promise.resolve(!!reach[u]) : new Promise((r) => (pending[u] = r))),
    setTimer: (fn) => {
      const t = { fn, on: true };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => t && ((t as { on: boolean }).on = false),
  });
  const fire = () => timers.filter((t) => t.on).forEach((t) => ((t.on = false), t.fn()));
  const last = () => views[views.length - 1];
  return { s, views, fire, last, pending };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('embed session (automatic failover)', () => {
  it('shows the first player with a loader, then drops the loader on iframe load', () => {
    const { s, last } = rig();
    s.start(0);
    expect(last()).toEqual({ alt: 0, embedUrl: E[0].url, loading: true, err: null });
    s.loaded();
    expect(last()).toEqual({ alt: 0, embedUrl: E[0].url, loading: false, err: null });
  });
  it('skips an unreachable host at once', async () => {
    const { s, last } = rig({ [E[0].url]: false });
    s.start(0);
    await tick();
    expect(last().embedUrl).toBe(E[1].url);
    expect(last().loading).toBe(true);
  });
  it('a reachable but slow page is shown after the timeout instead of being replaced', async () => {
    const { s, last, fire } = rig({ [E[0].url]: true });
    s.start(0);
    await tick();
    fire();
    expect(last()).toEqual({ alt: 0, embedUrl: E[0].url, loading: false, err: null });
  });
  it('an unanswered page is replaced after the timeout', () => {
    const { s, last, fire } = rig();
    s.start(0);
    fire();
    expect(last().embedUrl).toBe(E[1].url);
  });
  it('a page that refuses to play here (embed guard "blocked") is replaced and remembered', () => {
    embedHealth.clear();
    const { s, last } = rig();
    s.start(0);
    s.message({ __cinetor: 'embed', ev: 'blocked', host: 'a.example' });
    expect(last().embedUrl).toBe(E[1].url);
    expect(embedHealth.get('a.example')).toBe('blocked');
    s.message({ __cinetor: 'embed', ev: 'playing', host: 'b.example' });
    expect(last()).toEqual({ alt: 1, embedUrl: E[1].url, loading: false, err: null });
    expect(embedHealth.get('b.example')).toBe('playing');
    embedHealth.clear();
  });
  it('after every player failed: an accurate error, no spinner; a fresh start tries again', async () => {
    const { s, last } = rig({ [E[0].url]: false, [E[1].url]: false, [E[2].url]: false });
    s.start(0);
    await tick();
    await tick();
    await tick();
    expect(last()).toEqual({ alt: 2, embedUrl: null, loading: false, err: ERR_OFFLINE });
    s.start(0, true);
    expect(last().embedUrl).toBe(E[0].url);
  });
  it('no players at all', () => {
    const views: EmbedView[] = [];
    new EmbedSession([], (v) => views.push(v)).start(0);
    expect(views[0].err).toBe(ERR_NONE);
  });
  it('ignores events after stop and foreign messages', () => {
    const { s, views } = rig();
    s.start(0);
    const n = views.length;
    s.message({ some: 'thing' });
    s.message('x');
    s.stop();
    s.loaded();
    s.message({ __cinetor: 'embed', ev: 'playing', host: 'a.example' });
    expect(views.length).toBe(n);
  });
});

describe('embed guard messages + session health ranking', () => {
  it('parses only the guard messages', () => {
    expect(embedEvent({ __cinetor: 'embed', ev: 'ready', host: 'www.vidsrc.su' })).toEqual({ ev: 'ready', host: 'vidsrc.su' });
    expect(embedEvent({ __cinetor: 'embed', ev: 'nope' })).toBeNull();
    expect(embedEvent(null)).toBeNull();
  });
  it('a player that refused goes last, one that played goes first', () => {
    embedHealth.clear();
    const base = buildEmbeds([], 'movie', 603).map((x) => x.url);
    embedHealth.set('vidsrc.su', 'blocked');
    embedHealth.set('vidfast.pro', 'playing');
    const r = buildEmbeds([], 'movie', 603).map((x) => x.url);
    expect(r[0]).toContain('vidfast.pro');
    expect(r[r.length - 1]).toContain('vidsrc.su');
    expect(base[0]).toContain('vidsrc.su');
    embedHealth.clear();
  });
  it('the APK never sandboxes', () => {
    expect(sandboxFor('https://vidsrc.su/movie/1', true)).toBeUndefined();
  });
});
