import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production build → GitHub Pages path· τοπικά στη ρίζα.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/makeup-studio/' : '/',
  plugins: [react()],
  server: { port: 5174 },
}))
