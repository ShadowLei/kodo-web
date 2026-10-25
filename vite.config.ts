import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // kodo-core is consumed directly from its TypeScript source so we can
      // iterate without a publish/build step. Only the memory-provider path
      // (pure TS, no Node deps) is imported by the simulated web tier.
      '@kodo-core': fileURLToPath(new URL('../kodo-core/src', import.meta.url)),
    },
  },
  // Allow serving files from the sibling kodo-core package in dev mode.
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
