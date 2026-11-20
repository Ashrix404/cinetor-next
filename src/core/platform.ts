// Platform detection without importing Capacitor (keeps the TV bundle small).
type CapGlobal = { isNativePlatform?: () => boolean };

function cap(): CapGlobal | undefined {
  return (globalThis as { Capacitor?: CapGlobal }).Capacitor;
}

export function isNative(): boolean {
  return !!cap()?.isNativePlatform?.();
}

export function isTv(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.shell === 'tv';
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as Mac; touch points tell them apart.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isAndroidBrowser(): boolean {
  return typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent) && !isNative();
}

/** True when the user can choose a download folder (SAF in the APK, File System Access on desktop). */
export function canPickFolder(): boolean {
  if (isNative()) return true;
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
