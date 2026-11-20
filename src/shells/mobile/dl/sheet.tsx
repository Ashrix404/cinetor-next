// Download sheet (prototype dlSheet / dlBtn / dlIcon): Season 1 pre-selected, per-season memory,
// quality + dub remembered for the session, popup "Download started · View".
import { dlId, dlStore, enqueue, cancel, speeds } from '../../../core/downloads';
import { isAndroidBrowser, isIOS, isNative } from '../../../core/platform';
import { MEDIA_BASE } from '../../../core/config';
import { clipFor } from '../../../core/player-model';
import type { Quality } from '../../../core/series-settings';
import type { Title } from '../../../core/tmdb';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { dlPop, on, setUi, ui, toast, type DlSheet as Dls } from '../state';

export const SZ: Record<number, number> = { 2160: 3.4, 1080: 1.3, 720: 0.7, 480: 0.4, 360: 0.25 };
export const DUBS: [string, string][] = [['OG', 'Original'], ['EN', 'English dub'], ['HI', 'Hindi dub'], ['BN', 'Bangla dub'], ['ES', 'Spanish dub'], ['JA', 'Japanese dub'], ['KO', 'Korean dub'], ['DE', 'German dub'], ['FR', 'French dub'], ['ZH', 'Chinese dub']];
export const dubName = (c: string) => (DUBS.find((x) => x[0] === c) || DUBS[0])[1];
const kindOf = (k: Dls['kind']) => (k === 'comic' ? 'comic' : 'video');

/** External downloader (Preferences): hand the URL to another app instead of the engine. */
async function external(url: string, title: string) {
  if (isNative()) {
    const { CinetorNative } = await import('../../../native/cinetor-native');
    return CinetorNative.openExternal({ url, mime: 'video/mp4', title });
  }
  if (isAndroidBrowser()) {
    const u = new URL(url);
    location.href = `intent://${u.host}${u.pathname}#Intent;scheme=https;type=video/mp4;action=android.intent.action.VIEW;S.title=${encodeURIComponent(title)};end`;
    return;
  }
  if (isIOS() && navigator.share) return navigator.share({ url, title }).catch(() => open(url));
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.click();
}

export function openDl(t: Title, s: number, e: number, kind: Dls['kind']) {
  const id = dlId(kindOf(kind), t.id, s, e);
  if (dlStore.get().items[id]) return void cancel(id);
  setUi({ dls: { title: t, s, kind, sel: { [e]: true }, sels: {} } });
}
export function openDlAll(t: Title, kind: Dls['kind'], season: number) {
  const n = kind === 'comic' ? 12 : 6, sel: Record<number, boolean> = {};
  for (let i = 1; i <= n; i++) sel[i] = true;
  void season; // prototype: Season 1 is always the pre-selected one
  setUi({ dls: { title: t, s: 1, kind, sel, sels: {} } });
}
export function allDone(t: Title, s: number, n: number) {
  const items = dlStore.get().items;
  for (let e = 1; e <= n; e++) if (items[dlId('video', t.id, s, e)]?.status !== 'done' && items[dlId('comic', t.id, s, e)]?.status !== 'done') return false;
  return true;
}

export function DlIcon({ id }: { id: string }) {
  const d = useStore(dlStore).items[id];
  useStore(speeds);
  if (!d) return <I n="download-outline" />;
  if (d.status === 'done') return <span style="color:var(--primary)"><I n="check-circle" /></span>;
  const p = d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
  return <span class="dlp" style={`--p:${p}`}><b>{Math.round(p)}</b></span>;
}
export function DlBtn({ t, s, e, kind }: { t: Title; s: number; e: number; kind: Dls['kind'] }) {
  return <span class="dlb" onClick={(ev) => (ev.stopPropagation(), openDl(t, s, e, kind))}><DlIcon id={dlId(kindOf(kind), t.id, s, e)} /></span>;
}

export function DlSheet() {
  const u = ui.get(), d = u.dls;
  useStore(dlStore);
  if (!d) return null;
  const comic = d.kind === 'comic', movie = d.kind === 'movie', n = comic ? 12 : movie ? 1 : 6, sel = d.sel;
  const all = { ...d.sels, [d.s]: sel };
  const cnt = Object.values(all).reduce((a, x) => a + Object.keys(x).filter((k) => x[+k]).length, 0);
  const here = Object.keys(sel).filter((k) => sel[+k]).length;
  const gb = (cnt * SZ[u.dq]).toFixed(1);
  const nm = (i: number) => (comic ? 'Chapter ' + (214 - i) : movie ? d.title.title : 'Episode ' + (i + 1));
  const set = (p: Partial<Dls>) => setUi({ dls: { ...d, ...p } });
  const go = () => {
    const sels = { ...d.sels, [d.s]: d.sel };
    const specs = Object.entries(sels).flatMap(([sn, sl]) =>
      Object.keys(sl).filter((k) => sl[+k]).map((k) => ({
        titleId: d.title.id, title: d.title.title, kind: kindOf(d.kind) as 'video' | 'comic', season: +sn, episode: +k,
        quality: u.dq as Quality, audio: comic ? 'OG' : u.da, movie, chapter: comic ? 214 - (+k - 1) : undefined,
      })),
    );
    if (on.get().ed && !comic) {
      specs.forEach((s) => void external(MEDIA_BASE + clipFor(s.quality), d.title.title));
      setUi({ dls: null });
      return toast('Sent to another app');
    }
    const c = enqueue(specs);
    if (!c) return;
    setUi({ dls: null });
    dlPop('Download started · ' + c + ' item' + (c > 1 ? 's' : '') + (comic ? ' (PDF)' : ' · ' + u.dq + 'p'));
  };
  return (
    <>
      <div class="scrim" onClick={() => setUi({ dls: null })} />
      <div class="sheet dlsheet" style="max-height:82%;overflow:auto;z-index:50">
        <div class="shd"><b style="font-size:17px;display:flex;gap:8px;align-items:center"><I n="download-outline" />{d.title.title}</b><span class="grow" /><span style="font-size:22px;cursor:pointer" onClick={() => setUi({ dls: null })}><I n="close" /></span></div>
        {!comic && !movie && (
          <>
            <div class="dlh">Season</div>
            <div class="lgrid">{[1, 2, 3].map((x) => <span key={x} class={'lg' + (x === d.s ? ' has' : '')} onClick={() => set({ sels: { ...d.sels, [d.s]: d.sel }, s: x, sel: d.sels[x] || {} })}>S{x}</span>)}</div>
          </>
        )}
        <div class="dlh">{comic ? 'Chapters' : movie ? 'Movie' : 'Episodes'}{!movie && <span class="dls" onClick={() => {
          const ns: Record<number, boolean> = {};
          if (here !== n) for (let i = 1; i <= n; i++) ns[i] = true;
          set({ sel: ns });
        }}>{here === n ? 'Clear' : 'Select all'}</span>}</div>
        <div class="dleps">
          {Array.from({ length: n }, (_, i) => {
            const k = i + 1, onn = !!sel[k], ex = dlStore.get().items[dlId(kindOf(d.kind), d.title.id, d.s, k)];
            return (
              <div key={k} class={'dle' + (onn ? ' on' : '')} onClick={() => !ex && set({ sel: { ...sel, [k]: !sel[k] } })}>
                <I n={ex ? 'check-circle' : onn ? 'checkbox-marked' : 'checkbox-blank-outline'} />
                <span>{movie ? nm(i) : `${k}. ${nm(i)}`}</span><small>{ex ? ex.quality + 'p' : ''}</small>
              </div>
            );
          })}
        </div>
        {!comic && (
          <>
            <div class="dlh">Quality</div>
            <div class="lgrid">{[2160, 1080, 720, 480, 360].map((q) => <span key={q} class={'lg' + (q === u.dq ? ' has' : '')} onClick={() => setUi({ dq: q })}>{q}p <small>{SZ[q]} GB</small></span>)}</div>
            <div class="dlh">Audio (dub)</div>
            <div class="lgrid">{DUBS.map(([c, nme]) => <span key={c} class={'lg' + (c === u.da ? ' has' : '')} onClick={() => setUi({ da: c })}>{nme}</span>)}</div>
          </>
        )}
        <div class="dlf"><span class="body-s">{cnt} selected{!comic && ` · ${gb} GB`}</span><span class={'btn' + (cnt ? '' : ' dis')} onClick={go}><I n="download" /> Download</span></div>
      </div>
    </>
  );
}
