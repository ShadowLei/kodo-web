import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // kodo-core's bundle references Node's `global` (from the bundled
    // meta-mapper UMD wrapper); map it to `globalThis` for the browser.
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      // Also apply to pre-bundled deps in dev mode (root `define` is not
      // applied to optimizeDeps).
      define: { global: 'globalThis' },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
