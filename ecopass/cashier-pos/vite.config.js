import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: "/",
  server: {
    port: 3009,
    host: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['app-icons/icon.svg', 'app-icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html'
      },
      manifest: {
        name: 'EcoPass Cashier POS',
        short_name: 'EcoPass POS',
        description: 'EcoPass Cashier Voucher Scanner & Validator',
        theme_color: '#3A9A43',
        background_color: '#F8FAF8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000, // Increase the warning limit
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // All dependencies from node_modules will be collected in a separate chunk
          }
        }
      }
    }
  },
});