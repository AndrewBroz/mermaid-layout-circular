import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/** Static build of the demo for GitHub Pages: every page of the
 *  gallery, with relative asset paths so the site works from a
 *  project subpath. `npm run dev` ignores this build config. */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        trials: resolve(import.meta.dirname, 'trials.html'),
        review: resolve(import.meta.dirname, 'review.html'),
      },
    },
  },
});
