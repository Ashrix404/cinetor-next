import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  root: 'src/shells/desktop',
  base: './',
  envDir: '../../..',
  publicDir: false,
  plugins: [preact()],
  build: { target: 'es2020', outDir: '../../../dist/desktop', emptyOutDir: true },
});
