// TV shell boot + input (prototype tv/index.html). Vanilla TS, one delegated listener, one 1 s ticker.
import './tv.css';
import { configureTmdb } from '../../core/tmdb';
import { pinPress, startPin } from '../../core/pin';
import { trackUrl } from '../../core/music';
import { I, MARK, SPRITE } from './icons';
import { normKey } from './keys';
import { $$, current, focus, move } from './spatial-nav';
import { adult, frame, library, S } from './state';
import { errors, feeds, details, LISTS, NET, REG, view } from './views';
import { netGet, netSet, netSupported, DOH_PROVIDERS } from '../../core/net';
import * as player from './player';
import { checkUpdate, updateDialog } from './updates';

configureTmdb({ storage: 'local', ttlMs: 30 * 60 * 1000 }); // cold start paints from cache (rule 11)

const $ = (s: string) => document.querySelector<HTMLElement>(s);
const app = document.getElementById('app')!;
app.innerHTML = SPRITE + '<div id="tv"><div id="side"></div><div id="main"></div></div>';

function fit() {
  const t = $('#tv')!, k = Math.min(innerWidth / 1280, innerHeight / 720);
  t.style.transform = `scale(${k}) translate(-50%,-50%)`;
  t.style.left = '50%';
  t.style.top = '50%';
}
addEventListener('resize', fit);
fit();

const NAV: [string, string, string][] = [['search', 'magnify', 'Search'], ['home', 'home', 'Home'], ['anime', 'star', 'Anime'], ['drama', 'drama-masks', 'Drama'], ['tv', 'television-classic', 'TV'], ['music', 'music-note', 'Music'], ['adult', 'shield-lock-outline', 'Adult'], ['library', 'bookmark-multiple-outline', 'My Library'], ['settings', 'cog-outline', 'Settings']];

function toast(m: string) {
  $$('.toast').forEach((x) => x.remove());
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = m;
  $('#tv')!.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

/** Rows within ±1 of the focused row hold real image URLs (rule 7). */
function windowImages() {
  const rows = $$('#main .row, #main .grid, #main .cast, #main .ep');
  const f = current();
  let fi = rows.findIndex((r) => f && r.contains(f));
  if (fi < 0) fi = 0;
  rows.forEach((r, i) => {
    const near = Math.abs(i - fi) <= 1 || r.classList.contains('grid') || (r.classList.contains('ep') && Math.abs(i - fi) <= 4);
    r.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((im) => {
      if (near && !im.getAttribute('src')) im.src = im.dataset.src!;
      else if (!near && im.getAttribute('src')) im.removeAttribute('src');
    });
  });
  $$('#main .hero img[data-src]').forEach((im) => !im.getAttribute('src') && ((im as HTMLImageElement).src = im.dataset.src!));
}
const onFocus = (el: HTMLElement) => {
  S.lastF[S.view] = el.dataset.k || el.textContent || '';
  $('#side')!.classList.toggle('open', !!el.closest('#side'));
  windowImages();
  // "See all" grid: add 24 more when focus reaches the last row
  if (S.view === 'list' && el.closest('.grid')) {
    const all = $$('.grid [data-f]'), idx = all.indexOf(el), l = LISTS.get(S.lid);
    if (l && idx >= all.length - 6 && S.gridN < l.a.length) (S.gridN += 24), render(true);
  }
};

function side() {
  $('#side')!.innerHTML = `<div class="logo">${MARK}<span>CINETOR</span></div>` + NAV.filter((n) => n[0] !== 'adult' || adult.isOn()).map(([k, i, l]) => `<div class="nv${k === S.root ? ' on' : ''}" data-f data-go="${k}" data-root="1">${I(i)}<b>${l}</b></div>`).join('');
}
function render(keep = false) {
  side();
  const back = S.stack.length > 0 && S.view !== 'pin' ? `<div class="backbar"><span class="btn" data-f data-do="back">${I('arrow-left')} Back</span></div>` : '';
  const prevKey = current()?.dataset.k, prevTxt = current()?.textContent;
  $('#main')!.innerHTML = back + view(S.view, () => render(true));
  let f: HTMLElement | undefined;
  if (keep) f = $$('#main [data-f], #side [data-f]').find((e) => (prevKey ? e.dataset.k === prevKey : e.textContent === prevTxt));
  if (!f && S.lastF[S.view]) f = $$('#main [data-f]').find((e) => e.dataset.k === S.lastF[S.view] || e.textContent === S.lastF[S.view]);
  if (!f) f = $$('#main [data-f]').find((e) => !e.closest('.backbar')) || $$('#main [data-f]')[0];
  if (!keep || !current() || !document.contains(current())) focus(f, onFocus);
  else windowImages();
  if (import.meta.env.DEV && document.querySelectorAll('*').length > 1500) console.warn('TV DOM over 1500 nodes:', document.querySelectorAll('*').length);
}

function pushFrame() {
  S.stack.push(frame());
}
function go(v: string, d: DOMStringMap) {
  const t = d.k ? REG.get(d.k) : undefined;
  if (v === 'player') {
    const det = t ? details.get(t.mediaType + t.id) : undefined;
    return player.play({ t, live: d.live, s: d.s ? +d.s : 1, e: d.e ? +d.e : 1, seasons: det?.seasons.length ? det.seasons : undefined }, toast);
  }
  if (d.root) {
    S.stack = [];
    S.root = v;
    S.opt.cat = 'All';
  } else pushFrame();
  if (v === 'adult') {
    if (!adult.isOn()) {
      toast('Turn on Adult section in Settings first');
      if (!d.root) S.stack.pop();
      return;
    }
    S.adultOk = false;
    S.view = 'adult';
    return openPin('enter');
  }
  S.adultOk = false;
  if (v === 'info' && t) (S.t = t), (S.season = 1);
  S.view = v;
  render();
}
function back() {
  if (player.P) {
    if (player.P.menu) return player.menu(null);
    player.close();
    return render(true);
  }
  if (S.view === 'pin') return pinKey('x');
  const p = S.stack.pop();
  if (!p) {
    const f = current();
    if (f && !f.closest('#side')) return focus($('#side .nv.on') || $('#side .nv'), onFocus); // first Back → sidebar
    if (S.view !== 'home') ((S.view = 'home'), (S.root = 'home'), render()); // second Back → Home
    return;
  }
  Object.assign(S, { view: p.view, root: p.root, t: p.t, season: p.season || 1, lid: p.lid || '', pid: p.pid || 0, pname: p.pname || '' });
  S.adultOk = S.adultOk && S.view === 'adult';
  render();
}

function openPin(mode: 'enter' | 'set' | 'off' | 'chk') {
  S.pin = startPin(mode);
  S.pinBack = S.view;
  S.view = 'pin';
  render();
}
function pinKey(k: string) {
  const f = S.pin!;
  if (k === 'x') {
    S.pin = null;
    S.view = f.mode === 'enter' ? 'home' : S.pinBack === 'adult' ? 'home' : S.pinBack;
    if (f.mode === 'enter') S.root = 'home';
    return render();
  }
  const r = pinPress(f, k === 'b' ? 'back' : k, adult);
  S.pin = r.flow;
  if (r.outcome === 'none') return render(true);
  S.view = r.outcome === 'unlocked' ? 'adult' : 'settings';
  if (r.outcome === 'unlocked') (S.adultOk = true), (S.root = 'adult');
  if (r.outcome === 'enabled') toast('Adult section enabled');
  if (r.outcome === 'disabled') toast('Adult section turned off');
  if (r.outcome === 'changed') toast('PIN changed');
  render();
}

let musicEl: HTMLAudioElement | null = null;
function act(el: HTMLElement | null) {
  if (!el) return;
  const d = el.dataset;
  if (d.go) return go(d.go, d);
  switch (d.do) {
    case 'seeall': pushFrame(); S.lid = d.lid!; S.gridN = 24; S.view = 'list'; return render();
    case 'chall': pushFrame(); S.lid = d.cat!; S.view = 'channels'; return render();
    case 'back': return back();
    case 'cwclear': library.clearContinue(); render(); return toast('Continue watching cleared');
    case 'person': pushFrame(); S.pid = +d.pid!; S.pname = d.t || ''; S.view = 'person'; return render();
    case 'opt':
      if (d.ok === 'season') S.season = +d.v!.replace('Season ', '');
      else S.opt[d.ok!] = d.v!;
      return render(true);
    case 'lib': { const t = REG.get(d.k!); if (t) toast(library.toggleSaved(t) ? 'Added to My List' : 'Removed'); return render(true); }
    case 'retry': errors.delete(d.key!); feeds.delete(d.key!); return render(true);
    case 'adultset': return openPin(adult.isOn() ? 'off' : 'set');
    case 'pinchg': return openPin('chk');
    case 'key': return pinKey(d.key!);
    case 'music': musicEl = musicEl || new Audio(); musicEl.src = trackUrl(d.t!); void musicEl.play().catch(() => {}); return toast('Playing ' + d.t);
    case 'update': return void checkUpdate(true, toast);
    case 'net': {
      const n = NET.s;
      if (!n || NET.busy) return;
      const k = d.k;
      // TV: Custom DoH needs typing a URL, so OK cycles Cloudflare → Google → AdGuard → Off.
      const order = DOH_PROVIDERS.map((p) => p.value).filter((v) => v !== 'custom');
      const p = k === 'warp' ? { warp: !n.warp } : k === 'dpi' ? { antiDpi: !n.antiDpi } : { doh: order[(order.indexOf(n.doh as (typeof order)[number]) + 1) % order.length] };
      NET.busy = true;
      render(true);
      void netSet(p).then((r) => ((NET.s = r), (NET.busy = false), r.error && toast(r.error), render(true)), () => ((NET.busy = false), render(true)));
      return;
    }
    case 'typing': { const inp = el as HTMLInputElement; inp.focus(); inp.onchange = () => ((S.q = inp.value), render(true)); return; }
    case 'pback': player.close(); return render(true);
    case 'ptoggle': return player.toggle();
    case 'seek': return player.seek(+d.d!);
    case 'pnext': return player.next();
    case 'pprev': return player.prev();
    case 'pmenu': return player.menu(d.m!);
    case 'pick': return player.pick(d.pk!, d.v!);
  }
  if (d.upd) return updateDialog.act(d.upd, toast);
}

addEventListener('keydown', (e) => {
  const k = normKey(e);
  if (!k) return;
  if (document.activeElement?.tagName === 'INPUT' && k !== 'back' && k !== 'up' && k !== 'down') return;
  if (document.activeElement?.tagName === 'INPUT') (document.activeElement as HTMLElement).blur();
  if (updateDialog.open() && k !== 'back') {
    e.preventDefault();
    if (k === 'ok') act(current());
    else if (k === 'left' || k === 'right' || k === 'up' || k === 'down') move(k, $('#upd')!);
    return;
  }
  if (k === 'delete' && S.view === 'home') {
    const f = current();
    if (f?.dataset.cw) {
      library.removeContinue(+f.dataset.cw);
      render(true);
      return toast('Removed from Continue watching');
    }
  }
  if (player.P) {
    player.showUi();
    const f = current();
    if (f?.dataset.do === 'seekbar' && (k === 'left' || k === 'right')) return e.preventDefault(), player.seek(k === 'left' ? -10 : 10);
    if (k === 'playpause') return player.toggle();
    if (k === 'rew' || k === 'ff') return player.seek(k === 'rew' ? -10 : 10);
  }
  if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
    e.preventDefault();
    move(k, player.P ? $('#player')! : document, onFocus);
  } else if (k === 'ok') {
    e.preventDefault();
    act(current());
  } else if (k === 'back') {
    e.preventDefault();
    if (updateDialog.open()) return updateDialog.act('later', toast);
    back();
  }
});
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-f]');
  if (t) (focus(t, onFocus), act(t));
});
document.addEventListener('mousemove', () => player.P && player.showUi());

// one shared 1 s ticker, stopped while hidden (rule 10)
let ticker: ReturnType<typeof setInterval> | undefined;
const startTicker = () => (ticker = setInterval(() => {
  player.tick();
  $$('.tmc[data-el]').forEach((n) => (n.textContent = fmt(+n.dataset.el! + (Date.now() - T0) / 1000)));
}, 1000));
const T0 = Date.now();
const fmt = (x: number) => [Math.floor(x / 3600), Math.floor(x / 60) % 60, Math.floor(x % 60)].map((n) => String(n).padStart(2, '0')).join(':');
document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(ticker) : startTicker()));
startTicker();

if (netSupported()) void netGet().then((n) => ((NET.s = n), S.view === 'settings' && render(true)));
render();
// splash: static logo, one opacity fade, ≤ 1.4 s (rule 13)
const sp = document.createElement('div');
sp.id = 'splash';
sp.innerHTML = `<div>${MARK}<h1><b>CINE</b>TOR</h1><small>Developed by Mythbrix</small></div>`;
$('#tv')!.appendChild(sp);
setTimeout(() => sp.remove(), 1400);
setTimeout(() => void checkUpdate(false, toast), 5000);
setInterval(() => void checkUpdate(false, toast), 6 * 3600 * 1000);
