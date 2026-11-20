// What can really be downloaded for the title/episode the download sheet is open for (mobile + desktop).
// One resolve per (title, season, episode); the sheet shows loading → options / nothing / error + Retry.
import { createStore } from './store';
import { fetchStream } from './stream-resolver';
import { buildOptions, type DlOption } from './dl-options';
import { onMobileData } from './sources';

export interface DlAvail {
  key: string;
  state: 'idle' | 'loading' | 'ready' | 'error';
  opts: DlOption[];
}
export const dlAvail = createStore<DlAvail>('dlavail', { key: '', state: 'idle', opts: [] }, false);

export function loadAvail(titleId: number, title: string, type: string, s: number, e: number, force = false) {
  const key = `${titleId}:${type}:${s}:${e}`;
  const cur = dlAvail.get();
  if (!force && cur.key === key && cur.state !== 'error') return;
  dlAvail.set({ key, state: 'loading', opts: [] });
  void fetchStream(titleId, title, type, s, e).then(
    (res) => {
      if (dlAvail.get().key !== key) return;
      if (!res) return dlAvail.set({ state: 'error', opts: [] });
      dlAvail.set({ state: 'ready', opts: buildOptions(res.direct, { mobile: onMobileData() }) });
    },
    () => dlAvail.get().key === key && dlAvail.set({ state: 'error', opts: [] })
  );
}
