import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/react-router') ||
            id.includes('/@remix-run/')
          ) {
            return 'router-vendor';
          }

          if (id.includes('/@mantine/')) {
            return 'mantine-vendor';
          }

          if (id.includes('/dexie')) {
            return 'dexie-vendor';
          }

          if (id.includes('/react') || id.includes('/scheduler')) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: './src/test/setup.ts',
  },
});
