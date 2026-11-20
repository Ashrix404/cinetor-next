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
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const dragged = useRef(false);

  const go = (k: number) => {
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

  const down = (e: PointerEvent) => (drag.current = { x: e.clientX, moved: false });
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const x = e.clientX - d.x;
    if (Math.abs(x) > 6) {
      d.moved = true;
      setDx(x * 0.9);
    }
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    const x = e.clientX - d.x;
    setDx(0);
    dragged.current = true;
    setTimeout(() => (dragged.current = false), 60);
    if (Math.abs(x) > 36) go(i + (x < 0 ? 1 : -1));
  };
  return (
    <div class={'hcar' + (dx ? ' drag' : '')} style={`--dx:${dx}px`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
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
