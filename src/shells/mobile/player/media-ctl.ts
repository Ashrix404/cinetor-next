// Brightness / volume for the fullscreen gestures (docs/05-player.md §Gestures).
import { isIOS, isNative } from '../../../core/platform';
import { CinetorNative } from '../../../native/cinetor-native';
import { getVideo } from './store';

let gain: GainNode | null = null;
let ctx: AudioContext | null = null;
export const level = { b: 1, v: 1 };

/** Native: window brightness 0..1. Browser: CSS brightness 0.3–1.5 on the video only. */
export async function setBrightness(b: number) {
  level.b = Math.max(0, Math.min(1, b));
  if (isNative()) return CinetorNative.setBrightness({ value: Math.max(0.01, level.b) }).catch(() => {});
  getVideo().style.filter = `brightness(${(0.3 + level.b * 1.2).toFixed(2)})`;
}
export function resetBrightness() {
  if (isNative()) CinetorNative.setBrightness({ value: null }).catch(() => {});
  else getVideo().style.filter = '';
}

/** Native: STREAM_MUSIC. Browser: video.volume; iOS (read-only volume): Web Audio GainNode. */
export async function setVolume(v: number) {
  level.v = Math.max(0, Math.min(1, v));
  if (isNative()) return CinetorNative.setVolume({ value: level.v }).catch(() => {});
  const video = getVideo();
  if (isIOS()) {
    try {
      if (!ctx) {
        ctx = new AudioContext(); // created inside the drag gesture (user activation)
        const src = ctx.createMediaElementSource(video);
        gain = ctx.createGain();
        src.connect(gain).connect(ctx.destination);
      }
      void ctx.resume();
      if (gain) gain.gain.value = level.v;
    } catch {
      /* Web Audio blocked: nothing else we can do on iOS */
    }
    return;
  }
  video.volume = level.v;
}
export async function readLevels() {
  if (!isNative()) return;
  try {
    level.b = (await CinetorNative.getBrightness()).value;
    level.v = (await CinetorNative.getVolume()).value;
  } catch {
    /* plugin missing in this build */
  }
}
