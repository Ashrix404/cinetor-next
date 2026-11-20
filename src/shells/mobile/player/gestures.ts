// Player touch gestures (portrait + landscape): horizontal slide = seek, long hold = 2× speed.
// Vertical drags stay with the caller (brightness / volume in the fullscreen APK, PiP / fullscreen inline).
import { createStore } from '../../../core/store';
import { pl, ptime, seekTo, setSpeed } from './store';
import { fmtTime, seekDelta } from '../../../core/player-model';

/** Overlay pill text (seek preview, 2× badge, brightness / volume level). */
export const gest = createStore('gest', { icon: '', text: '', sub: '', show: false }, false);
let hideT: ReturnType<typeof setTimeout> | undefined;
export function flashGest(icon: string, text: string, sub = '', ms = 600) {
  clearTimeout(hideT);
  gest.set({ icon, text, sub, show: true });
  if (ms) hideT = setTimeout(() => gest.set({ show: false }), ms);
}
export const hideGest = () => (clearTimeout(hideT), gest.set({ show: false }));

const SKIP = '.pi,.ibtn,.sk,.big,.ptrk,.sheet,.scrim,.vg-pill,.vg-btn,.vg-back,.vg-fs,.vg-play,.vg-seekbtn,.vg-trk,.vg-err,.vg-srv';
export const HOLD_MS = 420;
const SLOP = 10;

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
    return !s.embedUrl && !s.st.locked && !s.err;
  };
  return {
    /** True right after a seek / hold, so the trailing click must not toggle the controls. */
    suppressed: () => Date.now() < suppressUntil,
    down(e: PointerEvent) {
      if (!pl.get().active || pl.get().embedUrl || (e.target as HTMLElement).closest(SKIP)) return;
      const el = e.currentTarget as HTMLElement;
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
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        clearTimeout(d.timer);
        d.mode = Math.abs(dx) > Math.abs(dy) ? 'seek' : 'v';
        if (d.mode === 'seek' && (pl.get().live || !usable())) {
          d = null;
          return;
        }
      }
      if (d.mode === 'seek') {
        const dur = ptime.get().dur || 0;
        d.target = Math.max(0, Math.min(dur, d.pos + seekDelta(dx, d.w)));
        const diff = Math.round(d.target - d.pos);
        flashGest(diff < 0 ? 'rewind' : 'fast-forward', fmtTime(d.target), (diff >= 0 ? '+' : '−') + Math.abs(diff) + 's', 0);
      } else if (d.mode === 'v') vertical?.move?.(d, e);
    },
    up(e: PointerEvent) {
      const cur = d;
      d = null;
      if (!cur) return;
      clearTimeout(cur.timer);
      if (cur.mode === 'hold') {
        setSpeed(cur.prevSpeed as never);
        hideGest();
        suppressUntil = Date.now() + 350;
      } else if (cur.mode === 'seek') {
        seekTo(cur.target);
        hideGest();
        suppressUntil = Date.now() + 350;
      } else if (cur.mode === 'v') {
        vertical?.end?.(cur, e);
        suppressUntil = Date.now() + 350;
      }
    },
  };
}
