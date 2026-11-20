// Section feeds: Home, Anime, Drama, Comics, Adult (prototype V.home/V.anime/V.drama/V.comics/V.adult, catView, CONTf).
import { byGenre, COMIC_OPTIONS, DRAMA_OPTIONS, genresOf, GEN, loadSection, type Feed, type Section } from '../../../core/catalog';
import { hashS } from '../../../core/sports';
import type { Title } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { bg, CarTop, Empty, ErrorCard, hueOf, Loading, Opts, Poster, ratingOf, Row } from '../ui/common';
import { useAsync } from '../ui/hooks';
import { HeroCarousel, type Card } from './carousel';
import { library, nav, on, opt, toast, ui } from '../state';

const feeds = new Map<string, Feed>();
export function useFeed(section: Section, option?: string) {
  const key = section + '|' + (option || '');
  const cw = library.continueWatching()[0]?.title.title;
  return useAsync(async () => {
    const f = await loadSection(section, option, { because: cw });
    feeds.set(key, f);
    return f;
  }, key);
}

const uniq3 = (g: string[], sd: number) => {
  const a: string[] = [];
  [sd % g.length, (sd * 7 + 3) % g.length, (sd * 13 + 5) % g.length, (sd * 5 + 1) % g.length, (sd * 11 + 2) % g.length].forEach((x) => {
    if (!a.includes(g[x]) && a.length < 3) a.push(g[x]);
  });
  return a;
};

/** Prototype `movieCard`. */
export function movieCard(t: Title, gen: string, kind?: string): Card {
  const comic = kind === 'comic';
  const g = genresOf(t);
  const chips = g.length ? g.slice(0, 3) : uniq3(GEN[gen] || GEN.home, hashS(t.title));
  const saved = library.isSaved(t.id);
  return {
    key: t.id,
    hue: hueOf(t.title),
    artStyle: bg(t.poster, 'w500'),
    art: <b class="htitle">{t.title}</b>,
    open: () => nav('info', { t, kind }),
    meta: (
      <>
        <div class="hrat"><I n="star" /> {ratingOf(t)}<small>TMDB</small><span>{t.year}</span></div>
        <div class="hchips">{chips.map((x) => <span key={x}>{x}</span>)}</div>
        <div class="hbtns">
          <span class="hplay" onClick={(e) => (e.stopPropagation(), nav('info', { t, kind }))}><I n={comic ? 'book-open-variant' : 'play'} /> {comic ? 'Read' : 'Play'}</span>
          <span class="hmy" onClick={(e) => (e.stopPropagation(), toast(library.toggleSaved(t) ? 'Added to My Library' : 'Removed from My Library'))}><I n={saved ? 'check' : 'plus'} /> My</span>
        </div>
      </>
    ),
  };
}

/** Prototype `catView`: genre chips; a selected genre shows a grid instead of rows. */
function CatView({ section, feed, kind, tag }: { section: string; feed: Feed; kind?: string; tag?: boolean }) {
  const cur = opt('cat_' + section) || 'All';
  const chips = <Opts k={'cat_' + section} list={['All', ...feed.genres]} cur={cur} cls="cat" />;
  if (cur === 'All') return { chips, body: null };
  const m = byGenre(feed, cur);
  return {
    chips,
    body: (
      <>
        <div class="row-h" style="padding-top:16px"><b>{cur}</b><span>{m.length} titles</span></div>
        <div class="pgrid">{m.map((t) => <Poster key={t.id} t={t} kind={kind} tag={tag} />)}</div>
      </>
    ),
  };
}

function ContinueRow() {
  const cw = library.continueWatching();
  if (!cw.length || !on.get().cw) return null;
  return (
    <div class="row" style="margin-top:6px">
      <div class="row-h"><b>Continue watching</b><span style="cursor:pointer" onClick={() => (library.clearContinue(), toast('Continue watching cleared'))}>Clear all</span></div>
      <div class="rail">
        {cw.map((c) => (
          <div class="cwc" key={c.title.id}>
            <Poster t={c.title} pr={Math.round(c.progress * 100)} />
            <span class="cwx" role="button" aria-label="Remove" onClick={() => library.removeContinue(c.title.id)}><I n="close" /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeedPageP { section: Section; option?: string; options?: readonly string[]; optKey?: string; kind?: string; tag?: boolean; banner?: boolean }
function FeedPage({ section, option, options, optKey, kind, tag, banner }: FeedPageP) {
  const { data, error, loading, retry } = useFeed(section, option);
  const feed = data;
  const cv = feed ? CatView({ section, feed, kind, tag }) : null;
  return (
    <div class="scroll">
      <CarTop />
      {options && optKey && <Opts k={optKey} list={[...options]} cur={option || options[0]} />}
      {feed && <HeroCarousel id={section + '-' + (option || '')} cards={feed.hero.map((t) => movieCard(t, section, kind))} />}
      {!feed && loading && <Loading />}
      {error != null && <ErrorCard error={error} retry={retry} />}
      {feed && cv && (
        <>
          {cv.chips}
          {banner && (
            <div class="banner"><I n="shield-lock-outline" /><div><b style="color:var(--on)">Adults only</b><br />Age confirmed on this device.</div></div>
          )}
          {cv.body || (
            <>
              {section === 'home' && <ContinueRow />}
              {feed.rows.map((r) => <Row key={r.id} title={r.title} items={r.items} kind={kind} tag={tag} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

export const Home = () => <FeedPage section="home" />;
export const Anime = () => <FeedPage section="anime" />;
export const Drama = () => <FeedPage section="drama" option={opt('drama')} options={DRAMA_OPTIONS} optKey="drama" />;
export const Comics = () => <FeedPage section="comics" option={opt('comics')} options={COMIC_OPTIONS} optKey="comics" kind="comic" />;
export function Adult() {
  if (!ui.get().adultOk) return <Empty ic="lock-outline" t="Adult section is locked" d="Enter your PIN to continue" />;
  return <FeedPage section="adult" tag banner />;
}
