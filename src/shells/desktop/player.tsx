// Desktop player overlay (prototype web Player + mobile landscape control set, docs/05-player.md).
import { useEffect, useRef, useState } from 'preact/hooks';
import { pickChannel } from '../../core/live';
import { cancelPlay, playUrl, preserveTimestamp } from '../../core/playback';
import { useStore } from '../mobile/ui/hooks';
import { MEDIA_BASE } from '../../core/config';
import { createStore } from '../../core/store';
import { cycleFit, fmtTime, initialState, MOCK_SEASONS, next as nextR, prev as prevR, SPEEDS, QUALITIES, type PlayerState, type Seasons } from '../../core/player-model';
import { LANGS, langOf, parseVtt, simulateGeneration, subtitleCss, SUB_DEFAULT, cueAt, type Cue } from '../../core/subtitles';
import type { Quality } from '../../core/series-settings';
import { img, type Title } from '../../core/tmdb';
import { library, series, toast } from './state';
import { Ic, Sv } from './ui';
import { fetchStream, isDirectMedia } from '../../core/stream-resolver';
import { LIVE_ALL } from '../../core/live';
import { desktopTapAction } from '../../core/player-gesture';
import { playDirect } from '../../core/direct-play';
import { EmbedSession, ERR_NONE } from '../../core/embed-session';
import { sandboxFor, type Embed } from '../../core/embeds';
import { kindOf, type MediaSrc } from '../../core/sources';

export interface DPl {
  on: boolean;
  title: Title | null;
  live: string;
  st: PlayerState;
  seasons: Seasons;
  pip: boolean;
  local?: string | null;
  embedUrl?: string | null;
  loading?: boolean;
  embeds: Embed[];
  servers: MediaSrc[];
  serverIndex: number;
  server: string;
  switchToast: string | null;
}

export const dpl = createStore<DPl>(
  'd-pl',
  {
    on: false,
    title: null,
    live: '',
    st: initialState({ titleId: 0, title: '', mediaType: 'movie' }),
    seasons: MOCK_SEASONS,
    pip: false,
    embedUrl: null,
    loading: false,
    embeds: [],
    servers: [],
    serverIndex: 0,
    server: '',
    switchToast: null,
  },
  false
);

let activeVideoEl: HTMLVideoElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let stallTimer: ReturnType<typeof setTimeout> | undefined;
let playSession = 0;

function clearStallTimer() {
  if (stallTimer) {
    clearTimeout(stallTimer);
    stallTimer = undefined;
  }
}

export function play(t: Title, season = 1, episode = 1, seasons?: Seasons, local?: string) {
  clearStallTimer();
  ++playSession;
  const m = series.load(t.id), k = dpl.get().st;
  dpl.set({
    on: true,
    pip: false,
    local: local || null,
    title: t,
    live: '',
    seasons: seasons || dpl.get().seasons,
    embedUrl: null,
    embeds: [],
    loading: !local,
    servers: [],
    serverIndex: 0,
    server: '',
    switchToast: null,
    st: initialState({
      titleId: t.id,
      title: t.title,
      mediaType: t.mediaType,
      season,
      episode,
      quality: m.quality,
      audio: m.audio,
      sub: m.sub,
      speed: k.speed,
      fit: k.fit,
    }),
  });
}

// Embed players of the current title + automatic failover (core/embed-session.ts, same rules as mobile).
let session: EmbedSession | null = null;
let resolveKey = '';
if (typeof addEventListener === 'function') addEventListener('message', (e: MessageEvent) => session?.message(e.data));

function startEmbeds(list: Embed[]) {
  session?.stop();
  session = new EmbedSession(list, (v) => {
    dpl.set({ embedUrl: v.embedUrl, loading: v.loading });
    if (v.err) toast(v.err);
  });
  session.start(0);
}

function stopEmbeds() {
  session?.stop();
  session = null;
}

export function playLive(label: string) {
  clearStallTimer();
  ++playSession;
  dpl.set({
    on: true,
    pip: false,
    local: null,
    title: null,
    live: label,
    embedUrl: null,
    embeds: [],
    loading: false,
    servers: [],
    serverIndex: 0,
    server: '',
    switchToast: null,
    st: initialState({ titleId: -1, title: label, mediaType: 'live', quality: 720 }),
  });
}

/** Switch active server and seamlessly preserve playback position. */
export function switchServer(index: number, reason: 'manual' | 'failover' = 'manual'): void {
  const s = dpl.get();
  if (!s.servers || !s.servers.length) return;
  if (index < 0 || index >= s.servers.length) return;

  clearStallTimer();
  const target = s.servers[index];
  const v = activeVideoEl;
  const at = preserveTimestamp(v, library.progress(s.st.titleId, s.st.season, s.st.episode) * 120);
  const wasPlaying = s.st.playing;

  const msg = reason === 'failover' ? `Auto-failover to ${target.name}` : `Switched to ${target.name}`;
  toast(msg);

  clearTimeout(toastTimer);
  dpl.set({
    serverIndex: index,
    server: target.name,
    switchToast: msg,
    loading: true,
  });
  toastTimer = setTimeout(() => {
    if (dpl.get().switchToast === msg) dpl.set({ switchToast: null });
  }, 3000);

  stopEmbeds();
  dpl.set({ embedUrl: null });

  if (v) {
    cancelPlay(v);
    const curSession = ++playSession;
    const key = resolveKey;
    playDirect(v, [target], { at, timeoutMs: 12000, alive: () => curSession === playSession && resolveKey === key }).then(
      () => {
        if (curSession !== playSession || resolveKey !== key) return;
        dpl.set({ loading: false, serverIndex: index, server: target.name });
        if (wasPlaying && v.paused) void v.play().catch(() => {});
      },
      (err: Error) => {
        if (curSession !== playSession || err.message === 'cancelled' || resolveKey !== key) return;
        if (index + 1 < s.servers.length) {
          switchServer(index + 1, 'failover');
        } else if (s.embeds && s.embeds.length) {
          startEmbeds(s.embeds);
        } else {
          dpl.set({ loading: false });
          toast(ERR_NONE);
        }
      }
    );
  }
}

/** Automatic failover across servers on stall/error. */
export function failoverServer(reason = 'Failover'): void {
  const s = dpl.get();
  if (!s.on || s.servers.length <= 1) {
    if (s.embeds.length && !s.embedUrl) {
      startEmbeds(s.embeds);
    }
    return;
  }
  const nextIdx = s.serverIndex + 1;
  if (nextIdx < s.servers.length) {
    switchServer(nextIdx, 'failover');
  } else if (s.embeds.length && !s.embedUrl) {
    toast(`${reason} · Falling back to web player`);
    startEmbeds(s.embeds);
  } else {
    dpl.set({ loading: false });
    toast('All servers unavailable. Check connection.');
  }
}

export const nextServer = () => failoverServer('Switching server');

const cues = new Map<string, Cue[]>();
type Menu = 'q' | 'sub' | 'audio' | 'eps' | 'more' | 'server' | 'servers' | null;

export function Player() {
  const s = useStore(dpl), st = s.st;
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
    clearStallTimer();
    clearTimeout(toastTimer);
    ++playSession;
    const el = v.current;
    if (el) cancelPlay(el); // stops hls.js too and releases the decoder
    stopEmbeds();
    resolveKey = '';
    dpl.set({
      on: false,
      pip: false,
      embedUrl: null,
      loading: false,
      servers: [],
      serverIndex: 0,
      server: '',
      switchToast: null,
    });
  };

  const bump = () => {
    setHide(false);
    clearTimeout(tmr.current);
    tmr.current = setTimeout(() => setHide(true), 3500);
  };

  useEffect(() => {
    activeVideoEl = v.current;
    return () => {
      activeVideoEl = null;
    };
  }, []);

  const onPlaybackStalled = () => {
    const cur = dpl.get();
    if (!cur.on || cur.embedUrl) return;
    dpl.set({ loading: true });
    if (stallTimer) return;
    stallTimer = setTimeout(() => {
      stallTimer = undefined;
      const curState = dpl.get();
      if (curState.on && curState.st.playing && !curState.embedUrl && curState.servers.length > 1) {
        failoverServer('Buffering stall');
      }
    }, 7000);
  };

  const onPlaybackProgress = () => {
    clearStallTimer();
    const cur = dpl.get();
    if (cur.loading) dpl.set({ loading: false });
  };

  useEffect(() => {
    const el = v.current;
    if (!el) return;

    stopEmbeds();
    clearStallTimer();
    resolveKey = '';

    if (s.live) {
      const channel = pickChannel(s.live, LIVE_ALL);
      dpl.set({ loading: true });
      playUrl(el, channel?.[5] || '').then(
        () => dpl.set({ loading: false }),
        (e: Error) => e.message !== 'cancelled' && (dpl.set({ loading: false }), toast('This channel is offline right now. Try another channel.'))
      );
      return;
    }

    if (s.local) {
      if (el.src !== s.local) el.src = s.local;
      const at = library.progress(st.titleId, st.season, st.episode) * 120;
      const go = () => { if (at > 1) el.currentTime = at; if (st.playing) el.play().catch(() => {}); };
      el.readyState >= 1 ? go() : el.addEventListener('loadedmetadata', go, { once: true });
      return;
    }

    if (s.title) {
      const key = `${s.title.id}:${st.season}:${st.episode}`;
      resolveKey = key;
      cancelPlay(el);
      dpl.set({ loading: true, embedUrl: null, embeds: [], servers: [], serverIndex: 0, server: '' });

      void fetchStream(s.title.id, s.title.title, s.title.mediaType, st.season, st.episode).then((res) => {
        if (resolveKey !== key) return;
        if (!res) return (dpl.set({ loading: false }), toast('Could not load this title. Check your connection.'));

        dpl.set({ embeds: res.embeds || [] });

        const directList: MediaSrc[] = Array.isArray((res as any).servers) && (res as any).servers.length
          ? [...(res as any).servers]
          : [...(res.direct || [])];
        if (!directList.length && Array.isArray(res.sources)) {
          for (const src of res.sources) {
            if (src && src.url && isDirectMedia(src.url, (src as any).isDirect)) {
              if (!directList.some((x) => x.url === src.url)) {
                directList.push({
                  url: src.url,
                  kind: kindOf(src.url, src.type),
                  quality: src.quality || 1080,
                  name: src.name || `Server ${directList.length + 1}`,
                  headers: src.headers,
                });
              }
            }
          }
        }

        const initialServer = directList[0];
        const serverName = (res as any).server || initialServer?.name || (directList.length ? 'Server 1' : '');
        dpl.set({
          servers: directList,
          serverIndex: typeof (res as any).serverIndex === 'number' ? (res as any).serverIndex : 0,
          server: serverName,
        });

        const fallbackEmbeds = () => {
          if (res.embeds && res.embeds.length) {
            startEmbeds(res.embeds);
          } else {
            dpl.set({ loading: false });
            toast(ERR_NONE);
          }
        };

        if (!directList.length) return fallbackEmbeds();

        const at = preserveTimestamp(el, library.progress(st.titleId, st.season, st.episode) * 120);
        const curSession = ++playSession;
        playDirect(el, directList, {
          at,
          alive: () => curSession === playSession && resolveKey === key,
          onSwitchServer: (src, idx) => {
            if (curSession !== playSession || resolveKey !== key) return;
            dpl.set({ serverIndex: idx, server: src.name || `Server ${idx + 1}` });
          },
        }).then(
          (won) => {
            if (curSession !== playSession || resolveKey !== key) return;
            const wonIdx = directList.findIndex((x) => x.url === won.url);
            const activeIdx = wonIdx >= 0 ? wonIdx : 0;
            const name = won.name || directList[activeIdx]?.name || `Server ${activeIdx + 1}`;
            dpl.set({ loading: false, serverIndex: activeIdx, server: name });
            if (at > 0 && Math.abs(el.currentTime - at) > 2) el.currentTime = at;
            if (!dpl.get().st.playing) el.pause();
          },
          (e: Error) => {
            if (curSession !== playSession || e.message === 'cancelled' || resolveKey !== key) return;
            fallbackEmbeds();
          }
        );
      });
    }
  }, [st.titleId, st.season, st.episode, s.live]);

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
    onPlaybackProgress();
    if (s.title && el.duration && Math.floor(el.currentTime) % 5 === 0) library.setProgress(s.title, st.season, st.episode, el.currentTime / el.duration);
  };

  const series2 = !s.live && st.mediaType === 'tv';
  const M: Record<Exclude<Menu, null>, [string, () => void, boolean][]> = {
    q: QUALITIES.map((x) => [x + 'p', () => save({ quality: x as Quality }), st.quality === x]),
    sub: [['Off', () => save({ sub: 'Off' }), st.sub === 'Off'], ...LANGS.flatMap(([c, n]): [string, () => void, boolean][] => (cues.has(c) ? [[n, () => save({ sub: c }), st.sub === c]] : [[n + ' · generate on device', () => startGen(c), false]]))],
    audio: [['Original', 'OG'], ['English dub', 'EN'], ['Hindi dub', 'HI'], ['Bangla dub', 'BN']].map(([l, c]) => [l, () => save({ audio: c }), st.audio === c]),
    eps: Array.from({ length: s.seasons[st.season - 1] || 6 }, (_, i): [string, () => void, boolean] => ['Season ' + st.season + ' · Episode ' + (i + 1), () => save({ episode: i + 1 }), st.episode === i + 1]),
    server: s.servers.length
      ? s.servers.map((srv, i): [string, () => void, boolean] => [
          srv.name || `Server ${i + 1} (${srv.quality ? srv.quality + 'p' : 'Auto'})`,
          () => switchServer(i, 'manual'),
          s.serverIndex === i,
        ])
      : [['Server 1 (Default)', () => {}, true]],
    servers: s.servers.length
      ? s.servers.map((srv, i): [string, () => void, boolean] => [
          srv.name || `Server ${i + 1} (${srv.quality ? srv.quality + 'p' : 'Auto'})`,
          () => switchServer(i, 'manual'),
          s.serverIndex === i,
        ])
      : [['Server 1 (Default)', () => {}, true]],
    more: [
      ['Audio delay −100 ms', () => set({ audioDelayMs: st.audioDelayMs - 100 }), false], ['Audio delay +100 ms (' + st.audioDelayMs + ')', () => set({ audioDelayMs: st.audioDelayMs + 100 }), false],
      ['Subtitle delay −100 ms', () => set({ subDelayMs: st.subDelayMs - 100 }), false], ['Subtitle delay +100 ms (' + st.subDelayMs + ')', () => set({ subDelayMs: st.subDelayMs + 100 }), false],
      ['Background play', () => set({ bgPlay: !st.bgPlay }), st.bgPlay], ['Decoder: ' + (st.hwDecoder ? 'HW' : 'SW'), () => set({ hwDecoder: !st.hwDecoder }), false],
      ...('pictureInPictureEnabled' in document ? [['Browser picture-in-picture', () => void v.current?.requestPictureInPicture().catch(() => {}), false] as [string, () => void, boolean]] : []),
    ],
  };

  const c = cueAt(cues.get(st.sub) || [], pos - st.subDelayMs / 1000), css = subtitleCss(SUB_DEFAULT, 'l');

  // prototype web Player: a mouse click on the picture toggles play; a touch tap toggles the controls
  const ptype = useRef('mouse');
  const handlePlayerClick = (e: MouseEvent) => {
    const tg = e.target as HTMLElement;
    if (tg.closest('button, .pb, .menu, .sk, .rw, input, select')) return bump();
    if (s.pip) return;
    if (st.locked) return bump();
    if (desktopTapAction(ptype.current) === 'play') return (set({ playing: !dpl.get().st.playing }), bump());
    if (hide) bump();
    else (clearTimeout(tmr.current), setHide(true));
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});

  const bgImg = s.title?.backdrop ? `url(${img(s.title.backdrop, 'w1280')})` : undefined;
  const pipStyle = s.pip ? 'inset:auto;right:20px;bottom:20px;width:360px;height:203px;border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.7)' : '';

  return (
    <div class={'pl' + (hide ? ' hide' : '')} style={pipStyle} onMouseMove={bump}
      onPointerDown={(e) => (ptype.current = e.pointerType)} onClick={handlePlayerClick}>
      <div class={'vid real fit-' + st.fit} style={{ backgroundImage: bgImg, position: 'relative' }}>
        {s.embedUrl ? (
          <iframe
            key={s.embedUrl}
            src={s.embedUrl}
            style="width:100%;height:100%;border:none;position:absolute;inset:0;pointer-events:none;z-index:0;"
            allowFullScreen
            allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"
            sandbox={sandboxFor(s.embedUrl, false)}
            onLoad={() => session?.loaded()}
          />
        ) : null}
        {/* Native video element: always mounted and stays on top for direct streams */}
        <video
          ref={v}
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            opacity: s.embedUrl ? 0 : 1,
          }}
          onTimeUpdate={timeUpd}
          onLoadedMetadata={() => setDur(v.current!.duration)}
          onEnded={() => (series2 ? ep(nextR) : set({ playing: false }))}
          onWaiting={onPlaybackStalled}
          onStalled={onPlaybackStalled}
          onCanPlay={onPlaybackProgress}
          onPlaying={() => {
            clearStallTimer();
            dpl.set({ loading: false });
            set({ playing: true });
          }}
          onPause={() => clearStallTimer()}
          onError={() => {
            clearStallTimer();
            const cur = dpl.get();
            if (!cur.on || cur.local || cur.live) return;
            if (cur.servers.length > 1 && cur.serverIndex < cur.servers.length - 1) {
              failoverServer('Playback error');
            } else if (cur.embeds.length && !cur.embedUrl) {
              startEmbeds(cur.embeds);
            }
          }}
        />
        {s.loading && (
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,6,10,0.85);z-index:3;gap:12px;pointer-events:none;">
            <div style="width:48px;height:48px;border:3.5px solid rgba(255,255,255,0.15);border-top-color:#38bdf8;border-right-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;box-shadow:0 0 20px rgba(56,189,248,0.35);" />
            <span style="font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;letter-spacing:0.3px;">Loading stream…</span>
          </div>
        )}
      </div>

      {c && !st.locked && <div class="psub" style={css.pos}><span style={css.span}>{c.text}</span></div>}

      {/* Switch Toast HUD Banner */}
      {s.switchToast && (
        <div
          class="lvl"
          style="top:84px;background:rgba(20,20,24,0.9);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.18);color:#fff;font-weight:600;font-size:13.5px;box-shadow:0 8px 24px rgba(0,0,0,0.5);pointer-events:none;gap:8px"
        >
          <Ic n="server" />
          <span>{s.switchToast}</span>
        </div>
      )}

      {s.pip ? (
        <div class="ui">
          <div class="pt1">
            <button class="pb" onClick={() => dpl.set({ pip: false })}><Ic n="arrow-expand" /></button>
            <div class="gr" />
            <button class="pb" onClick={() => set({ playing: !st.playing })}><Ic n={st.playing ? 'pause' : 'play'} /></button>
            <button class="pb" onClick={close}><Ic n="close" /></button>
          </div>
        </div>
      ) : st.locked ? (
        <div class="ui">
          <div class="pmid" style="left:24px;right:auto">
            <button class="pb on" onClick={() => set({ locked: false })}><Ic n="lock" /></button>
          </div>
        </div>
      ) : (
        <div class="ui">
          <div class="pt1">
            <button class="pb" onClick={close}><Ic n="arrow-left" /></button>
            <div class="gr">
              {s.live || st.title} {!s.live && st.mediaType === 'tv' && <small> S{st.season} · E{st.episode}</small>}
            </div>
            {gen && (
              <span class="pb on" style="width:auto;padding:0 14px;font-size:14px;border-radius:999px">
                <Ic n="creation" /> Generating {langOf(gen.c)[1]} {gen.p}%
              </span>
            )}

            {/* Server Pill */}
            {!s.live && s.servers.length > 0 && (
              <button
                class="pb"
                style="width:auto;min-width:44px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px"
                title="Switch Server"
                onClick={() => setMenu(menu === 'server' ? null : 'server')}
              >
                <Ic n="server" />
                <span>{s.server || s.servers[s.serverIndex]?.name || 'Server'}</span>
              </button>
            )}

            <button class="pb" title="Quality" onClick={() => setMenu(menu === 'q' ? null : 'q')}>HD</button>
            <button class="pb" onClick={() => set({ speed: SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length] })}>{st.speed}×</button>
            <button class="pb" title="Picture in picture" onClick={() => dpl.set({ pip: true })}><Ic n="picture-in-picture-bottom-right" /></button>
            <button class="pb" title="Fullscreen" onClick={fullscreen}><Ic n="fullscreen" /></button>
            <button class="pb" title="More" onClick={() => setMenu(menu === 'more' ? null : 'more')}><Ic n="dots-vertical" /></button>
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
              <button class="pb" title="Subtitles" onClick={() => setMenu(menu === 'sub' ? null : 'sub')}>
                <Ic n={st.sub === 'Off' ? 'subtitles-outline' : 'subtitles'} />
              </button>
              <button class="pb" title="Audio" onClick={() => setMenu(menu === 'audio' ? null : 'audio')}>
                <Ic n="waveform" />
              </button>
              {!s.live && s.servers.length > 0 && (
                <button
                  class={'pb' + (menu === 'server' ? ' on' : '')}
                  title="Switch Server"
                  onClick={() => setMenu(menu === 'server' ? null : 'server')}
                >
                  <Ic n="server" />
                </button>
              )}
              <button class={'pb' + (st.fit !== 'Fit' ? ' on' : '')} title="Resize" onClick={() => set({ fit: cycleFit(st).fit })}>
                <Ic n="aspect-ratio" />
              </button>
              {series2 && (
                <>
                  <button class="pb" title="Episodes" onClick={() => setMenu(menu === 'eps' ? null : 'eps')}><Ic n="playlist-play" /></button>
                  <button class="pb" onClick={() => ep(prevR)}><Ic n="skip-previous" /></button>
                  <button class="pb" onClick={() => ep(nextR)}><Ic n="skip-next" /></button>
                </>
              )}
            </div>
            <div
              class="sk"
              onClick={(e) => {
                e.stopPropagation();
                if (s.live || !v.current) return;
                const wasPlaying = !v.current.paused;
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                v.current.currentTime = ((e.clientX - r.left) / r.width) * dur;
                if (wasPlaying && v.current.paused) void v.current.play().catch(() => {});
              }}
            >
              <b style={{ width: (s.live ? 100 : dur ? (pos / dur) * 100 : 0) + '%' }} />
            </div>
            <div class="tm">
              <span>{s.live ? 'LIVE' : fmtTime(pos)}</span>
              <span>{s.live ? '' : fmtTime(dur)}</span>
            </div>
          </div>

          {menu && (
            <div class="menu" onClick={(e) => e.stopPropagation()}>
              {M[menu].map(([l, f, on]) => (
                <button key={l} onClick={() => (f(), menu !== 'more' && !l.includes('generate') && setMenu(null))}>
                  {l}
                  {on && <Ic n="check" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
