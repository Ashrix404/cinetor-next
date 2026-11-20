// Info page (prototype V.info): trailer, inline player, metadata, actions, cast, seasons/episodes, For you.
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadDetails, loadSeason, type Details } from '../../../core/details';
import { img, type Title } from '../../../core/tmdb';
import { createStore } from '../../../core/store';
import { I } from '../ui/icons';
import { useAsync, useStore } from '../ui/hooks';
import { back, library, nav, param, setUi, toast, ui } from '../state';
import { bg, ErrorCard, hueOf, Loading, ratingOf, Row } from '../ui/common';
import { pl, startAt, toPip } from '../player/store';
import { Vcore } from '../player/controls';
import { PlayerSheet } from '../player/sheets';
import { DlBtn, DlSheet, openDl, openDlAll, allDone } from '../dl/sheet';

/** Per-episode bookmarks (prototype libBtn on episodes). */
export const epSaved = createStore<Record<string, boolean>>('ep-saved', {}, true);

function Trailer({ k }: { k: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 1000);
    return () => clearTimeout(t);
  }, [k]);
  if (!on) return null;
  const src = `https://www.youtube-nocookie.com/embed/${k}?autoplay=1&mute=1&controls=0&loop=1&playlist=${k}&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&fs=0`;
  return <div class="ytr on"><iframe src={src} allow="autoplay; encrypted-media" tabIndex={-1} title="Trailer" /></div>;
}

/** Inline portrait player with swipe down → PiP, swipe up → fullscreen. */
function InlinePlayer() {
  const ref = useRef<HTMLDivElement>(null);
  const sw = useRef<{ x: number; y: number } | null>(null);
  const fs = () => nav('player');
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.pi,.ibtn,.sk,.big,.ptrk')) return;
    sw.current = { x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent) => {
    const s = sw.current, el = ref.current;
    if (!s || !el) return;
    const dy = e.clientY - s.y, dx = e.clientX - s.x;
    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      el.style.transition = 'none';
      el.style.transform = `translateY(${Math.max(-40, Math.min(60, dy * 0.4))}px) scale(${1 - Math.min(0.12, Math.abs(dy) / 900)})`;
    }
  };
  const up = (e: PointerEvent) => {
    const s = sw.current, el = ref.current;
    sw.current = null;
    if (!s || !el) return;
    el.style.transition = 'transform .18s';
    el.style.transform = '';
    const dy = e.clientY - s.y, dx = e.clientX - s.x;
    if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx) * 1.4) (dy > 0 ? toPip() : fs());
  };
  return (
    <div class="ivp" ref={ref} style={`--h:${pl.get().hue};touch-action:none`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Vcore land={false} onFs={fs} />
    </div>
  );
}

function Episodes({ t, d, comic }: { t: Title; d: Details; comic: boolean }) {
  const u = ui.get(), s2 = u.season, h = hueOf(t.title), p = pl.get();
  useStore(epSaved);
  const eps = useAsync(() => (comic ? Promise.resolve([]) : loadSeason(t.id, s2)), t.id + '|' + s2);
  const dlDone = allDone(t, s2, comic ? 12 : eps.data?.length || 6);
  const head = (
    <div class="srw">
      <span class="chip sel" onClick={() => !comic && setUi({ season: (s2 % Math.max(1, d.seasons.length)) + 1 })}>{comic ? 'Chapters' : 'Season ' + s2} {!comic && <I n="chevron-down" />}</span>
      <span class="chip" onClick={() => toast('Sorted')}><I n="sort" /></span>
      <span class="sp1" />
      <span class={'dlb' + (library.isSaved(t.id) ? ' on' : '')} aria-label="My Library" onClick={() => toast(library.toggleSaved(t) ? 'Added to My Library' : 'Removed from My Library')}><I n={library.isSaved(t.id) ? 'bookmark-check' : 'bookmark-plus-outline'} /></span>
      <span class={'dlb' + (dlDone ? ' on' : '')} aria-label="Download all" onClick={() => openDlAll(t, comic ? 'comic' : 'series', s2)}><I n={dlDone ? 'check-circle' : 'download-outline'} /></span>
    </div>
  );
  if (comic)
    return (
      <>
        {head}
        {Array.from({ length: 12 }, (_, i) => {
          const ch = 214 - i, pg = library.lastPage(t.id, ch), done = pg >= 12, part = pg > 0 && !done;
          return (
            <div class="ep" key={ch} onClick={() => nav('reader', { t, ch })}>
              <div class="th" style={`--h:${h + i * 8};width:56px;aspect-ratio:3/4;border-radius:8px${bg(t.poster, 'w185')}`}>{pg > 0 && <div class="pbar"><b style={`width:${Math.min(100, (pg / 12) * 100)}%`} /></div>}</div>
              <div class="tx">
                <b style={part ? 'color:var(--primary)' : ''}>Chapter {ch}</b>
                <small>{done ? 'Read · 12 pages' : part ? `Page ${pg} of 12 · ${Math.round((pg / 12) * 100)}% read` : '12 pages · unread'}</small>
                {part && <div class="cprog"><i style={`width:${(pg / 12) * 100}%`} /></div>}
              </div>
              {done && <span class="dlb on"><I n="check-circle" /></span>}
              <DlBtn t={t} s={1} e={i + 1} kind="comic" />
            </div>
          );
        })}
      </>
    );
  if (eps.error != null && !eps.data) return <>{head}<ErrorCard error={eps.error} retry={eps.retry} /></>;
  if (!eps.data) return <>{head}<Loading h={120} /></>;
  return (
    <>
      {head}
      {eps.data.map((e) => {
        const w = library.progress(t.id, s2, e.n), now = p.active && p.title?.id === t.id && p.st.season === s2 && p.st.episode === e.n;
        const k = `${t.id}|${s2}|${e.n}`;
        return (
          <div class="ep" key={e.n} onClick={() => startAt(t, s2, e.n, { seasons: d.seasons, hue: h })}>
            <div class="th" style={`--h:${h + e.n * 8 + (s2 - 1) * 20}${bg(e.still, 'w300')}`}>
              {now && <span class="eqm"><I n="equalizer" /></span>}
              {w > 0.01 && <div class="pbar"><b style={`width:${Math.round(w * 100)}%`} /></div>}
            </div>
            <div class="tx">
              <b style={now ? 'color:var(--primary)' : ''}>{e.n}. {e.name}</b>
              <small>{e.runtime ? e.runtime + ' min' : ''}{w > 0.01 && ` · ${w >= 0.98 ? 'Watched' : Math.round(w * 100) + '% watched'}`}</small>
            </div>
            <span class={'dlb' + (epSaved.get()[k] ? ' on' : '')} onClick={(ev) => (ev.stopPropagation(), epSaved.set({ [k]: !epSaved.get()[k] }), toast(epSaved.get()[k] ? 'Added to My Library' : 'Removed from My Library'))}>
              <I n={epSaved.get()[k] ? 'bookmark-check' : 'bookmark-plus-outline'} />
            </span>
            <DlBtn t={t} s={s2} e={e.n} kind="series" />
          </div>
        );
      })}
    </>
  );
}

export function Info() {
  const t0 = param<Title>('t')!;
  const comic = param<string>('kind') === 'comic';
  const det = useAsync(() => loadDetails(t0), t0.mediaType + t0.id);
  const u = ui.get(), p = pl.get();
  const d = det.data, t = d?.title || t0, h = hueOf(t.title);
  const playing = p.active && p.title?.id === t.id && !p.pip && !comic;
  const saved = library.isSaved(t.id);
  const start = () => {
    if (comic) return nav('reader', { t, ch: 214 });
    if (p.active && p.title?.id === t.id) return pl.set({ pip: false });
    startAt(t, t.mediaType === 'tv' ? u.season : 1, 1, { seasons: d?.seasons.length ? d.seasons : undefined, hue: h });
    document.querySelector('.scr .scroll')?.scrollTo(0, 0);
  };
  const dlAll = d && allDone(t, u.season, comic ? 12 : 1);
  const hero = (
    <div class="ihero" style={`--h:${h}${bg(t.backdrop, 'w780')}`}>
      {!comic && d?.trailerKey && <Trailer k={d.trailerKey} />}
      <div class="topbar">
        <div class="ibtn glass" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
        <div style="flex:1" />
        <div class="ibtn glass" onClick={() => toast('More options')}><I n="dots-vertical" /></div>
      </div>
      <div class="bigplay" role="button" aria-label="Play" onClick={start}><I n={comic ? 'book-open-variant' : 'play'} /></div>
    </div>
  );
  const body = (
    <>
      <div class="pad" style={playing ? 'padding-top:14px' : 'margin-top:-34px;position:relative'}>
        <div class="title-l" style="font-size:30px;line-height:34px;font-weight:700">{t.title}</div>
        <div class="metaline">
          <span title="TMDB rating"><I n="star" /> {ratingOf(t)} <small style="font-size:10px;letter-spacing:.06em">TMDB</small></span>
          <span>{t.year}</span>
          <span class="q">{comic ? '18+' : d?.maturity || '–'}</span>
          <span>{comic ? 'Ongoing' : d?.runtime ? d.runtime + ' min' : '–'}</span>
          <span class="q">{comic ? 'HQ' : '1080p'}</span>
        </div>
        {d?.tagline && <div class="tagline">“{d.tagline}”</div>}
        <div class="acts2">
          <span class="btn" onClick={start}><I n={comic ? 'book-open-variant' : 'play'} /> {comic ? (library.lastPage(t.id, 214) ? 'Continue' : 'Read') : 'Play'}</span>
          <span class={'sq' + (saved ? ' on' : '')} onClick={() => toast(library.toggleSaved(t) ? 'Added to My Library' : 'Removed from My Library')}><I n={saved ? 'bookmark-check' : 'bookmark-plus-outline'} />My Library</span>
          <span class={'sq' + (dlAll ? ' on' : '')} onClick={() => (t.mediaType === 'movie' && !comic ? openDl(t, 1, 1, 'movie') : openDlAll(t, comic ? 'comic' : 'series', u.season))}><I n={dlAll ? 'check-circle' : 'download-outline'} />Download</span>
        </div>
        {d && <div style="display:flex;gap:6px;flex-wrap:wrap">{d.genres.slice(0, 4).map((g) => <span key={g} class="chip">{g}</span>)}</div>}
        <div class="title-m" style="margin-top:14px">Synopsis</div>
        <Synopsis text={d?.overview || t.overview} />
        {d && d.facts.length > 0 && (
          <>
            <div class="title-m" style="margin-top:10px">Details</div>
            <div class="dtl">{d.facts.map(([k, v]) => <Fragment key={k}><span>{k}</span><div>{v}</div></Fragment>)}</div>
          </>
        )}
      </div>
      {det.error != null && !d && <ErrorCard error={det.error} retry={det.retry} />}
      {d && d.cast.length > 0 && (
        <div class="row">
          <div class="row-h"><b>{comic ? 'Characters' : 'Cast'}</b><span onClick={() => toast('Full cast')}>See all</span></div>
          <div class="cast" style={`--h:${h}`}>
            {d.cast.map((c) => (
              <div key={c.id} style={`--h:${hueOf(c.name)}`} onClick={() => nav('person', { id: c.id, name: c.name })}>
                <u style={c.photo ? `background:url(${img(c.photo, 'w185')}) center/cover` : ''}>{c.photo ? '' : c.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</u>
                <b>{c.name}</b><small>{c.character}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      {d && (comic || t.mediaType === 'tv') && <Episodes t={t} d={d} comic={comic} />}
      {d && <Row title="For you" items={d.similar} kind={comic ? 'comic' : undefined} />}
      <div class="gap" />
    </>
  );
  return (
    <>
      {playing ? (
        <>
          <InlinePlayer />
          <div class="scroll">{body}</div>
        </>
      ) : (
        <div class="scroll">{hero}{body}</div>
      )}
      {u.dls ? <DlSheet /> : playing && <PlayerSheet land={false} />}
    </>
  );
}

function Synopsis({ text }: { text: string }) {
  const more = ui.get().more, long = text.length > 180;
  return (
    <div class="body-m">
      {more || !long ? text : text.slice(0, 180).replace(/\s+\S*$/, '') + '…'}{' '}
      {long && <span style="color:var(--primary);cursor:pointer" onClick={() => setUi({ more: !more })}>{more ? 'Show less' : 'Read more'}</span>}
    </div>
  );
}
