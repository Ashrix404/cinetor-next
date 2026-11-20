// Fullscreen landscape player route (prototype V.player + vcore(true)); brightness/volume drag gestures.
import { useEffect, useRef, useState } from 'preact/hooks';
import { I } from '../ui/icons';
import { isIOS, isNative } from '../../../core/platform';
import { back, param } from '../state';
import { patch, pl, startLive } from './store';
import { Vcore } from './controls';
import { PlayerSheet } from './sheets';
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
  const [pill, setPill] = useState<{ ic: string; v: number } | null>(null);
  const [portrait, setPortrait] = useState(innerHeight > innerWidth);
  const g = useRef<{ x: number; y: number; side: 'l' | 'r'; start: number } | null>(null);
  useEffect(() => {
    if (live && !pl.get().active) startLive(param<string>('label') || 'Live', param<number>('hue') || 200);
    if (!pl.get().active) back();
    pl.set({ pip: false });
    patch({ mode: 'fullscreen' });
    enterFs();
    readLevels();
    const onR = () => setPortrait(innerHeight > innerWidth);
    addEventListener('resize', onR);
    return () => {
      removeEventListener('resize', onR);
      exitFs();
      if (pl.get().st.mode === 'fullscreen') patch({ mode: 'inline' });
      if (pl.get().live && !pl.get().pip) pl.set({ active: false });
    };
  }, []);
  // Brightness / volume gestures exist only in the APK (real system values); browsers get none.
  const gestures = isNative();
  const down = (e: PointerEvent) => {
    if (!gestures) return;
    if ((e.target as HTMLElement).closest('.pi,.ibtn,.sk,.big,.ptrk,.sheet,.scrim')) return;
    const side = e.clientX < innerWidth / 2 ? 'l' : 'r';
    g.current = { x: e.clientX, y: e.clientY, side, start: side === 'l' ? level.b : level.v };
  };
  const move = (e: PointerEvent) => {
    const d = g.current;
    if (!d || pl.get().st.locked) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(e.clientX - d.x)) return;
    const v = Math.max(0, Math.min(1, d.start + dy / (innerHeight * 0.8)));
    if (d.side === 'l') setBrightness(v);
    else setVolume(v);
    setPill({ ic: d.side === 'l' ? 'white-balance-sunny' : 'volume-high', v });
  };
  const up = () => {
    g.current = null;
    setTimeout(() => setPill(null), 600);
  };
  if (!pl.get().active) return null;
  return (
    <div style="position:absolute;inset:0;background:#000;touch-action:none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Vcore land onFs={() => {}} />
      {pill && <div class="lvl"><I n={pill.ic} />{Math.round(pill.v * 100)}%</div>}
      {isIOS() && !isNative() && portrait && <div class="rotate"><div><I n="phone-rotate-landscape" /><div>Rotate your phone</div></div></div>}
      <PlayerSheet land />
    </div>
  );
}
PlayerPage.land = true;
PlayerPage.bare = true;
