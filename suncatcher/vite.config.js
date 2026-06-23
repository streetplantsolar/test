import { defineConfig } from 'vite';

// base: './' makes the built assets use relative paths so the static output
// can be dropped onto any static host (GitHub Pages, Netlify, S3, a subfolder).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
