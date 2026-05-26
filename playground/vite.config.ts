import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // Develop against source, not built artifacts.
      '@rw3iss/graph-utils/core': path.resolve(__dirname, '../src/core/index.ts'),
      '@rw3iss/graph-utils/chart': path.resolve(__dirname, '../src/chart/index.ts'),
      '@rw3iss/graph-utils/adapters': path.resolve(__dirname, '../src/adapters/index.ts'),
      '@rw3iss/graph-utils/overlays': path.resolve(__dirname, '../src/overlays/index.ts'),
      '@rw3iss/graph-utils': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
