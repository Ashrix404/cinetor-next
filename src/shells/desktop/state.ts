// Desktop shell state (prototype web App: stack, saved, pin, toasts) on top of the shared core stores.
import { createRouter, type Route } from '../../core/router';
import { createStore } from '../../core/store';
import { createLibrary } from '../../core/library';
import { createAdult, startPin, type PinFlow } from '../../core/pin';
import { installAdultRelock, setAdultUnlocked } from '../../core/adult';
import { createSeriesSettings } from '../../core/series-settings';
import type { Title } from '../../core/tmdb';

export const router = createRouter('home');
export const library = createLibrary();
export const adult = createAdult();
export const series = createSeriesSettings();
export const prefs = createStore('d-prefs', { lg: false, seed: '#FFFFFF' }, true);

export interface DUi {
  adultOk: boolean;
  pin: PinFlow | null;
  pop: string;
  toast: string;
  dls: { t: Title; comic: boolean; season: number } | null;
  reader: { t: Title; ch: number } | null;
  dq: number;
  da: string;
}
export const ui = createStore<DUi>('d-ui', { adultOk: false, pin: null, pop: '', toast: '', dls: null, reader: null, dq: 1080, da: 'Original' }, false);
export const setUi = (p: Partial<DUi>) => ui.set(p);
// One gate for the whole app: core lists (library, downloads) read it (src/core/adult.ts).
ui.subscribe((s) => setAdultUnlocked(s.adultOk));
installAdultRelock(() => {
  ui.set({ adultOk: false, pin: null });
  if (router.stack()[0].name === 'adult') router.root('home');
});

let tt: ReturnType<typeof setTimeout> | undefined, pt: ReturnType<typeof setTimeout> | undefined;
export function toast(m: string) {
  ui.set({ toast: m });
  clearTimeout(tt);
  tt = setTimeout(() => ui.set({ toast: '' }), 1800);
}
export function dlPop(m: string) {
  ui.set({ pop: m });
  clearTimeout(pt);
  pt = setTimeout(() => ui.set({ pop: '' }), 4500);
}
export const cur = (): Route => {
  const s = router.stack();
  return s[s.length - 1];
};
export const param = <T,>(k: string) => cur().params?.[k] as T | undefined;

/** `push`: opening a page on top of the unlocked Adult section (detail, person) keeps it unlocked. */
function gate(r: string, push = false): boolean {
  if (r !== 'adult') {
    if (!(push && router.stack()[0].name === 'adult')) ui.set({ adultOk: false });
    return true;
  }
  if (!adult.isOn()) {
    toast('Turn on Adult section in Settings first');
    return false;
  }
  ui.set({ adultOk: false, pin: startPin('enter') });
  return true;
}
export function go(r: string, params: Record<string, unknown> = {}) {
  if (!gate(r, true)) return;
  router.push({ name: r, params });
  scrollTo(0, 0);
}
export function root(r: string) {
  if (!gate(r)) return router.root('home');
  router.root(r);
  scrollTo(0, 0);
}
export const back = () => void router.pop();
export const open = (t: Title, comic = false) => go('detail', { t, comic: comic || cur().name === 'comics' });
export const toggleLib = (t: Title) => toast(library.toggleSaved(t) ? 'Added to My List' : 'Removed from My List');
