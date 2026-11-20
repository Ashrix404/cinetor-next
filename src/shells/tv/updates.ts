// TV update prompt (docs/08 §Updater): D-pad focusable dialog, APK download + sha256 verify + install.
import { LATEST_URL } from '../../core/config';
import { isNative } from '../../core/platform';
import { baseCodeOf, fetchManifest, isMandatory, isNewer, isSnoozed, pickApk, snoozeFor, type ApkInfo, type ReleaseManifest } from '../../core/updater';
import { I } from './icons';
import { focus } from './spatial-nav';

let st: { m: ReleaseManifest; apk: ApkInfo; mandatory: boolean } | null = null;
const SNOOZE = 'cinetor:upd-snooze';
const snooze = () => {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE) || 'null') as { version: string; until: number } | null;
  } catch {
    return null;
  }
};

export async function checkUpdate(manual: boolean, toast: (m: string) => void) {
  if (!isNative()) return manual && toast('Updates are installed from the app on the TV');
  try {
    const { CinetorNative } = await import('../../native/cinetor-native');
    const info = await CinetorNative.deviceInfo();
    const m = await fetchManifest(LATEST_URL);
    const cur = baseCodeOf(info.versionCode);
    if (!isNewer(m, cur)) return manual && toast('You are up to date');
    const mandatory = isMandatory(m, cur);
    if (!manual && !mandatory && isSnoozed(snooze(), m.version)) return;
    st = { m, apk: pickApk(m, 'tv', info.abis), mandatory };
    draw('');
  } catch {
    if (manual) toast('Could not check, try again');
  }
}

function draw(progress: string) {
  if (!st) return document.getElementById('upd')?.remove();
  let el = document.getElementById('upd');
  if (!el) {
    el = document.createElement('div');
    el.id = 'upd';
    el.className = 'pc';
    el.setAttribute('style', 'position:absolute;inset:0;z-index:90;background:rgba(0,0,0,.92)');
    document.getElementById('tv')!.appendChild(el);
  }
  el.innerHTML = `<h2>Update available · v${st.m.version}</h2><div class="sub" style="max-width:640px;white-space:pre-line">${st.m.notes.slice(0, 400)}</div><div class="sub">${(st.apk.size / 1048576).toFixed(1)} MB${progress ? ' · ' + progress : ''}</div><div class="btns" style="margin-top:20px"><span class="btn p" data-f data-upd="now">${I('play')} Update now</span>${st.mandatory ? '' : '<span class="btn" data-f data-upd="later">Later</span>'}</div>`;
  focus(el.querySelector<HTMLElement>('[data-upd="now"]'));
}

export const updateDialog = {
  open: () => !!st,
  async act(a: string, toast: (m: string) => void) {
    if (!st) return;
    if (a === 'later') {
      if (st.mandatory) return;
      localStorage.setItem(SNOOZE, JSON.stringify(snoozeFor(st.m.version)));
      st = null;
      return draw('');
    }
    const { CinetorNative } = await import('../../native/cinetor-native');
    const h = await CinetorNative.addListener('updateProgress', (p) => draw(p.bytesTotal ? Math.round((p.bytesDone / p.bytesTotal) * 100) + '%' : ''));
    try {
      const { file } = await CinetorNative.updateDownload({ url: st.apk.url, sha256: st.apk.sha256 });
      const r = await CinetorNative.updateInstall({ file });
      if (r.needsPermission) draw('Allow Cinetor to install updates, then press OK again');
    } catch {
      toast('Update failed, try again'); // checksum mismatch → file deleted, installer never opened
      draw('');
    } finally {
      void h.remove();
    }
  },
};
