// Download engine contract (docs/02-architecture.md §Core contracts).
export type DlKind = 'video' | 'comic' | 'music';
export interface DlItem {
  id: string; titleId: number; kind: DlKind; title: string; season: number; episode: number; quality: number; audio: string;
  url: string; bytesDone: number; bytesTotal: number; status: 'queued' | 'running' | 'paused' | 'done' | 'error'; path: string;
  /** web: where the browser really saved it; native: content uri / path */
  savedAs?: string;
  error?: string;
  restartNeeded?: boolean;
}
export type Conn = 16 | 32 | 64;
export interface DownloadEngine {
  start(item: DlItem, connections: Conn): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  onProgress(fn: (it: DlItem, bytesPerSec: number) => void): () => void;
}

/** Split [0, len) into byte ranges (docs/06: min(connections, ceil(len / 256 KiB))). */
export function planSegments(len: number, connections: number, rangesOk: boolean): [number, number][] {
  if (!rangesOk || len <= 0) return [[0, Math.max(0, len - 1)]];
  const n = Math.max(1, Math.min(connections, Math.ceil(len / (256 * 1024))));
  const size = Math.ceil(len / n);
  const out: [number, number][] = [];
  for (let a = 0; a < len; a += size) out.push([a, Math.min(len, a + size) - 1]);
  return out;
}
