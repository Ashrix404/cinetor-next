// Fullscreen landscape player route (prototype V.player + vcore(true)); brightness/volume drag gestures.
import { useEffect, useRef, useState } from 'preact/hooks';
import { I } from '../ui/icons';
import { isIOS, isNative } from '../../../core/platform';
import { back, param } from '../state';
import { ctl, onPlayerTap, patch, pl, showCtl, startLive } from './store';
import { useStore } from '../ui/hooks';
import { Vcore } from './controls';
import { PlayerSheet } from './sheets';
import { createGestures, flashGest } from './gestures';
import { controlsHidden } from '../../../core/player-gesture';
import { level, readLevels, resetBrightness, setBrightness, setVolume } from './media-ctl';

async function enterFs() {
  if (isNative()) {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
    const { StatusBar } = await import('@capacitor/status-bar');
    StatusBar.hide().catch(() => {});
    return;
  }
  if (isIOS()) return; // pseudo fullscreen (fixed overlay); never webkitEnterFullscreen
  try {
    await document.documentElement.requestFullscreen();
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    /* not allowed: stay in the fixed overlay */
  }
}
async function exitFs() {
  resetBrightness();
  if (isNative()) {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    ScreenOrientation.unlock().catch(() => {});
    const { StatusBar } = await import('@capacitor/status-bar');
    StatusBar.show().catch(() => {});
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

export function PlayerPage() {
  const live = param<boolean>('live');
  const [portrait, setPortrait] = useState(innerHeight > innerWidth);
  const c = useStore(ctl);
  useEffect(() => {
    if (live && !pl.get().active) startLive(param<string>('label') || 'Live', param<number>('hue') || 200);
    if (!pl.get().active) back();
    pl.set({ pip: false });
    patch({ mode: 'fullscreen' });
    enterFs();
    readLevels();
    showCtl();
    const onR = () => setPortrait(innerHeight > innerWidth);
    addEventListener('resize', onR);
    return () => {
      removeEventListener('resize', onR);
      exitFs();
      if (pl.get().st.mode === 'fullscreen') patch({ mode: 'inline' });
      if (pl.get().live && !pl.get().pip) pl.set({ active: false });
    };
  }, []);
  // Slide = seek and long hold = 2× everywhere; brightness / volume (vertical) exist only in the APK.
  const gestures = isNative();
  const gs = useRef(
    createGestures({
      move(d, e) {
        if (!gestures) return;
        if (d.side === undefined) {
          d.side = d.x < innerWidth / 2 ? 'l' : 'r';
          d.start = d.side === 'l' ? level.b : level.v;
        }
        const v = Math.max(0, Math.min(1, (d.start ?? 0) + (d.y - e.clientY) / (innerHeight * 0.8)));
        if (d.side === 'l') setBrightness(v);
        else setVolume(v);
        flashGest(d.side === 'l' ? 'white-balance-sunny' : 'volume-high', Math.round(v * 100) + '%', '', 600);
      },
    }),
  ).current;
  const s = useStore(pl);
  if (!s.active) return null;
  const embed = !!s.embedUrl;
  // Embed servers get the touches themselves (touch-action auto, no tap handler); the bar never hides.
  return (
    <div class={'plbox' + (controlsHidden(c.hidden, embed) ? ' ctlhide' : '')} style={`touch-action:${embed ? 'auto' : 'none'}`} onClick={embed ? undefined : (e) => !gs.suppressed() && onPlayerTap(e)} onPointerDown={gs.down} onPointerMove={gs.move} onPointerUp={gs.up} onPointerCancel={gs.cancel} onContextMenu={gs.menu}>
      <Vcore land onFs={() => {}} />
      {isIOS() && !isNative() && portrait && <div class="rotate"><div><I n="phone-rotate-landscape" /><div>Rotate your phone</div></div></div>}
      <PlayerSheet land />
    </div>
  );
}
PlayerPage.land = true;
PlayerPage.bare = true;
