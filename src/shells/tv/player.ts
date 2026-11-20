// TV player: always fullscreen, ONE native <video> element created once and reused (docs/09 rules 9, 14).
// Native-first architecture: zero third-party player chrome inside, all controls native,
// seamless multi-server fallback and automatic failover on stall / error.
import { fmtTime, MOCK_SEASONS, next as nextR, prev as prevR, QUALITIES, type Seasons } from '../../core/player-model';
import { cueAt, LANGS, langOf, parseVtt, simulateGeneration, vttUrl, type Cue } from '../../core/subtitles';
import type { Quality } from '../../core/series-settings';
import type { Title } from '../../core/tmdb';
import { I } from './icons';
import { esc } from './views';
import { library, series } from './state';
import { focus } from './spatial-nav';
import { fetchStream } from '../../core/stream-resolver';
import { pickChannel } from '../../core/live';
import { cancelPlay, playUrl, preserveTimestamp } from '../../core/playback';
import { playTarget, type MediaSrc } from '../../core/sources';
import { isNative } from '../../core/platform';
import { registerMediaHeaders } from '../../native/media-headers';
import { ERR_NONE } from '../../core/embed-session';

export interface ServerEntry {
  id: string;
  name: string;
  source: MediaSrc;
  quality?: number;
}

export interface P {
  t: Title | null;
  label: string;
  live: boolean;
  s: number;
  e: number;
  q: Quality;
  sub: string;
  audio: string;
  menu: string | null;
  seasons: Seasons;
  servers: ServerEntry[];
  serverIdx: number;
}

export let P: P | null = null;
let video: HTMLVideoElement | null = null;
let root: HTMLElement | null = null;
let hideT: ReturnType<typeof setTimeout> | undefined;
let stallTimer: ReturnType<typeof setTimeout> | undefined;
let toastFn: (m: string) => void = () => {};
let currentTvResolveKey = '';
let startingPlay = false;
let isFailingOver = false;
const cues = new Map<string, Cue[]>();

function onVideoWaiting() {
  if (!P || P.live) return;
  clearTimeout(stallTimer);
  // Watchdog: If playback stalls for 8s, trigger automatic failover to the next server
  stallTimer = setTimeout(() => {
    if (P && !P.live && video && video.readyState < 3) {
      failoverNext('Playback stalled');
    }
  }, 8000);
}

function onVideoPlaying() {
  clearTimeout(stallTimer);
}

function onVideoTimeUpdate() {
  clearTimeout(stallTimer);
}

function onVideoError() {
  if (!P || P.live || startingPlay) return;
  failoverNext('Playback error');
}

function el(): HTMLVideoElement {
  if (video) return video;
  video = document.createElement('video');
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.addEventListener('ended', () => P && !P.live && (P.t?.mediaType === 'tv' ? step(1) : undefined));
  video.addEventListener('waiting', onVideoWaiting);
  video.addEventListener('playing', onVideoPlaying);
  video.addEventListener('timeupdate', onVideoTimeUpdate);
  video.addEventListener('error', onVideoError);
  return video;
}

const save = () => P?.t && series.save(P.t.id, { quality: P.q, audio: P.audio, sub: P.sub });

export function play(o: { t?: Title; live?: string; s?: number; e?: number; seasons?: Seasons }, onToast: (m: string) => void) {
  toastFn = onToast;
  const mem = o.t ? series.load(o.t.id) : { quality: 720 as Quality, audio: 'OG', sub: 'Off' };
  P = {
    t: o.t || null,
    label: o.live || o.t?.title || '',
    live: !!o.live,
    s: o.s || 1,
    e: o.e || 1,
    q: mem.quality,
    sub: mem.sub,
    audio: mem.audio,
    menu: null,
    seasons: o.seasons || MOCK_SEASONS,
    servers: [],
    serverIdx: 0,
  };
  try {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    /* best effort */
  }
  load(true);
  draw();
}

async function playServer(srv: ServerEntry, at = 0) {
  const v = el();
  startingPlay = true;
  clearTimeout(stallTimer);
  const key = currentTvResolveKey;

  try {
    if (srv.source.headers && isNative()) {
      await registerMediaHeaders([srv.source]);
    }
    const target = playTarget(srv.source, isNative());
    await playUrl(v, target.url, {
      at,
      timeoutMs: 15000,
      referer: target.referer,
    });
    startingPlay = false;
    if (v.paused) void v.play().catch(() => {});
  } catch (e: any) {
    startingPlay = false;
    if (e.message !== 'cancelled' && currentTvResolveKey === key) {
      failoverNext(`Server ${srv.name} failed`);
    }
  }
}

function failoverNext(reason: string) {
  if (!P || isFailingOver) return;
  if (P.servers.length > 1 && P.serverIdx + 1 < P.servers.length) {
    isFailingOver = true;
    const nextIdx = P.serverIdx + 1;
    P.serverIdx = nextIdx;
    const v = el();
    const at = preserveTimestamp(v, 0);
    const srv = P.servers[nextIdx];
    toastFn(`${reason} → Auto-failover to ${srv.name}`);
    draw();
    playServer(srv, at).finally(() => {
      isFailingOver = false;
    });
  } else {
    toastFn('All stream servers failed. Check your connection.');
  }
}

function load(resume: boolean) {
  const v = el();
  const at = resume && P?.t ? library.progress(P.t.id, P.s, P.e) * 120 : v.currentTime;

  if (P?.t && !P.live) {
    const key = `${P.t.id}:${P.s}:${P.e}`;
    currentTvResolveKey = key;
    void fetchStream(P.t.id, P.t.title, P.t.mediaType, P.s, P.e).then((res) => {
      if (currentTvResolveKey !== key || !P) return;
      if (!res) return toastFn('Could not load this title. Check your connection.');

      const servers: ServerEntry[] = [];
      const seen = new Set<string>();

      const addServer = (name: string, url: string, kind: 'hls' | 'mp4', quality: number, headers?: Record<string, string>) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        servers.push({
          id: `srv-${servers.length}`,
          name,
          source: { url, kind, quality, name, headers },
          quality,
        });
      };

      // 1. Multi-server streams from stream resolver
      if (res.servers && res.servers.length > 0) {
        for (const s of res.servers) {
          addServer(s.name || `Server ${servers.length + 1}`, s.url, s.kind, s.quality || 1080, s.headers);
        }
      }

      // 2. Direct sources
      if (servers.length === 0 && res.direct && res.direct.length > 0) {
        for (const d of res.direct) {
          addServer(d.name || `Server ${servers.length + 1}`, d.url, d.kind, d.quality || 1080, d.headers);
        }
      }

      // 2. Extra stream sources from res.sources
      if (res.sources && res.sources.length > 0) {
        for (const s of res.sources) {
          const url = s.url || (s as any).proxyUrl;
          if (url) {
            const kind = (s.type === 'hls' || url.includes('.m3u8')) ? 'hls' : 'mp4';
            addServer(s.name || `Server ${servers.length + 1}`, url, kind, s.quality || 1080, s.headers);
          }
        }
      }

      // 3. Fallback direct url if still empty
      if (servers.length === 0 && res.url) {
        addServer('Default Server', res.url, res.url.includes('.m3u8') ? 'hls' : 'mp4', res.quality || 1080);
      }

      // 4. Fallback embed URLs mapped to direct native server entries
      if (servers.length === 0 && res.embeds && res.embeds.length > 0) {
        res.embeds.forEach((emb, i) => {
          addServer(`Server ${i + 1}`, emb.url, 'hls', 1080);
        });
      }

      P.servers = servers;
      P.serverIdx = 0;
      draw();

      if (servers.length > 0) {
        playServer(servers[0], at);
      } else {
        toastFn(ERR_NONE);
      }
    });
  } else {
    currentTvResolveKey = '';
    const channel = pickChannel(P?.label || '');
    const url = channel?.[5] || '';
    if (!url) return toastFn('This channel is offline right now.');
    playUrl(v, url).catch((e: Error) => e.message !== 'cancelled' && toastFn('This channel is offline right now. Try another channel.'));
  }
}

export function close() {
  const v = el();
  currentTvResolveKey = '';
  clearTimeout(stallTimer);
  clearTimeout(hideT);
  cancelPlay(v); // stops hls.js and releases the decoder
  root?.remove();
  root = null;
  P = null;
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

function step(d: 1 | -1) {
  if (!P) return;
  const st = { titleId: 0, title: '', mediaType: 'tv' as const, season: P.s, episode: P.e, pos: el().currentTime, dur: el().duration || 120, playing: true } as Parameters<typeof nextR>[0];
  const n = d > 0 ? nextR(st, P.seasons) : prevR(st, P.seasons);
  if (n.season === P.s && n.episode === P.e) return void (el().currentTime = 0);
  P.s = n.season;
  P.e = n.episode;
  load(true);
  draw();
}

export function seek(d: number) {
  const v = el();
  const wasPlaying = !v.paused;
  v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
  if (wasPlaying && v.paused) void v.play().catch(() => {});
  tick();
}

export function toggle() {
  const v = el();
  v.paused ? void v.play().catch(() => {}) : v.pause();
  draw();
}

export function showUi() {
  root?.classList.remove('hide');
  clearTimeout(hideT);
  hideT = setTimeout(() => P && !P.menu && root?.classList.add('hide'), 4000);
}

function menuHtml() {
  const p = P!, m = p.menu;
  const L: [string, string, string][] = m === 'q' ? QUALITIES.map((x) => [x + 'p', 'q', String(x)])
    : m === 'sub' ? [['Off', 'sub', 'Off'], ...LANGS.flatMap(([c, n]): [string, string, string][] => (cues.has(c) ? [[n, 'sub', c]] : [[n + '  (generate on device)', 'gen', c]]))]
    : m === 'audio' ? [['Original', 'audio', 'OG'], ['English dub', 'audio', 'EN'], ['Hindi dub', 'audio', 'HI'], ['Bangla dub', 'audio', 'BN']]
    : m === 'server' ? (p.servers.length ? p.servers.map((s, i) => [`${s.name}${s.quality ? ` · ${s.quality}p` : ''}`, 'server', String(i)]) : [['Auto Server', 'server', '0']])
    : Array.from({ length: p.seasons[p.s - 1] || 6 }, (_, i): [string, string, string] => ['Episode ' + (i + 1), 'ep', String(i + 1)]);

  const on = (k: string, v: string) =>
    (k === 'q' && String(p.q) === v) ||
    (k === 'sub' && p.sub === v) ||
    (k === 'audio' && p.audio === v) ||
    (k === 'server' && String(p.serverIdx) === v) ||
    (k === 'ep' && String(p.e) === v);

  return `<div class="menu">${L.map(([l, k, v]) => `<div data-f data-do="pick" data-pk="${k}" data-v="${v}"><span>${esc(l)}</span>${on(k, v) ? I('check') : ''}</div>`).join('')}</div>`;
}

export function draw() {
  const p = P;
  if (!p) return;
  if (!root) {
    root = document.createElement('div');
    root.id = 'player';
    document.getElementById('tv')!.appendChild(root);
  }
  const sr = !p.live && p.t?.mediaType === 'tv', playing = !el().paused;
  const srvName = p.servers[p.serverIdx]?.name || (p.servers.length ? `Server ${p.serverIdx + 1}` : '');

  // Keep native <video> node, replace UI overlay
  for (const n of Array.from(root.children)) if (n !== video) n.remove();

  root.insertAdjacentHTML('beforeend', `<div class="ui"><div class="ptop"><div class="pb" data-f data-do="pback" title="Back">${I('arrow-left')}</div><div class="g">${esc(p.label)}${p.live ? '' : sr ? ` <small style="color:var(--dim);font-size:16px"> S${p.s} · E${p.e}</small>` : ''}${p.live || !srvName ? '' : ` <span style="display:inline-block;margin-left:12px;padding:3px 10px;background:rgba(255,255,255,0.12);border-radius:6px;font-size:13px;color:var(--dim);font-weight:500;vertical-align:middle">${esc(srvName)}</span>`}</div>${p.live ? '' : `<div class="pb" data-f data-do="pmenu" data-m="server" title="Server">${I('server')}</div>`}${p.live ? '' : '<div class="pb" data-f data-do="pmenu" data-m="q">HD</div>'}</div>
 <div class="pmid"><div class="pb" data-f data-do="seek" data-d="-10">${I('rewind-10')}</div><div class="pb big" data-f data-do="ptoggle">${I(playing ? 'pause' : 'play')}</div><div class="pb" data-f data-do="seek" data-d="10">${I('fast-forward-10')}</div></div>
 <div class="pbot"><div class="row2"><div class="pb" data-f data-do="pmenu" data-m="sub" title="Subtitles">${I('subtitles-outline')}</div><div class="pb" data-f data-do="pmenu" data-m="audio" title="Audio">${I('waveform')}</div>${p.live ? '' : `<div class="pb" data-f data-do="pmenu" data-m="server" title="Switch Server">${I('server')}</div>`}${sr ? `<div class="pb" data-f data-do="pmenu" data-m="eps" title="Episodes">${I('playlist-play')}</div><div class="pb" data-f data-do="pprev" title="Previous Episode">${I('skip-previous')}</div><div class="pb" data-f data-do="pnext" title="Next Episode">${I('skip-next')}</div>` : ''}</div>
 <div class="seek" data-f data-do="seekbar"><b id="pbar"></b></div><div class="tm"><span id="pt">${p.live ? 'LIVE' : ''}</span><span id="pd"></span></div></div></div><div class="psub" id="psub"></div>${p.menu ? menuHtml() : ''}`);

  if (!root.contains(el())) {
    root.insertBefore(el(), root.firstChild);
  }
  focus(root.querySelector<HTMLElement>(p.menu ? '.menu [data-f]' : '[data-do="ptoggle"]'));
  tick();
  showUi();
}

/** Called by the shared 1 s ticker and after seeks. */
export function tick() {
  if (!P || !root) return;
  const v = el(), d = v.duration || 0;
  const b = root.querySelector<HTMLElement>('#pbar');
  if (b) b.style.width = (P.live ? 100 : d ? (v.currentTime / d) * 100 : 0) + '%';
  if (!P.live) {
    root.querySelector('#pt')!.textContent = fmtTime(v.currentTime);
    root.querySelector('#pd')!.textContent = fmtTime(d);
    if (P.t && d && !v.paused) library.setProgress(P.t, P.s, P.e, v.currentTime / d);
  }
  const c = cueAt(cues.get(P.sub) || [], v.currentTime);
  root.querySelector('#psub')!.textContent = P.sub !== 'Off' && c ? c.text : '';
}

export function pick(k: string, v: string) {
  const p = P!;
  if (k === 'gen') {
    p.menu = null;
    draw();
    toastFn('Generating ' + langOf(v)[1] + ' subtitles on this device…');
    void simulateGeneration(v, () => {}).then((t) => {
      cues.set(v, parseVtt(t));
      if (P) (P.sub = v), save(), draw();
      toastFn(langOf(v)[1] + ' subtitles ready');
    });
    return;
  }
  if (k === 'server') {
    const idx = +v;
    if (p.servers[idx]) {
      p.serverIdx = idx;
      p.menu = null;
      draw();
      const srv = p.servers[idx];
      const at = preserveTimestamp(el(), 0);
      toastFn(`Switched to ${srv.name}`);
      void playServer(srv, at);
    }
    return;
  }
  if (k === 'ep') ((p.e = +v), load(true));
  if (k === 'q') ((p.q = +v as Quality), load(false));
  if (k === 'audio') p.audio = v;
  if (k === 'sub') {
    p.sub = v;
    if (v !== 'Off' && !cues.has(v)) void fetch(vttUrl(v)).then((r) => r.text()).then((t) => cues.set(v, parseVtt(t)));
  }
  p.menu = null;
  save();
  draw();
  toastFn(k === 'ep' ? 'Episode ' + v : 'Settings apply to the whole series');
}

export const menu = (m: string | null) => P && ((P.menu = m), draw());
export const next = () => step(1);
export const prev = () => step(-1);
