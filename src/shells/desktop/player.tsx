// Desktop player overlay (prototype web Player + mobile landscape control set, docs/05-player.md).
import { useEffect, useRef, useState } from 'preact/hooks';
import { MEDIA_BASE } from '../../core/config';
import { createStore } from '../../core/store';
import { clipFor, cycleFit, fmtTime, initialState, MOCK_SEASONS, next as nextR, prev as prevR, SPEEDS, QUALITIES, type PlayerState, type Seasons } from '../../core/player-model';
import { LANGS, langOf, parseVtt, simulateGeneration, subtitleCss, SUB_DEFAULT, cueAt, type Cue } from '../../core/subtitles';
import type { Quality } from '../../core/series-settings';
import { img, type Title } from '../../core/tmdb';
import { library, series, toast } from './state';
import { Ic, Sv } from './ui';
import { fetchStream } from '../../core/stream-resolver';

interface DPl { on: boolean; title: Title | null; live: string; st: PlayerState; seasons: Seasons; pip: boolean; local?: string | null }
export const dpl = createStore<DPl>('d-pl', { on: false, title: null, live: '', st: initialState({ titleId: 0, title: '', mediaType: 'movie' }), seasons: MOCK_SEASONS, pip: false }, false);

export function play(t: Title, season = 1, episode = 1, seasons?: Seasons, local?: string) {
  const m = series.load(t.id), k = dpl.get().st;
  dpl.set({ on: true, pip: false, local: local || null, title: t, live: '', seasons: seasons || dpl.get().seasons, st: initialState({ titleId: t.id, title: t.title, mediaType: t.mediaType, season, episode, quality: m.quality, audio: m.audio, sub: m.sub, speed: k.speed, fit: k.fit }) });
}
export function playLive(label: string) {
  dpl.set({ on: true, pip: false, local: null, title: null, live: label, st: initialState({ titleId: -1, title: label, mediaType: 'live', quality: 720 }) });
}

const cues = new Map<string, Cue[]>();
type Menu = 'q' | 'sub' | 'audio' | 'eps' | 'server' | 'more' | null;

export function Player() {
  const s = dpl.get(), st = s.st;
  const v = useRef<HTMLVideoElement>(null);
  const [hide, setHide] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [gen, setGen] = useState<{ c: string; p: number } | null>(null);
  const [, bumpCues] = useState(0);
  const tmr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const set = (p: Partial<PlayerState>) => dpl.set({ st: { ...dpl.get().st, ...p } });
  const save = (p: Partial<PlayerState>) => {
    set(p);
    const n = dpl.get();
    if (n.title) series.save(n.title.id, { quality: n.st.quality, audio: n.st.audio, sub: n.st.sub });
  };
  const close = () => {
    const el = v.current;
    if (el) (el.pause(), el.removeAttribute('src'), el.load());
    dpl.set({ on: false, pip: false });
  };
  const bump = () => {
    setHide(false);
    clearTimeout(tmr.current);
    tmr.current = setTimeout(() => setHide(true), 3500);
  };
  // source + resume
  const src = s.local || MEDIA_BASE + clipFor(st.quality);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const at = el.src === src ? el.currentTime : s.title ? library.progress(s.title.id, st.season, st.episode) * 120 : 0;
    if (el.src !== src) el.src = src;
    const go = () => {
      if (at > 1 && at < 118) el.currentTime = at;
      el.playbackRate = st.speed;
      if (st.playing) el.play().catch(() => set({ playing: false }));
    };
    el.readyState >= 1 ? go() : el.addEventListener('loadedmetadata', go, { once: true });

    if (s.title && !s.local) {
      void fetchStream(s.title.id, s.title.title, s.title.mediaType, st.season, st.episode).then((res) => {
        if (res?.url && el) {
          const cur = el.currentTime || at;
          el.src = res.url;
          el.currentTime = cur;
          if (st.playing) el.play().catch(() => {});
        }
      });
    }
  }, [src, st.titleId, st.season, st.episode]);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    st.playing ? el.play().catch(() => {}) : el.pause();
    el.playbackRate = st.speed;
  }, [st.playing, st.speed]);
  useEffect(() => {
    if (st.sub === 'Off' || cues.has(st.sub)) return;
    fetch(MEDIA_BASE + 'subtitles/' + st.sub + '.vtt').then((r) => r.text()).then((t) => (cues.set(st.sub, parseVtt(t)), bumpCues((n) => n + 1))).catch(() => {});
  }, [st.sub]);
  const seek = (d: number) => v.current && (v.current.currentTime = Math.max(0, Math.min(dur, v.current.currentTime + d)));
  const ep = (fn: typeof nextR) => {
    const n = fn({ ...dpl.get().st, pos }, s.seasons);
    if (n.season !== st.season || n.episode !== st.episode) save({ season: n.season, episode: n.episode, pos: 0 });
    else if (v.current) v.current.currentTime = 0;
  };
  useEffect(() => {
    bump();
    const k = (e: KeyboardEvent) => {
      bump();
      if (e.key === 'Escape') return menu ? setMenu(null) : close();
      if (st.locked) return;
      if (e.key === ' ') (e.preventDefault(), set({ playing: !dpl.get().st.playing }));
      if (e.key === 'ArrowRight') seek(10);
      if (e.key === 'ArrowLeft') seek(-10);
    };
    addEventListener('keydown', k);
    return () => (removeEventListener('keydown', k), clearTimeout(tmr.current));
  }, [menu, st.locked, dur]);
  const startGen = (c: string) => {
    setMenu(null);
    setGen({ c, p: 0 });
    simulateGeneration(c, (p) => setGen({ c, p })).then((t) => {
      cues.set(c, parseVtt(t));
      setGen(null);
      save({ sub: c });
      toast(langOf(c)[1] + ' subtitles ready');
    });
  };
  const timeUpd = () => {
    const el = v.current!;
    setPos(el.currentTime);
    if (s.title && el.duration && Math.floor(el.currentTime) % 5 === 0) library.setProgress(s.title, st.season, st.episode, el.currentTime / el.duration);
  };
  const series2 = !s.live && st.mediaType === 'tv';
  const M: Record<Exclude<Menu, null>, [string, () => void, boolean][]> = {
    q: QUALITIES.map((x) => [x + 'p', () => save({ quality: x as Quality }), st.quality === x]),
    sub: [['Off', () => save({ sub: 'Off' }), st.sub === 'Off'], ...LANGS.flatMap(([c, n]): [string, () => void, boolean][] => (cues.has(c) ? [[n, () => save({ sub: c }), st.sub === c]] : [[n + ' · generate on device', () => startGen(c), false]]))],
    audio: [['Original', 'OG'], ['English dub', 'EN'], ['Hindi dub', 'HI'], ['Bangla dub', 'BN']].map(([l, c]) => [l, () => save({ audio: c }), st.audio === c]),
    eps: Array.from({ length: s.seasons[st.season - 1] || 6 }, (_, i): [string, () => void, boolean] => ['Season ' + st.season + ' · Episode ' + (i + 1), () => save({ episode: i + 1 }), st.episode === i + 1]),
    server: [1, 2, 3].map((n) => ['Server ' + n, () => set({ server: n }), st.server === n]),
    more: [
      ['Audio delay −100 ms', () => set({ audioDelayMs: st.audioDelayMs - 100 }), false], ['Audio delay +100 ms (' + st.audioDelayMs + ')', () => set({ audioDelayMs: st.audioDelayMs + 100 }), false],
      ['Subtitle delay −100 ms', () => set({ subDelayMs: st.subDelayMs - 100 }), false], ['Subtitle delay +100 ms (' + st.subDelayMs + ')', () => set({ subDelayMs: st.subDelayMs + 100 }), false],
      ['Background play', () => set({ bgPlay: !st.bgPlay }), st.bgPlay], ['Decoder: ' + (st.hwDecoder ? 'HW' : 'SW'), () => set({ hwDecoder: !st.hwDecoder }), false],
      ...('pictureInPictureEnabled' in document ? [['Browser picture-in-picture', () => void v.current?.requestPictureInPicture().catch(() => {}), false] as [string, () => void, boolean]] : []),
    ],
  };
  const c = cueAt(cues.get(st.sub) || [], pos - st.subDelayMs / 1000), css = subtitleCss(SUB_DEFAULT, 'l');
  const bgImg = s.title?.backdrop ? `url(${img(s.title.backdrop, 'w1280')})` : undefined;
  const pipStyle = s.pip ? 'inset:auto;right:20px;bottom:20px;width:360px;height:203px;border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.7)' : '';
  return (
    <div class={'pl' + (hide ? ' hide' : '')} style={pipStyle} onMouseMove={bump}
      onClick={(e) => { const tg = e.target as HTMLElement; if (tg === e.currentTarget || tg.tagName === 'VIDEO') set({ playing: !st.playing }); }}>
      <div class={'vid real fit-' + st.fit} style={{ backgroundImage: bgImg }}>
        <video ref={v} playsInline crossOrigin="anonymous" onTimeUpdate={timeUpd} onLoadedMetadata={() => setDur(v.current!.duration)} onEnded={() => (series2 ? ep(nextR) : set({ playing: false }))} />
      </div>
      {c && !st.locked && <div class="psub" style={css.pos}><span style={css.span}>{c.text}</span></div>}
      {s.pip ? (
        <div class="ui"><div class="pt1"><button class="pb" onClick={() => dpl.set({ pip: false })}><Ic n="arrow-expand" /></button><div class="gr" /><button class="pb" onClick={() => set({ playing: !st.playing })}><Ic n={st.playing ? 'pause' : 'play'} /></button><button class="pb" onClick={close}><Ic n="close" /></button></div></div>
      ) : st.locked ? (
        <div class="ui"><div class="pmid" style="left:24px;right:auto"><button class="pb on" onClick={() => set({ locked: false })}><Ic n="lock" /></button></div></div>
      ) : (
        <div class="ui">
          <div class="pt1">
            <button class="pb" onClick={close}><Ic n="arrow-left" /></button>
            <div class="gr">{s.live || st.title} {!s.live && st.mediaType === 'tv' && <small> S{st.season} · E{st.episode}</small>}</div>
            {gen && <span class="pb on" style="width:auto;padding:0 14px;font-size:14px;border-radius:999px"><Ic n="creation" /> Generating {langOf(gen.c)[1]} {gen.p}%</span>}
            <button class="pb" title="Quality" onClick={() => setMenu('q')}>HD</button>
            <button class="pb" onClick={() => set({ speed: SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length] })}>{st.speed}×</button>
            <button class="pb" title="Picture in picture" onClick={() => dpl.set({ pip: true })}><Ic n="picture-in-picture-bottom-right" /></button>
            <button class="pb" title="More" onClick={() => setMenu('more')}><Ic n="dots-vertical" /></button>
          </div>
          <div class="pmid" style="justify-content:space-between;left:24px;right:24px">
            <button class="pb" title="Lock" onClick={() => set({ locked: true })}><Ic n="lock-open-variant-outline" /></button>
            <div style="display:flex;gap:28px;align-items:center">
              <button class="pb" onClick={() => seek(-10)}><Sv n="rew10" /></button>
              <button class="pb big" onClick={() => set({ playing: !st.playing })}><Ic n={st.playing ? 'pause' : 'play'} /></button>
              <button class="pb" onClick={() => seek(10)}><Sv n="fwd10" /></button>
            </div>
            <button class={'pb' + (st.bgPlay ? ' on' : '')} title="Background play" onClick={() => set({ bgPlay: !st.bgPlay })}><Ic n="headphones" /></button>
          </div>
          <div class="pbt">
            <div class="rw">
              <button class="pb" onClick={() => setMenu('sub')}><Ic n={st.sub === 'Off' ? 'subtitles-outline' : 'subtitles'} /></button>
              <button class="pb" onClick={() => setMenu('audio')}><Ic n="waveform" /></button>
              <button class={'pb' + (st.fit !== 'Fit' ? ' on' : '')} onClick={() => set({ fit: cycleFit(st).fit })}><Ic n="aspect-ratio" /></button>
              <button class="pb" onClick={() => setMenu('server')}><Ic n="server" /></button>
              {series2 && <><button class="pb" onClick={() => setMenu('eps')}><Ic n="playlist-play" /></button><button class="pb" onClick={() => ep(prevR)}><Ic n="skip-previous" /></button><button class="pb" onClick={() => ep(nextR)}><Ic n="skip-next" /></button></>}
            </div>
            <div class="sk" onClick={(e) => { if (s.live || !v.current) return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); v.current.currentTime = ((e.clientX - r.left) / r.width) * dur; }}><b style={{ width: (s.live ? 100 : dur ? (pos / dur) * 100 : 0) + '%' }} /></div>
            <div class="tm"><span>{s.live ? 'LIVE' : fmtTime(pos)}</span><span>{s.live ? '' : fmtTime(dur)}</span></div>
          </div>
          {menu && <div class="menu" onClick={(e) => e.stopPropagation()}>{M[menu].map(([l, f, on]) => <button key={l} onClick={() => (f(), menu !== 'more' && !l.includes('generate') && setMenu(null))}>{l}{on && <Ic n="check" />}</button>)}</div>}
        </div>
      )}
    </div>
  );
}
