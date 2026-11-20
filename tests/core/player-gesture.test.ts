import { describe, expect, it } from 'vitest';
import { classifyDrag, controlsHidden, desktopTapAction, diffLabel, GEST_SLOP, seekPreview } from '../../src/core/player-gesture';

describe('player gestures', () => {
  it('stays a tap inside the slop', () => {
    expect(classifyDrag(0, 0)).toBeNull();
    expect(classifyDrag(GEST_SLOP - 1, -(GEST_SLOP - 1))).toBeNull();
  });
  it('horizontal drag = seek, vertical = v', () => {
    expect(classifyDrag(30, 5)).toBe('seek');
    expect(classifyDrag(-30, 12)).toBe('seek');
    expect(classifyDrag(4, 40)).toBe('v');
    expect(classifyDrag(20, -20)).toBe('v');
  });
  it('seek preview clamps to 0..dur', () => {
    expect(seekPreview(60, 100, 400, 600)).toEqual({ target: 90, diff: 30 });
    expect(seekPreview(10, -400, 400, 600)).toEqual({ target: 0, diff: -10 });
    expect(seekPreview(590, 400, 400, 600)).toEqual({ target: 600, diff: 10 });
    expect(seekPreview(0, 100, 400, 0)).toEqual({ target: 0, diff: 0 });
  });
  it('labels the diff', () => {
    expect(diffLabel(12)).toBe('+12s');
    expect(diffLabel(0)).toBe('+0s');
    expect(diffLabel(-8)).toBe('−8s');
  });
  it('never hides the controls over an embed iframe', () => {
    expect(controlsHidden(true, false)).toBe(true);
    expect(controlsHidden(true, true)).toBe(false);
    expect(controlsHidden(false, false)).toBe(false);
  });
  it('desktop: mouse click toggles play, touch tap toggles controls', () => {
    expect(desktopTapAction('mouse')).toBe('play');
    expect(desktopTapAction('touch')).toBe('controls');
    expect(desktopTapAction('pen')).toBe('controls');
  });
});
