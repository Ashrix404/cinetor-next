// Pull down at the top of a section to refresh (user request 2026-11-20).
import { useRef, useState } from 'preact/hooks';
import { I } from './icons';

const MAX = 90, TRIGGER = 64;
export function usePullRefresh(onRefresh: () => Promise<unknown> | void) {
  const [h, setH] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef<{ y: number; on: boolean } | null>(null);
  const bind = {
    onTouchStart: (e: TouchEvent) => {
      const el = e.currentTarget as HTMLElement;
      st.current = el.scrollTop <= 0 && !busy ? { y: e.touches[0].clientY, on: false } : null;
    },
    onTouchMove: (e: TouchEvent) => {
      const s = st.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      if (dy <= 0 || (e.currentTarget as HTMLElement).scrollTop > 0) return setH(0);
      s.on = true;
      setH(Math.min(MAX, dy * 0.5));
    },
    onTouchEnd: async () => {
      const s = st.current;
      st.current = null;
      if (!s?.on) return;
      if (h < TRIGGER) return setH(0);
      setBusy(true);
      setH(48);
      try {
        await Promise.all([onRefresh(), new Promise((r) => setTimeout(r, 500))]);
      } finally {
        setBusy(false);
        setH(0);
      }
    },
  };
  const indicator = (
    <div class={'ptr' + (busy ? ' spin' : st.current ? ' pull' : '')} style={`height:${h}px`}>
      <I n={busy ? 'refresh' : 'arrow-down'} />
    </div>
  );
  return { bind, indicator };
}
