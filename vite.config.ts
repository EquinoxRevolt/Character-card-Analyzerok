import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/Character-card-Analyzerok/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify('4.2.8'),
    __BUILD_SHA__: JSON.stringify('custom-build')
  }
})
