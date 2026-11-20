import { describe, expect, it } from 'vitest';
import { BYEDPI_PRESETS, DEFAULT_BYEDPI_ARGS, DOH_PROVIDERS, dohHint, netGet, validDohUrl } from '../../src/core/net';

describe('network settings', () => {
  it('has the vega-app provider list and presets', () => {
    expect(DOH_PROVIDERS.map((p) => p.value)).toEqual(['cloudflare', 'google', 'adguard', 'custom', 'off']);
    expect(BYEDPI_PRESETS[0].args).toBe(DEFAULT_BYEDPI_ARGS);
  });
  it('validates DoH URLs', () => {
    expect(validDohUrl('https://dns.example.com/dns-query')).toBe(true);
    expect(validDohUrl('http://dns.example.com/dns-query')).toBe(false);
    expect(validDohUrl('dns.example.com')).toBe(false);
  });
  it('DoH hint follows WARP / AntiDPI', async () => {
    const off = await netGet(); // browser: everything off
    expect(off.warp).toBe(false);
    expect(dohHint({ ...off, warp: true })).toContain('WARP');
    expect(dohHint({ ...off, antiDpi: true })).toContain('ByeDPI');
    expect(dohHint(off)).toContain('Encrypt');
  });
});
