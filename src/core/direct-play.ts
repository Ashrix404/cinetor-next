// Play a title's direct media files in order (v2: Media3 queue of ranked sources, then the proxy):
// each file gets playUrl's engines (native, hls.js, hls.js via proxy) with a timeout; the first one
// that produces frames wins. Preserves timestamp across server fallbacks. Rejects 'cancelled' when a
// newer playUrl/cancelPlay took over.
import { playUrl, preserveTimestamp } from './playback';
import { isNative } from './platform';
import { playTarget, type MediaSrc } from './sources';
import { registerMediaHeaders } from '../native/media-headers';

export async function playDirect(
  v: HTMLVideoElement,
  list: MediaSrc[],
  o: { at?: number; timeoutMs?: number; alive?: () => boolean; onSwitchServer?: (s: MediaSrc, idx: number) => void } = {}
): Promise<MediaSrc> {
  const native = isNative();
  if (native) await registerMediaHeaders(list);
  let last: Error = new Error('no direct source');
  let atPos = preserveTimestamp(v, o.at ?? 0);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (o.alive && !o.alive()) throw new Error('cancelled');
    const t = playTarget(s, native);
    try {
      atPos = preserveTimestamp(v, atPos);
      await playUrl(v, t.url, { at: atPos, timeoutMs: o.timeoutMs ?? 15000, referer: t.referer });
      o.onSwitchServer?.(s, i);
      return s;
    } catch (e) {
      last = e as Error;
      if (last.message === 'cancelled') throw last;
      atPos = preserveTimestamp(v, atPos);
    }
  }
  throw last;
}
