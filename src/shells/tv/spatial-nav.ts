// D-pad spatial navigation (prototype `focus` / `move`). One arrow move per 80 ms while a key is held.
let last = 0;
export const $$ = (s: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(s));
export const current = () => document.querySelector<HTMLElement>('.f');

export function focus(el: HTMLElement | null | undefined, onFocus?: (el: HTMLElement) => void) {
  const old = current();
  if (old) old.classList.remove('f');
  if (!el) return;
  el.classList.add('f');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // no smooth scrolling on TV
  onFocus?.(el);
}

export type Dir = 'left' | 'right' | 'up' | 'down';
export function move(dir: Dir, scope: ParentNode, onFocus?: (el: HTMLElement) => void, now = Date.now()): boolean {
  if (now - last < 80) return false;
  last = now;
  const cur = current() || $$('[data-f]', scope)[0];
  if (!cur) return false;
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best: HTMLElement | null = null, bs = 1e9;
  for (const e of $$('[data-f]', scope)) {
    if (e === cur) continue;
    const b = e.getBoundingClientRect();
    if (!b.width) continue;
    const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
    const ok = dir === 'left' ? dx < -4 && Math.abs(dy) < Math.abs(dx) * 1.6
      : dir === 'right' ? dx > 4 && Math.abs(dy) < Math.abs(dx) * 1.6
      : dir === 'up' ? dy < -4 && Math.abs(dx) < Math.abs(dy) * 1.6
      : dy > 4 && Math.abs(dx) < Math.abs(dy) * 1.6;
    if (!ok) continue;
    const d = dir === 'left' || dir === 'right' ? Math.abs(dx) + Math.abs(dy) * 2.2 : Math.abs(dy) + Math.abs(dx) * 2.2;
    if (d < bs) (bs = d), (best = e);
  }
  if (best) focus(best, onFocus);
  return !!best;
}
