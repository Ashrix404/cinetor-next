import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADULT_BLOCKED_GENRES,
  adultOnly,
  adultPolicy,
  isAdultId,
  isAdultTitle,
  isAdultUnlocked,
  isMinorRisk,
  isNsfwText,
  markAdult,
  onAdultLock,
  resetAdultRegistry,
  sanitize,
  setAdultUnlocked,
  visible,
} from '../../src/core/adult';
import type { Title } from '../../src/core/tmdb';

describe('adult classifier & isolation', () => {
  beforeEach(() => {
    resetAdultRegistry();
    setAdultUnlocked(false);
  });

  const normalMovie: Title = { id: 101, mediaType: 'movie', title: 'Inception', overview: 'A thief steals corporate secrets through dream-sharing.', genreIds: [28, 878], poster: null, backdrop: null, rating: 8, year: '2026' };
  const nsfwMovie: Title = { id: 202, mediaType: 'movie', title: 'Erotic Nights', overview: 'A romantic erotic drama in Paris.', genreIds: [10749], poster: null, backdrop: null, rating: 7, year: '2026' };
  const minorRiskMovie: Title = { id: 303, mediaType: 'movie', title: 'High School Secrets', overview: 'Teen students in drama class.', genreIds: [18], poster: null, backdrop: null, rating: 6, year: '2026' };
  const kidAnimation: Title = { id: 404, mediaType: 'movie', title: 'Cartoon Fun', overview: 'Fun animated tale', genreIds: [16, 10751], poster: null, backdrop: null, rating: 8, year: '2026' };

  it('identifies nsfw text and adult titles', () => {
    expect(isAdultTitle(normalMovie)).toBe(false);
    expect(isAdultTitle(nsfwMovie)).toBe(true);
    expect(isNsfwText('An erotic adventure')).toBe(true);
    expect(isNsfwText('A peaceful journey')).toBe(false);
  });

  it('detects minor risk keywords', () => {
    expect(isMinorRisk(normalMovie)).toBe(false);
    expect(isMinorRisk(minorRiskMovie)).toBe(true);
  });

  it('sanitizes feeds outside adult section', () => {
    const list = [normalMovie, nsfwMovie];
    const safe = sanitize(list);
    expect(safe).toEqual([normalMovie]);
  });

  it('filters adultOnly pool: drops minor risk and kid animation, marks adult: true', () => {
    const pool = [normalMovie, nsfwMovie, minorRiskMovie, kidAnimation];
    const out = adultOnly(pool);
    expect(out.some((t) => t.id === minorRiskMovie.id)).toBe(false);
    expect(out.some((t) => t.id === kidAnimation.id)).toBe(false);
    expect(out.find((t) => t.id === nsfwMovie.id)?.adult).toBe(true);
  });

  it('visible() gates library and downloads: hidden while locked, shown while unlocked', () => {
    const adultItem = adultOnly([nsfwMovie])[0];
    const items = [normalMovie, adultItem];

    // Locked
    expect(visible(items)).toEqual([normalMovie]);

    // Unlocked
    setAdultUnlocked(true);
    expect(visible(items)).toEqual([normalMovie, adultItem]);
  });

  it('adultPolicy enforces strict isolation for adult items', () => {
    // Normal title has full playback features allowed
    const normalPol = adultPolicy(normalMovie);
    expect(normalPol).toEqual({
      adult: false,
      allowPip: true,
      allowBackground: true,
      showMediaMeta: true,
      recordHistory: true,
    });

    // Adult title while locked: no PiP, no background, no media meta, no history
    const adultPolLocked = adultPolicy(nsfwMovie);
    expect(adultPolLocked).toEqual({
      adult: true,
      allowPip: false,
      allowBackground: false,
      showMediaMeta: false,
      recordHistory: false,
    });

    // Adult title while unlocked: record history is allowed, but PiP/background/media meta still disabled
    setAdultUnlocked(true);
    const adultPolUnlocked = adultPolicy(nsfwMovie);
    expect(adultPolUnlocked).toEqual({
      adult: true,
      allowPip: false,
      allowBackground: false,
      showMediaMeta: false,
      recordHistory: true,
    });
  });

  it('persists adult IDs and recognizes isAdultId across media types', () => {
    expect(isAdultId(999)).toBe(false);
    markAdult([{ id: 999, mediaType: 'movie' }, { id: 888, mediaType: 'tv' }]);
    expect(isAdultId(999)).toBe(true);
    expect(isAdultId(888)).toBe(true);
    expect(isAdultTitle({ id: 999, mediaType: 'movie', title: 'Clean Name', overview: 'Clean description' })).toBe(true);
  });

  it('onAdultLock notifies subscribers when lock state toggles', () => {
    const states: boolean[] = [];
    const unsub = onAdultLock((v) => states.push(v));

    setAdultUnlocked(true);
    expect(isAdultUnlocked()).toBe(true);
    setAdultUnlocked(false);
    expect(isAdultUnlocked()).toBe(false);
    unsub();
    setAdultUnlocked(true);

    expect(states).toEqual([true, false]);
  });

  it('blocks animation, family, and kids genres from adult section', () => {
    expect(ADULT_BLOCKED_GENRES).toEqual([16, 10751, 10762]);
  });
});
