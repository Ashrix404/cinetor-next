// Central adult/NSFW classifier + isolation gate. Every list outside the Adult section goes
// through `sanitize` (always) or `visible` (library/history/downloads: shown only while unlocked).
import { clearAdultCache, type Title } from './tmdb';

/** Strong NSFW words in a title or overview (case-insensitive, whole words). */
const NSFW_TEXT = /\b(erotic\w*|erotica|porn\w*|softcore|hardcore sex|hentai|nympho\w*|orgy|orgies|sex tape|kama ?sutra|playboy|penthouse|emmanuelle|stripper\w*|striptease|fetish\w*|bdsm|adult film|adult video|jav)\b/i;

/**
 * Anything that may involve minors (or incest). Such titles are NEVER shown in the Adult
 * section and are dropped from it entirely; the list errs on the side of excluding.
 */
const MINOR_RISK = /\b(teen\w*|under ?age\w*|minors?|child\w*|kids?|school\w*|pupils?|students?|lolita|loli|lolicon|shota\w*|jailbait|barely legal|young girls?|little girls?|little boys?|boys?|stepdaughter|stepson|step-?sister|step-?brother|incest\w*|(?:1[0-7]|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[- ]year[- ]olds?)\b/i;

/** TMDB genres never allowed in the Adult section: Animation, Family, Kids. */
export const ADULT_BLOCKED_GENRES = [16, 10751, 10762];

// ---- registry of titles that came from the Adult section (persisted ids only, no content) ----
const REG_KEY = 'cinetor:adult-ids';
const REG_MAX = 3000;
let reg: Set<string> | null = null;
const rk = (mediaType: string, id: number) => (mediaType === 'tv' ? 't' : 'm') + id;

function registry(): Set<string> {
  if (reg) return reg;
  reg = new Set();
  try {
    const raw = localStorage.getItem(REG_KEY);
    if (raw) for (const k of JSON.parse(raw) as string[]) reg.add(k);
  } catch {
    /* blocked or corrupt */
  }
  return reg;
}
function saveRegistry(): void {
  try {
    localStorage.setItem(REG_KEY, JSON.stringify([...registry()].slice(-REG_MAX)));
  } catch {
    /* quota: memory only */
  }
}
/** Remember these titles as adult so they stay hidden elsewhere (also after a relaunch). */
export function markAdult(list: Pick<Title, 'id' | 'mediaType'>[]): void {
  const r = registry();
  const n = r.size;
  for (const t of list) r.add(rk(t.mediaType, t.id));
  if (r.size !== n) saveRegistry();
}
/** True when a TMDB id (either media type) is a known adult title; used for downloads (no media type). */
export const isAdultId = (id: number): boolean => registry().has('m' + id) || registry().has('t' + id);
/** Tests only. */
export function resetAdultRegistry(): void {
  reg = new Set();
  try {
    localStorage.removeItem(REG_KEY);
  } catch {
    /* blocked */
  }
}

// ---- classifier ----------------------------------------------------------------
type T = Pick<Title, 'id' | 'mediaType' | 'title' | 'overview'> & { adult?: boolean; genreIds?: number[] };

export const isNsfwText = (s: string): boolean => NSFW_TEXT.test(s);
export const isMinorRisk = (t: Pick<Title, 'title' | 'overview'>): boolean => MINOR_RISK.test(t.title + ' ' + (t.overview || ''));

/** True for anything that must stay inside the Adult section. */
export function isAdultTitle(t: T): boolean {
  if (t.adult) return true;
  if (registry().has(rk(t.mediaType, t.id))) return true;
  return isNsfwText(t.title + ' ' + (t.overview || ''));
}

/** Drop adult titles. Used by every non-adult feed, search, similar, person and recents list. */
export function sanitize<X extends T>(list: X[]): X[] {
  return list.filter((t) => !isAdultTitle(t));
}

/** Items allowed in the Adult section: no minor risk, no animation/family/kids; tagged `adult`. */
export function adultOnly(list: Title[]): Title[] {
  const out = list
    .filter((t) => !isMinorRisk(t) && !t.genreIds.some((g) => ADULT_BLOCKED_GENRES.includes(g)))
    .map((t) => ({ ...t, adult: true as const }));
  markAdult(out);
  return out;
}

// ---- session gate (never persisted: a relaunch is always locked) ---------------------------
let unlocked = false;
const subs = new Set<(v: boolean) => void>();
/** Shells call this whenever their PIN state (`adultOk`) changes. */
export function setAdultUnlocked(v: boolean): void {
  if (v === unlocked) return;
  unlocked = v;
  if (!v) clearAdultCache();
  subs.forEach((f) => f(v));
}
/**
 * Re-lock when the app/tab goes to the background (Android WebView fires visibilitychange on
 * pause). `lock` must reset the shell's `adultOk` and leave the Adult section.
 */
export function installAdultRelock(lock: () => void): void {
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && unlocked) lock();
    });
  } catch {
    /* no document (tests) */
  }
}
export const isAdultUnlocked = (): boolean => unlocked;
export const onAdultLock = (f: (v: boolean) => void) => (subs.add(f), () => subs.delete(f));

/** Library / history / downloads: adult items show only while the Adult section is unlocked. */
export function visible<X extends T>(list: X[]): X[] {
  return unlocked ? list : sanitize(list);
}

/**
 * Playback policy for the player (PiP, background audio, media notification, history).
 * Adult titles never go to PiP / mini player / lock-screen media controls, and history is
 * only written while unlocked (it is still hidden from non-adult UI by `visible`).
 */
export function adultPolicy(t: T): { adult: boolean; allowPip: boolean; allowBackground: boolean; showMediaMeta: boolean; recordHistory: boolean } {
  const a = isAdultTitle(t);
  return { adult: a, allowPip: !a, allowBackground: !a, showMediaMeta: !a, recordHistory: !a || unlocked };
}
