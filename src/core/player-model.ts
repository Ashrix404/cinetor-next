// Playback state machine (no DOM). docs/05-player.md §State.
import type { Quality } from './series-settings';

export type Speed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
export const SPEEDS: Speed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const QUALITIES: Quality[] = [2160, 1080, 720, 480, 360];
export type Fit = 'Fit' | 'Fill' | 'Zoom';
export const FITS: Fit[] = ['Fit', 'Fill', 'Zoom'];

export interface PlayerState {
  titleId: number; title: string; mediaType: 'movie' | 'tv' | 'live';
  season: number; episode: number;
  pos: number; dur: number; playing: boolean; speed: Speed;
  quality: Quality;
  audio: string; sub: string;
  fit: Fit; locked: boolean; bgPlay: boolean;
  mode: 'inline' | 'fullscreen' | 'pip';
  audioDelayMs: number; subDelayMs: number; hwDecoder: boolean;
  server: number;
}

/** Season layout: episodes per season (index 0 = season 1). Mock default: 3 × 6. */
export type Seasons = number[];
export const MOCK_SEASONS: Seasons = [6, 6, 6];

export function initialState(p: Partial<PlayerState> & Pick<PlayerState, 'titleId' | 'title' | 'mediaType'>): PlayerState {
  return {
    season: 1, episode: 1, pos: 0, dur: 120, playing: true, speed: 1, quality: 1080, audio: 'OG', sub: 'Off',
    fit: 'Fit', locked: false, bgPlay: false, mode: 'inline', audioDelayMs: 0, subDelayMs: 0, hwDecoder: true, server: 1,
    ...p,
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const play = (s: PlayerState): PlayerState => ({ ...s, playing: true });
export const pause = (s: PlayerState): PlayerState => ({ ...s, playing: false });
export const toggle = (s: PlayerState): PlayerState => ({ ...s, playing: !s.playing });
export const seekBy = (s: PlayerState, d: number): PlayerState => ({ ...s, pos: clamp(s.pos + d, 0, s.dur) });
export const seekTo = (s: PlayerState, t: number): PlayerState => ({ ...s, pos: clamp(t, 0, s.dur) });

/** Prototype `nextEp`: next episode, crossing into the next season; stops after the last. */
export function next(s: PlayerState, seasons: Seasons = MOCK_SEASONS): PlayerState {
  if (s.mediaType !== 'tv') return s;
  const eps = seasons[s.season - 1] || 1;
  if (s.episode < eps) return { ...s, episode: s.episode + 1, pos: 0 };
  if (s.season < seasons.length) return { ...s, season: s.season + 1, episode: 1, pos: 0 };
  return { ...s, playing: false, pos: s.dur };
}

/** Prototype `prevEp`: restart when > 8 s in, else previous episode, crossing seasons. */
export function prev(s: PlayerState, seasons: Seasons = MOCK_SEASONS): PlayerState {
  if (s.pos > 8 || s.mediaType !== 'tv') return { ...s, pos: 0 };
  if (s.episode > 1) return { ...s, episode: s.episode - 1, pos: 0 };
  if (s.season > 1) return { ...s, season: s.season - 1, episode: seasons[s.season - 2] || 1, pos: 0 };
  return { ...s, pos: 0 };
}

export const hasNext = (s: PlayerState, seasons: Seasons = MOCK_SEASONS) => s.mediaType === 'tv' && (s.episode < (seasons[s.season - 1] || 1) || s.season < seasons.length);

export const setQuality = (s: PlayerState, q: Quality): PlayerState => ({ ...s, quality: q });
export const setSub = (s: PlayerState, sub: string): PlayerState => ({ ...s, sub });
export const setAudio = (s: PlayerState, audio: string): PlayerState => ({ ...s, audio });
export const setSpeed = (s: PlayerState, speed: Speed): PlayerState => ({ ...s, speed });
export const cycleFit = (s: PlayerState): PlayerState => ({ ...s, fit: FITS[(FITS.indexOf(s.fit) + 1) % FITS.length] });
export const lock = (s: PlayerState, on = !s.locked): PlayerState => ({ ...s, locked: on });
export const pip = (s: PlayerState, on = s.mode !== 'pip'): PlayerState => ({ ...s, mode: on ? 'pip' : 'inline', locked: false });
export const fullscreen = (s: PlayerState, on = s.mode !== 'fullscreen'): PlayerState => ({ ...s, mode: on ? 'fullscreen' : 'inline' });
export const delay = (s: PlayerState, which: 'audio' | 'sub', d: number): PlayerState =>
  which === 'audio' ? { ...s, audioDelayMs: s.audioDelayMs + d } : { ...s, subDelayMs: s.subDelayMs + d };

export function fmtTime(sec: number): string {
  const x = Math.max(0, Math.floor(sec));
  const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = x % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
}

/** Seconds to jump for a horizontal drag of `dx` px on a `width` px player (full width ≈ 2 min). */
export const seekDelta = (dx: number, width: number) => Math.round((dx / Math.max(1, width)) * 120);
