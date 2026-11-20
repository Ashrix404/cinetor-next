// APK engine: the Java CinetorNative plugin does parallel Range downloads (docs/06 §Native engine).
import { CinetorNative, type DlProgress } from '../../native/cinetor-native';
import type { DlItem, DownloadEngine } from './engine';
import { dlSettings, dlStore } from './index';

export function createNativeEngine(): DownloadEngine {
  const subs = new Set<(it: DlItem, bps: number) => void>();
  const known = new Map<string, DlItem>();
  void CinetorNative.addListener('downloadProgress', (p: DlProgress) => {
    const it = known.get(p.id) || dlStore.get().items[p.id];
    if (!it) return;
    const next = { ...it, bytesDone: p.bytesDone, bytesTotal: p.bytesTotal, status: p.status, savedAs: p.path, error: p.error };
    known.set(p.id, next);
    subs.forEach((f) => f(next, p.bytesPerSec));
  });
  return {
    async start(item, connections) {
      known.set(item.id, item);
      await CinetorNative.dlStart({ id: item.id, url: item.url, relPath: item.path, connections, treeUri: dlSettings.get().treeUri });
    },
    pause: (id) => CinetorNative.dlPause({ id }),
    async resume(id) {
      await CinetorNative.dlResume({ id });
    },
    cancel: (id) => CinetorNative.dlCancel({ id }),
    onProgress(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
