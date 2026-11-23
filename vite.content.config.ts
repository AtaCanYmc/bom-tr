import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Content scripts cannot use bare ES imports in MV3; bundle as a single IIFE without wiping dist/.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'BomTrContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
