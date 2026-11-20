// Service worker registration + "New version available · Reload" (docs/08 §Web side). Web only.
import { isNative } from '../../core/platform';

export function registerSW(onUpdate: (reload: () => void) => void) {
  if (isNative() || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).then((reg) => {
    const ask = (w: ServiceWorker) =>
      onUpdate(() => {
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        w.postMessage('SKIP_WAITING');
      });
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => w.state === 'installed' && navigator.serviceWorker.controller && ask(w));
    });
    setInterval(() => void reg.update().catch(() => {}), 3600 * 1000);
  }).catch(() => {});
}

/** iOS Safari install hint (shown once). */
export function iosInstallHint(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return false;
  try {
    if (localStorage.getItem('cinetor:ios-hint')) return false;
    localStorage.setItem('cinetor:ios-hint', '1');
  } catch {
    return false;
  }
  return true;
}
