import { describe, expect, it } from 'vitest';

describe('tooling', () => {
  it('runs unit tests in CI', () => {
    expect([1, 2, 3].map((n) => n * 2)).toEqual([2, 4, 6]);
  });
});
