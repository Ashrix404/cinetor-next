// Mobile shell state: router stack + UI store + persisted toggles (prototype `ST`, `nav`, `back`, `toast`).
import { createRouter, createExitGuard, type Route } from '../../core/router';
import { createStore } from '../../core/store';
import { createLibrary } from '../../core/library';
import { createAdult, startPin, type PinFlow } from '../../core/pin';
import { createSeriesSettings } from '../../core/series-settings';
import type { Title } from '../../core/tmdb';

export const router = createRouter('home');
export const library = createLibrary();
export const adult = createAdult();
export const series = createSeriesSettings();

export const TABS = ['home', 'anime', 'drama', 'tv', 'settings'];

/** Download sheet state (prototype `ST.dls`). */
export interface DlSheet { title: Title; s: number; kind: 'series' | 'comic' | 'movie'; sel: Record<number, boolean>; sels: Record<number, Record<number, boolean>> }
export interface Ui {
  drawer: boolean;
  drawerOut: boolean;
  sheet: string | false;
  dialog: string | null;
  pin: PinFlow | null;
  adultOk: boolean;
  season: number;
  more: boolean;
  dls: DlSheet | null;
  q: string;
  sq: string | null;
  epsS: number | null;
  opt: Record<string, string>;
  toast: { msg: string; view?: boolean; id: number } | null;
  pathDlg: boolean;
  tab3: string;
  fav: Record<number, boolean>;
  /** session-only download choices (prototype ST.dq / ST.da) */
  dq: number;
  da: string;
}
export const ui = createStore<Ui>('ui', {
  drawer: false, drawerOut: false, sheet: false, dialog: null, pin: null, adultOk: false, season: 1, more: false, dls: null, q: '', sq: null, epsS: null,
  opt: { drama: 'K-Drama', comics: 'Manga', tv: 'Live TV', sp: 'All', st: 'Recent', tvcat: 'All', scroll: 'grid', pseg: 'Movies', favOnly: '' },
  toast: null, pathDlg: false, tab3: 'Info', fav: {}, dq: 1080, da: 'OG',
}, false);

/** Persisted switches (prototype `ST.on` + `sw(k,d)` defaults). */
export const ON_DEFAULTS: Record<string, boolean> = {
  lg: false, wall: false, dyn: true, ov: true, lf: false, ac: false, amb: true, nm: true, hs: false, aup: true, hap: true, tbl: true, hdl: false, ham: true,
  cw: true, dd: false, ed: false, sw2: false, crash: true, sync: false, aiu: false, cos: true,
};
export const on = createStore<Record<string, boolean>>('on', { ...ON_DEFAULTS }, true);
export const toggle = (k: string) => on.set({ [k]: !on.get()[k] });

export const theme = createStore('theme', { seed: '#FFFFFF' }, true);

export const setUi = (p: Partial<Ui>) => ui.set(p);
export const opt = (k: string) => ui.get().opt[k] || '';
export const setOpt = (k: string, v: string) => ui.set({ opt: { ...ui.get().opt, [k]: v } });

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, view = false) {
  const id = ++toastId;
  ui.set({ toast: { msg, view, id } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (ui.get().toast?.id === id) ui.set({ toast: null });
  }, view ? 4500 : 1800);
}
export const dlPop = (m: string) => toast(m, true);

export const cur = (): Route => {
  const s = router.stack();
  return s[s.length - 1];
};
export const param = <T,>(k: string): T | undefined => cur().params?.[k] as T | undefined;

function openAdult(): boolean {
  if (!adult.isOn()) {
    toast('Turn on Adult section in Settings first');
    return false;
  }
  ui.set({ adultOk: false, pin: startPin('enter') });
  return true;
}

/** Prototype `nav`. */
export function nav(name: string, params: Record<string, unknown> = {}, o: { root?: boolean } = {}) {
  if (name === 'adult') {
    if (!openAdult()) return;
  } else ui.set({ adultOk: false, pin: null });
  ui.set({ dls: null, drawer: false, sheet: false, dialog: null });
  if (name === 'search') ui.set({ q: '' });
  if (name === 'info') ui.set({ season: 1, more: false });
  if (o.root) router.root(name);
  if (!o.root) router.push({ name, params });
}

/** Prototype `back` (in-app back arrow). */
export function back() {
  ui.set({ dls: null, drawer: false, sheet: false, dialog: null });
  if (!router.pop() && cur().name !== 'home') router.root('home');
}

const exitGuard = createExitGuard(2000);
/**
 * Hardware Back: closes drawer → sheet / dialog / PIN → PiP → player → page.
 * Returns false when the app should exit (second press on the root page).
 */
export function hardwareBack(closePlayer: () => boolean): boolean {
  const u = ui.get();
  if (u.drawer) return (ui.set({ drawer: false }), true);
  if (u.pin) return (ui.set({ pin: null }), cur().name === 'adult' && router.root('home'), true);
  if (u.sheet || u.dls || u.dialog || u.pathDlg) return (ui.set({ sheet: false, dls: null, dialog: null, pathDlg: false }), true);
  if (closePlayer()) return true;
  if (router.stack().length > 1) return (back(), true);
  if (cur().name !== 'home') return (router.root('home'), true);
  if (exitGuard()) return false;
  toast('Press back again to exit');
  return true;
}
