// My Library, Continue watching and per-episode watch progress (persisted).
import { visible } from './adult';
import { createStore, type Store } from './store';
import type { Title } from './tmdb';

export interface ContinueItem { title: Title; season: number; episode: number; progress: number; at: number }
interface LibState {
  saved: Title[];
  cw: ContinueItem[];
  /** key `${titleId}|${season}|${episode}` → 0..1 */
  watch: Record<string, number>;
  /** comics: key `${titleId}|${chapter}` → last page (1-based) */
  read: Record<string, number>;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
export const epKey = (titleId: number, season: number, episode: number) => `${titleId}|${season}|${episode}`;

export function createLibrary(store: Store<LibState> = createStore<LibState>('library', { saved: [], cw: [], watch: {}, read: {} }, true)) {
  const st = () => store.get();
  return {
    store,
    isSaved: (id: number) => st().saved.some((t) => t.id === id),
    toggleSaved(t: Title): boolean {
      const on = st().saved.some((x) => x.id === t.id);
      store.set({ saved: on ? st().saved.filter((x) => x.id !== t.id) : [t, ...st().saved] });
      return !on;
    },
    /** Adult titles are hidden unless the Adult section is unlocked (src/core/adult.ts). */
    saved: () => visible(st().saved),
    progress: (titleId: number, season = 1, episode = 1) => st().watch[epKey(titleId, season, episode)] || 0,
    /** Save progress; updates Continue watching (finished items ≥ 0.98 leave the row). */
    setProgress(t: Title, season: number, episode: number, p: number) {
      const v = clamp01(p);
      const watch = { ...st().watch, [epKey(t.id, season, episode)]: v };
      const rest = st().cw.filter((c) => c.title.id !== t.id);
      const cw = v >= 0.98 ? rest : [{ title: t, season, episode, progress: v, at: Date.now() }, ...rest].slice(0, 20);
      store.set({ watch, cw });
    },
    continueWatching: () => {
      const ok = new Set(visible(st().cw.map((c) => c.title)).map((t) => t.id));
      return st().cw.filter((c) => ok.has(c.title.id));
    },
    removeContinue: (titleId: number) => store.set({ cw: st().cw.filter((c) => c.title.id !== titleId) }),
    clearContinue: () => store.set({ cw: [] }),
    clearProgress: () => store.set({ watch: {}, cw: [], read: {} }),
    lastPage: (titleId: number, chapter: number) => st().read[`${titleId}|${chapter}`] || 0,
    setPage: (titleId: number, chapter: number, page: number) => store.set({ read: { ...st().read, [`${titleId}|${chapter}`]: page } }),
  };
}
export type Library = ReturnType<typeof createLibrary>;
