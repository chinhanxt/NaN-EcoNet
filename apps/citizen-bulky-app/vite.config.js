import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const clientIpPlugin = () => ({
  name: 'client-ip',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ? req.url.split('?')[0] : '';
      if (req.method === 'GET' && (url === '/client-ip' || url === '/client-ip/')) {
        const rawIp =
          req.headers['cf-connecting-ip'] ||
          req.headers['x-real-ip'] ||
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        const ip = String(rawIp).replace(/^::ffff:/, '');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ip }));
        return;
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ? req.url.split('?')[0] : '';
      if (req.method === 'GET' && (url === '/client-ip' || url === '/client-ip/')) {
        const rawIp =
          req.headers['cf-connecting-ip'] ||
          req.headers['x-real-ip'] ||
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        const ip = String(rawIp).replace(/^::ffff:/, '');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ip }));
        return;
      }
      next();
    });
  },
});

let isSyncingPermissions = false;
async function syncDevicePermissions() {
  if (isSyncingPermissions) return;
  isSyncingPermissions = true;
  try {
    const authHeader = 'Basic ' + Buffer.from('admin@xathongminh.gov.vn:AdminPassword123!').toString('base64');
    const res = await fetch('http://localhost:8082/api/devices?all=true', {
      headers: { Authorization: authHeader },
    });
    if (res.ok) {
      const devices = await res.json();
      for (const dev of devices) {
        // Link to admin user (userId: 1)
        await fetch('http://localhost:8082/api/permissions', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: 1, deviceId: dev.id }),
        }).catch(() => {});

        // Link to SOS notification (notificationId: 1)
        await fetch('http://localhost:8082/api/permissions', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deviceId: dev.id, notificationId: 1 }),
        }).catch(() => {});
      }
    }
  } catch {
    // Ignore during boot
  } finally {
    isSyncingPermissions = false;
  }
}

const autoPermissionPlugin = () => ({
  name: 'auto-permission-sync',
  configureServer(server) {
    setTimeout(syncDevicePermissions, 2000);
    const timer = setInterval(syncDevicePermissions, 5000);
    server.httpServer?.on('close', () => clearInterval(timer));
  },
  configurePreviewServer(server) {
    setTimeout(syncDevicePermissions, 2000);
    const timer = setInterval(syncDevicePermissions, 5000);
    server.httpServer?.on('close', () => clearInterval(timer));
  },
});

export default defineConfig(() => ({
  server: {
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api/socket': 'ws://localhost:8082',
      '/api': 'http://localhost:8082',
      '/gps': {
        target: 'http://localhost:5055',
        rewrite: (path) => path.replace(/^\/gps/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', () => {
            setTimeout(syncDevicePermissions, 500);
          });
        },
      },
    },
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1100,
  },
  plugins: [
    clientIpPlugin(),
    autoPermissionPlugin(),
    svgr(),
    react(),
    VitePWA({
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/client-ip/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,mp3}'],
      },
      manifest: {
        short_name: '${title}',
        name: '${description}',
        theme_color: '${colorPrimary}',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', dest: '' },
      ],
    }),
  ],
}));
