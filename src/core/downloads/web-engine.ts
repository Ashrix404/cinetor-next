// Browser download engine: parallel Range fetch + AbortController per segment, finished segments kept
// in OPFS when available (else memory). Browsers allow ~6 connections per host.
import { planSegments, type Conn, type DlItem, type DownloadEngine } from './engine';

interface Seg { a: number; b: number; got: number; parts: Uint8Array[]; done: boolean; ctl?: AbortController }
interface Job { item: DlItem; segs: Seg[]; conn: number; lastBytes: number; lastT: number }

const BROWSER_MAX = 6;
async function opfsDir(id: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const d = await root.getDirectoryHandle('downloads', { create: true });
    return await d.getDirectoryHandle(id, { create: true });
  } catch {
    return null;
  }
}

export function createWebEngine(fetchFn: typeof fetch = (...a) => fetch(...a)): DownloadEngine & { blobOf(id: string): Promise<Blob | null> } {
  const jobs = new Map<string, Job>();
  const subs = new Set<(it: DlItem, bps: number) => void>();
  const emit = (j: Job) => {
    const now = Date.now(), dt = (now - j.lastT) / 1000;
    const bps = dt > 0 ? (j.item.bytesDone - j.lastBytes) / dt : 0;
    if (dt >= 0.5 || j.item.status !== 'running') {
      j.lastBytes = j.item.bytesDone;
      j.lastT = now;
      subs.forEach((f) => f({ ...j.item }, Math.max(0, bps)));
    }
  };
  const total = (j: Job) => j.segs.reduce((s, x) => s + x.got, 0);

  async function runSeg(j: Job, s: Seg) {
    if (s.done) return;
    s.ctl = new AbortController();
    const from = s.a + s.got;
    const res = await fetchFn(j.item.url, { headers: { Range: `bytes=${from}-${s.b}` }, signal: s.ctl.signal });
    if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status);
    const rd = res.body!.getReader();
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      s.parts.push(value);
      s.got += value.length;
      j.item.bytesDone = total(j);
      emit(j);
    }
    s.done = s.a + s.got > s.b;
    if (s.done) {
      const dir = await opfsDir(j.item.id);
      if (dir) {
        const fh = await dir.getFileHandle('seg-' + s.a, { create: true });
        const w = await fh.createWritable();
        await w.write(new Blob(s.parts as BlobPart[]));
        await w.close();
      }
    }
  }

  async function pump(j: Job) {
    j.item.status = 'running';
    emit(j);
    const queue = j.segs.filter((s) => !s.done);
    const workers = Array.from({ length: Math.min(j.conn, BROWSER_MAX, queue.length) }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) await runSeg(j, s);
    });
    try {
      await Promise.all(workers);
      if (j.segs.every((s) => s.done)) {
        j.item.status = 'done';
        j.item.bytesDone = j.item.bytesTotal;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      j.item.status = 'error';
      j.item.error = (e as Error).message;
    }
    emit(j);
  }

  return {
    async start(item, connections: Conn) {
      let len = item.bytesTotal, ranges = true;
      if (!len) {
        const r = await fetchFn(item.url, { headers: { Range: 'bytes=0-0' } });
        const cr = r.headers.get('Content-Range');
        len = cr ? Number(cr.split('/')[1]) : Number(r.headers.get('Content-Length') || 0);
        ranges = r.status === 206;
        try {
          await r.body?.cancel();
        } catch {
          /* ignore */
        }
      }
      const segs = planSegments(len, connections, ranges).map(([a, b]) => ({ a, b, got: 0, parts: [], done: false }));
      const j: Job = { item: { ...item, bytesTotal: len, bytesDone: 0 }, segs, conn: connections, lastBytes: 0, lastT: Date.now() };
      jobs.set(item.id, j);
      void pump(j);
    },
    async pause(id) {
      const j = jobs.get(id);
      if (!j) return;
      j.segs.forEach((s) => s.ctl?.abort());
      j.item.status = 'paused';
      emit(j);
    },
    async resume(id) {
      const j = jobs.get(id);
      if (j && j.item.status !== 'done') void pump(j);
    },
    async cancel(id) {
      const j = jobs.get(id);
      j?.segs.forEach((s) => s.ctl?.abort());
      jobs.delete(id);
      try {
        const root = await navigator.storage.getDirectory();
        const d = await root.getDirectoryHandle('downloads');
        await d.removeEntry(id, { recursive: true });
      } catch {
        /* nothing stored */
      }
    },
    onProgress(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    async blobOf(id) {
      const j = jobs.get(id);
      if (!j || !j.segs.every((s) => s.done)) return null;
      return new Blob(j.segs.flatMap((s) => s.parts) as BlobPart[], { type: 'video/mp4' });
    },
  };
}
