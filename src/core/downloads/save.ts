// Web saving (docs/06 §Web engine → Saving): File System Access folder, a[download], iOS share.
import { isIOS } from '../platform';
import { subFolder } from './naming';
import type { DlKind } from './engine';

let dirHandle: FileSystemDirectoryHandle | null = null;
type Picker = { showDirectoryPicker?: (o?: object) => Promise<FileSystemDirectoryHandle> };

export async function pickWebFolder(): Promise<string | null> {
  const w = window as unknown as Picker;
  if (!w.showDirectoryPicker) return null;
  try {
    dirHandle = await w.showDirectoryPicker({ mode: 'readwrite' });
    return dirHandle.name;
  } catch {
    return null;
  }
}
export const hasWebFolder = () => !!dirHandle;

/** Returns a human description of where the browser put the file. */
export async function saveWeb(blob: Blob, name: string, kind: DlKind): Promise<string> {
  if (dirHandle) {
    let d = dirHandle;
    const sub = subFolder(kind);
    if (sub) d = await d.getDirectoryHandle(sub, { create: true });
    const fh = await d.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return `${dirHandle.name}/${sub ? sub + '/' : ''}${name}`;
  }
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches;
  if (isIOS() && standalone) {
    const file = new File([blob], name, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'Shared to Files';
    }
    open(URL.createObjectURL(blob), '_blank');
    return 'Opened in a new tab';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1500);
  return isIOS() ? 'Files app (Downloads)' : 'Browser Downloads folder';
}
