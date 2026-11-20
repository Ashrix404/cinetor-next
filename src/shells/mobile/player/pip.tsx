// In-app PiP (prototype `pipHtml` + drag): 176 px, drag anywhere, clamp to the viewport, survives navigation.
import { useRef } from 'preact/hooks';
import { I } from '../ui/icons';
import { useStore } from '../ui/hooks';
import { cur, nav, setUi } from '../state';
import { pl, ptime, stop, togglePlay, patch } from './store';
import { VideoHost } from './video-host';
import { SubOverlay } from './subs-overlay';

export function Pip() {
  const s = pl.get();
  const t = useStore(ptime);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  if (!s.active || !s.pip) return null;
  const w = 176, h = 99, W = innerWidth, H = innerHeight;
  const x = s.px == null ? W - w - 10 : s.px, y = s.py == null ? H - h - 96 : s.py;
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.pib span')) return;
    const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId);
    el.classList.add('drag');
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = e.currentTarget as HTMLElement;
    const nx = Math.max(0, Math.min(innerWidth - el.offsetWidth, e.clientX - d.dx));
    const ny = Math.max(0, Math.min(innerHeight - el.offsetHeight, e.clientY - d.dy));
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
    pl.get().px = nx;
    pl.get().py = ny;
  };
  const up = (e: PointerEvent) => {
    drag.current = null;
    (e.currentTarget as HTMLElement).classList.remove('drag');
  };
  const expand = () => {
    pl.set({ pip: false });
    patch({ mode: 'inline' });
    const c = cur();
    if (s.live) nav('player', { live: true });
    else if (!(c.name === 'info' && (c.params?.t as { id: number } | undefined)?.id === s.title?.id)) {
      setUi({ season: s.st.season });
      nav('info', { t: s.title });
    }
  };
  const pct = s.live ? 100 : t.dur ? (t.pos / t.dur) * 100 : 0;
  return (
    <div class="pip" style={`left:${x}px;top:${y}px`} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <VideoHost fit={s.st.fit} hue={s.hue} />
      <SubOverlay mode="pip" />
      <div class="pib">
        <span onClick={expand}><I n="arrow-expand" /></span>
        <span onClick={togglePlay}><I n={s.st.playing ? 'pause' : 'play'} /></span>
        <span onClick={stop}><I n="close" /></span>
      </div>
      <div class="pprog"><b style={`width:${pct}%`} /></div>
    </div>
  );
}
