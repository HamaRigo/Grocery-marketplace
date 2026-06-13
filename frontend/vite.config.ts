import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy all backend routes through Vite so cookies are same-origin.
const backendRoutes = '^/(auth|stores|catalog|inventory|cart|orders|fulfillment|tracking|billing|reports|health|discovery)'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      [backendRoutes]: {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/tracking/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
