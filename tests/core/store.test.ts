import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/core/store';

describe('store', () => {
  beforeEach(() => localStorage.clear());
  it('persists and reloads (round-trip)', () => {
    const a = createStore('t1', { n: 1, s: 'x' }, true);
    a.set({ n: 5 });
    const b = createStore('t1', { n: 1, s: 'x' }, true);
    expect(b.get()).toEqual({ n: 5, s: 'x' });
  });
  it('corrupt JSON falls back to initial', () => {
    localStorage.setItem('cinetor:t2', '{not json');
    const a = createStore('t2', { n: 1 }, true);
    expect(a.get()).toEqual({ n: 1 });
  });
  it('non-persistent stores do not touch storage', () => {
    const a = createStore('t3', { n: 1 }, false);
    a.set({ n: 2 });
    expect(localStorage.getItem('cinetor:t3')).toBeNull();
  });
  it('notifies subscribers', () => {
    const a = createStore('t4', { n: 1 }, false);
    const fn = vi.fn();
    a.subscribe(fn);
    a.set({ n: 3 });
    expect(fn).toHaveBeenCalledWith({ n: 3 });
  });
});
