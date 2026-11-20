// TV player: always fullscreen, ONE <video> element created once and reused (docs/09 rules 9, 14).
import { MEDIA_BASE } from '../../core/config';
import { clipFor, fmtTime, MOCK_SEASONS, next as nextR, prev as prevR, QUALITIES, type Seasons } from '../../core/player-model';
import { cueAt, LANGS, langOf, parseVtt, simulateGeneration, type Cue } from '../../core/subtitles';
import type { Quality } from '../../core/series-settings';
import type { Title } from '../../core/tmdb';
import { I } from './icons';
import { esc } from './views';
import { library, series } from './state';
import { focus } from './spatial-nav';
import { fetchStream } from '../../core/stream-resolver';

interface P { t: Title | null; label: string; live: boolean; s: number; e: number; q: Quality; sub: string; audio: string; menu: string | null; seasons: Seasons }
export let P: P | null = null;
let video: HTMLVideoElement | null = null;
let root: HTMLElement | null = null;
let hideT: ReturnType<typeof setTimeout> | undefined;
let toastFn: (m: string) => void = () => {};
const cues = new Map<string, Cue[]>();

function el() {
  if (video) return video;
  video = document.createElement('video');
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.addEventListener('ended', () => P && !P.live && (P.t?.mediaType === 'tv' ? step(1) : undefined));
  return video;
}
const save = () => P?.t && series.save(P.t.id, { quality: P.q, audio: P.audio, sub: P.sub });

export function play(o: { t?: Title; live?: string; s?: number; e?: number; seasons?: Seasons }, onToast: (m: string) => void) {
  toastFn = onToast;
  const mem = o.t ? series.load(o.t.id) : { quality: 720 as Quality, audio: 'OG', sub: 'Off' };
  P = { t: o.t || null, label: o.live || o.t?.title || '', live: !!o.live, s: o.s || 1, e: o.e || 1, q: mem.quality, sub: mem.sub, audio: mem.audio, menu: null, seasons: o.seasons || MOCK_SEASONS };
  try {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    /* best effort */
  }
  load(true);
  draw();
}
let currentTvResolveKey = '';

function load(resume: boolean) {
  const v = el();
  const at = resume && P?.t ? library.progress(P.t.id, P.s, P.e) * 120 : v.currentTime;
  v.src = MEDIA_BASE + clipFor(P!.live ? 720 : P!.q);
  v.addEventListener('loadedmetadata', () => at > 1 && at < 118 && (v.currentTime = at), { once: true });
  void v.play().catch(() => {});

  if (P?.t && !P.live) {
    const key = `${P.t.id}:${P.s}:${P.e}`;
    currentTvResolveKey = key;
    void fetchStream(P.t.id, P.t.title, P.t.mediaType, P.s, P.e).then((res) => {
      if (res?.url && currentTvResolveKey === key) {
        const curTime = v.currentTime || at;
        v.src = res.url;
        v.currentTime = curTime;
        void v.play().catch(() => {});
      }
    });
  }
}
export function close() {
  const v = el();
  v.pause();
  v.removeAttribute('src');
  v.load(); // release the decoder
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
  v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
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
    : Array.from({ length: p.seasons[p.s - 1] || 6 }, (_, i): [string, string, string] => ['Episode ' + (i + 1), 'ep', String(i + 1)]);
  const on = (k: string, v: string) => (k === 'q' && String(p.q) === v) || (k === 'sub' && p.sub === v) || (k === 'audio' && p.audio === v) || (k === 'ep' && String(p.e) === v);
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
  root.innerHTML = `<div class="ui"><div class="ptop"><div class="pb" data-f data-do="pback">${I('arrow-left')}</div><div class="g">${esc(p.label)}${p.live ? '' : sr ? ` <small style="color:var(--dim);font-size:16px"> S${p.s} · E${p.e}</small>` : ''}</div>${p.live ? '' : '<div class="pb" data-f data-do="pmenu" data-m="q">HD</div>'}</div>
 <div class="pmid"><div class="pb" data-f data-do="seek" data-d="-10">${I('rewind-10')}</div><div class="pb big" data-f data-do="ptoggle">${I(playing ? 'pause' : 'play')}</div><div class="pb" data-f data-do="seek" data-d="10">${I('fast-forward-10')}</div></div>
 <div class="pbot"><div class="row2"><div class="pb" data-f data-do="pmenu" data-m="sub">${I('subtitles-outline')}</div><div class="pb" data-f data-do="pmenu" data-m="audio">${I('waveform')}</div>${sr ? `<div class="pb" data-f data-do="pmenu" data-m="eps">${I('playlist-play')}</div><div class="pb" data-f data-do="pprev">${I('skip-previous')}</div><div class="pb" data-f data-do="pnext">${I('skip-next')}</div>` : ''}</div>
 <div class="seek" data-f data-do="seekbar"><b id="pbar"></b></div><div class="tm"><span id="pt">${p.live ? 'LIVE' : ''}</span><span id="pd"></span></div></div></div><div class="psub" id="psub"></div>${p.menu ? menuHtml() : ''}`;
  root.insertBefore(el(), root.firstChild);
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
  if (k === 'ep') ((p.e = +v), load(true));
  if (k === 'q') ((p.q = +v as Quality), load(false));
  if (k === 'audio') p.audio = v;
  if (k === 'sub') {
    p.sub = v;
    if (v !== 'Off' && !cues.has(v)) void fetch(MEDIA_BASE + 'subtitles/' + v + '.vtt').then((r) => r.text()).then((t) => cues.set(v, parseVtt(t)));
  }
  p.menu = null;
  save();
  draw();
  toastFn(k === 'ep' ? 'Episode ' + v : 'Settings apply to the whole series');
}
export const menu = (m: string | null) => P && ((P.menu = m), draw());
export const next = () => step(1);
export const prev = () => step(-1);
