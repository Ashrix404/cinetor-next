import { defineConfig } from 'vite';

// TV: vanilla TS, no Preact, old WebView target (docs/09-performance-budgets.md).
export default defineConfig({
  root: 'src/shells/tv',
  base: './',
  envDir: '../../..',
  publicDir: false,
  build: {
    target: ['es2017', 'chrome61'],
    cssTarget: 'chrome61',
    modulePreload: false,
    outDir: '../../../dist/tv',
    emptyOutDir: true,
  },
});
