// TV state (prototype `S`) on top of the shared core stores.
import { createLibrary } from '../../core/library';
import { createAdult, type PinFlow } from '../../core/pin';
import { createSeriesSettings } from '../../core/series-settings';
import type { Title } from '../../core/tmdb';

export const library = createLibrary();
export const adult = createAdult();
export const series = createSeriesSettings();

export interface Frame { view: string; root: string; t?: Title; season?: number; lid?: string; pid?: number; pname?: string }
export const S = {
  view: 'home',
  root: 'home',
  stack: [] as Frame[],
  t: undefined as Title | undefined,
  season: 1,
  lid: '',
  pid: 0,
  pname: '',
  opt: { drama: 'K-Drama', tv: 'Live TV', cat: 'All', sp: 'All', st: 'Recent', pseg: 'Movies' } as Record<string, string>,
  adultOk: false,
  pin: null as PinFlow | null,
  pinBack: 'settings',
  /** "See all" grid paging: how many items are rendered */
  gridN: 24,
  lastF: {} as Record<string, string>,
  q: '',
};
export const frame = (): Frame => ({ view: S.view, root: S.root, t: S.t, season: S.season, lid: S.lid, pid: S.pid, pname: S.pname });
