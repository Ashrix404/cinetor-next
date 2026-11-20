// Play a title's direct media files in order (v2: Media3 queue of ranked sources, then the proxy):
// each file gets playUrl's engines (native, hls.js, hls.js via proxy) with a timeout; the first one
// that produces frames wins. Rejects 'cancelled' when a newer playUrl/cancelPlay took over.
import { playUrl } from './playback';
import { isNative } from './platform';
import { playTarget, type MediaSrc } from './sources';
import { registerMediaHeaders } from '../native/media-headers';

export async function playDirect(v: HTMLVideoElement, list: MediaSrc[], o: { at?: number; timeoutMs?: number; alive?: () => boolean } = {}): Promise<MediaSrc> {
  const native = isNative();
  if (native) await registerMediaHeaders(list);
  let last: Error = new Error('no direct source');
  for (const s of list) {
    if (o.alive && !o.alive()) throw new Error('cancelled');
    const t = playTarget(s, native);
    try {
      await playUrl(v, t.url, { at: o.at, timeoutMs: o.timeoutMs ?? 15000, referer: t.referer });
      return s;
    } catch (e) {
      last = e as Error;
      if (last.message === 'cancelled') throw last;
    }
  }
  throw last;
}
