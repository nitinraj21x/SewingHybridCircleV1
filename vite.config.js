import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Previously this plugin wrapped public-site/styles.css in @layer public-site.
 * That is now done directly in public-site/index.css via:
 *   @layer public-site { @import './styles.css'; }
 * This plugin is kept as a no-op for reference.
 */
function layerPublicSiteCss() {
  return { name: 'layer-public-site-css' };
}

export default defineConfig({
  plugins: [react(), layerPublicSiteCss(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: '/',
  server: {
    proxy: {
      // Proxy all /api requests to the Express backend during dev
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
