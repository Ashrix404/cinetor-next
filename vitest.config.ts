import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: { environment: 'happy-dom', pool: 'threads', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
});
