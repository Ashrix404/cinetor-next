// Player controls (prototype `vcore(land)` + docs/05-player.md control layout).
import { I, SV } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { fmtTime, SPEEDS, cycleFit } from '../../../core/player-model';
import { back, setUi, ui } from '../state';
import { next, patch, pl, prev, ptime, seekBy, seekFrac, setSpeed, stop, togglePlay, toPip } from './store';
import { VideoHost } from './video-host';
import { SubOverlay } from './subs-overlay';
import { GenPill } from './subs';

const PBtn = ({ ic, on, act, label }: { ic: string; on?: boolean; act: () => void; label?: string }) => (
  <span class={'pi' + (on ? ' on' : '')} role="button" aria-label={label || ic} onClick={(e) => (e.stopPropagation(), act())}><I n={ic} /></span>
);
const sheet = (k: string) => () => setUi({ sheet: k, ...(k === 'episodes' ? { epsS: null } : {}), ...(k === 'subsearch' ? { sq: null } : {}) });

function Seek({ land, onFs }: { land: boolean; onFs: () => void }) {
  const t = useStore(ptime);
  const live = pl.get().live;
  const pct = live ? 100 : t.dur ? (t.pos / t.dur) * 100 : 0;
  const click = (e: MouseEvent) => {
    if (live) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekFrac((e.clientX - r.left) / r.width);
  };
  return (
    <div class="seek">
      <span class="ptime">{live ? '' : fmtTime(t.pos)}</span>
      <div class="trk ptrk" onClick={click}><b style={`width:${pct}%`} />{!live && <i style={`left:${pct}%`} />}</div>
      <span>{live ? '' : fmtTime(t.dur)}</span>
      {land ? <span class="pi" onClick={back}><I n="fullscreen-exit" /></span> : <span class="pi" style="min-width:30px;height:30px" onClick={onFs}><I n="fullscreen" /></span>}
    </div>
  );
}

export function Vcore({ land, onFs }: { land: boolean; onFs: () => void }) {
  const s = pl.get(), p = s.st;
  const isSer = !s.live && p.mediaType === 'tv';
  const subsI = <PBtn ic={p.sub === 'Off' ? 'subtitles-outline' : 'subtitles'} on={p.sub !== 'Off'} act={sheet('subs')} label="Subtitles" />;
  const qI = <PBtn ic="high-definition" act={sheet('quality')} label="Quality" />;
  const epI = isSer && (
    <>
      <PBtn ic="playlist-play" act={sheet('episodes')} label="Episodes" />
      <PBtn ic="skip-previous" act={prev} label="Previous" />
      <PBtn ic="skip-next" act={next} label="Next" />
    </>
  );
  const spd = <span class="pi" onClick={(e) => (e.stopPropagation(), setSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length]))}>{p.speed}×</span>;
  const pipI = <PBtn ic="picture-in-picture-bottom-right" act={toPip} label="Picture in picture" />;
  const dots = <PBtn ic="dots-vertical" act={sheet('settings')} label="More" />;
  const bgI = <PBtn ic="headphones" on={p.bgPlay} act={() => patch({ bgPlay: !p.bgPlay })} label="Background play" />;
  const lockI = (
    <div class="pl rm" style={land ? 'left:14px;right:auto' : ''}>
      <PBtn ic={p.locked ? 'lock' : 'lock-open-variant-outline'} on={p.locked} act={() => (patch({ locked: !p.locked }), setUi({ sheet: false }))} label="Lock" />
    </div>
  );
  const center = (
    <div class="pl c">
      <span class="sk" onClick={(e) => (e.stopPropagation(), seekBy(-10))}><SV n="rew10" /></span>
      <div class="big" onClick={(e) => (e.stopPropagation(), togglePlay())}><I n={p.playing ? 'pause' : 'play'} /></div>
      <span class="sk" onClick={(e) => (e.stopPropagation(), seekBy(10))}><SV n="fwd10" /></span>
    </div>
  );
  const base = (
    <>
      <VideoHost fit={p.fit} hue={s.hue} />
      {p.bgPlay && <div class="bgmark"><I n="headphones" /></div>}
      <SubOverlay mode={land ? 'l' : 'p'} />
      <GenPill />
    </>
  );
  if (p.locked) return <>{base}{lockI}</>;
  if (!land)
    return (
      <>
        {base}
        <div class="pl t">
          <span class="ibtn" role="button" aria-label="Back" onClick={stop}><I n="arrow-left" /></span>
          <div style="flex:1" />
          <div class="grp">{bgI}{qI}{spd}{pipI}{dots}</div>
        </div>
        {lockI}
        {center}
        <div class="pl bl">{subsI}{epI}</div>
        <div class="pl b"><Seek land={false} onFs={onFs} /></div>
      </>
    );
  return (
    <>
      {base}
      <div class="pl t">
        <span class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></span>
        <div style="flex:1" />
        <div class="grp">{qI}{spd}{pipI}{dots}</div>
      </div>
      {lockI}
      <div class="pl rm" style="left:auto;right:14px">{bgI}</div>
      {center}
      <div class="pl bl">
        {subsI}
        <PBtn ic="waveform" act={sheet('audio')} label="Audio" />
        <PBtn ic="aspect-ratio" on={p.fit !== 'Fit'} act={() => patch({ fit: cycleFit(p).fit })} label="Resize" />
        <PBtn ic="server" act={sheet('server')} label="Server" />
        {epI}
      </div>
      <div class="pl b"><Seek land onFs={onFs} /></div>
    </>
  );
}
export const sheetOpen = () => ui.get().sheet;
