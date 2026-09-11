import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The absolute path prevents the CSS folder confusion forever!
  base: '/Character-card-Analyzerok/',
  plugins: [
    react()
  ],
  define: {
    __APP_VERSION__: JSON.stringify('4.2.8'),
    __BUILD_SHA__: JSON.stringify('custom-build')
  }
})
