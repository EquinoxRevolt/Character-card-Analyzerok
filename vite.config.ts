import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // CRITICAL: This must exactly match your repository name!
  base: '/Character-card-Analyzerok/',
  plugins: [
    react(),
    VitePWA({ registerType: 'autoUpdate' })
  ],
})
