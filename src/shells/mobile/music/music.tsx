// Music (prototype V.music, V.nowplaying): genre chips, tiles, Made for you, Recently played, Browse all, mini player.
import { useEffect, useState } from 'preact/hooks';
import { genrePlaylists, MADE_FOR_YOU, MUSIC_GENRES, NOW_DEFAULT, RECENT, TILES, trackUrl } from '../../../core/music';
import { dlId, dlStore, enqueue } from '../../../core/downloads';
import { createStore } from '../../../core/store';
import { hashS } from '../../../core/sports';
import { fmtTime } from '../../../core/player-model';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { MenuBtn } from '../ui/common';
import { back, dlPop, nav, opt, param, setOpt, toast } from '../state';

export const music = createStore('music', { title: NOW_DEFAULT.title, hue: NOW_DEFAULT.hue, playing: false, pos: 0, dur: 0 }, false);
let audio: HTMLAudioElement | null = null;
function el() {
  if (audio) return audio;
  audio = new Audio();
  audio.addEventListener('timeupdate', () => music.set({ pos: audio!.currentTime, dur: audio!.duration || 0 }));
  audio.addEventListener('ended', () => music.set({ playing: false }));
  return audio;
}
export function playTrack(title: string, hue: number) {
  const a = el();
  if (music.get().title !== title || !a.src) a.src = trackUrl(title);
  a.play().catch(() => {});
  music.set({ title, hue, playing: true });
}
export function toggleMusic() {
  const a = el(), m = music.get();
  if (m.playing) a.pause();
  else if (!a.src) return playTrack(m.title, m.hue);
  else a.play().catch(() => {});
  music.set({ playing: !m.playing });
}
const open = (title: string, hue: number) => (playTrack(title, hue), nav('nowplaying', { title, hue }));

export function Music() {
  const g = opt('cat_music') || 'All';
  const m = useStore(music);
  const chips = <div class="opts cat" style="padding:0;flex:1">{['All', ...MUSIC_GENRES].map((o) => <span key={o} class={o === g ? 'on' : ''} onClick={() => setOpt('cat_music', o)}>{o}</span>)}</div>;
  const body =
    g === 'All' ? (
      <>
        <div class="tiles">{TILES.map((x) => <div key={x.title} class="tile" style={`--h:${x.hue}`} onClick={() => open(x.title, x.hue)}><u><I n={x.icon!} /></u>{x.title}</div>)}</div>
        <h4>Made for you</h4>
        <div class="covers">{MADE_FOR_YOU.map((x) => <div key={x.title} class="cv" style={`--h:${x.hue}`} onClick={() => open(x.title, x.hue)}><u /><b>{x.title}</b><small>{x.sub}</small></div>)}</div>
        <h4>Recently played</h4>
        <div class="covers">{RECENT.map((x) => <div key={x.title} class="cv r" style={`--h:${x.hue};width:104px`} onClick={() => open(x.title, x.hue)}><u style="width:104px;height:104px" /><b>{x.title}</b><small>Artist</small></div>)}</div>
        <h4>Browse all</h4>
        <div class="bro">{MUSIC_GENRES.map((x, i) => <div key={x} style={`--h:${(i * 47) % 360}`} onClick={() => setOpt('cat_music', x)}>{x}</div>)}</div>
      </>
    ) : (
      <>
        <h4>{g}</h4>
        <div class="cvg">{genrePlaylists(g).map((x) => <div key={x.title} class="cv" style={`--h:${x.hue}`} onClick={() => open(x.title, x.hue)}><u /><b>{x.title}</b><small>{x.sub}</small></div>)}</div>
      </>
    );
  return (
    <div class="sp" style="flex:1;display:flex;flex-direction:column;min-height:0">
      <div class="menu-top" style="padding-top:10px"><MenuBtn />{chips}</div>
      <div class="scroll" style="padding-bottom:70px">{body}</div>
      <div class="mini" style={`--h:${m.hue}`} onClick={() => nav('nowplaying', { title: m.title, hue: m.hue })}>
        <u /><div>{m.title}<small>{NOW_DEFAULT.artist}</small></div><I n="heart-outline" />
        <span onClick={(e) => (e.stopPropagation(), toggleMusic())}><I n={m.playing ? 'pause' : 'play'} /></span>
        <i class="p" style={m.dur ? `width:${(m.pos / m.dur) * 100}%` : ''} />
      </div>
    </div>
  );
}

export function NowPlaying() {
  const m = useStore(music);
  useStore(dlStore);
  const t = param<string>('title') || m.title, h = param<number>('hue') ?? m.hue;
  const id = dlId('music', hashS(t), 1, 1), has = !!dlStore.get().items[id];
  const [, s] = useState(0);
  useEffect(() => void s(1), []);
  const pct = m.dur ? (m.pos / m.dur) * 100 : 34;
  return (
    <div class="np" style={`--h:${h}`}>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="ibtn" role="button" onClick={back}><I n="chevron-down" /></div><div class="label">PLAYING FROM PLAYLIST</div><div class="ibtn"><I n="dots-vertical" /></div>
      </div>
      <div class="art" />
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:22px;font-weight:700">{t}</div><div style="color:#b3b3b3">{NOW_DEFAULT.artist}</div></div>
        <span style="font-size:26px;color:#1ed760" onClick={() => toast('Added to Liked Songs')}><I n="heart" /></span>
        <span style="font-size:26px;margin-left:12px" onClick={() => {
          if (has) return;
          enqueue([{ titleId: hashS(t), title: t, kind: 'music', season: 1, episode: 1, quality: 1080, audio: 'OG' }]);
          dlPop('Download started · Music');
        }}><I n={has ? 'check-circle-outline' : 'download-outline'} /></span>
      </div>
      <div class="trk"><b style={`width:${pct}%`} /></div>
      <div class="tm"><span>{fmtTime(m.pos)}</span><span>{fmtTime(m.dur || 60)}</span></div>
      <div class="ctrl">
        <span><I n="shuffle-variant" /></span><span onClick={() => (el().currentTime = 0)}><I n="skip-previous" /></span>
        <span class="big" onClick={() => (m.title === t ? toggleMusic() : playTrack(t, h))}><I n={m.playing && m.title === t ? 'pause' : 'play'} /></span>
        <span><I n="skip-next" /></span><span><I n="repeat" /></span>
      </div>
    </div>
  );
}
NowPlaying.bare = true;
