import { render } from 'preact';
import './desktop.css';
import { App } from './app';
import { onDone } from '../../core/downloads';
import { isAdultId } from '../../core/adult';
import { toast, ui } from './state';
import { registerSW } from '../shared/pwa';
import { VERSION, VERSION_URL } from '../../core/config';

// Viewport < 700 px → mobile shell (?desktop forces desktop).
if (innerWidth < 700 && !/desktop/.test(location.search)) location.replace('../m/' + location.hash);
else render(<App />, document.getElementById('app')!);
onDone((it) => it && toast(it.status === 'done' ? (isAdultId(it.titleId) ? 'Saved' : 'Saved · ' + (it.savedAs || it.path)) : 'Download failed'));
let reloadFn: (() => void) | null = null;
registerSW((reload) => ((reloadFn = reload), ui.set({ pop: '' }), toast('New version available · click here to reload')));
addEventListener('click', (e) => {
  if (reloadFn && (e.target as HTMLElement).closest('.toast')) reloadFn();
});
async function pollVersion() {
  try {
    const v = ((await (await fetch(VERSION_URL, { cache: 'no-store' })).json()) as { version: string }).version;
    if (v && v !== VERSION && !VERSION.endsWith('-dev')) toast('New version available · reload the page');
  } catch {
    /* offline */
  }
}
setInterval(pollVersion, 3600 * 1000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void pollVersion());
