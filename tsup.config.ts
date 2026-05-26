import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'chart/index': 'src/chart/index.ts',
    'adapters/index': 'src/adapters/index.ts',
    'overlays/index': 'src/overlays/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
});
