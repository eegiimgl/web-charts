import { defineConfig } from 'vite';

// Static build. Locally base is '/', on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) it must be '/<repo>/'.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/web-charts/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
