import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// פריסת GitHub Pages: GITHUB_PAGES=1 ב-CI מגדיר base ל־/{שם_ריפו}/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === '1' ? '/SHLISHUK/' : '/',
  server: {
    host: true,
    port: 5173,
  },
})
