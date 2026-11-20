// Mock Live TV channels (prototype LIVE + LIVE_ALL). Every channel plays the mock clip as LIVE.
import { GEN } from './catalog';

/** [short, name, hue, number, category] */
export type Channel = [string, string, number, string, string];

export const LIVE: Channel[] = [
  ['N24', 'News 24', 210, '12', 'News'], ['C1', 'Cinema One', 350, '14', 'Movies'], ['KZ', 'Kids Zone', 130, '21', 'Kids'], ['HD', 'Nature HD', 160, '33', 'Documentary'],
  ['MH', 'Music Hub', 290, '41', 'Music'], ['DP', 'Drama Plus', 20, '52', 'Series'], ['SP', 'Sport Arena', 100, '61', 'Sports'], ['EN', 'Star Entertain', 330, '71', 'Entertainment'],
  ['CM', 'Comedy Club', 60, '72', 'Comedy'], ['LF', 'Living Well', 180, '81', 'Lifestyle'], ['ED', 'Learn TV', 240, '91', 'Education'], ['RG', 'Regional One', 300, '101', 'Regional'],
  ['RL', 'Faith Channel', 40, '111', 'Religion'], ['SH', 'Shop Now', 270, '121', 'Shopping'], ['W2', 'World News', 200, '13', 'News'], ['MV', 'Movie Max', 340, '15', 'Movies'],
];

export const LIVE_ALL: Channel[] = LIVE.concat(
  GEN.tv.flatMap((cat, ci) => ['Plus', 'HD'].map((x, k): Channel => [cat.slice(0, 2).toUpperCase() + (k + 1), cat + ' ' + x, (ci * 29 + k * 70) % 360, String(200 + ci * 3 + k), cat])),
);

export const channelsIn = (cat: string) => LIVE_ALL.filter((c) => cat === 'All' || c[4] === cat);
export const LIVE_CLIP = 'clip-720p.mp4';
