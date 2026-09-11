import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This MUST perfectly match the uppercase/lowercase letters in your URL.
  base: '/Character-card-Analyzerok/',
  plugins: [
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify('4.2.8'),
    __BUILD_SHA__: JSON.stringify('custom-build')
  }
})
