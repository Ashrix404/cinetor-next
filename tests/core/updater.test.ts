import { describe, expect, it } from 'vitest';
import { baseCodeOf, compareVersions, isMandatory, isNewer, isSnoozed, pickApk, snoozeFor, type ReleaseManifest } from '../../src/core/updater';

const a = (n: string) => ({ url: 'https://x/' + n + '.apk', sha256: 'h' + n, size: 1 });
const m: ReleaseManifest = {
  version: '0.2.0', versionCode: 200, minVersionCode: 100, notes: '', publishedAt: '',
  apk: {
    phone: { 'arm64-v8a': a('p64'), 'armeabi-v7a': a('p32'), x86: a('px86'), x86_64: a('px64'), universal: a('pu') },
    tv: { 'arm64-v8a': a('t64'), 'armeabi-v7a': a('t32'), x86: a('tx86'), x86_64: a('tx64'), universal: a('tu') },
  },
  web: { version: '0.2.0' },
};

describe('updater', () => {
  it('isNewer compares base codes', () => {
    expect(isNewer(m, 100)).toBe(true);
    expect(isNewer(m, 200)).toBe(false);
    expect(baseCodeOf(1002)).toBe(100);
  });
  it('pickApk: exact ABI, fallback to universal, unknown ABI', () => {
    expect(pickApk(m, 'phone', ['arm64-v8a', 'armeabi-v7a']).url).toContain('p64');
    expect(pickApk(m, 'tv', ['armeabi-v7a']).url).toContain('t32');
    expect(pickApk(m, 'phone', ['mips']).url).toContain('pu');
    expect(pickApk({ ...m, apk: { ...m.apk, phone: { ...m.apk.phone, 'arm64-v8a': { url: '', sha256: '', size: 0 } } } }, 'phone', ['arm64-v8a']).url).toContain('pu');
  });
  it('mandatory below minVersionCode', () => {
    expect(isMandatory(m, 99)).toBe(true);
    expect(isMandatory(m, 100)).toBe(false);
  });
  it('snooze for 24 h per version', () => {
    const s = snoozeFor('0.2.0', 0);
    expect(isSnoozed(s, '0.2.0', 1000)).toBe(true);
    expect(isSnoozed(s, '0.2.0', 25 * 3600 * 1000)).toBe(false);
    expect(isSnoozed(s, '0.3.0', 1000)).toBe(false);
  });
  it('compares versions', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});
