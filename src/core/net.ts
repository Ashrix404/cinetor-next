// Network modes (same set as vega-app): WARP, AntiDPI (ByeDPI) and DNS over HTTPS.
// Only the Android app (phone + TV) can apply them: browsers do not let a page change DNS or proxy.
import { isNative } from './platform';
import type { NetState } from '../native/cinetor-native';

export type { NetState };
export const DOH_PROVIDERS = [
  { label: 'Cloudflare (1.1.1.1)', value: 'cloudflare' },
  { label: 'Google (8.8.8.8)', value: 'google' },
  { label: 'AdGuard', value: 'adguard' },
  { label: 'Custom', value: 'custom' },
  { label: 'Off', value: 'off' },
] as const;
export const DEFAULT_BYEDPI_ARGS = '--split 1 --disorder 1 --auto=torst';
export const BYEDPI_PRESETS = [
  { id: 'split_disorder', name: 'Split & Disorder', args: '--split 1 --disorder 1 --auto=torst', description: 'Recommended for all networks and CDNs' },
  { id: 'disorder', name: 'Disorder only', args: '--disorder 1 --auto=torst', description: 'Reorders first byte to bypass SNI inspect' },
  { id: 'split', name: 'Split only', args: '--split 1', description: 'Splits TLS handshake into 2 segments' },
  { id: 'fake_oob', name: 'Fake packet (OOB)', args: '-s 1 -q 1 -Y', description: 'Aggressive bypass for strict firewalls' },
];
export const netSupported = () => isNative();
export const WEB_NOTE = 'Available in the Android app (phone and TV). A browser does not allow websites to change DNS or route traffic through WARP or AntiDPI; use your browser or system settings (for example Secure DNS in Chrome) instead.';

const OFF: NetState = { warp: false, antiDpi: false, antiDpiArgs: DEFAULT_BYEDPI_ARGS, doh: 'off', dohUrl: '', warpRunning: false, antiDpiRunning: false, error: '' };

export async function netGet(): Promise<NetState> {
  if (!isNative()) return OFF;
  const { CinetorNative } = await import('../native/cinetor-native');
  return CinetorNative.netGet();
}
export async function netSet(p: Partial<Pick<NetState, 'warp' | 'antiDpi' | 'antiDpiArgs' | 'doh' | 'dohUrl'>>): Promise<NetState> {
  if (!isNative()) return OFF;
  const { CinetorNative } = await import('../native/cinetor-native');
  return CinetorNative.netSet(p);
}
/** DoH subtitle, same wording as vega-app. */
export const dohHint = (s: NetState) => (s.warp ? 'Managed by Cloudflare WARP (resolved remotely)' : s.antiDpi ? 'Works in synergy with ByeDPI for DNS privacy' : 'Encrypt DNS queries with secure resolver');
export const validDohUrl = (u: string) => /^https:\/\/[^\s/]+\/\S*$/.test(u.trim());
