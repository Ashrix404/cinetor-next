import { describe, expect, it, vi } from 'vitest';
import { createExitGuard, createRouter } from '../../src/core/router';

describe('router', () => {
  it('push and pop keep order', () => {
    const r = createRouter('home');
    r.push({ name: 'info', params: { id: 1 } });
    r.push({ name: 'person' });
    expect(r.stack().map((x) => x.name)).toEqual(['home', 'info', 'person']);
    expect(r.pop()).toBe(true);
    expect(r.stack().map((x) => x.name)).toEqual(['home', 'info']);
  });
  it('root() clears the stack', () => {
    const r = createRouter('home');
    r.push({ name: 'a' });
    r.push({ name: 'b' });
    r.root('anime');
    expect(r.stack()).toEqual([{ name: 'anime' }]);
  });
  it('pop() on the root returns false', () => {
    const r = createRouter('home');
    expect(r.pop()).toBe(false);
    expect(r.stack()).toHaveLength(1);
  });
  it('subscribers are called once per change', () => {
    const r = createRouter('home');
    const fn = vi.fn();
    const off = r.subscribe(fn);
    r.push({ name: 'a' });
    r.pop();
    r.pop(); // no change on root
    r.root('x');
    expect(fn).toHaveBeenCalledTimes(3);
    off();
    r.push({ name: 'b' });
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('exit guard needs two presses within the window', () => {
    let t = 0;
    const g = createExitGuard(2000, () => t);
    expect(g()).toBe(false);
    t = 1500;
    expect(g()).toBe(true);
    t = 5000;
    expect(g()).toBe(false);
    t = 8000;
    expect(g()).toBe(false);
  });
});
