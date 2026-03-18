import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Isso substitui o "--host" (libera pro IP ***IP-INTERNO***)
    port: 4411  // Crava a porta que você precisa!
  },
  preview: {
    host: true,
    port: 4411
  }
})