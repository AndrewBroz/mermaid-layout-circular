import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'mermaid-layout-circular',
    },
    rollupOptions: {
      external: ['mermaid'],
    },
  },
});
