// Player bottom/side sheet (prototype `sheetBody`, `sheetHtml`).
import { I } from '../ui/icons';
import { QUALITIES, FITS, cycleFit } from '../../../core/player-model';
import { setUi, ui } from '../state';
import { patch, pl, saveSeries, setQuality, startAt } from './store';
import { SRowOpt, SubsBody, SubSearchBody, SubStyleBody } from './subs';

const close = () => setUi({ sheet: false });
function Stepper({ i1, i2, v, on }: { i1: string; i2: string; v: number; on: (d: number) => void }) {
  return (
    <div class="opt" style="cursor:default">
      <span style="display:flex;gap:6px;font-size:22px"><I n={i1} /><I n={i2} /></span>
      <span class="stp"><b onClick={() => on(-100)}><I n="minus" /></b>{v}<b onClick={() => on(100)}><I n="plus" /></b></span>
    </div>
  );
}

function Body() {
  const s = pl.get(), p = s.st, k = ui.get().sheet;
  const pickAudio = (c: string) => (patch({ audio: c }), saveSeries(), close());
  switch (k) {
    case 'audio':
      return <>{['OG', 'EN', 'BN'].map((c) => <SRowOpt key={c} ic="waveform" txt={c} on={p.audio === c} act={() => pickAudio(c)} />)}</>;
    case 'subs':
      return <SubsBody />;
    case 'subsearch':
      return <SubSearchBody />;
    case 'substyle':
      return <SubStyleBody />;
    case 'quality':
      return <>{QUALITIES.map((q) => <SRowOpt key={q} ic="high-definition" txt={q} on={p.quality === q} act={() => (setQuality(q), close())} />)}</>;
    case 'server':
      return <>{[1, 2, 3].map((n) => <SRowOpt key={n} ic="server" txt={n} on={p.server === n} act={() => (patch({ server: n }), close())} />)}</>;
    case 'episodes': {
      const sn = ui.get().epsS || p.season, n = s.seasons[sn - 1] || 6;
      return (
        <>
          <div class="lgrid">{s.seasons.map((_, i) => <span key={i} class={'lg' + (i + 1 === sn ? ' has' : '')} onClick={() => setUi({ epsS: i + 1 })}>S{i + 1}</span>)}</div>
          <div class="eptiles">
            {Array.from({ length: n }, (_, i) => i + 1).map((e) => (
              <div key={e} class={e === p.episode && sn === p.season ? 'on' : ''} style={`--h:${s.hue + e * 8 + sn * 20}`} onClick={() => (s.title && startAt(s.title, sn, e), close())}>{e}</div>
            ))}
          </div>
        </>
      );
    }
    case 'settings':
      return (
        <>
          <Stepper i1="waveform" i2="timer-outline" v={p.audioDelayMs} on={(d) => patch({ audioDelayMs: p.audioDelayMs + d })} />
          <Stepper i1="subtitles-outline" i2="timer-outline" v={p.subDelayMs} on={(d) => patch({ subDelayMs: p.subDelayMs + d })} />
          <SRowOpt ic="waveform" txt="" act={() => setUi({ sheet: 'audio' })} />
          <SRowOpt ic="server" txt="" act={() => setUi({ sheet: 'server' })} />
          <SRowOpt ic="aspect-ratio" txt={FITS.indexOf(p.fit) + 1 + '/3'} on={p.fit !== 'Fit'} act={() => patch({ fit: cycleFit(p).fit })} />
          <SRowOpt ic="format-size" txt="" act={() => setUi({ sheet: 'substyle' })} />
          <SRowOpt ic="headphones" txt="" on={p.bgPlay} act={() => patch({ bgPlay: !p.bgPlay })} />
          {'pictureInPictureEnabled' in document && innerWidth >= 700 && <SRowOpt ic="picture-in-picture-bottom-right" txt="Browser PiP" act={() => void document.querySelector('video')?.requestPictureInPicture?.().catch(() => {})} />}
          <SRowOpt ic="memory" txt={p.hwDecoder ? 'HW' : 'SW'} act={() => patch({ hwDecoder: !p.hwDecoder })} />
        </>
      );
    default:
      return null;
  }
}

export function PlayerSheet({ land }: { land: boolean }) {
  if (!ui.get().sheet || !pl.get().active) return null;
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="sheet" style={(land ? 'left:auto;width:300px;top:0;border-radius:28px 0 0 28px;padding:14px 20px;' : 'max-height:74%;overflow:auto;') + 'z-index:50'}>
        <div style="display:flex;justify-content:flex-end;margin-bottom:6px"><span style="font-size:22px;cursor:pointer" onClick={close}><I n="close" /></span></div>
        <Body />
      </div>
    </>
  );
}
