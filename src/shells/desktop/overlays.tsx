// Desktop overlays (prototype web Pin, DlSheet, Reader) + Downloads + Settings pages.
import { useEffect, useRef, useState } from 'preact/hooks';
import { pinPress, pinTitle, startPin } from '../../core/pin';
import { loadSeason } from '../../core/details';
import { active, cancel, dlSettings, dlStore, enqueue, finished, pause, pauseAll, resume, speeds } from '../../core/downloads';
import { pickWebFolder } from '../../core/downloads/save';
import { VERSION, DEVELOPER } from '../../core/config';
import type { Quality } from '../../core/series-settings';
import { SEEDS } from '../shared/theme';
import { useAsync } from '../mobile/ui/hooks';
import { adult, dlPop, go, library, prefs, router, setUi, toast, ui } from './state';
import { Ic } from './ui';

export function Pin() {
  const f = ui.get().pin;
  if (!f) return null;
  const close = () => {
    if (f.mode === 'enter') router.root('home');
    setUi({ pin: null });
  };
  const press = (k: string) => {
    const r = pinPress(f, k, adult);
    setUi({ pin: r.flow });
    if (r.outcome === 'unlocked') setUi({ adultOk: true });
    if (r.outcome === 'enabled') toast('Adult section enabled');
    if (r.outcome === 'disabled') (setUi({ adultOk: false }), toast('Adult section turned off'));
    if (r.outcome === 'changed') toast('PIN changed');
  };
  return (
    <div class="ov2" onClick={close}>
      <div class="sheet pin" style={{ width: 'min(340px,94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 42 }}><Ic n="shield-lock-outline" /></div>
        <h3>{pinTitle(f)}</h3>
        <div class="dd">{[0, 1, 2, 3].map((i) => <i key={i} class={i < f.buf.length ? 'on' : ''} />)}</div>
        <div class="pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'c', '0', 'b'].map((k) => <button key={k} onClick={() => (k === 'c' ? close() : press(k === 'b' ? 'back' : k))}>{k === 'c' ? 'Cancel' : k === 'b' ? <Ic n="backspace-outline" /> : k}</button>)}</div>
      </div>
    </div>
  );
}

export function DlSheet() {
  const d = ui.get().dls!;
  const u = ui.get();
  const [s, setS] = useState(1);
  const n = d.comic ? 12 : 6;
  const all = (k: number) => Object.fromEntries(Array.from({ length: k }, (_, i) => [i + 1, true]));
  const [sels, setSels] = useState<Record<number, Record<number, boolean>>>({ 1: d.comic ? {} : all(n) });
  const eps = useAsync(() => (d.t.mediaType === 'tv' && !d.comic ? loadSeason(d.t.id, s) : Promise.resolve([])), d.t.id + '|' + s);
  const sel = sels[s] || {};
  const total = Object.values(sels).reduce((a, o) => a + Object.values(o).filter(Boolean).length, 0);
  const close = () => setUi({ dls: null });
  const start = () => {
    const movie = d.t.mediaType !== 'tv' && !d.comic;
    const specs = movie
      ? [{ titleId: d.t.id, title: d.t.title, kind: 'video' as const, season: 1, episode: 1, quality: u.dq as Quality, audio: u.da, movie: true }]
      : Object.entries(sels).flatMap(([sn, o]) => Object.keys(o).filter((k) => o[+k]).map((k) => ({ titleId: d.t.id, title: d.t.title, kind: d.comic ? ('comic' as const) : ('video' as const), season: +sn, episode: +k, quality: u.dq as Quality, audio: d.comic ? 'OG' : u.da, chapter: d.comic ? 214 - (+k - 1) : undefined })));
    const c = enqueue(specs);
    close();
    if (c) dlPop('Download started · ' + c + ' item' + (c > 1 ? 's' : '') + (d.comic ? ' (PDF)' : ' · ' + u.dq + 'p'));
  };
  const list = eps.data && eps.data.length ? eps.data : Array.from({ length: 6 }, (_, i) => ({ n: i + 1, name: 'Episode ' + (i + 1) }));
  return (
    <div class="ov2" onClick={close}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Download · {d.t.title}</h3>
        {d.comic && <><div class="lbl">Chapters (saved as PDF in Comics/)</div><div class="pill">{Array.from({ length: 12 }, (_, i) => <button key={i} class={sel[i + 1] ? 'on' : ''} onClick={() => setSels({ ...sels, 1: { ...sel, [i + 1]: !sel[i + 1] } })}>Ch {214 - i}</button>)}</div></>}
        {d.t.mediaType === 'tv' && !d.comic && (
          <>
            <div class="lbl">Season (Season 1 pre-selected)</div>
            <div class="pill">{[1, 2, 3, 4, 5].map((x) => <button key={x} class={s === x ? 'on' : ''} onClick={() => setS(x)}>S{x}</button>)}</div>
            <div class="lbl">Episodes</div>
            <div class="pill">{list.map((e) => <button key={e.n} class={sel[e.n] ? 'on' : ''} onClick={() => setSels({ ...sels, [s]: { ...sel, [e.n]: !sel[e.n] } })}>{e.n}. {e.name}</button>)}</div>
          </>
        )}
        {!d.comic && (
          <>
            <div class="lbl">Quality</div>
            <div class="pill">{[2160, 1080, 720, 480, 360].map((q) => <button key={q} class={u.dq === q ? 'on' : ''} onClick={() => setUi({ dq: q })}>{q}p</button>)}</div>
            <div class="lbl">Audio (dub)</div>
            <div class="pill">{[['OG', 'Original'], ['EN', 'English dub'], ['HI', 'Hindi dub'], ['BN', 'Bangla dub'], ['ES', 'Spanish dub'], ['JA', 'Japanese dub'], ['KO', 'Korean dub']].map(([c, a]) => <button key={c} class={u.da === c ? 'on' : ''} onClick={() => setUi({ da: c })}>{a}</button>)}</div>
          </>
        )}
        <div class="btns" style={{ marginTop: 20 }}><button class="btn p" onClick={start}><Ic n="download" /> Download {d.t.mediaType === 'tv' ? total : ''}</button><button class="btn" onClick={close}>Cancel</button></div>
      </div>
    </div>
  );
}

export function Reader() {
  const st = ui.get().reader!;
  const [ch, setCh] = useState(st.ch);
  const [pg, setPg] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const t = st.t, h = (t.id * 37) % 360;
  const close = () => setUi({ reader: null });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = Math.max(1, Math.min(11, library.lastPage(t.id, ch) || 1));
    requestAnimationFrame(() => {
      const p = el.querySelector<HTMLElement>('.pn' + start);
      if (p) el.scrollTop = p.offsetTop - 70;
      setPg(start);
    });
  }, [ch]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLElement, ps = [...el.querySelectorAll<HTMLElement>('.cpn')];
    let n = 1;
    ps.forEach((p, i) => p.offsetTop - el.scrollTop < el.clientHeight / 2 && (n = i + 1));
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) n = 12;
    setPg(n);
    if (n > library.lastPage(t.id, ch)) library.setPage(t.id, ch, n);
  };
  return (
    <div class="pl" style={{ background: '#111', overflowY: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'rgba(255,255,255,.12)', zIndex: 6 }}><div style={{ height: '100%', width: (pg / 12) * 100 + '%', background: '#fff', transition: 'width .15s' }} /></div>
      <div class="pt1" style={{ zIndex: 5, background: 'linear-gradient(#000c,transparent)', left: 0, right: 0, top: 0, padding: '16px 28px' }}>
        <button class="pb" onClick={close}><Ic n="arrow-left" /></button>
        <div class="gr">{t.title} <small> Chapter {ch}</small></div>
        <button class="pb" title="Previous chapter" onClick={() => setCh(ch + 1)}><Ic n="chevron-left" /></button>
        <button class="pb" title="Next chapter" onClick={() => setCh(ch - 1)}><Ic n="chevron-right" /></button>
      </div>
      <div ref={ref} onScroll={onScroll} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '72px 0 90px' }}>
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          return (
            <div key={ch + '-' + n} class={'cpn pn' + n} style={{ width: 'min(720px,94vw)', aspectRatio: '3/4', margin: '0 auto 8px', background: '#fff', position: 'relative', overflow: 'hidden', color: '#111' }}>
              <i style={{ position: 'absolute', left: '6%', top: '5%', width: '88%', height: '42%', background: `hsl(${(h + ch * 7 + n * 30) % 360} 35% 80%)`, border: '3px solid #111' }} />
              <i style={{ position: 'absolute', left: '6%', top: '51%', width: '42%', height: '44%', background: `hsl(${(h + ch * 7 + n * 30 + 80) % 360} 30% 75%)`, border: '3px solid #111' }} />
              <i style={{ position: 'absolute', left: '52%', top: '51%', width: '42%', height: '44%', background: `hsl(${(h + ch * 7 + n * 30 + 160) % 360} 30% 78%)`, border: '3px solid #111' }} />
              <b style={{ position: 'absolute', right: 10, bottom: 8, color: '#555' }}>{n}</b>
            </div>
          );
        })}
        <div style={{ textAlign: 'center', padding: '20px' }}><button class="btn p" onClick={() => setCh(ch - 1)}>Next chapter <Ic n="chevron-right" /></button></div>
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: 'rgba(0,0,0,.75)', padding: '7px 18px', borderRadius: 999, fontWeight: 600, zIndex: 6, pointerEvents: 'none' }}>{pg} / 12</div>
    </div>
  );
}

export function Downloads() {
  const ds = dlSettings.get();
  const act = active(), done = finished();
  void dlStore;
  void speeds;
  const pick = async () => {
    const n = await pickWebFolder();
    if (n) (dlSettings.set({ root: n, label: n }), toast('Folder set: ' + n));
    else if (!('showDirectoryPicker' in window)) toast('This browser cannot pick a folder; files go to your Downloads folder.');
  };
  const row = (d: (typeof act)[number], isDone: boolean) => {
    const lab = d.kind === 'comic' ? 'Chapter ' + (214 - (d.episode - 1)) + ' · PDF' : d.kind === 'music' ? 'Music · MP3' : `S${d.season} · E${d.episode} · ${d.quality}p · ${d.audio}`;
    const p = d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0, sp = (speeds.get()[d.id] || 0) / 1048576;
    return (
      <div class="g srow" key={d.id} style={{ cursor: 'default', flexWrap: 'wrap' }}>
        <Ic n={isDone ? 'check-circle' : d.kind === 'comic' ? 'file-pdf-box' : d.kind === 'music' ? 'music-note' : 'download'} />
        <div class="gr">{d.title}
          <small>{lab} · {isDone ? 'Done' : d.restartNeeded ? 'Paused · restart needed' : Math.round(p) + '%' + (d.status === 'paused' ? ' · Paused' : ' · ' + sp.toFixed(1) + ' MB/s')}</small>
          <small style={{ opacity: 0.7, wordBreak: 'break-all' }}>{d.path}{d.savedAs ? ' → ' + d.savedAs : ''}</small>
          {!isDone && <div style={{ height: 4, background: 'var(--s3)', borderRadius: 2, marginTop: 8 }}><div style={{ height: '100%', width: p + '%', background: '#fff', borderRadius: 2 }} /></div>}
        </div>
        {!isDone && <button class="pb" title={d.status === 'paused' ? 'Resume' : 'Pause'} onClick={() => (d.status === 'paused' || d.status === 'error' ? resume(d.id) : pause(d.id))}><Ic n={d.status === 'paused' ? 'play' : 'pause'} /></button>}
        <button class="pb" title={isDone ? 'Remove from list' : 'Cancel'} onClick={() => cancel(d.id)}><Ic n="close" /></button>
      </div>
    );
  };
  return (
    <main class="page">
      <h1>Downloads</h1>
      <p class="sub">Videos save in the main folder. Comics (PDF) go in Comics/, music in Music/.</p>
      <div class="g srow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
        <Ic n="folder-outline" />
        <div class="gr">Save location<small>{ds.label || ds.root}</small><small style={{ opacity: 0.7 }}>{'showDirectoryPicker' in window ? 'Files are written for real into the folder you pick (Chrome / Edge).' : 'This browser cannot pick a folder; files go to its Downloads folder.'}</small></div>
        <button class="btn" onClick={pick}><Ic n="folder-edit-outline" /> Change folder</button>
      </div>
      <div class="g srow" style={{ cursor: 'default', flexWrap: 'wrap' }}>
        <Ic n="speedometer" />
        <div class="gr">Parallel connections<small>More connections download faster on a good network. Browsers allow about 6 per server; 16/32/64 apply fully in the Android app.</small></div>
        <div class="pill">{([16, 32, 64] as const).map((n) => <button key={n} class={ds.conn === n ? 'on' : ''} onClick={() => dlSettings.set({ conn: n })}>{n}</button>)}</div>
      </div>
      {act.length > 0 && <><div class="lbl" style={{ maxWidth: 720, display: 'flex', justifyContent: 'space-between' }}>Downloading<button onClick={() => pauseAll(!act.every((d) => d.status === 'paused'))}>{act.every((d) => d.status === 'paused') ? 'Resume all' : 'Pause all'}</button></div>{act.map((x) => row(x, false))}</>}
      {done.length > 0 && <><div class="lbl">Downloaded</div>{done.map((x) => row(x, true))}</>}
      {!act.length && !done.length && <p class="sub">No downloads yet.</p>}
    </main>
  );
}

export function Settings() {
  const p = prefs.get();
  return (
    <main class="page">
      <h1>Settings</h1>
      <p class="sub">Cinetor Web {VERSION} · {DEVELOPER}</p>
      <div class="g srow" onClick={() => prefs.set({ lg: !p.lg })}><Ic n="blur" /><div class="gr">Liquid glass<small>Translucent glass surfaces. Off = default flat theme</small></div><span class={'sw' + (p.lg ? ' on' : '')} /></div>
      <div class="g srow" style={{ cursor: 'default' }}><Ic n="palette-outline" /><div class="gr">Accent color<small>Choose a curated seed</small></div><div class="pill">{SEEDS.map(([n, c]) => <button key={c} title={n} class={p.seed === c ? 'on' : ''} onClick={() => prefs.set({ seed: c })}><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: c }} /></button>)}</div></div>
      <div class="g srow" onClick={() => setUi({ pin: startPin(adult.isOn() ? 'off' : 'set') })}><Ic n="shield-lock-outline" /><div class="gr">Adult section<small>{adult.isOn() ? 'On · PIN required every time' : 'Off · enable with a PIN'}</small></div><span class={'sw' + (adult.isOn() ? ' on' : '')} /></div>
      {adult.isOn() && <div class="g srow" onClick={() => setUi({ pin: startPin('chk') })}><Ic n="key-variant" /><div class="gr">Change PIN<small>Verify the current PIN first</small></div></div>}
      <div class="g srow" onClick={() => go('library')}><Ic n="bookmark-multiple-outline" /><div class="gr">My Library<small>Titles you saved</small></div></div>
      <div class="g srow" onClick={() => go('downloads')}><Ic n="download-circle-outline" /><div class="gr">Downloads<small>Quality and audio are remembered while the app stays open</small></div></div>
      <div class="g srow" onClick={() => (library.clearProgress(), toast('Watch progress cleared'))}><Ic n="history" /><div class="gr">Clear watch progress<small>Reset playback progress for all episodes and videos</small></div></div>
      <div class="g srow" style={{ cursor: 'default' }}><Ic n="information-outline" /><div class="gr">About<small>Version {VERSION} · {DEVELOPER}.</small></div></div>
    </main>
  );
}
