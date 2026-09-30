import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin `/api/*` → local Fastify (strips `/api` prefix)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/tracking/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
