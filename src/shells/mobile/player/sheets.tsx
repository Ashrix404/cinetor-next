// Player bottom/side sheet (prototype `sheetBody`, `sheetHtml`).
import { I } from '../ui/icons';
import { QUALITIES, FITS, cycleFit } from '../../../core/player-model';
import { setUi, ui } from '../state';
import { patch, pl, saveSeries, setQuality, startAt, switchServer } from './store';
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

export function ServerBody() {
  const s = pl.get();
  const servers = s.servers && s.servers.length > 0
    ? s.servers
    : (s.embeds && s.embeds.length > 0
        ? s.embeds.map((e, i) => ({
            name: `Server ${i + 1} (Web Embed)`,
            url: e.url,
            isDirect: false,
            quality: 1080,
          }))
        : []);

  if (!servers.length) {
    return (
      <div style="padding:16px 8px;text-align:center;opacity:0.6;font-size:13px">
        No additional servers available
      </div>
    );
  }

  return (
    <>
      <div class="shd" style="display:flex;align-items:center;gap:8px;padding:4px 0 10px;font-weight:600">
        <I n="server" />
        <span>Select Server</span>
      </div>
      {servers.map((srv, idx) => {
        const isCurrent = idx === s.serverIndex;
        const qTag = srv.quality ? `${srv.quality}p` : '';
        const typeTag = srv.isDirect ? 'Direct' : 'Embed';
        return (
          <SRowOpt
            key={srv.url || idx}
            ic="server"
            txt={
              <span style="display:inline-flex;align-items:center;gap:8px">
                <span>{srv.name}</span>
                {qTag && <small style="display:inline;opacity:0.75">{qTag}</small>}
                <small
                  style={`display:inline;font-size:10px;padding:1px 5px;border-radius:3px;${
                    srv.isDirect
                      ? 'background:rgba(74,222,128,0.15);color:#4ade80'
                      : 'background:rgba(255,255,255,0.06);opacity:0.7'
                  }`}
                >
                  {typeTag}
                </small>
              </span>
            }
            on={isCurrent}
            act={() => {
              void switchServer(idx, 'manual');
              close();
            }}
          />
        );
      })}
    </>
  );
}

function Body() {
  const s = pl.get(), p = s.st, k = ui.get().sheet;
  const pickAudio = (c: string) => (patch({ audio: c }), saveSeries(), close());
  switch (k) {
    case 'servers':
    case 'server':
      return <ServerBody />;
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
          <SRowOpt ic="server" txt={s.servers?.[s.serverIndex]?.name || 'Server'} act={() => setUi({ sheet: 'servers' })} />
          <SRowOpt ic="waveform" txt="" act={() => setUi({ sheet: 'audio' })} />
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
      {/* prototype sheetHtml: side sheet 300 px in landscape, bottom sheet max 74 % in portrait (sizes in app.css) */}
      <div class={'sheet plsheet' + (land ? ' land' : '')}>
        <div style="display:flex;justify-content:flex-end;margin-bottom:6px"><span style="font-size:22px;cursor:pointer" onClick={close}><I n="close" /></span></div>
        <Body />
      </div>
    </>
  );
}
