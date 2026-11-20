// Remote key map (docs/01 spec C + prototype normKey). Every key code in the spec is mapped.
export type Key = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'playpause' | 'rew' | 'ff' | 'delete' | null;

const KC: Record<number, Key> = {
  4: 'back', 8: 'back', 27: 'back', 461: 'back', 10009: 'back',
  23: 'ok', 13: 'ok', 66: 'ok',
  19: 'up', 20: 'down', 21: 'left', 22: 'right', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
  85: 'playpause', 179: 'playpause', 415: 'playpause',
  89: 'rew', 412: 'rew', 90: 'ff', 417: 'ff',
  46: 'delete',
};
const NAMES: Record<string, Key> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok',
  Escape: 'back', Backspace: 'back', GoBack: 'back', BrowserBack: 'back', XF86Back: 'back', Back: 'back',
  MediaPlayPause: 'playpause', MediaPlay: 'playpause', MediaPause: 'playpause',
  MediaRewind: 'rew', MediaTrackPrevious: 'rew', MediaFastForward: 'ff', MediaTrackNext: 'ff', Delete: 'delete',
};

export function normKey(e: { key?: string; keyCode?: number }): Key {
  const k = e.key || '';
  if (k && k !== 'Unidentified' && k !== 'Dead' && NAMES[k] !== undefined) return NAMES[k];
  return KC[e.keyCode || 0] ?? null;
}
