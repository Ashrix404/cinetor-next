// Download manager shared by the mobile and desktop shells (TV has no downloads).
import { MEDIA_BASE } from '../config';
import { isNative } from '../platform';
import { createStore } from '../store';
import { clipFor } from '../player-model';
import { trackUrl } from '../music';
import type { Quality } from '../series-settings';
import { createWebEngine } from './web-engine';
import { createNativeEngine } from './native-engine';
import { DEFAULT_ROOT, fileName, relPath } from './naming';
import { makePdf } from './pdf';
import { saveWeb } from './save';
import type { Conn, DlItem, DlKind, DownloadEngine } from './engine';

export type { DlItem, DlKind, Conn } from './engine';
export const dlStore = createStore<{ items: Record<string, DlItem> }>('downloads', { items: {} }, true);
export const dlSettings = createStore<{ conn: Conn; root: string; treeUri?: string; label?: string }>('dlset', { conn: 16, root: DEFAULT_ROOT }, true);
export const speeds = createStore<Record<string, number>>('dlspeed', {}, false);

// After a restart: running items come back as paused (review focus #4).
{
  const items = { ...dlStore.get().items };
  let changed = false;
  for (const k in items)
    if (items[k].status === 'running' || items[k].status === 'queued') {
      items[k] = { ...items[k], status: 'paused', restartNeeded: !isNative() };
      changed = true;
    }
  if (changed) dlStore.set({ items });
}

let engine: (DownloadEngine & { blobOf?: (id: string) => Promise<Blob | null> }) | null = null;
export function getEngine() {
  if (engine) return engine;
  engine = isNative() ? createNativeEngine() : createWebEngine();
  engine.onProgress((it, bps) => {
    const prev = dlStore.get().items[it.id];
    if (!prev) return;
    put({ ...prev, bytesDone: it.bytesDone, bytesTotal: it.bytesTotal || prev.bytesTotal, status: it.status, savedAs: it.savedAs || prev.savedAs, uri: it.uri || prev.uri, error: it.error });
    speeds.set({ [it.id]: bps });
    if (it.status === 'done' && prev.status !== 'done') void finish(it.id);
  });
  return engine;
}
const put = (it: DlItem) => dlStore.set({ items: { ...dlStore.get().items, [it.id]: it } });
const listeners = new Set<(it: DlItem) => void>();
/** Called once per finished item (UI shows the "Saved · path" toast). */
export const onDone = (fn: (it: DlItem) => void) => (listeners.add(fn), () => listeners.delete(fn));

async function finish(id: string) {
  const it = dlStore.get().items[id];
  if (!it) return;
  if (!isNative() && engine?.blobOf) {
    const blob = await engine.blobOf(id);
    if (blob) {
      const name = it.path.split('/').pop()!;
      const local = await keepLocal(id, blob);
      put({ ...it, status: 'done', local, savedAs: await saveWeb(blob, name, it.kind) });
    }
  }
  listeners.forEach((f) => f(dlStore.get().items[id]));
}

export interface DlSpec { poster?: string | null; titleId: number; title: string; kind: DlKind; season: number; episode: number; quality: Quality; audio: string; movie?: boolean; chapter?: number }
export const dlId = (kind: DlKind, titleId: number, s: number, e: number) => `${kind}:${titleId}:${s}:${e}`;

export function enqueue(specs: DlSpec[]): number {
  let n = 0;
  for (const s of specs) {
    const id = dlId(s.kind, s.titleId, s.season, s.episode);
    if (dlStore.get().items[id]) continue;
    const name = fileName(s.kind, s.title, { season: s.season, episode: s.episode, quality: s.quality, chapter: s.chapter, movie: s.movie });
    const url = s.kind === 'video' ? MEDIA_BASE + clipFor(s.quality) : s.kind === 'music' ? trackUrl(s.title) : '';
    const it: DlItem = { id, poster: s.poster ?? null, titleId: s.titleId, kind: s.kind, title: s.title, season: s.season, episode: s.episode, quality: s.quality, audio: s.audio, url, bytesDone: 0, bytesTotal: 0, status: 'queued', path: relPath(s.kind, name, dlSettings.get().root) };
    put(it);
    n++;
    if (s.kind === 'comic') void saveComic(it, s.chapter ?? 1);
    else void getEngine().start(it, dlSettings.get().conn).catch((e) => put({ ...it, status: 'error', error: String(e) }));
  }
  return n;
}

async function saveComic(it: DlItem, chapter: number) {
  const pdf = makePdf(`${it.title} - Chapter ${chapter}`, 12);
  const bytes = new TextEncoder().encode(pdf);
  try {
    let savedAs: string;
    if (isNative()) {
      const { CinetorNative } = await import('../../native/cinetor-native');
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      const r = await CinetorNative.saveBytes({ relPath: it.path, base64: btoa(bin), mime: 'application/pdf', treeUri: dlSettings.get().treeUri });
      savedAs = r.path;
      it.uri = r.uri;
    } else savedAs = await saveWeb(new Blob([bytes], { type: 'application/pdf' }), it.path.split('/').pop()!, 'comic');
    put({ ...it, bytesDone: bytes.length, bytesTotal: bytes.length, status: 'done', savedAs });
  } catch (e) {
    put({ ...it, status: 'error', error: String(e) });
  }
  listeners.forEach((f) => f(dlStore.get().items[it.id]));
}

export async function pause(id: string) {
  await getEngine().pause(id);
  const it = dlStore.get().items[id];
  if (it) put({ ...it, status: 'paused' });
}
export async function resume(id: string) {
  const it = dlStore.get().items[id];
  if (!it) return;
  if (it.restartNeeded) {
    put({ ...it, restartNeeded: false, bytesDone: 0, status: 'queued' });
    return getEngine().start({ ...it, bytesDone: 0 }, dlSettings.get().conn);
  }
  put({ ...it, status: 'running' });
  await getEngine().resume(id);
}
export async function cancel(id: string) {
  await getEngine().cancel(id).catch(() => {});
  await removeLocal(id);
  const items = { ...dlStore.get().items };
  delete items[id];
  dlStore.set({ items });
}
export const active = () => Object.values(dlStore.get().items).filter((x) => x.status !== 'done');
export const finished = () => Object.values(dlStore.get().items).filter((x) => x.status === 'done');
export async function pauseAll(p: boolean) {
  for (const it of active()) await (p ? pause(it.id) : resume(it.id));
}

// ---- in-app playback of finished downloads -------------------------------------------------
async function opfs(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle('files', { create: true });
  } catch {
    return null;
  }
}
const fileKey = (id: string) => id.replace(/[^A-Za-z0-9._-]/g, '_');
/** Web: keep a full copy in OPFS so the app can play it offline. */
async function keepLocal(id: string, blob: Blob): Promise<boolean> {
  const d = await opfs();
  if (!d) return false;
  try {
    const w = await (await d.getFileHandle(fileKey(id), { create: true })).createWritable();
    await w.write(blob);
    await w.close();
    return true;
  } catch {
    return false;
  }
}
/** URL the in-app player can load for a finished download, or null if it is not on this device. */
export async function playableUrl(it: DlItem): Promise<string | null> {
  if (it.status !== 'done') return null;
  if (isNative()) {
    if (!it.uri) return null;
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.convertFileSrc(it.uri);
  }
  if (!it.local) return null;
  const d = await opfs();
  try {
    const f = await (await d!.getFileHandle(fileKey(it.id))).getFile();
    return URL.createObjectURL(f);
  } catch {
    return null;
  }
}
export async function removeLocal(id: string) {
  const d = await opfs();
  try {
    await d?.removeEntry(fileKey(id));
  } catch {
    /* not stored */
  }
}

/** Remove downloads from the app; with `fromStorage` the saved files are deleted too. Returns files deleted. */
export async function removeMany(ids: string[], fromStorage: boolean): Promise<number> {
  let n = 0;
  for (const id of ids) {
    const it = dlStore.get().items[id];
    if (!it) continue;
    if (fromStorage && it.status === 'done') {
      if (isNative() && it.uri) {
        const { CinetorNative } = await import('../../native/cinetor-native');
        if ((await CinetorNative.deleteFile({ uri: it.uri }).catch(() => ({ deleted: false }))).deleted) n++;
      } else if (it.local) n++; // the in-app copy (OPFS) is removed by cancel()
    }
    await cancel(id);
  }
  return n;
}
