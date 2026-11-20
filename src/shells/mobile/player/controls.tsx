// Player controls, ported 1:1 from the prototype `vcore(land)` (prototype/android/index.html) and the
// layout table in docs/05-player.md: icon-only `.pi` pills, `.pl.t` top bar, `.pl.rm` lock / background
// play, `.pl.c` rew10 · play · fwd10, `.pl.bl` bottom-left row, `.pl.b` seek row.
import { I, SV } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { fmtTime, SPEEDS, cycleFit } from '../../../core/player-model';
import { back, setUi } from '../state';
import { next, nextServer, patch, pl, prev, ptime, retryPlay, seekBy, seekFrac, setSpeed, showCtl, stop, togglePlay, toPip } from './store';
import { gest } from './gestures';
import { VideoHost } from './video-host';
import { SubOverlay } from './subs-overlay';
import { GenPill } from './subs';

const act = (fn: () => void) => (e: MouseEvent) => (e.stopPropagation(), fn(), showCtl());
const sheet = (k: string) => () => setUi({ sheet: k, ...(k === 'episodes' ? { epsS: null } : {}), ...(k === 'subsearch' ? { sq: null } : {}) });

/** Prototype `pBtn(icon, action, on)`; `text` renders a text pill (speed). */
function Pi({ ic, on, fn, label, text }: { ic?: string; on?: boolean; fn: () => void; label: string; text?: string }) {
  return (
    <span class={'pi' + (on ? ' on' : '')} role="button" aria-label={label} onClick={act(fn)}>
      {text ?? <I n={ic!} />}
    </span>
  );
}

/** Prototype `seek`: time, track (fill + thumb), duration, fullscreen / fullscreen-exit. */
function Seek({ land, onFs }: { land: boolean; onFs: () => void }) {
  const t = useStore(ptime);
  const live = pl.get().live;
  const pct = live ? 100 : t.dur ? (t.pos / t.dur) * 100 : 0;
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    showCtl();
    if (live) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekFrac((e.clientX - r.left) / Math.max(1, r.width));
  };
  return (
    <div class="seek">
      <span class="ptime">{live ? '' : fmtTime(t.pos)}</span>
      <div class="trk ptrk" onClick={click}><b style={`width:${pct}%`} />{!live && <i style={`left:${pct}%`} />}</div>
      <span>{live ? '' : fmtTime(t.dur)}</span>
      <Pi ic={land ? 'fullscreen-exit' : 'fullscreen'} label={land ? 'Exit fullscreen' : 'Fullscreen'} fn={land ? back : onFs} />
    </div>
  );
}

function GestPill() {
  const g = useStore(gest);
  if (!g.show) return null;
  return <div class="lvl gp"><I n={g.icon} /><b>{g.text}</b>{g.sub && <small>{g.sub}</small>}</div>;
}
/** Shown instead of a black screen when nothing could be played. */
function PlayErr() {
  const s = useStore(pl);
  if (!s.err) return null;
  return (
    <div class="vg-err" onClick={(e) => e.stopPropagation()}>
      <I n="alert-circle-outline" />
      <span>{s.err}</span>
      <div>
        <b role="button" onClick={retryPlay}><I n="refresh" /> Retry</b>
        {s.servers.length > 1 && <b role="button" onClick={nextServer}><I n="server" /> Other server</b>}
      </div>
    </div>
  );
}

/**
 * Embed (iframe) servers: the page inside the iframe gets every tap, so this bar is the only way out.
 * It never hides (see `controlsHidden`): Back, Server switch, Fullscreen.
 */
function EmbedBar({ land, onFs }: { land: boolean; onFs: () => void }) {
  const s = pl.get();
  const name = s.servers[s.srv]?.name.replace(/\s*\(.*\)/, '') || 'Server';
  return (
    <div class="pl t embar">
      <span class="ibtn" role="button" aria-label="Back" onClick={act(land ? back : stop)}><I n="arrow-left" /></span>
      <div style="flex:1" />
      <div class="grp">
        {s.servers.length > 1 && (
          <span class="pi srvpi" role="button" aria-label="Switch server" onClick={act(nextServer)}><I n="server" /><small>{name} · {s.srv + 1}/{s.servers.length}</small></span>
        )}
        <Pi ic={land ? 'fullscreen-exit' : 'fullscreen'} label={land ? 'Exit fullscreen' : 'Fullscreen'} fn={land ? back : onFs} />
      </div>
    </div>
  );
}

export function Vcore({ land, onFs }: { land: boolean; onFs: () => void }) {
  const s = useStore(pl), p = s.st;
  const isSer = !s.live && p.mediaType === 'tv';

  if (s.embedUrl) {
    return (
      <>
        <VideoHost fit={p.fit} hue={s.hue} />
        <EmbedBar land={land} onFs={onFs} />
      </>
    );
  }

  const base = (
    <>
      <VideoHost fit={p.fit} hue={s.hue} />
      {p.bgPlay && <div class="bgmark"><I n="headphones" /></div>}
      <SubOverlay mode={land ? 'l' : 'p'} />
      <GenPill />
      <GestPill />
      <PlayErr />
    </>
  );
  // prototype lockI: right middle in portrait, left middle in landscape (moved inward from the camera cut-out)
  const lock = (
    <div class={'pl rm' + (land ? ' lk' : '')} style={land ? 'left:14px;right:auto' : undefined}>
      <Pi ic={p.locked ? 'lock' : 'lock-open-variant-outline'} on={p.locked} label="Lock" fn={() => (patch({ locked: !p.locked }), setUi({ sheet: false }))} />
    </div>
  );
  if (p.locked) return <>{base}{lock}</>;

  const bg = <Pi ic="headphones" on={p.bgPlay} label="Background play" fn={() => patch({ bgPlay: !p.bgPlay })} />;
  const qI = <Pi ic="high-definition" label="Quality" fn={sheet('quality')} />;
  const spd = <Pi text={p.speed + '×'} label="Speed" fn={() => setSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length])} />;
  const pipI = <Pi ic="picture-in-picture-bottom-right" label="Picture in picture" fn={toPip} />;
  const dots = <Pi ic="dots-vertical" label="More" fn={sheet('settings')} />;
  const subsI = <Pi ic={p.sub === 'Off' ? 'subtitles-outline' : 'subtitles'} on={p.sub !== 'Off'} label="Subtitles" fn={sheet('subs')} />;
  const epI = isSer && (
    <>
      <Pi ic="playlist-play" label="Episodes" fn={sheet('episodes')} />
      <Pi ic="skip-previous" label="Previous episode" fn={prev} />
      <Pi ic="skip-next" label="Next episode" fn={next} />
    </>
  );
  const center = (
    <div class="pl c">
      <span class="sk" role="button" aria-label="Back 10 seconds" onClick={act(() => seekBy(-10))}><SV n="rew10" /></span>
      <div class="big" role="button" aria-label={p.playing ? 'Pause' : 'Play'} onClick={act(togglePlay)}><I n={p.playing ? 'pause' : 'play'} /></div>
      <span class="sk" role="button" aria-label="Forward 10 seconds" onClick={act(() => seekBy(10))}><SV n="fwd10" /></span>
    </div>
  );

  if (!land)
    // portrait: background play top right, lock right middle, the rest bottom left
    return (
      <>
        {base}
        <div class="pl t">
          <span class="ibtn" role="button" aria-label="Back" onClick={act(stop)}><I n="arrow-left" /></span>
          <div style="flex:1" />
          <div class="grp">{bg}{qI}{spd}{pipI}{dots}</div>
        </div>
        {lock}
        {center}
        <div class="pl bl">{subsI}{epI}</div>
        <div class="pl b"><Seek land={false} onFs={onFs} /></div>
      </>
    );
  // landscape: lock left middle, background play right middle, quick buttons top right, the rest bottom left
  return (
    <>
      {base}
      <div class="pl t">
        <span class="ibtn" role="button" aria-label="Back" onClick={act(back)}><I n="arrow-left" /></span>
        <div style="flex:1" />
        <div class="grp">{qI}{spd}{pipI}{dots}</div>
      </div>
      {lock}
      <div class="pl rm bgp" style="left:auto;right:14px">{bg}</div>
      {center}
      <div class="pl bl">
        {subsI}
        <Pi ic="waveform" label="Audio" fn={sheet('audio')} />
        <Pi ic="aspect-ratio" label={'Resize: ' + p.fit} on={p.fit !== 'Fit'} fn={() => patch({ fit: cycleFit(p).fit })} />
        <Pi ic="server" label="Server" fn={sheet('server')} />
        {epI}
      </div>
      <div class="pl b"><Seek land onFs={onFs} /></div>
    </>
  );
}
