// APK only: tell the WebView which Referer/Origin a CDN wants (MainActivity adds them to every
// request for that host, video segments included). A browser cannot do this; it uses the gateway proxy.
import { isNative } from '../core/platform';
import { cdnHeaders, hostOf, type MediaSrc } from '../core/sources';

export async function registerMediaHeaders(list: MediaSrc[]): Promise<void> {
  if (!isNative()) return;
  const rules = list
    .map((s) => ({ host: hostOf(s.url), headers: cdnHeaders(s.headers) }))
    .filter((r) => r.host && Object.keys(r.headers).length);
  if (!rules.length) return;
  try {
    const { CinetorNative } = await import('./cinetor-native');
    await CinetorNative.setMediaHeaders({ rules });
  } catch {
    /* older APK without the method: the source may still play, or the next one is tried */
  }
}
