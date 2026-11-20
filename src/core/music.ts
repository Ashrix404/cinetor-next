// Mock music (prototype V.music / V.nowplaying). Tracks play media/music/track-N.mp3.
import { GEN } from './catalog';
import { MEDIA_BASE } from './config';

export interface Playlist { title: string; hue: number; sub?: string; icon?: string }

export const TILES: Playlist[] = [
  { title: 'Liked Songs', hue: 280, icon: 'heart' }, { title: 'Daily Mix 1', hue: 160, icon: 'music-note' }, { title: 'Chill Hits', hue: 200, icon: 'weather-night' },
  { title: 'Late Night Drive', hue: 330, icon: 'car' }, { title: 'Focus Flow', hue: 100, icon: 'headphones' }, { title: 'Road Trip', hue: 30, icon: 'map-marker-path' },
];
export const MADE_FOR_YOU: Playlist[] = [
  { title: 'Discover Weekly', sub: 'Fresh picks for you', hue: 150 }, { title: 'Release Radar', sub: 'New music from artists', hue: 280 }, { title: 'Daily Mix 2', sub: 'Nova Reed, Ayla, Mono Harbor', hue: 20 },
];
export const RECENT: Playlist[] = [{ title: 'Nova Reed', hue: 200 }, { title: 'Quiet Engines', hue: 330 }, { title: 'Ayla', hue: 60 }, { title: 'Mono Harbor', hue: 270 }];
export const NOW_DEFAULT = { title: 'Static Bloom', artist: 'Nova Reed', hue: 290 };
export const MUSIC_GENRES = GEN.music;

const W1 = ['Silent', 'Crimson', 'Hollow', 'Golden', 'Midnight', 'Iron', 'Glass', 'Paper', 'Salt', 'Ember', 'Velvet', 'Northern'];
const W2 = ['Harbor', 'Orchard', 'Gate', 'Ledger', 'Court', 'Tide', 'Lantern', 'Station', 'Meridian', 'Garden'];
/** Playlists for a genre chip (prototype: POOL(11) spread by genre index, 10 items). */
export function genrePlaylists(genre: string): Playlist[] {
  const list = GEN.music, n = list.length, ci = list.indexOf(genre);
  if (ci < 0) return [];
  const pool = Array.from({ length: 84 }, (_, i) => ({ title: W1[i % 12] + ' ' + W2[(Math.floor(i / 12) + 11) % 10], hue: (i * 37 + 11 * 53) % 360 }));
  return pool.filter((_, i) => [i % n, (i * 7 + 3) % n, (i * 13 + 5) % n].includes(ci)).slice(0, 10).map((p) => ({ ...p, sub: genre + ' · Playlist' }));
}

/** Stable track file for a title (track-1 … track-5). */
export function trackUrl(title: string): string {
  const h = [...title].reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7);
  return `${MEDIA_BASE}music/track-${(h % 5) + 1}.mp3`;
}
