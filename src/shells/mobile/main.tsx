import { render } from 'preact';
import './app.css';
import './glass.css';
import { App, installBack } from './app';

render(<App />, document.getElementById('app-root')!);
installBack();
