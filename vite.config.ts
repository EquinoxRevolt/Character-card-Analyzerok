import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// We are completely removing the VitePWA plugin so it stops 
// trying to hijack the mobile browser rendering!
export default defineConfig({
  base: './',
  plugins: [
    react()
  ],
})
