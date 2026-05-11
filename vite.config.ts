import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// פריסת GitHub Pages (אתר משתמש rordan-ai.github.io) — base /
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: true,
    port: 5173,
  },
})
