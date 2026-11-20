// TV tab (prototype V.tv, V.live, V.sports, V.watch, mcard, crest). App theme colors only.
import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { GEN } from '../../../core/catalog';
import { channelsIn, LIVE_ALL, type Channel } from '../../../core/live';
import { crestOf, fmtHMS, hashS, HILITES, matchesFor, SPICON, SPORT, SPORTS, SP_TABS, spCounts, type Match, type SpTab } from '../../../core/sports';
import { I } from '../ui/icons';
import { Empty, MenuTop, Opts } from '../ui/common';
import { back, nav, opt, param, setOpt, setUi, toast, ui } from '../state';
import { startLive } from '../player/store';
import { usePullRefresh } from '../ui/pull';

const T0 = Date.now();
function useTick() {
  const [, s] = useState(0);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && s((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}
const Tmr = ({ s }: { s: number }) => <span class="tmr">{fmtHMS(s + (Date.now() - T0) / 1000)}</span>;

export function Crest({ n, big }: { n: string; big?: boolean }) {
  const c = crestOf(n);
  if ('flag' in c) return <span class={'crest2' + (big ? ' big' : '')} style={`background:${c.flag}`} />;
  return <span class={'crest2 tc' + (c.variant === 1 ? ' dk' : '') + (c.variant === 2 ? ' f1' : '') + (big ? ' big' : '')} style={`--h:${c.hue}`}>{c.short}</span>;
}

const playChannel = (c: Channel) => (startLive(c[1], c[2]), nav('player', { live: true }));
const fav = (id: number) => {
  const f = { ...ui.get().fav, [id]: !ui.get().fav[id] };
  setUi({ fav: f });
  toast(f[id] ? 'Added to favorites' : 'Removed from favorites');
};

export function MatchCard({ m, hl }: { m: Match; hl?: boolean }) {
  return (
    <div class="mc" onClick={() => nav('watch', { id: m.id })}>
      <div class="mh">
        <span class="lgi" style={`--h:${hashS(m.league) % 360}`}><I n={SPICON[m.sport] || 'trophy'} /></span>
        <span class="mt">{m.sport} II {m.league}</span>
        <span class="mr">
          {hl ? <span class="mtm"><small>{m.date}</small></span> : m.st === 'live' ? <><Tmr s={m.el || 0} /><b class="livep"><i />LIVE</b></> : <span class="mtm"><b>{m.time}</b><small>{m.date}</small></span>}
        </span>
      </div>
      <div class="mb"><Crest n={m.a} /><span class="tn">{m.a}</span><b class="vs">VS</b><span class="tn">{m.b}</span><Crest n={m.b} /></div>
    </div>
  );
}

function Live() {
  const sel = opt('tvcat') || 'All', lv = channelsIn(sel);
  const tile = (c: Channel) => (
    <div key={c[0] + c[3]} style={`--h:${c[2]}`} onClick={() => playChannel(c)}><em>{c[3]}</em><u>{c[0]}</u><b>{c[1]}</b><small>Now: Evening Bulletin</small></div>
  );
  return (
    <div class="tvx">
      <Opts k="tvcat" list={['All', ...GEN.tv]} cur={sel} cls="cat" />
      {sel === 'All'
        ? GEN.tv.map((cat) => {
            const g = LIVE_ALL.filter((c) => c[4] === cat);
            return g.length ? <Fragment key={cat}><h4>{cat} <span>{g.length} live</span></h4><div class="ch chr">{g.map(tile)}</div></Fragment> : null;
          })
        : <><h4>{sel} <span>{lv.length} live</span></h4>{lv.length ? <div class="ch">{lv.map(tile)}</div> : <Empty h={140} d="No channels here yet" />}</>}
      <h4>On air now</h4>
      {([['12', 'News 24', 'Evening Bulletin', '18:00 – 19:00', 55, 210], ['14', 'Cinema One', 'Harbor Lights (1987)', '17:30 – 19:45', 30, 350], ['33', 'Nature HD', 'Tidal Worlds', '18:15 – 19:00', 20, 160]] as const).map(([n, c, p2, t2, pr, h]) => (
        <div class="epg" key={n} onClick={() => (startLive(c, h), nav('player', { live: true }))}>
          <div class="n">{n}</div><div class="w"><b>{c} · {p2}</b><small>{t2}</small><div class="pg"><i style={`width:${pr}%`} /></div></div><I n="play-circle-outline" />
        </div>
      ))}
    </div>
  );
}

function Sports() {
  useTick();
  const ptr = usePullRefresh(() => undefined);
  const sp = opt('sp') || 'All', st = (opt('st') || 'Recent') as SpTab, c = spCounts(sp), fo = !!opt('favOnly'), f = ui.get().fav;
  let list = matchesFor(sp, st);
  if (st === 'All') list = list.slice().sort((x, y) => (x.st === 'live' ? 0 : 1) - (y.st === 'live' ? 0 : 1));
  if (fo) list = list.filter((m) => f[m.id]);
  const mq = 'Live scores, schedules and highlights · Tap a match to open it · Switch to Live TV for more channels · ';
  return (
    <div class="szf" style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div class="scroll" {...ptr.bind}>
        {ptr.indicator}
        <div class="mqrow">
          <div class="mq"><span class="mqi">{mq + mq}</span></div>
          <span class={'favb' + (fo ? ' on' : '')} role="button" aria-label="Favorites" onClick={() => setOpt('favOnly', fo ? '' : '1')}><I n={fo ? 'star' : 'star-outline'} /></span>
        </div>
        <div class="spr">
          {SPORTS.map((x) => {
            const n = spCounts(x).All;
            return <div key={x} class={'spc' + (x === sp ? ' on' : '')} onClick={() => setOpt('sp', x)}><span class="ring"><I n={x === 'All' ? 'view-grid-outline' : SPICON[x]} />{n > 0 && <b class="bdg">{n}</b>}</span><small>{x}</small></div>;
          })}
        </div>
        <div class="sts">{SP_TABS.map((t) => <span key={t} class={t === st ? 'on' : ''} onClick={() => setOpt('st', t)}>{t === st && <I n="check" />}{t} ({c[t]})</span>)}</div>
        {list.length ? <div class="mlist">{list.map((m) => <MatchCard key={m.id} m={m} hl={st === 'Highlights'} />)}</div> : <div class="noev">No Events Found</div>}
        <div class="gap" />
      </div>
    </div>
  );
}

export function TvTab() {
  const o = opt('tv') || 'Live TV';
  const ptr = usePullRefresh(() => undefined);
  return (
    <>
      <MenuTop t="TV" />
      <div class="seg2">{['Live TV', 'Sports'].map((x) => <span key={x} class={x === o ? 'on' : ''} onClick={() => setOpt('tv', x)}><I n={x === 'Live TV' ? 'television-classic' : 'soccer'} /> {x}</span>)}</div>
      {o === 'Sports' ? <Sports /> : <div class="scroll" style="margin-top:4px" {...ptr.bind}>{ptr.indicator}<Live /></div>}
    </>
  );
}
TvTab.tab = 'tv';

export function Watch() {
  useTick();
  const id = param<number>('id') || 1, m = SPORT.concat(HILITES).find((x) => x.id === id) || SPORT[0];
  const t3 = ui.get().tab3, isFav = !!ui.get().fav[m.id], live = m.st === 'live';
  const others = SPORT.filter((x) => x.st === 'live' && x.id !== m.id).slice(0, 3);
  return (
    <div class="szf" style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div class="topbar">
        <div class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
        <h3 style="font-size:17px;font-weight:600;font-family:Rajdhani,Roboto,sans-serif">{m.sport} II {m.league}</h3>
        <div class="ibtn" role="button" aria-label="Favorite" style={isFav ? 'color:var(--primary)' : ''} onClick={() => fav(m.id)}><I n={isFav ? 'star' : 'star-outline'} /></div>
      </div>
      <div class="scroll">
        <div class="wv" style={`--h:${hashS(m.league) % 360}`}>
          {live ? <><span class="livep" style="position:absolute;top:10px;left:10px"><i />LIVE</span><div class="wvp" onClick={() => (startLive(m.a + ' · ' + m.b, hashS(m.league) % 360), nav('player', { live: true }))}><I n="play" /></div></>
            : m.st === 'up' ? <div class="wvs"><I n="clock-outline" /><b>{m.time}</b><small>{m.date}</small></div>
            : <div class="wvp" onClick={() => (startLive(m.a + ' · ' + m.b, hashS(m.league) % 360), nav('player', { live: true }))}><I n="play" /></div>}
        </div>
        <div class="wcard">
          <div class="mb" style="padding:6px 0 2px"><Crest n={m.a} big /><span class="tn">{m.a}</span><b class="vs">VS</b><span class="tn">{m.b}</span><Crest n={m.b} big /></div>
          {live ? <div class="wtm"><Tmr s={m.el || 0} /></div> : m.st === 'up' ? <div class="wtm"><span class="btn" style="height:36px" onClick={() => toast('Reminder set')}><I n="bell-outline" /> Remind me</span></div> : null}
        </div>
        <div class="tabs3" style="margin-top:12px">{['Info', 'Stats', 'Lineups'].map((x) => <span key={x} class={x === t3 ? 'on' : ''} onClick={() => setUi({ tab3: x })}>{x}</span>)}</div>
        {t3 === 'Stats'
          ? ([['Possession', 58], ['Shots', 64], ['On target', 45], ['Corners', 52]] as const).map(([n, v]) => <div class="stat" key={n}><span style="width:76px;color:var(--on-var)">{n}</span><div class="b"><i style={`width:${v}%`} /></div><span>{v}%</span></div>)
          : t3 === 'Lineups'
            ? ['Starting XI', 'Bench'].map((n) => <div class="up" key={n}><div class="v">{n}<small>{m.a} · {m.b}</small></div></div>)
            : <><div class="up"><div class="v">{m.league}<small>{m.sport}</small></div></div><div class="up"><div class="v">{live ? 'On air now' : m.st === 'up' ? 'Starts' : 'Played'}<small>{m.time ? m.time + ' · ' : ''}{m.date || '20/11/2026'}</small></div></div></>}
        {others.length > 0 && <><h4 style="margin:18px 16px 8px;font-size:16px;font-weight:600">More live now</h4><div class="mlist">{others.map((x) => <MatchCard key={x.id} m={x} />)}</div></>}
        <div class="gap" />
      </div>
    </div>
  );
}
