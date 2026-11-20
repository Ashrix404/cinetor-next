// Route name → screen component.
import type { FunctionComponent } from 'preact';
import { Adult, Anime, Comics, Drama, Home } from './feed/feeds';
import { ListPage, Library, Search } from './feed/list';
import { Info } from './info/info';
import { Person } from './info/person';
import { PlayerPage } from './player/page';
import { Downloads } from './dl/page';
import { About, AdultSet, Appearance, DataMgmt, PlayerSettings, Prefs, Settings, SubStylePage } from './settings/settings';
import { TvTab, Watch } from './tvtab/tvtab';
import { Music, NowPlaying } from './music/music';
import { Reader } from './comics/reader';
import { Network } from './settings/network';

type Screen = FunctionComponent & { land?: boolean; bare?: boolean; tab?: string | null };
export const screens: Record<string, Screen> = {
  home: Home, anime: Anime, drama: Drama, comics: Comics, adult: Adult, tv: TvTab, settings: Settings,
  music: Music, nowplaying: NowPlaying, watch: Watch, reader: Reader,
  info: Info, person: Person, list: ListPage, search: Search, library: Library, player: PlayerPage, downloads: Downloads,
  appearance: Appearance, playerset: PlayerSettings, substyle: SubStylePage, prefs: Prefs, data: DataMgmt, adultset: AdultSet, about: About, network: Network,
};
