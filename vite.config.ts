import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // CRITICAL: This absolute path tells it exactly where to find the JavaScript!
  base: '/Character-card-Analyzerok/',
  plugins: [
    react()
  ],
})
