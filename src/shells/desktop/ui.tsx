// Desktop building blocks (prototype Poster, Row, Chips, Hero).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { img, type Title } from '../../core/tmdb';
import { isAdultTitle, isAdultUnlocked } from '../../core/adult';
import { hashS } from '../../core/sports';
import { MDI } from '../../assets/mdi';
import { SVP, MARK } from '../../assets/svp';
import { go, library, open, toggleLib, ui } from './state';
import { play } from './player';

export const Ic = ({ n }: { n: string }) => <i class="mi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={MDI[n] || ''} /></svg></i>;
export const Sv = ({ n }: { n: 'rew10' | 'fwd10' }) => <svg class="svi" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: SVP[n] }} />;
export const Mark = () => <svg viewBox="0 0 24 24" fill="none" dangerouslySetInnerHTML={{ __html: MARK }} />;
export const rate = (t: Title) => (t.rating ? t.rating.toFixed(1) : '–');
export const hue = (s: string) => hashS(s) % 360;

export function Poster({ it, bar, rm, comic }: { it: Title; bar?: number; rm?: () => void; comic?: boolean }) {
  if (!isAdultUnlocked() && isAdultTitle(it)) return null; // last line of adult isolation
  return (
    <button class="pt" style={{ '--h': hue(it.title), backgroundImage: it.poster ? `url(${img(it.poster, 'w342')})` : undefined }} onClick={() => open(it, comic)} title={it.title}>
      <span class="r"><Ic n="star" /> {rate(it)}</span>
      {rm && <span class="x" onClick={(e) => (e.stopPropagation(), rm())}><Ic n="close" /></span>}
      <span class="t">{it.poster ? '' : it.title}</span>
      {bar != null && <span class="bar"><b style={{ width: bar + '%' }} /></span>}
    </button>
  );
}

export function Row({ title, items, comic, children }: { title: string; items: Title[]; comic?: boolean; children?: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items.length && !children) return null;
  return (
    <section class="row" style="content-visibility:auto;contain-intrinsic-size:auto 300px">
      <h2>{title}<button onClick={() => go('list', { title, items, comic })}>See all <Ic n="chevron-right" /></button></h2>
      <button class="arr l" aria-label="Scroll left" onClick={() => ref.current?.scrollBy({ left: -ref.current.clientWidth * 0.8 })}><Ic n="chevron-left" /></button>
      <div class="rail" ref={ref} onWheel={(e) => e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && (e.preventDefault(), ref.current?.scrollBy({ left: e.deltaY }))}>
        {children || items.map((it) => <Poster key={it.id} it={it} comic={comic} />)}
      </div>
      <button class="arr r" aria-label="Scroll right" onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8 })}><Ic n="chevron-right" /></button>
    </section>
  );
}

export function Chips({ list, cur, set }: { list: string[]; cur: string; set: (x: string) => void }) {
  return <div class="chips">{list.map((x) => <button key={x} class={'chip' + (x === cur ? ' on' : '')} onClick={() => set(x)}>{x}</button>)}</div>;
}

export function Hero({ items, comic }: { items: Title[]; comic?: boolean }) {
  const [i, setI] = useState(0);
  const n = Math.min(items.length, 7);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && setI((x) => (x + 1) % Math.max(1, n)), 4500);
    return () => clearInterval(t);
  }, [n]);
  const c = items[i] || items[0];
  if (!c) return null;
  const saved = library.isSaved(c.id);
  void ui;
  return (
    <div class="hero">
      {items.slice(0, n).map((it, k) => (
        <div key={it.id} class={'hbg' + (k === i ? ' on' : '')} style={{ backgroundImage: it.backdrop ? `url(${img(it.backdrop, 'w1280')})` : it.poster ? `url(${img(it.poster, 'w780')})` : `linear-gradient(160deg,hsl(${hue(it.title)} 55% 32%),#050505)` }} />
      ))}
      <div class="hc" key={c.id}>
        <h1>{c.title}</h1>
        <div class="meta"><b><Ic n="star" /> {rate(c)} TMDB</b><span>{c.year}</span><span>{comic ? 'Comic' : c.mediaType === 'tv' ? 'Series' : 'Movie'}</span><span>{comic ? 'Ongoing' : '1080p'}</span></div>
        <p class="ov">{c.overview}</p>
        <div class="btns">
          <button class="btn p" onClick={() => (comic ? ui.set({ reader: { t: c, ch: 214 } }) : play(c))}><Ic n={comic ? 'book-open-variant' : 'play'} /> {comic ? 'Read' : 'Play'}</button>
          <button class="btn" onClick={() => open(c, comic)}><Ic n="information-outline" /> Details</button>
          <button class="btn" onClick={() => toggleLib(c)}><Ic n={saved ? 'check' : 'plus'} /> My List</button>
        </div>
      </div>
      <div class="dots">{items.slice(0, n).map((_, k) => <i key={k} class={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div>
    </div>
  );
}

export function ErrorCard({ error, retry }: { error: unknown; retry: () => void }) {
  const auth = error instanceof Error && error.name === 'TmdbAuthError';
  return (
    <div class="g err">
      <b>{auth ? 'Catalog unavailable' : "Can't reach the catalog right now"}</b>
      <p class="sub">{auth ? 'The catalog key was rejected.' : 'Check your connection and try again.'}</p>
      <button class="btn" onClick={retry}><Ic n="refresh" /> Retry</button>
    </div>
  );
}
