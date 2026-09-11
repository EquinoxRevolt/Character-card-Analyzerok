import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Bulletproof relative path (works perfectly now that PWA is gone)
  base: './',
  plugins: [
    react()
  ],
  // THE FIX: Giving the app the missing variables it is crashing over!
  define: {
    __APP_VERSION__: JSON.stringify('4.2.8'),
    __BUILD_SHA__: JSON.stringify('custom-build')
  }
})
