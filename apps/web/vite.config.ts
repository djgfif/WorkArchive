import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],

  server: {
    host: '127.0.0.1',
    port: 53173,
    strictPort: true,
  },

  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (!normalizedId.includes('node_modules')) {
            return undefined;
          }

          if (normalizedId.includes('/dexie')) {
            return 'dexie-vendor';
          }

          return 'vendor';
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    globals: false,
    setupFiles: './src/test/setup.ts',
    testTimeout: 15_000,
  },
});
