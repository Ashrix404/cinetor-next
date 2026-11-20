// Player controls in the vega-app style (user request 2026-11-20): bare centre play/pause (70 px) and
// 10 s seek arcs (54 px), a back arrow + title top-left, 40 px icon pills top-right, a bottom bar of
// 24 px icons (+ 12 px labels in landscape) at 60 % white, a thin 2 px seek bar with an 8 px thumb.
import { I, SV } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { fmtTime, SPEEDS, cycleFit } from '../../../core/player-model';
import { back, setUi } from '../state';
import { next, patch, pl, ptime, seekBy, seekFrac, setSpeed, showCtl, stop, togglePlay, toPip } from './store';
import { VideoHost } from './video-host';
import { SubOverlay } from './subs-overlay';
import { GenPill } from './subs';

const act = (fn: () => void) => (e: MouseEvent) => (e.stopPropagation(), fn(), showCtl());
const sheet = (k: string) => () => setUi({ sheet: k, ...(k === 'episodes' ? { epsS: null } : {}), ...(k === 'subsearch' ? { sq: null } : {}) });

function Pill({ ic, on, fn, label, text }: { ic?: string; on?: boolean; fn: () => void; label: string; text?: string }) {
  return (
    <span class={'vg-pill' + (on ? ' on' : '')} role="button" aria-label={label} onClick={act(fn)}>
      {text ? <b class="vg-badge">{text}</b> : <I n={ic!} />}
    </span>
  );
}
function BarBtn({ ic, label, fn, on, land, text }: { ic: string; label: string; fn: () => void; on?: boolean; land: boolean; text?: string }) {
  return (
    <span class={'vg-btn' + (on ? ' on' : '')} role="button" aria-label={label} onClick={act(fn)}>
      {text ? <b class="vg-txt">{text}</b> : <I n={ic} />}
      {land && <small>{label}</small>}
    </span>
  );
}

function Seek({ land, onFs }: { land: boolean; onFs: () => void }) {
  const t = useStore(ptime);
  const live = pl.get().live;
  const pct = live ? 100 : t.dur ? (t.pos / t.dur) * 100 : 0;
  const click = (e: MouseEvent) => {
    e.stopPropagation();
    showCtl();
    if (live) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekFrac((e.clientX - r.left) / r.width);
  };
  return (
    <div class="vg-seek">
      <span class="vg-time">{live ? 'LIVE' : fmtTime(t.pos)}</span>
      <div class="vg-trk ptrk" onClick={click}><i><b style={`width:${pct}%`} /></i>{!live && <em style={`left:${pct}%`} />}</div>
      <span class="vg-time">{live ? '' : fmtTime(t.dur)}</span>
      <span class="vg-fs" role="button" aria-label={land ? 'Exit fullscreen' : 'Fullscreen'} onClick={act(land ? back : onFs)}><I n={land ? 'fullscreen-exit' : 'fullscreen'} /></span>
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
        <div class="pl vg-top" style="pointer-events:auto;z-index:10;background:linear-gradient(rgba(0,0,0,0.8),transparent);">
          <span class="vg-back" role="button" aria-label="Back" onClick={act(land ? back : stop)}><I n="arrow-left" /></span>
          <div class="vg-title"><b>{s.live ? s.label : p.title}</b>{isSer && <small>S{p.season} · E{p.episode}</small>}</div>
          <span class="vg-fs" role="button" aria-label={land ? 'Exit fullscreen' : 'Fullscreen'} onClick={act(land ? back : onFs)}>
            <I n={land ? 'fullscreen-exit' : 'fullscreen'} />
          </span>
        </div>
      </>
    );
  }

  const lock = <Pill ic={p.locked ? 'lock' : 'lock-open-variant-outline'} on={p.locked} label="Lock" fn={() => (patch({ locked: !p.locked }), setUi({ sheet: false }))} />;
  const base = (
    <>
      <VideoHost fit={p.fit} hue={s.hue} />
      <div class="vg-shade" />
      {p.bgPlay && <div class="bgmark"><I n="headphones" /></div>}
      <SubOverlay mode={land ? 'l' : 'p'} />
      <GenPill />
    </>
  );
  if (p.locked) return <>{base}<div class="pl vg-top vg-lockonly">{lock}</div></>;
  const bar = [
    <BarBtn key="sub" ic={p.sub === 'Off' ? 'subtitles-outline' : 'subtitles'} on={p.sub !== 'Off'} label="Subtitle" fn={sheet('subs')} land={land} />,
    <BarBtn key="aud" ic="waveform" label="Audio" fn={sheet('audio')} land={land} />,
    <BarBtn key="spd" ic="speedometer" text={p.speed + '×'} label="Speed" fn={() => setSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length])} land={land} />,
    <BarBtn key="pip" ic="picture-in-picture-bottom-right" label="PiP" fn={toPip} land={land} />,
    ...(land ? [
      <BarBtn key="srv" ic="server" label="Server" fn={sheet('server')} land={land} />,
      <BarBtn key="fit" ic="aspect-ratio" label={p.fit} on={p.fit !== 'Fit'} fn={() => patch({ fit: cycleFit(p).fit })} land={land} />,
    ] : []),
    ...(isSer ? [
      <BarBtn key="eps" ic="playlist-play" label="Episodes" fn={sheet('episodes')} land={land} />,
      <BarBtn key="nxt" ic="skip-next" label="Next" fn={next} land={land} />,
    ] : []),
    <BarBtn key="more" ic="dots-vertical" label="More" fn={sheet('settings')} land={land} />,
  ];
  return (
    <>
      {base}
      <div class="pl vg-top">
        <span class="vg-back" role="button" aria-label="Back" onClick={act(land ? back : stop)}><I n="arrow-left" /></span>
        <div class="vg-title"><b>{s.live ? s.label : p.title}</b>{isSer && <small>S{p.season} · E{p.episode}</small>}</div>
        <div class="vg-pills">
          {lock}
          <Pill ic="headphones" on={p.bgPlay} label="Background play" fn={() => patch({ bgPlay: !p.bgPlay })} />
          <Pill text={p.quality >= 2160 ? '4K' : p.quality >= 1080 ? 'HD' : p.quality + ''} label="Quality" fn={sheet('quality')} />
        </div>
      </div>
      <div class="pl vg-mid">
        <span class="vg-seekbtn" role="button" aria-label="Back 10 seconds" onClick={act(() => seekBy(-10))}><SV n="rew10" /></span>
        <span class="vg-play" role="button" aria-label={p.playing ? 'Pause' : 'Play'} onClick={act(togglePlay)}><I n={p.playing ? 'pause' : 'play'} /></span>
        <span class="vg-seekbtn" role="button" aria-label="Forward 10 seconds" onClick={act(() => seekBy(10))}><SV n="fwd10" /></span>
      </div>
      <div class="pl vg-bottom">
        <Seek land={land} onFs={onFs} />
        <div class="vg-bar">{bar}</div>
      </div>
    </>
  );
}
