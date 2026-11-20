// Desktop root (prototype web App): sticky glass top bar, nav, pages, overlays.
import { useEffect } from 'preact/hooks';
import { applyTheme } from '../shared/theme';
import { useStore } from '../mobile/ui/hooks';
import { createStore } from '../../core/store';
import { dlStore, speeds } from '../../core/downloads';
import { adult, back, cur, library, prefs, root, router, setUi, ui } from './state';
import { Ic, Mark } from './ui';
import { dpl, Player } from './player';
import { Detail, Feed, Library, ListPage, Music, Person, Search, TvPage } from './pages';
import { Downloads, DlSheet, Pin, Reader, Settings } from './overlays';

const rv = createStore('d-rv', { v: 0 }, false);
router.subscribe(() => rv.set({ v: rv.get().v + 1 }));
const NAVS: [string, string][] = [['home', 'Home'], ['anime', 'Anime'], ['drama', 'Drama'], ['tv', 'TV'], ['music', 'Music'], ['comics', 'Comics'], ['adult', 'Adult'], ['library', 'My Library'], ['downloads', 'Downloads']];

export function App() {
  [rv, ui, prefs, library.store, adult.store, dpl, dlStore, speeds].forEach((s) => useStore(s as never));
  const p = prefs.get(), u = ui.get(), r = cur();
  useEffect(() => applyTheme(p.seed), [p.seed]);
  useEffect(() => void document.documentElement.classList.toggle('lg', p.lg), [p.lg]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !dpl.get().on && !u.pin && !u.dls && !u.reader && back();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [u.pin, u.dls, u.reader]);
  const pageKey = ['detail', 'person', 'list'].includes(r.name) ? null : r.name;
  const locked = <main class="page"><h1>Adult section is locked</h1><p class="sub">Enter your PIN to continue.</p></main>;
  let page;
  switch (r.name) {
    case 'anime': case 'drama': case 'comics': page = <Feed key={r.name} kind={r.name} />; break;
    case 'adult': page = u.adultOk ? <Feed key="adult" kind="adult" /> : locked; break;
    case 'tv': page = <TvPage />; break;
    case 'music': page = <Music />; break;
    case 'search': page = <Search />; break;
    case 'settings': page = <Settings />; break;
    case 'library': page = <Library />; break;
    case 'downloads': page = <Downloads />; break;
    case 'detail': page = isAdultTitle(r.params?.t as Title) && !u.adultOk ? locked : <Detail key={String((r.params?.t as { id: number }).id)} />; break;
    case 'person': page = <Person key={String(r.params?.id)} />; break;
    case 'list': page = <ListPage />; break;
    default: page = <Feed key="home" kind="home" />;
  }
  return (
    <>
      <header class="top">
        <div class="brand" onClick={() => root('home')}><Mark />CINE<span>TOR</span></div>
        <nav class="nav">{NAVS.filter((n) => n[0] !== 'adult' || adult.isOn()).map(([k, l]) => <button key={k} class={pageKey === k ? 'on' : ''} onClick={() => root(k)}>{l}</button>)}</nav>
        {router.stack().length > 1 && <button class="ib" title="Back" onClick={back}><Ic n="arrow-left" /></button>}
        <a class="ib" href="../m/" title="Mobile view" style={{ textDecoration: 'none', color: 'inherit' }}><Ic n="cellphone" /></a>
        <button class="ib" title="Search" onClick={() => root('search')}><Ic n="magnify" /></button>
        <button class="ib" title="Settings" onClick={() => root('settings')}><Ic n="cog-outline" /></button>
      </header>
      {page}
      <Pin />
      {u.dls && <DlSheet />}
      {u.reader && <Reader />}
      {dpl.get().on && <Player />}
      {u.pop && <button class="toast" style={{ bottom: 84, display: 'flex', gap: 10, alignItems: 'center' }} onClick={() => (setUi({ pop: '' }), root('downloads'))}><Ic n="download" />{u.pop}<b style={{ background: '#111', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12 }}>View</b></button>}
      {u.toast && <div class="toast">{u.toast}</div>}
    </>
  );
}
