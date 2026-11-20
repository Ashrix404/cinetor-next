import { describe, expect, it } from 'vitest';
import { normKey } from '../../src/shells/tv/keys';

describe('TV key map', () => {
  it('maps every remote key code from the spec', () => {
    for (const c of [4, 461, 10009]) expect(normKey({ keyCode: c })).toBe('back');
    for (const k of ['Escape', 'Backspace', 'GoBack', 'XF86Back']) expect(normKey({ key: k })).toBe('back');
    for (const c of [23, 66, 13]) expect(normKey({ keyCode: c })).toBe('ok');
    expect([19, 20, 21, 22].map((c) => normKey({ keyCode: c }))).toEqual(['up', 'down', 'left', 'right']);
    expect([37, 38, 39, 40].map((c) => normKey({ keyCode: c }))).toEqual(['left', 'up', 'right', 'down']);
    for (const c of [85, 179, 415]) expect(normKey({ keyCode: c })).toBe('playpause');
    for (const c of [89, 412]) expect(normKey({ keyCode: c })).toBe('rew');
    for (const c of [90, 417]) expect(normKey({ keyCode: c })).toBe('ff');
    expect(normKey({ key: 'Unidentified', keyCode: 4 })).toBe('back');
    expect(normKey({ key: 'a', keyCode: 65 })).toBeNull();
  });
});
