// Hero card carousel (prototype `carousel`, `carSty`, `carSet`, `movieCard`): 4 s auto-advance,
// 1.1 s eased transform (CSS), z-index transition, edge fade, drag to swipe, tap a neighbour to center it.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

const CSTEP = 172;
function carPos(k: number, i: number, n: number) {
  const h = Math.floor(n / 2);
  let d = (((k - i) % n) + n) % n;
  if (d > h) d -= n;
  return d;
}
function carSty(k: number, i: number, n: number) {
  const d = carPos(k, i, n), a = Math.abs(d);
  return `transform:translate3d(calc(${d * CSTEP}px + var(--dx,0px)),0,0) scale(${a === 0 ? 1 : a === 1 ? 0.86 : 0.74});opacity:${a <= 1 ? 1 : 0};z-index:${10 - a};--dim:${a === 0 ? 0 : 0.55}`;
}

export interface Card { key: string | number; hue: number; art: ComponentChildren; artStyle?: string; artCls?: string; meta: ComponentChildren; open: () => void }
const pos: Record<string, number> = {};

export function HeroCarousel({ id, cards, top }: { id: string; cards: Card[]; top?: ComponentChildren }) {
  const n = cards.length;
  const [i, setI] = useState(() => Math.min(pos[id] || 0, Math.max(0, n - 1)));
  const [bg, setBg] = useState<[number, number, number]>([cards[i]?.hue ?? 0, cards[i]?.hue ?? 0, 0]);
  const drag = useRef<{ x: number; y: number; moved: boolean; t: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const fastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (k: number, fast = false) => {
    const el = box.current;
    if (el && fast) {
      el.classList.add('fast');
      clearTimeout(fastT.current);
      fastT.current = setTimeout(() => el.classList.remove('fast'), 500);
    }
    const ni = ((k % n) + n) % n;
    pos[id] = ni;
    setI(ni);
    setBg(([a, b, w]) => (w === 0 ? [a, cards[ni].hue, 1] : [cards[ni].hue, b, 0]));
  };
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => {
      if (!document.hidden && !drag.current) go((pos[id] ?? 0) + 1);
    }, 4000);
    return () => clearInterval(t);
  }, [n, id]);
  if (!n) return null;

  // Drag writes straight to the DOM (no re-render per move) so the swipe follows the finger at 60 fps.
  const down = (e: PointerEvent) => (drag.current = { x: e.clientX, y: e.clientY, moved: false, t: Date.now() });
  const move = (e: PointerEvent) => {
    const d = drag.current, el = box.current;
    if (!d || !el) return;
    const x = e.clientX - d.x;
    if (!d.moved && Math.abs(x) > 6 && Math.abs(x) > Math.abs(e.clientY - d.y)) {
      d.moved = true;
      el.classList.add('drag');
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (d.moved) el.style.setProperty('--dx', x + 'px');
  };
  const up = (e: PointerEvent) => {
    const d = drag.current, el = box.current;
    drag.current = null;
    if (!d || !d.moved || !el) return;
    const x = e.clientX - d.x, v = Math.abs(x) / Math.max(1, Date.now() - d.t);
    el.classList.remove('drag');
    el.style.setProperty('--dx', '0px');
    dragged.current = true;
    setTimeout(() => (dragged.current = false), 60);
    if (Math.abs(x) > 36 || v > 0.35) go(i + (x < 0 ? 1 : -1), true);
    else go(i, true);
  };
  return (
    <div class="hcar" ref={box} style="--dx:0px" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div class="hbg">
        <i class={bg[2] === 0 ? 'on' : ''} style={`--h:${bg[0]}`} />
        <i class={bg[2] === 1 ? 'on' : ''} style={`--h:${bg[1]}`} />
      </div>
      <div class="htrack">
        {cards.map((c, k) => (
          <div
            key={c.key}
            class="hc"
            style={carSty(k, i, n)}
            onClick={() => {
              if (dragged.current) return;
              if (k !== i) go(k);
              else c.open();
            }}
          >
            <div class={'hart' + (c.artCls || '')} style={`--h:${c.hue}${c.artStyle || ''}`}>{c.art}</div>
            <div class="hmeta">{c.meta}</div>
            <div class="hov" />
          </div>
        ))}
      </div>
      <div class="hdots">{cards.map((c, k) => <i key={c.key} class={k === i ? 'on' : ''} />)}</div>
      {top}
    </div>
  );
}
