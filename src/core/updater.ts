// Release manifest check (docs/08-updates-and-release.md §Updater).
export type Abi = 'arm64-v8a' | 'armeabi-v7a' | 'x86' | 'x86_64' | 'universal';
export interface ApkInfo { url: string; sha256: string; size: number }
export interface ReleaseManifest {
  version: string; versionCode: number; minVersionCode: number; notes: string; publishedAt: string;
  apk: Record<'phone' | 'tv', Record<Abi, ApkInfo>>;
  web: { version: string };
}

/** `currentCode` is the BASE code (installed versionCode / 10). */
export const isNewer = (m: ReleaseManifest, currentCode: number) => m.versionCode > currentCode;
export const isMandatory = (m: ReleaseManifest, currentCode: number) => currentCode < m.minVersionCode;
export const baseCodeOf = (apkVersionCode: number) => Math.floor(apkVersionCode / 10);

/** APK for the device's first supported ABI, falling back to universal. */
export function pickApk(m: ReleaseManifest, flavor: 'phone' | 'tv', abis: string[]): ApkInfo {
  const set = m.apk[flavor];
  const a = abis.find((x) => x in set && x !== 'universal') as Abi | undefined;
  const hit = a && set[a] && set[a].url ? set[a] : null;
  return hit || set.universal;
}

/** "Later" snoozes this version for 24 h. */
export function isSnoozed(snooze: { version: string; until: number } | null, version: string, now = Date.now()): boolean {
  return !!snooze && snooze.version === version && now < snooze.until;
}
export const snoozeFor = (version: string, now = Date.now()) => ({ version, until: now + 24 * 3600 * 1000 });

export async function fetchManifest(url: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<ReleaseManifest> {
  const r = await fetchFn(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()) as ReleaseManifest;
}

export function compareVersions(a: string, b: string): number {
  const p = (v: string) => v.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
