import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const HIGHLANDS_BARCODES = [
  { barcode: "1089215437", code: "#HL-8921", storeId: "highlands", storeName: "Highlands Coffee", drink: "Phindi Hạnh Nhân", price: 45000, pos: "POS 1", time: "10:30" },
  { barcode: "2789229104", code: "#HL-8922", storeId: "highlands", storeName: "Highlands Coffee", drink: "Trà Sen Vàng", price: 49000, pos: "POS 1", time: "10:35" },
  { barcode: "3989231846", code: "#HL-8923", storeId: "highlands", storeName: "Highlands Coffee", drink: "Phindi Hạnh Nhân", price: 45000, pos: "POS 2", time: "10:41" },
  { barcode: "4889247215", code: "#HL-8924", storeId: "highlands", storeName: "Highlands Coffee", drink: "Freeze Matcha", price: 55000, pos: "POS 2", time: "09:40" },
  { barcode: "5289256390", code: "#HL-8925", storeId: "highlands", storeName: "Highlands Coffee", drink: "Bánh Mì Que", price: 22000, pos: "POS 1", time: "08:50" },
  { barcode: "6389198041", code: "#HL-8919", storeId: "highlands", storeName: "Highlands Coffee", drink: "Trà Sen Vàng", price: 49000, pos: "POS 1", time: "08:15" },
  { barcode: "7589184319", code: "#HL-8918", storeId: "highlands", storeName: "Highlands Coffee", drink: "Freeze Matcha", price: 55000, pos: "POS 2", time: "07:50" },
];

function highlandsApiPlugin() {
  return {
    name: 'highlands-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.url === '/api/stickers' || req.url?.startsWith('/api/stickers')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            source: 'Highlands Coffee Store Portal :3013',
            total: HIGHLANDS_BARCODES.length,
            data: HIGHLANDS_BARCODES
          }));
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), highlandsApiPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'],
  },
  server: {
    port: 3013,
    host: true,
  },
});
