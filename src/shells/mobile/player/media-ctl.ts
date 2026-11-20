// Brightness / volume for the fullscreen gestures — APK only (docs/05 §Gestures, user decision 2026-11-20:
// browsers get no brightness/volume gesture). Brightness = the app window's screen brightness
// (WindowManager.LayoutParams.screenBrightness, reset to the system value on exit); volume = the real
// Android STREAM_MUSIC level.
import { isNative } from '../../../core/platform';
import { CinetorNative } from '../../../native/cinetor-native';

export const level = { b: 0.5, v: 0.5 };

export async function setBrightness(b: number) {
  level.b = Math.max(0, Math.min(1, b));
  if (isNative()) await CinetorNative.setBrightness({ value: Math.max(0.01, level.b) }).catch(() => {});
}
export function resetBrightness() {
  if (isNative()) void CinetorNative.setBrightness({ value: null }).catch(() => {});
}
export async function setVolume(v: number) {
  level.v = Math.max(0, Math.min(1, v));
  if (isNative()) await CinetorNative.setVolume({ value: level.v }).catch(() => {});
}
/** Start each drag from the device's current values. */
export async function readLevels() {
  if (!isNative()) return;
  try {
    level.b = (await CinetorNative.getBrightness()).value;
    level.v = (await CinetorNative.getVolume()).value;
  } catch {
    /* plugin missing in this build */
  }
}
