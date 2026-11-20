// Accent seed palette (prototype `applyTheme`, `SEEDS`, `mix`, `readable`). Shared by mobile and desktop.
export const SEEDS: [string, string][] = [['White', '#FFFFFF'], ['Tomato', '#FF6347'], ['Gray', '#9E9E9E'], ['Blue', '#2196F3'], ['Lavender', '#B2A4D4']];

const hx = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mix = (c: string, t: string, a: number) => {
  const s = hx(c), u = hx(t);
  return '#' + s.map((v, i) => Math.round(v + (u[i] - v) * a).toString(16).padStart(2, '0')).join('').toUpperCase();
};
export const readable = (c: string) => {
  const [r, g, b] = hx(c);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#17100F' : '#FFFFFF';
};

export function applyTheme(seed: string, root: HTMLElement = document.documentElement): void {
  const p = seed, set = (k: string, v: string) => root.style.setProperty(k, v), neutral = seed === '#FFFFFF' || seed === '#9E9E9E', L = '#171717';
  set('--primary', p); set('--on-primary', readable(p)); set('--p-cont', mix(p, '#000000', 0.48)); set('--on-p-cont', mix(p, '#FFFFFF', 0.82));
  set('--s-cont', mix(p, '#000000', 0.58)); set('--on-s-cont', mix(p, '#FFFFFF', 0.84));
  set('--bg', neutral ? '#000000' : mix(p, '#000000', 0.94)); set('--surface', neutral ? L : mix(p, '#000000', 0.94));
  set('--c-low', neutral ? L : mix(p, '#000000', 0.9)); set('--c', neutral ? L : mix(p, '#000000', 0.86));
  set('--c-high', neutral ? '#222222' : mix(p, '#000000', 0.81)); set('--c-highest', neutral ? '#2c2c2c' : mix(p, '#000000', 0.75));
  set('--outline', neutral ? '#938A88' : '#9E9290'); set('--outline-var', neutral ? '#494240' : '#514846');
}
