// File naming (docs/06-media-and-downloads.md §File naming).
import type { DlKind } from './engine';

export const DEFAULT_ROOT = 'Download/Cinetor';
export const clean = (s: string) => s.replace(/[^A-Za-z0-9 \-._]+/g, '').trim();
const dots = (s: string) => clean(s).replace(/ +/g, '.');

export function fileName(kind: DlKind, title: string, o: { season?: number; episode?: number; quality?: number; chapter?: number; movie?: boolean } = {}): string {
  if (kind === 'comic') return `${clean(title)} - Chapter ${o.chapter ?? 1}.pdf`;
  if (kind === 'music') return `${clean(title)}.mp3`;
  const q = (o.quality ?? 1080) + 'p';
  if (o.movie) return `${dots(title)}.${q}.mp4`;
  return `${dots(title)}.S${o.season ?? 1}E${o.episode ?? 1}.${q}.mp4`;
}
export const subFolder = (kind: DlKind) => (kind === 'comic' ? 'Comics' : kind === 'music' ? 'Music' : '');
export function relPath(kind: DlKind, name: string, root = DEFAULT_ROOT): string {
  const sub = subFolder(kind);
  return [root, sub, name].filter(Boolean).join('/');
}
