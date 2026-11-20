// In-app updates (docs/08 §Updater): check on start (+5 s) and every 6 h, dialog, APK download with
// sha256 verify + install (native), "New version available · Reload" (web).
import { LATEST_URL, VERSION, VERSION_URL } from '../../core/config';
import { isNative } from '../../core/platform';
import { createStore } from '../../core/store';
import { baseCodeOf, fetchManifest, isMandatory, isNewer, isSnoozed, pickApk, snoozeFor, type ApkInfo, type ReleaseManifest } from '../../core/updater';
import { I } from './ui/icons';
import { on, toast } from './state';

interface Upd { m: ReleaseManifest | null; apk: ApkInfo | null; mandatory: boolean; progress: number | null; ready: string | null; web: string | null; perm: boolean; reload?: () => void }
export const upd = createStore<Upd>('upd', { m: null, apk: null, mandatory: false, progress: null, ready: null, web: null, perm: false }, false);
const snooze = createStore<{ s: { version: string; until: number } | null }>('upd-snooze', { s: null }, true);
const flavor = (): 'phone' | 'tv' => (document.documentElement.dataset.shell === 'tv' ? 'tv' : 'phone');

async function nativeInfo() {
  const { CinetorNative } = await import('../../native/cinetor-native');
  return { CinetorNative, info: await CinetorNative.deviceInfo() };
}

/** Returns 'new' | 'none' | 'error'. */
export async function check(manual: boolean): Promise<'new' | 'none' | 'error'> {
  try {
    if (!isNative()) {
      const r = await fetch(VERSION_URL, { cache: 'no-store' });
      const v = ((await r.json()) as { version: string }).version;
      if (v && v !== VERSION && !VERSION.endsWith('-dev')) {
        upd.set({ web: v });
        return 'new';
      }
      return 'none';
    }
    const { info } = await nativeInfo();
    const m = await fetchManifest(LATEST_URL);
    const cur = baseCodeOf(info.versionCode);
    if (!isNewer(m, cur)) return 'none';
    const mandatory = isMandatory(m, cur);
    if (!manual && !mandatory && isSnoozed(snooze.get().s, m.version)) return 'new';
    upd.set({ m, apk: pickApk(m, flavor(), info.abis), mandatory });
    if (on.get().aiu && !mandatory) void download(true);
    return 'new';
  } catch {
    return 'error';
  }
}

export async function checkNow() {
  const r = await check(true);
  if (r === 'none') toast('You are up to date');
  if (r === 'error') toast('Could not check, try again');
}

export function startUpdateChecks() {
  if (!on.get().cos) return;
  setTimeout(() => void check(false), 5000);
  setInterval(() => void check(false), 6 * 3600 * 1000);
  if (!isNative()) addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void check(false));
}

async function download(background = false) {
  const u = upd.get();
  if (!u.apk) return;
  const { CinetorNative } = await nativeInfo();
  upd.set({ progress: 0 });
  const h = await CinetorNative.addListener('updateProgress', (p) => upd.set({ progress: p.bytesTotal ? p.bytesDone / p.bytesTotal : 0 }));
  try {
    const { file } = await CinetorNative.updateDownload({ url: u.apk.url, sha256: u.apk.sha256 });
    upd.set({ progress: null, ready: file });
    if (!background) await install();
  } catch {
    // sha256 mismatch ("checksum") or network: the file is deleted natively, the installer never opens.
    upd.set({ progress: null });
    toast('Update failed, try again');
  } finally {
    void h.remove();
  }
}
async function install() {
  const f = upd.get().ready;
  if (!f) return;
  const { CinetorNative } = await nativeInfo();
  const r = await CinetorNative.updateInstall({ file: f });
  if (r.needsPermission) upd.set({ perm: true });
}
// Retry the install when the user comes back from the "unknown sources" settings screen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && upd.get().perm && upd.get().ready) (upd.set({ perm: false }), void install());
});

const mb = (n: number) => (n / 1048576).toFixed(1) + ' MB';

export function UpdateDialog() {
  const u = upd.get();
  if (u.web)
    return (
      <div class="toast" style="display:flex;gap:12px;align-items:center" onClick={() => (u.reload ? u.reload() : location.reload())}>
        <span>New version available</span><b style="color:#000">Reload</b>
      </div>
    );
  if (!u.m || !u.apk) return null;
  const later = () => (snooze.set({ s: snoozeFor(u.m!.version) }), upd.set({ m: null, apk: null }));
  return (
    <>
      <div class="scrim" style="z-index:75" />
      <div class="dialog" style="z-index:76">
        <h4>Update available · v{u.m.version}</h4>
        {u.m.notes && <p style="white-space:pre-line;max-height:160px;overflow:auto">{u.m.notes}</p>}
        <p class="body-s">{u.apk.size ? mb(u.apk.size) : ''}</p>
        {u.perm && <p class="body-s">Allow Cinetor to install updates, then come back.</p>}
        {u.progress != null && <div class="sld"><div class="t"><b style={`width:${Math.round(u.progress * 100)}%`} /></div><div class="body-s" style="margin-top:6px">{Math.round(u.progress * 100)}%</div></div>}
        <div class="acts">
          {!u.mandatory && u.progress == null && <span class="btn text" onClick={later}>Later</span>}
          {u.progress == null && <span class="btn text" onClick={() => (u.ready ? install() : download())}><I n="download" /> {u.ready ? 'Install' : 'Update now'}</span>}
        </div>
      </div>
    </>
  );
}
