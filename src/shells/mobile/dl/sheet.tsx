// Download sheet (prototype dlSheet / dlBtn / dlIcon): Season 1 pre-selected, per-season memory,
// quality + dub remembered for the session, popup "Download started · View".
import { dlId, dlStore, enqueue, cancel, speeds } from '../../../core/downloads';
import { isAndroidBrowser, isIOS, isNative } from '../../../core/platform';
import type { Quality } from '../../../core/series-settings';
import type { Title } from '../../../core/tmdb';
import { fetchStream } from '../../../core/stream-resolver';
import { dlAvail, loadAvail } from '../../../core/dl-avail';
import { audios, fmtSize, qualities } from '../../../core/dl-options';
import { useEffect } from 'preact/hooks';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { dlPop, on, setUi, ui, toast, type DlSheet as Dls } from '../state';

/** Audio label of a download ('OG' = items saved before real audio languages existed). */
export const dubName = (c: string) => (c === 'OG' ? 'Original' : c);
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
  const u = useStore(ui);
  useStore(dlStore);
  return u.dls ? <DlBody /> : null;
}
function DlBody() {
  const u = useStore(ui), d = u.dls!;
  const comic = d.kind === 'comic', movie = d.kind === 'movie', n = comic ? 12 : movie ? 1 : 6, sel = d.sel;
  const all = { ...d.sels, [d.s]: sel };
  const cnt = Object.values(all).reduce((a, x) => a + Object.keys(x).filter((k) => x[+k]).length, 0);
  const here = Object.keys(sel).filter((k) => sel[+k]).length;
  const av = useStore(dlAvail);
  const firstEp = movie ? 1 : +(Object.keys(sel).find((k) => sel[+k]) || 1);
  const reload = (force = false) => !comic && loadAvail(d.title.id, d.title.title, movie ? 'movie' : 'tv', movie ? 1 : d.s, firstEp, force);
  useEffect(() => void reload(), [d.title.id, d.s, firstEp, comic]);
  const qs = qualities(av.opts), dq = qs.includes(u.dq) ? u.dq : qs[0], as = audios(av.opts, dq), da = as.includes(u.da) ? u.da : as[0];
  const opt = av.opts.find((x) => x.quality === dq && x.audio === da);
  const size = opt?.size ? fmtSize(opt.size * cnt) : '~';
  const canDl = comic || av.opts.length > 0;
  const nm = (i: number) => (comic ? 'Chapter ' + (214 - i) : movie ? d.title.title : 'Episode ' + (i + 1));
  const set = (p: Partial<Dls>) => setUi({ dls: { ...d, ...p } });
  const go = () => {
    const sels = { ...d.sels, [d.s]: d.sel };
    const specs = Object.entries(sels).flatMap(([sn, sl]) =>
      Object.keys(sl).filter((k) => sl[+k]).map((k) => ({
        poster: d.title.poster, titleId: d.title.id, title: d.title.title, kind: kindOf(d.kind) as 'video' | 'comic', season: +sn, episode: +k,
        quality: (dq || u.dq) as Quality, audio: comic ? 'OG' : da || 'Original', movie, chapter: comic ? 214 - (+k - 1) : undefined,
      })),
    );
    if (on.get().ed && !comic) {
      specs.forEach((s) => {
        void fetchStream(d.title.id, d.title.title, movie ? 'movie' : 'tv', s.season, s.episode).then((res) => {
          if (res?.url) void external(res.url, d.title.title);
        });
      });
      setUi({ dls: null });
      return toast('Sent to another app');
    }
    const c = enqueue(specs);
    if (!c) return;
    setUi({ dls: null });
    dlPop('Download started · ' + c + ' item' + (c > 1 ? 's' : '') + (comic ? ' (PDF)' : ' · ' + dq + 'p'));
  };
  return (
    <>
      <div class="scrim" style="z-index:59" onClick={() => setUi({ dls: null })} />
      <div class="sheet dlsheet" style="z-index:60">
        <div class="shd"><b style="font-size:17px;display:flex;gap:8px;align-items:center"><I n="download-outline" /><span>{d.title.title}</span></b><span style="font-size:22px;cursor:pointer;flex:none" onClick={() => setUi({ dls: null })}><I n="close" /></span></div>
        <div class="dlbody">
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
        {!comic && (av.state === 'loading' || av.state === 'idle') && <div class="dlh">Checking what can be downloaded…</div>}
        {!comic && av.state === 'error' && <div class="dlh">Couldn't check this title<span class="dls" onClick={() => reload(true)}>Retry</span></div>}
        {!comic && av.state === 'ready' && !av.opts.length && <div class="dlh">No downloadable file was found for this title<span class="dls" onClick={() => reload(true)}>Retry</span></div>}
        {!comic && av.opts.length > 0 && (
          <>
            <div class="dlh">Quality</div>
            <div class="lgrid">{qs.map((q) => <span key={q} class={'lg' + (q === dq ? ' has' : '')} onClick={() => setUi({ dq: q })}>{q}p <small>{fmtSize(av.opts.find((x) => x.quality === q)?.size || 0)}</small></span>)}</div>
            <div class="dlh">Audio</div>
            <div class="lgrid">{as.map((c) => <span key={c} class={'lg' + (c === da ? ' has' : '')} onClick={() => setUi({ da: c })}>{c}</span>)}</div>
          </>
        )}
        </div>
        <div class="dlf"><span class="body-s">{cnt} selected{!comic && ` · ${size}`}</span><span class={'btn' + (cnt && canDl ? '' : ' dis')} onClick={() => cnt && canDl && go()}><I n="download" /> Download</span></div>
      </div>
    </>
  );
}
