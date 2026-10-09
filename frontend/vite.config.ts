import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.BACKEND_WS_URL || 'ws://127.0.0.1:8001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
