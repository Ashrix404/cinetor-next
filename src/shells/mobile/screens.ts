// Route name → screen component.
import type { FunctionComponent } from 'preact';
import { Adult, Anime, Comics, Drama, Home } from './feed/feeds';
import { PlayerPage } from './player/page';
import { Placeholder } from './ui/placeholder';

type Screen = FunctionComponent & { land?: boolean; bare?: boolean; tab?: string | null };
export const screens: Record<string, Screen> = {
  home: Home,
  anime: Anime,
  drama: Drama,
  comics: Comics,
  adult: Adult,
  player: PlayerPage,
  tv: Placeholder,
  settings: Placeholder,
};
