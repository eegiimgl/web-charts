import { defineConfig } from 'vite';

// Static build. Served from the domain root (web-charts.eegii.dev),
// so base stays '/'. (Hash routing needs no server rewrites.)
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
