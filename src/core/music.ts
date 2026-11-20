import { GEN } from './catalog';
import { GATEWAY_BASE } from './config';

export interface Playlist { title: string; hue: number; sub?: string; icon?: string; url?: string }

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  thumbnail?: string;
  streamUrl?: string;
}

export const TILES: Playlist[] = [
  { title: 'Liked Songs', hue: 280, icon: 'heart' },
  { title: 'Daily Mix 1', hue: 160, icon: 'music-note' },
  { title: 'Chill Hits', hue: 200, icon: 'weather-night' },
  { title: 'Late Night Drive', hue: 330, icon: 'car' },
  { title: 'Focus Flow', hue: 100, icon: 'headphones' },
  { title: 'Road Trip', hue: 30, icon: 'map-marker-path' }
];

export const MADE_FOR_YOU: Playlist[] = [
  { title: 'Discover Weekly', sub: 'Fresh picks for you', hue: 150 },
  { title: 'Release Radar', sub: 'New music from artists', hue: 280 },
  { title: 'Daily Mix 2', sub: 'Trending Top Hits', hue: 20 }
];

export const RECENT: Playlist[] = [
  { title: 'Adele', hue: 200 },
  { title: 'Taylor Swift', hue: 330 },
  { title: 'Ed Sheeran', hue: 60 },
  { title: 'Coldplay', hue: 270 }
];

export const NOW_DEFAULT = { title: 'Trending Hits', artist: 'YouTube Music', hue: 290 };
export const MUSIC_GENRES = GEN.music;

const W1 = ['Silent', 'Crimson', 'Hollow', 'Golden', 'Midnight', 'Iron', 'Glass', 'Paper', 'Salt', 'Ember', 'Velvet', 'Northern'];
const W2 = ['Harbor', 'Orchard', 'Gate', 'Ledger', 'Court', 'Tide', 'Lantern', 'Station', 'Meridian', 'Garden'];

export function genrePlaylists(genre: string): Playlist[] {
  const list = GEN.music, n = list.length, ci = list.indexOf(genre);
  if (ci < 0) return [];
  const pool = Array.from({ length: 84 }, (_, i) => ({
    title: W1[i % 12] + ' ' + W2[(Math.floor(i / 12) + 11) % 10],
    hue: (i * 37 + 11 * 53) % 360
  }));
  return pool.filter((_, i) => [i % n, (i * 7 + 3) % n, (i * 13 + 5) % n].includes(ci)).slice(0, 10).map((p) => ({ ...p, sub: genre + ' · Playlist' }));
}

/** Real playable audio stream URL for any track title */
export function trackUrl(title: string): string {
  return `${GATEWAY_BASE}/v1/music/stream?q=${encodeURIComponent(title)}`;
}

export async function searchTracks(query: string): Promise<MusicTrack[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/v1/music/search?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data?.tracks || [];
  } catch {
    return [];
  }
}

export async function fetchMusicHome(): Promise<MusicTrack[]> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/v1/music/home`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data?.tracks || [];
  } catch {
    return [];
  }
}

export async function resolveTrackAudio(trackId: string): Promise<string> {
  try {
    const res = await fetch(`${GATEWAY_BASE}/v1/music/resolve?id=${encodeURIComponent(trackId)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data: any = await res.json();
      const direct = data?.sources?.find((s: any) => s.isDirect && (s.proxyUrl || s.url));
      if (direct) {
        return direct.proxyUrl || direct.url;
      }
    }
  } catch {}
  return trackUrl(trackId);
}
