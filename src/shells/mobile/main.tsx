import { render } from 'preact';
import './app.css';
import './glass.css';
import { App, installBack } from './app';
import { startUpdateChecks } from './updates';
import { wireDownloadToasts } from './dl/page';
import { isNative } from '../../core/platform';

/** Edge-to-edge in the APK: the WebView draws under the status bar, icons stay light (T33). */
async function edgeToEdge() {
  if (!isNative()) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
}

render(<App />, document.getElementById('app-root')!);
installBack();
void edgeToEdge();
startUpdateChecks();
wireDownloadToasts();
