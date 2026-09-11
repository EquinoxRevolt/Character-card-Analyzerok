import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This exactly matches your GitHub Pages URL structure. 
  // It guarantees the CSS and JavaScript will link together perfectly.
  base: '/Character-card-Analyzerok/',
  plugins: [
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify('4.2.8'),
    __BUILD_SHA__: JSON.stringify('custom-build')
  }
})
