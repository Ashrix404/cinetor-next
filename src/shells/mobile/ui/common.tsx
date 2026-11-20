// Shared building blocks, ported from the prototype helpers (poster, row, srow, sw, sect, backTop, sub, slider, opts).
import type { ComponentChildren } from 'preact';
import { img, type Title } from '../../../core/tmdb';
import { hashS } from '../../../core/sports';
import { I, SV } from './icons';
import { back, nav, on, setOpt, setUi, toggle } from '../state';

export const hueOf = (t: string) => hashS(t) % 360;
export const bg = (path: string | null, size: Parameters<typeof img>[1]) => (path ? `;background:url(${img(path, size)}) center/cover` : '');
export const ratingOf = (t: Title) => (t.rating ? t.rating.toFixed(1) : '–');

export function Poster({ t, pr, kind, tag, style }: { t: Title; pr?: number; kind?: string; tag?: boolean; style?: string }) {
  return (
    <div class="poster" onClick={() => nav('info', { t, kind })} style={`--h:${hueOf(t.title)}${bg(t.poster, 'w342')}${style ? ';' + style : ''}`}>
      {tag && <b class="tag18">18+</b>}
      <b class="rt" title="TMDB rating"><I n="star" />{ratingOf(t)}</b>
      <span>{t.title}</span>
      {pr != null && <div class="pbar"><b style={`width:${pr}%`} /></div>}
    </div>
  );
}

export function Rail({ items, kind, tag }: { items: Title[]; kind?: string; tag?: boolean }) {
  return <div class="rail">{items.map((t) => <Poster key={t.id} t={t} kind={kind} tag={tag} />)}</div>;
}

export function Row({ title, items, kind, tag }: { title: string; items: Title[]; kind?: string; tag?: boolean }) {
  if (!items.length) return null;
  return (
    <div class="row">
      <div class="row-h"><b>{title}</b><span onClick={() => nav('list', { title, items, kind })}>View all</span></div>
      <Rail items={items} kind={kind} tag={tag} />
    </div>
  );
}

export function Opts({ k, list, cur, cls = '' }: { k: string; list: string[]; cur: string; cls?: string }) {
  return <div class={'opts ' + cls}>{list.map((o) => <span key={o} class={o === cur ? 'on' : ''} onClick={() => setOpt(k, o)}>{o}</span>)}</div>;
}

export const MenuBtn = () => <div class="ibtn glass" role="button" aria-label="Open menu" onClick={() => setUi({ drawer: true })}><SV n="menu" /></div>;

/** Sticky top banner (prototype `carTop`, CSS `.bbar`). */
export function CarTop() {
  return (
    <div class="bbar">
      <MenuBtn />
      <div class="bmark"><SV n="mark" /><b>CINE<span>TOR</span></b></div>
      <div class="ibtn glass" role="button" aria-label="Search" onClick={() => nav('search')}><SV n="search" /></div>
    </div>
  );
}

export function MenuTop({ t, noSearch }: { t: string; noSearch?: boolean }) {
  return (
    <div class="menu-top">
      <MenuBtn />
      <h3>{t}</h3>
      {!noSearch && <div class="ibtn" role="button" aria-label="Search" onClick={() => nav('search')}><SV n="search" /></div>}
    </div>
  );
}

export function BackTop({ t, extra }: { t: string; extra?: ComponentChildren }) {
  return (
    <div class="topbar">
      <div class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
      <h3>{t}</h3>
      {extra}
    </div>
  );
}

export function Sw({ k, ctl }: { k: string; ctl?: boolean }) {
  const v = !!on.get()[k];
  return <div class={'sw' + (v ? ' on' : '')} role="switch" aria-checked={v} style={ctl ? 'pointer-events:none' : ''} />;
}

interface SRowP { ic?: string; t: string; d?: string | null; tail?: ComponentChildren | null; onClick?: () => void; style?: string }
export function SRow({ ic, t, d, tail, onClick, style }: SRowP) {
  return (
    <div class="srow" onClick={onClick} style={style}>
      {ic && <div class="ico"><I n={ic} /></div>}
      <div class="tx"><b>{t}</b>{d && <small>{d}</small>}</div>
      {tail === undefined ? <span class="go"><I n="chevron-right" /></span> : tail}
    </div>
  );
}
export const SwRow = ({ k, t, d, ic }: { k: string; t: string; d?: string; ic?: string }) => <SRow ic={ic} t={t} d={d} tail={<Sw k={k} />} onClick={() => toggle(k)} />;

export function Sect({ t, children }: { t: string; children: ComponentChildren }) {
  return (
    <>
      <div class="sec">{t}</div>
      <div class="card" style="margin-top:8px">{children}</div>
      <div class="gap" />
    </>
  );
}

export function Slider({ t, v, pct, d }: { t: string; v: string; pct: number; d?: string }) {
  return (
    <div class="sld">
      <div class="h">{t}<span>{v}</span></div>
      {d && <div class="body-s" style="margin-top:2px">{d}</div>}
      <div class="t"><b style={`width:${pct}%`} /><i style={`left:${pct}%`} /></div>
    </div>
  );
}

/** Settings sub page (prototype `sub(t, s, body)`). */
export function SubPage({ t, s, children }: { t: string; s: string; children: ComponentChildren }) {
  return (
    <>
      <BackTop t="" />
      <div class="pghead"><h3>{t}</h3><p>{s}</p></div>
      <div class="scroll">{children}</div>
    </>
  );
}

export function Empty({ ic, t, d, h = 360 }: { ic?: string; t?: string; d?: string; h?: number }) {
  return (
    <div class="empty" style={`min-height:${h}px`}>
      {ic && <I n={ic} />}
      {t && <div class="title-m">{t}</div>}
      {d && <div class="body-m">{d}</div>}
    </div>
  );
}

/** Friendly error card with Retry (review focus #1: never a blank screen). */
export function ErrorCard({ error, retry }: { error: unknown; retry: () => void }) {
  const auth = error instanceof Error && error.name === 'TmdbAuthError';
  return (
    <div class="card" style="margin:16px;padding:18px;text-align:center">
      <div class="title-m">{auth ? 'Catalog unavailable' : "Can't reach the catalog right now"}</div>
      <div class="body-m" style="margin:4px 0 12px">{auth ? 'The catalog key was rejected. Please update the app.' : 'Check your connection and try again.'}</div>
      <span class="btn tonal" style="height:38px" onClick={retry}><I n="history" /> Retry</span>
    </div>
  );
}

export function Loading({ h = 300 }: { h?: number }) {
  return <div class="empty" style={`min-height:${h}px`}><div class="body-m">Loading…</div></div>;
}
