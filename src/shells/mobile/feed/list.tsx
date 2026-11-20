// View all list (grid/list), Search (TMDB search/multi), My Library (prototype V.list, V.search, V.library).
import { useEffect, useState } from 'preact/hooks';
import { searchMulti } from '../../../core/details';
import type { Title } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { BackTop, bg, Empty, ErrorCard, hueOf, Poster } from '../ui/common';
import { useAsync } from '../ui/hooks';
import { back, library, nav, opt, param, setOpt, setUi, ui } from '../state';
import { createStore } from '../../../core/store';
import { epSaved } from '../info/info';

export function ListPage() {
  const title = param<string>('title') || '', items = param<Title[]>('items') || [], kind = param<string>('kind');
  const g = opt('scroll') !== 'list';
  return (
    <>
      <BackTop t={title} extra={<div class="ibtn" role="button" aria-label="Switch view" onClick={() => setOpt('scroll', g ? 'list' : 'grid')}><I n={g ? 'view-agenda-outline' : 'view-grid-outline'} /></div>} />
      <div class="scroll">
        {g ? (
          <div class="pgrid">{items.map((t) => <Poster key={t.id} t={t} kind={kind} />)}</div>
        ) : (
          items.map((t) => (
            <div class="ep" key={t.id} onClick={() => nav('info', { t, kind })}>
              <div class="poster" style={`--h:${hueOf(t.title)};width:64px;border-radius:10px${bg(t.poster, 'w185')}`} />
              <div class="tx"><b>{t.title}</b><small>{t.year} · ★ {t.rating.toFixed(1)} TMDB</small></div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

const recent = createStore<{ q: string[] }>('recent-search', { q: [] }, true);

export function Search() {
  const q = ui.get().q;
  const [dq, setDq] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const res = useAsync(() => (dq ? searchMulti(dq) : Promise.resolve([] as Title[])), dq);
  const remember = () => dq && recent.set({ q: [dq, ...recent.get().q.filter((x) => x !== dq)].slice(0, 6) });
  return (
    <>
      <div class="topbar">
        <div class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
        <div class="field" style="flex:1;height:44px"><I n="magnify" /><input value={q} placeholder="Search movies, series, anime..." autocomplete="off" autoFocus onInput={(e) => setUi({ q: (e.target as HTMLInputElement).value })} onKeyDown={(e) => e.key === 'Enter' && remember()} /></div>
      </div>
      <div class="scroll" onClick={remember}>
        {!dq ? (
          <>
            {recent.get().q.length > 0 && (
              <div class="pad" style="padding-top:14px">
                <div class="row-h" style="padding:0 0 8px"><b style="font-size:14px;color:var(--on-var);font-weight:500">Recent</b><span onClick={() => recent.set({ q: [] })}>Clear</span></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">{recent.get().q.map((s) => <span key={s} class="chip" onClick={() => setUi({ q: s })}><I n="history" /> {s}</span>)}</div>
              </div>
            )}
            <div class="empty" style="min-height:360px"><div style="font-size:56px;color:var(--primary)"><I n="movie-search-outline" /></div><div class="title-m">Your next watch starts here</div><div class="body-m">Search by title</div></div>
          </>
        ) : res.error != null ? (
          <ErrorCard error={res.error} retry={res.retry} />
        ) : res.data && res.data.length ? (
          <>
            <div class="row-h" style="padding-top:12px"><b style="font-size:15px;color:var(--primary);font-weight:500">Results</b><span>{res.data.length} results</span></div>
            <div class="pgrid" style="padding-top:0">{res.data.map((t) => <Poster key={t.id} t={t} />)}</div>
          </>
        ) : res.loading ? (
          <Empty h={200} d="Searching…" />
        ) : (
          <Empty ic="magnify-close" t={`No results for “${q}”`} />
        )}
      </div>
    </>
  );
}

export function Library() {
  const items = library.saved();
  void epSaved;
  return (
    <>
      <BackTop t="My Library" />
      <div class="scroll">
        {items.length ? <div class="pgrid">{items.map((t) => <Poster key={t.id} t={t} />)}</div> : <Empty ic="bookmark-off-outline" t="Your library is empty" d="Use the bookmark icon on a title to add it here." h={520} />}
      </div>
    </>
  );
}
