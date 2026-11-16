import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { capcutTts } from './tools/capcutTtsPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), capcutTts()],
})
