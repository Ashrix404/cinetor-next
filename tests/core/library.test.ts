import { beforeEach, describe, expect, it } from 'vitest';
import { createLibrary } from '../../src/core/library';
import { createSeriesSettings } from '../../src/core/series-settings';
import { createAdult, pinHash, pinPress, startPin, type PinFlow } from '../../src/core/pin';
import { createStore } from '../../src/core/store';
import type { Title } from '../../src/core/tmdb';

const show: Title = { id: 7, mediaType: 'tv', title: 'Show', poster: '/p', backdrop: null, rating: 8, year: '2024', overview: '', genreIds: [] };
const mem = <T extends object>(k: string, v: T) => createStore(k, v, false);

describe('library', () => {
  beforeEach(() => localStorage.clear());
  it('clamps watch progress to 0..1', () => {
    const lib = createLibrary(mem('l', { saved: [], cw: [], watch: {}, read: {} }));
    lib.setProgress(show, 1, 1, 1.7);
    expect(lib.progress(7, 1, 1)).toBe(1);
    lib.setProgress(show, 1, 2, -3);
    expect(lib.progress(7, 1, 2)).toBe(0);
    lib.setProgress(show, 1, 3, NaN);
    expect(lib.progress(7, 1, 3)).toBe(0);
  });
  it('continue watching: remove and clear', () => {
    const lib = createLibrary(mem('l', { saved: [], cw: [], watch: {}, read: {} }));
    lib.setProgress(show, 1, 4, 0.62);
    lib.setProgress({ ...show, id: 8, title: 'B' }, 1, 1, 0.2);
    expect(lib.continueWatching().map((c) => c.title.id)).toEqual([8, 7]);
    lib.removeContinue(8);
    expect(lib.continueWatching().map((c) => c.title.id)).toEqual([7]);
    lib.clearContinue();
    expect(lib.continueWatching()).toEqual([]);
  });
  it('My Library toggles', () => {
    const lib = createLibrary(mem('l', { saved: [], cw: [], watch: {}, read: {} }));
    expect(lib.toggleSaved(show)).toBe(true);
    expect(lib.isSaved(7)).toBe(true);
    expect(lib.toggleSaved(show)).toBe(false);
  });
});

describe('series settings', () => {
  it('settings saved on S1E6 apply to S2E1', () => {
    const ss = createSeriesSettings(mem('s', {}));
    ss.save('Show|1|6', { quality: 720, audio: 'Hindi', sub: 'bn' });
    expect(ss.load('Show|2|1')).toEqual({ quality: 720, audio: 'Hindi', sub: 'bn' });
    expect(ss.load('Other|1|1')).toEqual({ quality: 1080, audio: 'OG', sub: 'Off' });
  });
});

describe('pin', () => {
  it('matches the prototype hash', () => {
    // prototype: [...x].reduce((a,c)=>(a*131+c.charCodeAt(0))>>>0,17)+''
    expect(pinHash('1234')).toBe(String([...'1234'].reduce((a, c) => (a * 131 + c.charCodeAt(0)) >>> 0, 17)));
  });
  it('rejects a wrong PIN and disabling clears the hash', () => {
    const a = createAdult(mem('a', { on: false, pin: '' }));
    a.enableAdult('1234');
    expect(a.verify('0000')).toBe(false);
    expect(a.verify('1234')).toBe(true);
    expect(a.disableAdult('9999')).toBe(false);
    expect(a.disableAdult('1234')).toBe(true);
    expect(a.store.get()).toEqual({ on: false, pin: '' });
  });
  it('changePin needs the old PIN', () => {
    const a = createAdult(mem('a', { on: false, pin: '' }));
    a.enableAdult('1111');
    expect(a.changePin('2222', '3333')).toBe(false);
    expect(a.changePin('1111', '3333')).toBe(true);
    expect(a.verify('3333')).toBe(true);
  });
  it('keypad flow: create, confirm mismatch, confirm, enter wrong, enter right', () => {
    const a = createAdult(mem('a', { on: false, pin: '' }));
    const type = (f: PinFlow, s: string) => {
      let r: ReturnType<typeof pinPress> = { flow: f, outcome: 'none' };
      for (const k of s) r = pinPress(r.flow!, k, a);
      return r;
    };
    let r = type(startPin('set'), '1234');
    expect(r.flow?.step).toBe('set2');
    r = type(r.flow!, '9999');
    expect(r.flow?.msg).toBe('PINs did not match');
    r = type(r.flow!, '1234');
    r = type(r.flow!, '1234');
    expect(r.outcome).toBe('enabled');
    r = type(startPin('enter'), '0000');
    expect(r.flow?.msg).toBe('Wrong PIN, try again');
    r = type(r.flow!, '1234');
    expect(r.outcome).toBe('unlocked');
    r = type(startPin('off'), '1234');
    expect(r.outcome).toBe('disabled');
    expect(a.isOn()).toBe(false);
  });
});
