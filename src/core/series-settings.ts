// Per-series audio / quality / subtitle memory (prototype `saveSeries` / `startAt`).
import { createStore, type Store } from './store';

export type Quality = 2160 | 1080 | 720 | 480 | 360;
export interface SeriesSettings { quality: Quality; audio: string; sub: string }
export const SERIES_DEFAULTS: SeriesSettings = { quality: 1080, audio: 'OG', sub: 'Off' };

/** Accepts a series key or an episode key (`Show|2|1`) and returns the series part. */
export const seriesKey = (k: string | number) => String(k).split('|')[0];

export function createSeriesSettings(store: Store<Record<string, SeriesSettings>> = createStore('series', {}, true)) {
  return {
    load(k: string | number): SeriesSettings {
      return { ...SERIES_DEFAULTS, ...(store.get()[seriesKey(k)] || {}) };
    },
    save(k: string | number, s: Partial<SeriesSettings>) {
      const key = seriesKey(k);
      store.set({ ...store.get(), [key]: { ...SERIES_DEFAULTS, ...(store.get()[key] || {}), ...s } });
    },
  };
}
export type SeriesSettingsStore = ReturnType<typeof createSeriesSettings>;
