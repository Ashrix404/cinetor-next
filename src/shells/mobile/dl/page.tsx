// Downloads page (prototype V.downloads): save location, parallel connections, downloading + downloaded lists.
import { useEffect } from 'preact/hooks';
import { active, cancel, dlSettings, dlStore, finished, onDone, pause, pauseAll, resume, speeds, type DlItem } from '../../../core/downloads';
import { pickWebFolder } from '../../../core/downloads/save';
import { canPickFolder, isNative } from '../../../core/platform';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { BackTop, Empty, hueOf } from '../ui/common';
import { setUi, toast, ui } from '../state';
import { dubName } from './sheet';

let wired = false;
export function wireDownloadToasts() {
  if (wired) return;
  wired = true;
  onDone((it) => it && toast(it.status === 'done' ? 'Saved · ' + (it.savedAs || it.path) : 'Download failed: ' + (it.error || '')));
}

function label(d: DlItem) {
  if (d.kind === 'comic') return 'Chapter ' + (214 - (d.episode - 1)) + ' · PDF';
  if (d.kind === 'music') return 'Music · MP3';
  return (d.season ? `S${d.season} · E${d.episode}` : 'Movie') + ` · ${d.quality}p${d.audio && d.audio !== 'OG' ? ' · ' + dubName(d.audio) : ''}`;
}

function Item({ d, done }: { d: DlItem; done: boolean }) {
  const sp = speeds.get()[d.id] || 0, pct = d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
  const st = done ? 'Done' : d.status === 'error' ? 'Failed' : d.restartNeeded ? 'Paused · restart needed' : Math.round(pct) + '%' + (d.status === 'paused' ? ' · Paused' : ' · ' + (sp / 1048576).toFixed(1) + ' MB/s');
  return (
    <div class="ep" style="cursor:default">
      <div class="th" style={`--h:${hueOf(d.title)};width:64px;aspect-ratio:1`}><div class="pbar"><b class="dlprog" style={`width:${done ? 100 : pct}%`} /></div></div>
      <div class="tx">
        <b>{d.title}</b>
        <small>{label(d)} · <span class="dlpct">{st}</span></small>
        <small class="dlpath">{d.path}</small>
        {done && d.savedAs && d.savedAs !== d.path && <small class="dlpath">Saved: {d.savedAs}</small>}
      </div>
      {done ? (
        <span class="dlb on" onClick={() => cancel(d.id)}><I n="check-circle" /></span>
      ) : (
        <>
          <span class="dlb" onClick={() => (d.status === 'paused' || d.status === 'error' ? resume(d.id) : pause(d.id))}><I n={d.status === 'paused' || d.status === 'error' ? 'play-circle-outline' : 'pause-circle-outline'} /></span>
          <span class="dlb" onClick={() => cancel(d.id)}><I n="close-circle-outline" /></span>
        </>
      )}
    </div>
  );
}

const PATHS: [string, string][] = [['Downloads folder', 'Download/Cinetor'], ['Movies folder', 'Movies/Cinetor']];

export function Downloads() {
  useStore(dlStore);
  useStore(speeds);
  const ds = useStore(dlSettings);
  useEffect(wireDownloadToasts, []);
  const act = active(), done = finished();
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
    setUi({ pathDlg: true });
  };
  return (
    <>
      <BackTop t="Downloads" />
      <div class="scroll">
        <div class="card dlcard" style="margin:6px 16px 10px;padding:14px">
          <div class="lbl2">Save location</div>
          <div class="dlpathbig"><I n="folder-outline" /><span>{ds.label || ds.root}</span></div>
          <div class="body-s" style="margin:4px 0 8px">Videos go in the main folder. Comics (PDF) go in <b>Comics/</b>, music in <b>Music/</b>.</div>
          <span class="btn tonal" style="height:36px" onClick={change}><I n="folder-edit-outline" /> Change folder</span>
          <div class="lbl2" style="margin-top:14px">Parallel connections</div>
          <div class="pill2">{([16, 32, 64] as const).map((n) => <span key={n} class={ds.conn === n ? 'on' : ''} onClick={() => (dlSettings.set({ conn: n }), toast(n + ' parallel connections'))}>{n}</span>)}</div>
          <div class="body-s" style="margin-top:6px">More connections = faster on a good network. Applies to all active downloads.{!isNative() && ' In a browser only about 6 connections per server are possible; 16/32/64 apply fully in the app.'}</div>
        </div>
        {act.length > 0 && (
          <>
            <div class="sec">Downloading <span style="float:right;cursor:pointer" onClick={() => pauseAll(!act.every((d) => d.status === 'paused'))}>{act.every((d) => d.status === 'paused') ? 'Resume all' : 'Pause all'}</span></div>
            {act.map((d) => <Item key={d.id} d={d} done={false} />)}
          </>
        )}
        {done.length > 0 && (
          <>
            <div class="sec" style="padding-top:16px">Downloaded</div>
            {done.map((d) => <Item key={d.id} d={d} done />)}
          </>
        )}
        {!act.length && !done.length && <Empty h={200} d="No downloads yet" />}
      </div>
      {ui.get().pathDlg && (
        <>
          <div class="scrim" onClick={() => setUi({ pathDlg: false })} />
          <div class="dialog" style="z-index:60">
            <h4>Save location</h4>
            {PATHS.map(([n, p]) => (
              <div key={p} class="srow" style="padding:10px 0;cursor:pointer" onClick={() => (dlSettings.set({ root: p, label: p }), setUi({ pathDlg: false }), toast('Save location updated'))}>
                <div class="tx"><b>{n}</b><small>{p}</small></div>{ds.root === p && <I n="check" />}
              </div>
            ))}
            <div class="acts"><span class="btn text" onClick={() => setUi({ pathDlg: false })}>Cancel</span></div>
          </div>
        </>
      )}
    </>
  );
}
