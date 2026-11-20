// Desktop pages (prototype web Feed, Detail, Person, ListPage, Library, Search, TvPage, Music).
import { useEffect, useState } from 'preact/hooks';
import { byGenre, COMIC_OPTIONS, DRAMA_OPTIONS, loadSection, type Feed as FeedT, type Section } from '../../core/catalog';
import { loadDetails, loadPerson, loadSeason, searchMulti } from '../../core/details';
import { LIVE_ALL } from '../../core/live';
import { SPORT } from '../../core/sports';
import { MADE_FOR_YOU, TILES } from '../../core/music';
import { enqueue, dlId, dlStore } from '../../core/downloads';
import { img, type Title } from '../../core/tmdb';
import { useAsync } from '../mobile/ui/hooks';
import { Chips, ErrorCard, Hero, hue, Ic, Poster, rate, Row } from './ui';
import { dlPop, go, library, param, setUi, toggleLib, ui } from './state';
import { play, playLive } from './player';

export function Feed({ kind }: { kind: Section }) {
  const opts = kind === 'drama' ? [...DRAMA_OPTIONS] : kind === 'comics' ? [...COMIC_OPTIONS] : null;
  const [opt, setOpt] = useState(opts ? opts[0] : '');
  const [cat, setCat] = useState('All');
  const r = useAsync<FeedT>(() => loadSection(kind, opt || undefined), kind + opt);
  const d = r.data, comic = kind === 'comics';
  const cw = library.continueWatching();
  return (
    <main>
      {opts && <Chips list={opts} cur={opt} set={setOpt} />}
      {!d && r.loading && <div class="page"><p class="sub">Loading TMDB…</p></div>}
      {r.error != null && <ErrorCard error={r.error} retry={r.retry} />}
      {d && (
        <>
          <Hero items={d.hero} comic={comic} />
          <Chips list={['All', ...d.genres]} cur={cat} set={setCat} />
          {cat !== 'All' ? (
            <div class="grid">{byGenre(d, cat).map((it) => <Poster key={it.id} it={it} comic={comic} />)}</div>
          ) : (
            <div>
              {kind === 'home' && cw.length > 0 && (
                <section class="row">
                  <h2>Continue watching<button onClick={() => library.clearContinue()}>Clear all</button></h2>
                  <div class="rail">{cw.map((c) => <Poster key={c.title.id} it={c.title} bar={Math.round(c.progress * 100)} rm={() => library.removeContinue(c.title.id)} />)}</div>
                </section>
              )}
              {d.rows.map((row) => <Row key={row.id} title={row.title} items={row.items} comic={comic} />)}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function Detail() {
  const it = param<Title>('t')!, comic = !!param<boolean>('comic');
  const [season, setSeason] = useState(1);
  const det = useAsync(() => loadDetails(it), it.mediaType + it.id);
  const eps = useAsync(() => (it.mediaType === 'tv' && !comic ? loadSeason(it.id, season) : Promise.resolve([])), it.id + '|' + season);
  const x = det.data, t = x?.title || it;
  useStore2();
  return (
    <main>
      <div class="det">
        <div class="dbg" style={{ backgroundImage: t.backdrop ? `url(${img(t.backdrop, 'w1280')})` : undefined }} />
        {!comic && x?.trailerKey && <iframe src={`https://www.youtube-nocookie.com/embed/${x.trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${x.trailerKey}&modestbranding=1&playsinline=1`} allow="autoplay; encrypted-media" title="Trailer" />}
        <div class="dc">
          <h1>{t.title}</h1>
          <div class="meta">
            <b><Ic n="star" /> {rate(t)} TMDB</b><span>{t.year}</span>
            {x && x.runtime > 0 && <span>{x.runtime} min</span>}
            {x && x.seasons.length > 0 && <span>{x.seasons.length} seasons</span>}
            <span>{(x?.genres || []).join(' · ')}</span>
          </div>
          <p class="ov" style={{ WebkitLineClamp: 6 }}>{x?.overview || t.overview}</p>
          <div class="btns">
            <button class="btn p" onClick={() => (comic ? setUi({ reader: { t, ch: 214 } }) : play(t, 1, 1, x?.seasons))}><Ic n={comic ? 'book-open-variant' : 'play'} /> {comic ? (library.lastPage(t.id, 214) ? 'Continue reading' : 'Read') : 'Play'}</button>
            <button class="btn" onClick={() => toggleLib(t)}><Ic n={library.isSaved(t.id) ? 'check' : 'plus'} /> My List</button>
            <button class="btn" onClick={() => setUi({ dls: { t, comic, season } })}><Ic n="download-outline" /> Download</button>
          </div>
        </div>
      </div>
      {det.error != null && !x && <ErrorCard error={det.error} retry={det.retry} />}
      {x && x.cast.length > 0 && (
        <section class="row"><h2>Cast</h2>
          <div class="cast">{x.cast.map((c) => <button key={c.id} onClick={() => go('person', { id: c.id, name: c.name })}><u style={{ backgroundImage: c.photo ? `url(${img(c.photo, 'w185')})` : undefined }}>{c.photo ? '' : c.name[0]}</u>{c.name}<small>{c.character}</small></button>)}</div>
        </section>
      )}
      {comic && (
        <section class="row"><h2>Chapters</h2>
          <div class="eps">
            {Array.from({ length: 12 }, (_, i) => {
              const ch = 214 - i, rp = library.lastPage(t.id, ch), d = dlStore.get().items[dlId('comic', t.id, 1, i + 1)];
              return (
                <div key={i} class="g ep" onClick={() => setUi({ reader: { t, ch } })}>
                  <div style={{ flex: 1 }}>
                    <b>Chapter {ch}</b>
                    <small>{rp >= 12 ? 'Read · 12 pages' : rp ? 'Page ' + rp + ' of 12 · ' + Math.round((rp / 12) * 100) + '% read' : '12 pages · unread'}{d ? ' · PDF ' + (d.status === 'done' ? 'saved' : '…') : ''}</small>
                    {rp > 0 && <div style={{ height: 4, background: 'var(--s3)', borderRadius: 2, marginTop: 8, maxWidth: 220 }}><div style={{ height: '100%', width: Math.min(100, (rp / 12) * 100) + '%', background: '#fff', borderRadius: 2 }} /></div>}
                  </div>
                  <button class="pb" title="Download PDF" onClick={(e) => { e.stopPropagation(); if (enqueue([{ titleId: t.id, title: t.title, kind: 'comic', season: 1, episode: i + 1, quality: 1080, audio: 'OG', chapter: ch }])) dlPop('Download started · 1 item (PDF)'); }}><Ic n="file-pdf-box" /></button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {t.mediaType === 'tv' && !comic && x && (
        <section class="row">
          <h2>Episodes <select class="sel" value={season} onChange={(e) => setSeason(+(e.target as HTMLSelectElement).value)}>{x.seasons.map((_, i) => <option key={i} value={i + 1}>Season {i + 1}</option>)}</select></h2>
          <div class="eps">
            {(eps.data || []).map((e) => {
              const w = library.progress(t.id, season, e.n), d = dlStore.get().items[dlId('video', t.id, season, e.n)];
              return (
                <div key={e.n} class="g ep" onClick={() => play(t, season, e.n, x.seasons)}>
                  <div class="th" style={{ backgroundImage: e.still ? `url(${img(e.still, 'w300')})` : undefined }}>{w > 0.01 && <span class="bar"><b style={{ width: Math.round(w * 100) + '%' }} /></span>}</div>
                  <div style={{ flex: 1 }}><b>{e.n}. {e.name}</b><small>{e.runtime || 48} min{w > 0.01 ? ' · ' + Math.round(w * 100) + '% watched' : ''}{d ? ' · ' + d.quality + 'p' : ''}</small></div>
                  <Ic n="play-circle-outline" />
                </div>
              );
            })}
          </div>
        </section>
      )}
      {x && <Row title="More like this" items={x.similar} comic={comic} />}
    </main>
  );
}
function useStore2() {
  const [, s] = useState(0);
  useEffect(() => dlStore.subscribe(() => s((n) => n + 1)), []);
}

export function Person() {
  const id = param<number>('id')!, name = param<string>('name') || '';
  const [seg, setSeg] = useState('Movies');
  const r = useAsync(() => loadPerson(id), String(id));
  const d = r.data;
  return (
    <main class="page">
      <h1>{name}</h1>
      <p class="sub">{d ? d.movies.length + ' movies · ' + d.series.length + ' series' : 'Loading…'}</p>
      <Chips list={['Movies', 'Series']} cur={seg} set={setSeg} />
      {d && <div class="grid" style={{ padding: '12px 0' }}>{(seg === 'Movies' ? d.movies : d.series).slice(0, 40).map((it) => <Poster key={it.id} it={it} />)}</div>}
    </main>
  );
}

export function ListPage() {
  const title = param<string>('title') || '', items = param<Title[]>('items') || [], comic = !!param<boolean>('comic');
  return <main class="page"><h1>{title}</h1><p class="sub">{items.length} titles</p><div class="grid" style={{ padding: '12px 0' }}>{items.map((it) => <Poster key={it.id} it={it} comic={comic} />)}</div></main>;
}

export function Library() {
  const a = library.saved();
  return <main class="page"><h1>My Library</h1><p class="sub">{a.length ? a.length + ' saved' : 'Nothing saved yet. Use My List on any title.'}</p><div class="grid" style={{ padding: '12px 0' }}>{a.map((it) => <Poster key={it.id} it={it} />)}</div></main>;
}

export function Search() {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const r = useAsync(() => (dq ? searchMulti(dq) : Promise.resolve([] as Title[])), dq);
  return (
    <main class="page">
      <h1>Search</h1>
      <input class="sel" style={{ width: 'min(560px,100%)', fontSize: 18, padding: '14px 18px', borderRadius: 999 }} autoFocus placeholder="Search movies, series, anime…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      {r.error != null && <ErrorCard error={r.error} retry={r.retry} />}
      <div class="grid" style={{ padding: '18px 0' }}>{(r.data || []).map((it) => <Poster key={it.id} it={it} />)}</div>
      {dq && r.data && !r.data.length && !r.loading && <p class="sub">No results for “{dq}”</p>}
    </main>
  );
}

export function TvPage() {
  const [seg, setSeg] = useState('Live TV');
  return (
    <main class="page">
      <h1>TV</h1>
      <Chips list={['Live TV', 'Sports']} cur={seg} set={setSeg} />
      <div class="grid" style={{ padding: '14px 0' }}>
        {seg === 'Live TV'
          ? LIVE_ALL.slice(0, 24).map((c) => (
              <button key={c[0] + c[3]} class="g" style={{ padding: '26px 14px', textAlign: 'center' }} onClick={() => playLive(c[1])}>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{c[0]}</div><small style={{ color: 'var(--dim)' }}>{c[1]} · {c[3]}</small>
              </button>
            ))
          : SPORT.filter((m) => m.st === 'live').map((m) => (
              <button key={m.id} class="g" style={{ padding: '16px', textAlign: 'left' }} onClick={() => playLive(m.a + ' vs ' + m.b)}>
                <small style={{ color: 'var(--dim)' }}>{m.sport} II {m.league}</small>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 600, gap: 8 }}><span>{m.a}</span><b>VS</b><span>{m.b}</span></div>
                <span style={{ background: '#fff', color: '#111', fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 8, display: 'inline-block', marginTop: 10 }}>LIVE</span>
              </button>
            ))}
      </div>
    </main>
  );
}

export function Music() {
  const p = [...MADE_FOR_YOU, ...TILES];
  return (
    <main class="page">
      <h1>Music</h1><p class="sub">Playlists made for you</p>
      <div class="grid" style={{ padding: '12px 0' }}>
        {p.map(({ title: n }) => (
          <button key={n} class="g" style={{ position: 'relative', aspectRatio: '1', padding: 16, textAlign: 'left', display: 'flex', alignItems: 'flex-end', fontWeight: 700, fontSize: 18, backgroundImage: `linear-gradient(135deg,hsl(${hue(n)} 60% 40%),hsl(${hue(n) + 50} 55% 20%))` }} onClick={() => playMusic(n)}>
            {n}
            <span class="pb" style={{ position: 'absolute', right: 10, top: 10, width: 36, height: 36 }} title="Download to Music/" onClick={(e) => { e.stopPropagation(); if (enqueue([{ titleId: hue(n) + 1e6, title: n, kind: 'music', season: 1, episode: 1, quality: 1080, audio: 'OG' }])) dlPop('Download started · Music'); }}><Ic n="download-outline" /></span>
          </button>
        ))}
      </div>
    </main>
  );
}
let audio: HTMLAudioElement | null = null;
async function playMusic(n: string) {
  const { trackUrl } = await import('../../core/music');
  audio = audio || new Audio();
  audio.src = trackUrl(n);
  audio.play().catch(() => {});
  ui.set({ toast: 'Playing ' + n });
  setTimeout(() => ui.set({ toast: '' }), 1800);
}
