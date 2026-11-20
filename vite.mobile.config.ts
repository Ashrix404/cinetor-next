import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  root: 'src/shells/mobile',
  base: './',
  envDir: '../../..',
  publicDir: false,
  plugins: [preact()],
  build: { target: 'es2020', outDir: '../../../dist/mobile', emptyOutDir: true },
});
