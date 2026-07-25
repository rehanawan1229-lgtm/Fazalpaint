import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

const backendPort = Number(process.env.ORDER_SERVER_PORT || 5173);
const apiTarget = process.env.VITE_API_URL || `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    // FIX: '127.0.0.1' only accepts connections FROM the same machine —
    // a phone on the same WiFi could never reach it. 'true' listens on
    // every network interface, so http://<your-computer's-LAN-IP>:5173
    // works from a phone too (see .env.example for how to find your IP).
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: false,
      ignored: ['**/public/**']
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      },
      '/send-order': {
        target: apiTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
