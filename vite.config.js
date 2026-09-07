import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// /api/coach is a Vercel Edge function and does not exist under `vite`. Proxying
// it to the deployment lets the coach be exercised locally against the SAME
// Supabase project the local app already talks to; the JWT the browser sends
// is the one it already holds. Dev only — Vercel serves /api itself.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'https://wifit.vercel.app', changeOrigin: true } } },
})
