import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// פריסת GitHub Pages (רק דף ציבורי): GITHUB_PAGES=1 ב-CI מגדיר base לשם הריפו
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === '1' ? '/SHLISHUK/' : '/',
  server: {
    host: true,
    port: 5173,
  },
})
