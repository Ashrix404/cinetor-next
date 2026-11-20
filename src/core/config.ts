// Build-time constants. Values come from Vite env at build time (CI), never from the repo.
const env = import.meta.env ?? {};

export const APP_NAME = 'Cinetor';
export const DEVELOPER = 'Developed by Mythbrix';
export const VERSION: string = env.VITE_APP_VERSION || '0.0.0-dev';
/** Base version code (X*10000 + Y*100 + Z). The APK adds an ABI digit on top. */
export const VERSION_CODE: number = Number(env.VITE_APP_CODE || 0);
/** TMDB token injected from the TMDB_TOKEN secret. Empty in local/dev builds. */
export const TMDB_TOKEN: string = env.VITE_TMDB_TOKEN || '';
export const TMDB_API = 'https://api.themoviedb.org/3';
export const TMDB_IMG = 'https://image.tmdb.org/t/p/';
export const SITE_BASE = 'https://ashrix404.github.io/cinetor-releases/';
export const MEDIA_BASE = SITE_BASE + 'media/';
export const LATEST_URL = SITE_BASE + 'latest.json';
export const VERSION_URL = SITE_BASE + 'version.json';
