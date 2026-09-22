import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Use relative base ('./') by default so assets load properly on GitHub Pages (e.g. /<repo>/)
  base: process.env.VITE_BASE_PATH || './',
  build: {
    outDir: process.env.BUILD_OUT_DIR || '../public/studio',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});


