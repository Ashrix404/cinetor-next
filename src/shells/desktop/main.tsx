import { render } from 'preact';
import './desktop.css';
import { App } from './app';
import { onDone } from '../../core/downloads';
import { toast } from './state';

// Viewport < 700 px → mobile shell (?desktop forces desktop).
if (innerWidth < 700 && !/desktop/.test(location.search)) location.replace('../m/' + location.hash);
else render(<App />, document.getElementById('app')!);
onDone((it) => it && toast(it.status === 'done' ? 'Saved · ' + (it.savedAs || it.path) : 'Download failed'));
