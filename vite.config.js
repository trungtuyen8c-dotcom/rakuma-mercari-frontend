import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api goes to the Go backend so the session cookie stays same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: false },
    },
  },
});
