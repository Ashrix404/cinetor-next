import { render } from 'preact';
import './app.css';
import './glass.css';
import { App, installBack } from './app';
import { startUpdateChecks } from './updates';
import { wireDownloadToasts } from './dl/page';

render(<App />, document.getElementById('app-root')!);
installBack();
startUpdateChecks();
wireDownloadToasts();
