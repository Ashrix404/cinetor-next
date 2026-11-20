// Real download options for a title/episode: built from the direct files the resolver found
// (core/sources.ts), merged per quality + audio language, best source first with the rest as fallback.
// Pure (unit tested). Embed pages are never downloadable; HLS playlists are not offered yet (the
// download engines write one progressive file with Range requests).
import { rankSources, type MediaSrc } from './sources';

export interface DlOption {
  quality: number;
  audio: string;
  /** bytes when a source reported it, else 0 (the sheet shows "~") */
  size: number;
  /** files that provide this option, best first (automatic fallback order) */
  srcs: MediaSrc[];
}

const LANGS: [RegExp, string][] = [
  [/dual[ ._-]?audio|multi[ ._-]?audio/i, 'Dual audio'],
  [/\bhin(di)?\b/i, 'Hindi'],
  [/\bben(gali)?\b|\bbangla\b/i, 'Bangla'],
  [/\btam(il)?\b/i, 'Tamil'],
  [/\btel(ugu)?\b/i, 'Telugu'],
  [/\beng(lish)?\b/i, 'English'],
  [/\bkor(ean)?\b/i, 'Korean'],
  [/\bjap(anese)?\b/i, 'Japanese'],
  [/\bspa(nish)?\b|\bespa[nñ]ol\b/i, 'Spanish'],
];
/** Audio language from a source's name / file name ("Movie.2024.Hindi.720p.mkv", "[Dual Audio]"). */
export function audioOf(s: Pick<MediaSrc, 'name' | 'url'>): string {
  let file = s.url.split('?')[0];
  try {
    file = decodeURIComponent(file);
  } catch {
    /* keep raw */
  }
  const t = s.name + ' ' + file.split('/').pop();
  for (const [re, name] of LANGS) if (re.test(t)) return name;
  return 'Original';
}

/** Standard rungs the sheet shows; a file's height snaps to the nearest one. */
export const RUNGS = [2160, 1080, 720, 480, 360];
export const rungOf = (h: number) => (h > 0 ? RUNGS.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)) : 720);

export function buildOptions(direct: MediaSrc[], o: { mobile?: boolean } = {}): DlOption[] {
  const files = rankSources(direct.filter((s) => s.kind === 'mp4'), { mobile: o.mobile });
  const map = new Map<string, DlOption>();
  for (const s of files) {
    const q = rungOf(s.quality), a = audioOf(s), k = q + '|' + a;
    const cur = map.get(k) || { quality: q, audio: a, size: 0, srcs: [] };
    cur.srcs.push(s);
    if (!cur.size && s.size && s.size > 0) cur.size = s.size;
    map.set(k, cur);
  }
  return [...map.values()].sort((x, y) => y.quality - x.quality || (x.audio === 'Original' ? -1 : y.audio === 'Original' ? 1 : x.audio.localeCompare(y.audio)));
}

/** Files for the chosen quality + audio, best first; falls back to the same quality in any audio, then
 * to the nearest quality, so a pick never ends with nothing when anything exists. */
export function pickFiles(opts: DlOption[], quality: number, audio: string): MediaSrc[] {
  const exact = opts.find((x) => x.quality === quality && x.audio === audio);
  const sameQ = opts.filter((x) => x.quality === quality && x !== exact);
  const rest = opts.filter((x) => x.quality !== quality).sort((a, b) => Math.abs(a.quality - quality) - Math.abs(b.quality - quality));
  return [exact, ...sameQ, ...rest].filter((x): x is DlOption => !!x).flatMap((x) => x.srcs);
}

export const qualities = (opts: DlOption[]) => [...new Set(opts.map((x) => x.quality))];
export const audios = (opts: DlOption[], quality?: number) => [...new Set(opts.filter((x) => quality == null || x.quality === quality).map((x) => x.audio))];

export function fmtSize(bytes: number): string {
  if (!bytes) return '~';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? gb.toFixed(1) + ' GB' : Math.max(1, Math.round(bytes / 1024 ** 2)) + ' MB';
}
