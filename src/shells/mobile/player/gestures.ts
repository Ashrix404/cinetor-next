// Player touch gestures (portrait + landscape): horizontal slide = seek (preview pill, commit on release),
// long hold = 2× speed (restored on release). Vertical drags go to the caller (brightness / volume in the
// fullscreen APK, PiP / fullscreen on the inline player). Taps fall through to the container's onClick.
import { createStore } from '../../../core/store';
import { classifyDrag, diffLabel, HOLD_MS, seekPreview } from '../../../core/player-gesture';
import { pl, ptime, seekTo, setSpeed, showCtl } from './store';
import { fmtTime } from '../../../core/player-model';

export { HOLD_MS };

/** Overlay pill text (seek preview, 2× badge, brightness / volume level). */
export const gest = createStore('gest', { icon: '', text: '', sub: '', show: false }, false);
let hideT: ReturnType<typeof setTimeout> | undefined;
export function flashGest(icon: string, text: string, sub = '', ms = 600) {
  clearTimeout(hideT);
  gest.set({ icon, text, sub, show: true });
  if (ms) hideT = setTimeout(() => gest.set({ show: false }), ms);
}
export const hideGest = () => (clearTimeout(hideT), gest.set({ show: false }));

/** Presses that start on a control (or a sheet) are never gestures. */
const SKIP = '.pi,.ibtn,.sk,.big,.ptrk,.sheet,.scrim,.vg-err,.vg-slow,.embar';

export type Mode = null | 'seek' | 'v' | 'hold';
export interface Drag {
  x: number; y: number; w: number; pos: number; mode: Mode; target: number; prevSpeed: number; side?: 'l' | 'r'; start?: number; timer?: ReturnType<typeof setTimeout>;
}

/** `vertical` receives the drag once it is decided to be vertical. */
export function createGestures(vertical?: { move?: (d: Drag, e: PointerEvent) => void; end?: (d: Drag, e: PointerEvent) => void }) {
  let d: Drag | null = null;
  let suppressUntil = 0;
  const usable = () => {
    const s = pl.get();
    return s.active && !s.embedUrl && !s.st.locked && !s.err;
  };
  const finish = (e: PointerEvent, commit: boolean) => {
    const cur = d;
    d = null;
    if (!cur) return;
    clearTimeout(cur.timer);
    try {
      (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* capture already gone */
    }
    if (!cur.mode) return; // a plain tap: the click handler toggles the controls
    suppressUntil = Date.now() + 350; // the trailing click must not toggle the controls
    if (cur.mode === 'hold') {
      setSpeed(cur.prevSpeed as never);
      hideGest();
    } else if (cur.mode === 'seek') {
      if (commit) seekTo(cur.target);
      hideGest();
      showCtl();
    } else if (cur.mode === 'v' && commit) vertical?.end?.(cur, e);
  };
  return {
    /** True right after a seek / hold / vertical drag. */
    suppressed: () => Date.now() < suppressUntil,
    down(e: PointerEvent) {
      if (e.button > 0 || !pl.get().active || pl.get().embedUrl || (e.target as HTMLElement).closest(SKIP)) return;
      const el = e.currentTarget as HTMLElement;
      // Keep receiving move/up while the finger leaves the box (mouse; touch is captured implicitly).
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* unsupported pointer */
      }
      d = { x: e.clientX, y: e.clientY, w: el.clientWidth || innerWidth, pos: ptime.get().pos, mode: null, target: 0, prevSpeed: pl.get().st.speed };
      const cur = d;
      if (pl.get().live || !usable()) return;
      cur.timer = setTimeout(() => {
        if (d !== cur || cur.mode) return;
        cur.mode = 'hold';
        setSpeed(2);
        flashGest('fast-forward', '2× speed', '', 0);
      }, HOLD_MS);
    },
    move(e: PointerEvent) {
      if (!d || d.mode === 'hold') return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.mode) {
        const dir = classifyDrag(dx, dy);
        if (!dir) return;
        clearTimeout(d.timer);
        if (dir === 'seek' && (pl.get().live || !usable())) {
          d = null;
          return;
        }
        d.mode = dir;
      }
      if (d.mode === 'seek') {
        const p = seekPreview(d.pos, dx, d.w, ptime.get().dur || 0);
        d.target = p.target;
        flashGest(p.diff < 0 ? 'rewind' : 'fast-forward', fmtTime(p.target), diffLabel(p.diff), 0);
      } else if (d.mode === 'v') vertical?.move?.(d, e);
    },
    up: (e: PointerEvent) => finish(e, true),
    /** The browser took over the pointer (scroll / system gesture): undo, never commit. */
    cancel: (e: PointerEvent) => finish(e, false),
    /** Long press on Android WebView / Chrome opens the video context menu; the hold is ours. */
    menu: (e: Event) => e.preventDefault(),
  };
}
