// TV views as template strings (prototype V.*). Rules: ≤ 8 rows, ≤ 12 posters + header "See all", <img loading=lazy>.
import { byGenre, COMIC_OPTIONS, DRAMA_OPTIONS, loadSection, type Feed, type Section } from '../../core/catalog';
import { loadDetails, loadPerson, loadSeason, searchMulti, type Details, type Episode, type Person } from '../../core/details';
import { GEN } from '../../core/catalog';
import { LIVE_ALL } from '../../core/live';
import { crestOf, fmtHMS, hashS, HILITES, matchesFor, SPICON, SPORTS, SP_TABS, spCounts, type Match, type SpTab } from '../../core/sports';
import { MADE_FOR_YOU, TILES } from '../../core/music';
import { img, type Title } from '../../core/tmdb';
import { VERSION } from '../../core/config';
import { pinTitle } from '../../core/pin';
import { I } from './icons';
import { adult, library, S } from './state';

void COMIC_OPTIONS;
export const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const hue = (t: string) => hashS(t) % 360;
/** Items stored by id for data-* lookups. */
export const REG = new Map<string, Title>();
export const LISTS = new Map<string, { t: string; a: Title[] }>();
let LID = 0;
const reg = (t: Title) => (REG.set(t.mediaType + t.id, t), t.mediaType + t.id);

const imgTag = (path: string | null, size: 'w185' | 'w300', w: number, h: number) =>
  path ? `<img data-src="${img(path, size)}" alt="" loading="lazy" decoding="async" width="${w}" height="${h}">` : '';
export function pt(t: Title, extra = '', attrs = '') {
  return `<div class="pt" data-f data-go="info" data-k="${reg(t)}" ${attrs} style="--h:${hue(t.title)}">${imgTag(t.poster, 'w185', 158, 236)}<b class="r">${I('star')} ${t.rating ? t.rating.toFixed(1) : '–'}</b><span>${esc(t.title)}</span>${extra}</div>`;
}
const seeB = (id: string) => `<span class="seeb" data-f data-do="seeall" data-lid="${id}">See all ${I('chevron-right')}</span>`;
export function row(title: string, a: Title[]) {
  if (!a.length) return '';
  const id = 'L' + ++LID;
  LISTS.set(id, { t: title, a });
  return `<div class="row"><h3><span>${esc(title)}</span>${seeB(id)}</h3><div class="rail">${a.slice(0, 12).map((t) => pt(t)).join('')}</div></div>`;
}
const chips = (k: string, list: string[], cur: string) => `<div class="chips">${list.map((x) => `<span class="chip${x === cur ? ' on' : ''}" data-f data-do="opt" data-ok="${k}" data-v="${esc(x)}">${esc(x)}</span>`).join('')}</div>`;
function hero(t: Title, go = 'info', d?: Details | null) {
  const bg = t.backdrop ? `,url(${img(t.backdrop, 'w780')}) center/cover` : '';
  return `<div class="hero" style="--hbg:linear-gradient(160deg,hsl(${hue(t.title)} 55% 30%),#050505)${bg}"><h1>${esc(t.title)}</h1><div class="meta"><span class="rt">${I('star')} ${t.rating.toFixed(1)} TMDB</span><span>${t.year}</span><span>${d?.maturity || 'TV-14'}</span><span>1080p</span></div><div class="syn">${esc((d?.overview || t.overview).slice(0, 260))}</div><div class="btns"><span class="btn p" data-f data-go="${go}" data-k="${reg(t)}">${I('play')} Play</span><span class="btn" data-f data-do="lib" data-k="${reg(t)}">${I(library.isSaved(t.id) ? 'check' : 'plus')} My List</span></div></div>`;
}

// ---- data cache (feeds keep the last good copy) ----
export const feeds = new Map<string, Feed>();
export const details = new Map<string, Details>();
export const seasons = new Map<string, Episode[]>();
export const people = new Map<number, Person>();
export const searches = new Map<string, Title[]>();
export const errors = new Map<string, unknown>();
type Loader = () => void;
export function need<T>(map: Map<string | number, T>, key: string | number, load: () => Promise<T>, done: Loader) {
  if (map.has(key) || errors.has(String(key))) return map.get(key);
  load().then((v) => (map.set(key, v), errors.delete(String(key)), done()), (e) => (errors.set(String(key), e), done()));
  return undefined;
}
const errCard = (k: string) => `<div class="pc"><h2>Can't reach the catalog right now</h2><div class="sub">Check your connection and try again.</div><span class="btn" data-f data-do="retry" data-key="${esc(k)}">Retry</span></div>`;
const loading = '<div class="pc"><div class="sub">Loading…</div></div>';

function feedView(key: Section, option: string | undefined, rerender: Loader) {
  const k = key + '|' + (option || '');
  const f = need(feeds as Map<string, Feed>, k, () => loadSection(key, option, { light: true, because: library.continueWatching()[0]?.title.title }), rerender);
  if (!f) return errors.has(k) ? errCard(k) : loading;
  const c = S.opt.cat;
  const cw = key === 'home' ? cwRow() : '';
  const body = c === 'All'
    ? cw + f.rows.slice(0, cw ? 7 : 8).map((r) => row(r.title, r.items)).join('')
    : `<div class="ttl">${esc(c)}</div><div class="grid">${byGenre(f, c).map((t) => pt(t)).join('')}</div>`;
  return (f.hero[0] ? hero(f.hero[0]) : '') + chips('cat', ['All', ...f.genres], c) + body;
}
function cwRow() {
  const cw = library.continueWatching();
  if (!cw.length) return '';
  return `<div class="row"><h3>Continue watching <small style="color:var(--dim);font-weight:400;font-size:14px">  Press Delete to remove the selected one</small></h3><div class="rail">${cw.slice(0, 12).map((c) => pt(c.title, `<div class="bar"><b style="width:${Math.round(c.progress * 100)}%"></b></div>`, `data-cw="${c.title.id}"`)).join('')}<div class="pt see" data-f data-do="cwclear">${I('delete-sweep-outline')}<b>Clear all</b></div></div></div>`;
}

function info(r: Loader) {
  const t = S.t!, k = t.mediaType + t.id;
  const d = need(details as Map<string, Details>, k, () => loadDetails(t), r) || null;
  let h = hero(t, 'player', d);
  if (d && d.cast.length) h += `<div class="row"><h3>Cast</h3><div class="cast">${d.cast.map((c) => `<div class="c" data-f data-do="person" data-pid="${c.id}" data-t="${esc(c.name)}"><u style="position:relative;overflow:hidden">${c.photo ? `<img data-src="${img(c.photo, 'w185')}" alt="" loading="lazy" decoding="async" width="96" height="96">` : esc(c.name[0])}</u>${esc(c.name)}</div>`).join('')}</div></div>`;
  if (t.mediaType === 'tv' && d) {
    const s = S.season, sk = t.id + '|' + s;
    const eps = need(seasons as Map<string, Episode[]>, sk, () => loadSeason(t.id, s), r);
    h += chips('season', d.seasons.map((_, i) => 'Season ' + (i + 1)), 'Season ' + s) + '<div style="height:12px"></div>';
    h += eps ? eps.map((e) => {
      const w = library.progress(t.id, s, e.n);
      return `<div class="ep" data-f data-go="player" data-k="${k}" data-s="${s}" data-e="${e.n}"><div class="th" style="--h:${hue(t.title) + e.n * 10};position:relative;overflow:hidden">${e.still ? `<img data-src="${img(e.still, 'w300')}" alt="" loading="lazy" decoding="async" width="240" height="135">` : ''}<div class="bar" style="position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.25)">${w > 0.01 ? `<b style="display:block;height:100%;width:${Math.round(w * 100)}%;background:#fff"></b>` : ''}</div></div><div><b>${e.n}. ${esc(e.name)}</b><small>${e.runtime || 48} min${w > 0.01 ? ' · ' + Math.round(w * 100) + '% watched' : ''}</small></div></div>`;
    }).join('') : errors.has(sk) ? errCard(sk) : loading;
  }
  if (d) h += row('For you', d.similar);
  if (!d && errors.has(k)) h += errCard(k);
  return h;
}

function crest(n: string) {
  const c = crestOf(n);
  return 'flag' in c ? `<span class="cr" style="background:${c.flag}"></span>` : `<span class="cr tc">${c.short}</span>`;
}
const T0 = Date.now();
const mcard = (m: Match, hl: boolean) => `<div class="mcd" data-f data-go="player" data-live="${esc(m.a === m.b ? m.a : m.a + ' vs ' + m.b)}"><div class="mh"><span>${m.sport} II ${esc(m.league)}</span><span class="mr">${hl ? m.date : m.st === 'live' ? `<span class="tmc" data-el="${m.el}">${fmtHMS((m.el || 0) + (Date.now() - T0) / 1000)}</span><span class="live">LIVE</span>` : `<span class="tmc">${m.time}</span> ${m.date}`}</span></div><div class="mbd">${crest(m.a)}<span class="tn">${esc(m.a)}</span><b class="vs">VS</b><span class="tn">${esc(m.b)}</span>${crest(m.b)}</div></div>`;
function sports() {
  const sp = S.opt.sp, st = S.opt.st as SpTab, c = spCounts(sp);
  let list = matchesFor(sp, st);
  if (st === 'All') list = list.slice().sort((x, y) => (x.st === 'live' ? 0 : 1) - (y.st === 'live' ? 0 : 1));
  return `<div class="spr">${SPORTS.map((x) => `<div class="spc${x === sp ? ' on' : ''}" data-f data-do="opt" data-ok="sp" data-v="${x}"><span class="ring">${I(x === 'All' ? 'television-classic' : SPICON[x])}<b class="bdg">${spCounts(x).All}</b></span><small>${x}</small></div>`).join('')}</div>
  <div class="sts">${SP_TABS.map((t) => `<span class="${t === st ? 'on' : ''}" data-f data-do="opt" data-ok="st" data-v="${t}">${t === st ? '✓ ' : ''}${t} (${c[t]})</span>`).join('')}</div>
  ${list.length ? `<div class="mgrid">${list.map((m) => mcard(m, st === 'Highlights')).join('')}</div>` : '<div class="pc"><h2>No Events Found</h2></div>'}`;
}
function liveTv() {
  return GEN.tv.map((cat) => {
    const g = LIVE_ALL.filter((c) => c[4] === cat);
    if (!g.length) return '';
    const id = 'L' + ++LID;
    LISTS.set(id, { t: cat + ' channels', a: [] });
    return `<div class="row"><h3><span>${cat}</span><span class="seeb" data-f data-do="chall" data-cat="${esc(cat)}">See all ${I('chevron-right')}</span></h3><div class="rail">${g.slice(0, 12).map((c) => `<div class="ch" data-f data-go="player" data-live="${esc(c[1])}"><span class="live" style="position:absolute;top:10px;right:10px">LIVE</span><div><b>${c[0]}</b><small>${esc(c[1])} · Ch ${c[3]}</small></div></div>`).join('')}</div></div>`;
  }).slice(0, 8).join('');
}

export function pinScreen() {
  const f = S.pin!;
  return `<div class="pc"><div style="font-size:54px">${I('shield-lock-outline')}</div><h2>${esc(pinTitle(f))}</h2><div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < f.buf.length ? 'on' : ''}"></i>`).join('')}</div><div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', 'b'].map((k) => `<div class="k" data-f data-do="key" data-key="${k}">${k === 'x' ? 'Cancel' : k === 'b' ? I('backspace-outline') : k}</div>`).join('')}</div></div>`;
}

export function view(v: string, r: Loader): string {
  switch (v) {
    case 'home': return feedView('home', undefined, r);
    case 'anime': return feedView('anime', undefined, r);
    case 'drama': return '<div style="height:14px"></div>' + chips('drama', [...DRAMA_OPTIONS], S.opt.drama) + feedView('drama', S.opt.drama, r);
    case 'adult': return S.adultOk ? feedView('adult', undefined, r) : '<div class="pc"><h2>Adult section is locked</h2></div>';
    case 'music': return `<div class="ttl">Music</div><div class="sub">Playlists made for you</div><div class="grid">${[...MADE_FOR_YOU, ...TILES].map((p) => `<div class="pt" data-f data-do="music" data-t="${esc(p.title)}" style="--h:${p.hue}"><span>${esc(p.title)}</span></div>`).join('')}</div>`;
    case 'tv': return `<div class="ttl">TV</div>${chips('tv', ['Live TV', 'Sports'], S.opt.tv)}` + (S.opt.tv === 'Live TV' ? liveTv() : sports());
    case 'settings': return `<div class="ttl">Settings</div><div style="height:14px"></div><div class="set" data-f data-do="adultset">${I('shield-lock-outline')}<div class="g">Adult section<small>${adult.isOn() ? 'On · PIN required to open' : 'Off · enable with a PIN'}</small></div><div class="swt${adult.isOn() ? ' on' : ''}"></div></div>${adult.isOn() ? `<div class="set" data-f data-do="pinchg">${I('shield-lock-outline')}<div class="g">Change PIN<small>Verify the current PIN first</small></div></div>` : ''}<div class="set" data-f data-do="update">${I('information-outline')}<div class="g">About Cinetor<small>Version ${VERSION} · Developed by Mythbrix · OK = check for updates</small></div></div>`;
    case 'search': {
      const q = S.q.trim();
      const res = q ? need(searches as Map<string, Title[]>, q, () => searchMulti(q), r) : undefined;
      return `<div class="ttl">Search</div><input class="srch" data-f data-do="typing" placeholder="Type with the remote, then OK" value="${esc(S.q)}">${q ? (res ? (res.length ? `<div class="grid">${res.slice(0, 24).map((t) => pt(t)).join('')}</div>` : `<div class="pc"><h2>No results</h2></div>`) : errors.has(q) ? errCard(q) : loading) : (feeds.get('home|') ? `<div class="sub">Pick a title</div><div class="grid">${feeds.get('home|')!.pool.slice(0, 24).map((t) => pt(t)).join('')}</div>` : '')}`;
    }
    case 'info': return info(r);
    case 'list': {
      const l = LISTS.get(S.lid) || { t: '', a: [] };
      return `<div class="ttl">${esc(l.t)}</div><div class="sub">${l.a.length} titles</div><div class="grid">${l.a.slice(0, S.gridN).map((t) => pt(t)).join('')}</div>`;
    }
    case 'channels': {
      const g = LIVE_ALL.filter((c) => c[4] === S.lid);
      return `<div class="ttl">${esc(S.lid)} channels</div><div class="grid">${g.map((c) => `<div class="ch" data-f data-go="player" data-live="${esc(c[1])}"><span class="live" style="position:absolute;top:10px;right:10px">LIVE</span><div><b>${c[0]}</b><small>${esc(c[1])} · Ch ${c[3]}</small></div></div>`).join('')}</div>`;
    }
    case 'library': {
      const a = library.saved();
      return `<div class="ttl">My Library</div><div class="sub">Titles you saved</div>${a.length ? `<div class="grid">${a.map((t) => pt(t)).join('')}</div>` : '<div class="pc"><h2>Your library is empty</h2><div class="sub">Open a title and choose My List</div></div>'}`;
    }
    case 'person': {
      const p = need(people as Map<number, Person>, S.pid, () => loadPerson(S.pid), r);
      const seg = S.opt.pseg, l = p ? (seg === 'Movies' ? p.movies : p.series) : [];
      return `<div class="ttl">${esc(p?.name || S.pname)}</div><div class="sub">${p ? p.movies.length + ' movies · ' + p.series.length + ' series' : 'Loading…'}</div>${chips('pseg', ['Movies', 'Series'], seg)}<div class="grid">${l.slice(0, 24).map((t) => pt(t)).join('')}</div>`;
    }
    case 'pin': return pinScreen();
  }
  return '';
}
export { HILITES };
