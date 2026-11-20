// Downloads page (redesign 2026-11-20): summary card, poster thumbnails, in-app play of finished files,
// save location + parallel connections moved into a settings sheet (gear icon in the header).
import { useEffect, useState } from 'preact/hooks';
import { active, dlSettings, dlStore, finished, onDone, pause, pauseAll, playableUrl, removeMany, resume, speeds, type DlItem } from '../../../core/downloads';
import { tmdbGet } from '../../../core/tmdb';
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
  return ep + d.quality + 'p' + (d.audio && d.audio !== 'OG' && d.audio !== 'Original' ? ' · ' + dubName(d.audio) : '');
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

/** Old downloads have no poster: look it up once from TMDB. */
const asked = new Set<string>();
let longPressed = false;
function usePoster(d: DlItem) {
  useEffect(() => {
    if (d.poster || d.kind === 'music' || asked.has(d.id)) return;
    asked.add(d.id);
    const mt = /\.S\d+E\d+\./.test(d.path) || d.kind === 'comic' ? 'tv' : 'movie';
    void tmdbGet<{ poster_path?: string }>(`/${mt}/${d.titleId}`).then((r) => {
      const it = dlStore.get().items[d.id];
      if (it && r.poster_path) dlStore.set({ items: { ...dlStore.get().items, [d.id]: { ...it, poster: r.poster_path } } });
    }, () => {});
  }, [d.id]);
}

function Item({ d, sel, selecting, onSel }: { d: DlItem; sel: boolean; selecting: boolean; onSel: () => void }) {
  usePoster(d);
  const done = d.status === 'done', running = d.status === 'running' || d.status === 'queued', sp = speeds.get()[d.id] || 0;
  const pct = done ? 100 : d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
  const st = done ? (d.bytesTotal ? mb(d.bytesTotal) : 'Saved') : d.status === 'error' ? 'Failed · tap to retry' : d.restartNeeded ? 'Paused · restart needed' : !running ? `Paused · ${Math.round(pct)}%` : `${Math.round(pct)}% · ${(sp / 1048576).toFixed(1)} MB/s`;
  const art = d.poster ? `--h:${hueOf(d.title)};background-image:url(${img(d.poster, 'w185')})` : `--h:${hueOf(d.title)}`;
  // Tap: selection mode → select; finished → play; downloading → pause / resume.
  const tap = () => {
    if (longPressed) return void (longPressed = false); // the click after a long press only selects
    if (selecting) onSel();
    else if (done) void openItem(d);
    else if (running) void pause(d.id);
    else void resume(d.id);
  };
  let t: ReturnType<typeof setTimeout> | undefined;
  const press = () => (t = setTimeout(() => ((t = undefined), (longPressed = true), onSel()), 450));
  const release = () => t && clearTimeout(t);
  return (
    <div class={'dlitem' + (sel ? ' sel' : '')} onClick={tap} onPointerDown={press} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}>
      {selecting && <span class="dlck"><I n={sel ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} /></span>}
      <div class="art" style={art}>
        {!done && !selecting && <span class="pl0"><I n={running ? 'pause' : 'download'} /></span>}
        {done && !selecting && <span class="pl0 soft"><I n={d.kind === 'comic' ? 'book-open-variant' : 'play'} /></span>}
      </div>
      <div class="tx">
        <b>{d.title}</b>
        <small>{label(d)}</small>
        <small>{st}</small>
        {done ? <small style="opacity:.7">{short(d.savedAs || d.path)}</small> : <div class="bar"><b style={`width:${pct}%`} /></div>}
      </div>
    </div>
  );
}

function DeleteDialog({ ids, close }: { ids: string[]; close: (done: boolean) => void }) {
  const items = ids.map((id) => dlStore.get().items[id]).filter(Boolean);
  const anyDone = items.some((d) => d.status === 'done');
  const [storage, setStorage] = useState(false);
  const go = async () => {
    const n = await removeMany(ids, storage && anyDone);
    toast(storage && anyDone ? `Deleted ${ids.length} · ${n} file${n === 1 ? '' : 's'} removed from storage` : `Removed ${ids.length} from the app`);
    close(true);
  };
  return (
    <>
      <div class="scrim" style="z-index:70" onClick={() => close(false)} />
      <div class="dialog deldlg" style="z-index:71">
        <h4>Delete {ids.length} download{ids.length > 1 ? 's' : ''}?</h4>
        <div class={'delopt' + (!storage ? ' on' : '')} onClick={() => setStorage(false)}>
          <I n={!storage ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} />
          <div><b>Delete from app</b><small>{anyDone ? 'Removes it from Downloads. The video file stays in your storage.' : 'Stops and removes the unfinished download.'}</small></div>
        </div>
        {anyDone && (
          <div class={'delopt' + (storage ? ' on' : '')} onClick={() => setStorage(true)}>
            <I n={storage ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} />
            <div><b>Delete from storage too</b><small>{isNative() ? 'Removes it from the app and deletes the file from your phone.' : 'Removes the offline copy kept by the app.'}</small></div>
          </div>
        )}
        <div class="acts"><span class="btn text" onClick={() => close(false)}>Cancel</span><span class="btn text" style="color:#ff8a80" onClick={go}><I n="delete-outline" /> Delete</span></div>
      </div>
    </>
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
        <div class="body-s" style="margin-top:8px">More connections = faster on a good network. Applies to new and resumed downloads.{!isNative() && ' A browser allows only about 6 connections at a time; 16/32/64 apply fully in the Android app.'}</div>
      </div>
    </>
  );
}

export function Downloads() {
  useStore(dlStore);
  useStore(speeds);
  const [set, setSet] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean> | null>(null);
  const [del, setDel] = useState<string[] | null>(null);
  const toggleSel = (id: string) => setSel({ ...(sel || {}), [id]: !(sel || {})[id] });
  const picked = Object.keys(sel || {}).filter((k) => sel![k]);
  useEffect(wireDownloadToasts, []);
  const act = active(), done = finished();
  const tot = act.reduce((a, d) => a + d.bytesTotal, 0), got = act.reduce((a, d) => a + d.bytesDone, 0);
  const paused = act.length > 0 && act.every((d) => d.status !== 'running' && d.status !== 'queued');
  return (
    <>
      <div class="dlhead">
        <div class="ibtn" role="button" aria-label="Back" onClick={back}><I n="arrow-left" /></div>
        <h3>{sel ? `${picked.length} selected` : 'Downloads'}</h3>
        {sel ? (
          <>
            <div class="ibtn" role="button" aria-label="Select all" onClick={() => setSel(Object.fromEntries([...act, ...done].map((d) => [d.id, picked.length < act.length + done.length])))}><I n="select-all" /></div>
            <div class="ibtn" role="button" aria-label="Done" onClick={() => setSel(null)}><I n="close" /></div>
          </>
        ) : (
          <>
            {(act.length > 0 || done.length > 0) && <div class="ibtn" role="button" aria-label="Select" onClick={() => setSel({})}><I n="checkbox-marked-circle" /></div>}
            <div class="ibtn" role="button" aria-label="Download settings" onClick={() => setSet(true)}><I n="cog-outline" /></div>
          </>
        )}
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
        {act.length > 0 && <><div class="dlsec">Downloading</div>{act.map((d) => <Item key={d.id} d={d} sel={!!sel?.[d.id]} selecting={!!sel} onSel={() => (sel ? toggleSel(d.id) : setSel({ [d.id]: true }))} />)}</>}
        {done.length > 0 && <><div class="dlsec">Downloaded <span>Tap to play offline</span></div>{done.map((d) => <Item key={d.id} d={d} sel={!!sel?.[d.id]} selecting={!!sel} onSel={() => (sel ? toggleSel(d.id) : setSel({ [d.id]: true }))} />)}</>}
        {!act.length && !done.length && (
          <div class="dlempty"><I n="cloud-download-outline" /><div class="title-m" style="color:var(--on)">No downloads yet</div><div class="body-m">Use the download button on any title or episode. Downloads play here even without internet.</div></div>
        )}
      </div>
      {sel && picked.length > 0 && (
        <div class="dlbar"><span>{picked.length} selected</span><span class="btn" style="height:40px;background:#ff5252;color:#fff" onClick={() => setDel(picked)}><I n="delete-outline" /> Delete</span></div>
      )}
      {del && <DeleteDialog ids={del} close={(ok) => (setDel(null), ok && setSel(null))} />}
      {set && <SettingsSheet close={() => setSet(false)} />}
    </>
  );
}
