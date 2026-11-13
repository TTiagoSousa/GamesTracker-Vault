import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 5190: 5173 and 5180 are taken by other projects on this machine.
    // strictPort so it never jumps to another port.
    port: 5190,
    strictPort: true,
    // Listen on the local network too, so a phone can open http://<PC IP>:5190.
    host: true,
    // Same layout as production (nginx): /api/* goes to the backend without the prefix.
    // With VITE_API_URL=/api the site and the API share one origin, on localhost or the IP.
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
