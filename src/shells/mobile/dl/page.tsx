// Downloads page (redesign 2026-11-20): summary card, poster thumbnails, in-app play of finished files,
// save location + parallel connections moved into a settings sheet (gear icon in the header).
import { useEffect, useState } from 'preact/hooks';
import { active, cancel, dlSettings, dlStore, finished, onDone, pause, pauseAll, playableUrl, resume, speeds, type DlItem } from '../../../core/downloads';
import { pickWebFolder } from '../../../core/downloads/save';
import { canPickFolder, isNative } from '../../../core/platform';
import { img, type Title } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { hueOf } from '../ui/common';
import { back, nav, toast } from '../state';
import { startAt } from '../player/store';
import { playTrack } from '../music/music';
import { dubName } from './sheet';

let wired = false;
export function wireDownloadToasts() {
  if (wired) return;
  wired = true;
  onDone((it) => it && toast(it.status === 'done' ? 'Saved · ' + short(it.savedAs || it.path) : 'Download failed'));
}
const short = (p: string) => (p.length > 46 ? '…' + p.slice(-44) : p);
const mb = (n: number) => (n / 1048576).toFixed(n > 1048576 * 100 ? 0 : 1) + ' MB';

function label(d: DlItem) {
  if (d.kind === 'comic') return 'Chapter ' + (214 - (d.episode - 1)) + ' · PDF';
  if (d.kind === 'music') return 'Music · MP3';
  const ep = /\.S\d+E\d+\./.test(d.path) ? `S${d.season} · E${d.episode} · ` : '';
  return ep + d.quality + 'p' + (d.audio && d.audio !== 'OG' ? ' · ' + dubName(d.audio) : '');
}

async function openItem(d: DlItem) {
  const t: Title = { id: d.titleId, mediaType: d.season && /S\d+E\d+/.test(d.path) ? 'tv' : 'movie', title: d.title, poster: d.poster || null, backdrop: null, rating: 0, year: '', overview: '', genreIds: [] };
  if (d.kind === 'comic') return nav('reader', { t, ch: 214 - (d.episode - 1) });
  const url = await playableUrl(d);
  if (d.kind === 'music') return url ? playTrack(d.title, hueOf(d.title), url) : toast('Open it from your Music folder');
  if (!url) return toast(isNative() ? 'File not found on this device' : 'Open it from your Downloads folder');
  startAt(t, d.season || 1, d.episode || 1, { local: url, hue: hueOf(d.title) });
  nav('info', { t });
}

function Item({ d }: { d: DlItem }) {
  const done = d.status === 'done', sp = speeds.get()[d.id] || 0, pct = done ? 100 : d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
  const st = done ? (d.bytesTotal ? mb(d.bytesTotal) : 'Saved') : d.status === 'error' ? 'Failed · tap ▶ to retry' : d.restartNeeded ? 'Paused · restart needed' : d.status === 'paused' ? `Paused · ${Math.round(pct)}%` : `${Math.round(pct)}% · ${(sp / 1048576).toFixed(1)} MB/s`;
  const art = d.poster ? `--h:${hueOf(d.title)};background-image:url(${img(d.poster, 'w185')})` : `--h:${hueOf(d.title)}`;
  return (
    <div class="dlitem">
      <div class="art" style={art} onClick={() => done && openItem(d)}>{done && <span class="pl0"><I n={d.kind === 'comic' ? 'book-open-variant' : 'play'} /></span>}</div>
      <div class="tx" onClick={() => done && openItem(d)}>
        <b>{d.title}</b>
        <small>{label(d)}</small>
        <small>{st}</small>
        {done ? <small style="opacity:.75">{short(d.savedAs || d.path)}</small> : <div class="bar"><b style={`width:${pct}%`} /></div>}
      </div>
      <div class="act">
        {done ? (
          <>
            <span class="pri" role="button" aria-label="Play" onClick={() => openItem(d)}><I n={d.kind === 'comic' ? 'book-open-variant' : 'play'} /></span>
            <span role="button" aria-label="Remove from list" onClick={() => cancel(d.id)}><I n="close" /></span>
          </>
        ) : (
          <>
            <span role="button" aria-label="Pause or resume" onClick={() => (d.status === 'running' || d.status === 'queued' ? pause(d.id) : resume(d.id))}><I n={d.status === 'running' || d.status === 'queued' ? 'pause' : 'play'} /></span>
            <span role="button" aria-label="Cancel" onClick={() => cancel(d.id)}><I n="close" /></span>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsSheet({ close }: { close: () => void }) {
  const ds = useStore(dlSettings);
  const change = async () => {
    if (isNative()) {
      const { CinetorNative } = await import('../../../native/cinetor-native');
      const r = await CinetorNative.pickFolder().catch(() => ({ cancelled: true as const }));
      if ('uri' in r) (dlSettings.set({ treeUri: r.uri, label: r.label, root: r.label }), toast('Save location updated'));
      return;
    }
    if (canPickFolder()) {
      const n = await pickWebFolder();
      if (n) (dlSettings.set({ root: n, label: n }), toast('Save location updated'));
      return;
    }
    toast('This browser saves to its Downloads folder');
  };
  return (
    <>
      <div class="scrim" onClick={close} />
      <div class="sheet dlset" style="z-index:50;padding-bottom:calc(20px + env(safe-area-inset-bottom))">
        <div class="shd"><b style="font-size:17px;display:flex;gap:8px;align-items:center"><I n="cog-outline" />Download settings</b><span class="grow" /><span style="font-size:22px;cursor:pointer" onClick={close}><I n="close" /></span></div>
        <div class="lbl2">Save location</div>
        <div class="dlpathbig"><I n="folder-outline" /><span>{ds.label || ds.root}</span></div>
        <div class="body-s" style="margin:4px 0 10px">Videos go in the main folder. Comics (PDF) go in <b>Comics/</b>, music in <b>Music/</b>.</div>
        <span class="btn tonal" style="height:40px" onClick={change}><I n="folder-edit-outline" /> Change folder</span>
        {ds.treeUri && <span class="btn text" style="height:40px" onClick={() => (dlSettings.set({ treeUri: undefined, label: undefined, root: 'Download/Cinetor' }), toast('Back to Download/Cinetor'))}>Use default</span>}
        <div class="lbl2">Parallel connections</div>
        <div class="pill2">{([16, 32, 64] as const).map((n) => <span key={n} class={ds.conn === n ? 'on' : ''} onClick={() => (dlSettings.set({ conn: n }), toast(n + ' parallel connections'))}>{n}</span>)}</div>
        <div class="body-s" style="margin-top:8px">More connections = faster on a good network. Applies to new and resumed downloads.{!isNative() && ' A browser allows about 6 connections per server; 16/32/64 apply fully in the Android app.'}</div>
      </div>
    </>
  );
}

export function Downloads() {
  useStore(dlStore);
  useStore(speeds);
  const [set, setSet] = useState(false);
  useEffect(wireDownloadToasts, []);
  const act = active(), done = finished();
  const tot = act.reduce((a, d) => a + d.bytesTotal, 0), got = act.reduce((a, d) => a + d.bytesDone, 0);
  const paused = act.length > 0 && act.every((d) => d.status !== 'running' && d.status !== 'queued');
  return (
    <>
      <div class="dlhead">
        <div class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
        <h3>Downloads</h3>
        <div class="ibtn" role="button" aria-label="Download settings" onClick={() => setSet(true)}><I n="cog-outline" /></div>
      </div>
      <div class="scroll">
        {(act.length > 0 || done.length > 0) && (
          <div class="dlsum">
            <span class="ring" style={`--p:${tot ? (got / tot) * 100 : done.length ? 100 : 0}`}><i><I n={act.length ? 'download' : 'check'} /></i></span>
            <div style="flex:1;min-width:0">
              <b>{act.length ? `${act.length} downloading` : 'All downloads finished'}</b>
              <small>{done.length} saved{tot ? ` · ${mb(got)} of ${mb(tot)}` : ''}</small>
            </div>
            {act.length > 0 && <span class="btn tonal" style="height:36px;padding:0 14px" onClick={() => pauseAll(!paused)}>{paused ? 'Resume all' : 'Pause all'}</span>}
          </div>
        )}
        {act.length > 0 && <><div class="dlsec">Downloading</div>{act.map((d) => <Item key={d.id} d={d} />)}</>}
        {done.length > 0 && <><div class="dlsec">Downloaded <span onClick={() => toast('Tap a title to play it in the app')}>Play offline</span></div>{done.map((d) => <Item key={d.id} d={d} />)}</>}
        {!act.length && !done.length && (
          <div class="dlempty"><I n="cloud-download-outline" /><div class="title-m" style="color:var(--on)">No downloads yet</div><div class="body-m">Use the download button on any title or episode. Downloads play here even without internet.</div></div>
        )}
      </div>
      {set && <SettingsSheet close={() => setSet(false)} />}
    </>
  );
}
