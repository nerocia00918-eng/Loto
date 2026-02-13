import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: Allows running from a subfolder or drag-and-drop hosting
  server: {
    host: true, // Expose to Network (0.0.0.0)
    port: 5173, 
  }
})