// Pure helpers for the player touch gestures and control visibility (mobile + desktop shells).
import { seekDelta } from './player-model';

/** Movement (px) before a press becomes a drag. */
export const GEST_SLOP = 10;
/** Press time (ms) before a still press becomes the 2× hold. */
export const HOLD_MS = 420;

export type DragDir = 'seek' | 'v';

/** Direction of a drag once it passes the slop: horizontal = seek, vertical = 'v'; null while still a tap. */
export function classifyDrag(dx: number, dy: number, slop = GEST_SLOP): DragDir | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'seek' : 'v';
}

/** Seek preview for a horizontal slide: clamped target time and the signed whole-second difference. */
export function seekPreview(startPos: number, dx: number, width: number, dur: number): { target: number; diff: number } {
  const target = Math.max(0, Math.min(Math.max(0, dur), startPos + seekDelta(dx, width)));
  return { target, diff: Math.round(target - startPos) };
}

/** "+12s" / "−8s" label of the seek preview pill. */
export const diffLabel = (diff: number) => (diff >= 0 ? '+' : '−') + Math.abs(diff) + 's';

/**
 * Whether the controls are really hidden. In embed (iframe) mode taps land inside the iframe and never
 * reach the player, so the Back / Server / Fullscreen bar must always stay visible there.
 */
export const controlsHidden = (hidden: boolean, embed: boolean) => hidden && !embed;

/**
 * Desktop click on the empty player area: a mouse click toggles play (prototype web `Player`),
 * a touch tap toggles the controls (single tap hides, single tap shows).
 */
export const desktopTapAction = (pointerType: string): 'play' | 'controls' => (pointerType === 'mouse' || pointerType === '' ? 'play' : 'controls');
